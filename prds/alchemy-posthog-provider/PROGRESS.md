# Progress Log

**Plan:** alchemy-effect PostHog Provider  
**Started:** 2025-01-28  
**Branch:** feat/alchemy-posthog

---

## Session Log

### SETUP-001 - Add distilled-posthog dependency and PostHog package.json export entries
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created new `@packages/alchemy-posthog` package at `packages/alchemy-posthog/` with:
  - `@packages/posthog: workspace:*` (distilled-posthog equivalent) dependency
  - `alchemy-effect: 0.6.0` (npm) dependency
  - 10 export entries (root `.` + `./posthog` + 8 service subpaths)
  - tsconfig.json extending repo base
  - Added to root tsconfig.json references
  - `bun install` completed successfully

### SETUP-002 - Create PostHog stage config augmentation and shared infrastructure files
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created 4 infrastructure files in `packages/alchemy-posthog/src/posthog/`:
  - `config.ts` — PostHogStageConfig interface + module augmentation of `alchemy-effect` StageConfig
  - `project.ts` — Project Context.Tag (`PostHog::ProjectId`) with `fromStageConfig()` reading from stage config or `POSTHOG_PROJECT_ID` env
  - `credentials.ts` — Bridge to `@packages/posthog` Credentials from stage config `apiKey` or `POSTHOG_API_KEY` env
  - `endpoint.ts` — Bridge to `@packages/posthog` Endpoint from stage config or default `https://us.posthog.com`
  - `bun tsc -b` passes with no errors

### SETUP-003 - Create PostHog cloud-level index.ts with empty resources() and providers() composition
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/index.ts` with:
  - `resources()` returning `Layer.empty` (will be populated with `Layer.mergeAll()` as providers are added)
  - `providers()` composing resources with Project, Credentials, Endpoint, and FetchHttpClient layers
  - Side-effect import of `./config.js` for module augmentation
  - Re-export of `Project` from `./project.js`
  - Created 8 empty placeholder barrel files for all service subpaths
  - `bun tsc -b` passes with no errors

### FF-001 - Implement FeatureFlag resource contract
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/feature-flags/feature-flag.ts` with:
  - `FeatureFlagProps` interface with JSDoc: key (required), name, active, filters, rolloutPercentage, ensureExperienceContinuity
  - `FeatureFlagAttrs` interface: id (number), key, name, active, filters, createdAt
  - `FeatureFlag` interface extending `Resource<"PostHog.FeatureFlags.FeatureFlag", ...>`
  - `FeatureFlag` const exported via `Resource<CtorSignature>()` factory
  - Updated `feature-flags/index.ts` barrel to export all from `feature-flag.js`
  - `bun tsc -b` passes with no errors

### FF-002 - Implement FeatureFlag provider with CRUD lifecycle
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/feature-flags/feature-flag.provider.ts` with:
  - `featureFlagProvider()` function using `FeatureFlag.provider.effect(Effect.gen(...))`
  - `stables: ['id', 'key']` for stable properties
  - `diff` using `Effect.sync()` to detect key changes -> replace action
  - `read` with NotFoundError handling returning undefined
  - `create` mapping camelCase props to snake_case API params
  - `update` with session.note() for progress reporting
  - `delete` with soft delete via deleteFeatureFlag and NotFoundError handling
  - Helper `mapResponseToAttrs()` for API response mapping
  - Updated `feature-flags/index.ts` to export provider
  - Updated `posthog/index.ts` with FeatureFlags namespace export and `resources()` using `Layer.mergeAll()`
  - `bun tsc -b` passes with no errors

### FF-003 - Implement FeatureFlag provider integration tests
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created integration tests for FeatureFlag provider:
  - Test helper at `test/posthog/test.ts` providing alchemy-effect layers (App, State, CLI) and PostHog layers (Credentials, Endpoint)
  - vitest.config.ts with path aliases for @packages/posthog imports
  - Test 1: "create, update, delete feature flag" - exercises full CRUD lifecycle, verifies via direct API calls
  - Test 2: "replace feature flag on key change" - verifies key change triggers replacement with new ID
  - `assertFeatureFlagDeleted` helper checks for soft delete (`deleted: true` field) rather than NotFoundError
  - Both tests pass with POSTHOG_API_KEY and POSTHOG_PROJECT_ID env vars set
  - `bun tsc -b` and `bun vitest run test/posthog/feature-flags/feature-flag.provider.test.ts` pass

### DASH-001 - Implement Dashboard resource contract
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/dashboards/dashboard.ts` with:
  - `DashboardProps` interface with JSDoc: name (required), description, pinned, tags, restrictionLevel (all optional except name)
  - `DashboardAttrs` interface: id (number, stable), name, description, pinned, createdAt
  - `Dashboard` interface extending `Resource<"PostHog.Dashboards.Dashboard", ...>`
  - `Dashboard` const exported via `Resource<CtorSignature>()` factory
  - Updated `dashboards/index.ts` barrel to export all from `dashboard.js`
  - `bun tsc -b` passes with no errors

### DASH-002 - Implement Dashboard provider with CRUD lifecycle
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/dashboards/dashboard.provider.ts` with:
  - `dashboardProvider()` function using `Dashboard.provider.effect(Effect.gen(...))`
  - `stables: ['id']` - only id is stable (no replacement triggers)
  - `diff` always returns undefined (all changes are updates)
  - `read` with output.id check and NotFoundError handling
  - `create` mapping props to API params (restrictionLevel -> restriction_level)
  - `update` with session.note() for progress reporting
  - `delete` using PostHog's soft delete (deleteDashboard patches deleted:true)
  - Helper `mapResponseToAttrs()` for API response mapping
  - Updated `dashboards/index.ts` to export provider
  - Updated `posthog/index.ts` with Dashboards namespace export and added `dashboardProvider()` to `resources()`
  - `bun tsc -b` passes with no errors

### DASH-003 - Implement Dashboard provider integration tests
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created integration tests for Dashboard provider:
  - Test file at `test/posthog/dashboards/dashboard.provider.test.ts`
  - Test: "create, update, delete dashboard" - exercises full CRUD lifecycle, verifies via direct API calls
  - Added `@packages/posthog/dashboards` and `@packages/posthog/errors` path aliases to vitest.config.ts
  - Discovery: PostHog dashboards return HTTP 404 after soft delete (unlike feature flags which return `deleted: true` in the response)
  - `assertDashboardDeleted` helper catches both `NotFoundError` and `PostHogError` with code "404"
  - Updated RESEARCH.md with Dashboard soft delete behavior documentation
  - `bun tsc -b` and `bun vitest run test/posthog/dashboards/dashboard.provider.test.ts` pass

### EXP-001 - Implement Experiment resource contract
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/experiments/experiment.ts` with:
  - `ExperimentProps` interface with JSDoc: name (required), featureFlagKey (required, replaces), description, startDate, endDate, parameters, filters, holdoutId, type, metrics, metricsSecondary
  - `ExperimentAttrs` interface: id (number, stable), name, featureFlagKey (stable), startDate, endDate, archived, createdAt
  - `Experiment` interface extending `Resource<"PostHog.Experiments.Experiment", ...>`
  - `Experiment` const exported via `Resource<CtorSignature>()` factory
  - Updated `experiments/index.ts` barrel to export all from `experiment.js`
  - `bun tsc -b` passes with no errors

### EXP-002 - Implement Experiment provider with CRUD lifecycle
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/experiments/experiment.provider.ts` with:
  - `experimentProvider()` function using `Experiment.provider.effect(Effect.gen(...))`
  - `stables: ['id', 'featureFlagKey']` - both id and featureFlagKey are stable
  - `diff` using `Effect.sync()` to detect featureFlagKey changes -> replace action
  - `read` with output.id check and NotFoundError handling
  - `create` mapping props to snake_case API params (featureFlagKey -> feature_flag_key, startDate -> start_date, endDate -> end_date, holdoutId -> holdout_id, metricsSecondary -> metrics_secondary)
  - `update` with session.note() for progress reporting
  - `delete` using soft delete via `updateExperiment({ archived: true })` (PostHog experiments API returns 405 for HTTP DELETE)
  - Helper `mapResponseToAttrs()` for API response mapping
  - Added `@packages/posthog/experiments` alias to vitest.config.ts
  - Updated `experiments/index.ts` to export provider
  - Updated `posthog/index.ts` with Experiments namespace export and added `experimentProvider()` to `resources()`
  - `bun tsc -b` passes with no errors

### EXP-003 - Implement Experiment provider integration tests
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created integration tests for Experiment provider:
  - Test file at `test/posthog/experiments/experiment.provider.test.ts`
  - Test 1: "create, update, delete experiment" - exercises full CRUD lifecycle, verifies via direct API calls
  - Test 2: "replace experiment on feature flag key change" - verifies featureFlagKey change triggers replacement with new ID
  - **CRITICAL FIX:** PostHog experiments API returns 405 for HTTP DELETE. Fixed `experiment.provider.ts` to use soft delete via `updateExperiment({ archived: true })` instead of `deleteExperiment()`
  - `assertExperimentDeleted` helper checks for `archived: true` field (similar to feature flags' `deleted: true` pattern)
  - Updated RESEARCH.md with experiment soft delete behavior documentation
  - `bun tsc -b` and `bun vitest run test/posthog/experiments/experiment.provider.test.ts` pass (2 tests)

### SRV-001 - Implement Survey resource contract
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/surveys/survey.ts` with:
  - `SurveyProps` interface with JSDoc: name (required), type (required, replaces on change), description, questions, appearance, startDate, endDate, responsesLimit, linkedFlagId
  - `SurveyAttrs` interface: id (string UUID, stable), name, type (stable), startDate, endDate, archived, createdAt
  - Key difference from other resources: Survey IDs are string UUIDs, not numbers
  - `Survey` interface extending `Resource<"PostHog.Surveys.Survey", ...>`
  - `Survey` const exported via `Resource<CtorSignature>()` factory
  - Updated `surveys/index.ts` barrel to export all from `survey.js`
  - `bun tsc -b` passes with no errors

### SRV-002 - Implement Survey provider with CRUD lifecycle
- **Status:** PASSED
- **Date:** 2025-01-28
- **Summary:** Created `src/posthog/surveys/survey.provider.ts` with:
  - `surveyProvider()` function using `Survey.provider.effect(Effect.gen(...))`
  - `stables: ['id', 'type']` — id and type are stable properties
  - `diff` using `Effect.sync()` to detect type changes -> replace action
  - `read` with output.id check and NotFoundError handling (id is string UUID)
  - `create` mapping camelCase props to snake_case API params (startDate -> start_date, endDate -> end_date, responsesLimit -> responses_limit, linkedFlagId -> linked_flag_id)
  - `update` with session.note() for progress reporting
  - `delete` using hard HTTP DELETE via `deleteSurvey()` with NotFoundError handling
  - Helper `mapResponseToAttrs()` for API response mapping
  - Updated `surveys/index.ts` to export provider
  - Updated `posthog/index.ts` with Surveys namespace export and added `surveyProvider()` to `resources()`
  - `bun tsc -b` passes with no errors

---

## Task Status Summary

| Category | Total | Completed | In Progress | Pending |
|----------|-------|-----------|-------------|---------|
| Setup | 3 | 3 | 0 | 0 |
| FeatureFlag | 3 | 3 | 0 | 0 |
| Dashboard | 3 | 3 | 0 | 0 |
| Experiment | 3 | 3 | 0 | 0 |
| Survey | 3 | 2 | 0 | 1 |
| Cohort | 3 | 0 | 0 | 3 |
| Action | 3 | 0 | 0 | 3 |
| Annotation | 3 | 0 | 0 | 3 |
| Insight | 3 | 0 | 0 | 3 |
| Final | 2 | 0 | 0 | 2 |
| **Total** | **29** | **14** | **0** | **15** |
