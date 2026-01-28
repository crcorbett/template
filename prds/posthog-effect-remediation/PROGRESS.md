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
