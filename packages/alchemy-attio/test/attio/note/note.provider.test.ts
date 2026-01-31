import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioNotes from "@packages/attio/notes";
import * as AttioRecords from "@packages/attio/records";
import { Note } from "@/attio/note/index";
import { test } from "../test";
import * as Attio from "@/attio/index";

test("create and delete note", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    // Create a parent record directly via SDK (not alchemy) so destroy()
    // only handles the note and avoids ordering issues.
    const record = yield* AttioRecords.assertRecord({
      object: "people",
      matching_attribute: "email_addresses",
      data: {
        values: {
          email_addresses: [{ email_address: "alchemy-note-test@example.com" }],
        },
      },
    });
    const parentRecordId = record.data.id.record_id;

    class TestNote extends Note("TestNote", {
      parentObject: "people",
      parentRecordId,
      title: "Alchemy Note Test",
      format: "plaintext",
      content: "Test note content from alchemy provider",
    }) {}

    const stack = yield* apply(TestNote);
    expect(stack.TestNote.noteId).toBeDefined();
    expect(stack.TestNote.title).toBe("Alchemy Note Test");

    // Verify via listNotes (getNote has eventual consistency issues)
    const notes = yield* AttioNotes.listNotes({
      parent_object: "people",
      parent_record_id: parentRecordId,
    });
    const found = notes.data.find((n) => n.title === "Alchemy Note Test");
    expect(found).toBeDefined();

    // Destroy alchemy resources (only the note)
    yield* destroy();

    // Clean up the SDK-created record
    yield* AttioRecords.deleteRecord({
      object: "people",
      record_id: parentRecordId,
    }).pipe(Effect.catchAll(() => Effect.void));
  }).pipe(Effect.provide(Attio.providers())),
);
