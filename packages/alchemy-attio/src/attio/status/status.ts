import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio Status.
 */
export interface StatusProps {
  /**
   * Parent resource type: "objects" or "lists".
   * Changing this will replace the resource.
   */
  target: "objects" | "lists";

  /**
   * Parent object or list API slug.
   * Changing this will replace the resource.
   */
  identifier: Input<string>;

  /**
   * Parent status attribute API slug.
   * Changing this will replace the resource.
   */
  attribute: Input<string>;

  /**
   * Status display title.
   * @example "In Progress"
   */
  title: string;

  /**
   * Whether to show celebration animation when entering this status.
   */
  celebrationEnabled?: boolean;

  /**
   * Target time in this status (ISO duration or null).
   */
  targetTimeInStatus?: string | null;
}

/**
 * Output attributes for an Attio Status.
 */
export interface StatusAttrs<
  _Props extends Input.Resolve<StatusProps> = Input.Resolve<StatusProps>
> {
  /** Status ID extracted from composite StatusId. */
  statusId: string;

  /** Display title. */
  title: string;

  /** Whether archived (soft-deleted). */
  isArchived: boolean;

  /** Celebration animation enabled. */
  celebrationEnabled: boolean;

  /** Target time in status. */
  targetTimeInStatus: string | null;
}

/**
 * An Attio Status defines a pipeline stage for a status-type attribute.
 *
 * Statuses are soft-deleted via archival. Creating a Status matching an
 * archived one will un-archive it.
 *
 * @section Creating Statuses
 * @example Pipeline Statuses
 * ```typescript
 * class StatusNew extends Status("StatusNew", {
 *   target: "objects",
 *   identifier: DealsObject.apiSlug,
 *   attribute: DealStatus.apiSlug,
 *   title: "New",
 * }) {}
 *
 * class StatusWon extends Status("StatusWon", {
 *   target: "objects",
 *   identifier: DealsObject.apiSlug,
 *   attribute: DealStatus.apiSlug,
 *   title: "Won",
 *   celebrationEnabled: true,
 * }) {}
 * ```
 */
export interface Status<
  ID extends string = string,
  Props extends StatusProps = StatusProps,
> extends Resource<
  "Attio.Status",
  ID,
  Props,
  StatusAttrs<Input.Resolve<Props>>,
  Status
> {}

export const Status = Resource<{
  <const ID extends string, const Props extends StatusProps>(
    id: ID,
    props: Props,
  ): Status<ID, Props>;
}>("Attio.Status");
