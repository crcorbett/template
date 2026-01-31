# Reference: Attribute Resource

## Resource Definition (`src/attio/attribute/attribute.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio Attribute.
 */
export interface AttributeProps {
  /**
   * Parent resource type: "objects" or "lists".
   * Changing this will replace the resource.
   * @example "objects"
   */
  target: "objects" | "lists";

  /**
   * Parent object or list API slug.
   * May reference another resource's output via Input<T>.
   * Changing this will replace the resource.
   * @example "deals"
   */
  identifier: Input<string>;

  /**
   * Attribute API slug. If omitted, auto-generated from title.
   * Changing this will replace the resource.
   * @example "deal_stage"
   */
  apiSlug?: string;

  /**
   * Display title for the attribute.
   * @example "Deal Stage"
   */
  title: string;

  /**
   * Attribute type (text, number, select, status, etc.).
   * Changing this will replace the resource.
   * @example "select"
   */
  type: string;

  /**
   * Description of the attribute.
   */
  description?: string | null;

  /**
   * Whether the attribute is required.
   */
  isRequired?: boolean;

  /**
   * Whether values must be unique.
   */
  isUnique?: boolean;

  /**
   * Whether multiple values can be selected.
   */
  isMultiselect?: boolean;
}

/**
 * Output attributes for an Attio Attribute.
 */
export interface AttributeAttrs<
  _Props extends Input.Resolve<AttributeProps> = Input.Resolve<AttributeProps>
> {
  /** Opaque attribute ID from the API. */
  attributeId: unknown;

  /** API slug (stable). */
  apiSlug: string | null;

  /** Display title. */
  title: string | null;

  /** Attribute type (stable). */
  type: string | null;

  /** Description. */
  description: string | null;

  /** Whether required. */
  isRequired: boolean | undefined;

  /** Whether unique. */
  isUnique: boolean | undefined;

  /** Whether multiselect. */
  isMultiselect: boolean | undefined;
}

/**
 * An Attio Attribute defines a custom field on an Object or List.
 *
 * Attributes are schema-level resources that cannot be deleted via the API.
 * The delete lifecycle method is a no-op.
 *
 * @section Creating Attributes
 * @example Select Attribute on Object
 * ```typescript
 * class DealStage extends Attribute("DealStage", {
 *   target: "objects",
 *   identifier: DealsObject.apiSlug,
 *   title: "Deal Stage",
 *   type: "select",
 * }) {}
 * ```
 *
 * @section Using Attribute outputs
 * @example Reference in SelectOption
 * ```typescript
 * class StageProspect extends SelectOption("StageProspect", {
 *   target: "objects",
 *   identifier: DealsObject.apiSlug,
 *   attribute: DealStage.apiSlug,  // Input<string> binding
 *   title: "Prospect",
 * }) {}
 * ```
 */
export interface Attribute<
  ID extends string = string,
  Props extends AttributeProps = AttributeProps,
> extends Resource<
  "Attio.Attribute",
  ID,
  Props,
  AttributeAttrs<Input.Resolve<Props>>,
  Attribute
> {}

export const Attribute = Resource<{
  <const ID extends string, const Props extends AttributeProps>(
    id: ID,
    props: Props,
  ): Attribute<ID, Props>;
}>("Attio.Attribute");
```

## Provider (`src/attio/attribute/attribute.provider.ts`)

```typescript
import * as AttioAttributes from "@packages/attio/attributes";
import * as Effect from "effect/Effect";

import type { AttributeAttrs } from "./attribute";

import { retryPolicy } from "../retry";
import { Attribute as AttributeResource } from "./attribute";

function mapResponseToAttrs(
  result: typeof AttioAttributes.AttioAttribute.Type,
): AttributeAttrs {
  return {
    attributeId: result.id,
    apiSlug: result.api_slug,
    title: result.title,
    type: result.type,
    description: result.description ?? null,
    isRequired: result.is_required,
    isUnique: result.is_unique,
    isMultiselect: result.is_multiselect,
  };
}

export const attributeProvider = () =>
  AttributeResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["attributeId", "apiSlug", "type"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // Replacement triggers: structural changes (not updatable via API)
          if (news.target !== olds.target) return { action: "replace" };
          if (news.identifier !== olds.identifier) return { action: "replace" };
          if (news.type !== olds.type) return { action: "replace" };
          if (news.apiSlug !== undefined && news.apiSlug !== olds.apiSlug) {
            return { action: "replace" };
          }
          // isMultiselect is immutable after creation — UpdateAttributeRequest
          // does NOT support is_multiselect, so changing it requires replacement
          if (news.isMultiselect !== olds.isMultiselect) {
            return { action: "replace" };
          }

          // Update triggers (fields supported by UpdateAttributeRequest)
          if (
            news.title !== olds.title ||
            news.description !== olds.description ||
            news.isRequired !== olds.isRequired ||
            news.isUnique !== olds.isUnique
          ) {
            return { action: "update" };
          }

          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          const slug = output?.apiSlug ?? olds?.apiSlug;
          if (slug && olds?.target && olds?.identifier) {
            const result = yield* retryPolicy(
              AttioAttributes.getAttribute({
                target: olds.target,
                identifier: olds.identifier,
                attribute: slug,
              }),
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
          // Idempotency: check if attribute with this slug already exists
          if (news.apiSlug) {
            const existing = yield* retryPolicy(
              AttioAttributes.getAttribute({
                target: news.target,
                identifier: news.identifier,
                attribute: news.apiSlug,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (existing) {
              yield* session.note(
                `Idempotent Attribute: found existing ${news.apiSlug} on ${news.target}/${news.identifier}`,
              );
              return mapResponseToAttrs(existing.data);
            }
          }

          const result = yield* retryPolicy(
            AttioAttributes.createAttribute({
              target: news.target,
              identifier: news.identifier,
              title: news.title,
              type: news.type,
              ...(news.apiSlug && { api_slug: news.apiSlug }),
              ...(news.description !== undefined && {
                description: news.description ?? undefined,
              }),
              ...(news.isRequired !== undefined && {
                is_required: news.isRequired,
              }),
              ...(news.isUnique !== undefined && {
                is_unique: news.isUnique,
              }),
              ...(news.isMultiselect !== undefined && {
                is_multiselect: news.isMultiselect,
              }),
            }),
          );

          yield* session.note(
            `Created Attribute: ${news.title} on ${news.target}/${news.identifier}`,
          );

          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          // getAttribute needs the slug to address the attribute
          const slug = output.apiSlug ?? news.apiSlug;
          if (!slug) {
            return output;
          }

          // NOTE: UpdateAttributeRequest only supports title, description,
          // is_required, is_unique. is_multiselect is NOT updatable —
          // it can only be set at creation time. If isMultiselect changes,
          // the diff handler returns "replace" (not "update").
          const result = yield* retryPolicy(
            AttioAttributes.updateAttribute({
              target: news.target,
              identifier: news.identifier,
              attribute: slug,
              title: news.title,
              ...(news.description !== undefined && {
                description: news.description ?? undefined,
              }),
              ...(news.isRequired !== undefined && {
                is_required: news.isRequired,
              }),
              ...(news.isUnique !== undefined && {
                is_unique: news.isUnique,
              }),
            }),
          );

          yield* session.note(
            `Updated Attribute: ${news.title} on ${news.target}/${news.identifier}`,
          );

          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          // Attributes cannot be deleted via the Attio API.
          yield* session.note(
            `Attribute ${output.apiSlug ?? "unknown"} cannot be deleted — Attio API does not support attribute deletion. Resource will be removed from state only.`,
          );
        }),
      };
    }),
  );
```
