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
