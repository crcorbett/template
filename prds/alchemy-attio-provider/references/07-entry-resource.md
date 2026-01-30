# Reference: Entry Resource (Assert-Based Idempotency)

## Resource Definition (`src/attio/entry/entry.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio Entry.
 */
export interface EntryProps {
  /**
   * Parent list slug. Changing this will replace the resource.
   * @example "sales-pipeline"
   */
  list: Input<string>;

  /**
   * Attribute used for upsert matching in the assert operation.
   * Changing this will replace the resource.
   * @example "record"
   */
  matchingAttribute: string;

  /**
   * Attribute values for the entry.
   */
  data: Record<string, unknown>;
}

/**
 * Output attributes for an Attio Entry.
 */
export interface EntryAttrs<
  _Props extends Input.Resolve<EntryProps> = Input.Resolve<EntryProps>
> {
  /** Entry ID extracted from composite EntryId. */
  entryId: string;

  /** Parent list ID extracted from composite EntryId. */
  listId: string;

  /** ISO creation timestamp. */
  createdAt: string;

  /** Current attribute values. */
  values: Record<string, unknown> | undefined;
}

/**
 * An Attio Entry represents an item in a List (pipeline entry, kanban card, etc.).
 *
 * Like Records, Entries use Attio's `assert` operation for idempotent creation.
 *
 * @section Creating Entries
 * @example Pipeline Entry
 * ```typescript
 * class AcmeDealEntry extends Entry("AcmeDealEntry", {
 *   list: SalesPipeline.apiSlug,
 *   matchingAttribute: "record",
 *   data: {
 *     record: [{ target_object: "deals", target_record_id: AcmeDeal.recordId }],
 *   },
 * }) {}
 * ```
 */
export interface Entry<
  ID extends string = string,
  Props extends EntryProps = EntryProps,
> extends Resource<
  "Attio.Entry",
  ID,
  Props,
  EntryAttrs<Input.Resolve<Props>>,
  Entry
> {}

export const Entry = Resource<{
  <const ID extends string, const Props extends EntryProps>(
    id: ID,
    props: Props,
  ): Entry<ID, Props>;
}>("Attio.Entry");
```

## Provider Notes

Same assert-based idempotency pattern as Record:
- `create` uses `assertEntry({ list, matching_attribute, data })`
- `update` uses `updateEntry({ list, entry_id, data })`
- `delete` uses `deleteEntry({ list, entry_id })` + catch NotFoundError
