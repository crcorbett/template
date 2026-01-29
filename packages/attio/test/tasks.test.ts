import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test, withResource } from "./test.js";
import { queryRecords } from "../src/services/records.js";
import { listTasks, createTask, getTask, updateTask, deleteTask } from "../src/services/tasks.js";

describe("Tasks", () => {
  test("should list tasks", () =>
    Effect.gen(function* () {
      const result = yield* listTasks({ limit: 5 });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));

  test("should perform full CRUD", { timeout: 60_000 }, () =>
    Effect.gen(function* () {
      const people = yield* queryRecords({ object: "people", limit: 1 });
      if (people.data.length === 0) return;
      const person = people.data[0]!;

      yield* withResource({
        acquire: createTask({
          content: `Test Task ${Date.now()}`,
          format: "plaintext",
          is_completed: false,
          deadline_at: null,
          linked_records: [
            {
              target_object: "people",
              target_record_id: person.id.record_id,
            },
          ],
          assignees: [],
        }),
        use: (created) =>
          Effect.gen(function* () {
            expect(created.data.id.task_id).toBeDefined();

            // Read back
            const fetched = yield* getTask({ task_id: created.data.id.task_id });
            expect(fetched.data.id.task_id).toBe(created.data.id.task_id);

            // Update
            const updated = yield* updateTask({
              task_id: created.data.id.task_id,
              is_completed: true,
            });
            expect(updated.data.is_completed).toBe(true);
          }),
        release: (created) =>
          deleteTask({ task_id: created.data.id.task_id }).pipe(
            Effect.catchAll(() => Effect.void)
          ),
      });
    }));
});
