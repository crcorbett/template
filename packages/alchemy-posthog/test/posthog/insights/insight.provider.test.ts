import { expect } from "@effect/vitest";
import * as InsightsAPI from "@packages/posthog/insights";
import { apply, destroy } from "alchemy-effect";
import * as Effect from "effect/Effect";

import { Insight } from "@/posthog/insights/index.js";
import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { makeAssertDeleted, test } from "../test.js";

const assertInsightDeleted = makeAssertDeleted(
  "Insight",
  InsightsAPI.getInsight,
  (insight) => insight.deleted === true,
);

test(
  "create, update, delete insight",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;

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
