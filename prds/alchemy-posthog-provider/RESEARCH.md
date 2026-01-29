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

---

## CONFORM-001 through CONFORM-015: Provider Conformance Audit

### Methodology

Systematic comparison of `@packages/alchemy-posthog/` provider implementation against reference providers in `.context/alchemy-effect/`:

**Reference providers analyzed:**
- `alchemy-effect/src/cloudflare/kv/namespace.provider.ts` (Cloudflare KV)
- `alchemy-effect/src/aws/lambda/function.provider.ts` (Lambda Function)
- `alchemy-effect/src/aws/sqs/queue.provider.ts` (SQS Queue)
- `alchemy-effect/src/aws/dynamodb/table.provider.ts` (DynamoDB Table)

**Reference test infrastructure:**
- `alchemy-effect/src/test.ts` (canonical test helper)
- `alchemy-effect/test/aws/dynamodb/table.provider.test.ts`
- `alchemy-effect/test/cloudflare/kv/namespace.provider.test.ts`

### Finding 1: Effect.fn vs arrow+Effect.gen (CONFORM-001, CONFORM-002)

**Severity: High**

All alchemy-effect providers use `Effect.fn` for lifecycle methods. This is the canonical pattern:

```typescript
// alchemy-effect (correct)
create: Effect.fn(function* ({ id, news, session }) {
  const client = yield* KVClient;
  // ...
})
```

PostHog providers use arrow functions returning `Effect.gen`:

```typescript
// alchemy-posthog (non-conformant)
create: (ctx) => Effect.gen(function* () {
  const projectId = yield* Project;
  // ...
})
```

The `diff` methods additionally use `Effect.sync` instead of `Effect.fn`:

```typescript
// alchemy-posthog (non-conformant)
diff: (news, olds) => Effect.sync(() => {
  if (news.key !== olds.key) return { action: "replace" as const };
})

// alchemy-effect (correct)
diff: Effect.fn(function* (news, olds) {
  if (news.key !== olds.key) return { action: "replace" as const };
})
```

### Finding 2: Test app name collision risk (CONFORM-003)

**Severity: High**

alchemy-effect's test.ts constructs app names that include the test file path:

```typescript
const testPathWithoutExt = testPath.replace(/\.[^.]+$/, "");
App.of({ name: `${testPathWithoutExt}-${name}` })
```

PostHog's test.ts only uses the test name:

```typescript
App.of({ name: `test-${name}` })
```

If two test files have tests with the same name, their state files will collide.

### Finding 3: Test structure (CONFORM-004, CONFORM-005)

**Severity: Medium**

alchemy-effect tests use a flat structure without `describe` blocks and use `@/` path aliases for imports:

```typescript
// alchemy-effect pattern
import { Bucket } from "@/aws/s3";
test("create bucket", { timeout: 120_000 }, Effect.gen(function* () { ... }));
```

PostHog tests wrap in `describe` blocks and use relative imports:

```typescript
// alchemy-posthog pattern
import { FeatureFlag } from "../../../src/posthog/feature-flags/index.js";
describe("PostHog FeatureFlag Provider", () => {
  describe("integration tests", () => {
    test("create, update, delete feature flag", ...);
  });
});
```

### Finding 4: CLI mock and DotAlchemy (CONFORM-006, CONFORM-007)

**Severity: Medium**

alchemy-effect test.ts uses `CLI.of()` constructor for type-safe CLI mocking and includes a `DotAlchemy` layer for state persistence:

```typescript
// alchemy-effect
const cliLayer = Layer.succeed(CLI, CLI.of({ note: Effect.fn(function* () {}) }));
const dotAlchemyLayer = DotAlchemy.layer({ root: ".alchemy" });
```

PostHog test.ts uses `Layer.succeed(CLI, { note: ... })` (no `.of()`) and omits DotAlchemy entirely.

### Finding 5: assertDeleted pattern (CONFORM-008, CONFORM-009, CONFORM-015)

**Severity: Medium/Low**

assertDeleted helpers deviate in three ways:
1. Use arrow+Effect.gen instead of Effect.fn
2. Use `Schedule.compose` instead of `Schedule.intersect`
3. Catch `PostHogError` and check `error.code === "404"` string instead of using typed `NotFoundError` tags

### Finding 6: Provider-level context (CONFORM-010)

**Severity: Low**

alchemy-effect providers yield shared context (Region, Account) once at the provider level, then close over it in lifecycle methods. PostHog providers yield `Project` independently in each lifecycle method, creating duplication.

### Finding 7: read fallback lookup (CONFORM-012)

**Severity: Low-Medium**

alchemy-effect providers implement name-based fallback in `read` when output is missing (state lost). For example, Cloudflare KV lists all namespaces and matches by title. PostHog providers return `undefined` when output is missing, which means state persistence failures cannot be recovered.

### Finding 8: Minor issues (CONFORM-011, CONFORM-013, CONFORM-014)

**Severity: Low**

- No explicit return type annotations on provider functions
- Layer composition may be missing DotAlchemy requirement
- .env path resolution differs from alchemy-effect convention
