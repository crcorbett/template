import * as AttioNotes from "@packages/attio/notes";
import * as Effect from "effect/Effect";

import type { NoteAttrs } from "./note";

import { retryPolicy } from "../retry";
import { Note as NoteResource } from "./note";

function mapResponseToAttrs(
  result: typeof AttioNotes.AttioNote.Type,
): NoteAttrs {
  return {
    noteId: result.id.note_id,
    parentObject: result.parent_object ?? null,
    parentRecordId: result.parent_record_id ?? null,
    title: result.title,
    contentPlaintext: result.content_plaintext ?? null,
    format: result.format ?? null,
    createdAt: result.created_at,
  };
}

export const noteProvider = () =>
  NoteResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["noteId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // Notes cannot be updated — any change requires replacement
          if (
            news.parentObject !== olds.parentObject ||
            news.parentRecordId !== olds.parentRecordId ||
            news.title !== olds.title ||
            news.format !== olds.format ||
            news.content !== olds.content
          ) {
            return { action: "replace" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          // Primary: lookup by noteId
          if (output?.noteId) {
            const result = yield* retryPolicy(
              AttioNotes.getNote({ note_id: output.noteId }),
            ).pipe(
              Effect.catchAll(() =>
                Effect.succeed(undefined),
              ),
            );

            if (result) {
              return mapResponseToAttrs(result.data);
            }
          }

          // Fallback: paginated scan by parent + title
          // Guard: parentRecordId must be a valid UUID (the API rejects other values)
          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (
            olds?.parentObject &&
            olds?.parentRecordId &&
            uuidRe.test(olds.parentRecordId) &&
            olds?.title
          ) {
            let offset = 0;
            const limit = 50;
            while (true) {
              const page = yield* retryPolicy(
                AttioNotes.listNotes({
                  parent_object: olds.parentObject,
                  parent_record_id: olds.parentRecordId,
                  limit,
                  offset,
                }),
              ).pipe(
                Effect.catchAll(() =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.data || page.data.length === 0) break;

              const match = page.data.find(
                (n) => n.title === olds.title,
              );
              if (match) return mapResponseToAttrs(match);

              if (page.data.length < limit) break;
              offset += limit;
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: scan for existing note by parent + title
          const uuidRe = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
          if (uuidRe.test(news.parentRecordId)) {
            let offset = 0;
            const limit = 50;
            while (true) {
              const page = yield* retryPolicy(
                AttioNotes.listNotes({
                  parent_object: news.parentObject,
                  parent_record_id: news.parentRecordId,
                  limit,
                  offset,
                }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
                Effect.catchTag("ValidationError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.data || page.data.length === 0) break;

              const existing = page.data.find(
                (n) => n.title === news.title,
              );

              if (existing) {
                // Verify the note still exists (guard against eventual consistency
                // after a recent delete)
                const verified = yield* retryPolicy(
                  AttioNotes.getNote({ note_id: existing.id.note_id }),
                ).pipe(
                  Effect.catchTag("NotFoundError", () =>
                    Effect.succeed(undefined),
                  ),
                );

                if (verified) {
                  yield* session.note(
                    `Idempotent Note: found existing "${news.title}"`,
                  );
                  return mapResponseToAttrs(verified.data);
                }
              }

              if (page.data.length < limit) break;
              offset += limit;
            }
          }

          const result = yield* retryPolicy(
            AttioNotes.createNote({
              parent_object: news.parentObject,
              parent_record_id: news.parentRecordId,
              title: news.title,
              format: news.format ?? "plaintext",
              ...(news.content !== undefined && { content: news.content }),
            }),
          );

          yield* session.note(
            `Created Note: "${news.title}" on ${news.parentObject}/${news.parentRecordId}`,
          );

          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* () {
          // Notes cannot be updated via the Attio API.
          // The diff handler always returns "replace" for any change,
          // so this method should never be called.
          throw new Error(
            "Note update is not supported — the diff handler should have returned 'replace'",
          );
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            AttioNotes.deleteNote({ note_id: output.noteId }),
          ).pipe(
            Effect.catchAll(() => Effect.void),
          );

          yield* session.note(
            `Deleted Note: "${output.title}"`,
          );
        }),
      };
    }),
  );
