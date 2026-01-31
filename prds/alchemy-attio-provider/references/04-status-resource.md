# Reference: Status Resource (Soft Archive Delete)

## Resource Definition (`src/attio/status/status.ts`)

```typescript
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
```

## Provider (`src/attio/status/status.provider.ts`)

Same pattern as SelectOption provider:
- `stables: ["statusId"]`
- `diff`: target/identifier/attribute → replace; title, celebrationEnabled, targetTimeInStatus → update
- `read`: scan `listStatuses(...)`, match by statusId then by title
- `create`: idempotent via list scan; un-archive if found archived
- `update`: `updateStatus(...)` with title, celebration_enabled, target_time_in_status
- `delete`: soft archive via `updateStatus({ is_archived: true })` — uses `olds.*` for parent identifiers (target, identifier, attribute) since delete handler receives `{ olds, output, session }` NOT `news`

```typescript
function mapResponseToAttrs(
  result: typeof AttioStatuses.AttioStatus.Type,
): StatusAttrs {
  return {
    statusId: result.id.status_id,
    title: result.title,
    isArchived: result.is_archived,
    celebrationEnabled: result.celebration_enabled,
    targetTimeInStatus: result.target_time_in_status,
  };
}
```
