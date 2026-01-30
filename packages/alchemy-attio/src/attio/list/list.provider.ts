import * as AttioLists from "@packages/attio/lists";
import * as Effect from "effect/Effect";

import type { ListAttrs } from "./list";

import { retryPolicy } from "../retry";
import { List as ListResource } from "./list";

function mapResponseToAttrs(
  result: typeof AttioLists.AttioList.Type,
): ListAttrs {
  return {
    listId: result.id.list_id,
    apiSlug: result.api_slug,
    name: result.name,
    parentObject: result.parent_object ? [...result.parent_object] : undefined,
    workspaceAccess: result.workspace_access ?? null,
    createdByActor: result.created_by_actor,
  };
}

export const listProvider = () =>
  ListResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["listId", "apiSlug", "parentObject"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (
            JSON.stringify(news.parentObject) !==
            JSON.stringify(olds.parentObject)
          ) {
            return { action: "replace" };
          }
          if (news.name !== olds.name) {
            return { action: "update" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          // Primary: lookup by listId or apiSlug
          const listKey = output?.listId ?? output?.apiSlug;
          if (listKey) {
            const result = yield* retryPolicy(
              AttioLists.getList({ list: listKey }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (result) {
              return mapResponseToAttrs(result.data);
            }
          }

          // Fallback: scan by name
          if (olds?.name) {
            const lists = yield* retryPolicy(
              AttioLists.listLists({}),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (lists?.data) {
              const byName = lists.data.find(
                (l) => l.name === olds.name,
              );
              if (byName) return mapResponseToAttrs(byName);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: scan for existing list by name
          const lists = yield* retryPolicy(
            AttioLists.listLists({}),
          ).pipe(
            Effect.catchTag("NotFoundError", () =>
              Effect.succeed(undefined),
            ),
          );

          if (lists?.data) {
            const existing = lists.data.find(
              (l) => l.name === news.name,
            );

            if (existing) {
              yield* session.note(
                `Idempotent List: found existing "${news.name}"`,
              );
              return mapResponseToAttrs(existing);
            }
          }

          const apiSlug = news.name.toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
          const result = yield* retryPolicy(
            AttioLists.createList({
              name: news.name,
              api_slug: apiSlug,
              parent_object: news.parentObject?.[0] ?? "people",
              workspace_access: "full-access",
              workspace_member_access: [],
            }),
          );

          yield* session.note(`Created List: "${news.name}"`);
          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioLists.updateList({
              list: output.listId,
              name: news.name,
            }),
          );

          yield* session.note(`Updated List: "${news.name}"`);
          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            AttioLists.deleteList({ list: output.listId }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(`Deleted List: "${output.name}"`);
        }),
      };
    }),
  );
