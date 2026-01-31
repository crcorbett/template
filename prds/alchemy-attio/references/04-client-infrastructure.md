# 04 — Client Infrastructure

The `client/` directory contains the HTTP execution engine. Most files are **copied verbatim** from PostHog. This reference documents the two files that require modification.

## Canonical Reference

- `packages/posthog/src/client/api.ts`
- `packages/posthog/src/client/operation.ts`
- `packages/posthog/src/client/request.ts`
- `packages/posthog/src/client/request-builder.ts`
- `packages/posthog/src/client/response.ts`
- `packages/posthog/src/client/response-parser.ts`

## Files Copied Verbatim

| File | Changes |
|---|---|
| `src/client/request.ts` | None |
| `src/client/response.ts` | None |
| `src/client/request-builder.ts` | Change error import: `MissingHttpTraitError` from `"../errors.js"` |

## operation.ts — Extended with `mode`

The `Operation.pagination` interface gains an optional `mode` field to support Attio's pagination patterns:

```typescript
export interface Operation {
  input: S.Schema.AnyNoContext;
  output: S.Schema.AnyNoContext;
  errors?: readonly S.Schema.AnyNoContext[];
  pagination?: {
    inputToken: string;
    outputToken?: string;   // Made optional (not needed for offset mode)
    items?: string;
    pageSize?: string;
    mode?: "url" | "offset" | "cursor";  // NEW
  };
}

export interface PaginatedOperation extends Operation {
  pagination: NonNullable<Operation["pagination"]>;
}
```

### Pagination Modes

| Mode | Behavior | Used by |
|---|---|---|
| `"url"` (default) | Parse `outputToken` value as a URL, extract `inputToken` query param from it. PostHog's existing behavior. | PostHog services (backwards compatible) |
| `"offset"` | Auto-increment offset by items returned. Stop when `items.length < limit` or `items.length === 0`. No `outputToken` needed. | Attio records query, entries query, notes, tasks, webhooks |
| `"cursor"` | Read `outputToken` path from response directly as a string (not parsed as URL). Stop when value is `null`/`undefined`/empty. | Attio meetings, call recordings |

## response-parser.ts — Attio Adaptations

The response parser is structurally identical to PostHog's. Changes:

### 1. Import Path

```diff
- import { PostHogError, type PostHogErrorType } from "../errors.js";
+ import { AttioError, type AttioErrorType } from "../errors.js";
```

### 2. Error Construction

All `new PostHogError(...)` become `new AttioError(...)`. The error fields are the same (`code`, `message`, `details`).

### 3. getErrorMessage

Attio errors consistently use the `message` field. The existing `getErrorMessage` function already checks `message` first, so it works as-is. The function tries: `message`, `error`, `detail`, `details`, `error_description`, `error.message` — all of which are reasonable fallbacks.

### 4. No Envelope Unwrapping

The response parser does NOT strip the `{ "data": ... }` envelope. Output schemas include the envelope explicitly (e.g., `ObjectList` has a `data` field). This keeps the parser generic and consistent with PostHog's approach.

## api.ts — Attio Adaptations

### 1. Import Paths

```diff
- import { PostHogError, type PostHogErrorType } from "../errors.js";
+ import { AttioError, type AttioErrorType } from "../errors.js";
```

All type references change: `PostHogErrorType` → `AttioErrorType`, `PostHogError` → `AttioError`.

### 2. Pagination — Three-Mode Support

The core change is in `makePaginated`. The `pages` function now dispatches on `pagination.mode`:

```typescript
const pages = (input: Input): Stream.Stream<Output, AttioErrorType, Deps> => {
  const mode = pagination.mode ?? "url";

  const initialState: PaginationState<Input> = {
    payload: input,
    token: undefined,
    done: false,
  };

  return Stream.unfoldEffect(initialState, (state) => {
    if (state.done) {
      return Effect.succeed(Option.none());
    }

    // Build request with pagination token
    const requestPayload: Input =
      state.token !== undefined
        ? { ...state.payload, [pagination.inputToken]: state.token }
        : state.payload;

    return fn(requestPayload).pipe(
      Effect.map((page) => {
        let nextState: PaginationState<Input>;

        if (mode === "offset") {
          // ── Offset mode ──
          // Auto-increment offset by items returned.
          // Stop when items.length < limit or items.length === 0.
          const itemsKey = pagination.items ?? "data";
          const itemsArray = getPath(page, itemsKey);
          const items = Array.isArray(itemsArray) ? itemsArray : [];

          const pageSizeKey = pagination.pageSize;
          const requestedLimit = pageSizeKey
            ? Number((requestPayload as Record<string, unknown>)[pageSizeKey])
            : undefined;

          const currentOffset = state.token !== undefined
            ? Number(state.token)
            : Number(
                (state.payload as Record<string, unknown>)[pagination.inputToken]
              ) || 0;
          const nextOffset = currentOffset + items.length;

          const isDone =
            items.length === 0 ||
            (requestedLimit !== undefined && items.length < requestedLimit);

          nextState = isDone
            ? { payload: state.payload, token: undefined, done: true }
            : { payload: state.payload, token: String(nextOffset), done: false };

        } else if (mode === "cursor") {
          // ── Cursor mode ──
          // Read outputToken path from response as a direct string value.
          // Stop when null/undefined/empty.
          const nextCursor = pagination.outputToken
            ? getPath(page, pagination.outputToken)
            : undefined;

          nextState =
            nextCursor != null && typeof nextCursor === "string" && nextCursor !== ""
              ? { payload: state.payload, token: nextCursor, done: false }
              : { payload: state.payload, token: undefined, done: true };

        } else {
          // ── URL mode (PostHog default) ──
          // Parse outputToken value as a URL, extract inputToken query param.
          const nextUrl = pagination.outputToken
            ? getPath(page, pagination.outputToken)
            : undefined;
          const nextTokenValue =
            typeof nextUrl === "string"
              ? parseNextToken(nextUrl, pagination.inputToken)
              : Option.none<string>();

          nextState = Option.match(nextTokenValue, {
            onNone: () => ({
              payload: state.payload,
              token: undefined,
              done: true,
            }),
            onSome: (token) => ({
              payload: state.payload,
              token,
              done: false,
            }),
          });
        }

        return Option.some([page, nextState] as const);
      })
    );
  });
};
```

### 3. Items Key Default

PostHog defaults `items` to `"results"`. Attio uses `"data"`:

```typescript
const items = (input: Input): Stream.Stream<unknown, AttioErrorType, Deps> => {
  const itemsKey = pagination.items ?? "data";  // Changed from "results"
  return pages(input).pipe(
    Stream.mapConcat((page) => {
      const itemsArray = getPath(page, itemsKey);
      return Array.isArray(itemsArray) ? itemsArray : [];
    })
  );
};
```

### 4. Live Layer

```typescript
export const AttioClientLive = Layer.mergeAll(
  Credentials.fromEnv(),
  Layer.succeed(Endpoint, Endpoint.DEFAULT)
);
```

## Architecture Flow (Same as PostHog)

```
Service function call (e.g., queryRecords({ object: "people", limit: 10 }))
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
    │  Wraps execution with retry logic
    │
    ▼
Result: Effect<Output, AttioErrorType, Deps>
```

## Dependencies

All operations require three context dependencies:

```typescript
type Deps = HttpClient.HttpClient | Credentials | Endpoint;
```
