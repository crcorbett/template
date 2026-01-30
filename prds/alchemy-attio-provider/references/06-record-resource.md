# Reference: Record Resource (Assert-Based Idempotency)

## Resource Definition (`src/attio/record/record.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio Record.
 */
export interface RecordProps {
  /**
   * Parent object slug (e.g., "people", "companies", "deals").
   * Changing this will replace the resource.
   * @example "people"
   */
  object: Input<string>;

  /**
   * Attribute used for upsert matching in the assert operation.
   * Must be a unique attribute on the object.
   * Changing this will replace the resource.
   * @example "email_addresses"
   */
  matchingAttribute: string;

  /**
   * Attribute values for the record, keyed by attribute API slug.
   * Values follow Attio's attribute value format.
   * @example { "name": [{ "first_name": "Jane", "last_name": "Doe" }] }
   */
  data: Record<string, unknown>;
}

/**
 * Output attributes for an Attio Record.
 */
export interface RecordAttrs<
  _Props extends Input.Resolve<RecordProps> = Input.Resolve<RecordProps>
> {
  /** Record ID extracted from composite RecordId. */
  recordId: string;

  /** Parent object ID extracted from composite RecordId. */
  objectId: string;

  /** ISO creation timestamp. */
  createdAt: string;

  /** Attio web URL for this record. */
  webUrl: string | undefined;

  /** Current attribute values. */
  values: Record<string, unknown> | undefined;
}

/**
 * An Attio Record represents a CRM data entry (person, company, deal, etc.).
 *
 * Records use Attio's built-in `assert` (upsert) operation for idempotent
 * creation — no manual pagination scan needed.
 *
 * @section Creating Records
 * @example Create a person record
 * ```typescript
 * class JaneDoe extends Record("JaneDoe", {
 *   object: "people",
 *   matchingAttribute: "email_addresses",
 *   data: {
 *     email_addresses: [{ email_address: "jane@example.com" }],
 *     name: [{ first_name: "Jane", last_name: "Doe" }],
 *   },
 * }) {}
 * ```
 *
 * @section Using Record outputs
 * @example Reference in Note
 * ```typescript
 * class JaneNote extends Note("JaneNote", {
 *   parentObject: "people",
 *   parentRecordId: JaneDoe.recordId,  // Input<string> binding
 *   title: "Onboarding Note",
 *   content: "Welcome aboard!",
 * }) {}
 * ```
 */
export interface Record<
  ID extends string = string,
  Props extends RecordProps = RecordProps,
> extends Resource<
  "Attio.Record",
  ID,
  Props,
  RecordAttrs<Input.Resolve<Props>>,
  Record
> {}

export const Record = Resource<{
  <const ID extends string, const Props extends RecordProps>(
    id: ID,
    props: Props,
  ): Record<ID, Props>;
}>("Attio.Record");
```

## Provider (`src/attio/record/record.provider.ts`)

```typescript
import * as AttioRecords from "@packages/attio/records";
import * as Effect from "effect/Effect";

import type { RecordAttrs } from "./record";

import { retryPolicy } from "../retry";
import { Record as RecordResource } from "./record";

function mapResponseToAttrs(
  result: typeof AttioRecords.AttioRecord.Type,
): RecordAttrs {
  return {
    recordId: result.id.record_id,
    objectId: result.id.object_id,
    createdAt: result.created_at,
    webUrl: result.web_url,
    values: result.values as Record<string, unknown> | undefined,
  };
}

export const recordProvider = () =>
  RecordResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["recordId", "objectId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          if (news.object !== olds.object) {
            return { action: "replace" };
          }
          if (news.matchingAttribute !== olds.matchingAttribute) {
            return { action: "replace" };
          }
          if (JSON.stringify(news.data) !== JSON.stringify(olds.data)) {
            return { action: "update" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          if (output?.recordId && olds?.object) {
            const result = yield* retryPolicy(
              AttioRecords.getRecord({
                object: olds.object,
                record_id: output.recordId,
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
          // Use Attio's native assert (upsert) for idempotent creation.
          // assertRecord finds-or-creates by matching_attribute.
          const result = yield* retryPolicy(
            AttioRecords.assertRecord({
              object: news.object,
              matching_attribute: news.matchingAttribute,
              data: news.data,
            }),
          );

          yield* session.note(
            `Asserted Record on ${news.object} (matching: ${news.matchingAttribute})`,
          );

          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioRecords.updateRecord({
              object: news.object,
              record_id: output.recordId,
              data: news.data,
            }),
          );

          yield* session.note(
            `Updated Record ${output.recordId} on ${news.object}`,
          );

          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        delete: Effect.fn(function* ({ news, output, session }) {
          yield* retryPolicy(
            AttioRecords.deleteRecord({
              object: news.object,
              record_id: output.recordId,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(
            `Deleted Record ${output.recordId} from ${news.object}`,
          );
        }),
      };
    }),
  );
```

## Key Design Decisions

### Assert-Based Idempotency

Unlike PostHog resources that require manual paginated scans for idempotency, Attio's
`assertRecord` operation provides native upsert semantics:

```
PUT /v2/objects/{object}/records?matching_attribute={attr}
Body: { data: { ... } }
```

This atomically:
1. Searches for a record where the `matching_attribute` value matches
2. If found, updates the record with the new data
3. If not found, creates a new record

This eliminates the need for pagination-based duplicate detection in the create handler.

### Object Parameter in Delete

The `delete` handler needs the `object` slug to construct the API path. This comes from
`news` (the current props), not `output` (which only stores attrs). This is necessary
because Attio's delete endpoint is `DELETE /v2/objects/{object}/records/{record_id}`.
