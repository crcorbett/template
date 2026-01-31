import * as AttioStatuses from "@packages/attio/statuses";
import * as Effect from "effect/Effect";

import type { StatusAttrs } from "./status";

import { retryPolicy } from "../retry";
import { Status as StatusResource } from "./status";

function mapResponseToAttrs(
  result: typeof AttioStatuses.AttioStatus.Type,
): StatusAttrs {
  return {
    statusId: result.id.status_id,
    title: result.title,
    isArchived: result.is_archived,
    celebrationEnabled: result.celebration_enabled,
    targetTimeInStatus: result.target_time_in_status,
  };
}

export const statusProvider = () =>
  StatusResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["statusId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.target !== olds.target) return { action: "replace" };
          if (news.identifier !== olds.identifier)
            return { action: "replace" };
          if (news.attribute !== olds.attribute) return { action: "replace" };

          if (
            news.title !== olds.title ||
            news.celebrationEnabled !== olds.celebrationEnabled ||
            news.targetTimeInStatus !== olds.targetTimeInStatus
          ) {
            return { action: "update" };
          }

          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (olds?.target && olds?.identifier && olds?.attribute) {
            const list = yield* retryPolicy(
              AttioStatuses.listStatuses({
                target: olds.target,
                identifier: olds.identifier,
                attribute: olds.attribute,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (list?.data) {
              // Match by statusId first
              if (output?.statusId) {
                const byId = list.data.find(
                  (s) => s.id.status_id === output.statusId,
                );
                if (byId) return mapResponseToAttrs(byId);
              }

              // Fallback: match by title
              const byTitle = list.data.find(
                (s) => s.title === olds.title,
              );
              if (byTitle) return mapResponseToAttrs(byTitle);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: scan for existing status with matching title
          const list = yield* retryPolicy(
            AttioStatuses.listStatuses({
              target: news.target,
              identifier: news.identifier,
              attribute: news.attribute,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () =>
              Effect.succeed(undefined),
            ),
          );

          if (list?.data) {
            const existing = list.data.find(
              (s) => s.title === news.title,
            );

            if (existing) {
              // Un-archive if archived
              if (existing.is_archived) {
                const unarchived = yield* retryPolicy(
                  AttioStatuses.updateStatus({
                    target: news.target,
                    identifier: news.identifier,
                    attribute: news.attribute,
                    status: existing.id.status_id,
                    is_archived: false,
                    ...(news.celebrationEnabled !== undefined && {
                      celebration_enabled: news.celebrationEnabled,
                    }),
                    ...(news.targetTimeInStatus !== undefined && {
                      target_time_in_status: news.targetTimeInStatus,
                    }),
                  }),
                );

                yield* session.note(
                  `Idempotent Status: un-archived existing "${news.title}"`,
                );

                return mapResponseToAttrs(unarchived.data);
              }

              yield* session.note(
                `Idempotent Status: found existing "${news.title}"`,
              );
              return mapResponseToAttrs(existing);
            }
          }

          const result = yield* retryPolicy(
            AttioStatuses.createStatus({
              target: news.target,
              identifier: news.identifier,
              attribute: news.attribute,
              title: news.title,
              ...(news.celebrationEnabled !== undefined && {
                celebration_enabled: news.celebrationEnabled,
              }),
              ...(news.targetTimeInStatus !== undefined && {
                target_time_in_status: news.targetTimeInStatus,
              }),
            }),
          );

          yield* session.note(
            `Created Status: "${news.title}" on ${news.target}/${news.identifier}/${news.attribute}`,
          );

          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioStatuses.updateStatus({
              target: news.target,
              identifier: news.identifier,
              attribute: news.attribute,
              status: output.statusId,
              title: news.title,
              ...(news.celebrationEnabled !== undefined && {
                celebration_enabled: news.celebrationEnabled,
              }),
              ...(news.targetTimeInStatus !== undefined && {
                target_time_in_status: news.targetTimeInStatus,
              }),
            }),
          );

          yield* session.note(
            `Updated Status: "${news.title}"`,
          );

          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        // IMPORTANT: delete handler receives { olds, output, session } — NOT news.
        delete: Effect.fn(function* ({ olds, output, session }) {
          yield* retryPolicy(
            AttioStatuses.updateStatus({
              target: olds.target,
              identifier: olds.identifier,
              attribute: olds.attribute,
              status: output.statusId,
              is_archived: true,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(
            `Archived Status: "${output.title}"`,
          );
        }),
      };
    }),
  );
