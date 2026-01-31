# 07 — Retry Policy & Traits

Both of these files are **copied verbatim** from PostHog with only namespace changes.

## Canonical Reference

- `packages/posthog/src/retry.ts`
- `packages/posthog/src/traits.ts`

---

## retry.ts

**Copy verbatim from PostHog**, changing only the Context tag:

```diff
- export class Retry extends Context.Tag("@posthog/Retry")<Retry, Policy>() {}
+ export class Retry extends Context.Tag("@attio/Retry")<Retry, Policy>() {}
```

### Exports (unchanged)

```typescript
// Types
export interface Options {
  readonly while?: (error: unknown) => boolean;
  readonly schedule?: Schedule.Schedule<unknown>;
}
export type Factory = (lastError: Ref.Ref<unknown>) => Options;
export type Policy = Options | Factory;

// Context tag
export class Retry extends Context.Tag("@attio/Retry")<Retry, Policy>() {}

// Re-exports
export { isThrottlingError, isTransientError } from "./category.js";

// Default factory
export const makeDefault: Factory = (lastError) => ({
  while: (error) => isTransientError(error) || isThrottlingError(error),
  schedule: pipe(
    Schedule.exponential(100, 2),
    Schedule.modifyDelayEffect(/* respects retryAfter from RateLimitError */),
    Schedule.intersect(Schedule.recurs(5)),
    Schedule.jittered,
  ),
});

// Helpers
export const policy: (options: Options | Factory) => <A, E, R>(effect) => effect;
export const none: <A, E, R>(effect) => effect;   // Disables retry
export const transient: <A, E, R>(effect) => effect;
export const throttling: <A, E, R>(effect) => effect;
```

### Default Retry Behavior

- **What retries:** Transient errors (server, network, transport) and throttling errors (429)
- **What doesn't retry:** Auth errors, validation errors, not found errors, conflict errors
- **Schedule:** Exponential backoff starting at 100ms, 2x factor, max 5 retries, jittered
- **Retry-After:** When the last error is a throttling error with a `retryAfter` field, the delay is set to that value (in seconds). Minimum 500ms for throttling errors.

### Attio Rate Limits

| Type | Limit |
|---|---|
| Read | 100 requests/second |
| Write | 25 requests/second |

The `Retry-After` header is returned with 429 responses. The default retry factory reads this from the `RateLimitError.retryAfter` field.

---

## traits.ts

**Copy verbatim from PostHog**, changing only the symbol namespace prefix:

```diff
- const prefix = "distilled-posthog";
+ const prefix = "distilled-attio";
```

### Exports (unchanged)

**Property-level annotations** (applied via `.pipe()`):

| Annotation | Purpose | Example |
|---|---|---|
| `HttpLabel(name?)` | Path parameter | `S.String.pipe(T.HttpLabel())` |
| `HttpQuery(name)` | Query parameter | `S.optional(S.Number).pipe(T.HttpQuery("limit"))` |
| `HttpHeader(name)` | HTTP header | `S.String.pipe(T.HttpHeader("X-Custom"))` |
| `HttpPayload()` | Raw body | `S.Unknown.pipe(T.HttpPayload())` |
| `HttpResponseCode()` | Status code binding | (rarely used) |

**Class-level annotations** (applied as second arg to `S.Class()`):

| Annotation | Purpose | Example |
|---|---|---|
| `Http({ method, uri })` | HTTP method + URI template | `T.Http({ method: "GET", uri: "/v2/objects" })` |
| `RestJsonProtocol()` | Protocol marker | `T.RestJsonProtocol()` |

**Serialization annotations:**

| Annotation | Purpose |
|---|---|
| `JsonName(name)` | Custom JSON key name |
| `TimestampFormat(format)` | Date serialization format |

**Combiners:**

| Function | Purpose |
|---|---|
| `all(...annotations)` | Merge multiple annotations into one |

**Helpers:**

| Function | Purpose |
|---|---|
| `getHttpTrait(ast)` | Extract Http annotation from schema AST |
| `getHttpHeader(prop)` | Get header name from property |
| `getHttpQuery(prop)` | Get query param name from property |
| `hasHttpLabel(prop)` | Check if property is a path label |
| `hasHttpPayload(prop)` | Check if property is a raw payload |
| `getPath(obj, path)` | Safe dynamic property access (for pagination) |

### Usage in Attio Services

```typescript
export class QueryRecordsRequest extends S.Class<QueryRecordsRequest>("QueryRecordsRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),           // → /v2/objects/{object}/...
    filter: S.optional(S.Unknown),                   // → JSON body
    limit: S.optional(S.Number),                     // → JSON body (no HttpQuery = body)
    offset: S.optional(S.Number),                    // → JSON body
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/objects/{object}/records/query" }),
    T.RestJsonProtocol()
  )
) {}
```

Note: For POST-body pagination (records, entries), `limit` and `offset` are NOT annotated with `T.HttpQuery()` — they go into the JSON body automatically.
