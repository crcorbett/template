# Service Authoring Reference

Services define the typed operations for each API resource. This is the main authoring work when creating a distilled client.

## Canonical Reference

- `packages/posthog/src/services/dashboards.ts` — full CRUD with pagination
- `packages/posthog/src/services/feature-flags.ts` — CRUD with nested sub-schemas
- `packages/posthog/src/services/me.ts` — single GET endpoint (simplest)
- `packages/posthog/src/services/events.ts` — read-only with cursor-based pagination

## Service File Structure

Every service file follows this exact layout:

```typescript
// 1. Imports
import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";
import * as S from "effect/Schema";
import type { Operation, PaginatedOperation } from "../client/operation.js";
import { makeClient, makePaginated } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, type ServiceErrorType } from "../errors.js";
import * as T from "../traits.js";

// 2. Sub-schemas (shared nested types)
// 3. Core resource schema (API response shape)
// 4. Paginated list schema
// 5. Request schemas (annotated with HTTP traits)
// 6. Operation definitions (plain objects)
// 7. Exported client functions
```

## Example: Full CRUD Service (Dashboards)

### Sub-schemas

Define reusable nested types that appear in responses:

```typescript
export class DashboardTile extends S.Class<DashboardTile>("DashboardTile")({
  id: S.Number,
  color: S.optional(S.NullOr(S.String)),
  // ... fields from API spec
}) {}
```

### Core Resource Schema

The full API response shape:

```typescript
export class Dashboard extends S.Class<Dashboard>("Dashboard")({
  id: S.Number,
  name: S.NullOr(S.String),
  description: S.optional(S.String),
  pinned: S.optional(S.Boolean),
  created_at: S.optional(S.String),
  created_by: S.optional(S.NullOr(UserBasic)),
  deleted: S.optional(S.Boolean),
  tags: S.optional(S.Array(S.String)),
  tiles: S.optional(S.Array(DashboardTile)),
}) {}
```

### Paginated List Schema

Standard envelope for paginated list responses:

```typescript
export class PaginatedDashboardList extends S.Class<PaginatedDashboardList>(
  "PaginatedDashboardList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),      // URL to next page
  previous: S.optional(S.NullOr(S.String)),  // URL to previous page
  results: S.Array(Dashboard),                // Page items (may use BasicVariant)
}) {}
```

**Note**: Some APIs return a "basic" variant in list responses (fewer fields). Define a separate `DashboardBasic` class if the list response shape differs from the detail response.

### Request Schemas

Each request schema has:
- **Properties** annotated with HTTP traits
- **Class-level annotation** with `Http({ method, uri })` and `RestJsonProtocol()`

```typescript
// LIST (paginated)
export class ListDashboardsRequest extends S.Class<ListDashboardsRequest>(
  "ListDashboardsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/v1/{project_id}/dashboards/" }),
    T.RestJsonProtocol()
  )
) {}

// GET (by ID)
export class GetDashboardRequest extends S.Class<GetDashboardRequest>(
  "GetDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/v1/{project_id}/dashboards/{id}/" }),
    T.RestJsonProtocol()
  )
) {}

// CREATE
export class CreateDashboardRequest extends S.Class<CreateDashboardRequest>(
  "CreateDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),  // Path param — NOT in body
    name: S.NullOr(S.String),                   // Body field — required
    description: S.optional(S.String),           // Body field — optional
    tags: S.optional(S.Array(S.String)),          // Body field — optional
  },
  T.all(
    T.Http({ method: "POST", uri: "/api/v1/{project_id}/dashboards/" }),
    T.RestJsonProtocol()
  )
) {}

// UPDATE (PATCH — all body fields optional)
export class UpdateDashboardRequest extends S.Class<UpdateDashboardRequest>(
  "UpdateDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),  // Path param
    id: S.Number.pipe(T.HttpLabel()),           // Path param
    name: S.optional(S.NullOr(S.String)),       // Body — optional for PATCH
    description: S.optional(S.String),
    deleted: S.optional(S.Boolean),              // For soft-delete
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/api/v1/{project_id}/dashboards/{id}/" }),
    T.RestJsonProtocol()
  )
) {}

// DELETE (standalone class for soft-delete pattern)
export class DeleteDashboardRequest extends S.Class<DeleteDashboardRequest>(
  "DeleteDashboardRequest"
)({
  project_id: S.String,
  id: S.Number,
}) {}
```

### Operation Definitions

```typescript
const listDashboardsOperation: PaginatedOperation = {
  input: ListDashboardsRequest,
  output: PaginatedDashboardList,
  errors: [...COMMON_ERRORS],
  pagination: { inputToken: "offset", outputToken: "next", items: "results", pageSize: "limit" },
};

const getDashboardOperation: Operation = {
  input: GetDashboardRequest,
  output: Dashboard,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const createDashboardOperation: Operation = {
  input: CreateDashboardRequest,
  output: Dashboard,
  errors: [...COMMON_ERRORS],
};

const updateDashboardOperation: Operation = {
  input: UpdateDashboardRequest,
  output: Dashboard,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};
```

### Exported Client Functions

```typescript
type Deps = HttpClient.HttpClient | Credentials | Endpoint;

// Paginated list — has .pages() and .items() methods
export const listDashboards: ((
  input: ListDashboardsRequest
) => Effect.Effect<PaginatedDashboardList, ServiceErrorType, Deps>) & {
  pages: (input: ListDashboardsRequest) => Stream.Stream<PaginatedDashboardList, ServiceErrorType, Deps>;
  items: (input: ListDashboardsRequest) => Stream.Stream<unknown, ServiceErrorType, Deps>;
} = /*@__PURE__*/ makePaginated(listDashboardsOperation);

// Single-call operations
export const getDashboard: (
  input: GetDashboardRequest
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = /*@__PURE__*/ makeClient(getDashboardOperation);

export const createDashboard: (
  input: CreateDashboardRequest
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = /*@__PURE__*/ makeClient(createDashboardOperation);

export const updateDashboard: (
  input: UpdateDashboardRequest
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = /*@__PURE__*/ makeClient(updateDashboardOperation);

// Soft-delete via PATCH
export const deleteDashboard: (
  input: DeleteDashboardRequest
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = (input) =>
  updateDashboard({ project_id: input.project_id, id: input.id, deleted: true });
```

## Example: Read-Only Service with Cursor Pagination (Events)

```typescript
// Cursor-based pagination uses a different inputToken
export class ListEventsRequest extends S.Class<ListEventsRequest>("ListEventsRequest")(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    after: S.optional(S.String).pipe(T.HttpQuery("after")),      // Cursor token
    before: S.optional(S.String).pipe(T.HttpQuery("before")),
    event: S.optional(S.String).pipe(T.HttpQuery("event")),      // Filter params
    distinct_id: S.optional(S.String).pipe(T.HttpQuery("distinct_id")),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/v1/{project_id}/events/" }),
    T.RestJsonProtocol()
  )
) {}

const listEventsOperation: PaginatedOperation = {
  input: ListEventsRequest,
  output: PaginatedEventList,
  errors: [...COMMON_ERRORS],
  pagination: { inputToken: "after", outputToken: "next", items: "results" },
  // Note: no pageSize for cursor-based pagination
};
```

## Example: Single Endpoint Service (Me)

```typescript
export class GetMeRequest extends S.Class<GetMeRequest>("GetMeRequest")(
  {},  // No properties — no path/query params
  T.all(T.Http({ method: "GET", uri: "/api/users/@me/" }), T.RestJsonProtocol())
) {}

export const getMe = /*@__PURE__*/ makeClient({ input: GetMeRequest, output: MeResponse, errors: [...COMMON_ERRORS] });
```

## Schema Convention Reference

```typescript
// Required field
name: S.String

// Optional field (may be absent from response)
description: S.optional(S.String)

// Nullable field (may be null in response)
name: S.NullOr(S.String)

// Optional + Nullable
description: S.optional(S.NullOr(S.String))

// Arrays
tags: S.optional(S.Array(S.String))

// Nested objects
filters: S.optional(DashboardFilter)

// Records/maps
properties: S.optional(S.Record({ key: S.String, value: S.Unknown }))

// Union types
type: S.Union(S.Literal("popover"), S.Literal("api"), S.Literal("widget"))

// Boolean
active: S.optional(S.Boolean)

// Number
id: S.Number
rollout_percentage: S.optional(S.NullOr(S.Number))

// Unknown (for loosely-typed API fields)
properties: S.optional(S.Unknown)
```

## Delete Patterns

### Soft Delete (PATCH with `deleted: true`)
Used when the API doesn't have a DELETE endpoint or uses soft deletion:
```typescript
export const deleteResource = (input) =>
  updateResource({ ...input, deleted: true });
```

### Hard Delete (DELETE endpoint)
```typescript
export class DeleteRequest extends S.Class<DeleteRequest>("DeleteRequest")(
  { id: S.Number.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "DELETE", uri: "/api/v1/resources/{id}/" }), T.RestJsonProtocol())
) {}
export const deleteResource = makeClient({ input: DeleteRequest, output: S.Struct({}), errors: [...COMMON_ERRORS_WITH_NOT_FOUND] });
```

### Archive (POST to archive endpoint)
```typescript
T.Http({ method: "POST", uri: "/api/v1/resources/{id}/archive/" })
```

## Tips

1. **`/*@__PURE__*/`** enables tree-shaking — always include on exported `makeClient`/`makePaginated` calls.
2. **Operations are `const` (not exported)** — only the client functions are public API.
3. **`type Deps`** alias keeps function signatures readable.
4. **Import traits as `* as T`** for concise annotation syntax.
5. **Re-export shared schemas** from common.ts: `export { UserBasic } from "../common.js";`
