import { expect } from "@effect/vitest";
import * as ExperimentsAPI from "@packages/posthog/experiments";
import { apply, destroy } from "alchemy-effect";
import * as Effect from "effect/Effect";

import { Experiment } from "@/posthog/experiments/index.js";
import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { makeAssertDeleted, test } from "../test.js";

const assertExperimentDeleted = makeAssertDeleted(
  "Experiment",
  ExperimentsAPI.getExperiment,
  (experiment) => experiment.archived === true,
);

test(
  "create, update, delete experiment",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;
    // Create an experiment
    class TestExperiment extends Experiment("TestExperiment", {
      name: "Test Experiment",
      featureFlagKey: "test-exp-flag",
      description: "A test experiment for integration testing",
    }) {}

    const stack = yield* apply(TestExperiment);

    // Verify the created experiment
    expect(stack.TestExperiment.id).toBeDefined();
    expect(typeof stack.TestExperiment.id).toBe("number");
    expect(stack.TestExperiment.name).toBe("Test Experiment");
    expect(stack.TestExperiment.featureFlagKey).toBe("test-exp-flag");

    // Verify via direct API call
    const fetched = yield* ExperimentsAPI.getExperiment({
      project_id: projectId,
      id: stack.TestExperiment.id,
    });
    expect(fetched.name).toBe("Test Experiment");
    expect(fetched.feature_flag_key).toBe("test-exp-flag");
    expect(fetched.description).toBe(
      "A test experiment for integration testing"
    );

    // Update the experiment
    class UpdatedExperiment extends Experiment("TestExperiment", {
      name: "Test Experiment",
      featureFlagKey: "test-exp-flag",
      description: "Updated experiment description",
    }) {}

    const updated = yield* apply(UpdatedExperiment);

    // Verify the update
    expect(updated.TestExperiment.id).toBe(stack.TestExperiment.id); // ID should be stable
    expect(updated.TestExperiment.featureFlagKey).toBe(
      stack.TestExperiment.featureFlagKey
    );

    // Verify update via API
    const fetchedUpdated = yield* ExperimentsAPI.getExperiment({
      project_id: projectId,
      id: stack.TestExperiment.id,
    });
    expect(fetchedUpdated.description).toBe(
      "Updated experiment description"
    );

    // Destroy the experiment
    yield* destroy();

    // Verify deletion (hard delete - should get NotFoundError)
    yield* assertExperimentDeleted(stack.TestExperiment.id);
  }).pipe(Effect.provide(PostHog.providers()))
);

test(
  "replace experiment on feature flag key change",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;
    // Create initial experiment
    class ExpV1 extends Experiment("ReplaceExperiment", {
      name: "Replace Experiment",
      featureFlagKey: "exp-flag-v1",
    }) {}

    const stackV1 = yield* apply(ExpV1);
    const originalId = stackV1.ReplaceExperiment.id;

    expect(originalId).toBeDefined();
    expect(stackV1.ReplaceExperiment.featureFlagKey).toBe("exp-flag-v1");

    // Change the feature flag key - this should trigger a replacement
    class ExpV2 extends Experiment("ReplaceExperiment", {
      name: "Replace Experiment",
      featureFlagKey: "exp-flag-v2",
    }) {}

    const stackV2 = yield* apply(ExpV2);

    // Verify replacement - new ID should be different
    expect(stackV2.ReplaceExperiment.id).not.toBe(originalId);
    expect(stackV2.ReplaceExperiment.featureFlagKey).toBe("exp-flag-v2");

    // Verify new experiment exists via API
    const newExp = yield* ExperimentsAPI.getExperiment({
      project_id: projectId,
      id: stackV2.ReplaceExperiment.id,
    });
    expect(newExp.feature_flag_key).toBe("exp-flag-v2");

    // Verify old experiment was deleted
    yield* assertExperimentDeleted(originalId);

    // Cleanup
    yield* destroy();

    // Verify final cleanup
    yield* assertExperimentDeleted(stackV2.ReplaceExperiment.id);
  }).pipe(Effect.provide(PostHog.providers()))
);
