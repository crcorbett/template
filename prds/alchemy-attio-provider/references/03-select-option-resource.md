# Reference: SelectOption Resource (Soft Archive Delete)

## Resource Definition (`src/attio/select-option/select-option.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio SelectOption.
 */
export interface SelectOptionProps {
  /**
   * Parent resource type: "objects" or "lists".
   * Changing this will replace the resource.
   * @example "objects"
   */
  target: "objects" | "lists";

  /**
   * Parent object or list API slug.
   * May reference another resource's output.
   * Changing this will replace the resource.
   * @example "deals"
   */
  identifier: Input<string>;

  /**
   * Parent attribute API slug.
   * May reference another resource's output.
   * Changing this will replace the resource.
   * @example "deal_stage"
   */
  attribute: Input<string>;

  /**
   * Option display title.
   * @example "Prospect"
   */
  title: string;
}

/**
 * Output attributes for an Attio SelectOption.
 */
export interface SelectOptionAttrs<
  _Props extends Input.Resolve<SelectOptionProps> = Input.Resolve<SelectOptionProps>
> {
  /** Opaque option ID from the API. */
  optionId: unknown;

  /** Display title. */
  title: string | null;

  /** Whether archived (soft-deleted). */
  isArchived: boolean | undefined;
}

/**
 * An Attio SelectOption defines an enum value for a select or multiselect attribute.
 *
 * SelectOptions are soft-deleted via archival (`is_archived: true`).
 * Creating a SelectOption that matches an archived option will un-archive it.
 *
 * @section Creating SelectOptions
 * @example Pipeline Stage Options
 * ```typescript
 * class StageProspect extends SelectOption("StageProspect", {
 *   target: "objects",
 *   identifier: DealsObject.apiSlug,
 *   attribute: DealStage.apiSlug,
 *   title: "Prospect",
 * }) {}
 *
 * class StageQualified extends SelectOption("StageQualified", {
 *   target: "objects",
 *   identifier: DealsObject.apiSlug,
 *   attribute: DealStage.apiSlug,
 *   title: "Qualified",
 * }) {}
 * ```
 */
export interface SelectOption<
  ID extends string = string,
  Props extends SelectOptionProps = SelectOptionProps,
> extends Resource<
  "Attio.SelectOption",
  ID,
  Props,
  SelectOptionAttrs<Input.Resolve<Props>>,
  SelectOption
> {}

export const SelectOption = Resource<{
  <const ID extends string, const Props extends SelectOptionProps>(
    id: ID,
    props: Props,
  ): SelectOption<ID, Props>;
}>("Attio.SelectOption");
```

## Provider (`src/attio/select-option/select-option.provider.ts`)

```typescript
import * as AttioSelectOptions from "@packages/attio/select-options";
import * as Effect from "effect/Effect";

import type { SelectOptionAttrs } from "./select-option";

import { retryPolicy } from "../retry";
import { SelectOption as SelectOptionResource } from "./select-option";

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
                    option: String(existing.id), // opaque ID to string for path param
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
              option: String(output.optionId),
              title: news.title,
            }),
          );

          yield* session.note(
            `Updated SelectOption: "${news.title}"`,
          );

          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        delete: Effect.fn(function* ({ news, output, session }) {
          // Soft delete via archive
          yield* retryPolicy(
            AttioSelectOptions.updateSelectOption({
              target: news.target,
              identifier: news.identifier,
              attribute: news.attribute,
              option: String(output.optionId),
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
```

## Key Design Decisions

### Soft Archive Pattern

Attio SelectOptions cannot be hard-deleted. Instead, they are archived via:
```
PATCH /v2/{target}/{identifier}/attributes/{attribute}/options/{option}
Body: { is_archived: true }
```

The create handler checks for archived options with matching titles and un-archives them
rather than creating duplicates.

### No Direct Get Endpoint

SelectOptions lack a direct get-by-ID endpoint. The `read` handler must scan
`listSelectOptions(...)` and match by ID or title. The list is not paginated
(returns all options for the attribute).
