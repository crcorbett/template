---
name: distilled-client
description: "Create new 'distilled' API client packages. A distilled client is a thin, typed Effect-based SDK wrapping a REST/OpenAPI service. Use this skill when creating a new @packages/<service> client library for any SaaS API, following the patterns established by @packages/posthog (distilled-posthog). Covers package scaffolding, client architecture, service definitions, error handling, pagination, retry policies, testing, and monorepo integration."
---

# Distilled Client SDK — Implementation Guide

A **distilled client** is a minimal, typed, Effect-based SDK that wraps a REST API (typically described by an OpenAPI spec). It provides:

- **Effect-native operations** — every call returns `Effect<Output, Error, Dependencies>`
- **Schema-validated** request/response types using Effect Schema
- **Automatic retry** with exponential backoff and rate-limit awareness
- **Pagination** via Stream-based `.pages()` and `.items()` helpers
- **Categorized errors** for predicate-based retry and catch policies

## Reference Implementation

The canonical reference is **`@packages/posthog`** (distilled-posthog):

```
packages/posthog/
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── src/
│   ├── index.ts              # Barrel exports
│   ├── credentials.ts        # Auth credential management
│   ├── endpoint.ts           # API base URL configuration
│   ├── errors.ts             # Typed error classes
│   ├── category.ts           # Error category system
│   ├── retry.ts              # Retry policy definitions
│   ├── traits.ts             # HTTP annotation system
│   ├── common.ts             # Shared schemas (e.g. UserBasic)
│   ├── client/
│   │   ├── api.ts            # Core client (makeClient, makePaginated)
│   │   ├── operation.ts      # Operation type definitions
│   │   ├── request.ts        # Request interface
│   │   ├── request-builder.ts # Schema → HTTP request serializer
│   │   └── response.ts       # Response interface
│   │   └── response-parser.ts # HTTP response → Schema deserializer
│   └── services/
│       ├── dashboards.ts     # One file per API resource
│       ├── feature-flags.ts
│       └── ...
└── test/
    ├── test.ts               # Test harness and helpers
    ├── dashboards.test.ts    # One test file per service
    └── client/
        ├── request-builder.test.ts
        └── response-parser.test.ts
```

The architecture was derived from **distilled-aws** (see `.context/distilled-aws/`), which uses Smithy AST code generation. Since most SaaS APIs use OpenAPI rather than Smithy, the PostHog implementation shows how to hand-author services from an OpenAPI spec while keeping the same client infrastructure.

## Detailed Reference Documents

Read these reference files for complete code examples, templates, and adaptation notes for each topic:

| # | Reference File | Topic | What It Contains |
|---|---------------|-------|-----------------|
| 01 | `references/01-package-scaffold.md` | Package Scaffolding | package.json template, tsconfig.json, vitest.config.ts, export conventions, live types mechanism, monorepo registration |
| 02 | `references/02-credentials-and-endpoint.md` | Auth & Endpoint | Credentials Context tag pattern, `fromEnv`/`fromApiKey`/`fromRedactedApiKey` factories, Endpoint tag, authentication variations (Bearer, API key header, Basic, OAuth2) |
| 03 | `references/03-error-system.md` | Error System | TaggedError classes, error categories (`category.ts`), `withCategory` decorator, predicates (`isTransientError`), catchers, adaptation notes for new APIs |
| 04 | `references/04-trait-annotations.md` | HTTP Traits | `HttpLabel`, `HttpQuery`, `HttpHeader`, `HttpPayload`, `Http`, `RestJsonProtocol`, `JsonName`, `TimestampFormat`, `all()` combiner, annotation retrieval helpers, URI template syntax |
| 05 | `references/05-client-infrastructure.md` | Client Engine | `makeClient`/`makePaginated` factories, `executeWithInit` flow, request builder/response parser, retry integration, pagination token parsing, adaptation checklist |
| 06 | `references/06-service-authoring.md` | Service Definitions | Full CRUD service example, read-only service, single-endpoint service, schema conventions, delete patterns, pagination config, service file layout rules |
| 07 | `references/07-retry-policies.md` | Retry System | Default policy (exponential backoff + Retry-After + jitter), pre-built policies (`none`, `transient`, `throttling`), test retry config, how retry is resolved in api.ts |
| 08 | `references/08-testing.md` | Testing | Test harness (`test.ts`), `withResource` cleanup, CRUD test patterns, pagination streaming tests, error handling tests, client infrastructure tests, schema unit tests |
| 09 | `references/09-barrel-exports.md` | Barrel Exports | `index.ts` pattern, namespace vs named exports, consumer import styles |

**When implementing a new client, read the reference files for each step before writing code.** The source code itself is at `packages/posthog/src/` for the canonical PostHog implementation.

---

## Step 1: Scaffold the Package

### 1.1 Create Directory Structure

```bash
mkdir -p packages/<service>/src/client
mkdir -p packages/<service>/src/services
mkdir -p packages/<service>/test/client
```

### 1.2 package.json

```json
{
  "name": "@packages/<service>",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "exports": {
    "./*": {
      "import": {
        "@packages/source": "./src/services/*.ts",
        "types": "./dist/src/services/*.d.ts",
        "default": "./dist/src/services/*.js"
      }
    },
    "./Credentials": {
      "import": {
        "@packages/source": "./src/credentials.ts",
        "types": "./dist/src/credentials.d.ts",
        "default": "./dist/src/credentials.js"
      }
    },
    "./Errors": {
      "import": {
        "@packages/source": "./src/errors.ts",
        "types": "./dist/src/errors.d.ts",
        "default": "./dist/src/errors.js"
      }
    },
    "./Retry": {
      "import": {
        "@packages/source": "./src/retry.ts",
        "types": "./dist/src/retry.d.ts",
        "default": "./dist/src/retry.js"
      }
    },
    ".": {
      "import": {
        "@packages/source": "./src/index.ts",
        "types": "./dist/src/index.d.ts",
        "default": "./dist/src/index.js"
      }
    }
  },
  "scripts": {
    "build": "tsc",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "test:watch": "vitest"
  },
  "peerDependencies": {
    "effect": "^3.16.0",
    "@effect/platform": "^0.82.0"
  },
  "devDependencies": {
    "@effect/platform": "^0.82.0",
    "@effect/platform-node": "0.74.0",
    "@effect/vitest": "^0.18.0",
    "@vitest/coverage-v8": "^3.0.0",
    "effect": "^3.16.0",
    "typescript": "catalog:typescript",
    "vitest": "^3.0.0"
  }
}
```

**Key conventions:**
- `@packages/source` custom export condition enables live types in dev (no rebuild needed)
- Wildcard export `./*` maps to service files for `@packages/<service>/dashboards` style imports
- Named exports for infrastructure modules (Credentials, Errors, Retry)

### 1.3 tsconfig.json

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": "./",
    "declaration": true,
    "declarationMap": true
  },
  "include": ["src/**/*"],
  "exclude": ["node_modules", "dist"]
}
```

### 1.4 vitest.config.ts

```typescript
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    globals: false,
    passWithNoTests: true,
    include: ["test/**/*.test.ts"],
    exclude: ["**/node_modules/**", "**/dist/**"],
    environment: "node",
  },
});
```

### 1.5 Register in Monorepo

Add to root `tsconfig.json` references:

```json
{ "path": "./packages/<service>" }
```

Run `bun install` to link the workspace.

---

## Step 2: Core Infrastructure

### 2.1 Credentials (`src/credentials.ts`)

Every distilled client needs a Credentials Context tag. Follow this exact pattern:

```typescript
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { MissingCredentialsError } from "./errors.js";

export interface <Service>Credentials {
  readonly apiKey: Redacted.Redacted<string>;
}

export class Credentials extends Context.Tag("@<service>/Credentials")<
  Credentials,
  <Service>Credentials
>() {
  static fromEnv(): Layer.Layer<Credentials, MissingCredentialsError> {
    return Layer.effect(
      Credentials,
      Effect.gen(function* () {
        const apiKey = yield* Config.redacted("<SERVICE>_API_KEY").pipe(
          Effect.mapError(
            () => new MissingCredentialsError({
              message: "<SERVICE>_API_KEY environment variable is not set",
            })
          )
        );
        return { apiKey };
      })
    );
  }

  static fromApiKey(apiKey: string): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey: Redacted.make(apiKey) });
  }

  static fromRedactedApiKey(apiKey: Redacted.Redacted<string>): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey });
  }
}
```

**Rules:**
- API keys are ALWAYS stored as `Redacted<string>` to prevent accidental logging
- `fromEnv()` reads from a `<SERVICE>_API_KEY` environment variable
- Tag ID uses `@<service>/Credentials` namespace convention

### 2.2 Endpoint (`src/endpoint.ts`)

```typescript
import * as Context from "effect/Context";

export class Endpoint extends Context.Tag("@<service>/Endpoint")<
  Endpoint,
  string
>() {
  static readonly DEFAULT = "https://api.<service>.com";
}
```

### 2.3 Errors (`src/errors.ts`)

Define typed error classes using Effect Schema's `TaggedError`. Each error class is annotated with an error category for predicate-based retry:

```typescript
import * as S from "effect/Schema";
import {
  withAuthError,
  withNotFoundError,
  withServerError,
  withThrottlingError,
  withValidationError,
} from "./category.js";

// Base unknown error (catch-all for unrecognized API errors)
export class UnknownServiceError extends S.TaggedError<UnknownServiceError>()(
  "UnknownServiceError",
  {
    errorTag: S.String,
    errorData: S.optional(S.Unknown),
    message: S.optional(S.String),
  }
) {}

// Standard HTTP error classes — pipe with category decorator
export class AuthenticationError extends S.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withAuthError) {}

export class AuthorizationError extends S.TaggedError<AuthorizationError>()(
  "AuthorizationError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withAuthError) {}

export class NotFoundError extends S.TaggedError<NotFoundError>()(
  "NotFoundError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withNotFoundError) {}

export class ValidationError extends S.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.Unknown),
    errors: S.optional(S.Record({ key: S.String, value: S.Unknown })),
  }
).pipe(withValidationError) {}

export class RateLimitError extends S.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.String),
    retryAfter: S.optional(S.Number),
  }
).pipe(withThrottlingError) {}

export class ServerError extends S.TaggedError<ServerError>()(
  "ServerError",
  { message: S.optional(S.String), detail: S.optional(S.String) }
).pipe(withServerError) {}

export class MissingHttpTraitError extends S.TaggedError<MissingHttpTraitError>()(
  "MissingHttpTraitError",
  { message: S.String }
) {}

export class MissingCredentialsError extends S.TaggedError<MissingCredentialsError>()(
  "MissingCredentialsError",
  { message: S.String }
) {}

// Generic error with code + message + details
export class ServiceError extends S.TaggedError<ServiceError>()(
  "ServiceError",
  { code: S.String, message: S.String, details: S.optional(S.Unknown) }
) {}

// Error lists for operation definitions
export const COMMON_ERRORS = [
  AuthenticationError, AuthorizationError, ValidationError, RateLimitError, ServerError,
] as const;

export const COMMON_ERRORS_WITH_NOT_FOUND = [...COMMON_ERRORS, NotFoundError] as const;

// Union type of all error types
export type ServiceErrorType =
  | ServiceError | UnknownServiceError | AuthenticationError | AuthorizationError
  | NotFoundError | ValidationError | RateLimitError | ServerError
  | MissingHttpTraitError | MissingCredentialsError;
```

### 2.4 Error Categories (`src/category.ts`)

Copy the category system verbatim from the PostHog reference. It provides:

- **Category constants**: `ThrottlingError`, `ServerError`, `AuthError`, `ValidationError`, `NotFoundError`, `NetworkError`, `TimeoutError`
- **`withCategory(...categories)` decorator**: Stamps category symbols onto error class prototypes, usable with `.pipe()`
- **Predicates**: `isThrottlingError()`, `isServerError()`, `isTransientError()`, etc.
- **Catchers**: `catchAuthError(handler)`, `catchNotFoundError(handler)`, etc.

The `isTransientError()` predicate is critical — it drives retry policy decisions:

```typescript
export const isTransientError = (error: unknown): boolean =>
  isThrottlingError(error) || isServerError(error) || isNetworkError(error) || isHttpClientTransportError(error);
```

### 2.5 Retry Policy (`src/retry.ts`)

```typescript
import * as Context from "effect/Context";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import { pipe } from "effect/Function";
import * as Layer from "effect/Layer";
import * as Predicate from "effect/Predicate";
import type * as Ref from "effect/Ref";
import * as Schedule from "effect/Schedule";
import { isThrottlingError, isTransientError } from "./category.js";

export interface Options {
  readonly while?: (error: unknown) => boolean;
  readonly schedule?: Schedule.Schedule<unknown>;
}

export type Factory = (lastError: Ref.Ref<unknown>) => Options;
export type Policy = Options | Factory;

export class Retry extends Context.Tag("@<service>/Retry")<Retry, Policy>() {}

export { isThrottlingError, isTransientError };

// Provide retry policy to an effect
export const policy: {
  (options: Options): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Retry>>;
  (factory: Factory): <A, E, R>(effect: Effect.Effect<A, E, R>) => Effect.Effect<A, E, Exclude<R, Retry>>;
} = (optionsOrFactory: Options | Factory) =>
  Effect.provide(Layer.succeed(Retry, optionsOrFactory));

// No-retry policy
export const none: <A, E, R>(
  effect: Effect.Effect<A, E, R>
) => Effect.Effect<A, E, Exclude<R, Retry>> = Effect.provide(
  Layer.succeed(Retry, { while: () => false })
);

// Default retry: exponential backoff, respects Retry-After, max 5 retries
export const makeDefault: Factory = (lastError) => ({
  while: (error) => isTransientError(error) || isThrottlingError(error),
  schedule: pipe(
    Schedule.exponential(100, 2),
    Schedule.modifyDelayEffect(
      Effect.fnUntraced(function* (duration) {
        const error = yield* lastError;
        if (isThrottlingError(error) && Predicate.isObject(error) && "retryAfter" in error) {
          const retryAfter = Number(error.retryAfter);
          if (!isNaN(retryAfter) && retryAfter > 0) {
            return Duration.toMillis(Duration.seconds(retryAfter));
          }
        }
        if (isThrottlingError(error)) {
          if (Duration.toMillis(duration) < 500) return Duration.toMillis(Duration.millis(500));
        }
        return Duration.toMillis(duration);
      }),
    ),
    Schedule.intersect(Schedule.recurs(5)),
    Schedule.jittered,
  ),
});
```

**Key behaviors:**
- `makeDefault` is a Factory (receives `Ref<unknown>` for last error)
- Respects `retryAfter` from RateLimitError responses
- Enforces minimum 500ms delay for throttling errors
- Jitter prevents thundering herd on concurrent retries
- `none` disables retry (useful for tests or one-shot operations)

---

## Step 3: HTTP Trait Annotation System (`src/traits.ts`)

The trait system annotates Effect Schema classes with HTTP binding metadata. This is what makes the client generic — the request builder reads these annotations to serialize inputs into HTTP requests.

Copy the traits system from the PostHog reference. Key traits:

```typescript
// HTTP binding traits
HttpHeader(name)     // Bind schema property to HTTP header
HttpQuery(name)      // Bind schema property to query parameter
HttpLabel(name?)     // Bind schema property to URI path parameter
HttpPayload()        // Bind schema property as raw HTTP body
HttpResponseCode()   // Bind to HTTP response status code

// Operation-level traits (applied to request schema class)
Http({ method, uri }) // HTTP method and URI template
RestJsonProtocol()    // Protocol marker

// JSON serialization
JsonName(fieldName)   // Custom JSON key name (uses Effect Schema fromKey)

// Timestamp handling
TimestampFormat("date-time" | "epoch-seconds")

// Service identification
ServiceName({ name, version? })

// Combiners
all(...annotations)   // Merge multiple annotations into one
```

**How annotations are applied to schemas:**

```typescript
// On individual properties (via .pipe()):
export class ListRequest extends S.Class<ListRequest>("ListRequest")(
  {
    project_id: S.String.pipe(T.HttpLabel()),           // Path parameter
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")), // Query parameter
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  // On the class itself (second argument to S.Class):
  T.all(
    T.Http({ method: "GET", uri: "/api/v1/resources/{project_id}/" }),
    T.RestJsonProtocol()
  )
) {}
```

---

## Step 4: Client Infrastructure (`src/client/`)

### 4.1 Operation Type (`operation.ts`)

```typescript
import type * as S from "effect/Schema";

export interface Operation {
  input: S.Schema.AnyNoContext;
  output: S.Schema.AnyNoContext;
  errors?: readonly S.Schema.AnyNoContext[];
  pagination?: {
    inputToken: string;    // Query param name (e.g. "offset", "cursor")
    outputToken: string;   // Response field with next URL (e.g. "next")
    items?: string;        // Response field containing items array (e.g. "results")
    pageSize?: string;     // Input param for page size (e.g. "limit")
  };
}

export interface PaginatedOperation extends Operation {
  pagination: NonNullable<Operation["pagination"]>;
}
```

### 4.2 Request/Response Types

**`request.ts`:**
```typescript
export interface Request {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  path: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string>;
  body?: string | Uint8Array | ReadableStream<Uint8Array> | undefined;
}
```

**`response.ts`:**
```typescript
export interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array>;
}
```

### 4.3 Request Builder (`request-builder.ts`)

The request builder reads HTTP trait annotations from the input schema AST and serializes input values into an HTTP `Request`:

1. **Extract HTTP trait** from schema annotations → method + URI template
2. **Classify properties** by their annotation:
   - `HttpLabel` → path parameter substitution in URI template
   - `HttpQuery` → query string parameters
   - `HttpHeader` → request headers
   - `HttpPayload` → raw body
   - No annotation → JSON body property
3. **Build the request** by substituting labels, collecting queries, and serializing body

Copy `request-builder.ts` from the PostHog reference verbatim — it is generic and works for any REST-JSON API.

### 4.4 Response Parser (`response-parser.ts`)

The response parser:

1. **Reads the response stream** into a UTF-8 string
2. **Parses JSON** (handles empty body as `{}`)
3. **On error status (≥400)**: tries to decode body against each error schema, falls back to generic error
4. **On success**: decodes body using the output schema

Copy from the PostHog reference — it is also generic.

### 4.5 API Client (`api.ts`)

The core client provides two factories:

**`makeClient(operation)`** — for non-paginated operations:
- Caches request builder and response parser per operation (lazy `??=` init)
- Resolves retry policy from context (or uses `makeDefault`)
- Wraps execution with retry logic

**`makePaginated(operation)`** — for paginated list operations:
- Returns a callable with `.pages(input)` and `.items(input)` methods
- `.pages()` returns `Stream<Page>` using `Stream.unfoldEffect`
- `.items()` returns `Stream<Item>` that flattens across all pages
- Parses "next" URL to extract pagination token

**Dependencies of every operation:**
```typescript
type Deps = HttpClient.HttpClient | Credentials | Endpoint;
```

Copy `api.ts` from the PostHog reference. The only service-specific parts are:
- The `Credentials` import path
- The `Endpoint` import path
- The error type import

---

## Step 5: Define Services (`src/services/`)

Each API resource gets its own file. This is the main authoring work when the OpenAPI spec isn't code-generated.

### 5.1 Service File Structure

```typescript
// src/services/dashboards.ts

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

// ---------------------------------------------------------------------------
// Sub-schemas (shared types used within this service)
// ---------------------------------------------------------------------------

export class DashboardTile extends S.Class<DashboardTile>("DashboardTile")({
  id: S.Number,
  // ... fields from API spec
}) {}

// ---------------------------------------------------------------------------
// Core resource schema
// ---------------------------------------------------------------------------

export class Dashboard extends S.Class<Dashboard>("Dashboard")({
  id: S.Number,
  name: S.NullOr(S.String),
  description: S.optional(S.String),
  created_at: S.optional(S.String),
  // ... all fields from API response
}) {}

// ---------------------------------------------------------------------------
// Paginated list schema
// ---------------------------------------------------------------------------

export class PaginatedDashboardList extends S.Class<PaginatedDashboardList>(
  "PaginatedDashboardList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Dashboard),
}) {}

// ---------------------------------------------------------------------------
// Request schemas (annotated with HTTP traits)
// ---------------------------------------------------------------------------

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

export class CreateDashboardRequest extends S.Class<CreateDashboardRequest>(
  "CreateDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    name: S.NullOr(S.String),
    description: S.optional(S.String),
    // ... writable fields
  },
  T.all(
    T.Http({ method: "POST", uri: "/api/v1/{project_id}/dashboards/" }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateDashboardRequest extends S.Class<UpdateDashboardRequest>(
  "UpdateDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    name: S.optional(S.NullOr(S.String)),
    // ... updatable fields (all optional for PATCH)
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/api/v1/{project_id}/dashboards/{id}/" }),
    T.RestJsonProtocol()
  )
) {}

// ---------------------------------------------------------------------------
// Operation definitions
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Exported client functions
// ---------------------------------------------------------------------------

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listDashboards: ((
  input: ListDashboardsRequest
) => Effect.Effect<PaginatedDashboardList, ServiceErrorType, Deps>) & {
  pages: (input: ListDashboardsRequest) => Stream.Stream<PaginatedDashboardList, ServiceErrorType, Deps>;
  items: (input: ListDashboardsRequest) => Stream.Stream<unknown, ServiceErrorType, Deps>;
} = /*@__PURE__*/ makePaginated(listDashboardsOperation);

export const getDashboard: (
  input: GetDashboardRequest
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = /*@__PURE__*/ makeClient(getDashboardOperation);

export const createDashboard: (
  input: CreateDashboardRequest
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = /*@__PURE__*/ makeClient(createDashboardOperation);

export const updateDashboard: (
  input: UpdateDashboardRequest
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = /*@__PURE__*/ makeClient(updateDashboardOperation);

// Soft-delete pattern (common for APIs that use PATCH with deleted flag)
export const deleteDashboard: (
  input: { project_id: string; id: number }
) => Effect.Effect<Dashboard, ServiceErrorType, Deps> = (input) =>
  updateDashboard({ project_id: input.project_id, id: input.id, deleted: true });
```

### 5.2 Service Definition Rules

1. **One file per API resource** in `src/services/`
2. **Schema classes** use `S.Class<T>(name)(fields, annotations)` pattern
3. **Request schemas** have HTTP trait annotations on properties and the class itself
4. **Path parameters** use `T.HttpLabel()` — must match `{paramName}` in URI template
5. **Query parameters** use `T.HttpQuery("query_param_name")`
6. **Body fields** have no trait annotation — they become JSON body properties
7. **Operations** are plain objects conforming to `Operation` or `PaginatedOperation`
8. **Error arrays**: Use `COMMON_ERRORS` for list/create, `COMMON_ERRORS_WITH_NOT_FOUND` for get/update/delete
9. **Exported functions** use `makeClient()` for single operations, `makePaginated()` for lists
10. **`/*@__PURE__*/`** annotation enables tree-shaking

### 5.3 Schema Conventions

```typescript
// Required field
name: S.String

// Optional field
description: S.optional(S.String)

// Nullable field
name: S.NullOr(S.String)

// Optional + Nullable
description: S.optional(S.NullOr(S.String))

// Arrays
tags: S.optional(S.Array(S.String))

// Nested objects
filters: S.optional(DashboardFilter)

// Records/maps
properties: S.optional(S.Record({ key: S.String, value: S.Unknown }))

// Unions
type: S.Union(S.Literal("popover"), S.Literal("api"), S.Literal("widget"))
```

### 5.4 Pagination Configuration

Different APIs use different pagination styles. Configure the `pagination` field accordingly:

```typescript
// Offset-based (most common for REST APIs)
pagination: {
  inputToken: "offset",       // Input param name
  outputToken: "next",        // Response field containing next page URL
  items: "results",           // Response field containing items array
  pageSize: "limit",          // Input param for page size
}

// Cursor-based
pagination: {
  inputToken: "cursor",
  outputToken: "next_cursor",
  items: "data",
}

// The client parses the outputToken URL to extract the inputToken query param value
```

### 5.5 Delete Patterns

APIs vary in how they handle deletion:

```typescript
// Pattern A: Hard DELETE endpoint
export class DeleteRequest extends S.Class<DeleteRequest>("DeleteRequest")(
  { id: S.Number.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "DELETE", uri: "/api/v1/resources/{id}/" }), T.RestJsonProtocol())
) {}
const deleteOperation: Operation = { input: DeleteRequest, output: S.Void, errors: [...COMMON_ERRORS_WITH_NOT_FOUND] };
export const deleteResource = makeClient(deleteOperation);

// Pattern B: Soft delete via PATCH (PostHog pattern)
export const deleteResource = (input) => updateResource({ ...input, deleted: true });

// Pattern C: Soft delete via dedicated archive endpoint
// ... just another operation with different URI
```

---

## Step 6: Barrel Exports (`src/index.ts`)

```typescript
// Core
export { Credentials, type <Service>Credentials } from "./credentials.js";
export { Endpoint } from "./endpoint.js";

// Client utilities
export { makePaginated } from "./client/api.js";

// Shared schemas
export { UserBasic } from "./common.js";

// Error types
export {
  AuthenticationError, AuthorizationError, COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND,
  MissingCredentialsError, NotFoundError, RateLimitError, ServerError,
  UnknownServiceError, ValidationError,
} from "./errors.js";

// Error categories
export * as Category from "./category.js";

// Retry policies
export * as Retry from "./retry.js";

// Trait annotations
export * as Traits from "./traits.js";

// Services (each as a namespace)
export * as Dashboards from "./services/dashboards.js";
export * as FeatureFlags from "./services/feature-flags.js";
// ... one per service
```

---

## Step 7: Testing

### 7.1 Test Harness (`test/test.ts`)

The test harness provides:

- **`test(name, testCase)`** — wraps Effect in `it.scopedLive()` with 30s timeout
- **`withResource({ acquire, use, release })`** — guarantees cleanup via `Effect.acquireUseRelease`
- **`beforeAll(effect)` / `afterAll(effect)`** — setup/teardown fixtures
- **`run(effect)`** — standalone Effect runner
- **`expectSnapshot(ctx, value)`** — file snapshot testing

Environment setup:
- Reads `.env` from monorepo root via `PlatformConfigProvider.fromDotEnv`
- Provides `Credentials.fromEnv()`, `FetchHttpClient.layer`, `NodeContext.layer`
- Applies test-specific retry policy (shorter backoff: 200ms base, 2s cap, 3 retries)
- Sets `net.setDefaultAutoSelectFamily(false)` for IPv6 workaround

```typescript
// Example test structure
import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Stream from "effect/Stream";
import * as Chunk from "effect/Chunk";

import { test, withResource, TEST_PROJECT_ID } from "./test.js";
import { createDashboard, getDashboard, listDashboards, updateDashboard, deleteDashboard } from "../src/services/dashboards.js";

describe("Dashboards", () => {
  test("should list dashboards", () =>
    Effect.gen(function* () {
      const projectId = yield* TEST_PROJECT_ID;
      const result = yield* listDashboards({ project_id: projectId, limit: 10 });
      expect(result).toBeDefined();
      expect(Array.isArray(result.results)).toBe(true);
    }));

  test("should stream pages", () =>
    Effect.gen(function* () {
      const projectId = yield* TEST_PROJECT_ID;
      const pages = yield* listDashboards
        .pages({ project_id: projectId, limit: 5 })
        .pipe(Stream.take(2), Stream.runCollect);
      expect(Chunk.toReadonlyArray(pages).length).toBeGreaterThanOrEqual(1);
    }));

  test("should perform full CRUD", () =>
    Effect.gen(function* () {
      const projectId = yield* TEST_PROJECT_ID;
      yield* withResource({
        acquire: createDashboard({ project_id: projectId, name: `test-${Date.now()}` }),
        use: (created) =>
          Effect.gen(function* () {
            expect(created.id).toBeDefined();

            const fetched = yield* getDashboard({ project_id: projectId, id: created.id });
            expect(fetched.id).toBe(created.id);

            const updated = yield* updateDashboard({
              project_id: projectId, id: created.id, name: "updated-name",
            });
            expect(updated.name).toBe("updated-name");
          }),
        release: (created) =>
          deleteDashboard({ project_id: projectId, id: created.id })
            .pipe(Effect.catchAll(() => Effect.void)),
      });
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const projectId = yield* TEST_PROJECT_ID;
      const result = yield* getDashboard({ project_id: projectId, id: 999999999 })
        .pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
```

### 7.2 Client Infrastructure Tests

Test the request builder and response parser in isolation:

- **`test/client/request-builder.test.ts`** — Tests path params, query params, headers, JSON body, payload body, missing trait errors. No HTTP calls.
- **`test/client/response-parser.test.ts`** — Tests success parsing, error status codes, empty bodies, malformed JSON, schema validation. Uses mock `ReadableStream` responses.

### 7.3 Test Patterns Checklist

For each service, test:

- [ ] List with default parameters
- [ ] List with pagination (limit/offset)
- [ ] Stream `.pages()` — at least 1-2 pages
- [ ] Stream `.items()` — flatten items across pages
- [ ] Full CRUD lifecycle with `withResource` cleanup
- [ ] Error handling (not found, invalid input)
- [ ] Service-specific edge cases

---

## Step 8: Common Schemas (`src/common.ts`)

Shared types that appear across multiple services:

```typescript
import * as S from "effect/Schema";

export class UserBasic extends S.Class<UserBasic>("UserBasic")({
  id: S.Number,
  uuid: S.String,
  distinct_id: S.optional(S.String),
  first_name: S.optional(S.String),
  last_name: S.optional(S.String),
  email: S.String,
}) {}
```

---

## Architecture Summary

```
Consumer code
    │
    ▼
Service functions (listDashboards, createDashboard, ...)
    │  defined in src/services/*.ts
    │  use makeClient() / makePaginated()
    │
    ▼
API Client (src/client/api.ts)
    │  executeWithInit() → resolves deps, builds request, executes, parses response
    │  wrapped with retry via resolveRetryPolicy + withRetry
    │
    ├── Request Builder (request-builder.ts)
    │   reads HttpLabel/HttpQuery/HttpHeader/HttpPayload annotations
    │   from Effect Schema AST → builds Request { method, path, query, headers, body }
    │
    ├── Response Parser (response-parser.ts)
    │   reads response stream → parses JSON → decodes via output Schema
    │   on error status: tries error schemas, falls back to generic error
    │
    └── Dependencies (Context tags)
        ├── HttpClient.HttpClient   (from @effect/platform)
        ├── Credentials             (Bearer token auth)
        ├── Endpoint                (API base URL)
        └── Retry                   (optional retry policy)
```

## Checklist for New Distilled Client

1. [ ] Scaffold package directory with src/client/, src/services/, test/
2. [ ] Create package.json with @packages/source exports
3. [ ] Create tsconfig.json extending root base
4. [ ] Create vitest.config.ts
5. [ ] Implement credentials.ts (Context tag + fromEnv/fromApiKey)
6. [ ] Implement endpoint.ts (Context tag + DEFAULT)
7. [ ] Copy category.ts (change symbol namespace from "distilled-posthog" to "distilled-<service>")
8. [ ] Implement errors.ts (adapt error field names to match API's error response format)
9. [ ] Copy retry.ts (change Context tag namespace)
10. [ ] Copy traits.ts (change symbol namespace)
11. [ ] Copy client/ directory (api.ts, operation.ts, request.ts, request-builder.ts, response.ts, response-parser.ts)
12. [ ] Update client/api.ts imports for your credentials/endpoint/errors
13. [ ] Create common.ts with shared schemas
14. [ ] Author service files from OpenAPI spec (one per resource)
15. [ ] Create index.ts barrel exports
16. [ ] Create test/test.ts harness (adapt env var names, endpoint URL)
17. [ ] Write tests for each service
18. [ ] Write client infrastructure tests
19. [ ] Register in root tsconfig.json references
20. [ ] Run `bun install` to link workspace

## Files That Are Fully Generic (Copy Verbatim)

These files work for any REST-JSON API with only symbol namespace changes:

- `src/category.ts` — change `"distilled-posthog"` to `"distilled-<service>"`
- `src/traits.ts` — change `"distilled-posthog"` to `"distilled-<service>"`
- `src/client/operation.ts` — fully generic
- `src/client/request.ts` — fully generic
- `src/client/response.ts` — fully generic
- `src/client/request-builder.ts` — fully generic
- `src/client/response-parser.ts` — change error import

## Files That Need Adaptation

- `src/credentials.ts` — env var name, credential shape (API key vs OAuth token vs bearer)
- `src/endpoint.ts` — default URL
- `src/errors.ts` — error class fields to match API's error response format
- `src/retry.ts` — context tag namespace, retry-after field name
- `src/client/api.ts` — import paths for credentials/endpoint/errors
- `src/services/*.ts` — fully custom per API
- `src/common.ts` — shared schemas specific to this API
- `src/index.ts` — barrel exports
- `test/test.ts` — env var names, endpoint URL, auth setup

## Authentication Variations

The reference uses Bearer token auth. For other auth schemes:

**API Key in Header (non-Bearer)**:
```typescript
// In api.ts, change the auth header:
headers: { ...request.headers, "X-Api-Key": Redacted.value(credentials.apiKey) }
```

**OAuth2 Bearer Token**:
```typescript
// Same as default — Bearer token pattern works as-is
headers: { ...request.headers, Authorization: `Bearer ${Redacted.value(credentials.accessToken)}` }
```

**Basic Auth**:
```typescript
const encoded = btoa(`${Redacted.value(credentials.username)}:${Redacted.value(credentials.password)}`);
headers: { ...request.headers, Authorization: `Basic ${encoded}` }
```

Adapt the `Credentials` interface and `api.ts` auth header accordingly.
