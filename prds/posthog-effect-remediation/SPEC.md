# PostHog SDK Effect TS Remediation

**Status**: P0–P3 Complete, P4 In Design
**Created**: 2026-01-28
**Updated**: 2026-01-28
**Owner**: Platform Team
**Priority**: High
**Epic**: distilled-posthog
**Branch**: feat/distilled-posthog

---

## 1. Overview

### 1.1 Purpose

Bring `packages/posthog` into full compliance with Effect TS best practices and alignment with the `distilled-aws` reference architecture. Eliminate all type assertions, replace vanilla JS patterns with Effect primitives, fix a critical test cleanup bug, and add missing structural features (pagination, error categories, shared schemas).

### 1.2 Problem Statement

The PostHog SDK is functional (226 tests passing after P0-P3) but had / has:

1. ~~**75+ type assertions** (`as`, `!`) that bypass type safety~~ ✅ Resolved (P1)
2. ~~**30+ `S.Unknown` escape hatches** in service schemas~~ ✅ Resolved (P1), ~35 deep polymorphic S.Unknown remain (justified)
3. ~~**A critical `Effect.ensuring` bug**~~ ✅ Resolved (P0)
4. ~~**Vanilla JS patterns** (async/await, try/catch, instanceof, console.log, mutable let)~~ ✅ Resolved (P1-P2)
5. ~~**No pagination support**~~ ✅ Basic pagination added (P2), generic pagination pending (P4-007)
6. ~~**Duplicated schemas**~~ ✅ Resolved (P1-001)
7. ~~**No error categories**~~ ✅ Resolved (P2-003), transport/network categories pending (P4-005, P4-009)

**Remaining distilled-aws divergences (P4):**

8. **No lazy init caching** — `makeRequestBuilder` rebuilds schema AST on every API call
9. **No debug logging** — distilled-aws has 4 `Effect.logDebug` calls at key transformation points
10. **5 inconsistent delete operations** — using soft-delete workaround instead of true HTTP DELETE
11. **Generic `S.Record` for feature-flag filters** — `FeatureFlagFilters` schema exists but isn't used in create/update
12. **No transport error detection** — `isTransientError` misses `@effect/platform` `RequestError` with `reason: 'Transport'`
13. **No retry factory pattern** — static `Options` only, no `Ref`-based retry-after support
14. **Hardcoded pagination** — uses PostHog-specific field names instead of `Operation.pagination` metadata
15. **Empty per-operation error arrays** — all operations define `errors: []` instead of typed error lists

### 1.3 Solution

Systematic remediation across five priority tiers:

- **P0 (Critical):** Fix the `Effect.ensuring` cleanup bug using `Effect.suspend` or `Effect.acquireUseRelease`
- **P1 (High):** Eliminate `S.Unknown`, remove avoidable type assertions, convert `parseJsonBody` to Effect
- **P2 (Medium):** Add error categories, deduplicate schemas, add pagination, replace `instanceof`/`console.log`
- **P3 (Low):** Tree-shaking annotations, explicit operation signatures, convert raw interfaces to Schema
- **P4 (Alignment):** Close remaining distilled-aws divergences — lazy init, debug logging, generic pagination, retry factory, per-operation errors, transport error detection, delete trait fixes

### 1.4 Scope

**In Scope:**
- All source files in `packages/posthog/src/`
- All test files in `packages/posthog/test/`
- `packages/posthog/scripts/provision-analytics.ts`
- PostHog OpenAPI schema at `schema.yaml` (for `S.Unknown` replacement)

**Out of Scope:**
- New PostHog service implementations (e.g. session recordings, data pipelines)
- Changes to the `distilled-aws` reference itself
- UI or application-level consumers of the SDK

---

## 2. Architecture

### 2.1 Package Structure (unchanged)

```
packages/posthog/
  src/
    client/         # HTTP client, request builder, response parser
    services/       # 11 service files
    index.ts        # Package exports
    common.ts       # NEW: Shared schemas (UserBasic, Tags, etc.)
    credentials.ts  # Effect Config-based API key
    endpoint.ts     # Context.Tag for API URL
    errors.ts       # S.TaggedError classes + error categories
    retry.ts        # Retry policies (Context.Tag)
    traits.ts       # HTTP annotation traits
  test/
    test.ts         # Test helper with withResource combinator
    *.test.ts       # Per-service integration tests
  scripts/
    provision-analytics.ts
```

### 2.2 Key Patterns (from distilled-aws)

| Concern | Pattern | Status |
|---|---|---|
| Service functions | Top-level exported `const`, `API.make()` with `/*@__PURE__*/` | ✅ Done (P3-001) |
| Dependencies | `Context.Tag` for Credentials, Endpoint, Retry, HttpClient | ✅ Done |
| Schemas | `S.Class` (our modern pattern) or `interface + S.Struct + cast` (distilled-aws) | ✅ Done |
| Errors | `S.TaggedError` + category decoration via prototype | ✅ Done (P2-003) |
| Retry | `Context.Tag<Retry, Options>`, predicate-based with exponential backoff | ✅ Static; Factory pending (P4-006) |
| Pagination | `Stream.unfoldEffect` with `.pages()` / `.items()` | ✅ Basic; Generic pending (P4-007) |
| HTTP | `@effect/platform` HttpClient as context dependency | ✅ Done |
| Traits | Symbol-based annotations on Schema AST, composable via `T.all()` | ✅ Done |
| Lazy init | `??=` caching of request/response builders per operation | ⬜ Pending (P4-001) |
| Debug logging | `Effect.logDebug` at 4 transformation points in `execute()` | ⬜ Pending (P4-002) |
| Transport errors | `isHttpClientTransportError` + inclusion in `isTransientError` | ⬜ Pending (P4-005) |
| Per-op errors | Typed error arrays on each operation definition | ⬜ Pending (P4-008) |

### 2.3 Error Category System (implemented)

The category system is implemented in `src/category.ts` with 5 categories and prototype-based decoration:

```typescript
// src/category.ts
export const categoriesKey = "@posthog/error/categories";

export const withCategory = <Categories extends Array<Category>>(...categories: Categories) =>
  <C extends { new (...args: any[]): any }>(C: C): C => {
    for (const category of categories) {
      C.prototype[categoriesKey] ??= {};
      C.prototype[categoriesKey][category] = true;
    }
    return C;
  };

// Decorators: withThrottlingError, withServerError, withAuthError, withValidationError, withNotFoundError
// Predicates: isThrottlingError, isServerError, isAuthError, isValidationError, isNotFoundError
// Composite: isTransientError = isThrottlingError || isServerError
// Catchers: catchThrottlingError, catchServerError, catchAuthError, catchValidationError, catchNotFoundError, catchErrors
```

**P4-005 Extension:** Add `isHttpClientTransportError` predicate for `@effect/platform` transport errors and include it in `isTransientError`.

**P4-009 Extension:** Add `NetworkError` and `TimeoutError` categories for transport-level failures.

### 2.4 Pagination (implemented, P4-007 planned)

Current implementation uses `Stream.unfoldEffect` with hardcoded PostHog conventions:

```typescript
// src/client/api.ts (current)
export const makePaginated = <Op extends Operation>(operation: Op) => {
  // Hardcoded: page.next for token, page.results for items, offset for input
  const parseNextOffset = (nextUrl: string): Option<number> => { /* parse offset from URL */ };
  // .pages(input) and .items(input) via Stream.unfoldEffect
};
```

**P4-007 Refactor:** Adopt distilled-aws generic pagination using `Operation.pagination` metadata:

```typescript
// src/client/api.ts (planned)
export const makePaginated = <Op extends Operation>(operation: Op) => {
  const { inputToken, outputToken, items: itemsKey } = operation.pagination!;
  // Generic: parseNextToken(url, inputToken) for both offset and cursor
  // Generic: page[outputToken] for next URL, page[itemsKey] for items
};

// Per-service operation definitions:
// Offset-based (dashboards, cohorts, etc.):
//   pagination: { inputToken: "offset", outputToken: "next", items: "results", pageSize: "limit" }
// Cursor-based (events):
//   pagination: { inputToken: "cursor", outputToken: "next", items: "results" }
```

PostHog uses two pagination patterns — offset-based (55+ endpoints) and cursor-based (16+ endpoints, including events). Both return `next` as a full URL string. See RESEARCH.md §17.

### 2.5 Lazy Init Caching (P4-001, planned)

Cache `makeRequestBuilder` and `makeResponseParser` per operation to avoid rebuilding schema AST on every request:

```typescript
// src/client/api.ts (planned, matching distilled-aws lines 26-70)
export const makeClient = <Op extends Operation>(operation: Op) => {
  let _init: { buildRequest: RequestBuilder; parseResponse: ResponseParser } | undefined;
  const init = () => (_init ??= {
    buildRequest: /* cached makeRequestBuilder result */,
    parseResponse: makeResponseParser(operation),
  });

  return (input: Input) => Effect.gen(function* () {
    const { buildRequest, parseResponse } = init();
    // ... use cached builders — zero AST traversal after first call
  });
};
```

### 2.6 Debug Logging (P4-002, planned)

Add 4 `Effect.logDebug` calls at key transformation points matching distilled-aws:

```typescript
// src/client/api.ts execute() (planned)
yield* Effect.logDebug("Payload").pipe(Effect.annotateLogs("input", input));
yield* Effect.logDebug("Built Request").pipe(Effect.annotateLogs("request", request));
yield* Effect.logDebug("Raw Response").pipe(Effect.annotateLogs("status", status));
yield* Effect.logDebug("Parsed Response").pipe(Effect.annotateLogs("result", result));
```

Zero runtime cost unless a debug-level log layer is provided. Do NOT log credentials or Authorization headers.

### 2.7 Retry Factory (P4-006, planned)

Add Factory pattern with `Ref` for retry-after header support:

```typescript
// src/retry.ts (planned, matching distilled-aws)
export type Factory = (lastError: Ref.Ref<unknown>) => Options;
export type Policy = Options | Factory;

export const makeDefault: Factory = (lastError) => ({
  while: isTransientError,
  schedule: pipe(
    Schedule.exponential(Duration.millis(100), 2),
    Schedule.modifyDelayEffect(Effect.fnUntraced(function* (duration) {
      const error = yield* lastError;
      // Read retryAfter from RateLimitError
      if (isThrottlingError(error) && hasRetryAfter(error)) {
        return Duration.toMillis(Duration.seconds(error.retryAfter));
      }
      return Duration.toMillis(duration);
    })),
    Schedule.intersect(Schedule.recurs(5)),
    Schedule.jittered,
  ),
});
```

In `execute()`, creates `Ref.make<unknown>(undefined)`, resolves policy from context, wraps with `Effect.tapError` + `Effect.retry`.

---

## 3. Functional Requirements

### 3.1 Type Assertion Elimination

- **Source files:** Remove 27 avoidable `as` casts (traits.ts casts matching distilled-aws pattern are acceptable)
- **Test files:** Remove 48 `as` casts via typed error narrowing helpers and proper assertions
- **Scripts:** Remove 32 assertions from `provision-analytics.ts` via typed arrays and `Option`

### 3.2 Effect Primitive Adoption

- Convert `parseJsonBody` from `async/await` to Effect with Stream primitives
- Replace `throw new Error(...)` with `Effect.fail(new TaggedError(...))`
- Replace `instanceof` with `_tag` discriminant checks
- Replace `console.log` with `Effect.log` inside Effect contexts
- Replace mutable `let` with `Ref` where inside Effect pipelines
- Replace `if/else` chains on `_tag` with `Match.type`

### 3.3 Schema Completeness

- Define proper schemas for all 30+ fields currently using `S.Unknown`
- Reference `schema.yaml` (77k line OpenAPI spec) for field definitions
- Extract `UserBasic` and `Tags` to `src/common.ts`

### 3.4 Test Infrastructure

- Fix `Effect.ensuring` bug in 30 test blocks across 8 files
- Add `withResource` combinator for create/assert/cleanup lifecycle
- Deduplicate `.env` config resolution (3 copies -> 1)

### 3.5 distilled-aws Alignment (P4)

- **P4-001: Lazy init caching** — Cache `makeRequestBuilder`/`makeResponseParser` per operation using `??=` pattern
- **P4-002: Debug logging** — Add 4 `Effect.logDebug` calls in `execute()` at input/request/response/result points
- **P4-003: Delete trait fixes** — Fix 5 services using soft-delete workaround to use true HTTP DELETE with proper `T.Http()` traits (dashboards, feature-flags, actions, cohorts, insights)
- **P4-004: Filter schema reuse** — Use `FeatureFlagFilters` schema in create/update request `filters` field instead of generic `S.Record`
- **P4-005: Transport error detection** — Add `isHttpClientTransportError` predicate for `@effect/platform` `RequestError` with `reason: 'Transport'`; include in `isTransientError`
- **P4-006: Retry factory** — Add `Factory = (lastError: Ref<unknown>) => Options` pattern with retry-after header support
- **P4-007: Generic pagination** — Move from hardcoded `next`/`results`/`offset` to `Operation.pagination` metadata; support both offset-based and cursor-based pagination
- **P4-008: Per-operation errors** — Replace empty `errors: []` with `COMMON_ERRORS` (and `NotFoundError` for get/update/delete) on all operation definitions
- **P4-009: New error categories** — Add `NetworkError` and `TimeoutError` categories to the category system
- **P4-010: Cast elimination** — Remove 3 remaining `as` casts in `makePaginated` via proper generic constraints

---

## 4. Non-Functional Requirements

### 4.1 Verification

Every task must pass:
1. `bun run test` -- all 224+ tests pass
2. `npx tsc --noEmit` -- 0 type errors
3. No new type assertions introduced

### 4.2 Backwards Compatibility

- All existing service function signatures must remain unchanged
- Schema changes must be additive (new fields optional or with defaults)
- Test behaviour must be preserved

---

## 5. Effect TS Patterns Applied

### 5.1 Error Handling

```typescript
// Tagged errors with category decoration
export class RateLimitError extends S.TaggedError<RateLimitError>()(
  "RateLimitError",
  { message: S.optional(S.String), statusCode: S.optional(S.Number) },
).pipe(withCategory("throttling")) {}
```

### 5.2 Typed Test Helpers

```typescript
// withResource combinator replaces mutable let + ensuring
const withResource = <A extends { id: number }>(
  create: Effect.Effect<A, unknown, Provided>,
  destroy: (id: number) => Effect.Effect<void, unknown, Provided>,
  test: (resource: A) => Effect.Effect<void, unknown, Provided>,
) => Effect.acquireUseRelease(
  create,
  test,
  (r) => destroy(r.id).pipe(Effect.catchAll(() => Effect.void)),
);
```

### 5.3 Option for Nullable Values

```typescript
// Instead of: value !== undefined ? fn(value) : default
Option.fromNullable(value).pipe(
  Option.map(fn),
  Option.getOrElse(() => default),
)
```

### 5.4 Match for Tag Dispatch

```typescript
// Instead of: if (ast._tag === "Suspend") ... else if ...
Match.value(ast).pipe(
  Match.when({ _tag: "Suspend" }, (s) => handleSuspend(s)),
  Match.when({ _tag: "Union" }, (u) => handleUnion(u)),
  Match.when({ _tag: "Transformation" }, (t) => handleTransformation(t)),
  Match.orElse(() => fallback),
)
```

### 5.5 Transport Error Detection

```typescript
// src/category.ts — detect @effect/platform transport failures
export const isHttpClientTransportError = (error: unknown): boolean =>
  Predicate.isObject(error) &&
  '_tag' in error && error._tag === 'RequestError' &&
  'reason' in error && error.reason === 'Transport';

// Updated composite predicate
export const isTransientError = (error: unknown): boolean =>
  isThrottlingError(error) || isServerError(error) ||
  isHttpClientTransportError(error) || isNetworkError(error);
```

### 5.6 Per-Operation Error Arrays

```typescript
// src/services/dashboards.ts — typed error arrays per operation
import { COMMON_ERRORS, NotFoundError } from "../errors.js";

const listDashboardsOperation: Operation = {
  input: ListDashboardsRequest,
  output: PaginatedDashboardList,
  errors: [...COMMON_ERRORS],  // no NotFoundError for lists
};

const getDashboardOperation: Operation = {
  input: GetDashboardRequest,
  output: Dashboard,
  errors: [...COMMON_ERRORS, NotFoundError],  // 404 possible for get-by-id
};
```

### 5.7 True DELETE Operations

```typescript
// Pattern for all 5 services needing delete trait fixes
export class DeleteDashboardRequest extends S.Class<DeleteDashboardRequest>(
  "DeleteDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "DELETE", uri: "/api/environments/{project_id}/dashboards/{id}/" }),
    T.RestJsonProtocol()
  )
) {}

const VoidResponse = S.Struct({});
const deleteDashboardOperation: Operation = {
  input: DeleteDashboardRequest,
  output: VoidResponse,
  errors: [...COMMON_ERRORS, NotFoundError],
};
```

### 5.8 Generic Pagination with Operation Metadata

```typescript
// src/client/api.ts — generic parseNextToken replaces parseNextOffset
const parseNextToken = (nextUrl: string, paramName: string): Option.Option<string> => {
  try {
    const url = new URL(nextUrl);
    return Option.fromNullable(url.searchParams.get(paramName));
  } catch {
    return Option.none();
  }
};

// Per-service operation metadata (offset-based)
const listDashboardsOperation: Operation = {
  input: ListDashboardsRequest,
  output: PaginatedDashboardList,
  errors: [...COMMON_ERRORS],
  pagination: { inputToken: "offset", outputToken: "next", items: "results", pageSize: "limit" },
};

// Per-service operation metadata (cursor-based, events)
const listEventsOperation: Operation = {
  input: ListEventsRequest,
  output: PaginatedEventList,
  errors: [...COMMON_ERRORS],
  pagination: { inputToken: "cursor", outputToken: "next", items: "results" },
};
```

---

## 6. Verification Commands

```bash
cd packages/posthog

# Type check
npx tsc --noEmit

# Tests
bun run test

# Single service
bun run test test/dashboards.test.ts

# Provisioning script (verify no runtime errors)
bun run scripts/provision-analytics.ts
```
