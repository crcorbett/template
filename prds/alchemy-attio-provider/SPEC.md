# Alchemy Attio Provider — Implementation Specification

**Status**: Design Complete — Ready for Implementation
**Created**: 2026-01-30
**Owner**: Platform Team
**Priority**: High
**Epic**: Infrastructure-as-Effects Provider Expansion

---

## 1. Overview

### 1.1 Purpose

Create an Attio cloud provider for alchemy-effect (`@packages/alchemy-attio`) that enables Attio CRM resources to be managed as Infrastructure-as-Effects. This provider wraps the `@packages/attio` distilled client (modelled on distilled-aws) and follows the patterns established by `@packages/alchemy-posthog`.

### 1.2 Problem Statement

Attio CRM resources (custom objects, attributes, records, lists, webhooks) are currently managed manually through the Attio UI or ad-hoc API scripts:

1. **No declarative management** — Custom objects, attributes, and pipeline configurations cannot be version-controlled
2. **No lifecycle management** — No automated create/update/delete with drift detection
3. **No cross-resource dependencies** — Cannot express that a Record depends on an Object's schema
4. **Inconsistent state** — Manual changes drift from intended configuration

### 1.3 Solution

1. **Attio cloud provider** for alchemy-effect with **10 resource types** across 3 tiers
2. **Direct consumption** of `@packages/attio` distilled client — zero wrapping
3. **Stage config integration** — Attio credentials and endpoint from alchemy-effect's config system
4. **Typed bindings** — Cross-resource references via `Input<T>` for hierarchical dependencies
5. **Full CRUD lifecycle** — create, read, update, delete/archive, diff for each resource
6. **Integration tests** — TDD approach with real Attio API verification

### 1.4 Key Differences from PostHog Provider

| Aspect | PostHog | Attio |
|--------|---------|-------|
| Workspace scoping | `project_id` on every call | Implicit via API key (no Project tag needed) |
| Schema resources | None (fixed schema) | Objects, Attributes, SelectOptions, Statuses |
| ID format | `number` or `string` UUID | Composite `{ workspace_id, resource_id }` — extract sub-ID |
| Upsert support | Manual paginated scan | `assertRecord`/`assertEntry` for data resources |
| Delete strategy | Mix of hard/soft | Hard delete for data, soft archive for schema |
| Resource hierarchy | Flat | Object → Attribute → SelectOption/Status → Record |

---

## 2. Package Structure

```
packages/alchemy-attio/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── alchemy.run.ts
├── .env                              # ATTIO_API_KEY (gitignored)
├── src/attio/
│   ├── index.ts                      # Provider composition
│   ├── config.ts                     # StageConfig module augmentation
│   ├── credentials.ts                # Credentials layer from stage config
│   ├── endpoint.ts                   # Endpoint layer from stage config
│   ├── retry.ts                      # Centralized retry policy
│   ├── object/
│   │   ├── index.ts
│   │   ├── object.ts                 # Resource definition
│   │   └── object.provider.ts        # Provider (create, read, update — no delete)
│   ├── attribute/
│   │   ├── index.ts
│   │   ├── attribute.ts
│   │   └── attribute.provider.ts
│   ├── select-option/
│   │   ├── index.ts
│   │   ├── select-option.ts
│   │   └── select-option.provider.ts # Soft archive on delete
│   ├── status/
│   │   ├── index.ts
│   │   ├── status.ts
│   │   └── status.provider.ts        # Soft archive on delete
│   ├── list/
│   │   ├── index.ts
│   │   ├── list.ts
│   │   └── list.provider.ts
│   ├── record/
│   │   ├── index.ts
│   │   ├── record.ts
│   │   └── record.provider.ts        # Uses assertRecord for idempotency
│   ├── entry/
│   │   ├── index.ts
│   │   ├── entry.ts
│   │   └── entry.provider.ts         # Uses assertEntry for idempotency
│   ├── webhook/
│   │   ├── index.ts
│   │   ├── webhook.ts
│   │   └── webhook.provider.ts
│   ├── note/
│   │   ├── index.ts
│   │   ├── note.ts
│   │   └── note.provider.ts          # Create, read, delete (no update)
│   └── task/
│       ├── index.ts
│       ├── task.ts
│       └── task.provider.ts
└── test/attio/
    ├── test.ts                       # Test utilities
    ├── object/
    │   └── object.provider.test.ts
    ├── attribute/
    │   └── attribute.provider.test.ts
    ├── select-option/
    │   └── select-option.provider.test.ts
    ├── status/
    │   └── status.provider.test.ts
    ├── list/
    │   └── list.provider.test.ts
    ├── record/
    │   └── record.provider.test.ts
    ├── entry/
    │   └── entry.provider.test.ts
    ├── webhook/
    │   └── webhook.provider.test.ts
    ├── note/
    │   └── note.provider.test.ts
    ├── task/
    │   └── task.provider.test.ts
    └── attio.smoke.test.ts           # Multi-resource integration
```

---

## 3. Resource Specifications

### 3.1 Object (Tier 1 — Schema)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Object` |
| **Delete** | **None** — Objects cannot be deleted via API |
| **ID type** | `string` (object_id from composite ObjectId) |
| **Unique by** | `apiSlug` |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `apiSlug` | `string` | Yes | No | Yes | Unique API slug (e.g., "deals") |
| `singularNoun` | `string` | Yes | No | No | Singular display name |
| `pluralNoun` | `string` | Yes | No | No | Plural display name |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `objectId` | `string` | Yes | Extracted from composite ID |
| `apiSlug` | `string` | Yes | API slug |
| `singularNoun` | `string \| null` | No | Singular noun |
| `pluralNoun` | `string \| null` | No | Plural noun |
| `createdAt` | `string` | No | ISO creation timestamp |

**Diff:** `apiSlug` change → `replace`. Noun changes → `update`.

**Provider Notes:**
- `delete` handler is a no-op (log warning via `session.note()`)
- `read` uses `getObject({ object: apiSlug })` for direct lookup
- `create` idempotency: attempt `getObject({ object: apiSlug })` first; if found, return existing

---

### 3.2 Attribute (Tier 1 — Schema)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Attribute` |
| **Delete** | **None** — Attributes cannot be deleted via API |
| **ID type** | `string` (attribute api_slug for addressing) |
| **Unique by** | `(target, identifier, apiSlug)` tuple |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `target` | `"objects" \| "lists"` | Yes | No | Yes | Parent resource type |
| `identifier` | `string` | Yes | Yes | Yes | Parent object/list slug |
| `apiSlug` | `string` | No | No | Yes | Attribute API slug |
| `title` | `string` | Yes | No | No | Display title |
| `type` | `string` | Yes | No | Yes | Attribute type (text, number, etc.) |
| `description` | `string \| null` | No | No | No | Description |
| `isRequired` | `boolean` | No | No | No | Whether required |
| `isUnique` | `boolean` | No | No | No | Whether unique |
| `isMultiselect` | `boolean` | No | No | Yes | Whether multiselect (immutable after creation) |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `attributeId` | `unknown` | Yes | Opaque attribute ID from API |
| `apiSlug` | `string \| null` | Yes | API slug |
| `title` | `string \| null` | No | Display title |
| `type` | `string \| null` | Yes | Attribute type |
| `description` | `string \| null` | No | Description |
| `isRequired` | `boolean` | No | Whether required |
| `isUnique` | `boolean` | No | Whether unique |
| `isMultiselect` | `boolean` | No | Whether multiselect |

**Diff:** `target`, `identifier`, `type`, `apiSlug`, `isMultiselect` change → `replace`. Title, description, `isRequired`, `isUnique` → `update`.

**Provider Notes:**
- `delete` handler is a no-op (log warning)
- `read` uses `getAttribute({ target, identifier, attribute: apiSlug })` for direct lookup
- `create` idempotency: attempt `getAttribute(...)` first; if found, update to match desired state

---

### 3.3 SelectOption (Tier 1 — Schema)

| Field | Value |
|-------|-------|
| **Type** | `Attio.SelectOption` |
| **Delete** | Soft archive (`is_archived: true` via updateSelectOption) |
| **ID type** | `unknown` (opaque option ID) |
| **Unique by** | `(target, identifier, attribute, title)` |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `target` | `"objects" \| "lists"` | Yes | No | Yes | Parent resource type |
| `identifier` | `string` | Yes | Yes | Yes | Parent object/list slug |
| `attribute` | `string` | Yes | Yes | Yes | Parent attribute slug |
| `title` | `string` | Yes | No | No | Option display title |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `optionId` | `unknown` | Yes | Opaque option ID |
| `title` | `string \| null` | No | Display title |
| `isArchived` | `boolean` | No | Whether archived |

**Diff:** `target`, `identifier`, `attribute` change → `replace`. `title` → `update`.

**Provider Notes:**
- `delete` uses `updateSelectOption({ ..., is_archived: true })` (soft archive)
- `create` idempotency: scan `listSelectOptions(...)` for existing title match (un-archive if found archived)
- No pagination on list — returns all options

---

### 3.4 Status (Tier 1 — Schema)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Status` |
| **Delete** | Soft archive (`is_archived: true` via updateStatus) |
| **ID type** | `string` (status_id from composite StatusId) |
| **Unique by** | `(target, identifier, attribute, title)` |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `target` | `"objects" \| "lists"` | Yes | No | Yes | Parent resource type |
| `identifier` | `string` | Yes | Yes | Yes | Parent object/list slug |
| `attribute` | `string` | Yes | Yes | Yes | Parent attribute slug |
| `title` | `string` | Yes | No | No | Status display title |
| `celebrationEnabled` | `boolean` | No | No | No | Celebration animation |
| `targetTimeInStatus` | `string \| null` | No | No | No | Target time in status |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `statusId` | `string` | Yes | Extracted from composite StatusId |
| `title` | `string` | No | Display title |
| `isArchived` | `boolean` | No | Whether archived |
| `celebrationEnabled` | `boolean` | No | Celebration animation |
| `targetTimeInStatus` | `string \| null` | No | Target time |

**Diff:** `target`, `identifier`, `attribute` change → `replace`. Title, flags → `update`.

---

### 3.5 List (Tier 1 — Schema)

| Field | Value |
|-------|-------|
| **Type** | `Attio.List` |
| **Delete** | Hard delete (`deleteList`) |
| **ID type** | `string` (list_id from composite ListId) |
| **Unique by** | `apiSlug` or `name` |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `name` | `string` | Yes | No | No | List display name |
| `parentObject` | `string[]` | No | Yes | Yes | Parent object slugs |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `listId` | `string` | Yes | Extracted from composite ListId |
| `apiSlug` | `string \| null` | Yes | API slug (auto-generated) |
| `name` | `string \| null` | No | Display name |
| `parentObject` | `string[]` | Yes | Parent objects |
| `workspaceAccess` | `string \| null` | No | Access level |
| `createdByActor` | `unknown` | No | Creator reference |

**Diff:** `parentObject` change → `replace`. `name` → `update`.

---

### 3.6 Record (Tier 2 — Data)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Record` |
| **Delete** | Hard delete (`deleteRecord`) |
| **ID type** | `string` (record_id from composite RecordId) |
| **Unique by** | `matchingAttribute` value via assert |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `object` | `string` | Yes | Yes | Yes | Parent object slug |
| `matchingAttribute` | `string` | Yes | No | Yes | Attribute used for upsert matching |
| `data` | `Record<string, unknown>` | Yes | No | No | Attribute values (snake_case keys) |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `recordId` | `string` | Yes | Extracted from composite RecordId |
| `objectId` | `string` | Yes | Parent object ID |
| `object` | `string` | No | Parent object slug (stored for delete handler) |
| `createdAt` | `string` | No | ISO creation timestamp |
| `webUrl` | `string` | No | Attio web URL |
| `values` | `Record<string, unknown>` | No | Current attribute values |

**Diff:** `object`, `matchingAttribute` change → `replace`. `data` → `update`.

**Provider Notes:**
- `create` uses `assertRecord({ object, matching_attribute, data })` for built-in idempotency
- `update` uses `updateRecord({ object, record_id, data })` — only sends changed data
- No need for manual paginated scan — assert handles idempotency

---

### 3.7 Entry (Tier 2 — Data)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Entry` |
| **Delete** | Hard delete (`deleteEntry`) |
| **ID type** | `string` (entry_id from composite EntryId) |
| **Unique by** | `matchingAttribute` value via assert |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `list` | `string` | Yes | Yes | Yes | Parent list slug |
| `matchingAttribute` | `string` | Yes | No | Yes | Attribute for upsert matching |
| `data` | `Record<string, unknown>` | Yes | No | No | Attribute values |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `entryId` | `string` | Yes | Extracted from composite EntryId |
| `listId` | `string` | Yes | Parent list ID |
| `list` | `string` | No | Parent list slug (stored for delete handler) |
| `createdAt` | `string` | No | ISO creation timestamp |
| `values` | `Record<string, unknown>` | No | Current attribute values |

**Diff:** `list`, `matchingAttribute` change → `replace`. `data` → `update`.

**Provider Notes:**
- Same assert-based idempotency pattern as Record

---

### 3.8 Webhook (Tier 3 — Supporting)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Webhook` |
| **Delete** | Hard delete (`deleteWebhook`) |
| **ID type** | `string` (webhook_id from composite WebhookId) |
| **Unique by** | `targetUrl` + subscriptions combo |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `targetUrl` | `string` | Yes | No | No | Webhook delivery URL |
| `subscriptions` | `unknown[]` | Yes | No | No | Event subscriptions |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `webhookId` | `string` | Yes | Extracted from composite WebhookId |
| `targetUrl` | `string` | No | Delivery URL |
| `subscriptions` | `unknown[]` | No | Event subscriptions |
| `status` | `string \| null` | No | Webhook status |
| `createdAt` | `string` | No | ISO creation timestamp |

**Diff:** All prop changes → `update`. No replacement triggers.

**Provider Notes:**
- Idempotency: scan `listWebhooks()` for matching `targetUrl`
- Paginated scan using offset-based pagination

---

### 3.9 Note (Tier 3 — Supporting)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Note` |
| **Delete** | Hard delete (`deleteNote`) |
| **ID type** | `string` (note_id from composite NoteId) |
| **Unique by** | `(parentObject, parentRecordId, title)` |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `parentObject` | `string` | Yes | Yes | Yes | Parent object slug |
| `parentRecordId` | `string` | Yes | Yes | Yes | Parent record ID |
| `title` | `string` | Yes | No | No | Note title |
| `format` | `string` | No | No | No | Content format |
| `content` | `string` | No | No | No | Note body content |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `noteId` | `string` | Yes | Extracted from composite NoteId |
| `parentObject` | `string \| null` | Yes | Parent object |
| `parentRecordId` | `string \| null` | Yes | Parent record |
| `title` | `string \| null` | No | Note title |
| `contentPlaintext` | `string \| null` | No | Plain text content |
| `format` | `string \| null` | No | Content format |
| `createdAt` | `string` | No | ISO creation timestamp |

**Diff:** `parentObject`, `parentRecordId` change → `replace`. Title, content → always `replace` (Notes have no update API).

**Provider Notes:**
- **No update method** — Notes cannot be updated via API. Any content change triggers `replace` (delete + recreate).
- Idempotency: scan `listNotes({ parent_object, parent_record_id })` for matching title

---

### 3.10 Task (Tier 3 — Supporting)

| Field | Value |
|-------|-------|
| **Type** | `Attio.Task` |
| **Delete** | Hard delete (`deleteTask`) |
| **ID type** | `string` (task_id from composite TaskId) |
| **Unique by** | `contentPlaintext` (best available) |

**Props:**

| Property | Type | Required | Input<T> | Replaces | Description |
|----------|------|----------|----------|----------|-------------|
| `content` | `string` | Yes | No | No | Task content |
| `format` | `string` | No | No | No | Content format |
| `deadlineAt` | `string \| null` | No | No | No | ISO deadline |
| `isCompleted` | `boolean` | No | No | No | Completion status |
| `linkedRecords` | `unknown[]` | No | Yes | No | Linked record references |
| `assignees` | `unknown[]` | No | No | No | Task assignees |

**Attrs:**

| Attribute | Type | Stable | Description |
|-----------|------|--------|-------------|
| `taskId` | `string` | Yes | Extracted from composite TaskId |
| `contentPlaintext` | `string \| null` | No | Plain text content |
| `format` | `string \| null` | No | Content format |
| `deadlineAt` | `string \| null` | No | Deadline |
| `isCompleted` | `boolean` | No | Completion status |
| `linkedRecords` | `unknown[]` | No | Linked records |
| `assignees` | `unknown[]` | No | Assignees |
| `createdAt` | `string` | No | ISO creation timestamp |

**Diff:** All prop changes → `update`. No replacement triggers.

---

## 4. Infrastructure Modules

### 4.1 Config (`config.ts`)

```typescript
export interface AttioStageConfig {
  /** API key. Falls back to ATTIO_API_KEY env var. */
  apiKey?: string;
  /** API endpoint. Defaults to https://api.attio.com */
  endpoint?: string;
}

declare module "alchemy-effect" {
  interface StageConfig {
    attio?: AttioStageConfig;
  }
}
```

**Note:** No `workspaceId` or `projectId` — the API key implicitly scopes to a workspace.

### 4.2 Credentials (`credentials.ts`)

Reads API key from `attio.apiKey` stage config or `ATTIO_API_KEY` env var. Returns `@packages/attio` `Credentials` tag.

### 4.3 Endpoint (`endpoint.ts`)

Reads endpoint from `attio.endpoint` stage config or defaults to `https://api.attio.com`. Returns `@packages/attio` `Endpoint` tag.

### 4.4 Retry Policy (`retry.ts`)

Retries on:
- `RateLimitError` (429)
- `ServerError` (500)
- `UnknownAttioError`

Does NOT retry:
- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `NotFoundError` (404)
- `ValidationError` (400)
- `ConflictError` (409)

Schedule: exponential backoff, 200ms base, max 5 retries.

### 4.5 Index (`index.ts`)

Composition pattern — same as PostHog but without Project layer:

```typescript
export const config = <L extends Layer.Layer<any, any, any>>(layer: L) =>
  layer.pipe(
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig()),
  );

export const resources = () =>
  Layer.mergeAll(
    Object.objectProvider(),
    Attribute.attributeProvider(),
    SelectOption.selectOptionProvider(),
    Status.statusProvider(),
    List.listProvider(),
    Record.recordProvider(),
    Entry.entryProvider(),
    Webhook.webhookProvider(),
    Note.noteProvider(),
    Task.taskProvider(),
  );

export const bareProviders = () => config(resources());
export const providers = () =>
  bareProviders().pipe(Layer.provideMerge(FetchHttpClient.layer));
```

---

## 5. Binding Pattern (Cross-Resource References)

### 5.1 Example Stack with Bindings

```typescript
import { defineStack, defineStages, type StageConfig } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Config from "effect/Config";
import * as Attio from "./src/attio/index.js";
import { Object as AttioObject } from "./src/attio/object/index.js";
import { Attribute } from "./src/attio/attribute/index.js";
import { SelectOption } from "./src/attio/select-option/index.js";
import { Record } from "./src/attio/record/index.js";

// Define a custom CRM object
export class DealsObject extends AttioObject("DealsObject", {
  apiSlug: "deals",
  singularNoun: "Deal",
  pluralNoun: "Deals",
}) {}

// Define an attribute on the object (references Object output)
export class DealStageAttr extends Attribute("DealStageAttr", {
  target: "objects",
  identifier: DealsObject.apiSlug,   // Binding: Input<string>
  title: "Deal Stage",
  type: "select",
}) {}

// Define select options for the attribute
export class StageProspect extends SelectOption("StageProspect", {
  target: "objects",
  identifier: DealsObject.apiSlug,
  attribute: DealStageAttr.apiSlug,  // Binding: Input<string>
  title: "Prospect",
}) {}

// Create a record on the object
export class AcmeDeal extends Record("AcmeDeal", {
  object: DealsObject.apiSlug,       // Binding: Input<string>
  matchingAttribute: "name",
  data: {
    name: [{ value: "Acme Corp Deal" }],
  },
}) {}
```

### 5.2 Input<T> Fields per Resource

| Resource | Property | Source |
|----------|----------|-------|
| Attribute | `identifier` | Object.apiSlug or List.apiSlug |
| SelectOption | `identifier` | Object.apiSlug or List.apiSlug |
| SelectOption | `attribute` | Attribute.apiSlug |
| Status | `identifier` | Object.apiSlug or List.apiSlug |
| Status | `attribute` | Attribute.apiSlug |
| Record | `object` | Object.apiSlug |
| Entry | `list` | List.apiSlug |
| Note | `parentObject` | Object.apiSlug |
| Note | `parentRecordId` | Record.recordId |
| Task | `linkedRecords` | Array referencing Record outputs |
| List | `parentObject` | Object.apiSlug array |

---

## 6. Delete Strategy Summary

| Resource | Strategy | Implementation |
|----------|----------|---------------|
| Object | **No-op** | Log warning, return void |
| Attribute | **No-op** | Log warning, return void |
| SelectOption | **Soft archive** | `updateSelectOption({ ..., is_archived: true })` |
| Status | **Soft archive** | `updateStatus({ ..., is_archived: true })` |
| List | **Hard delete** | `deleteList({ list })` + catch NotFoundError |
| Record | **Hard delete** | `deleteRecord({ object, record_id })` + catch NotFoundError |
| Entry | **Hard delete** | `deleteEntry({ list, entry_id })` + catch NotFoundError |
| Webhook | **Hard delete** | `deleteWebhook({ webhook_id })` + catch NotFoundError |
| Note | **Hard delete** | `deleteNote({ note_id })` + catch NotFoundError |
| Task | **Hard delete** | `deleteTask({ task_id })` + catch NotFoundError |

---

## 7. Idempotency Strategy Summary

| Resource | Strategy | Mechanism |
|----------|----------|-----------|
| Object | **Direct lookup** | `getObject({ object: apiSlug })` — slug is unique |
| Attribute | **Direct lookup** | `getAttribute({ target, identifier, attribute: apiSlug })` |
| SelectOption | **List scan** | `listSelectOptions(...)` → find by title (un-archive if needed) |
| Status | **List scan** | `listStatuses(...)` → find by title (un-archive if needed) |
| List | **List scan** | `listLists()` → find by name or api_slug |
| Record | **Assert (upsert)** | `assertRecord({ matching_attribute, data })` — API-native |
| Entry | **Assert (upsert)** | `assertEntry({ matching_attribute, data })` — API-native |
| Webhook | **Paginated scan** | `listWebhooks()` → find by targetUrl |
| Note | **Paginated scan** | `listNotes({ parent_object, parent_record_id })` → find by title |
| Task | **Paginated scan** | `listTasks({ linked_object, linked_record_id })` → find by content |

---

## 8. Testing Strategy

### 8.1 Environment Variables

```
ATTIO_API_KEY=sk_xxxxxxxxxxxxxxxxxxxx
```

No workspace/project ID needed.

### 8.2 Test Utilities (`test/attio/test.ts`)

- Same pattern as PostHog test utils
- No Project layer (unlike PostHog)
- `makeAssertDeleted` helpers for each resource type
- `makeAssertArchived` helpers for soft-archived resources (SelectOption, Status)
- Schema resources (Object, Attribute) need special cleanup: verify via API get, not assertDeleted

### 8.3 Test Order

Tests must run in dependency order for smoke test:
1. Object → 2. Attribute → 3. SelectOption/Status → 4. List → 5. Record → 6. Entry → 7. Webhook/Note/Task

Individual resource tests are independent (each creates its own prerequisites if needed).

### 8.4 Cleanup Considerations

- **Objects and Attributes cannot be deleted** — tests should use unique slugs (e.g., `"test-object-crud"`) and tolerate pre-existing resources
- **Records and Entries** — hard delete in cleanup
- **SelectOptions and Statuses** — archive in cleanup (check `is_archived` in assertions)

---

## 9. Excluded Services

The following `@packages/attio` SDK services are intentionally excluded from this provider:

| Service | Reason |
|---------|--------|
| **Comment** | Conversational artifact — not IaC-manageable. No update API, no list endpoint. |
| **Meeting** | Event data — not infrastructure. Create-only (no update/delete), complex sub-resources. |
| **Thread** | Read-only (list, get). Created implicitly by comments. Not a manageable resource. |
| **Self** | Read-only introspection (returns API key scopes). Not a resource. |
| **WorkspaceMember** | Read-only reference data. Members managed via Attio UI, not API. |

---

## 10. Implementation Order (Tracer Bullet)

The implementation follows a "tracer bullet" approach: get one resource fully working end-to-end
(scaffold → infra → resource → provider → test harness → integration test against real API) before
filling in the remaining resources. This validates the entire pipeline early.

| Phase | Tasks | Description |
|-------|-------|-------------|
| **Scaffold** | SCAFFOLD-001 | Package scaffold, monorepo registration |
| **Infrastructure** | INFRA-001 | Config, credentials, endpoint, retry |
| **Tracer 1** | TRACER-001 | Object resource end-to-end: resource + provider + index + test harness + integration test |
| **Tracer 2** | TRACER-002 | Attribute resource: validates Input<T> cross-resource bindings |
| **Services** | SVC-001 to SVC-008 | SelectOption, Status, List, Record, Entry, Webhook, Note, Task |
| **Final** | FINAL-001 | Type check, smoke test, alchemy.run.ts example |

---

## 11. Reference Files

| File | Topic |
|------|-------|
| `references/01-object-resource.md` | Object resource definition |
| `references/02-attribute-resource.md` | Attribute resource definition |
| `references/03-select-option-resource.md` | SelectOption resource definition |
| `references/04-status-resource.md` | Status resource definition |
| `references/05-list-resource.md` | List resource definition |
| `references/06-record-resource.md` | Record resource with assert-based idempotency |
| `references/07-entry-resource.md` | Entry resource with assert-based idempotency |
| `references/08-webhook-resource.md` | Webhook resource definition |
| `references/09-note-resource.md` | Note resource (no update) |
| `references/10-task-resource.md` | Task resource definition |
| `references/11-infrastructure.md` | Config, credentials, endpoint, retry, index |
| `references/12-test-utilities.md` | Test helpers, assertDeleted, assertArchived |
| `references/13-smoke-test.md` | Multi-resource integration test |
| `references/14-alchemy-run.md` | Stack definition with bindings example |
