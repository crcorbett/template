# Alchemy Attio Provider — Research

**Date**: 2026-01-30
**Status**: Complete

---

## 1. Attio API Characteristics

### 1.1 API Fundamentals

- **Base URL**: `https://api.attio.com` (v2 API)
- **Auth**: Bearer token via `ATTIO_API_KEY`
- **Rate Limits**: 100 reads/s, 25 writes/s
- **Response Envelope**: All responses wrapped in `{ "data": ... }`
- **Error Format**: `{ status_code, type, code, message }`

### 1.2 Pagination

Two pagination modes in the Attio API:

| Mode | Mechanism | Used By |
|------|-----------|---------|
| **Offset** | `offset` + `limit` in POST body or query params | Records query, Entries query, Notes, Tasks, Webhooks |
| **Cursor** | `next_cursor` in response, `page_token` in request | Meetings (beta) |

### 1.3 ID System

Attio uses **composite IDs** embedded in objects:

```json
{
  "id": {
    "workspace_id": "abc-123",
    "object_id": "def-456"
  }
}
```

For provider purposes, the relevant sub-ID varies:
- Objects: `object_id` (string UUID)
- Lists: `list_id` (string UUID)
- Records: `record_id` (string UUID)
- Entries: `entry_id` (string UUID)
- Attributes: opaque `id` object
- Webhooks: `webhook_id` (string UUID)
- Notes: `note_id` (string UUID)
- Tasks: `task_id` (string UUID)

### 1.4 Delete Strategy

| Resource | DELETE Endpoint | Strategy |
|----------|----------------|----------|
| Objects | None | **No delete** (schema resource) |
| Records | `DELETE /v2/objects/{object}/records/{record_id}` | Hard delete |
| Lists | `DELETE /v2/lists/{list}` | Hard delete |
| Entries | `DELETE /v2/lists/{list}/entries/{entry_id}` | Hard delete |
| Attributes | None | **No delete** (schema resource) |
| Select Options | None (has `is_archived` via PATCH) | Soft archive |
| Statuses | None (has `is_archived` via PATCH) | Soft archive |
| Notes | `DELETE /v2/notes/{note_id}` | Hard delete |
| Tasks | `DELETE /v2/tasks/{task_id}` | Hard delete |
| Webhooks | `DELETE /v2/webhooks/{webhook_id}` | Hard delete |
| Comments | `DELETE /v2/comments/{comment_id}` | Hard delete |

### 1.5 Upsert Support

Records and Entries support **assert** (upsert) operations:
- `PUT /v2/objects/{object}/records?matching_attribute={attr}` — Find-or-create by matching attribute
- `PUT /v2/lists/{list}/entries?matching_attribute={attr}` — Find-or-create by matching attribute

This is valuable for idempotent create in providers — instead of scanning lists, we can use `assertRecord`/`assertEntry`.

---

## 2. SDK Client Analysis (`@packages/attio`)

### 2.1 Available Services

| Service | Operations | Pagination | Notes |
|---------|-----------|------------|-------|
| Objects | list, get, create, update | None | Schema-level, no delete |
| Records | query, create, get, update, delete, assert, overwrite, search | Offset (query) | Full CRUD + upsert |
| Lists | list, get, create, update, delete | None | Full CRUD |
| Entries | query, create, get, update, delete, assert, overwrite | Offset (query) | Full CRUD + upsert |
| Attributes | list, create, get, update | None | Schema-level, no delete |
| SelectOptions | list, create, update | None | Soft archive via `is_archived` |
| Statuses | list, create, update | None | Soft archive via `is_archived` |
| Notes | list, create, get, delete | Offset | No update |
| Tasks | list, create, get, update, delete | Offset | Full CRUD |
| Comments | create, get, delete | None | No list, no update |
| Webhooks | list, create, get, update, delete | Offset | Full CRUD |
| WorkspaceMembers | list, get | None | Read-only |
| Self | get | None | Read-only |
| Threads | list, get | Offset | Read-only |
| Meetings | list, create, get + call recordings | Cursor | Beta API |

### 2.2 Error Types

- `AuthenticationError` (401)
- `AuthorizationError` (403)
- `NotFoundError` (404)
- `ValidationError` (400)
- `ConflictError` (409) — unique to Attio (unique attribute violations)
- `RateLimitError` (429)
- `ServerError` (500)
- `UnknownAttioError` — catch-all

### 2.3 Credential & Endpoint Tags

- `Credentials` tag from `@packages/attio/Credentials`
- `Endpoint` tag from `@packages/attio` (default: `https://api.attio.com`)

---

## 3. Resource Selection for Provider

### 3.1 Tier 1 — Core CRM Schema Resources

These define the data model and are prerequisites for data resources:

| Resource | Rationale | CRUD |
|----------|-----------|------|
| **Object** | Custom object definitions (People, Companies, Deals, etc.) | Create, Read, Update (no delete) |
| **Attribute** | Custom fields on objects/lists | Create, Read, Update (no delete) |
| **SelectOption** | Enum values for select/multiselect attributes | Create, Read, Update (soft archive) |
| **Status** | Pipeline stage values for status attributes | Create, Read, Update (soft archive) |
| **List** | Kanban/pipeline/list views | Full CRUD |

### 3.2 Tier 2 — Data Resources

These populate the schema with actual data:

| Resource | Rationale | CRUD |
|----------|-----------|------|
| **Record** | CRM records (people, companies, deals) | Full CRUD + assert |
| **Entry** | List entries (pipeline items) | Full CRUD + assert |

### 3.3 Tier 3 — Supporting Resources

| Resource | Rationale | CRUD |
|----------|-----------|------|
| **Webhook** | Event subscriptions | Full CRUD |
| **Note** | Record-attached notes | Create, Read, Delete (no update) |
| **Task** | Assignable tasks linked to records | Full CRUD |

### 3.4 Excluded (Read-Only / Not Useful for IaC)

- **WorkspaceMembers** — Read-only, managed via Attio UI
- **Self** — Read-only identity endpoint
- **Threads** — Read-only email threads
- **Meetings** — Beta API, limited operations
- **Comments** — No list/update, limited utility

---

## 4. Binding Requirements

### 4.1 What Are Bindings?

In the alchemy-effect model, **bindings** are typed exports from resources that let other resources reference their outputs. For example, after creating an `Object`, you need its `object_id` to create `Attribute`s on it.

### 4.2 Cross-Resource Dependencies

```
Object ──────────────> Attribute (target=objects, identifier=object.api_slug)
  │                         │
  │                         └──> SelectOption (target=objects, identifier=object.api_slug, attribute=attr.api_slug)
  │                         └──> Status (target=objects, identifier=object.api_slug, attribute=attr.api_slug)
  │
  └──> Record (object=object.api_slug)
        │
        └──> Note (parent_object=object.api_slug, parent_record_id=record.record_id)
        └──> Task (linked_records=[{target_object_id, target_record_id}])

List ──────────────> Attribute (target=lists, identifier=list.api_slug)
  │                         │
  │                         └──> SelectOption (target=lists, identifier=list.api_slug, attribute=attr.api_slug)
  │                         └──> Status (target=lists, identifier=list.api_slug, attribute=attr.api_slug)
  │
  └──> Entry (list=list.api_slug)

Webhook (standalone — no parent resource)
```

### 4.3 Input<T> Cross-Reference Fields

Properties that may reference another resource's output should use `Input<T>`:

| Resource | Property | References |
|----------|----------|------------|
| Attribute | `target` | "objects" or "lists" (static) |
| Attribute | `identifier` | Object.apiSlug or List.apiSlug |
| SelectOption | `target`, `identifier`, `attribute` | Object/List slug, Attribute slug |
| Status | `target`, `identifier`, `attribute` | Object/List slug, Attribute slug |
| Record | `object` | Object.apiSlug |
| Record | `data` | May contain attribute values referencing other records |
| Entry | `list` | List.apiSlug |
| Note | `parentObject` | Object.apiSlug |
| Note | `parentRecordId` | Record.recordId |
| Task | `linkedRecords` | Array of {target_object_id, target_record_id} |
| Webhook | (none) | Standalone |

---

## 5. Attio vs. PostHog — Provider Design Differences

| Aspect | PostHog | Attio |
|--------|---------|-------|
| **Project scope** | Single project_id for all resources | No project concept (workspace-level) |
| **ID format** | Numeric IDs or string UUIDs | Composite IDs (workspace_id + resource_id) |
| **Unique keys** | `key`, `name`, `content+dateMarker` | `api_slug` for schema resources |
| **Upsert** | None (manual scan for idempotency) | `assertRecord`/`assertEntry` for data resources |
| **Delete** | Mix of hard/soft delete | Mix: hard delete for data, no delete/soft archive for schema |
| **Pagination** | offset-based with `next` URL | offset-based with `limit`/`offset` params |
| **Config** | `posthog.projectId` required | No workspace ID needed (derived from API key) |
| **Nested resources** | Flat (all project-scoped) | Hierarchical (Object → Attribute → SelectOption) |
| **Schema resources** | None (PostHog has fixed schema) | Objects, Attributes, SelectOptions, Statuses |

### 5.1 No Project/Workspace ID Needed

Unlike PostHog (which requires `project_id` on every API call), Attio's API key is workspace-scoped. There's no need for a `Project` or `Workspace` context tag — the API key implicitly scopes all operations.

This simplifies the provider: no `Project.fromStageConfig()` layer needed.

### 5.2 Composite IDs

Attio returns composite IDs like `{ workspace_id, object_id }`. For provider purposes, we extract the relevant sub-ID (e.g., `object_id`) as the stable identifier. The `workspace_id` component is redundant since it's derived from the API key.

### 5.3 Schema Resources (Objects, Attributes)

PostHog has no equivalent — its schema is fixed. Attio's custom objects and attributes are themselves resources that must be managed. This creates a dependency hierarchy: Objects must exist before Attributes, Attributes before SelectOptions/Statuses, Objects before Records.

### 5.4 Idempotency via Assert

For Records and Entries, Attio's `assert` operation provides built-in idempotency — much cleaner than PostHog's manual pagination scan. For schema resources (Objects, Attributes), we use `api_slug` as the unique key for scan-based idempotency.

---

## 6. API Slug as Unique Identifier

### 6.1 Objects

Objects have an `api_slug` field (e.g., `"people"`, `"companies"`, `"deals"`). This is:
- Set on creation
- Used as the path parameter in API calls (`GET /v2/objects/{object}` where `{object}` can be slug or ID)
- Unique within a workspace
- The natural idempotency key

### 6.2 Attributes

Attributes also have an `api_slug` field. Combined with their parent (object/list), they form a unique identifier:
- `(target, identifier, api_slug)` is unique
- Used as the path parameter in API calls
- The natural idempotency key

### 6.3 Lists

Lists have an `api_slug` (nullable). When set, it can be used as a unique key. Lists also have a `name` field.

---

## 7. Response Envelope Handling

All Attio API responses wrap data in a `{ "data": ... }` envelope. The SDK client already unwraps this — provider code receives the unwrapped type directly.

For list operations returning `{ "data": T[] }`, the SDK returns the full response object. Provider code accesses `.data` for the array.
