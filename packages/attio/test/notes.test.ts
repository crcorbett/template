import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test, withResource } from "./test.js";
import { queryRecords } from "../src/services/records.js";
import { listNotes, createNote, getNote, updateNote, deleteNote } from "../src/services/notes.js";

describe("Notes", () => {
  test("should list notes", () =>
    Effect.gen(function* () {
      const result = yield* listNotes({ limit: 5 });
      expect(result.data).toBeDefined();
      expect(Array.isArray(result.data)).toBe(true);
    }));

  test("should perform full CRUD", { timeout: 60_000 }, () =>
    Effect.gen(function* () {
      const people = yield* queryRecords({ object: "people", limit: 1 });
      if (people.data.length === 0) return;
      const person = people.data[0]!;

      yield* withResource({
        acquire: createNote({
          parent_object: "people",
          parent_record_id: person.id.record_id,
          title: `Test Note ${Date.now()}`,
          format: "plaintext",
          content: "Test content",
        }),
        use: (created) =>
          Effect.gen(function* () {
            expect(created.data.id.note_id).toBeDefined();

            // Read back
            const fetched = yield* getNote({ note_id: created.data.id.note_id });
            expect(fetched.data.title).toBe(created.data.title);

            // Update
            const updated = yield* updateNote({
              note_id: created.data.id.note_id,
              title: "Updated Title",
            });
            expect(updated.data.title).toBe("Updated Title");
          }),
        release: (created) =>
          deleteNote({ note_id: created.data.id.note_id }).pipe(
            Effect.catchAll(() => Effect.void)
          ),
      });
    }));
});
