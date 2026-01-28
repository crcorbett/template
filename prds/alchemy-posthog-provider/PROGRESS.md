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
