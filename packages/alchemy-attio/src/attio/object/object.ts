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
