# 06 — Service Authoring

Services define typed operations for each Attio API resource. Each resource gets its own file in `src/services/`.

## Canonical Reference

- `packages/posthog/src/services/feature-flags.ts` — CRUD with pagination
- `packages/posthog/src/services/me.ts` — single endpoint

## Service File Layout

Every service file follows this exact structure:

```typescript
// 1. Imports
import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";   // Only if paginated
import * as S from "effect/Schema";
import type { Operation, PaginatedOperation } from "../client/operation.js";
import { makeClient, makePaginated } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";

// 2. Sub-schemas (nested types, shared schemas)
// 3. Core resource schema
// 4. List response schema (with data array)
// 5. Single-item response schema (with data wrapper)
// 6. Request schemas (annotated with HTTP traits)
// 7. Operation definitions (const, not exported)
// 8. Exported client functions (/*@__PURE__*/)
```

## Attio-Specific Patterns

### Response Envelope

All Attio responses wrap data in `{ "data": ... }`. Output schemas must include the envelope:

```typescript
// For list endpoints → array of items
export class ObjectList extends S.Class<ObjectList>("ObjectList")({
  data: S.Array(AttioObject),
}) {}

// For single-item endpoints → single item
export class ObjectResponse extends S.Class<ObjectResponse>("ObjectResponse")({
  data: AttioObject,
}) {}
```

### POST-Body Pagination

Attio records and entries use POST for querying with `limit`/`offset` in the JSON body (not query params). Since the request builder classifies non-annotated fields as body props, simply omit `T.HttpQuery()`:

```typescript
export class QueryRecordsRequest extends S.Class<QueryRecordsRequest>("QueryRecordsRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),     // Path param
    filter: S.optional(S.Unknown),             // Body field
    sorts: S.optional(S.Array(S.Unknown)),     // Body field
    limit: S.optional(S.Number),               // Body field (NOT HttpQuery!)
    offset: S.optional(S.Number),              // Body field (NOT HttpQuery!)
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/objects/{object}/records/query" }),
    T.RestJsonProtocol()
  )
) {}
```

### GET Query Param Pagination

Notes, tasks, and webhooks use GET with query params:

```typescript
export class ListNotesRequest extends S.Class<ListNotesRequest>("ListNotesRequest")(
  {
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),     // Query param
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),   // Query param
    parent_object: S.optional(S.String).pipe(T.HttpQuery("parent_object")),
    parent_record_id: S.optional(S.String).pipe(T.HttpQuery("parent_record_id")),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/notes" }), T.RestJsonProtocol())
) {}
```

### Assert (Upsert) Pattern

Attio supports idempotent writes via PUT with a `matching_attribute` query parameter:

```typescript
export class AssertRecordRequest extends S.Class<AssertRecordRequest>("AssertRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    matching_attribute: S.String.pipe(T.HttpQuery("matching_attribute")),
    data: S.Unknown,   // Record values (body field)
  },
  T.all(
    T.Http({ method: "PUT", uri: "/v2/objects/{object}/records" }),
    T.RestJsonProtocol()
  )
) {}
```

### Hard Delete (Empty Response)

Attio deletes return `{}`. Use `S.Struct({})` or `S.Unknown` as the output schema:

```typescript
export class DeleteRecordResponse extends S.Class<DeleteRecordResponse>("DeleteRecordResponse")({
  data: S.optional(S.Unknown),
}) {}

// Or simply:
const deleteOp: Operation = {
  input: DeleteRecordRequest,
  output: S.Struct({ data: S.optional(S.Unknown) }),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};
```

### Multi-Label Paths

Attributes and select options have paths with 2-3 label params:

```typescript
// Two labels: {target} and {identifier}
export class ListAttributesRequest extends S.Class<ListAttributesRequest>("ListAttributesRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),      // "objects" or "lists"
    identifier: S.String.pipe(T.HttpLabel()),  // slug or UUID
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/{target}/{identifier}/attributes" }),
    T.RestJsonProtocol()
  )
) {}

// Three labels: {target}, {identifier}, {attribute}
export class ListSelectOptionsRequest extends S.Class<ListSelectOptionsRequest>("ListSelectOptionsRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/{target}/{identifier}/attributes/{attribute}/options" }),
    T.RestJsonProtocol()
  )
) {}
```

## Complete Service Examples

### Objects Service (Non-Paginated CRUD)

```typescript
// --- Response schemas ---

export class AttioObject extends S.Class<AttioObject>("AttioObject")({
  id: ObjectId,
  api_slug: S.NullOr(S.String),
  singular_noun: S.NullOr(S.String),
  plural_noun: S.NullOr(S.String),
  created_at: S.String,
}) {}

export class ObjectList extends S.Class<ObjectList>("ObjectList")({
  data: S.Array(AttioObject),
}) {}

export class ObjectResponse extends S.Class<ObjectResponse>("ObjectResponse")({
  data: AttioObject,
}) {}

// --- Request schemas ---

export class ListObjectsRequest extends S.Class<ListObjectsRequest>("ListObjectsRequest")(
  {},
  T.all(T.Http({ method: "GET", uri: "/v2/objects" }), T.RestJsonProtocol())
) {}

export class GetObjectRequest extends S.Class<GetObjectRequest>("GetObjectRequest")(
  { object: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/objects/{object}" }), T.RestJsonProtocol())
) {}

export class CreateObjectRequest extends S.Class<CreateObjectRequest>("CreateObjectRequest")(
  {
    api_slug: S.String,
    singular_noun: S.String,
    plural_noun: S.String,
  },
  T.all(T.Http({ method: "POST", uri: "/v2/objects" }), T.RestJsonProtocol())
) {}

export class UpdateObjectRequest extends S.Class<UpdateObjectRequest>("UpdateObjectRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    api_slug: S.optional(S.String),
    singular_noun: S.optional(S.String),
    plural_noun: S.optional(S.String),
  },
  T.all(T.Http({ method: "PATCH", uri: "/v2/objects/{object}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listObjectsOp: Operation = {
  input: ListObjectsRequest,
  output: ObjectList,
  errors: [...COMMON_ERRORS],
};

const getObjectOp: Operation = {
  input: GetObjectRequest,
  output: ObjectResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const createObjectOp: Operation = {
  input: CreateObjectRequest,
  output: ObjectResponse,
  errors: [...COMMON_ERRORS],
};

const updateObjectOp: Operation = {
  input: UpdateObjectRequest,
  output: ObjectResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listObjects: (
  input: ListObjectsRequest
) => Effect.Effect<ObjectList, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(listObjectsOp);

export const getObject: (
  input: GetObjectRequest
) => Effect.Effect<ObjectResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getObjectOp);

export const createObject: (
  input: CreateObjectRequest
) => Effect.Effect<ObjectResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(createObjectOp);

export const updateObject: (
  input: UpdateObjectRequest
) => Effect.Effect<ObjectResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(updateObjectOp);
```

### Records Service (Paginated POST Query + CRUD + Assert)

```typescript
// --- Response schemas ---

export class AttioRecord extends S.Class<AttioRecord>("AttioRecord")({
  id: RecordId,
  created_at: S.String,
  web_url: S.optional(S.String),
  values: S.optional(S.Record({ key: S.String, value: S.Unknown })),
}) {}

export class RecordList extends S.Class<RecordList>("RecordList")({
  data: S.Array(AttioRecord),
}) {}

export class RecordResponse extends S.Class<RecordResponse>("RecordResponse")({
  data: AttioRecord,
}) {}

// --- Request schemas ---

export class QueryRecordsRequest extends S.Class<QueryRecordsRequest>("QueryRecordsRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    filter: S.optional(S.Unknown),
    sorts: S.optional(S.Array(S.Unknown)),
    limit: S.optional(S.Number),     // Body field (no HttpQuery)
    offset: S.optional(S.Number),    // Body field (no HttpQuery)
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/objects/{object}/records/query" }),
    T.RestJsonProtocol()
  )
) {}

export class CreateRecordRequest extends S.Class<CreateRecordRequest>("CreateRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    data: S.Unknown,
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/objects/{object}/records" }),
    T.RestJsonProtocol()
  )
) {}

export class GetRecordRequest extends S.Class<GetRecordRequest>("GetRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    record_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/objects/{object}/records/{record_id}" }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateRecordRequest extends S.Class<UpdateRecordRequest>("UpdateRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    record_id: S.String.pipe(T.HttpLabel()),
    data: S.optional(S.Unknown),
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/v2/objects/{object}/records/{record_id}" }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteRecordRequest extends S.Class<DeleteRecordRequest>("DeleteRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    record_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "DELETE", uri: "/v2/objects/{object}/records/{record_id}" }),
    T.RestJsonProtocol()
  )
) {}

export class AssertRecordRequest extends S.Class<AssertRecordRequest>("AssertRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    matching_attribute: S.String.pipe(T.HttpQuery("matching_attribute")),
    data: S.Unknown,
  },
  T.all(
    T.Http({ method: "PUT", uri: "/v2/objects/{object}/records" }),
    T.RestJsonProtocol()
  )
) {}

// --- Operations ---

const queryRecordsOp: PaginatedOperation = {
  input: QueryRecordsRequest,
  output: RecordList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "offset",
    inputToken: "offset",
    items: "data",
    pageSize: "limit",
  },
};

const createRecordOp: Operation = {
  input: CreateRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS],
};

const getRecordOp: Operation = {
  input: GetRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const updateRecordOp: Operation = {
  input: UpdateRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteRecordOp: Operation = {
  input: DeleteRecordRequest,
  output: S.Struct({}),   // Hard delete → empty response
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const assertRecordOp: Operation = {
  input: AssertRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS_WITH_CONFLICT],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const queryRecords: ((
  input: QueryRecordsRequest
) => Effect.Effect<RecordList, AttioErrorType, Deps>) & {
  pages: (input: QueryRecordsRequest) => Stream.Stream<RecordList, AttioErrorType, Deps>;
  items: (input: QueryRecordsRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(queryRecordsOp);

export const createRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(createRecordOp);
export const getRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(getRecordOp);
export const updateRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateRecordOp);
export const deleteRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteRecordOp);
export const assertRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(assertRecordOp);
```

### Self Service (Single Endpoint)

```typescript
export class SelfData extends S.Class<SelfData>("SelfData")({
  active_scopes: S.optional(S.Array(S.String)),
  // ... other fields from /v2/self response
}) {}

export class SelfResponse extends S.Class<SelfResponse>("SelfResponse")({
  data: SelfData,
}) {}

export class GetSelfRequest extends S.Class<GetSelfRequest>("GetSelfRequest")(
  {},
  T.all(T.Http({ method: "GET", uri: "/v2/self" }), T.RestJsonProtocol())
) {}

const getSelfOp: Operation = {
  input: GetSelfRequest,
  output: SelfResponse,
  errors: [...COMMON_ERRORS],
};

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const getSelf: (
  input: GetSelfRequest
) => Effect.Effect<SelfResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getSelfOp);
```

## Service Summary Table

| Service | File | Operations | Paginated | Pagination Mode | Error List |
|---|---|---|---|---|---|
| Objects | `objects.ts` | list, create, get, update | No | — | COMMON / NOT_FOUND |
| Records | `records.ts` | query, create, get, update, delete, assert | query | offset (POST body) | COMMON / NOT_FOUND / CONFLICT |
| Lists | `lists.ts` | list, create, get, update, delete | No | — | COMMON / NOT_FOUND |
| Entries | `entries.ts` | query, create, get, update, delete, assert | query | offset (POST body) | COMMON / NOT_FOUND / CONFLICT |
| Attributes | `attributes.ts` | list, create, get, update | No | — | COMMON / NOT_FOUND |
| Select Options | `select-options.ts` | list, create, update | No | — | COMMON |
| Notes | `notes.ts` | list, create, get, update, delete | list | offset (GET query) | COMMON / NOT_FOUND |
| Tasks | `tasks.ts` | list, create, get, update, delete | list | offset (GET query) | COMMON / NOT_FOUND |
| Comments | `comments.ts` | list, create, delete | No | — | COMMON / NOT_FOUND |
| Webhooks | `webhooks.ts` | list, create, get, update, delete | list | offset (GET query) | COMMON / NOT_FOUND |
| Workspace Members | `workspace-members.ts` | list, get | No | — | COMMON / NOT_FOUND |
| Self | `self.ts` | get | No | — | COMMON |

## Endpoint Reference Per Service

| Service | Method | URI |
|---|---|---|
| **Objects** | | |
| listObjects | GET | `/v2/objects` |
| createObject | POST | `/v2/objects` |
| getObject | GET | `/v2/objects/{object}` |
| updateObject | PATCH | `/v2/objects/{object}` |
| **Records** | | |
| queryRecords | POST | `/v2/objects/{object}/records/query` |
| createRecord | POST | `/v2/objects/{object}/records` |
| getRecord | GET | `/v2/objects/{object}/records/{record_id}` |
| updateRecord | PATCH | `/v2/objects/{object}/records/{record_id}` |
| deleteRecord | DELETE | `/v2/objects/{object}/records/{record_id}` |
| assertRecord | PUT | `/v2/objects/{object}/records` |
| **Lists** | | |
| listLists | GET | `/v2/lists` |
| createList | POST | `/v2/lists` |
| getList | GET | `/v2/lists/{list}` |
| updateList | PATCH | `/v2/lists/{list}` |
| deleteList | DELETE | `/v2/lists/{list}` |
| **Entries** | | |
| queryEntries | POST | `/v2/lists/{list}/entries/query` |
| createEntry | POST | `/v2/lists/{list}/entries` |
| getEntry | GET | `/v2/lists/{list}/entries/{entry_id}` |
| updateEntry | PATCH | `/v2/lists/{list}/entries/{entry_id}` |
| deleteEntry | DELETE | `/v2/lists/{list}/entries/{entry_id}` |
| assertEntry | PUT | `/v2/lists/{list}/entries` |
| **Attributes** | | |
| listAttributes | GET | `/v2/{target}/{identifier}/attributes` |
| createAttribute | POST | `/v2/{target}/{identifier}/attributes` |
| getAttribute | GET | `/v2/{target}/{identifier}/attributes/{attribute}` |
| updateAttribute | PATCH | `/v2/{target}/{identifier}/attributes/{attribute}` |
| **Select Options** | | |
| listSelectOptions | GET | `/v2/{target}/{identifier}/attributes/{attribute}/options` |
| createSelectOption | POST | `/v2/{target}/{identifier}/attributes/{attribute}/options` |
| updateSelectOption | PATCH | `/v2/{target}/{identifier}/attributes/{attribute}/options/{option}` |
| **Notes** | | |
| listNotes | GET | `/v2/notes` |
| createNote | POST | `/v2/notes` |
| getNote | GET | `/v2/notes/{note_id}` |
| updateNote | PATCH | `/v2/notes/{note_id}` |
| deleteNote | DELETE | `/v2/notes/{note_id}` |
| **Tasks** | | |
| listTasks | GET | `/v2/tasks` |
| createTask | POST | `/v2/tasks` |
| getTask | GET | `/v2/tasks/{task_id}` |
| updateTask | PATCH | `/v2/tasks/{task_id}` |
| deleteTask | DELETE | `/v2/tasks/{task_id}` |
| **Comments** | | |
| listComments | GET | `/v2/threads/{thread_id}/comments` |
| createComment | POST | `/v2/threads/{thread_id}/comments` |
| deleteComment | DELETE | `/v2/comments/{comment_id}` |
| **Webhooks** | | |
| listWebhooks | GET | `/v2/webhooks` |
| createWebhook | POST | `/v2/webhooks` |
| getWebhook | GET | `/v2/webhooks/{webhook_id}` |
| updateWebhook | PATCH | `/v2/webhooks/{webhook_id}` |
| deleteWebhook | DELETE | `/v2/webhooks/{webhook_id}` |
| **Workspace Members** | | |
| listWorkspaceMembers | GET | `/v2/workspace_members` |
| getWorkspaceMember | GET | `/v2/workspace_members/{workspace_member_id}` |
| **Self** | | |
| getSelf | GET | `/v2/self` |
