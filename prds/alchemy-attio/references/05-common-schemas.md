# 05 — Common Schemas

Shared types that appear across multiple Attio API responses.

## Canonical Reference

- `packages/posthog/src/common.ts` — PostHog defines `UserBasic` here

## common.ts — Full Implementation

```typescript
import * as S from "effect/Schema";

// ---------------------------------------------------------------------------
// Actor references
// ---------------------------------------------------------------------------

/** Actor reference — appears in created_by_actor fields across all resources */
export class ActorReference extends S.Class<ActorReference>("ActorReference")({
  type: S.Union(
    S.Literal("api-token"),
    S.Literal("workspace-member"),
    S.Literal("system"),
    S.Literal("app")
  ),
  id: S.NullOr(S.String),
}) {}

// ---------------------------------------------------------------------------
// Composite ID types
// ---------------------------------------------------------------------------

/** Composite object ID — { workspace_id, object_id } */
export class ObjectId extends S.Class<ObjectId>("ObjectId")({
  workspace_id: S.String,
  object_id: S.String,
}) {}

/** Composite list ID — { workspace_id, list_id } */
export class ListId extends S.Class<ListId>("ListId")({
  workspace_id: S.String,
  list_id: S.String,
}) {}

/** Composite record ID — { workspace_id, object_id, record_id } */
export class RecordId extends S.Class<RecordId>("RecordId")({
  workspace_id: S.String,
  object_id: S.String,
  record_id: S.String,
}) {}

/** Composite entry ID — { workspace_id, list_id, entry_id } */
export class EntryId extends S.Class<EntryId>("EntryId")({
  workspace_id: S.String,
  list_id: S.String,
  entry_id: S.String,
}) {}

/** Composite note ID — { workspace_id, note_id } */
export class NoteId extends S.Class<NoteId>("NoteId")({
  workspace_id: S.String,
  note_id: S.String,
}) {}

/** Composite task ID — { workspace_id, task_id } */
export class TaskId extends S.Class<TaskId>("TaskId")({
  workspace_id: S.String,
  task_id: S.String,
}) {}

/** Composite webhook ID — { workspace_id, webhook_id } */
export class WebhookId extends S.Class<WebhookId>("WebhookId")({
  workspace_id: S.String,
  webhook_id: S.String,
}) {}

/** Composite workspace member ID — { workspace_id, workspace_member_id } */
export class WorkspaceMemberId extends S.Class<WorkspaceMemberId>("WorkspaceMemberId")({
  workspace_id: S.String,
  workspace_member_id: S.String,
}) {}

// ---------------------------------------------------------------------------
// Shared sub-schemas
// ---------------------------------------------------------------------------

/** Linked record reference — used in tasks, notes */
export class LinkedRecord extends S.Class<LinkedRecord>("LinkedRecord")({
  target_object_id: S.String,
  target_record_id: S.String,
}) {}

/** Assignee reference — used in tasks */
export class Assignee extends S.Class<Assignee>("Assignee")({
  referenced_actor_type: S.String,
  referenced_actor_id: S.String,
}) {}

/** Note tag — workspace member or record reference */
export class NoteTag extends S.Class<NoteTag>("NoteTag")({
  type: S.Union(S.Literal("workspace-member"), S.Literal("record")),
  workspace_member_id: S.optional(S.String),
  object: S.optional(S.String),
  record_id: S.optional(S.String),
}) {}

/** Webhook subscription — event type and optional filter */
export class WebhookSubscription extends S.Class<WebhookSubscription>("WebhookSubscription")({
  event_type: S.String,
  filter: S.optional(S.NullOr(S.Unknown)),
}) {}
```

## Design Decisions

### Record Values — `S.Unknown` for v1

Attio's value system is highly complex. Every attribute value is an array of objects with temporal metadata:

```json
{
  "values": {
    "name": [
      {
        "active_from": "2023-01-01T00:00:00.000Z",
        "active_until": null,
        "created_by_actor": { "type": "workspace-member", "id": "uuid" },
        "attribute_type": "text",
        "value": "Acme Corp"
      }
    ]
  }
}
```

There are 15+ attribute types (text, number, date, email, phone, currency, location, rating, checkbox, select, status, timestamp, domain, interaction, personal-name, actor-reference, record-reference).

Full typing would be thousands of lines for marginal benefit in the distilled client layer. Record values are typed as `S.Record({ key: S.String, value: S.Unknown })` in the Record schema. Consumers and the alchemy provider can narrow types as needed.

### Filter/Sort — `S.Unknown` for v1

Attio's filter system supports recursive trees with 10+ operators (`$eq`, `$in`, `$not_empty`, `$contains`, `$starts_with`, `$ends_with`, `$lt`, `$lte`, `$gt`, `$gte`) and logical combinators (`$and`, `$or`, `$not`).

Full typing is complex and would over-constrain the SDK. Filters and sorts are typed as `S.Unknown` in request schemas. This allows consumers to pass any valid filter object without the SDK needing to validate the recursive structure.

### Resource Identifiers

Attio uses **composite IDs** — nested objects like `{ workspace_id: "uuid", object_id: "uuid" }`. Path parameters accept either UUID or `api_slug` (e.g., `"people"`, `"companies"`), so path params are typed as `S.String`.

Each resource type has its own composite ID class (e.g., `ObjectId`, `RecordId`, `ListId`) to preserve type safety. The workspace_id is always present and identifies which workspace the resource belongs to.
