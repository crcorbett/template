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
