import { describe, expect } from "@effect/vitest";
import * as AnnotationsAPI from "@packages/posthog/annotations";
import { apply, destroy } from "alchemy-effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import { Annotation } from "../../../src/posthog/annotations/index.js";
import * as PostHog from "../../../src/posthog/index.js";
import { test, TEST_PROJECT_ID } from "../test.js";

/**
 * Error thrown when an annotation still exists when it should have been deleted.
 */
class AnnotationNotDeletedError extends Data.TaggedError(
  "AnnotationNotDeletedError"
)<{
  readonly id: number;
}> {}

/**
 * Asserts that an annotation has been (hard) deleted.
 * PostHog hard-deletes annotations via HTTP DELETE.
 * Retries the check up to 5 times with exponential backoff.
 */
const assertAnnotationDeleted = (id: number) =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    yield* AnnotationsAPI.getAnnotation({
      project_id: projectId,
      id,
    }).pipe(
      Effect.flatMap((annotation) => {
        if (annotation.deleted === true) {
          return Effect.void;
        }
        return Effect.fail(new AnnotationNotDeletedError({ id }));
      }),
      Effect.catchTag("NotFoundError", () => Effect.void),
      Effect.catchTag("PostHogError", (err) => {
        if (err.code === "404") {
          return Effect.void;
        }
        return Effect.fail(err);
      }),
      Effect.retry(
        Schedule.compose(Schedule.recurs(5), Schedule.exponential("500 millis"))
      )
    );
  });

describe("PostHog Annotation Provider", () => {
  describe("integration tests", () => {
    test(
      "create, update, delete annotation",
      { timeout: 120_000 },
      Effect.gen(function* () {
        yield* destroy();

        const projectId = yield* TEST_PROJECT_ID;

        // Create an annotation
        class TestAnnotation extends Annotation("TestAnnotation", {
          content: "Test annotation",
          dateMarker: new Date().toISOString(),
          scope: "project" as const,
        }) {}

        const stack = yield* apply(TestAnnotation);

        // Verify the created annotation
        expect(stack.TestAnnotation.id).toBeDefined();
        expect(typeof stack.TestAnnotation.id).toBe("number");
        expect(stack.TestAnnotation.content).toBe(TestAnnotation.props.content);
        expect(stack.TestAnnotation.scope).toBe("project");

        // Verify via direct API call
        const fetched = yield* AnnotationsAPI.getAnnotation({
          project_id: projectId,
          id: stack.TestAnnotation.id,
        });
        expect(fetched.content).toBe(TestAnnotation.props.content);
        expect(fetched.scope).toBe("project");

        // Update the annotation
        class UpdatedAnnotation extends Annotation("TestAnnotation", {
          content: "Updated annotation content",
          dateMarker: TestAnnotation.props.dateMarker,
          scope: "project" as const,
        }) {}

        const updated = yield* apply(UpdatedAnnotation);

        // Verify the update
        expect(updated.TestAnnotation.id).toBe(stack.TestAnnotation.id); // ID should be stable
        expect(updated.TestAnnotation.content).toBe(
          "Updated annotation content"
        );

        // Verify update via API
        const fetchedUpdated = yield* AnnotationsAPI.getAnnotation({
          project_id: projectId,
          id: stack.TestAnnotation.id,
        });
        expect(fetchedUpdated.content).toBe("Updated annotation content");

        // Destroy the annotation
        yield* destroy();

        // Verify deletion (hard delete)
        yield* assertAnnotationDeleted(stack.TestAnnotation.id);
      }).pipe(Effect.provide(PostHog.providers()))
    );
  });
});
