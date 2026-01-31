import * as AttioSelectOptions from "@packages/attio/select-options";
import * as Effect from "effect/Effect";

import type { SelectOptionAttrs } from "./select-option";

import { retryPolicy } from "../retry";
import { SelectOption as SelectOptionResource } from "./select-option";

/** Extract the option_id string from an unknown option ID (may be string or structured object). */
function optionIdToString(id: unknown): string {
  if (typeof id === "string") return id;
  if (id && typeof id === "object") {
    if ("option_id" in id) return String((id as { option_id: unknown }).option_id);
  }
  return String(id);
}

function mapResponseToAttrs(
  result: typeof AttioSelectOptions.SelectOption.Type,
): SelectOptionAttrs {
  return {
    optionId: result.id,
    title: result.title,
    isArchived: result.is_archived,
  };
}

export const selectOptionProvider = () =>
  SelectOptionResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["optionId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.target !== olds.target) return { action: "replace" };
          if (news.identifier !== olds.identifier)
            return { action: "replace" };
          if (news.attribute !== olds.attribute) return { action: "replace" };

          if (news.title !== olds.title) {
            return { action: "update" };
          }

          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          // SelectOptions don't have a direct get-by-ID endpoint.
          // Scan listSelectOptions for matching title.
          if (olds?.target && olds?.identifier && olds?.attribute) {
            const list = yield* retryPolicy(
              AttioSelectOptions.listSelectOptions({
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
              // Match by optionId first if we have it
              if (output?.optionId) {
                const byId = list.data.find(
                  (o) => JSON.stringify(o.id) === JSON.stringify(output.optionId),
                );
                if (byId) return mapResponseToAttrs(byId);
              }

              // Fallback: match by title (including archived)
              const byTitle = list.data.find(
                (o) => o.title === olds.title,
              );
              if (byTitle) return mapResponseToAttrs(byTitle);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: scan for existing option with matching title
          const list = yield* retryPolicy(
            AttioSelectOptions.listSelectOptions({
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
              (o) => o.title === news.title,
            );

            if (existing) {
              // Un-archive if archived
              if (existing.is_archived) {
                const unarchived = yield* retryPolicy(
                  AttioSelectOptions.updateSelectOption({
                    target: news.target,
                    identifier: news.identifier,
                    attribute: news.attribute,
                    option: optionIdToString(existing.id),
                    is_archived: false,
                  }),
                );

                yield* session.note(
                  `Idempotent SelectOption: un-archived existing "${news.title}"`,
                );

                return mapResponseToAttrs(unarchived.data);
              }

              yield* session.note(
                `Idempotent SelectOption: found existing "${news.title}"`,
              );
              return mapResponseToAttrs(existing);
            }
          }

          const result = yield* retryPolicy(
            AttioSelectOptions.createSelectOption({
              target: news.target,
              identifier: news.identifier,
              attribute: news.attribute,
              title: news.title,
            }),
          );

          yield* session.note(
            `Created SelectOption: "${news.title}" on ${news.target}/${news.identifier}/${news.attribute}`,
          );

          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioSelectOptions.updateSelectOption({
              target: news.target,
              identifier: news.identifier,
              attribute: news.attribute,
              option: optionIdToString(output.optionId),
              title: news.title,
            }),
          );

          yield* session.note(
            `Updated SelectOption: "${news.title}"`,
          );

          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        // IMPORTANT: delete handler receives { olds, output, session } — NOT news.
        // Use olds.* for parent identifiers (target, identifier, attribute)
        // since these are the old Props values.
        delete: Effect.fn(function* ({ olds, output, session }) {
          // Soft delete via archive
          yield* retryPolicy(
            AttioSelectOptions.updateSelectOption({
              target: olds.target,
              identifier: olds.identifier,
              attribute: olds.attribute,
              option: optionIdToString(output.optionId),
              is_archived: true,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(
            `Archived SelectOption: "${output.title}"`,
          );
        }),
      };
    }),
  );
