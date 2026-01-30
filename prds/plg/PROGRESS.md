# PLG Stack Progress

## CONST-001 — Add typed event payload schemas to Events
- **Status**: Passed
- **Changed**: `packages/plg/src/events.ts`
- **Summary**: Added `EventPayloads` interface mapping all 14 `EventName` values to their typed property shapes. Uses computed property keys (`[Events.SIGNUP_STARTED]`) so the mapping stays in sync with the `Events` constant. Existing `Events` object and `EventName` type unchanged (backward compatible).
- **Verified**: `bun tsc -b` passes cleanly

## CONST-002 — Add Plans/PricingTiers and UserProperties constants
- **Status**: Passed
- **Changed**: `packages/plg/src/plans.ts` (new), `packages/plg/src/user-properties.ts` (new), `packages/plg/src/index.ts`, `packages/plg/package.json`
- **Summary**: Created `plans.ts` with `Plans` constant (FREE, STARTER, PRO, ENTERPRISE, TRIAL), `PlanType` union, `BillingIntervals` (MONTHLY, ANNUAL), and `BillingInterval` union. Created `user-properties.ts` with `UserProperties` constant (7 person properties: plan, company, signup_date, lifecycle_stage, last_active, feature_count, is_pql) and `UserPropertyKey` union. Added re-exports in index.ts and export map entries in package.json. Included TRIAL plan to support the `TrialEndingSoonCohort` filter value.
- **Verified**: `bun tsc -b` passes cleanly.

## CONST-003 — Align feature flag and survey constants with stack resources
- **Status**: Passed
- **Changed**: `packages/plg/src/feature-flags.ts`, `packages/plg/src/surveys.ts`, `packages/plg/plg-stack.run.ts`
- **Summary**: Audited all FeatureFlags and Surveys constants against stack resources. 4 of 6 FeatureFlags have provisioned resources; annotated `NEW_NAVIGATION` and `NEW_PRICING_PAGE` with `@pending` JSDoc. 4 of 8 Surveys have provisioned resources; annotated `SUPPORT_CSAT`, `TRIAL_EXIT`, `PERSONA_SURVEY`, `JOBS_TO_BE_DONE` with `@pending` JSDoc. Added comment explaining `$pageview` is a PostHog built-in event in `LowEngagementCohort`. No other magic strings found in the stack.
- **Verified**: `bun tsc -b` passes cleanly.

## STACK-001 — Restore the 10 lost Insights and link them to Dashboards
- **Status**: Passed
- **Changed**: `packages/plg/plg-stack.run.ts`
- **Summary**: Added 10 `Insight` resources organized by dashboard:
  - **Executive** (4): WeeklySignupsInsight, ActivationRateInsight (formula A/B×100), WeeklyUpgradesInsight, WeeklyChurnInsight (downgrades + cancellations)
  - **Product** (3): DailyActiveUsersInsight (DAU math), FeatureAdoptionInsight, RetentionInsight (8-week, RetentionQuery)
  - **Growth** (3): ActivationFunnelInsight (3-step), TimeToActivationInsight (14-day funnelVizType: time_to_convert), UpgradeFunnelInsight
  - All 10 use `Events.*` constants (no magic strings), all have `saved: true`.
  - Dashboard linking via `dashboards` prop is not functional — the provider filters it out. Documented via JSDoc and descriptions reference the intended dashboard.
- **Verified**: `bun tsc -b` passes, `alchemy plan` succeeds with all 10 Insight resources in the plan output.
