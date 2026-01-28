import { describe, expect } from "@effect/vitest";
import * as AnnotationsAPI from "@packages/posthog/annotations";
import * as DashboardsAPI from "@packages/posthog/dashboards";
import * as FeatureFlagsAPI from "@packages/posthog/feature-flags";
import { apply, destroy } from "alchemy-effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import { Annotation } from "../../src/posthog/annotations/index.js";
import { Dashboard } from "../../src/posthog/dashboards/index.js";
import { FeatureFlag } from "../../src/posthog/feature-flags/index.js";
import * as PostHog from "../../src/posthog/index.js";
import { test, TEST_PROJECT_ID } from "./test.js";

class FeatureFlagNotDeletedError extends Data.TaggedError(
  "FeatureFlagNotDeletedError"
)<{
  readonly id: number;
}> {}

class DashboardNotDeletedError extends Data.TaggedError(
  "DashboardNotDeletedError"
)<{
  readonly id: number;
}> {}

class AnnotationNotDeletedError extends Data.TaggedError(
  "AnnotationNotDeletedError"
)<{
  readonly id: number;
}> {}

const assertFeatureFlagDeleted = (id: number) =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    yield* FeatureFlagsAPI.getFeatureFlag({
      project_id: projectId,
      id,
    }).pipe(
      Effect.flatMap((flag) => {
        if (flag.deleted === true) {
          return Effect.void;
        }
        return Effect.fail(new FeatureFlagNotDeletedError({ id }));
      }),
      Effect.catchTag("NotFoundError", () => Effect.void),
      Effect.retry(
        Schedule.compose(Schedule.recurs(5), Schedule.exponential("500 millis"))
      )
    );
  });

const assertDashboardDeleted = (id: number) =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    yield* DashboardsAPI.getDashboard({
      project_id: projectId,
      id,
    }).pipe(
      Effect.flatMap((dashboard) => {
        if (dashboard.deleted === true) {
          return Effect.void;
        }
        return Effect.fail(new DashboardNotDeletedError({ id }));
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

describe("PostHog Provider Smoke Test", () => {
  describe("integration tests", () => {
    test(
      "create and manage related PostHog resources",
      { timeout: 120_000 },
      Effect.gen(function* () {
        yield* destroy();

        const projectId = yield* TEST_PROJECT_ID;

        // Create a FeatureFlag
        class SmokeFlag extends FeatureFlag("SmokeFlag", {
          key: "smoke-test-flag",
          name: "Smoke Test Flag",
          active: true,
        }) {}

        // Create a Dashboard
        class SmokeDashboard extends Dashboard("SmokeDashboard", {
          name: "Smoke Test Dashboard",
          description: "Dashboard for smoke testing",
        }) {}

        // Create an Annotation
        class SmokeAnnotation extends Annotation("SmokeAnnotation", {
          content: "Smoke test annotation",
          scope: "project" as const,
        }) {}

        // Apply all resources together
        const stack = yield* apply(SmokeFlag, SmokeDashboard, SmokeAnnotation);

        // Verify FeatureFlag
        expect(stack.SmokeFlag.id).toBeDefined();
        expect(typeof stack.SmokeFlag.id).toBe("number");
        expect(stack.SmokeFlag.key).toBe("smoke-test-flag");
        expect(stack.SmokeFlag.active).toBe(true);

        const fetchedFlag = yield* FeatureFlagsAPI.getFeatureFlag({
          project_id: projectId,
          id: stack.SmokeFlag.id,
        });
        expect(fetchedFlag.key).toBe("smoke-test-flag");
        expect(fetchedFlag.name).toBe("Smoke Test Flag");

        // Verify Dashboard
        expect(stack.SmokeDashboard.id).toBeDefined();
        expect(typeof stack.SmokeDashboard.id).toBe("number");
        expect(stack.SmokeDashboard.name).toBe("Smoke Test Dashboard");

        const fetchedDashboard = yield* DashboardsAPI.getDashboard({
          project_id: projectId,
          id: stack.SmokeDashboard.id,
        });
        expect(fetchedDashboard.name).toBe("Smoke Test Dashboard");
        expect(fetchedDashboard.description).toBe(
          "Dashboard for smoke testing"
        );

        // Verify Annotation
        expect(stack.SmokeAnnotation.id).toBeDefined();
        expect(typeof stack.SmokeAnnotation.id).toBe("number");
        expect(stack.SmokeAnnotation.content).toBe("Smoke test annotation");
        expect(stack.SmokeAnnotation.scope).toBe("project");

        const fetchedAnnotation = yield* AnnotationsAPI.getAnnotation({
          project_id: projectId,
          id: stack.SmokeAnnotation.id,
        });
        expect(fetchedAnnotation.content).toBe("Smoke test annotation");
        expect(fetchedAnnotation.scope).toBe("project");

        // Destroy all resources
        yield* destroy();

        // Verify all cleaned up
        yield* assertFeatureFlagDeleted(stack.SmokeFlag.id);
        yield* assertDashboardDeleted(stack.SmokeDashboard.id);
        yield* assertAnnotationDeleted(stack.SmokeAnnotation.id);
      }).pipe(Effect.provide(PostHog.providers()))
    );
  });
});
