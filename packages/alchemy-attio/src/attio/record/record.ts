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
  data: { [key: string]: unknown };
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

  /** Parent object slug — stored for delete handler (which only has output, not news). */
  object: string;

  /** ISO creation timestamp. */
  createdAt: string;

  /** Attio web URL for this record. */
  webUrl: string | undefined;

  /** Current attribute values. */
  values: { [key: string]: unknown } | undefined;
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
