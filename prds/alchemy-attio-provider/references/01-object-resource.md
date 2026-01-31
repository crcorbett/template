# Reference: Object Resource

## Resource Definition (`src/attio/object/object.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio Object.
 */
export interface ObjectProps {
  /**
   * Unique API slug for the object (e.g., "deals", "projects").
   * Changing this will replace the resource.
   * @example "deals"
   */
  apiSlug: string;

  /**
   * Singular display noun (e.g., "Deal").
   * @example "Deal"
   */
  singularNoun: string;

  /**
   * Plural display noun (e.g., "Deals").
   * @example "Deals"
   */
  pluralNoun: string;
}

/**
 * Output attributes for an Attio Object.
 */
export interface ObjectAttrs<
  _Props extends Input.Resolve<ObjectProps> = Input.Resolve<ObjectProps>
> {
  /** Object ID extracted from composite ObjectId. */
  objectId: string;

  /** API slug (stable). */
  apiSlug: string;

  /** Singular noun. */
  singularNoun: string | null;

  /** Plural noun. */
  pluralNoun: string | null;

  /** ISO creation timestamp. */
  createdAt: string;
}

/**
 * An Attio Object defines a custom CRM entity type (e.g., People, Companies, Deals).
 *
 * Objects are schema-level resources that define the structure of your CRM data.
 * They cannot be deleted via the API — the delete lifecycle method is a no-op.
 *
 * @section Creating Objects
 * @example Custom Deal Object
 * ```typescript
 * class DealsObject extends Object("DealsObject", {
 *   apiSlug: "deals",
 *   singularNoun: "Deal",
 *   pluralNoun: "Deals",
 * }) {}
 * ```
 *
 * @section Using Object outputs
 * @example Reference in Attribute
 * ```typescript
 * class DealStage extends Attribute("DealStage", {
 *   target: "objects",
 *   identifier: DealsObject.apiSlug,  // Input<string> binding
 *   title: "Deal Stage",
 *   type: "select",
 * }) {}
 * ```
 */
export interface Object<
  ID extends string = string,
  Props extends ObjectProps = ObjectProps,
> extends Resource<
  "Attio.Object",
  ID,
  Props,
  ObjectAttrs<Input.Resolve<Props>>,
  Object
> {}

export const Object = Resource<{
  <const ID extends string, const Props extends ObjectProps>(
    id: ID,
    props: Props,
  ): Object<ID, Props>;
}>("Attio.Object");
```

## Provider (`src/attio/object/object.provider.ts`)

```typescript
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
```

## Barrel Export (`src/attio/object/index.ts`)

```typescript
import "../config";

export * from "./object";
export * from "./object.provider";
```
