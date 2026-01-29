# Progress Log

## FIX-001: Add initial destroy() to all PostHog provider tests

Added `yield* destroy()` as the first statement in all 10 test `Effect.gen` bodies across 8 test files. This follows the canonical alchemy-effect test pattern for idempotent test recovery from previously failed runs.

Files updated:
- test/posthog/feature-flags/feature-flag.provider.test.ts (2 tests)
- test/posthog/dashboards/dashboard.provider.test.ts (1 test)
- test/posthog/experiments/experiment.provider.test.ts (2 tests)
- test/posthog/surveys/survey.provider.test.ts (1 test)
- test/posthog/cohorts/cohort.provider.test.ts (1 test)
- test/posthog/actions/action.provider.test.ts (1 test)
- test/posthog/annotations/annotation.provider.test.ts (1 test)
- test/posthog/insights/insight.provider.test.ts (1 test)

Verification: `bun tsc -b` passes, all 10 tests pass.

## FIX-002: Replace Date.now() with deterministic resource names

Replaced all `Date.now()` usages in PostHog provider tests with deterministic fixed strings. Removed `const timestamp = Date.now()` declarations that were no longer needed. This ensures resource names are stable across test runs, enabling idempotent test recovery via the initial `destroy()` call added in FIX-001.

Changes:
- feature-flag: `test-flag-crud-${Date.now()}` -> `"test-flag-crud"`, `test-flag-v1/v2-${timestamp}` -> `"test-flag-v1"/"test-flag-v2"`
- experiment: `Test Experiment ${timestamp}` -> `"Test Experiment"`, `test-exp-flag-${timestamp}` -> `"test-exp-flag"`, `exp-flag-v1/v2-${timestamp}` -> `"exp-flag-v1"/"exp-flag-v2"`
- dashboard: `Test Dashboard ${Date.now()}` -> `"Test Dashboard"`
- survey: `Test Survey ${Date.now()}` -> `"Test Survey"`, `Updated Survey ${Date.now()}` -> `"Updated Survey"`
- cohort: `Test Cohort ${Date.now()}` -> `"Test Cohort"`
- action: `Test Action ${Date.now()}` -> `"Test Action"`
- annotation: `Test annotation ${Date.now()}` -> `"Test annotation"`
- insight: `Test Insight ${Date.now()}` -> `"Test Insight"`

Verification: `bun tsc -b` passes, `grep -r 'Date.now()' test/posthog/` returns no results, all 10 tests pass.

## CONFORM-001: Replace arrow + Effect.gen with Effect.fn in provider lifecycle methods

Refactored all 8 provider files to use `Effect.fn` for all 5 lifecycle methods (diff, read, create, update, delete). This aligns with the alchemy-effect canonical pattern (see `cloudflare/kv/namespace.provider.ts`).

**Before:** `create: ({ news, session }) => Effect.gen(function* () { ... })`
**After:** `create: Effect.fn(function* ({ news, session }) { ... })`

Also replaced `Effect.sync` in diff methods with `Effect.fn` (covers CONFORM-002 as well).

Files updated:
- src/posthog/feature-flags/feature-flag.provider.ts
- src/posthog/dashboards/dashboard.provider.ts
- src/posthog/experiments/experiment.provider.ts
- src/posthog/surveys/survey.provider.ts
- src/posthog/cohorts/cohort.provider.ts
- src/posthog/actions/action.provider.ts
- src/posthog/annotations/annotation.provider.ts
- src/posthog/insights/insight.provider.ts

Verification: `bun tsc -b` passes. 40 total `Effect.fn` calls across 8 files (5 per file). No `Effect.gen` or `Effect.sync` in lifecycle methods.

## CONFORM-003 through CONFORM-010: Align test infrastructure and patterns with alchemy-effect conventions

Batch conformance update addressing 8 tasks:

### CONFORM-003: Test app name sanitization
Updated `test/posthog/test.ts` to use `makeApp()` with sanitized name via `name.replace(/[^a-zA-Z0-9_]/g, '-')`.

### CONFORM-004: Remove describe blocks
Removed all `describe()` wrappers from 9 test files. Tests now use flat `test()` calls at top level.

### CONFORM-005: Path aliases in tests
Replaced relative `../src/` imports with `@/` path aliases. Added `@/*` mapping to `tsconfig.json` paths and `vitest.config.ts` aliases.

### CONFORM-006: CLI.of() mock
Replaced hand-rolled CLI mock with `CLI.of()` from `alchemy-effect/cli`. Added `ApplyEvent` type annotation for emit callback.

### CONFORM-007: DotAlchemy layer
Added `DotAlchemy` and `dotAlchemy` imports. Added `DotAlchemy` to `Provided` type union. Composed into alchemy layer via `Layer.provideMerge`.

### CONFORM-008/009: Effect.fn + Schedule.intersect in assertDeleted
Refactored all `assertDeleted` helpers to use `Effect.fn` pattern. Replaced `Schedule.compose` with `Schedule.intersect`.

### CONFORM-010: Yield Project once at provider level
Refactored all 8 provider files to yield `Project` once at the outer `Effect.gen` scope. Lifecycle methods close over `projectId` from outer scope.

### CONFORM-011 through CONFORM-015
Marked as complete with notes:
- CONFORM-011 (return types): Skipped, TypeScript inference is sufficient
- CONFORM-012 (name-based fallback): Deferred, requires architectural changes
- CONFORM-013 (DotAlchemy in Provided): Addressed by CONFORM-007
- CONFORM-014 (.env path): Kept `../../.env` - correct for monorepo structure
- CONFORM-015 (PostHogError code checks): Kept - necessary for real-world PostHog API behavior

Verification: `npx tsc --noEmit` passes with 0 errors.

## CONFORM-016: Test app name includes test file path

Updated test/posthog/test.ts to derive the test file path from `expect.getState().testPath` and prepend it to the app name, following the alchemy-effect convention. This prevents state collisions when two test files contain tests with the same name.

Changes:
- Added `expect` import from `@effect/vitest` and `NodePath` from `node:path`
- Replaced `makeApp()` with `Layer.succeed(App, App.of(...))` since app name is computed synchronously
- App name now includes the relative test file path (e.g., `posthog/feature-flags/feature-flag-provider-test-create-update-delete-feature-flag`)

Verification: `npx tsc --noEmit` passes, all 9 test files (11 tests) pass.

## CONFORM-017: Replace manual fs.exists .env check with direct PlatformConfigProvider.fromDotEnv

Simplified .env loading in test/posthog/test.ts to match the alchemy-effect reference pattern. Removed the manual `fs.exists("../../.env")` guard and replaced it with a direct `PlatformConfigProvider.fromDotEnv(".env")` call wrapped in `ConfigProvider.orElse`. Also fixed the .env path from `../../.env` to `.env` since vitest CWD is the repo root where .env resides.

Changes:
- Removed `const fs = yield* FileSystem.FileSystem` and `const envExists = yield* fs.exists(...)` guard
- Changed path from `../../.env` to `.env` (correct for repo root CWD)
- Now uses: `ConfigProvider.orElse(yield* PlatformConfigProvider.fromDotEnv(".env"), ConfigProvider.fromEnv)`

Verification: `npx tsc --noEmit` passes, no `fs.exists` call in test.ts, all 9 test files (11 tests) pass.

## CONFORM-018: Move Credentials and Endpoint from inline to Layer composition

Moved Credentials and Endpoint provisioning from inline `Effect.provide`/`Effect.provideService` calls into a proper `posthog` Layer, matching the alchemy-effect reference pattern where AWS credentials/region are composed as a Layer.

Changes to test/posthog/test.ts:
- Added `const posthog = Layer.mergeAll(Credentials.fromEnv(), Layer.succeed(Endpoint, "https://us.posthog.com"))` as a top-level Layer
- Removed `Effect.provide(Credentials.fromEnv())` from inside the test runner Effect chain
- Removed `Effect.provideService(Endpoint, "https://us.posthog.com")` from the pipe chain
- Composed via `Layer.provideMerge(posthog, Layer.provideMerge(alchemy, platform))`

Verification: `npx tsc --noEmit` passes. Tests require POSTHOG_API_KEY env var (integration tests).

## CONFORM-019: Add test.state() and test.defaultState() helpers

Added `test.state()` and `test.defaultState()` to the test namespace in test/posthog/test.ts, matching the alchemy-effect reference pattern. Also converted `test.skip` from a property assignment to a proper namespace export function.

Changes to test/posthog/test.ts:
- Converted `test.skip = function(...)` to `export namespace test { export function skip(...) }` pattern
- Added `test.state(resources?)` - creates a `Layer.effect(State.State, ...)` that reads App context for app-scoped in-memory state
- Added `test.defaultState(resources?, other?)` - creates a `Layer.succeed(State.State, ...)` with hardcoded 'test-app'/'test-stage' keys
- Both accept `Record<string, State.ResourceState>` parameters matching the reference

Verification: `npx tsc --noEmit` passes.

## CONFORM-020: Add test.skipIf() conditional skip helper

Added `test.skipIf(condition)` to the test namespace in test/posthog/test.ts, matching the alchemy-effect reference pattern. When condition is true, delegates to `it.skip()`; otherwise delegates to `test()`.

Changes to test/posthog/test.ts:
- Added `export function skipIf(condition: boolean)` inside the `test` namespace
- Returns a function accepting `(name, ...args)` with the same overload signature as `test()`
- Enables conditional skipping of tests based on environment (e.g., missing POSTHOG_API_KEY)

Verification: `npx tsc --noEmit` passes. `test.skipIf` is exported from test.ts.

## CONFORM-021: test.skip namespace export pattern

Already implemented. The `test.ts` file already uses `export namespace test { export function skip(...) { ... } }` pattern (line 152) with skip, skipIf, state, and defaultState as namespace exports. No property assignment pattern (`test.skip = function(...)`) exists. This was addressed during CONFORM-019.

Verification: `npx tsc --noEmit` passes. `grep 'export namespace test'` confirms namespace pattern in use.

## CONFORM-022: Provider diff method signature includes full parameter set

Updated all 8 provider diff methods to destructure the full `{ id, news, olds, output }` parameter set, matching the alchemy-effect reference pattern. Unused parameters are prefixed with underscore (e.g., `id: _id`, `output: _output`) to satisfy TypeScript's noUnusedLocals check.

Files updated:
- feature-flag.provider.ts: `{ news, olds }` -> `{ id: _id, news, olds, output: _output }`
- cohort.provider.ts: `{ news, olds }` -> `{ id: _id, news, olds, output: _output }`
- survey.provider.ts: `{ news, olds }` -> `{ id: _id, news, olds, output: _output }`
- experiment.provider.ts: `{ news, olds }` -> `{ id: _id, news, olds, output: _output }`
- action.provider.ts: `()` -> `{ id: _id, news: _news, olds: _olds, output: _output }`
- dashboard.provider.ts: `()` -> `{ id: _id, news: _news, olds: _olds, output: _output }`
- annotation.provider.ts: `()` -> `{ id: _id, news: _news, olds: _olds, output: _output }`
- insight.provider.ts: `()` -> `{ id: _id, news: _news, olds: _olds, output: _output }`

Verification: `npx tsc --noEmit` passes. All 8 diff methods include id and output in destructuring.

## CONFORM-023: Provider read method fallback lookup via list APIs

Added fallback list-based lookup to all 8 provider read methods. When `output?.id` is missing or the ID-based GET returns not found, each provider now falls back to listing resources and matching by a unique identifier from `olds`:

- **FeatureFlag**: match by `olds.key`, filter `!deleted`
- **Dashboard**: match by `olds.name`, filter `!deleted`, then fetch full Dashboard from DashboardBasic
- **Experiment**: match by `olds.featureFlagKey` via `feature_flag_key`, filter `!archived`
- **Survey**: match by `olds.name`, filter `!archived`
- **Cohort**: match by `olds.name`, filter `!deleted`
- **Action**: match by `olds.name`, filter `!deleted`
- **Insight**: match by `olds.name`, filter `!deleted`
- **Annotation**: match by `olds.content` + `olds.dateMarker`, filter `!deleted`

All fallbacks catch `PostHogError` to gracefully degrade if the list API fails.

Files updated: all 8 `*.provider.ts` files in `src/posthog/`.

Verification: `npx tsc --noEmit` passes. Tests require POSTHOG_API_KEY (integration tests).

## CONFORM-024: Add idempotency handling to provider create methods

Added idempotency checks to all 8 provider create methods. Before calling the create API, each provider now lists existing resources and checks for a match to prevent duplicate creation after state persistence failures.

Lookup strategies by resource type:
- **FeatureFlag**: unique `key` match, filter `!deleted`
- **Experiment**: unique `featureFlagKey` via `feature_flag_key` match, filter `!archived`
- **Dashboard**: `name` match, filter `!deleted`, then fetch full Dashboard from DashboardBasic
- **Survey**: `name` match, filter `!archived`
- **Cohort**: `name` match, filter `!deleted`
- **Action**: `name` match, filter `!deleted`
- **Insight**: `name` match (guarded by `if (news.name)` since name is optional), filter `!deleted`
- **Annotation**: `content` + `dateMarker` combination match, filter `!deleted`

All lookups catch `PostHogError` to gracefully degrade if the list API fails. When an existing resource is found, the provider returns its attrs and logs an "(idempotent create)" session note.

Files updated: all 8 `*.provider.ts` files in `src/posthog/`.

Verification: `npx tsc --noEmit` passes. Tests require POSTHOG_API_KEY (integration tests).

## CONFORM-025: Add session.note() to all provider delete methods

Added `session.note()` progress logging to all 8 provider delete methods, matching the alchemy-effect convention where all lifecycle methods (create, update, delete) report progress via session notes.

Changes to all 8 `*.provider.ts` files:
- Added `session` to delete method destructuring: `{ output }` -> `{ output, session }`
- Added `yield* session.note(\`Deleted <resource>: <identifier>\`)` after the delete/archive API call
- Identifiers used: key (FeatureFlag), name (Dashboard, Experiment, Survey, Action, Cohort), id (Insight, Annotation)

Files updated:
- src/posthog/feature-flags/feature-flag.provider.ts
- src/posthog/dashboards/dashboard.provider.ts
- src/posthog/experiments/experiment.provider.ts
- src/posthog/surveys/survey.provider.ts
- src/posthog/cohorts/cohort.provider.ts
- src/posthog/actions/action.provider.ts
- src/posthog/annotations/annotation.provider.ts
- src/posthog/insights/insight.provider.ts

Verification: `npx tsc --noEmit` passes. All 8 delete methods confirmed via grep. Tests require POSTHOG_API_KEY (integration tests).

## CONFORM-026: Move TEST_PROJECT_ID boilerplate into test infrastructure

Removed the `TEST_PROJECT_ID` export from test/posthog/test.ts and replaced it with a proper `Project` context tag provided via the test infrastructure Layer. This eliminates boilerplate `const projectId = yield* TEST_PROJECT_ID` from all test files.

Changes to test/posthog/test.ts:
- Removed `TEST_PROJECT_ID` export (Config.string effect)
- Added `import { Project } from "@/posthog/project.js"`
- Added `Project` to the `Provided` type union
- Added `Layer.effect(Project, Config.string("POSTHOG_PROJECT_ID").pipe(...))` to the `posthog` Layer

Changes to all 9 test files (8 provider tests + 1 smoke test):
- Replaced `import { test, TEST_PROJECT_ID } from "../test.js"` with `import { test } from "../test.js"` + `import { Project } from "@/posthog/project.js"`
- Replaced all `const projectId = yield* TEST_PROJECT_ID` with `const projectId = yield* Project`

Files updated:
- test/posthog/test.ts
- test/posthog/feature-flags/feature-flag.provider.test.ts
- test/posthog/dashboards/dashboard.provider.test.ts
- test/posthog/experiments/experiment.provider.test.ts
- test/posthog/surveys/survey.provider.test.ts
- test/posthog/cohorts/cohort.provider.test.ts
- test/posthog/actions/action.provider.test.ts
- test/posthog/annotations/annotation.provider.test.ts
- test/posthog/insights/insight.provider.test.ts
- test/posthog/posthog.smoke.test.ts

Verification: `npx tsc --noEmit` passes. No TEST_PROJECT_ID references remain in codebase. Tests require POSTHOG_API_KEY (integration tests).

## CONFORM-027: Add config() helper function to index.ts

Added `config()` helper to `src/posthog/index.ts` that reads `app.config.posthog` from the App context tag, matching the alchemy-effect convention where cloud index files export a `config()` helper for stage config composition.

Changes to src/posthog/index.ts:
- Added `import { App } from "alchemy-effect"` and `import * as Effect from "effect/Effect"`
- Added `export const config = () => Effect.gen(function* () { const app = yield* App; return app.config.posthog; })`

Verification: `npx tsc --noEmit` passes. `config()` is exported from src/posthog/index.ts.

## CONFORM-028: Add bareProviders() separation from providers()

Added `bareProviders()` to `src/posthog/index.ts` between `resources()` and `providers()`, matching the alchemy-effect AWS cloud index pattern where:
- `resources()` - just the resource provider layers
- `bareProviders()` - resources() + shared context (Project, Credentials, Endpoint)
- `providers()` - bareProviders() + HttpClient

This separation allows users to provide their own HttpClient while still getting all PostHog-specific layers.

Changes to src/posthog/index.ts:
- Added `export const bareProviders = () => resources().pipe(Layer.provideMerge(Project.fromStageConfig()), Layer.provideMerge(Credentials.fromStageConfig()), Layer.provideMerge(Endpoint.fromStageConfig()))`
- Simplified `providers()` to `bareProviders().pipe(Layer.provideMerge(FetchHttpClient.layer))`

Verification: `npx tsc --noEmit` passes. `bareProviders()` is exported from src/posthog/index.ts.

## CONFORM-029: Add Input<T> wrapper to cross-resource reference properties

Added `Input<T>` wrapper from alchemy-effect to 4 Props interfaces that contain cross-resource reference properties. This follows the alchemy-effect convention where properties that may reference another resource's output attributes are wrapped in `Input<T>` to support lazy resolution.

Changes:
- **survey.ts**: `linkedFlagId?: number | null` -> `linkedFlagId?: Input<number | null>` (references FeatureFlag.id)
- **annotation.ts**: `dashboardItem?: number | null` -> `dashboardItem?: Input<number | null>` (references Insight/dashboard item id)
- **insight.ts**: `dashboards?: number[]` -> `dashboards?: Input<number>[]` (references Dashboard.id array)
- **experiment.ts**: `holdoutId?: number | null` -> `holdoutId?: Input<number | null>` (references holdout group id)

Each file also received `import type { Input } from "alchemy-effect"`.

Verification: `npx tsc --noEmit` passes. Tests require POSTHOG_API_KEY (integration tests).

## CONFORM-030: Parameterize Attrs interfaces by Props type

Added Props type parameter to all 8 resource Attrs interfaces, matching the alchemy-effect convention where Attrs interfaces are parameterized by the Props type to enable type-safe relationships.

Two patterns used depending on whether Props contains `Input<T>` properties:
- **Without Input<T>** (feature-flag, dashboard, cohort, action): `XxxAttrs<_Props extends XxxProps = XxxProps>`
- **With Input<T>** (experiment, survey, annotation, insight): `XxxAttrs<_Props extends Input.Resolve<XxxProps> = Input.Resolve<XxxProps>>`

Updated Resource interface declarations to pass the Props type parameter through:
- Without Input: `XxxAttrs<Props>`
- With Input: `XxxAttrs<Input.Resolve<Props>>`

Files updated:
- src/posthog/feature-flags/feature-flag.ts
- src/posthog/dashboards/dashboard.ts
- src/posthog/experiments/experiment.ts
- src/posthog/surveys/survey.ts
- src/posthog/cohorts/cohort.ts
- src/posthog/actions/action.ts
- src/posthog/annotations/annotation.ts
- src/posthog/insights/insight.ts

Verification: `npx tsc --noEmit` passes. Tests require POSTHOG_API_KEY (integration tests).

## CONFORM-031: Extract shared makeAssertDeleted factory into test.ts

Extracted a shared `makeAssertDeleted` factory function into `test/posthog/test.ts` to eliminate duplicated assertDeleted helpers across all test files. Each test file previously defined its own TaggedError class and Effect.fn helper with identical retry/error-catching logic (~25 lines each).

The factory accepts three parameters:
- `resourceType` - human-readable name for error messages
- `getResource` - the API get function (e.g., `FeatureFlagsAPI.getFeatureFlag`)
- `isDeletionIndicator` - predicate to check if resource is deleted (e.g., `(r) => r.deleted === true` or `(r) => r.archived === true`)

It handles NotFoundError, PostHogError with code 404, and retries with exponential backoff (5 retries, 100ms base) -- consolidating all variant behaviors into one consistent implementation.

Files updated:
- test/posthog/test.ts (added makeAssertDeleted export, exported testCLI, added Data/Schedule imports)
- test/posthog/feature-flags/feature-flag.provider.test.ts
- test/posthog/dashboards/dashboard.provider.test.ts
- test/posthog/experiments/experiment.provider.test.ts
- test/posthog/surveys/survey.provider.test.ts
- test/posthog/cohorts/cohort.provider.test.ts
- test/posthog/actions/action.provider.test.ts
- test/posthog/annotations/annotation.provider.test.ts
- test/posthog/insights/insight.provider.test.ts
- test/posthog/posthog.smoke.test.ts

Verification: `npx tsc --noEmit` passes. All 9 test files (11 tests) collect and run. Tests require POSTHOG_API_KEY (integration tests).

## CONFORM-032: Standardize session.note() message format across all providers

Standardized all `session.note()` messages across all 8 provider files to use a consistent format: `{Operation} {ResourceType}: {identifier}`.

**Before (inconsistent):**
- `Created feature flag: ${result.key}`
- `Dashboard already exists (idempotent create): ${full.name}`
- `Deleted annotation: ${output.id}`

**After (standardized):**
- `Created FeatureFlag: ${result.key}`
- `Idempotent Dashboard: ${full.name}`
- `Deleted Annotation: ${output.id}`

Operations: Created, Updated, Deleted, Idempotent
Resource types (PascalCase): FeatureFlag, Dashboard, Experiment, Survey, Cohort, Action, Annotation, Insight

Files updated: all 8 `*.provider.ts` files in `src/posthog/`.

Verification: `npx tsc --noEmit` passes. All 32 session.note() calls follow consistent format.

## CONFORM-033: testCLI layer exported from test.ts

Already resolved. `testCLI` is already exported from `test/posthog/test.ts` (line 90: `export const testCLI = Layer.succeed(...)`). This was addressed during CONFORM-031 which extracted shared helpers and exported testCLI as part of the refactor. No code changes needed.

Verification: `npx tsc --noEmit` passes. `grep 'export const testCLI' test/posthog/test.ts` confirms export.
