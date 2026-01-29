# Client Infrastructure Reference

The `client/` directory contains the HTTP execution engine. These files are **fully generic** and can be copied with only import path changes.

## Canonical Reference

- `packages/posthog/src/client/api.ts`
- `packages/posthog/src/client/operation.ts`
- `packages/posthog/src/client/request.ts`
- `packages/posthog/src/client/request-builder.ts`
- `packages/posthog/src/client/response.ts`
- `packages/posthog/src/client/response-parser.ts`

## Architecture Flow

```
Service function call (e.g., listDashboards({ project_id, limit: 10 }))
    │
    ▼
makeClient(operation) / makePaginated(operation)
    │  Lazy-init: caches requestBuilder + responseParser per operation (??= pattern)
    │
    ▼
executeWithInit(init, input)
    │  1. Resolve dependencies: HttpClient, Credentials, Endpoint
    │  2. Build request via cached requestBuilder
    │  3. Construct full URL: endpoint + path + queryString
    │  4. Attach Authorization header: Bearer <apiKey>
    │  5. Set Content-Type: application/json (for body requests)
    │  6. Execute HTTP request via @effect/platform HttpClient
    │  7. Read response stream
    │  8. Parse response via cached responseParser
    │
    ▼
withRetry(effect, lastError, policy)
    │  Wraps the entire execution with retry logic
    │  - Tracks last error via Ref for retry-after header inspection
    │  - Uses isTransientError predicate to decide what to retry
    │  - Exponential backoff with jitter
    │
    ▼
Result: Effect<Output, ErrorType, Deps>
```

## Operation Types (`operation.ts`)

```typescript
export interface Operation {
  input: S.Schema.AnyNoContext;     // Request schema (with HTTP trait annotations)
  output: S.Schema.AnyNoContext;    // Response schema
  errors?: readonly S.Schema.AnyNoContext[];  // Error schemas to match against
  pagination?: {
    inputToken: string;    // e.g. "offset", "cursor"
    outputToken: string;   // e.g. "next"
    items?: string;        // e.g. "results"
    pageSize?: string;     // e.g. "limit"
  };
}

export interface PaginatedOperation extends Operation {
  pagination: NonNullable<Operation["pagination"]>;
}
```

## Request / Response Interfaces

```typescript
// request.ts
export interface Request {
  method: "GET" | "POST" | "PUT" | "DELETE" | "PATCH" | "HEAD" | "OPTIONS";
  path: string;
  query: Record<string, string | string[] | undefined>;
  headers: Record<string, string>;
  body?: string | Uint8Array | ReadableStream<Uint8Array> | undefined;
}

// response.ts
export interface Response {
  status: number;
  statusText: string;
  headers: Record<string, string>;
  body: ReadableStream<Uint8Array>;
}
```

## Request Builder (`request-builder.ts`)

**Fully generic** — copy verbatim.

Key behaviors:
1. Reads `Http` trait from input schema for method + URI template
2. Classifies properties: label → path, query → querystring, header → headers, payload → body, else → JSON body
3. Substitutes path labels (`{name}` → URL-encoded value, `{name+}` → raw value)
4. Serializes Date → ISO string in both headers and body
5. Omits `Content-Type` header for bodyless GET/HEAD/DELETE requests
6. Omits undefined properties from body (no `null` serialization for `undefined`)
7. Fails with `MissingHttpTraitError` if no Http annotation found

## Response Parser (`response-parser.ts`)

**Fully generic** — copy verbatim (change error type import).

Key behaviors:
1. Reads response stream via `Stream.fromReadableStream`, combines chunks, decodes UTF-8
2. Empty body → `{}`
3. JSON parse failure → `{ rawText: string }` fallback
4. On HTTP error (≥400):
   - Tries to decode body against each error schema in order
   - Falls back to generic ServiceError with status code
   - Extracts message from: `message`, `error`, `detail`, `details`, `error_description`, `error.message`
5. On success: decodes body with output schema, fails with `PARSE_ERROR` on mismatch

## API Client (`api.ts`)

### `makeClient(operation)`

Creates a single-call client for non-paginated operations:

```typescript
const getDashboard = makeClient(getDashboardOperation);
// Returns: (input) => Effect<Dashboard, ErrorType, Deps>
```

- **Lazy init**: Request builder + response parser are created once on first call (`??=`)
- **Retry**: Wraps execution with resolved retry policy

### `makePaginated(operation)`

Creates a paginated client with `.pages()` and `.items()` methods:

```typescript
const listDashboards = makePaginated(listDashboardsOperation);

// Single page call:
listDashboards({ project_id: "123", limit: 10 })
// Returns: Effect<PaginatedDashboardList, ErrorType, Deps>

// Stream of pages:
listDashboards.pages({ project_id: "123", limit: 10 })
// Returns: Stream<PaginatedDashboardList, ErrorType, Deps>

// Stream of individual items (flattened across pages):
listDashboards.items({ project_id: "123", limit: 10 })
// Returns: Stream<unknown, ErrorType, Deps>
```

- Uses `Stream.unfoldEffect` for stateful page iteration
- Parses "next" URL to extract pagination token (offset or cursor)
- Stops when no "next" URL is present

### Pagination Token Parsing

The client extracts the next-page token from the response's `outputToken` field (a URL):

```typescript
// Response: { next: "https://api.example.com/items?offset=20&limit=10", results: [...] }
// parseNextToken extracts: offset=20
const url = new URL(nextUrl);
url.searchParams.get(pagination.inputToken); // "20"
```

This handles both offset-based (`?offset=20`) and cursor-based (`?cursor=abc123`) pagination.

## Retry Integration

```typescript
const resolveRetryPolicy = Effect.gen(function* () {
  const lastError = yield* Ref.make<unknown>(undefined);
  // Try to get Retry from context, fall back to makeDefault
  const policy = (yield* Effect.serviceOption(Retry)).pipe(
    Option.map((value) => typeof value === "function" ? value(lastError) : value),
    Option.getOrElse(() => makeDefault(lastError)),
  );
  return { lastError, policy };
});
```

Every `makeClient` / `makePaginated` call resolves the retry policy once, then wraps each HTTP execution:

```typescript
const withRetry = (effect, lastError, policy) =>
  pipe(
    effect,
    Effect.tapError((error) => Ref.set(lastError, error)),  // Track for retry-after
    policy.while
      ? Effect.retry(eff, { while: policy.while, schedule: policy.schedule })
      : identity,
  );
```

## Dependencies

All operations require three context dependencies:

```typescript
type Deps = HttpClient.HttpClient | Credentials | Endpoint;
```

- `HttpClient.HttpClient` — from `@effect/platform` (usually `FetchHttpClient.layer`)
- `Credentials` — from `./credentials.js`
- `Endpoint` — from `./endpoint.js`

## Adaptation Checklist

When copying the client/ directory for a new service:

1. [ ] Update import paths for `../credentials.js`, `../endpoint.js`, `../errors.js`, `../retry.js`, `../traits.js`
2. [ ] Change error type names (`PostHogError` → `ServiceError`)
3. [ ] Change auth header format if not Bearer token (see credentials reference)
4. [ ] The rest is fully generic — no changes needed
