import { describe, expect } from "@effect/vitest";
import * as CohortsAPI from "@packages/posthog/cohorts";
import { apply, destroy } from "alchemy-effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import { Cohort } from "../../../src/posthog/cohorts/index.js";
import * as PostHog from "../../../src/posthog/index.js";
import { test, TEST_PROJECT_ID } from "../test.js";

/**
 * Error thrown when a cohort still exists when it should have been deleted.
 */
class CohortNotDeletedError extends Data.TaggedError(
  "CohortNotDeletedError"
)<{
  readonly id: number;
}> {}

/**
 * Asserts that a cohort has been (soft) deleted.
 * PostHog soft-deletes cohorts via PATCH with deleted: true.
 * Retries the check up to 5 times with exponential backoff.
 */
const assertCohortDeleted = (id: number) =>
  Effect.gen(function* () {
    const projectId = yield* TEST_PROJECT_ID;
    yield* CohortsAPI.getCohort({
      project_id: projectId,
      id,
    }).pipe(
      Effect.flatMap((cohort) => {
        if (cohort.deleted === true) {
          return Effect.void;
        }
        return Effect.fail(new CohortNotDeletedError({ id }));
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

describe("PostHog Cohort Provider", () => {
  describe("integration tests", () => {
    test(
      "create, update, delete cohort",
      { timeout: 120_000 },
      Effect.gen(function* () {
        yield* destroy();

        const projectId = yield* TEST_PROJECT_ID;

        // Create a cohort
        class TestCohort extends Cohort("TestCohort", {
          name: `Test Cohort ${Date.now()}`,
          description: "A test cohort for integration testing",
        }) {}

        const stack = yield* apply(TestCohort);

        // Verify the created cohort
        expect(stack.TestCohort.id).toBeDefined();
        expect(typeof stack.TestCohort.id).toBe("number");
        expect(stack.TestCohort.name).toBe(TestCohort.props.name);
        expect(stack.TestCohort.description).toBe(
          "A test cohort for integration testing"
        );

        // Verify via direct API call
        const fetched = yield* CohortsAPI.getCohort({
          project_id: projectId,
          id: stack.TestCohort.id,
        });
        expect(fetched.name).toBe(TestCohort.props.name);
        expect(fetched.description).toBe(
          "A test cohort for integration testing"
        );

        // Update the cohort
        class UpdatedCohort extends Cohort("TestCohort", {
          name: TestCohort.props.name,
          description: "Updated cohort description",
        }) {}

        const updated = yield* apply(UpdatedCohort);

        // Verify the update
        expect(updated.TestCohort.id).toBe(stack.TestCohort.id); // ID should be stable
        expect(updated.TestCohort.description).toBe(
          "Updated cohort description"
        );

        // Verify update via API
        const fetchedUpdated = yield* CohortsAPI.getCohort({
          project_id: projectId,
          id: stack.TestCohort.id,
        });
        expect(fetchedUpdated.description).toBe("Updated cohort description");

        // Destroy the cohort
        yield* destroy();

        // Verify deletion
        yield* assertCohortDeleted(stack.TestCohort.id);
      }).pipe(Effect.provide(PostHog.providers()))
    );
  });
});
