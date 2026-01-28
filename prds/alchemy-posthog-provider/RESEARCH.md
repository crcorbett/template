# Research Notes

## Cohort Delete Behavior
- PostHog cohorts use soft delete: `deleteCohort` internally calls `updateCohort` with `deleted: true`
- After soft delete, the cohort is still retrievable via `getCohort` but has `deleted: true` set
- The `@packages/posthog/cohorts` `deleteCohort` function is a convenience wrapper around `updateCohort`
