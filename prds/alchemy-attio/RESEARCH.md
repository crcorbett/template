# Attio Distilled Client & Alchemy Provider — Research

## 1. What is Attio?

Attio is a modern, AI-native CRM platform. It is highly customizable and data-driven, allowing teams to model their go-to-market data using **Objects** (like People, Companies, Deals, Users, Workspaces) and **Lists** (pipeline views over those objects). The developer platform offers a REST API (v2) for programmatic access.

---

## 2. API Fundamentals

| Detail | Value |
|---|---|
| **Base URL** | `https://api.attio.com` |
| **API Version** | `v2` (path-prefixed: `/v2/...`) |
| **Protocol** | REST-JSON over HTTPS |
| **OpenAPI Spec** | `https://api.attio.com/openapi/api` (OpenAPI 3.1.0) |
| **Docs** | `https://developers.attio.com/` / `https://docs.attio.com/rest-api/overview` |
| **LLM Docs Index** | `https://docs.attio.com/llms.txt` |
| **Community SDK** | `d-stoll/attio-js` (auto-generated from OpenAPI, beta) |

---

## 3. Authentication

### Bearer Token (API Key)

Single-workspace API keys are generated in Workspace Settings > Developers > Create Integration.

```
Authorization: Bearer <access_token>
```

HTTP Basic Auth is also supported (token as username, empty password) but **not recommended**.

### OAuth 2.0 (Authorization Code Grant)

For multi-workspace / published integrations:
- Authorization URL: `https://app.attio.com/authorize`
- Token URL: `https://app.attio.com/oauth/token`
- Introspect URL: `https://app.attio.com/oauth/introspect`

### Scopes

Both OAuth and API key tokens use the same scope system:

| Scope | Levels |
|---|---|
| `user_management` | `read`, `read-write` |
| `record_permission` | `read`, `read-write` |
| `object_configuration` | `read`, `read-write` |
| `list_entry` | `read`, `read-write` |
| `list_configuration` | `read`, `read-write` |
| `public_collection` | `read`, `read-write` |
| `private_collection` | `read`, `read-write` |
| `comment` | `read`, `read-write` |
| `task` | `read`, `read-write` |
| `note` | `read`, `read-write` |
| `meeting` | `read`, `read-write` |
| `call_recording` | `read`, `read-write` |
| `webhook` | `read`, `read-write` |
| `scim_management` | `read`, `read-write` |

### SDK Mapping

For the distilled client, we use **Bearer token auth** (same as PostHog). The `Credentials` tag will hold a `Redacted<string>` API key, and the auth header will be:

```typescript
Authorization: `Bearer ${Redacted.value(credentials.apiKey)}`
```

Env var: `ATTIO_API_KEY`

---

## 4. Rate Limiting

| Type | Limit |
|---|---|
| **Read requests** | 100 requests/second |
| **Write requests** | 25 requests/second |

When exceeded:
- HTTP Status: `429 Too Many Requests`
- Response Header: `Retry-After` (typically next clock second)
- Request is **not processed** (safe to retry)

429 Response body:
```json
{
  "status_code": 429,
  "type": "rate_limit_error",
  "code": "rate_limit_exceeded",
  "message": "You have exceeded the rate limit. Please retry after the time specified in the Retry-After header."
}
```

### SDK Mapping

Same retry pattern as PostHog: exponential backoff + `Retry-After` header respect. The `RateLimitError` class will parse `retryAfter` from the response.

---

## 5. Error Response Format

All errors return a consistent JSON structure:

```json
{
  "status_code": 400,
  "type": "validation_error",
  "code": "specific_error_code",
  "message": "Human-readable description"
}
```

### HTTP Status Codes

| Status | Type | Meaning |
|---|---|---|
| `400` | `validation_error` | Bad Request (validation failure) |
| `401` | `unauthorized_error` | Invalid/missing token |
| `403` | `forbidden_error` | Insufficient scopes |
| `404` | `not_found_error` | Resource not found |
| `409` | `conflict_error` | Unique attribute violation |
| `429` | `rate_limit_error` | Rate limited |
| `500` | `server_error` | Internal server error |

### SDK Mapping

The error classes map cleanly to the distilled client pattern:

| Attio Error | SDK Error Class | Category |
|---|---|---|
| 401 `unauthorized_error` | `AuthenticationError` | `AuthError` |
| 403 `forbidden_error` | `AuthorizationError` | `AuthError` |
| 404 `not_found_error` | `NotFoundError` | `NotFoundError` |
| 400 `validation_error` | `ValidationError` | `ValidationError` |
| 409 `conflict_error` | `ConflictError` (new) | `ValidationError` |
| 429 `rate_limit_error` | `RateLimitError` | `ThrottlingError` |
| 500 `server_error` | `ServerError` | `ServerError` |

**New error class needed:** `ConflictError` (409) for unique attribute violations. This is Attio-specific and maps to the `ValidationError` category (non-retryable).

The response parser needs to read the `status_code`, `type`, `code`, and `message` fields from error bodies. The `type` field is the primary discriminator.

---

## 6. Pagination

Attio uses **two distinct pagination styles**:

### A) Offset-based (most endpoints)

Used by: Records query, Entries query, Notes, Tasks, Webhooks, Workspace Members, etc.

**GET endpoints:** query params `?limit=50&offset=100`
**POST query endpoints:** JSON body `{"limit": 50, "offset": 50}`

Default/max limits vary by resource:

| Resource | Default | Max |
|---|---|---|
| Records query | 500 | — |
| Entries query | 500 | — |
| Tasks | 500 | 500 |
| Notes | 10 | 50 |
| Webhooks | 10 | 100 |

**End detection:** returned items count < requested limit.

### B) Cursor-based (newer endpoints)

Used by: Meetings, Call Recordings (both beta).

**Request:** `?limit=50&cursor=<opaque_string>`
**Response:**
```json
{
  "data": [...],
  "pagination": {
    "next_cursor": "opaque-cursor-value"
  }
}
```

**End detection:** `next_cursor` is `null` or absent.

### SDK Mapping

This is a key difference from PostHog. PostHog uses offset-based pagination with a `next` URL field. Attio uses:

1. **Offset-based** — but WITHOUT a `next` URL in the response. The client must track offset manually.
2. **Cursor-based** — with `pagination.next_cursor` field.

**Impact on client infrastructure:**

The PostHog `makePaginated` extracts the next page token from a URL in the response (`outputToken: "next"` points to a full URL that gets parsed for the offset). Attio doesn't return a `next` URL — the response is just `{ "data": [...] }` with no pagination metadata for offset-based endpoints.

**Options:**
1. **Modify `makePaginated`** to support a "manual offset" mode where the client increments offset by limit automatically, stopping when `data.length < limit`.
2. **Implement a separate pagination helper** for Attio's offset pattern.
3. **Use the cursor-based pattern** for endpoints that support it, and manual offset for the rest.

**Recommendation:** Implement a custom `makePaginated` variant in the Attio client that supports both modes:
- Offset mode: auto-increment offset, stop when items < limit
- Cursor mode: read `pagination.next_cursor`, stop when null

---

## 7. Response Envelope

All Attio API responses wrap data in a `{ "data": ... }` envelope:

- **Single item:** `{ "data": { ... } }`
- **List:** `{ "data": [ ... ] }`
- **Cursor-paginated:** `{ "data": [ ... ], "pagination": { "next_cursor": "..." } }`

### SDK Mapping

The response parser needs to unwrap the `data` envelope. This differs from PostHog where the response IS the data (no envelope for single items, and `{ count, next, previous, results }` for lists).

**Options:**
1. Handle envelope unwrapping in the response parser (service-specific).
2. Add an annotation/trait for response envelope style.
3. Have output schemas include the envelope.

**Recommendation:** Define output schemas to include the envelope (e.g., `ListObjectsOutput` has a `data` field), consistent with how PostHog defines `PaginatedDashboardList` with `results`. The pagination helper reads from `data` as the items field.

---

## 8. Resource Identifiers

Attio uses **composite IDs** — objects like:
```json
{
  "id": {
    "workspace_id": "uuid",
    "object_id": "uuid"
  }
}
```

Resources accept either **UUID** or **api_slug** (e.g., `"people"`, `"companies"`) as path parameters.

### SDK Mapping

Path parameters in request schemas should be typed as `S.String` to accept both UUIDs and slugs. The composite ID structure needs a shared schema:

```typescript
export class ObjectId extends S.Class<ObjectId>("ObjectId")({
  workspace_id: S.String,
  object_id: S.String,
}) {}
```

---

## 9. Value System

Attio has a rich **value system** where record attribute values are arrays of value objects with temporal metadata:

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

This is complex and unique to Attio. For the distilled client, we should define shared value type schemas.

---

## 10. Query Endpoints (POST-based filtering)

Several Attio endpoints use POST for querying with filter/sort in the request body:

- `POST /v2/objects/{object}/records/query`
- `POST /v2/lists/{list}/entries/query`

Filter operators: `$eq`, `$in`, `$not_empty`, `$contains`, `$starts_with`, `$ends_with`, `$lt`, `$lte`, `$gt`, `$gte`
Logical operators: `$and`, `$or`, `$not`

Sorting: `{ "attribute": "slug", "direction": "asc"|"desc", "field": "optional" }`

### SDK Mapping

These are standard POST operations with JSON body. The filter/sort schemas should be typed but flexible (using `S.Unknown` or `S.Record` for the filter tree to avoid over-constraining).

---

## 11. Assert (Upsert) Pattern

Attio supports idempotent writes via PUT with a `matching_attribute` query parameter:

- `PUT /v2/objects/{object}/records` — upsert record
- `PUT /v2/lists/{list}/entries` — upsert entry

The `matching_attribute` identifies which attribute to use for dedup.

### SDK Mapping

These are standard PUT operations. The `matching_attribute` maps to `T.HttpQuery("matching_attribute")`.

---

## 12. Complete API Resource Map

### Core Resources (Priority 1 — Essential for CRM operations)

| Resource | Endpoints | Pagination | Notes |
|---|---|---|---|
| **Objects** | GET list, POST create, GET get, PATCH update | None (returns all) | Schema definition for custom objects |
| **Records** | POST query, POST create, GET get, PATCH update, DELETE delete, PUT assert | Offset (body) | Core data CRUD |
| **Lists** | GET list, POST create, GET get, PATCH update, DELETE delete | None (returns all) | Pipeline views |
| **Entries** | POST query, POST create, GET get, PATCH update, DELETE delete, PUT assert | Offset (body) | List entry CRUD |
| **Attributes** | GET list, POST create, GET get, PATCH update | None | Object/list attribute management |

### Supporting Resources (Priority 2)

| Resource | Endpoints | Pagination | Notes |
|---|---|---|---|
| **Notes** | GET list, POST create, GET get, PATCH update, DELETE delete | Offset (query), default 10, max 50 | Content in plaintext/markdown |
| **Tasks** | GET list, POST create, GET get, PATCH update, DELETE delete | Offset (query), default 500 | With assignees, deadlines, linked records |
| **Comments** | GET list (on thread), POST create, DELETE delete | None | Thread-based |
| **Webhooks** | GET list, POST create, GET get, PATCH update, DELETE delete | Offset (query), default 10, max 100 | 24 event types |
| **Workspace Members** | GET list, GET get | None | Read-only |
| **Self** | GET | N/A | Token identification |

### Beta Resources (Priority 3)

| Resource | Endpoints | Pagination | Notes |
|---|---|---|---|
| **Meetings** | GET list, GET get | Cursor-based | Beta |
| **Call Recordings** | GET list, GET get | Cursor-based | Beta |
| **Transcripts** | Nested under call recordings | — | Beta |

### Nested Resources

| Resource | Endpoints | Notes |
|---|---|---|
| **Select Options** | GET list, POST create, PATCH update | Nested under attributes |
| **Statuses** | GET list, POST create, PATCH update | Nested under attributes |
| **Record Entries** | GET list | List entries for a specific record |
| **Attribute Values** | GET list | Value history for a record attribute |

---

## 13. Distilled Client Implementation Plan

### Package Structure

```
packages/attio/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts
│   ├── credentials.ts          # Bearer token via ATTIO_API_KEY
│   ├── endpoint.ts             # https://api.attio.com
│   ├── errors.ts               # Attio-specific errors (including ConflictError)
│   ├── category.ts             # Copy from posthog, change namespace
│   ├── retry.ts                # Copy from posthog, change namespace
│   ├── traits.ts               # Copy from posthog, change namespace
│   ├── common.ts               # Shared schemas (ActorReference, CompositeId, etc.)
│   ├── client/
│   │   ├── api.ts              # MODIFIED: support offset-auto and cursor pagination
│   │   ├── operation.ts        # Copy from posthog
│   │   ├── request.ts          # Copy from posthog
│   │   ├── request-builder.ts  # Copy from posthog
│   │   ├── response.ts         # Copy from posthog
│   │   └── response-parser.ts  # MODIFIED: handle { "data": ... } envelope + Attio error format
│   └── services/
│       ├── objects.ts           # List, create, get, update
│       ├── records.ts           # Query, create, get, update, delete, assert
│       ├── lists.ts             # List, create, get, update, delete
│       ├── entries.ts           # Query, create, get, update, delete, assert
│       ├── attributes.ts        # List, create, get, update
│       ├── select-options.ts    # List, create, update
│       ├── notes.ts             # List, create, get, update, delete
│       ├── tasks.ts             # List, create, get, update, delete
│       ├── comments.ts          # List, create, delete
│       ├── webhooks.ts          # List, create, get, update, delete
│       ├── workspace-members.ts # List, get
│       └── self.ts              # Get (token identification)
└── test/
    ├── test.ts                  # Test harness
    └── *.test.ts
```

### Key Differences from PostHog

| Aspect | PostHog | Attio | Impact |
|---|---|---|---|
| **Response envelope** | No envelope (single) / `{ results, next, count }` (list) | Always `{ "data": ... }` | Response parser must unwrap `data` |
| **Pagination (offset)** | `next` URL in response | No `next` URL, manual offset tracking | Custom pagination logic needed |
| **Pagination (cursor)** | N/A | `pagination.next_cursor` | New pagination mode |
| **Error format** | Varies | Consistent `{ status_code, type, code, message }` | Cleaner error parsing |
| **IDs** | Flat integers | Composite objects `{ workspace_id, resource_id }` | ID schemas |
| **Path params** | `project_id` + resource ID | `object` slug/UUID + resource ID | Different path structure |
| **Query endpoints** | GET with query params | POST with JSON body (for records/entries) | Body-based query operations |
| **Delete response** | Soft delete (returns resource) | Hard delete (returns `{}`) | Void output for deletes |
| **Auth** | Bearer token | Bearer token | Same pattern |
| **Rate limits** | Unknown | 100 read/s, 25 write/s | Well-documented |

### Shared Schemas (common.ts)

```typescript
// Actor reference (appears in created_by_actor fields)
export class ActorReference extends S.Class<ActorReference>("ActorReference")({
  type: S.Union(
    S.Literal("api-token"),
    S.Literal("workspace-member"),
    S.Literal("system"),
    S.Literal("app")
  ),
  id: S.NullOr(S.String),
}) {}

// Composite ID patterns
export class ObjectId extends S.Class<ObjectId>("ObjectId")({
  workspace_id: S.String,
  object_id: S.String,
}) {}

export class ListId extends S.Class<ListId>("ListId")({
  workspace_id: S.String,
  list_id: S.String,
}) {}

export class RecordId extends S.Class<RecordId>("RecordId")({
  workspace_id: S.String,
  object_id: S.String,
  record_id: S.String,
}) {}

export class NoteId extends S.Class<NoteId>("NoteId")({
  workspace_id: S.String,
  note_id: S.String,
}) {}

export class TaskId extends S.Class<TaskId>("TaskId")({
  workspace_id: S.String,
  task_id: S.String,
}) {}

export class WebhookId extends S.Class<WebhookId>("WebhookId")({
  workspace_id: S.String,
  webhook_id: S.String,
}) {}
```

### Client Infrastructure Modifications

#### Response Parser Changes

The Attio response parser needs to:
1. Unwrap `{ "data": ... }` envelope for success responses
2. Parse error bodies using `{ status_code, type, code, message }` format
3. Map `type` field to error classes

#### Pagination Changes

Two pagination modes needed:

**Offset-auto mode** (for records query, entries query, notes, tasks, webhooks):
```typescript
pagination: {
  mode: "offset",        // NEW: pagination mode
  inputToken: "offset",
  items: "data",
  pageSize: "limit",
}
```

The client auto-increments offset and stops when `data.length < limit`.

**Cursor mode** (for meetings, call recordings):
```typescript
pagination: {
  mode: "cursor",        // NEW: pagination mode
  inputToken: "cursor",
  outputToken: "pagination.next_cursor",
  items: "data",
  pageSize: "limit",
}
```

### Services Overview

#### Objects Service
```
GET  /v2/objects                    → listObjects()
POST /v2/objects                    → createObject()
GET  /v2/objects/{object}           → getObject()
PATCH /v2/objects/{object}          → updateObject()
```

#### Records Service
```
POST   /v2/objects/{object}/records/query    → queryRecords()     [paginated, offset]
POST   /v2/objects/{object}/records          → createRecord()
GET    /v2/objects/{object}/records/{id}     → getRecord()
PATCH  /v2/objects/{object}/records/{id}     → updateRecord()
DELETE /v2/objects/{object}/records/{id}     → deleteRecord()
PUT    /v2/objects/{object}/records          → assertRecord()     [upsert]
```

#### Lists Service
```
GET    /v2/lists              → listLists()
POST   /v2/lists              → createList()
GET    /v2/lists/{list}       → getList()
PATCH  /v2/lists/{list}       → updateList()
DELETE /v2/lists/{list}       → deleteList()
```

#### Entries Service
```
POST   /v2/lists/{list}/entries/query    → queryEntries()     [paginated, offset]
POST   /v2/lists/{list}/entries          → createEntry()
GET    /v2/lists/{list}/entries/{id}     → getEntry()
PATCH  /v2/lists/{list}/entries/{id}     → updateEntry()
DELETE /v2/lists/{list}/entries/{id}     → deleteEntry()
PUT    /v2/lists/{list}/entries          → assertEntry()      [upsert]
```

#### Attributes Service
```
GET  /v2/{target}/{identifier}/attributes                → listAttributes()
POST /v2/{target}/{identifier}/attributes                → createAttribute()
GET  /v2/{target}/{identifier}/attributes/{attribute}    → getAttribute()
PATCH /v2/{target}/{identifier}/attributes/{attribute}   → updateAttribute()
```

#### Select Options Service
```
GET  /v2/{target}/{identifier}/attributes/{attribute}/options              → listSelectOptions()
POST /v2/{target}/{identifier}/attributes/{attribute}/options              → createSelectOption()
PATCH /v2/{target}/{identifier}/attributes/{attribute}/options/{option}    → updateSelectOption()
```

#### Notes Service
```
GET    /v2/notes           → listNotes()       [paginated, offset, default 10, max 50]
POST   /v2/notes           → createNote()
GET    /v2/notes/{id}      → getNote()
PATCH  /v2/notes/{id}      → updateNote()
DELETE /v2/notes/{id}      → deleteNote()
```

#### Tasks Service
```
GET    /v2/tasks           → listTasks()       [paginated, offset, default 500]
POST   /v2/tasks           → createTask()
GET    /v2/tasks/{id}      → getTask()
PATCH  /v2/tasks/{id}      → updateTask()
DELETE /v2/tasks/{id}      → deleteTask()
```

#### Comments Service
```
GET    /v2/threads/{thread_id}/comments    → listComments()
POST   /v2/threads/{thread_id}/comments    → createComment()
DELETE /v2/comments/{comment_id}           → deleteComment()
```

#### Webhooks Service
```
GET    /v2/webhooks           → listWebhooks()    [paginated, offset, default 10, max 100]
POST   /v2/webhooks           → createWebhook()
GET    /v2/webhooks/{id}      → getWebhook()
PATCH  /v2/webhooks/{id}      → updateWebhook()
DELETE /v2/webhooks/{id}      → deleteWebhook()
```

#### Workspace Members Service
```
GET /v2/workspace_members           → listWorkspaceMembers()
GET /v2/workspace_members/{id}      → getWorkspaceMember()
```

#### Self Service
```
GET /v2/self    → getSelf()
```

---

## 14. Alchemy Provider Considerations

The alchemy provider (`@packages/alchemy-attio`) will wrap the distilled client for infrastructure-as-code resource management. Key resources for the provider:

| Alchemy Resource | Attio API Resource | CRUD Pattern |
|---|---|---|
| `AttioObject` | Objects | Create, read, update (no delete for system objects) |
| `AttioAttribute` | Attributes | Create, read, update |
| `AttioList` | Lists | Create, read, update, delete |
| `AttioWebhook` | Webhooks | Full CRUD |
| `AttioRecord` | Records | Full CRUD + assert |
| `AttioNote` | Notes | Full CRUD |
| `AttioTask` | Tasks | Full CRUD |

The provider will follow the same two-layer architecture as alchemy-posthog:
1. **Layer 1:** `@packages/attio` (distilled client) — typed API SDK
2. **Layer 2:** `@packages/alchemy-attio` (provider) — alchemy resource definitions + lifecycle

---

## 15. Open Questions

1. **POST query endpoints for pagination:** The records query and entries query use POST with body params. The current `makePaginated` expects GET with query params for offset. Need to support POST-body pagination.

2. **Response envelope unwrapping:** Should the output schemas include the `{ "data": ... }` wrapper, or should the response parser strip it? Including it is more explicit; stripping it is more ergonomic.

3. **Attribute value system complexity:** Attio's value arrays with temporal metadata are complex. How deep should we type the value schemas? Options:
   - Full typing of all 15+ attribute value types (thorough but verbose)
   - `S.Unknown` for values (pragmatic, defers to consumer)
   - Key value types only (text, number, email, record-reference)

4. **Filter/sort typing:** Should filter/sort be fully typed or use `S.Unknown`?
   - Full typing is complex (recursive filter tree with 10+ operators)
   - `S.Unknown` is pragmatic for v1

5. **Scope of v1:** Should we implement all resources or start with core CRM resources (Objects, Records, Lists, Entries, Attributes)?

---

## 16. References

- [Attio REST API Overview](https://docs.attio.com/rest-api/overview)
- [Attio Authentication Guide](https://docs.attio.com/rest-api/guides/authentication)
- [Attio Rate Limiting Guide](https://docs.attio.com/rest-api/guides/rate-limiting)
- [Attio Pagination Guide](https://docs.attio.com/rest-api/guides/pagination)
- [Attio Filtering and Sorting Guide](https://docs.attio.com/rest-api/guides/filtering-and-sorting)
- [Attio OpenAPI Spec](https://api.attio.com/openapi/api)
- [Attio LLM Docs Index](https://docs.attio.com/llms.txt)
- [Community TypeScript SDK (d-stoll/attio-js)](https://github.com/d-stoll/attio-js)
- [Distilled Client Skill Reference](../../.claude/skills/distilled-client/)
- [PostHog Distilled Client Reference](../../packages/posthog/)
- [Alchemy PostHog Provider Reference](../../packages/alchemy-posthog/)
