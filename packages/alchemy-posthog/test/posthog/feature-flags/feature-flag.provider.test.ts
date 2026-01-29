import { expect } from "@effect/vitest";
import * as FeatureFlagsAPI from "@packages/posthog/feature-flags";
import { apply, destroy } from "alchemy-effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import { FeatureFlag } from "@/posthog/feature-flags/index.js";
import * as PostHog from "@/posthog/index.js";
import { test, TEST_PROJECT_ID } from "../test.js";

/**
 * Error thrown when a feature flag still exists when it should have been deleted.
 */
class FeatureFlagNotDeletedError extends Data.TaggedError(
  "FeatureFlagNotDeletedError"
)<{
  readonly id: number;
}> {}

/**
 * Asserts that a feature flag has been (soft) deleted.
 * PostHog uses soft delete - the flag is marked with deleted: true.
 * Retries the check up to 5 times with exponential backoff.
 */
const assertFeatureFlagDeleted = Effect.fn(function* (id: number) {
  const projectId = yield* TEST_PROJECT_ID;
  yield* FeatureFlagsAPI.getFeatureFlag({
    project_id: projectId,
    id,
  }).pipe(
    Effect.flatMap((flag) => {
      // PostHog soft-deletes feature flags - check for deleted: true
      if (flag.deleted === true) {
        return Effect.void;
      }
      return Effect.fail(new FeatureFlagNotDeletedError({ id }));
    }),
    // Also handle actual 404s (in case PostHog changes behavior)
    Effect.catchTag("NotFoundError", () => Effect.void),
    Effect.retry(
      Schedule.intersect(Schedule.recurs(5), Schedule.exponential("100 millis"))
    )
  );
});

test(
  "create, update, delete feature flag",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* TEST_PROJECT_ID;

    // Create a feature flag
    class TestFlag extends FeatureFlag("TestFlag", {
      key: "test-flag-crud",
      name: "Test Flag",
      active: true,
    }) {}

    const stack = yield* apply(TestFlag);

    // Verify the created flag
    expect(stack.TestFlag.id).toBeDefined();
    expect(typeof stack.TestFlag.id).toBe("number");
    expect(stack.TestFlag.key).toBe(TestFlag.props.key);
    expect(stack.TestFlag.name).toBe("Test Flag");
    expect(stack.TestFlag.active).toBe(true);

    // Verify via direct API call
    const fetched = yield* FeatureFlagsAPI.getFeatureFlag({
      project_id: projectId,
      id: stack.TestFlag.id,
    });
    expect(fetched.key).toBe(TestFlag.props.key);
    expect(fetched.name).toBe("Test Flag");
    expect(fetched.active).toBe(true);

    // Update the flag
    class UpdatedFlag extends FeatureFlag("TestFlag", {
      key: TestFlag.props.key,
      name: "Updated Flag",
      active: false,
    }) {}

    const updated = yield* apply(UpdatedFlag);

    // Verify the update
    expect(updated.TestFlag.id).toBe(stack.TestFlag.id); // ID should be stable
    expect(updated.TestFlag.name).toBe("Updated Flag");
    expect(updated.TestFlag.active).toBe(false);

    // Verify update via API
    const fetchedUpdated = yield* FeatureFlagsAPI.getFeatureFlag({
      project_id: projectId,
      id: stack.TestFlag.id,
    });
    expect(fetchedUpdated.name).toBe("Updated Flag");
    expect(fetchedUpdated.active).toBe(false);

    // Destroy the flag
    yield* destroy();

    // Verify deletion
    yield* assertFeatureFlagDeleted(stack.TestFlag.id);
  }).pipe(Effect.provide(PostHog.providers()))
);

test(
  "replace feature flag on key change",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* TEST_PROJECT_ID;
    // Create initial flag
    class FlagV1 extends FeatureFlag("ReplaceFlag", {
      key: "test-flag-v1",
      name: "Version 1",
      active: true,
    }) {}

    const stackV1 = yield* apply(FlagV1);
    const originalId = stackV1.ReplaceFlag.id;

    expect(originalId).toBeDefined();
    expect(stackV1.ReplaceFlag.key).toBe("test-flag-v1");

    // Change the key - this should trigger a replacement
    class FlagV2 extends FeatureFlag("ReplaceFlag", {
      key: "test-flag-v2",
      name: "Version 2",
      active: true,
    }) {}

    const stackV2 = yield* apply(FlagV2);

    // Verify replacement - new ID should be different
    expect(stackV2.ReplaceFlag.id).not.toBe(originalId);
    expect(stackV2.ReplaceFlag.key).toBe("test-flag-v2");
    expect(stackV2.ReplaceFlag.name).toBe("Version 2");

    // Verify new flag exists via API
    const newFlag = yield* FeatureFlagsAPI.getFeatureFlag({
      project_id: projectId,
      id: stackV2.ReplaceFlag.id,
    });
    expect(newFlag.key).toBe("test-flag-v2");

    // Verify old flag was deleted
    yield* assertFeatureFlagDeleted(originalId);

    // Cleanup
    yield* destroy();

    // Verify final cleanup
    yield* assertFeatureFlagDeleted(stackV2.ReplaceFlag.id);
  }).pipe(Effect.provide(PostHog.providers()))
);
