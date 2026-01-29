import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test } from "./test.js";
import { queryRecords } from "../src/services/records.js";
import { createNote, deleteNote } from "../src/services/notes.js";
import { createComment, deleteComment } from "../src/services/comments.js";

describe("Comments", () => {
  test("should create and delete a comment on a note thread", { timeout: 60_000 }, () =>
    Effect.gen(function* () {
      // Find a person to attach a note to
      const people = yield* queryRecords({ object: "people", limit: 1 });
      if (people.data.length === 0) return;
      const person = people.data[0]!;

      // Create a note (which creates a thread)
      const note = yield* createNote({
        parent_object: "people",
        parent_record_id: person.id.record_id,
        title: `Comment Test Note ${Date.now()}`,
        format: "plaintext",
        content: "Note for comment test",
      });

      try {
        // Create a comment on the note's thread
        const comment = yield* createComment({
          thread_id: note.data.id.note_id,
          format: "plaintext",
          content: "Test comment",
        });

        expect(comment.data).toBeDefined();
        expect(comment.data.id).toBeDefined();

        // Delete the comment
        yield* deleteComment({
          comment_id: String(comment.data.id),
        }).pipe(Effect.catchAll(() => Effect.void));
      } finally {
        // Cleanup the note
        yield* deleteNote({ note_id: note.data.id.note_id }).pipe(
          Effect.catchAll(() => Effect.void)
        );
      }
    }));
});
