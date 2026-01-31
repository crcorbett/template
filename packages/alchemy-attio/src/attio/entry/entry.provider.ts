import * as AttioEntries from "@packages/attio/entries";
import * as Effect from "effect/Effect";

import type { EntryAttrs } from "./entry";

import { retryPolicy } from "../retry";
import { Entry as EntryResource } from "./entry";

function mapResponseToAttrs(
  result: typeof AttioEntries.AttioEntry.Type,
  list: string,
): EntryAttrs {
  return {
    entryId: result.id.entry_id,
    listId: result.id.list_id,
    list,
    createdAt: result.created_at,
    values: result.values as { [key: string]: unknown } | undefined,
  };
}

export const entryProvider = () =>
  EntryResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["entryId", "listId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.list !== olds.list) {
            return { action: "replace" };
          }
          if (news.matchingAttribute !== olds.matchingAttribute) {
            return { action: "replace" };
          }
          if (JSON.stringify(news.data) !== JSON.stringify(olds.data)) {
            return { action: "update" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.entryId && (output?.list || olds?.list)) {
            const list = output.list ?? olds!.list;
            const result = yield* retryPolicy(
              AttioEntries.getEntry({
                list,
                entry_id: output.entryId,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (result) {
              return mapResponseToAttrs(result.data, list);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Use Attio's native assert (upsert) for idempotent creation.
          // assertEntry finds-or-creates by matching_attribute.
          // May return ConflictError (409) — let it propagate as fatal.
          const result = yield* retryPolicy(
            AttioEntries.assertEntry({
              list: news.list,
              matching_attribute: news.matchingAttribute,
              data: { values: news.data },
            }),
          );

          yield* session.note(
            `Asserted Entry on ${news.list} (matching: ${news.matchingAttribute})`,
          );

          return mapResponseToAttrs(result.data, news.list);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioEntries.updateEntry({
              list: news.list,
              entry_id: output.entryId,
              data: { values: news.data },
            }),
          );

          yield* session.note(
            `Updated Entry ${output.entryId} on ${news.list}`,
          );

          return { ...output, ...mapResponseToAttrs(result.data, news.list) };
        }),

        // IMPORTANT: delete handler receives { olds, output, session } — NOT news.
        // The list slug is stored in output.list for this reason.
        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            AttioEntries.deleteEntry({
              list: output.list,
              entry_id: output.entryId,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(
            `Deleted Entry ${output.entryId} from ${output.list}`,
          );
        }),
      };
    }),
  );
