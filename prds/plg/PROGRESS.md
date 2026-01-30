# PLG Stack Progress

## CONST-001 — Add typed event payload schemas to Events
- **Status**: Passed
- **Changed**: `packages/plg/src/events.ts`
- **Summary**: Added `EventPayloads` interface mapping all 14 `EventName` values to their typed property shapes. Uses computed property keys (`[Events.SIGNUP_STARTED]`) so the mapping stays in sync with the `Events` constant. Existing `Events` object and `EventName` type unchanged (backward compatible).
- **Verified**: `bun tsc -b` passes cleanly.

## CONST-002 — Add Plans/PricingTiers and UserProperties constants
- **Status**: Passed
- **Changed**: `packages/plg/src/plans.ts` (new), `packages/plg/src/user-properties.ts` (new), `packages/plg/src/index.ts`, `packages/plg/package.json`
- **Summary**: Created `plans.ts` with `Plans` constant (FREE, STARTER, PRO, ENTERPRISE, TRIAL), `PlanType` union, `BillingIntervals` (MONTHLY, ANNUAL), and `BillingInterval` union. Created `user-properties.ts` with `UserProperties` constant (7 person properties: plan, company, signup_date, lifecycle_stage, last_active, feature_count, is_pql) and `UserPropertyKey` union. Added re-exports in index.ts and export map entries in package.json. Included TRIAL plan to support the `TrialEndingSoonCohort` filter value.
- **Verified**: `bun tsc -b` passes cleanly.
