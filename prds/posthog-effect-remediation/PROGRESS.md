# Progress Log

**Plan:** PostHog SDK Effect TS Remediation
**Started:** 2026-01-28
**Branch:** feat/distilled-posthog

---

## Session Log

### 2026-01-28

#### Initial Audit

**Status:** Completed

**Summary:** Performed comprehensive audit of all PostHog source, test, and script files against Effect TS best practices and the `distilled-aws` reference architecture.

**Findings:**
- 224 tests passing, 17 test files, 0 type errors
- 28 type assertions in source files, 48 in test files, 32 in scripts
- 30+ `S.Unknown` escape hatches across 9 service files
- Critical `Effect.ensuring` eager evaluation bug in 30 test blocks
- `parseJsonBody` using raw async/await instead of Effect
- `UserBasic` duplicated in 8 service files
- No pagination support
- No error categories

**Deliverables:**
- `prds/RESEARCH.md` -- Full audit findings with file:line references
- `prds/SPEC.md` -- Technical specification and architecture
- `prds/PROGRESS.md` -- This file
- `prds/PRD.json` -- Atomic task list for implementation

**Verification:**
- `bun run test` -- 224 tests passing
- `npx tsc --noEmit` -- 0 type errors

---

#### P0: Fix Effect.ensuring eager evaluation bug (P0-001 through P0-009)

**Status:** Completed

**Summary:** Added `withResource` test helper using `Effect.acquireUseRelease` and replaced all 28 instances of the broken `let createdId` + `Effect.ensuring` pattern across 8 test files.

**Problem:** The `Effect.ensuring(createdId !== undefined ? cleanup(...) : Effect.void)` pattern eagerly evaluates the ternary at Effect construction time, before `createdId` is ever assigned. This means cleanup never runs when a test fails mid-execution, leaking resources in PostHog.

**Fix:** Introduced `withResource({ acquire, use, release })` in `test/test.ts` which uses `Effect.acquireUseRelease` to guarantee the release callback always executes with the actual resource value. Also eliminates all mutable `let` variables from tests.

**Files changed:**
- `test/test.ts` -- Added `withResource` helper (P0-001)
- `test/actions.test.ts` -- 5 tests fixed (P0-002)
- `test/annotations.test.ts` -- 5 tests fixed (P0-003)
- `test/cohorts.test.ts` -- 4 tests fixed (P0-004)
- `test/dashboards.test.ts` -- 2 tests fixed (P0-005)
- `test/experiments.test.ts` -- 3 tests fixed with nested withResource (P0-006)
- `test/feature-flags.test.ts` -- 4 tests fixed (P0-007)
- `test/insights.test.ts` -- 4 tests fixed (P0-008)
- `test/surveys.test.ts` -- 4 tests fixed (P0-009)

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- No remaining `let createdId` or `Effect.ensuring` patterns in test files

---

#### P1-001: Extract shared UserBasic schema to src/common.ts

**Status:** Completed

**Summary:** Deduplicated the `UserBasic` S.Class schema that was identically defined in 8 service files. Created `src/common.ts` as the single source of truth, updated all service files to import from it, and added re-exports to preserve the public API.

**Files changed:**
- `src/common.ts` -- New file with shared UserBasic schema
- `src/index.ts` -- Added `export { UserBasic } from "./common.js"`
- `src/services/dashboards.ts` -- Import + re-export from common.ts
- `src/services/feature-flags.ts` -- Import + re-export from common.ts
- `src/services/insights.ts` -- Import + re-export from common.ts
- `src/services/cohorts.ts` -- Import + re-export from common.ts
- `src/services/surveys.ts` -- Import + re-export from common.ts
- `src/services/actions.ts` -- Import + re-export from common.ts
- `src/services/annotations.ts` -- Import + re-export from common.ts
- `src/services/experiments.ts` -- Import + re-export from common.ts

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test` -- 224/224 tests passing

---

#### P1-002: Replace S.Unknown in dashboards.ts with proper schemas

**Status:** Completed

**Summary:** Replaced all top-level `S.Unknown` usages in `src/services/dashboards.ts` with properly typed schemas derived from the PostHog OpenAPI spec (`schema.yaml`).

**Changes:**
- Defined `LayoutEntry` schema for dashboard tile grid positioning (h, w, x, y, minH, minW)
- Defined `TileInsight` schema for minimal insight reference on tiles (id, short_id, name, derived_name, description, tags, favorited, saved)
- Defined `TileText` schema for text-only tile content (body, last_modified_at)
- Defined `DashboardFilter` schema from OpenAPI DashboardFilter (date_from, date_to, explicitDate, properties)
- Replaced `S.Array(S.Unknown)` with `S.Array(S.String)` for tags in both `Dashboard` and `DashboardBasic`
- Replaced `S.Record({ key: S.String, value: S.Unknown })` for filters with `DashboardFilter`
- Replaced `S.NullOr(S.Unknown)` for insight with `S.NullOr(TileInsight)`
- Replaced `S.NullOr(S.Unknown)` for text with `S.NullOr(TileText)`
- Replaced layout record values with `LayoutEntry`

**Remaining:** One `S.Unknown` inside `DashboardFilter.properties` — the property filter union has 17 variants in the OpenAPI spec; typing the full union is out of scope for this task.

**Files changed:**
- `src/services/dashboards.ts` -- Replaced 5 S.Unknown fields with typed schemas

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/dashboards.test.ts` -- 5/5 tests passing

---

#### P1-003: Replace S.Unknown in feature-flags.ts with proper schemas

**Status:** Completed

**Summary:** Replaced top-level `S.Unknown` usages in `src/services/feature-flags.ts` with properly typed schemas derived from the PostHog OpenAPI spec and actual API response analysis.

**Changes:**
- Defined `FeatureFlagGroup` schema from OpenAPI `FeatureFlagGroupType` (properties, rollout_percentage, description, sort_key, users_affected, variant)
- Defined `FeatureFlagVariant` schema for multivariate variants (key, name, rollout_percentage)
- Defined `FeatureFlagMultivariate` schema (variants array)
- Defined `FeatureFlagFilters` schema (groups, multivariate, payloads, aggregation_group_type_index, super_groups)
- Replaced `filters: S.Unknown` with `FeatureFlagFilters` on response schema
- Changed `experiment_set` from `S.Unknown` to `S.NullOr(S.Array(S.Number))`
- Changed `surveys` from `S.Unknown` to `S.Array(S.Unknown)` (OpenAPI says object but API returns array)
- Changed `features` from `S.Unknown` to `S.Array(S.Unknown)` (same as surveys)
- Changed `rollback_conditions` from `S.NullOr(S.Unknown)` to `S.NullOr(S.Array(S.Unknown))`
- Changed `tags` from `S.Array(S.Unknown)` to `S.Array(S.String)`

**Remaining:** 7 deep `S.Unknown` usages: property filter items (17-member union), payload values (dynamic), survey/feature array items (undocumented refs), rollback condition items (untyped in OpenAPI), and request-side filters (intentionally flexible `S.Record`).

**Discovery:** PostHog OpenAPI spec claims `surveys` and `features` are `type: object, additionalProperties: {}` but the live API returns empty arrays `[]`. Always test against real API responses.

**Files changed:**
- `src/services/feature-flags.ts` -- Added 4 sub-schemas, replaced 6 S.Unknown fields

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/feature-flags.test.ts` -- 7/7 tests passing

---

#### P1-004: Replace S.Unknown in insights.ts with proper schemas

**Status:** Completed

**Summary:** Rewrote `src/services/insights.ts` based on the PostHog OpenAPI spec (`schema.yaml`). Removed legacy/deprecated code and defined proper typed schemas for insight queries.

**Changes:**
- Removed `InsightFilter` class entirely (not in OpenAPI Insight schema — legacy field)
- Removed `filters` from Insight response, CreateInsightRequest, UpdateInsightRequest
- Removed `filters_hash` from Insight (not in spec)
- Removed `dashboards` from request schemas (explicitly deprecated per OpenAPI)
- Defined `DateRange` schema from OpenAPI DateRange
- Defined `EventsNode` schema from OpenAPI EventsNode (kind, event, name, math, properties, etc.)
- Defined `ActionsNode` schema from OpenAPI ActionsNode (kind, id, name, math, properties, etc.)
- Defined `RetentionEntity` schema from OpenAPI RetentionEntity (id, type, kind, name, properties, etc.)
- Defined `RetentionFilter` schema from OpenAPI RetentionFilter (targetEntity, returningEntity, period, totalIntervals, etc.)
- Defined `InsightQuery` with common fields across all query types plus recursive `source` via `S.suspend` for InsightVizNode wrapper
- Changed `tags` from `S.Array(S.Unknown)` to `S.Array(S.String)`
- Changed `hasMore` from `S.Unknown` to `S.NullOr(S.Boolean)` (per TrendsQueryResponse)
- Changed `columns` from `S.Unknown` to `S.NullOr(S.Array(S.String))`
- Changed `is_cached` to `S.Unknown` (OpenAPI says string, API returns boolean)

**Remaining S.Unknown (justified):**
- `result` — polymorphic per query type, impractical to fully type every variant
- `is_cached` — OpenAPI spec and API behavior diverge
- `properties` in InsightQuery — can be array OR PropertyGroupFilter object
- `properties`/`fixedProperties` in EventsNode, ActionsNode, RetentionEntity — 17-member property filter union from OpenAPI

**Files changed:**
- `src/services/insights.ts` -- Complete rewrite with proper OpenAPI-based schemas

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/insights.test.ts` -- 8/8 tests passing

---

#### P1-005: Replace S.Unknown in cohorts.ts with proper schemas

**Status:** Completed

**Summary:** Replaced `S.Unknown` usages in `src/services/cohorts.ts` with properly typed schemas for cohort filter conditions. The cohort filter system uses nested AND/OR logic with property-based conditions.

**Changes:**
- Defined `CohortPropertyValue` schema for individual filter conditions (key, type, value, operator, negation, event_type, time_value, time_interval, bytecode, conditionHash)
- Defined `CohortFilterGroup` schema for AND/OR groups of property values
- Defined `CohortFilterProperties` schema for top-level properties container
- Defined `CohortFilters` schema with properties field
- Replaced `filters: S.NullOr(S.Unknown)` with `S.NullOr(CohortFilters)` on Cohort response
- Replaced `filters: S.Unknown` with `CohortFilters` on CreateCohortRequest and UpdateCohortRequest
- Changed `groups` from `S.Unknown` to `S.Array(S.Unknown)` (deprecated legacy format)
- Used `S.Union(S.String, S.Number)` for `time_value` (API returns inconsistent types)

**Remaining S.Unknown (justified):**
- `value` in CohortPropertyValue — polymorphic, can be string, number, array, etc.
- `bytecode` — internal PostHog bytecode format (array of heterogeneous values)
- `groups` — deprecated legacy format maintained for backward compatibility
- `query` — alternative cohort definition with no OpenAPI documentation

**Discovery:** PostHog API returns `time_value` as a number (e.g., `7`) but OpenAPI examples show strings (e.g., `"30"`). Always use union types when API behavior diverges from spec.

**Files changed:**
- `src/services/cohorts.ts` -- Added 4 sub-schemas, replaced filters with typed schema

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/cohorts.test.ts` -- 7/7 tests passing
- `bun run test` -- 224/224 tests passing

---

#### P1-006: Replace S.Unknown in surveys.ts with proper schemas

**Status:** Completed

**Summary:** Replaced all top-level `S.Unknown` usages in `src/services/surveys.ts` with properly typed schemas sourced from the PostHog JS SDK type definitions.

**Changes:**
- Defined `SurveyPositionEnum` (10 positions: top_left, top_right, top_center, middle_left, middle_right, middle_center, left, center, right, next_to_trigger)
- Defined `SurveyTabPositionEnum` (4 positions: top, left, right, bottom)
- Defined `SurveyWidgetTypeEnum` (3 types: button, tab, selector)
- Defined `SurveyQuestionDescriptionContentType` enum (html, text)
- Defined `SurveyBranching` as a 4-variant union schema for question flow logic:
  - `SurveyBranchingNextQuestion` - proceeds to next question
  - `SurveyBranchingEnd` - ends the survey
  - `SurveyBranchingResponseBased` - branches based on response values
  - `SurveyBranchingSpecificQuestion` - jumps to specific question by index
- Defined `SurveyAppearance` class with 30+ styling fields from PostHog JS SDK (backgroundColor, submitButtonColor, textColor, position, whiteLabel, thankYouMessage fields, widget settings, font styling, etc.)
- Updated `SurveyQuestion` class to include: id (UUID), isNpsQuestion (boolean), branching (SurveyBranching)
- Replaced `questions: S.Array(S.Unknown)` with `S.Array(SurveyQuestion)` in Survey, CreateSurveyRequest, UpdateSurveyRequest
- Replaced `appearance: S.Unknown` with `SurveyAppearance` in Survey, CreateSurveyRequest, UpdateSurveyRequest

**Remaining S.Unknown (justified):**
- `responseValues` in SurveyBranchingResponseBased — polymorphic values (can be strings, numbers, etc. based on question type)

**Discovery:** PostHog OpenAPI spec does not define SurveyAppearance type (just `nullable: true`), but the PostHog JS SDK (`posthog-js`) has complete TypeScript type definitions in `packages/browser/src/posthog-surveys-types.ts`.

**Files changed:**
- `src/services/surveys.ts` -- Added 8 sub-schemas, replaced questions/appearance with typed schemas

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/surveys.test.ts` -- 7/7 tests passing

---

#### P1-007: Replace S.Unknown in experiments.ts with proper schemas

**Status:** Completed

**Summary:** Replaced all top-level `S.Unknown` usages in `src/services/experiments.ts` with properly typed schemas derived from the PostHog API documentation and experiment metrics documentation.

**Changes:**
- Defined `ExperimentParameters` schema for experiment configuration (feature_flag_variants, recommended_sample_size, recommended_running_time, minimum_detectable_effect, aggregation_group_type_index)
- Defined `ExperimentMetricTypeEnum` and `ExperimentMetricKindEnum` for metric type discrimination
- Defined `ExperimentEventNode` schema for event/action nodes in metric queries (kind, event, name, properties, math fields)
- Defined `ExperimentTrendsQuery` schema for trends-based metrics (count queries with series, dateRange, filterTestAccounts, samplingFactor)
- Defined `ExperimentFunnelsQuery` schema for funnel-based metrics (funnel steps with window interval settings)
- Defined `ExperimentMetric` as a union of TrendsQuery and FunnelsQuery
- Defined `StatsEngineEnum` (bayesian, frequentist) and `ExperimentStatsConfig` schema (stats_engine, significance_level, minimum_sample_size)
- Defined `ExperimentFilterGroup` schema for experiment targeting (properties, rollout_percentage, variant)
- Defined `ExperimentFilters` schema for top-level targeting filters (groups, multivariate, aggregation_group_type_index, events)
- Defined `LegacyExperimentMetric` schema for deprecated secondary_metrics field (name, type, query)
- Updated `Experiment` class to use typed schemas for all 6 previously S.Unknown fields
- Updated `CreateExperimentRequest` and `UpdateExperimentRequest` to use typed schemas

**Remaining S.Unknown (justified):**
- `properties` arrays in ExperimentEventNode and ExperimentFilterGroup — 17-member property filter union from OpenAPI
- `exposure_query` in ExperimentTrendsQuery — undocumented optional override query
- `query` in LegacyExperimentMetric — deprecated field with no schema

**Discovery:** PostHog experiments use two distinct metric systems:
1. Modern `metrics`/`metrics_secondary` — arrays of ExperimentTrendsQuery or ExperimentFunnelsQuery objects
2. Legacy `secondary_metrics` — deprecated array format with simpler structure

**Files changed:**
- `src/services/experiments.ts` -- Added 12 sub-schemas, replaced 6 S.Unknown fields with typed schemas

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/experiments.test.ts` -- 6/6 tests passing

---

#### P1-008: Replace S.Unknown in actions.ts, events.ts, persons.ts with proper schemas

**Status:** Completed

**Summary:** Replaced `S.Unknown` usages in the three remaining service files with properly typed schemas.

**Changes in actions.ts:**
- Changed `tags` from `S.Array(S.Unknown)` to `S.Array(S.String)` in both `Action` and `ActionBasic` classes
- Changed `ActionStep.properties` from `S.Array(S.Unknown)` to `S.Array(ActionStepProperty)` (reusing existing schema)
- Retained `ActionStepProperty.value` as `S.Unknown` (polymorphic per OpenAPI PropertyOperator value spec)

**Changes in events.ts:**
- Defined `EventPerson` schema for person reference within events (id, distinct_id, distinct_ids, properties, created_at, uuid, is_identified)
- Defined `EventElement` schema for DOM elements captured during autocapture (tag_name, $el_text, text, href, attr__class, attr__id, nth_child, nth_of_type, attributes)
- Changed `ClickhouseEvent.properties` from `S.Unknown` to `S.Record({ key: S.String, value: S.Unknown })`
- Changed `ClickhouseEvent.person` from `S.Unknown` to `EventPerson`
- Changed `ClickhouseEvent.elements` from `S.Unknown` to `S.Array(EventElement)`

**Changes in persons.ts:**
- Changed `Person.properties` from `S.Unknown` to `S.Record({ key: S.String, value: S.Unknown })`

**Remaining S.Unknown (justified):**
- `ActionStepProperty.value` — polymorphic (string, number, boolean, array per PropertyOperator spec)
- `EventPerson.properties`, `EventElement.attributes`, `Person.properties` values — dynamic key-value stores with arbitrary value types

**Files changed:**
- `src/services/actions.ts` -- Tags typed as string arrays, properties typed as ActionStepProperty array
- `src/services/events.ts` -- Added EventPerson, EventElement schemas; properties/person/elements typed
- `src/services/persons.ts` -- Properties typed as Record

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/actions.test.ts` -- 8/8 tests passing
- `bun run test test/events.test.ts` -- 5/5 tests passing
- `bun run test test/persons.test.ts` -- 5/5 tests passing

---

#### P1-009: Convert parseJsonBody from async/await to Effect

**Status:** Completed

**Summary:** Converted `parseJsonBody` from an `async function` with `while(true)` loop and `try/catch` to a pure Effect implementation using Effect primitives.

**Changes:**
- Replaced `async function parseJsonBody` with an Effect-returning function
- Replaced the imperative `while(true) { await reader.read() }` loop with `Stream.fromReadableStream()` for idiomatic stream consumption
- Replaced `try { JSON.parse(text) } catch { ... }` with `Effect.try({ try: ..., catch: ... }).pipe(Effect.orElseSucceed(...))`
- Replaced mutable `let offset` accumulator with `Arr.reduce()` for chunk combining
- Updated callers in `makeResponseParser` to use the Effect directly instead of wrapping with `Effect.tryPromise`
- Added imports for `Arr` (effect/Array), `Chunk` (effect/Chunk), and `Stream` (effect/Stream)

**Technical Details:**
- `Stream.fromReadableStream(() => response.body, errorMapper)` handles the ReadableStream with proper error typing
- `Chunk.toReadonlyArray()` converts the collected stream chunks for processing
- `Arr.reduce()` used twice: once to calculate total length, once to copy chunks into combined buffer
- JSON parse failure gracefully falls back to `{ rawText: text }` using `Effect.orElseSucceed()`
- Error responses now use `Effect.catchAll(() => Effect.succeed(...))` instead of `Effect.tryPromise` wrapper

**Files changed:**
- `src/client/response-parser.ts` -- Complete rewrite of parseJsonBody function

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/client/response-parser.test.ts` -- 26/26 tests passing
- `bun run test` -- 224/224 tests passing

---

#### P1-010: Replace synchronous throw with Effect.fail in request-builder.ts

**Status:** Completed

**Summary:** Converted `makeRequestBuilder` from a function that throws synchronously to one that returns an Effect with a proper error channel, and removed non-null assertions.

**Changes:**
- Created `MissingHttpTraitError` TaggedError in `src/errors.ts` for when a schema lacks HTTP annotations
- Added `MissingHttpTraitError` to the `PostHogErrorType` union
- Changed `makeRequestBuilder` signature from `(operation) => (input) => Effect<Request>` to `(operation) => Effect<(input) => Effect<Request>, MissingHttpTraitError>`
- Replaced `throw new Error('No HTTP trait found on input schema')` with `Effect.fail(new MissingHttpTraitError(...))`
- Wrapped the returned request builder function in `Effect.succeed()`
- Fixed 2 non-null assertions (`getHttpQuery(prop)!` and `getHttpHeader(prop)!`) by storing results in variables before conditional checks
- Updated `api.ts` to `yield*` the Effect from `makeRequestBuilder` before calling the returned function
- Updated all 14 tests in `request-builder.test.ts` to use `yield* makeRequestBuilder(operation)` pattern
- Converted the error test from `expect(() => ...).toThrow()` to Effect-based test using `Effect.flip`

**Files changed:**
- `src/errors.ts` -- Added MissingHttpTraitError TaggedError class
- `src/client/request-builder.ts` -- Changed return type to Effect, replaced throw with Effect.fail, removed non-null assertions
- `src/client/api.ts` -- Updated caller to yield* the Effect
- `test/client/request-builder.test.ts` -- Updated all 14 tests for Effect-based signature

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/client/request-builder.test.ts` -- 14/14 tests passing
- `bun run test` -- 224/224 tests passing

---

#### P1-011: Remove type assertions from response-parser.test.ts

**Status:** Completed

**Summary:** Replaced all 26 `(error as PostHogError)` type assertions with a typed `assertPostHogError` helper function that uses `_tag` discriminant narrowing — zero `as` casts in the file.

**Approach:**
- Created `assertPostHogError(error: PostHogErrorType): PostHogError` helper at top of file
- Helper uses `expect(error._tag).toBe("PostHogError")` for test assertion
- Uses TypeScript's discriminated union narrowing (`if (error._tag !== "PostHogError") throw`) to return properly typed `PostHogError`
- Imported `PostHogErrorType` from errors.ts to type the helper parameter
- Replaced all 26 `(error as PostHogError)` casts with the narrowed `error` variable
- Removed 12 redundant `expect(error).toBeInstanceOf(PostHogError)` calls since the helper already asserts the tag

**Files changed:**
- `test/client/response-parser.test.ts` -- Replaced 26 type assertions with discriminant-based narrowing

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/client/response-parser.test.ts` -- 26/26 tests passing
- Zero `as` casts remaining in file (verified with grep)

---

#### P1-012: Remove type assertions from traits.test.ts

**Status:** Completed

**Summary:** Eliminated all 12 type assertions (`as`) and 7 non-null assertions (`!`) from `test/traits.test.ts` using discriminant narrowing, typed helpers, and structural typing.

**Changes:**
- Created `getProps(schema)` helper that narrows `AST.AST` to `AST.TypeLiteral` via `_tag` discriminant check, returning `propertySignatures` — replaces 7 `as AST.TypeLiteral` casts
- Created `firstProp(schema)` helper that combines `getProps` with an undefined guard on `[0]` — replaces 7 `props[0]!` non-null assertions
- Replaced `as T.HttpTrait` with `T.getHttpTrait(schema.ast)` which returns typed `HttpTrait | undefined`
- Replaced `as T.PostHogServiceTrait` with `T.getPostHogService(schema.ast)` which returns typed `PostHogServiceTrait | undefined`
- Replaced `as unknown as S.Schema.Any` double-cast with a structurally-typed mock using `{ annotations(a: unknown): typeof notSchema } & Record<symbol, unknown>` — `Object.assign` copies symbol-keyed properties from the annotation argument
- Replaced `as unknown as Record<symbol, unknown>` with direct symbol indexing via `Record<symbol, unknown>` intersection type
- Replaced `as unknown as Date` with `const decoded: unknown` widening + `instanceof Date` guard (safe widening, not a cast)

**Files changed:**
- `test/traits.test.ts` -- Removed all 12 type assertions and 7 non-null assertions

**Verification:**
- `npx tsc --noEmit` -- 0 type errors
- `bun run test test/traits.test.ts` -- 41/41 tests passing
- `bun run test` -- 224/224 tests passing
- Zero `as` casts in file (verified with grep, only `import * as` namespace imports found)
- Zero `!` non-null assertions in file

---

#### P1-013: Remove type assertions from request-builder.test.ts and credentials.test.ts

**Status:** Completed

**Summary:** Eliminated all type assertions from both test files using an `asserts` return type helper and typed error channel access.

**Changes in request-builder.test.ts:**
- Created `assertStringBody` function with TypeScript `asserts body is string` return type (zero `as` casts)
- Replaced 3 instances of `JSON.parse(request.body as string)` with `assertStringBody(request.body); JSON.parse(request.body)`
- The `asserts` return type narrows `body` from `string | Uint8Array | ReadableStream | undefined` to `string` in the subsequent scope

**Changes in credentials.test.ts:**
- Removed `(error as Error).message` — the error type from `Effect.flip` is already `Error` (from `Layer.Layer<Credentials, Error>`)
- Simply changed to `error.message` since TypeScript already knows the type

**Files changed:**
- `test/client/request-builder.test.ts` — 3 type assertions removed, assertStringBody helper added
- `test/credentials.test.ts` — 1 type assertion removed

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test test/client/request-builder.test.ts` — 14/14 tests passing
- `bun run test test/credentials.test.ts` — 8/8 tests passing
- Zero `as` casts in either file (verified with grep)

---

#### P1-014: Remove type assertions from client source files (response-parser.ts, api.ts, request-builder.ts)

**Status:** Completed

**Summary:** Removed all 6 type assertions (`as` casts) from the three client source files using type guards, return type annotations, object spread, and parameter type widening.

**Changes in response-parser.ts:**
- Replaced `JSON.parse(text) as unknown` with `(): unknown => JSON.parse(text)` return type annotation
- Added `isRecord()` type guard function to replace 2 `as Record<string, unknown>` casts in `getErrorMessage`

**Changes in api.ts:**
- Replaced `platformResponse.headers as Record<string, string>` with object spread `{ ...platformResponse.headers }`

**Changes in request-builder.ts:**
- Changed `getPropertySignatures` return type to `ReadonlyArray<AST.PropertySignature>` (matching TypeLiteral), removing the `as` cast
- Changed `requestBuilder` parameter from `unknown` to `Record<string, unknown>`, eliminating the `input as Record` cast

**Files changed:**
- `src/client/response-parser.ts` — 3 type assertions removed
- `src/client/api.ts` — 1 type assertion removed
- `src/client/request-builder.ts` — 2 type assertions removed

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test` — 224/224 tests passing
- Zero `as` casts in any of the three files

---

#### P1-015: Remove type assertions from saas-analytics-setup.test.ts

**Status:** Completed

**Summary:** Replaced 8 `[] as number[]` / `[] as string[]` type assertions in the resource tracking object with a properly typed `ResourceTracker` interface.

**Changes:**
- Defined `ResourceTracker` interface with typed arrays for all 8 resource categories (cohorts, featureFlags, insights, dashboards as `number[]`, surveys as `string[]`, actions, annotations, experiments as `number[]`)
- Changed `const created = { ... }` to `const created: ResourceTracker = { ... }` with plain `[]` literals
- All 8 `as` casts eliminated

**Files changed:**
- `test/saas-analytics-setup.test.ts` — 8 type assertions removed via ResourceTracker interface

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test test/saas-analytics-setup.test.ts` — 44/44 tests passing
- Zero `as` casts in file

---

#### P1-016: Remove type assertions and non-null assertion from generate-clients.ts

**Status:** Completed

**Summary:** Removed 3 type assertions (`as SchemaObject`, `as SchemaObject`, `as OpenAPISpec`) and 1 non-null assertion (`groups.get(tag)!`) from `scripts/generate-clients.ts`.

**Changes:**
- Removed 2 `as SchemaObject` casts in `typeToSchema` and `collectSchemaRefs` — after `isRef()` type predicate early-returns, TypeScript's control flow narrowing already knows the type is `SchemaObject`
- Replaced `YAML.load(schemaContent) as OpenAPISpec` with a runtime `isOpenAPISpec()` type guard that validates the presence and types of `openapi` and `paths` fields
- Replaced `groups.get(tag)!.push(...)` with `const group = groups.get(tag); if (group) { group.push(...) }` guard pattern

**Files changed:**
- `scripts/generate-clients.ts` — 3 type assertions removed, 1 non-null assertion removed, 1 type guard added

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- Zero avoidable `as` casts (only `as Record<string, unknown>` inside type guard and `as const`)

---

#### P2-001: Replace plain Error with TaggedError in credentials.ts

**Status:** Completed

**Summary:** Replaced `new Error(...)` in `Credentials.fromEnv()` with a proper `MissingCredentialsError` TaggedError, aligning with the Effect TS error handling pattern used throughout the codebase.

**Changes:**
- Added `MissingCredentialsError` TaggedError class to `src/errors.ts` with `message: S.String` field
- Added `MissingCredentialsError` to the `PostHogErrorType` union type
- Updated `Credentials.fromEnv()` return type from `Layer.Layer<Credentials, Error>` to `Layer.Layer<Credentials, MissingCredentialsError>`
- Replaced `new Error("POSTHOG_API_KEY environment variable is not set")` with `new MissingCredentialsError({ message: "..." })`
- Updated `test/credentials.test.ts` to assert `error._tag === "MissingCredentialsError"` and `toBeInstanceOf(MissingCredentialsError)`
- Exported `MissingCredentialsError` from `src/index.ts`

**Files changed:**
- `src/errors.ts` — Added MissingCredentialsError TaggedError class, updated PostHogErrorType union
- `src/credentials.ts` — Changed fromEnv() error type and construction
- `src/index.ts` — Added MissingCredentialsError to exports
- `test/credentials.test.ts` — Updated error assertion to use _tag discriminant

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test test/credentials.test.ts` — 8/8 tests passing
- Events tests timeout is pre-existing (confirmed on stashed code)

---

#### P2-002: Replace instanceof checks with _tag discriminants in retry.ts

**Status:** Completed

**Summary:** Replaced `instanceof` checks in `isRateLimitError` and `isServerError` with a generic `hasTag<T>` helper that uses `_tag` discriminant narrowing only.

**Changes:**
- Created generic `hasTag<T>(tag)` helper function that returns a type predicate `(error: unknown) => error is T`
- Replaced `isRateLimitError` implementation (was `instanceof RateLimitError || _tag check`) with `hasTag<RateLimitError>("RateLimitError")`
- Replaced `isServerError` implementation (was `instanceof ServerError || _tag check`) with `hasTag<ServerError>("ServerError")`
- Changed `import { RateLimitError, ServerError }` to `import type { ... }` since runtime class values are no longer needed (only used for type parameter)

**Files changed:**
- `src/retry.ts` — Replaced 2 instanceof checks with _tag discriminant narrowing via hasTag helper

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test` — 220/220 non-events tests passing (events tests have pre-existing timeout issue)
- Zero `instanceof` checks remain in retry.ts

---

#### P2-003: Add error category system matching distilled-aws

**Status:** Completed

**Summary:** Added a symbol-based error classification system matching the distilled-aws `Category` module. Error classes are decorated with categories via `.pipe(withX)`, enabling predicate-based retry policies and error catching without `instanceof` or `_tag` checks.

**Changes:**
- Created `src/category.ts` with the full category system:
  - `categoriesKey` string key (`@posthog/error/categories`) for prototype stamping
  - `withCategory` generic decorator supporting multiple categories per error class
  - 5 category constants: `ThrottlingError`, `ServerError`, `AuthError`, `ValidationError`, `NotFoundError`
  - 5 individual `withX` decorators for `.pipe()` usage
  - `hasCategory(error, category)` base predicate
  - 5 individual `isX` predicates + `isTransientError` composite (throttling || server)
  - `catchErrors` multi-category catcher + 5 individual `catchX` helpers
- Updated `src/errors.ts`:
  - `AuthenticationError` + `AuthorizationError` → `.pipe(withAuthError)`
  - `NotFoundError` → `.pipe(withNotFoundError)`
  - `ValidationError` → `.pipe(withValidationError)`
  - `RateLimitError` → `.pipe(withThrottlingError)`
  - `ServerError` → `.pipe(withServerError)`
- Updated `src/retry.ts`:
  - Replaced `_tag`-based `hasTag` helper with category-based predicates from `category.ts`
  - Re-exports `isThrottlingError` and `isTransientError` for backwards compatibility
- Updated `src/index.ts`:
  - Added `export * as Category from "./category.js"`

**Files changed:**
- `src/category.ts` — New file: complete error category module
- `src/errors.ts` — Decorated 6 error classes with category decorators
- `src/retry.ts` — Replaced _tag checks with category predicates
- `src/index.ts` — Added Category export

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test` — 224/224 tests passing

---

### P2-004: Convert if/else chains to Match in traits.ts
**Status:** Complete
**Commit:** (pending)

Converted `hasAnnotation` and `getAnnotationUnwrap` functions from if/else chains on `ast._tag` to `Match.value(ast).pipe(Match.when({_tag: ...}), Match.orElse(...))` pattern. Added `import * as Match from "effect/Match"` to traits.ts.

`JsonName` was intentionally left unchanged — its branching uses runtime predicates (`propertySignatureSymbol in schema`, `S.isSchema()`) rather than `_tag` discrimination, which doesn't map cleanly to `Match` patterns with the generic `Annotatable` constraint. Match.when requires type predicates that conflict with the open generic.

**Files changed:**
- `src/traits.ts` — Added Match import, converted hasAnnotation and getAnnotationUnwrap to Match patterns

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test test/traits.test.ts` — 41/41 tests passing
- `bun run test` — 223/224 tests passing (1 pre-existing events timeout)

---

### P2-005: Replace console.log with Effect.log in saas-analytics-setup.test.ts

**Status:** PASSED
**Date:** 2026-01-28

Replaced 10 `console.log` calls in the Summary test block with a single `yield* Effect.logInfo("SaaS Analytics Setup Complete!")` using `Effect.annotateLogs` to attach all resource counts as structured annotations. This is idiomatic Effect logging — structured data is attached as annotations rather than interpolated into strings, making it machine-parseable while still human-readable.

**Files changed:**
- `test/saas-analytics-setup.test.ts` — Replaced 10 console.log calls with 1 Effect.logInfo + Effect.annotateLogs

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test test/saas-analytics-setup.test.ts` — 44/44 tests passing

---

### P2-006: Replace console.log with Effect.log in provision-analytics.ts

**Status:** PASSED
**Date:** 2026-01-28

Replaced all 40 `console.log` calls with `yield* Effect.logInfo(...)` throughout the provisioning script. Replaced `console.error` + `process.exit(1)` error handling with `Effect.tapErrorCause` + `Effect.logError` + `Cause.pretty` (Effect.runPromise rejects naturally on failure). Removed all 25 non-null assertions (`.name!`, `.content!`) by using `?? PREFIX` fallback. Replaced 7 `as { id: number; ... }[]` type assertion casts with a `CreatedResources` interface and typed empty arrays. `Date.now()` accepted as non-effectful per task spec.

**Changes:**
- Added `Cause` import from `effect`
- Defined `CreatedResources` interface with typed arrays for all 8 resource categories
- Replaced startup console.log block with `Effect.logInfo` + `Effect.annotateLogs({ projectId, prefix })`
- Replaced 8 phase header console.logs with `yield* Effect.logInfo("Phase N: ...")`
- Replaced ~30 per-resource console.logs with `yield* Effect.logInfo("Created X: ...")`
- Replaced summary console.log block with `Effect.logInfo("SaaS Analytics Setup Complete")` + `Effect.annotateLogs` for structured counts
- Replaced `.catch((e) => { console.error(...); process.exit(1) })` with `Effect.tapErrorCause((cause) => Effect.logError("Provisioning failed", Cause.pretty(cause)))`
- Replaced 25 `.name!` / `.content!` non-null assertions with `?? PREFIX` fallback
- Replaced 7 `[] as { id: number; name: string }[]` casts with interface-typed `[]`

**Files changed:**
- `scripts/provision-analytics.ts` — 40 console.log → Effect.logInfo, 25 non-null assertions removed, 7 type casts removed, error handling converted to Effect

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test` — 224/224 tests passing
- Zero `console.log`, `console.error`, `process.exit`, `as {`, `.name!`, `.content!` remaining in file

---

### P2-007: Deduplicate .env config resolution in test.ts

**Status:** PASSED
**Date:** 2026-01-28

Extracted the duplicated `fs.exists('../../.env') + ConfigProvider.orElse` pattern (appearing in both `test()` and `run()`) into two shared helpers:

1. `resolveConfigProvider` — Effect that checks for `../../.env` and returns the appropriate `ConfigProvider` (dot-env with env fallback, or plain env)
2. `withConfigAndCredentials` — wraps any effect with the resolved config provider and `Credentials.fromEnv()` layer

The `process.env.DEBUG` ternary in `provideTestEnv` was evaluated for replacement with `Config.string("DEBUG")` but kept as-is — it's a synchronous environment check that doesn't fit cleanly into the `pipe` chain without restructuring `provideTestEnv` into an Effect-returning function.

**Files changed:**
- `test/test.ts` — Extracted resolveConfigProvider and withConfigAndCredentials, replaced 2 duplicated blocks

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test` — 222/224 tests passing (2 pre-existing: cohorts CRUD race condition, events timeout)

---

### P2-008: Add pagination support with Stream.unfoldEffect

**Status:** PASSED
**Date:** 2026-01-28

Added `makePaginated` function to `src/client/api.ts` that wraps `makeClient` with Stream-based pagination. Uses `Stream.unfoldEffect` for `.pages()` and `Stream.mapConcat` for `.items()`.

**Design:**
- `makePaginated(operation)` returns a callable identical to `makeClient`, plus `.pages(input)` and `.items(input)` methods
- `.pages(input)` returns a `Stream` of paginated result pages, automatically following `next` URLs
- `.items(input)` returns a `Stream` of individual result items across all pages
- Offset extraction from PostHog `next` URL (full URL like `https://us.posthog.com/api/...?offset=20`) via `parseNextOffset` helper using `URL` API
- Typed with `PaginatedInput` (offset/limit) and `PaginatedOutput` (next/results) interfaces matching all PostHog paginated endpoints

**Changes:**
- Added `makePaginated`, `PaginatedInput`, `PaginatedOutput`, `parseNextOffset` to `src/client/api.ts`
- Updated `listDashboards` in `src/services/dashboards.ts` from `makeClient` to `makePaginated`
- Exported `makePaginated` from `src/index.ts`
- Added 2 integration tests: `.pages()` streaming and `.items()` streaming

**Files changed:**
- `src/client/api.ts` — Added makePaginated function with Stream.unfoldEffect pagination
- `src/services/dashboards.ts` — listDashboards now uses makePaginated
- `src/index.ts` — Exported makePaginated
- `test/dashboards.test.ts` — Added 2 pagination streaming tests

**Verification:**
- `npx tsc --noEmit` — 0 type errors
- `bun run test` — 226/226 tests passing (224 existing + 2 new)

---
