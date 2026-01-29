import { expect } from "@effect/vitest";
import * as ActionsAPI from "@packages/posthog/actions";
import { apply, destroy } from "alchemy-effect";
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Schedule from "effect/Schedule";

import { Action } from "@/posthog/actions/index.js";
import * as PostHog from "@/posthog/index.js";
import { Project } from "@/posthog/project.js";
import { test } from "../test.js";

/**
 * Error thrown when an action still exists when it should have been deleted.
 */
class ActionNotDeletedError extends Data.TaggedError(
  "ActionNotDeletedError"
)<{
  readonly id: number;
}> {}

/**
 * Asserts that an action has been (soft) deleted.
 * PostHog soft-deletes actions via PATCH with deleted: true.
 * Retries the check up to 5 times with exponential backoff.
 */
const assertActionDeleted = Effect.fn(function* (id: number) {
  const projectId = yield* Project;
  yield* ActionsAPI.getAction({
    project_id: projectId,
    id,
  }).pipe(
    Effect.flatMap((action) => {
      if (action.deleted === true) {
        return Effect.void;
      }
      return Effect.fail(new ActionNotDeletedError({ id }));
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
