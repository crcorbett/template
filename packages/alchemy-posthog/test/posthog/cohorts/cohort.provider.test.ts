import { expect } from "@effect/vitest";
import * as CohortsAPI from "@packages/posthog/cohorts";
import { apply, destroy } from "alchemy-effect";
import * as Effect from "effect/Effect";

import { Cohort } from "@/posthog/cohorts/index.js";
import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { makeAssertDeleted, test } from "../test.js";

const assertCohortDeleted = makeAssertDeleted(
  "Cohort",
  CohortsAPI.getCohort,
  (cohort) => cohort.deleted === true,
);

test(
  "create, update, delete cohort",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;

    // Create a cohort
    class TestCohort extends Cohort("TestCohort", {
      name: "Test Cohort",
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
