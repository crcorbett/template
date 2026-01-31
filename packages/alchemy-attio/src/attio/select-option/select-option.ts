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
