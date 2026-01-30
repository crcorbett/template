import * as AttioObjects from "@packages/attio/objects";
import * as Effect from "effect/Effect";

import type { ObjectAttrs } from "./object";

import { retryPolicy } from "../retry";
import { Object as ObjectResource } from "./object";

function mapResponseToAttrs(
  result: typeof AttioObjects.AttioObject.Type,
): ObjectAttrs {
  return {
    objectId: result.id.object_id,
    apiSlug: result.api_slug ?? "",
    singularNoun: result.singular_noun,
    pluralNoun: result.plural_noun,
    createdAt: result.created_at,
  };
}

export const objectProvider = () =>
  ObjectResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["objectId", "apiSlug"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.apiSlug !== olds.apiSlug) {
            return { action: "replace" };
          }
          if (
            news.singularNoun !== olds.singularNoun ||
            news.pluralNoun !== olds.pluralNoun
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          // Primary: lookup by apiSlug (objects are addressed by slug)
          const slug = output?.apiSlug ?? olds?.apiSlug;
          if (slug) {
            const result = yield* retryPolicy(
              AttioObjects.getObject({ object: slug }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (result) {
              return mapResponseToAttrs(result.data);
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: check if object with this slug already exists
          const existing = yield* retryPolicy(
            AttioObjects.getObject({ object: news.apiSlug }),
          ).pipe(
            Effect.catchTag("NotFoundError", () =>
              Effect.succeed(undefined),
            ),
          );

          if (existing) {
            yield* session.note(
              `Idempotent Object: found existing with slug ${news.apiSlug}`,
            );
            return mapResponseToAttrs(existing.data);
          }

          const result = yield* retryPolicy(
            AttioObjects.createObject({
              api_slug: news.apiSlug,
              singular_noun: news.singularNoun,
              plural_noun: news.pluralNoun,
            }),
          );

          yield* session.note(`Created Object: ${news.apiSlug}`);
          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioObjects.updateObject({
              object: output.apiSlug,
              api_slug: news.apiSlug,
              singular_noun: news.singularNoun,
              plural_noun: news.pluralNoun,
            }),
          );

          yield* session.note(`Updated Object: ${news.apiSlug}`);
          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          // Objects cannot be deleted via the Attio API.
          yield* session.note(
            `Object ${output.apiSlug} cannot be deleted — Attio API does not support object deletion. Resource will be removed from state only.`,
          );
        }),
      };
    }),
  );
