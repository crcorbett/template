import * as AttioRecords from "@packages/attio/records";
import * as Effect from "effect/Effect";

import type { RecordAttrs } from "./record";

import { retryPolicy } from "../retry";
import { Record as RecordResource } from "./record";

function mapResponseToAttrs(
  result: typeof AttioRecords.AttioRecord.Type,
  object: string,
): RecordAttrs {
  return {
    recordId: result.id.record_id,
    objectId: result.id.object_id,
    object,
    createdAt: result.created_at,
    webUrl: result.web_url,
    values: result.values as { [key: string]: unknown } | undefined,
  };
}

export const recordProvider = () =>
  RecordResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["recordId", "objectId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.object !== olds.object) {
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
          if (output?.recordId && (output?.object || olds?.object)) {
            const object = output.object ?? olds!.object;
            const result = yield* retryPolicy(
              AttioRecords.getRecord({
                object,
                record_id: output.recordId,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (result) {
              return mapResponseToAttrs(result.data, object);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Use Attio's native assert (upsert) for idempotent creation.
          // assertRecord finds-or-creates by matching_attribute.
          // Note: assertRecord may return ConflictError (409) on unique
          // constraint violation — let it propagate as a fatal error.
          const result = yield* retryPolicy(
            AttioRecords.assertRecord({
              object: news.object,
              matching_attribute: news.matchingAttribute,
              data: { values: news.data },
            }),
          );

          yield* session.note(
            `Asserted Record on ${news.object} (matching: ${news.matchingAttribute})`,
          );

          return mapResponseToAttrs(result.data, news.object);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioRecords.updateRecord({
              object: news.object,
              record_id: output.recordId,
              data: { values: news.data },
            }),
          );

          yield* session.note(
            `Updated Record ${output.recordId} on ${news.object}`,
          );

          return { ...output, ...mapResponseToAttrs(result.data, news.object) };
        }),

        // IMPORTANT: delete handler receives { olds, output, session } — NOT news.
        // The object slug is stored in output.object for this reason.
        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            AttioRecords.deleteRecord({
              object: output.object,
              record_id: output.recordId,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(
            `Deleted Record ${output.recordId} from ${output.object}`,
          );
        }),
      };
    }),
  );
