# PostHog SDK Effect TS Remediation

**Status**: Design Complete - Ready for Implementation
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

The PostHog SDK is functional (224 tests passing) but has:

1. **75+ type assertions** (`as`, `!`) that bypass type safety
2. **30+ `S.Unknown` escape hatches** in service schemas instead of proper typed schemas
3. **A critical `Effect.ensuring` bug** where cleanup never runs on test failure (eager evaluation)
4. **Vanilla JS patterns** (async/await, try/catch, instanceof, console.log, mutable let) where Effect primitives should be used
5. **No pagination support** -- distilled-aws provides `.pages()` / `.items()` via `Stream.unfoldEffect`
6. **Duplicated schemas** -- `UserBasic` defined identically in 8 files
7. **No error categories** -- distilled-aws decorates errors with `withThrottlingError`, `isTransientError`, etc.

### 1.3 Solution

Systematic remediation across four priority tiers:

- **P0 (Critical):** Fix the `Effect.ensuring` cleanup bug using `Effect.suspend` or `Effect.acquireUseRelease`
- **P1 (High):** Eliminate `S.Unknown`, remove avoidable type assertions, convert `parseJsonBody` to Effect
- **P2 (Medium):** Add error categories, deduplicate schemas, add pagination, replace `instanceof`/`console.log`
- **P3 (Low):** Tree-shaking annotations, explicit operation signatures, convert raw interfaces to Schema

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

| Concern | Pattern |
|---|---|
| Service functions | Top-level exported `const`, `API.make()` with `/*@__PURE__*/` |
| Dependencies | `Context.Tag` for Credentials, Endpoint, Retry, HttpClient |
| Schemas | `S.Class` (our modern pattern) or `interface + S.Struct + cast` (distilled-aws) |
| Errors | `S.TaggedError` + category decoration via prototype |
| Retry | `Context.Tag<Retry, Options>`, predicate-based with exponential backoff |
| Pagination | `Stream.unfoldEffect` with `.pages()` / `.items()` |
| HTTP | `@effect/platform` HttpClient as context dependency |
| Traits | Symbol-based annotations on Schema AST, composable via `T.all()` |

### 2.3 Error Category System (new)

```typescript
// src/errors.ts -- new category system matching distilled-aws
const categorySymbol = Symbol.for("@posthog/error/categories");

type ErrorCategory = "throttling" | "server" | "auth" | "validation" | "notFound";

export const withCategory = (category: ErrorCategory) =>
  <T extends new (...args: any[]) => any>(errorClass: T): T => {
    const existing: ErrorCategory[] = (errorClass.prototype as any)[categorySymbol] ?? [];
    (errorClass.prototype as any)[categorySymbol] = [...existing, category];
    return errorClass;
  };

export const isThrottlingError = (error: unknown): boolean =>
  hasCategory(error, "throttling");

export const isTransientError = (error: unknown): boolean =>
  isThrottlingError(error) || hasCategory(error, "server");
```

### 2.4 Pagination (new)

```typescript
// src/client/api.ts -- pagination via Stream
export const makePaginated = <I, O, E>(op: Operation<I, O, E>) => {
  const fn = make(op);
  return Object.assign(fn, {
    pages: (input: I) => Stream.unfoldEffect(input, (cursor) =>
      fn(cursor).pipe(
        Effect.map(page => page.next
          ? Option.some([page, { ...cursor, offset: nextOffset }] as const)
          : Option.some([page, undefined] as const)
        )
      )
    ),
    items: (input: I) => fn.pages(input).pipe(
      Stream.mapConcat(page => page.results)
    ),
  });
};
```

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
