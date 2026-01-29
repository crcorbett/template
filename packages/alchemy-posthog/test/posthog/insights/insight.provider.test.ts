import { expect } from "@effect/vitest";
import * as InsightsAPI from "@packages/posthog/insights";
import { apply, destroy } from "alchemy-effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import { Insight } from "@/posthog/insights/index.js";
import * as PostHog from "@/posthog/index.js";
import { test, TEST_PROJECT_ID } from "../test.js";

/**
 * Error thrown when an insight still exists when it should have been deleted.
 */
class InsightNotDeletedError extends Data.TaggedError(
  "InsightNotDeletedError"
)<{
  readonly id: number;
}> {}

/**
 * Asserts that an insight has been (soft) deleted.
 * PostHog soft-deletes insights via PATCH deleted: true.
 * Retries the check up to 5 times with exponential backoff.
 */
const assertInsightDeleted = Effect.fn(function* (id: number) {
  const projectId = yield* TEST_PROJECT_ID;
  yield* InsightsAPI.getInsight({
    project_id: projectId,
    id,
  }).pipe(
    Effect.flatMap((insight) => {
      if (insight.deleted === true) {
        return Effect.void;
      }
      return Effect.fail(new InsightNotDeletedError({ id }));
    }),
    Effect.catchTag("NotFoundError", () => Effect.void),
    Effect.catchTag("PostHogError", (err) => {
      if (err.code === "404") {
        return Effect.void;
      }
      return Effect.fail(err);
    }),
    Effect.retry(
      Schedule.intersect(Schedule.recurs(5), Schedule.exponential("100 millis"))
    )
  );
});

test(
  "create, update, delete insight",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* TEST_PROJECT_ID;

    // Create an insight
    class TestInsight extends Insight("TestInsight", {
      name: "Test Insight",
      saved: true,
    }) {}

    const stack = yield* apply(TestInsight);

    // Verify the created insight
    expect(stack.TestInsight.id).toBeDefined();
    expect(typeof stack.TestInsight.id).toBe("number");
    expect(stack.TestInsight.name).toBe(TestInsight.props.name);

    // Verify via direct API call
    const fetched = yield* InsightsAPI.getInsight({
      project_id: projectId,
      id: stack.TestInsight.id,
    });
    expect(fetched.name).toBe(TestInsight.props.name);

    // Update the insight
    class UpdatedInsight extends Insight("TestInsight", {
      name: TestInsight.props.name,
      description: "Updated insight description",
      saved: true,
    }) {}

    const updated = yield* apply(UpdatedInsight);

    // Verify the update
    expect(updated.TestInsight.id).toBe(stack.TestInsight.id); // ID should be stable
    expect(updated.TestInsight.description).toBe(
      "Updated insight description"
    );

    // Verify update via API
    const fetchedUpdated = yield* InsightsAPI.getInsight({
      project_id: projectId,
      id: stack.TestInsight.id,
    });
    expect(fetchedUpdated.description).toBe(
      "Updated insight description"
    );

    // Destroy the insight
    yield* destroy();

    // Verify deletion (soft delete)
    yield* assertInsightDeleted(stack.TestInsight.id);
  }).pipe(Effect.provide(PostHog.providers()))
);
