# PostHog SDK Effect TS Audit

**Date:** 2026-01-28
**Scope:** Full audit of `packages/posthog` against Effect TS best practices and the `distilled-aws` reference architecture.
**Current state:** 224 tests passing, 17 test files, 0 type errors.

---

## Executive Summary

The PostHog SDK is functional and well-tested but has significant gaps when measured against Effect TS idioms and the `distilled-aws` reference. The primary issues are:

1. **75+ type assertions** (`as`, `!`) across source and test files
2. **30+ `S.Unknown` escape hatches** in service schemas instead of proper typed schemas
3. **A critical bug** in the `Effect.ensuring` cleanup pattern across all CRUD tests
4. **Vanilla JS patterns** (if/else, instanceof, try/catch, async/await, console.log) where Effect primitives should be used
5. **Structural divergences** from `distilled-aws` patterns (schema definition style, error categories, operation signatures)

---

## 1. Type Assertions Inventory

### Source files: 28 assertions

| File | Count | Nature |
|---|---|---|
| `src/traits.ts` | 20 | `as A`, `as unknown as Record<symbol, unknown>`, `as T \| undefined` on AST annotations |
| `src/client/response-parser.ts` | 3 | `JSON.parse(text) as unknown`, `errorBody as Record<string, unknown>` |
| `src/client/request-builder.ts` | 3 | `as AST.PropertySignature[]`, `input as Record<string, unknown>`, `getHttpQuery(prop)!` |
| `src/client/api.ts` | 1 | `platformResponse.headers as Record<string, string>` |
| `src/errors.ts` | 1 | `as const` (benign) |

### Test files: 48 assertions

| File | Count | Nature |
|---|---|---|
| `test/client/response-parser.test.ts` | 26 | `(error as PostHogError).code` / `.message` / `.details` repeated on every error assertion |
| `test/traits.test.ts` | 12 | `as AST.TypeLiteral`, `as T.HttpTrait`, `as unknown as` double-casts |
| `test/client/request-builder.test.ts` | 3 | `JSON.parse(request.body as string)` |
| `test/credentials.test.ts` | 1 | `(error as Error).message` |
| `scripts/provision-analytics.ts` | 32 | 7x `as { id: number; name: string }[]`, 25x `.name!` / `.content!` non-null assertions |

### Comparison with distilled-aws

`distilled-aws` uses `as any as S.Schema<T>` on every schema definition (hundreds of occurrences). This is an intentional pattern to cast from complex inferred schema types to clean interface-typed schemas. Our `traits.ts` assertions follow a similar rationale. However, our test files and response-parser contain **avoidable** assertions that distilled-aws does not have.

**Recommendation:** The `traits.ts` assertions are acceptable (matching distilled-aws). The test file assertions must be eliminated via proper typed error narrowing and typed test helpers.

---

## 2. Vanilla JS Patterns Requiring Effect Primitives

### 2a. `async/await` + `try/catch` in `response-parser.ts`

`parseJsonBody` (lines 19-52) is a raw `async function` with `while(true)` stream reading and `try/catch` around `JSON.parse`. This should be an `Effect` using `Stream.fromReadableStream` and `Effect.try`.

```typescript
// CURRENT (vanilla)
async function parseJsonBody(response: Response): Promise<unknown> {
  // ... while(true) loop with await reader.read() ...
  try { return JSON.parse(text) } catch { ... }
}

// SHOULD BE (Effect)
const parseJsonBody = (response: Response) =>
  Effect.gen(function* () {
    // ... Stream.fromReadableStream + Stream.runCollect ...
    return yield* Effect.try({ try: () => JSON.parse(text), catch: ... })
  })
```

### 2b. Synchronous `throw` in `request-builder.ts`

Line 129: `throw new Error("No HTTP trait found on input schema")` -- should be `Effect.fail()` with a tagged error.

### 2c. Plain `Error` in `credentials.ts`

Line 37: `new Error("POSTHOG_API_KEY environment variable is not set")` -- should be a `TaggedError` like `MissingCredentialsError`.

### 2d. `instanceof` checks in `retry.ts`

Lines 18, 25: `error instanceof RateLimitError` / `error instanceof ServerError`. Since these are `S.TaggedError` types, checking `_tag` alone is idiomatic. `instanceof` is fragile across module boundaries.

### 2e. `if/else` chains in `traits.ts`

Lines 264-285 and 290-321: `if (ast._tag === "Suspend") ... else if (ast._tag === "Union") ...` -- prime candidates for `Match.type`.

### 2f. `console.log` inside Effect contexts

- `saas-analytics-setup.test.ts:1286-1295` -- raw `console.log` inside `Effect.gen`
- `provision-analytics.ts` -- 40+ `console.log` calls inside an Effect program

Should use `Effect.log` or `Console.log` from `effect/Console`.

### 2g. Mutable `let` variables

6 occurrences in source files (`response-parser.ts`, `api.ts`, `request-builder.ts`, `traits.ts`). Effect programs should prefer `Ref` or pipeline composition.

---

## 3. Schema & Type Issues

### 3a. `S.Unknown` escape hatches (30+ fields)

Service schemas use `S.Unknown` as a placeholder for complex nested objects instead of defining proper schemas:

| Service | Fields using `S.Unknown` |
|---|---|
| `surveys.ts` | `questions`, `appearance` |
| `experiments.ts` | `parameters`, `secondary_metrics`, `filters`, `metrics`, `metrics_secondary`, `stats_config` |
| `actions.ts` | `properties`, `tags` |
| `cohorts.ts` | `groups`, `filters`, `query` |
| `feature-flags.ts` | `filters`, `experiment_set`, `surveys`, `features`, `rollback_conditions`, `tags` |
| `insights.ts` | `query`, `result`, `hasMore`, `columns`, `filters`, `tags` |
| `dashboards.ts` | `layouts`, `insight`, `text`, `filters`, `tags` |
| `persons.ts` | `properties` |
| `events.ts` | `properties`, `person`, `elements` |

**Comparison:** `distilled-aws` defines complete schemas for every nested structure. No `S.Unknown` usage.

### 3b. Raw TypeScript interfaces that should be Schema

| File | Interface | Assessment |
|---|---|---|
| `src/client/request.ts` | `Request` | Should be Schema |
| `src/client/response.ts` | `Response` | Should be Schema |
| `src/client/operation.ts` | `Operation` | Should be Schema |
| `src/traits.ts` | `HttpTrait`, `PostHogServiceTrait`, `PaginatedTrait` | Should be Schema |
| `src/credentials.ts` | `PostHogCredentials` | Acceptable (Context config) |
| `src/retry.ts` | `Options` | Acceptable (Context config) |

### 3c. Duplicated `UserBasic` schema

`UserBasic` is identically defined in 8 service files: `surveys.ts`, `experiments.ts`, `annotations.ts`, `actions.ts`, `cohorts.ts`, `insights.ts`, `feature-flags.ts`, `dashboards.ts`. Should be in a shared `src/common.ts`.

### 3d. Schema definition style vs distilled-aws

**distilled-aws pattern:**
```typescript
export interface SendMessageRequest { QueueUrl: string; MessageBody: string; }
export const SendMessageRequest = S.suspend(() =>
  S.Struct({ QueueUrl: S.String, MessageBody: S.String })
    .pipe(T.all(T.Http({ method: "POST", uri: "/" }), svc, auth, proto))
).annotations({ identifier: "SendMessageRequest" }) as any as S.Schema<SendMessageRequest>;
```

**Our pattern:**
```typescript
export class Dashboard extends S.Class<Dashboard>("Dashboard")({ id: S.Number, name: S.String, ... }) {}
```

We use `S.Class` which is idiomatic Effect but diverges from distilled-aws's `interface + S.Struct + S.suspend + as any as S.Schema<T>` pattern. Both are valid, but `S.Class` is actually more modern and provides both the type and runtime constructor. **No change needed here** -- `S.Class` is preferred for new code.

---

## 4. Critical Bug: `Effect.ensuring` Cleanup Pattern

### The problem

Every CRUD test uses this pattern:

```typescript
let createdId: number | undefined;
yield* Effect.gen(function* () {
  const created = yield* createAction({ ... });
  createdId = created.id;
  // ... assertions ...
  yield* cleanup(projectId, created.id);
  createdId = undefined;
}).pipe(
  Effect.ensuring(
    createdId !== undefined ? cleanup(projectId, createdId) : Effect.void
  )
);
```

The ternary `createdId !== undefined ? cleanup(...) : Effect.void` is **evaluated eagerly at Effect construction time**, when `createdId` is still `undefined`. The `ensuring` clause will therefore always resolve to `Effect.void` -- cleanup never runs on failure.

**Impact:** ~30 test blocks across 8 files. Tests pass because explicit cleanup runs in the happy path, but any mid-test failure leaks resources.

### The fix

Use `Effect.suspend` to defer evaluation, or better, use `Ref`:

```typescript
// Option A: Effect.suspend
Effect.ensuring(
  Effect.suspend(() =>
    createdId !== undefined ? cleanup(projectId, createdId) : Effect.void
  )
)

// Option B: Ref (idiomatic Effect)
const createdIdRef = yield* Ref.make<Option.Option<number>>(Option.none());
yield* Effect.gen(function* () {
  const created = yield* createAction({ ... });
  yield* Ref.set(createdIdRef, Option.some(created.id));
  // ... assertions ...
}).pipe(
  Effect.ensuring(
    Ref.get(createdIdRef).pipe(
      Effect.flatMap(Option.match({
        onNone: () => Effect.void,
        onSome: (id) => cleanup(projectId, id),
      }))
    )
  )
)

// Option C: Shared helper (recommended)
const withResource = <A>(
  create: Effect.Effect<{ id: number } & A, unknown, Provided>,
  destroy: (id: number) => Effect.Effect<void, unknown, Provided>,
  test: (resource: { id: number } & A) => Effect.Effect<void, unknown, Provided>,
) => Effect.acquireUseRelease(create, test, (r) => destroy(r.id).pipe(Effect.catchAll(() => Effect.void)))
```

---

## 5. Structural Comparison with distilled-aws

### Matching patterns (good)

| Concern | distilled-aws | Our package | Match? |
|---|---|---|---|
| Service functions | Top-level `const` exports | Top-level `const` exports | Yes |
| Context dependencies | `Context.Tag` for Credentials, Endpoint | `Context.Tag` for Credentials, Endpoint | Yes |
| Error types | `S.TaggedError` | `S.TaggedError` | Yes |
| Retry | `Context.Tag` with policies | `Context.Tag` with policies | Yes |
| HTTP annotations | Symbol-based traits on Schema AST | Symbol-based traits on Schema AST | Yes |
| Package exports | Barrel `index.ts` + per-service subpaths | Barrel `index.ts` + per-service subpaths | Yes |
| Sensitive data | `Redacted<string>` | `Redacted<string>` | Yes |

### Divergences requiring attention

| Concern | distilled-aws | Our package | Priority |
|---|---|---|---|
| Schema style | `interface + S.Struct + S.suspend + cast` | `S.Class` | Low (ours is valid, more modern) |
| Error categories | Prototype-decorated categories (`withThrottlingError`, `isTransientError`) | `instanceof` + `_tag` checks | Medium |
| Operation signatures | Full explicit type signature with every error type | No explicit signatures (inferred) | Medium |
| `/*@__PURE__*/` | Applied to all `API.make()` calls for tree-shaking | Not used | Low |
| Pagination | `Stream.unfoldEffect` with `.pages()` / `.items()` | Not implemented (returns single page) | High |
| `S.Unknown` usage | None (complete schemas) | 30+ fields | High |
| Shared types | Per-service newtypes + shared commons | Duplicated `UserBasic` in 8 files | Medium |

---

## 6. Prioritised Remediation Plan

### P0 -- Critical (must fix)

1. **Fix `Effect.ensuring` bug** -- All CRUD tests use eager evaluation. Wrap in `Effect.suspend()` or refactor to `Effect.acquireUseRelease`.

### P1 -- High (type safety / correctness)

2. **Eliminate `S.Unknown` from service schemas** -- Define proper schemas for all 30+ fields currently using `S.Unknown`. Reference the PostHog OpenAPI schema at `/Users/cooper/Projects/template/schema.yaml`.
3. **Remove test file type assertions** -- The 26 `(error as PostHogError)` casts in response-parser.test.ts need typed error narrowing. The `as AST.TypeLiteral` casts in traits.test.ts need typed helpers.
4. **Convert `parseJsonBody` to Effect** -- Replace `async/await` + `try/catch` + `while(true)` with Effect/Stream primitives.
5. **Replace `throw` with `Effect.fail`** -- `request-builder.ts:129` throws a plain Error synchronously.

### P2 -- Medium (Effect idiom alignment)

6. **Add error categories** -- Adopt distilled-aws's category system (`withThrottlingError`, `isTransientError`) instead of `instanceof` checks.
7. **Deduplicate `UserBasic`** -- Extract to `src/common.ts`, import in all services.
8. **Add pagination support** -- Implement `.pages()` / `.items()` using `Stream.unfoldEffect` to match distilled-aws.
9. **Replace `console.log` with `Effect.log`** -- In tests and provisioning script.
10. **Replace plain `Error` with `TaggedError`** -- In `credentials.ts:37`.
11. **Replace `instanceof` with `_tag` checks** -- In `retry.ts`.
12. **Convert `if/else` chains to `Match`** -- In `traits.ts` AST tag dispatching.
13. **Add `withResource` test helper** -- Extract the repeated create/assert/cleanup pattern into a shared combinator.
14. **Deduplicate `.env` config resolution** -- 3 copies in `test.ts`, extract to shared helper.

### P3 -- Low (polish / alignment)

15. **Add `/*@__PURE__*/` to `API.make()` calls** -- For tree-shaking.
16. **Add explicit operation type signatures** -- Match distilled-aws's fully explicit return types.
17. **Replace mutable `let` variables with `Ref`** -- 6 occurrences in source.
18. **Convert raw interfaces to Schema** -- `Request`, `Response`, `Operation`, `HttpTrait`, etc.
19. **Replace ternaries with `Option.match`** -- Where semantically appropriate.
20. **Remove non-null assertions from provisioning script** -- Use `Option.getOrThrowWith` or schema defaults.

---

## 7. Test Results Summary

```
Test Files  17 passed (17)
     Tests  224 passed (224)
  Duration  51.78s
```

Type check: Clean (0 errors).

All tests pass against the live PostHog API at `https://us.posthog.com`.

---

## 8. Files Requiring Changes (by priority)

### P0
- `test/actions.test.ts`, `test/annotations.test.ts`, `test/cohorts.test.ts`, `test/dashboards.test.ts`, `test/experiments.test.ts`, `test/feature-flags.test.ts`, `test/insights.test.ts`, `test/surveys.test.ts` -- Fix `Effect.ensuring` bug

---

## 9. P1-002 Research: Dashboard Schema Typing

### OpenAPI Observations

- **Dashboard.filters**: The OpenAPI spec defines it as `type: object, additionalProperties: {}` (generic record), but a separate `DashboardFilter` schema exists with `date_from`, `date_to`, `explicitDate`, and `properties` fields. The `properties` field is a 17-member union of property filter types (EventPropertyFilter, PersonPropertyFilter, etc.).
- **Dashboard.tags**: OpenAPI says `type: array, items: {}` (untyped), but DashboardTemplate confirms tags are `type: array, items: { type: string, maxLength: 255 }`. Safe to type as `S.Array(S.String)`.
- **Dashboard.tiles**: OpenAPI defines tiles as `type: array, items: { type: object, additionalProperties: {} }` — there is no `DashboardTile` schema in the OpenAPI spec. Our `DashboardTile` S.Class is a custom schema.
- **Tile insight/text**: These are embedded objects within tiles. The insight is a full Insight object (massive schema). A minimal typed struct with core identifiers (id, short_id, name) is sufficient since tests don't access deep insight fields on tiles.

### S.Class Excess Property Handling

Effect Schema's `S.Class` strips excess properties during decoding by default. This means defining a minimal schema (e.g., `TileInsight` with only id/name/tags) will decode successfully even when the API returns many more fields. This is safe for response schemas but means we lose access to unlisted fields at the type level.

### DashboardFilter.properties Deep Union

The `properties` field in DashboardFilter is a 17-member union of filter types. Typing this completely would require defining schemas for: EventPropertyFilter, PersonPropertyFilter, ElementPropertyFilter, EventMetadataPropertyFilter, SessionPropertyFilter, CohortPropertyFilter, RecordingPropertyFilter, LogEntryPropertyFilter, GroupPropertyFilter, FeaturePropertyFilter, FlagPropertyFilter, HogQLPropertyFilter, EmptyPropertyFilter, DataWarehousePropertyFilter, DataWarehousePersonPropertyFilter, ErrorTrackingIssueFilter, LogPropertyFilter, RevenueAnalyticsPropertyFilter. This is best deferred to a dedicated task if needed.

## 10. P1-003 Research: Feature Flag Schema Typing

### OpenAPI vs Reality for Feature Flags

- **FeatureFlag.surveys**: OpenAPI declares `type: object, additionalProperties: {}` but the live API returns `[]` (empty array). Using `S.Record(...)` causes decode failure; `S.Array(S.Unknown)` works.
- **FeatureFlag.features**: Same issue as surveys — declared as object, returns array.
- **FeatureFlag.experiment_set**: OpenAPI says `type: string` but it's actually an array of experiment IDs (`number[]`). Typed as `S.NullOr(S.Array(S.Number))`.
- **FeatureFlag.rollback_conditions**: OpenAPI declares `nullable: true` with no type at all. Typed as `S.NullOr(S.Array(S.Unknown))`.
- **FeatureFlag.filters**: Rich structure with `groups` (array of `FeatureFlagGroupType`), `multivariate` (variants for A/B tests), `payloads` (per-variant JSON), `aggregation_group_type_index`, and `super_groups`. The `FeatureFlagGroupType` has a `properties` field that's the same 17-member property filter union as dashboard filters.
- **FeatureFlagGroupType**: Well-documented in OpenAPI with `properties`, `rollout_percentage`, `description`, `sort_key`, `users_affected`, `variant` fields.

### Pattern: OpenAPI Object vs API Array

PostHog's OpenAPI spec sometimes declares fields as `type: object` when the live API returns arrays. This has now been observed for:
- `FeatureFlag.surveys`
- `FeatureFlag.features`

When typing schemas, always verify against real API responses, not just the OpenAPI spec.

---

## 11. P1-004 Research: Insight Schema Typing

### OpenAPI Insight Schema Analysis

The `Insight` schema at line 49383 of `schema.yaml` defines:
- `query`: `type: object, nullable: true` — the actual value is a discriminated union of query types
- `result`: `type: string, readOnly: true` — actually a polymorphic JSON value
- `hasMore`: `type: string, readOnly: true` — actually a boolean (see TrendsQueryResponse)
- `columns`: `type: string, readOnly: true` — actually an array of strings
- `tags`: `type: array, items: {}` — untyped in spec, but confirmed as string array
- `is_cached`: `type: string, readOnly: true` — API actually returns boolean (`false`)

Notable absent fields (not in OpenAPI spec but in our prior implementation):
- `filters` — legacy field, not in Insight or PatchedInsight schemas
- `filters_hash` — not in spec
- `saved` — not in response spec (only used as request body field)

### Query Type Structure

The `Insight.query` field accepts a discriminated union of query types:
- `TrendsQuery` — requires `series`, has `interval`, `trendsFilter`, `breakdownFilter`, etc.
- `FunnelsQuery` — requires `series`, has `funnelsFilter`, etc.
- `RetentionQuery` — requires `retentionFilter` with `targetEntity`/`returningEntity`
- `PathsQuery`, `StickinessQuery`, `LifecycleQuery` — similar structure
- `InsightVizNode` — wrapper with `source` field containing another query

All query types share common fields:
- `kind` (string, required discriminant)
- `dateRange` (DateRange, nullable)
- `filterTestAccounts` (boolean, nullable)
- `properties` (array OR PropertyGroupFilter object)
- `samplingFactor`, `aggregation_group_type_index`, `version` (nullable numbers)

### InsightVizNode Wrapper

The API often wraps queries in `InsightVizNode`:
```json
{
  "kind": "InsightVizNode",
  "source": {
    "kind": "TrendsQuery",
    "series": [...]
  }
}
```

The `source` field is recursive — it contains another query object. Modelled using `S.suspend` for lazy evaluation.

### PropertyGroupFilter vs Array

The `properties` field can be either:
1. An array of property filter items: `[{key, type, value, operator}, ...]`
2. A PropertyGroupFilter object: `{type: "AND"|"OR", values: [...]}`

This requires `S.Unknown` since these are fundamentally different shapes.

### Deprecated Fields

Per OpenAPI spec comments:
- `dashboards` on Insight: "DEPRECATED. Will be removed in a future release. Use dashboard_tiles instead."

Removed from request schemas; kept in response schema (API still returns it).

---

### P1
- `src/services/*.ts` (9 files) -- Replace `S.Unknown` with proper schemas
- `test/client/response-parser.test.ts` -- Remove 26 `as PostHogError` casts
- `test/traits.test.ts` -- Remove 12 type assertions
- `src/client/response-parser.ts` -- Convert `parseJsonBody` to Effect
- `src/client/request-builder.ts` -- Replace `throw` with `Effect.fail`

### P2
- `src/errors.ts` -- Add error category system
- `src/services/*.ts` (8 files) -- Extract `UserBasic` to `src/common.ts`
- `src/client/api.ts` -- Add pagination support
- `test/test.ts` -- Add `withResource` helper, deduplicate config
- `src/credentials.ts` -- Replace plain `Error`
- `src/retry.ts` -- Replace `instanceof`
- `src/traits.ts` -- Convert if/else to `Match`
- `scripts/provision-analytics.ts` -- Replace `console.log`, remove `!` assertions
- `test/saas-analytics-setup.test.ts` -- Replace `console.log`

---

## 12. P1-005 Research: Cohort Schema Typing

### OpenAPI Cohort Schema Analysis

The `Cohort` schema at line 37888 of `schema.yaml` defines:
- `groups`: `{}` (empty schema, effectively any object) — deprecated legacy format
- `filters`: `nullable: true` with detailed description but no formal schema — the actual structure is nested AND/OR logic
- `query`: `nullable: true` with no type — alternative cohort definition

### Filters Structure (from test usage and API responses)

The `filters` field has a nested AND/OR structure:
```json
{
  "properties": {
    "type": "OR",
    "values": [
      {
        "type": "AND",
        "values": [
          {
            "key": "$browser",
            "type": "person",
            "value": ["Chrome"],
            "operator": "exact"
          }
        ]
      }
    ]
  }
}
```

### Filter Types

Based on the OpenAPI documentation examples, cohort filter values support three types:
1. **person** — Filter on person properties (e.g., `$browser`, `email`)
2. **behavioral** — Filter on performed events with time constraints
3. **cohort** — Filter on membership in another cohort (by ID)

### Behavioral Filter Fields

Behavioral filters include additional fields:
- `event_type`: "events" | "actions"
- `time_value`: number or string (API inconsistent)
- `time_interval`: "day" | "week" | "month" | etc.
- `bytecode`: internal compiled filter (array)
- `conditionHash`: internal hash string

### API vs OpenAPI Discrepancies

- `time_value`: OpenAPI examples show strings ("30"), but API returns numbers (7)
- `bytecode` and `conditionHash`: Undocumented fields returned by API

### Schema Design Decisions

Created typed schemas:
- `CohortPropertyValue` — Single filter condition with all possible fields
- `CohortFilterGroup` — AND/OR group of property values
- `CohortFilterProperties` — Container with type and values
- `CohortFilters` — Top-level with properties field

Remaining S.Unknown:
- `value` in CohortPropertyValue — polymorphic (string, number, array, etc.)
- `bytecode` — internal PostHog bytecode array
- `groups` — deprecated legacy format
- `query` — undocumented alternative definition

---

## 13. P1-007 Research: Experiment Schema Typing

### PostHog Experiment Metric System

PostHog experiments have two distinct metric configuration systems:

1. **Modern metrics** (`metrics`, `metrics_secondary` fields) — Arrays of query objects:
   - `ExperimentTrendsQuery` with `kind: "ExperimentTrendsQuery"`, `count_query`, `exposure_query`
   - `ExperimentFunnelsQuery` with `kind: "ExperimentFunnelsQuery"`, `funnels_query`

2. **Legacy metrics** (`secondary_metrics` field) — Deprecated format with simpler structure:
   - `name`, `type`, `query` fields
   - Still returned by API but should not be used for new experiments

### Metric Query Structure

Experiment metric queries embed standard query types:

```json
{
  "kind": "ExperimentTrendsQuery",
  "count_query": {
    "kind": "TrendsQuery",
    "series": [
      {
        "kind": "EventsNode",
        "event": "$pageview",
        "math": "total"
      }
    ],
    "dateRange": {
      "date_from": "-7d",
      "date_to": null
    },
    "filterTestAccounts": true
  },
  "exposure_query": null
}
```

### ExperimentParameters Structure

The `parameters` field contains experiment configuration:

```json
{
  "feature_flag_variants": [
    {"key": "control", "rollout_percentage": 50},
    {"key": "test", "rollout_percentage": 50}
  ],
  "recommended_sample_size": 10000,
  "recommended_running_time": 14,
  "minimum_detectable_effect": 0.05,
  "aggregation_group_type_index": null
}
```

### Statistics Configuration

The `stats_config` field controls statistical analysis:

```json
{
  "stats_engine": "bayesian",
  "significance_level": 0.95,
  "minimum_sample_size": 100
}
```

Two statistics engines are supported:
- **bayesian** — Credible intervals, win probability
- **frequentist** — P-values, confidence intervals

### Experiment Filters

The `filters` field uses similar structure to feature flags for experiment targeting:

```json
{
  "groups": [
    {
      "properties": [...],
      "rollout_percentage": 100,
      "variant": null
    }
  ],
  "multivariate": {
    "variants": [
      {"key": "control", "rollout_percentage": 50},
      {"key": "test", "rollout_percentage": 50}
    ]
  },
  "aggregation_group_type_index": null
}
```

### API Documentation Sources

- PostHog Experiments API: https://posthog.com/docs/api/experiments
- PostHog Experiment Metrics: https://posthog.com/docs/experiments/metrics
- Metric types: Funnel, Mean, Ratio, Retention

### Schema Design Decisions

- Used union type for `ExperimentMetric` to support both TrendsQuery and FunnelsQuery
- Defined separate schemas for query components (EventNode, DateRange, etc.)
- Kept `properties` arrays as `S.Array(S.Unknown)` due to 17-member property filter union
- Kept `exposure_query` as `S.Unknown` since it's optional and rarely documented
