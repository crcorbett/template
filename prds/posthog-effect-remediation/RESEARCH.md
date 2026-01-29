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

---

## 14. P1-008 Research: Actions, Events, Persons Schema Typing

### OpenAPI ClickhouseEvent Schema (line 37826)

The OpenAPI spec declares all event fields as `type: string`:
- `properties`: `type: string` (actually JSON-encoded object)
- `person`: `type: string` (actually JSON-encoded object or parsed object)
- `elements`: `type: string` (actually JSON-encoded array or parsed array)

In practice, the PostHog API returns these as parsed JSON objects, not strings. The SDK's response parser decodes the JSON response body, so our schemas should reflect the parsed structure.

### Event Properties Structure

Event properties are key-value pairs storing event metadata:
- Standard properties: `$browser`, `$device`, `$os`, `$current_url`, `$timestamp`, etc.
- Custom properties: Application-specific data sent with events

Best modeled as `S.Record({ key: S.String, value: S.Unknown })` since values can be strings, numbers, booleans, arrays, or nested objects.

### Event Person Structure

The person reference in events contains:
- `id`: UUID string identifier
- `distinct_id`: Primary distinct ID
- `distinct_ids`: Array of all linked distinct IDs
- `properties`: Person properties (another dynamic record)
- `created_at`: ISO timestamp
- `uuid`: Same as id
- `is_identified`: Boolean indicating if person was identified via $identify call

### Event Elements Structure (Autocapture)

For `$autocapture` events, the `elements` array contains DOM element information:
- `tag_name`: HTML tag (button, a, div, etc.)
- `$el_text`: Text content (PostHog-specific key)
- `text`: Alternative text field
- `href`: Link target for anchor elements
- `attr__class`, `attr__id`: CSS class and ID attributes
- `nth_child`, `nth_of_type`: DOM position for disambiguation
- `attributes`: Additional captured attributes as record

### ActionStep Properties

The `ActionStepJSON` schema (line 35482) defines:
- `properties`: `type: array, items: { type: object, additionalProperties: {} }`

This is an array of property filter objects. We already have `ActionStepProperty` S.Class that models individual filter conditions with key, value, operator, and type. Reusing this is appropriate.

### Person Properties

The `Person` schema (line 58554) defines:
- `properties: {}` (empty schema, any object)
- `PersonType` (line 58622) defines: `properties: { type: object, additionalProperties: true }`

Person properties are completely dynamic — they can contain any user-defined attributes. Best modeled as `S.Record({ key: S.String, value: S.Unknown })`.

### Schema Design Decisions

- **EventPerson**: Created new schema with all documented person fields plus common undocumented ones
- **EventElement**: Created new schema covering autocapture element data
- **Actions tags**: Changed from `S.Array(S.Unknown)` to `S.Array(S.String)` (confirmed from other services)
- **ActionStep.properties**: Changed to `S.Array(ActionStepProperty)` to reuse existing typed schema
- **Record values**: Kept as `S.Unknown` for all dynamic key-value stores (event properties, person properties, element attributes) since values are truly polymorphic

---

## 15. P1-011 Research: Type Assertion Elimination in Tests

### Discriminant Narrowing Pattern for TaggedError

When Effect functions return a union error type (`PostHogErrorType = PostHogError | UnknownPostHogError | ...`), using `as` casts to narrow is unsafe. The correct pattern is discriminant narrowing via `_tag`:

```typescript
const assertPostHogError = (error: PostHogErrorType): PostHogError => {
  expect(error._tag).toBe("PostHogError");
  if (error._tag !== "PostHogError") throw new Error("Expected PostHogError");
  return error; // TypeScript narrows to PostHogError here
};
```

This leverages TypeScript's discriminated union narrowing — after the `_tag` check, the type is automatically narrowed to `PostHogError` without any cast.

### Alternative: Effect.flip Type Narrowing

Another approach would be to change the response parser to return `Effect.Effect<T, PostHogError>` (specific error type) instead of `Effect.Effect<T, PostHogErrorType>` (union). However, this would lose the ability to later add typed error matching for specific HTTP status codes (e.g., returning `NotFoundError` for 404s), so the union approach is preferred.

### Recommendation for P1-012 and P1-013

The same discriminant narrowing pattern should be applied to `traits.test.ts`, `request-builder.test.ts`, and `credentials.test.ts` for their respective type assertions.

---

## 16. P1-012 Research: Type Assertion Elimination in traits.test.ts

### AST.TypeLiteral Narrowing via _tag Discriminant

The `SchemaAST.AST` type is a discriminated union with `_tag` as the discriminant. Instead of `(struct.ast as AST.TypeLiteral).propertySignatures`, we can use control flow narrowing:

```typescript
const ast = schema.ast;
if (ast._tag !== "TypeLiteral") throw new Error("Expected TypeLiteral");
// TypeScript narrows ast to AST.TypeLiteral here
return ast.propertySignatures;
```

This completely eliminates the need for `as AST.TypeLiteral` casts. Created `getProps()` and `firstProp()` helpers that combine the AST narrowing and array access guard into reusable functions.

### Non-Null Assertion Elimination for Array Access

Instead of `props[0]!`, use an explicit undefined guard:

```typescript
const prop = props[0];
if (prop === undefined) throw new Error("Expected at least one property");
// TypeScript narrows prop to AST.PropertySignature
```

### Structurally-Typed Mock for Annotatable

The `JsonName` fallback test required `as unknown as S.Schema.Any` because the mock didn't satisfy the `Annotatable` constraint. Since `Annotatable` is not exported, the mock must structurally satisfy it:

```typescript
const notSchema: {
  annotations(a: unknown): typeof notSchema;
} & Record<symbol, unknown> = {
  annotations(a) {
    if (typeof a === "object" && a !== null) {
      Object.assign(notSchema, a); // copies symbol keys
    }
    return notSchema;
  },
};
```

Key insight: `Object.assign` copies symbol-keyed properties, so when `JsonName` calls `schema.annotations({ [jsonNameSymbol]: name })`, the symbol is copied onto the mock. The `Record<symbol, unknown>` intersection type provides symbol indexing for the assertion.

### TimestampFormat Type Erasure Workaround

`TimestampFormat("epoch-seconds")` returns `A` (the same generic as input), so `S.Number.pipe(TimestampFormat(...))` is typed as `Schema<number>` even though it decodes to `Date` at runtime. To use `instanceof Date` without a cast, widen the result to `unknown`:

```typescript
const decoded: unknown = S.decodeUnknownSync(schema)(1700000000);
if (decoded instanceof Date) { ... }
```

Widening to `unknown` is always safe (no information is fabricated) and enables TypeScript's type guards.

---

## 17. P4 Research: PostHog API Pagination Patterns

### Two Pagination Styles

PostHog uses **two distinct pagination patterns** across its API:

#### Offset-based pagination (55+ endpoints)

Used by: dashboards, cohorts, feature-flags, insights, actions, annotations, experiments, persons, surveys, and most other list endpoints.

Request parameters:
- `offset` (integer, default 0) — number of items to skip
- `limit` (integer, default 100) — page size

Response shape:
```json
{
  "count": 142,
  "next": "https://us.posthog.com/api/projects/12345/dashboards/?limit=10&offset=10",
  "previous": null,
  "results": [...]
}
```

Key details:
- `next` is a **full URL string** with query parameters (not a simple token)
- `previous` is also a full URL or null
- `count` is the total number of matching resources
- `results` is always the items array

#### Cursor-based pagination (16+ endpoints)

Used by: events (`/api/projects/{id}/events/`), event definitions, property definitions, and some newer endpoints.

Request parameters:
- `cursor` (string) — opaque pagination cursor

Response shape:
```json
{
  "next": "https://us.posthog.com/api/projects/12345/events/?cursor=cDIwMjUtMD...",
  "results": [...]
}
```

Key differences from offset-based:
- No `count` field — total is not known ahead of time
- No `previous` field
- `next` contains a `cursor` query parameter instead of `offset`
- Cursor values are opaque (base64-encoded)

### Implications for Generic Pagination (P4-007)

The `Operation.pagination` metadata already supports both patterns:

```typescript
pagination?: {
  inputToken: string;   // "offset" or "cursor"
  outputToken: string;  // "next" (always)
  items?: string;       // "results" (always)
  pageSize?: string;    // "limit" (offset-only)
}
```

The `makePaginated` function must handle both by:
1. Parsing the `next` URL to extract the named query parameter (`offset` or `cursor`)
2. Injecting the extracted value into the input using `inputToken` as the field name
3. Stopping when `next` is `null` or the extracted parameter is absent

This generalises the current hardcoded `parseNextOffset` into a `parseNextToken(url, paramName)` helper.

### OpenAPI Schema References

- Offset pagination: `PaginatedDashboardBasicList` (line 52896), `PaginatedCohortList`, etc.
- Cursor pagination: `PaginatedClickhouseEventList` (line 52560)
- Both share the `next`/`results` shape; only `count`/`previous` differ

---

## 18. P4 Research: PostHog API Error Responses

### OpenAPI Error Documentation

PostHog's OpenAPI schema documents **very few explicit error responses**. Most endpoints only specify `200` or `201` success responses. The few documented errors include:

- `/api/projects/{project_id}/batch_exports/backfills/` — 400 (validation)
- Session recording endpoints — 404 (not found)
- A handful of endpoints with explicit 400/403/404

### Runtime Error Behaviour

Despite sparse OpenAPI documentation, the PostHog API consistently returns standard HTTP error codes at runtime:

| Status | Error | Category | When |
|--------|-------|----------|------|
| 401 | `AuthenticationError` | auth | Invalid/missing API key |
| 403 | `AuthorizationError` | auth | Valid key, insufficient permissions |
| 404 | `NotFoundError` | notFound | Resource doesn't exist |
| 422 | `ValidationError` | validation | Invalid request data |
| 429 | `RateLimitError` | throttling | Too many requests |
| 500 | `ServerError` | server | Internal PostHog error |

Error response body shapes vary:
- `{ "message": "..." }` — most common
- `{ "detail": "..." }` — DRF-style (Django REST Framework)
- `{ "error": "...", "error_description": "..." }` — OAuth-style
- `{ "details": {...} }` — validation errors with field-level details

### Per-Operation Error Typing (P4-008)

Since the OpenAPI spec doesn't enumerate errors per endpoint, the pragmatic approach is:

- **All operations**: `COMMON_ERRORS` (401, 403, 429, 500, 422)
- **GET by ID / UPDATE / DELETE**: add `NotFoundError`
- **LIST operations**: no `NotFoundError` (lists return empty results, not 404)
- **CREATE operations**: `COMMON_ERRORS` only (422 for validation is in `COMMON_ERRORS`)

The `COMMON_ERRORS` array already exists in `errors.ts` (lines 119-126) with all 6 error types. Currently all operations define `errors: []`.

### Missing Error Categories

distilled-aws defines 12 error categories. Our current 5 categories (`ThrottlingError`, `ServerError`, `AuthError`, `ValidationError`, `NotFoundError`) cover the PostHog API well. Two additional categories are needed for transport-level errors:

- **`NetworkError`** — connection refused, DNS failure, socket errors
- **`TimeoutError`** — request/response timeouts

These originate from `@effect/platform`'s `HttpClient`, not from PostHog's API directly. The `HttpClient` throws `RequestError` with `reason: 'Transport'` for network failures.

---

## 19. P4 Research: Delete Request Trait Inconsistency

### Current State

The SDK has **inconsistent delete implementations** across its 8 service files with delete operations:

**Correct (true DELETE, 3 services):**
- `experiments.ts` — `DeleteExperimentRequest` has `T.Http({method: 'DELETE', uri: ...})` + `T.HttpLabel()` on path params
- `surveys.ts` — `DeleteSurveyRequest` with proper DELETE traits
- `annotations.ts` — `DeleteAnnotationRequest` with proper DELETE traits

**Incorrect (soft-delete workaround, 5 services):**
- `dashboards.ts` — `DeleteDashboardRequest` has no `T.Http()` trait; `deleteDashboard` calls `updateDashboard({deleted: true})`
- `feature-flags.ts` — same soft-delete pattern
- `actions.ts` — same soft-delete pattern
- `cohorts.ts` — same soft-delete pattern
- `insights.ts` — same soft-delete pattern

### OpenAPI Verification

The PostHog OpenAPI spec **does document DELETE endpoints** for all of these resources:

```yaml
/api/projects/{project_id}/dashboards/{id}/:
  delete:
    operationId: dashboards_destroy
    parameters: [project_id, id]
    responses: { 204: No response body }
```

Similarly for `feature_flags_destroy`, `actions_destroy`, `cohorts_destroy`, `insights_destroy`.

### Root Cause

~~These 5 services were likely implemented before the SDK supported true DELETE operations.~~ **CORRECTED (2026-01-28):** The soft-delete approach is **intentional and correct**. See §19.1 below.

### ~~Fix Pattern~~ BLOCKED — No Fix Needed

~~Each of the 5 files needs:~~
~~1. Add `T.Http({method: 'DELETE', uri: '/api/projects/{project_id}/{resource}/{id}/'})` to `DeleteXRequest`~~
~~2. Add `T.HttpLabel()` on `project_id` and `id` fields~~
~~3. Add a `VoidResponse = S.Struct({})` schema for the 204 response~~
~~4. Create a proper `deleteXOperation` with the VoidResponse output~~
~~5. Replace the soft-delete export with `makeClient(deleteXOperation)`~~

### 19.1 Empirical Verification (2026-01-28): DELETE Returns 405

**Finding:** The PostHog Cloud API (us.posthog.com) returns **405 Method Not Allowed** for HTTP DELETE on all 5 resource types, despite the OpenAPI spec documenting `delete` operations.

Tested endpoints:
- `DELETE /api/environments/{project_id}/dashboards/{id}/` → **405**
- `DELETE /api/projects/{project_id}/dashboards/{id}/` → **405**
- `DELETE /api/projects/{project_id}/feature_flags/{id}/` → **405**
- `DELETE /api/projects/{project_id}/actions/{id}/` → **405**
- `DELETE /api/projects/{project_id}/cohorts/{id}/` → **405**
- `DELETE /api/projects/{project_id}/insights/{id}/` → **405**

The `Allow` response header includes DELETE in the allowed methods list, yet the server responds with 405. This is likely a Django REST Framework quirk where the `destroy` action is defined in the viewset but disabled or overridden to return 405.

The 3 services that DO support true HTTP DELETE (experiments, surveys, annotations) continue to work correctly.

**Conclusion:** The soft-delete pattern (`PATCH` with `{deleted: true}`) is the only working delete mechanism for dashboards, feature-flags, actions, cohorts, and insights. The current implementation is correct. Task P4-003 is marked as passed with no code changes.

---

## 20. P4 Research: Feature Flag Filters Schema Reuse

### Current State

The `FeatureFlagFilters` schema is defined at `feature-flags.ts` lines 49-58 with:
- `groups` — array of `FeatureFlagGroup` (rollout rules)
- `multivariate` — `FeatureFlagMultivariate` (A/B test variants)
- `payloads` — per-variant JSON payloads
- `super_groups` — additional group rules
- `aggregation_group_type_index` — group analytics index

However, `CreateFeatureFlagRequest` (line 142) and `UpdateFeatureFlagRequest` (line 164) both use `S.optional(S.Record({ key: S.String, value: S.Unknown }))` for their `filters` field instead of `S.optional(FeatureFlagFilters)`.

### OpenAPI Verification

Both `FeatureFlag` (response) and `PatchedFeatureFlag` (update request) declare `filters` as `type: object, additionalProperties: {}`. The PostHog API **accepts the same filter shape on input as it returns on output** — this is a standard CRUD pattern where the response filter structure can be round-tripped.

### Recommendation

Replace the generic `S.Record({ key: S.String, value: S.Unknown })` with `FeatureFlagFilters` in both create and update request schemas. This provides:
- Compile-time validation of filter structure
- IDE autocomplete for filter properties
- Consistent typing between input and output

Since `S.Class` strips excess properties during decoding, any extra fields the API might accept beyond `FeatureFlagFilters` would be silently dropped. This is acceptable for an SDK — we type the documented fields.

---

## 21. P4 Research: Lazy Init and Debug Logging Patterns

### distilled-aws Lazy Init Pattern

In `distilled-aws/src/client/api.ts` (lines 26-70), the `makeClient` function uses closure-scoped lazy init:

```typescript
const makeClient = <Op extends Operation>(operation: Op) => {
  let _requestBuilder: RequestBuilder | undefined;
  let _responseParser: ResponseParser | undefined;

  const init = () => {
    _requestBuilder ??= makeRequestBuilder(operation);
    _responseParser ??= makeResponseParser(operation);
    return { buildRequest: _requestBuilder, parseResponse: _responseParser };
  };

  return (input: Input) => Effect.gen(function* () {
    const { buildRequest, parseResponse } = init();
    // ... use cached builders ...
  });
};
```

This caches the expensive AST property analysis (traversing schema annotations for HTTP traits, property signatures, etc.) on first invocation. Subsequent calls reuse the cached builders.

### Current PostHog State

In `packages/posthog/src/client/api.ts`, `execute()` calls `yield* makeRequestBuilder(operation)` on **every request** (line 44). `makeRequestBuilder` returns an `Effect` (since P1-010), which traverses the schema AST each time. `makeResponseParser` (line 112) also rebuilds on every call.

### Fix Approach

Since `makeRequestBuilder` now returns `Effect<RequestBuilder, MissingHttpTraitError>`, the lazy init needs to handle the effectful case. Two options:

1. **Eager init in closure** (preferred): Move `makeRequestBuilder` call outside the returned function, execute once during `makeClient` setup
2. **Lazy ??= with Effect.runSync**: Since the builder only depends on the operation schema (no runtime context), it can be safely `Effect.runSync`'d in the closure

### distilled-aws Debug Logging Pattern

distilled-aws adds 4 `Effect.logDebug` calls in `execute()`:

1. **After input**: `yield* Effect.logDebug("Payload").pipe(Effect.annotateLogs("payload", input))`
2. **After request build**: `yield* Effect.logDebug("Built Request").pipe(Effect.annotateLogs("request", req))`
3. **After HTTP response**: `yield* Effect.logDebug("Raw Response").pipe(Effect.annotateLogs("status", res.status))`
4. **After parse**: `yield* Effect.logDebug("Parsed Response").pipe(Effect.annotateLogs("result", result))`

These are zero-cost unless a debug-level log layer is provided. They help debug API integration issues without adding runtime overhead.

---

## 22. P4 Research: Transport Error Detection

### @effect/platform Error Model

`@effect/platform`'s `HttpClient` throws `RequestError` when the HTTP request fails at the transport layer:

```typescript
interface RequestError {
  _tag: "RequestError";
  reason: "Transport" | "Encode" | "Decode";
  // ... error details
}
```

`reason: "Transport"` indicates network-level failures:
- Connection refused (ECONNREFUSED)
- DNS resolution failure (ENOTFOUND)
- Socket timeout (ETIMEDOUT)
- TLS handshake failure
- Connection reset (ECONNRESET)

### distilled-aws Pattern

distilled-aws defines `isHttpClientTransportError` (src/category.ts lines 285-296):

```typescript
export const isHttpClientTransportError = (error: unknown): boolean => {
  if (Predicate.isObject(error) && '_tag' in error &&
      error._tag === 'RequestError' && 'reason' in error &&
      error.reason === 'Transport') return true;
  return false;
};
```

This is included in `isTransientError` so transport failures trigger automatic retry.

### Current PostHog State

Our `isTransientError` only checks `isThrottlingError || isServerError`. Transport errors from `HttpClient` pass through unmatched — they won't trigger retry even though they're inherently transient.

### Fix

Add `isHttpClientTransportError` to `category.ts` and include it in `isTransientError`. No new error classes needed — the detection is purely predicate-based on `@effect/platform`'s existing error shape.

---

## 23. P4 Research: Retry Factory Pattern

### distilled-aws Retry Factory

distilled-aws uses a Factory pattern for retry (src/retry.ts lines 120-148):

```typescript
export type Factory = (lastError: Ref.Ref<unknown>) => Options;

export type Policy = Options | Factory;
```

The factory receives a `Ref<unknown>` that holds the most recent error. This enables:
- **Retry-after header support**: Read `retryAfter` from the last `RateLimitError` and use it as the delay
- **Adaptive backoff**: Increase delay based on error severity
- **Error-specific scheduling**: Different schedules for throttling vs server errors

In `execute()`, the retry wrapper:
1. Creates `Ref.make<unknown>(undefined)` for the last error
2. Resolves the retry policy (factory or static) from context
3. Wraps execution with `Effect.tapError((e) => Ref.set(lastError, e))`
4. Applies `Effect.retry({ while, schedule })` from the resolved options

### Current PostHog State

Our `retry.ts` only supports static `Options`:
- `Retry` context tag holds `Options` directly
- No factory pattern
- No `Ref` for last error
- `RateLimitError` already has a `retryAfter` field (line 83 of errors.ts) but nothing reads it

### Fix Scope

1. Add `Factory` type and `Policy` union to `retry.ts`
2. Add a `makeDefault` factory that reads `retryAfter` from `RateLimitError`
3. Update `api.ts` execute to create `Ref`, resolve policy, and wire retry
4. Update `Retry` tag to accept `Policy` instead of just `Options`
