# Progress Log

## COH-003: Implement Cohort provider integration tests
- Created `test/posthog/cohorts/cohort.provider.test.ts` with full create/update/delete lifecycle test
- Cohort uses soft delete (PATCH `deleted: true` via `updateCohort`)
- `assertCohortDeleted` checks for `deleted: true` field, `NotFoundError`, or `PostHogError` with 404 code
- Both `bun tsc -b` and `bun vitest run` pass successfully
