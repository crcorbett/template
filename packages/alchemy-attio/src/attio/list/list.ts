import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio List.
 */
export interface ListProps {
  /**
   * List display name.
   * @example "Sales Pipeline"
   */
  name: string;

  /**
   * Parent object API slugs. Changing this will replace the resource.
   * May reference Object outputs.
   * @example ["deals"]
   */
  parentObject?: string[];
}

/**
 * Output attributes for an Attio List.
 */
export interface ListAttrs<
  _Props extends Input.Resolve<ListProps> = Input.Resolve<ListProps>
> {
  /** List ID extracted from composite ListId. */
  listId: string;

  /** API slug (auto-generated, stable). */
  apiSlug: string | null;

  /** Display name. */
  name: string | null;

  /** Parent object slugs (stable). */
  parentObject: string[] | undefined;

  /** Workspace access level. */
  workspaceAccess: string | null;

  /** Creator reference. */
  createdByActor: unknown;
}

/**
 * An Attio List represents a kanban board, pipeline, or collection view.
 *
 * @section Creating Lists
 * @example Sales Pipeline
 * ```typescript
 * class SalesPipeline extends List("SalesPipeline", {
 *   name: "Sales Pipeline",
 *   parentObject: [DealsObject.apiSlug],
 * }) {}
 * ```
 */
export interface List<
  ID extends string = string,
  Props extends ListProps = ListProps,
> extends Resource<
  "Attio.List",
  ID,
  Props,
  ListAttrs<Input.Resolve<Props>>,
  List
> {}

export const List = Resource<{
  <const ID extends string, const Props extends ListProps>(
    id: ID,
    props: Props,
  ): List<ID, Props>;
}>("Attio.List");
