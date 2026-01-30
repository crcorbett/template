import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioTasks from "@packages/attio/tasks";
import { Task } from "@/attio/task/index";
import { test, makeAssertDeleted } from "../test";
import * as Attio from "@/attio/index";

const assertTaskDeleted = makeAssertDeleted(
  "Task",
  (taskId: string) =>
    AttioTasks.getTask({ task_id: taskId }),
);

test("create, update, delete task", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    class TestTask extends Task("TestTask", {
      content: "Alchemy test task - follow up",
      format: "plaintext",
      isCompleted: false,
    }) {}

    const stack = yield* apply(TestTask);
    expect(stack.TestTask.taskId).toBeDefined();
    expect(stack.TestTask.contentPlaintext).toBe("Alchemy test task - follow up");
    expect(stack.TestTask.isCompleted).toBe(false);

    // Update
    class UpdatedTask extends Task("TestTask", {
      content: "Alchemy test task - follow up",
      format: "plaintext",
      isCompleted: true,
    }) {}

    const updated = yield* apply(UpdatedTask);
    expect(updated.TestTask.taskId).toBe(stack.TestTask.taskId);
    expect(updated.TestTask.isCompleted).toBe(true);

    // Destroy
    yield* destroy();
    yield* assertTaskDeleted(stack.TestTask.taskId);
  }).pipe(Effect.provide(Attio.providers())),
);
