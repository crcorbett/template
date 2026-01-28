# Research Notes

## FINAL-001

No new discoveries. All existing implementations verified to compile and pass tests successfully.

## FIX-001 / FIX-002: Test Pattern Deviations from alchemy-effect Conventions

### Discovery

Comparison of PostHog provider tests against canonical alchemy-effect provider tests (S3 Bucket, Cloudflare KV Namespace, DynamoDB Table) revealed two deviations from established patterns.

### Issue 1: Missing initial `destroy()` call

**Canonical pattern (S3, Cloudflare):**
```typescript
Effect.gen(function* () {
  yield* destroy();  // Clean up leftover state from failed runs
  class TestBucket extends Bucket("TestBucket", { ... }) {}
  // ...
})
```

**PostHog tests (all 8 files):** No initial `destroy()`. The `destroy()` call only appears at the end of each test. If a test run fails mid-execution, the next run cannot recover — it will attempt to create new resources without cleaning up the old ones.

### Issue 2: Non-deterministic resource names via `Date.now()`

**Canonical pattern:** Fixed, deterministic names:
- `bucketName: "alchemy-test-bucket-crud"` (S3)
- `title: "test-namespace-initial"` (Cloudflare KV)

**PostHog tests (all 8 files):** Non-deterministic names using `Date.now()`:
- `` key: `test-flag-crud-${Date.now()}` `` (FeatureFlag)
- `` name: `Test Dashboard ${Date.now()}` `` (Dashboard)
- `` name: `Test Survey ${Date.now()}` `` (Survey)
- etc.

**Why this matters:** The initial `destroy()` call works by looking up resources by their logical ID in the alchemy state file. With deterministic names, the state from a previous failed run maps to the same physical resources, so `destroy()` can clean them up. With `Date.now()`, each run generates different physical names, so even with an initial `destroy()`, the old resources become orphaned.

**Reference:** alchemy-effect AGENTS.md states: "Never use `Date.now()` when constructing the physical name of a resource."

### Files affected

All 8 provider test files:
- `test/posthog/feature-flags/feature-flag.provider.test.ts`
- `test/posthog/dashboards/dashboard.provider.test.ts`
- `test/posthog/experiments/experiment.provider.test.ts`
- `test/posthog/surveys/survey.provider.test.ts`
- `test/posthog/cohorts/cohort.provider.test.ts`
- `test/posthog/actions/action.provider.test.ts`
- `test/posthog/annotations/annotation.provider.test.ts`
- `test/posthog/insights/insight.provider.test.ts`
