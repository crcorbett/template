import { expect } from "@effect/vitest";
import * as ActionsAPI from "@packages/posthog/actions";
import { apply, destroy } from "alchemy-effect";
import * as Effect from "effect/Effect";

import { Action } from "@/posthog/actions/index.js";
import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { makeAssertDeleted, test } from "../test.js";

const assertActionDeleted = makeAssertDeleted(
  "Action",
  ActionsAPI.getAction,
  (action) => action.deleted === true,
);

test(
  "create, update, delete action",
  { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    const projectId = yield* Project;

    // Create an action
    class TestAction extends Action("TestAction", {
      name: "Test Action",
      description: "A test action for integration testing",
    }) {}

    const stack = yield* apply(TestAction);

    // Verify the created action
    expect(stack.TestAction.id).toBeDefined();
    expect(typeof stack.TestAction.id).toBe("number");
    expect(stack.TestAction.name).toBe(TestAction.props.name);
    expect(stack.TestAction.description).toBe(
      "A test action for integration testing"
    );

    // Verify via direct API call
    const fetched = yield* ActionsAPI.getAction({
      project_id: projectId,
      id: stack.TestAction.id,
    });
    expect(fetched.name).toBe(TestAction.props.name);
    expect(fetched.description).toBe(
      "A test action for integration testing"
    );

    // Update the action
    class UpdatedAction extends Action("TestAction", {
      name: TestAction.props.name,
      description: "Updated action description",
    }) {}

    const updated = yield* apply(UpdatedAction);

    // Verify the update
    expect(updated.TestAction.id).toBe(stack.TestAction.id); // ID should be stable
    expect(updated.TestAction.description).toBe(
      "Updated action description"
    );

    // Verify update via API
    const fetchedUpdated = yield* ActionsAPI.getAction({
      project_id: projectId,
      id: stack.TestAction.id,
    });
    expect(fetchedUpdated.description).toBe("Updated action description");

    // Destroy the action
    yield* destroy();

    // Verify deletion
    yield* assertActionDeleted(stack.TestAction.id);
  }).pipe(Effect.provide(PostHog.providers()))
);
