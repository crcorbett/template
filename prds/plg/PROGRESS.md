# PLG Stack Progress

## STACK-003: Fix DeploymentAnnotation date and webhook placeholder URLs

**Status**: Passed

### Changes

1. **Removed `DeploymentAnnotation` entirely** (Option C)
   - `new Date().toISOString()` was evaluated at module import time, causing every `alchemy plan` to show drift
   - Annotations are per-deploy artifacts — they belong in CI pipelines, not static IaC
   - Removed the `Annotation` import and the resource from the `resources` array

2. **Documented webhook placeholder URLs with JSDoc**
   - `Config.string()` cannot be used in static resource class props (they're evaluated at class definition time, outside any Effect generator)
   - Added JSDoc to `DealChangesWebhook` and `CompanyChangesWebhook` explaining the placeholder URLs and referencing `ATTIO_DEAL_WEBHOOK_URL` / `ATTIO_COMPANY_WEBHOOK_URL` env vars
   - Future improvement: create a wrapper function that reads Config and constructs webhook resources dynamically

### Verification

- `bun tsc -b` passes clean
- `alchemy plan` runs without errors
- No annotation drift on repeated plan runs

## STACK-004: Ensure cohorts use UserProperties/Plans constants instead of magic strings

**Status**: Passed

### Changes

1. **Imported `Plans` and `UserProperties`** into `plg-stack.run.ts` from `./src/index.js`
2. **Replaced magic strings in `TrialEndingSoonCohort`**:
   - `key: "plan"` → `key: UserProperties.PLAN`
   - `value: "trial"` → `value: Plans.TRIAL`
3. **Audited all other cohorts** — no remaining unexplained magic strings:
   - `PowerUsersCohort`: uses `Events.FEATURE_USED` ✓
   - `NewUsersCohort`: uses `Events.SIGNUP_COMPLETED` ✓
   - `LowEngagementCohort`: uses `"$pageview"` (PostHog built-in, documented with comment) ✓
   - `ExpansionCandidatesCohort`: uses `Events.FEATURE_USED` ✓

### Verification

- `bun tsc -b` passes clean
- All cohort filters use constants or documented built-ins

## SDK-001: Create type-safe PLG SDK client for tracking events with PostHog

**Status**: Passed

### Changes

1. **Created `src/sdk/track.ts`**
   - `PostHogClient` interface: minimal contract requiring `capture(event, properties)`
   - `PlgClient` interface: generic `track<E extends EventName>(event, properties: EventPayloads[E])` enforces payload shape at compile time
   - `createPlgClient(posthog)` factory wraps capture with type safety

2. **Created `src/sdk/identify.ts`**
   - `UserPropertyMap` interface: maps person property keys to typed values (plan → PlanType, lifecycle_stage → LifecycleStage, is_pql → boolean, etc.)
   - `PostHogIdentifyClient` interface: minimal contract requiring `identify(distinctId, properties)`
   - `identify(posthog, distinctId, properties)` function enforces Partial<UserPropertyMap>

3. **Created `src/sdk/index.ts`** — barrel export for all SDK types and functions

4. **Updated `src/index.ts`** — added `export * from "./sdk/index.js"`

5. **Updated `package.json`** — added `./sdk` export entry with source/types/default conditions

### Verification

- `bun tsc -b` passes clean
- Type-level tests confirm: `track(FEATURE_USED, {})` fails, `track(FEATURE_USED, {feature:'x'})` passes, `track(SIGNUP_COMPLETED, {method:'invalid'})` fails
- `identify` enforces UserPropertyMap types (PlanType, LifecycleStage, boolean for is_pql)

## SDK-002: Create type-safe Attio sync helpers for CRM updates

**Status**: Passed

### Changes

1. **Created `src/sdk/attio-sync.ts`** — 6 typed helper functions for Attio CRM updates:
   - `updateLifecycleStage(companyId, stage: LifecycleStage)` — sets company lifecycle stage
   - `updateChurnRisk(companyId, risk: ChurnRiskLevel)` — sets company churn risk level
   - `updateHealthScore(companyId, score: number)` — sets company health score (0–100)
   - `updateMrr(companyId, mrrCents: number)` — sets company MRR in cents
   - `updateProductRole(personId, role: ProductRole)` — sets person product role
   - `markAsPql(dealId)` — marks a deal as PQL (sets `is_pql: true`)

2. **All methods use `Records.updateRecord`** from `@packages/attio` with `AttioAttributes` constants for attribute slugs

3. **Each returns `Effect<void, AttioErrorType, AttioDeps>`** where `AttioDeps = HttpClient | Credentials | Endpoint`

4. **Updated `src/sdk/index.ts`** — added all 6 functions to barrel export

### Verification

- `bun tsc -b` passes clean
- Each method enforces correct value types via function signatures
- All attribute slugs reference `AttioAttributes` constants (no magic strings)

## SDK-003: Create PLG automation helpers for common cross-system workflows

**Status**: Passed

### Changes

1. **Created `src/sdk/automations.ts`** — 6 Effect-based automation functions composing PostHog tracking + Attio CRM updates:
   - `onSignupCompleted(plg, params)` — tracks SIGNUP_COMPLETED + sets lifecycle stage to Trial
   - `onActivation(plg, params)` — tracks ONBOARDING_COMPLETED + sets lifecycle stage to Active + assigns product role (concurrent Attio calls)
   - `onUpgrade(plg, params)` — tracks PLAN_UPGRADED + updates MRR + sets lifecycle stage to Expanding (concurrent)
   - `onDowngrade(plg, params)` — tracks PLAN_DOWNGRADED + updates MRR + sets churn risk to High (concurrent)
   - `onChurnSignal(params)` — CRM-only: sets churn risk to High + lifecycle stage to At Risk (no PostHog event)
   - `onCancellation(plg, params)` — tracks ACCOUNT_CANCELLED + sets lifecycle stage to Churned

2. **Used type intersections** (`EventPayloads[typeof Events.X] & { companyId: string }`) instead of `interface extends` — TypeScript does not allow extending a computed index access type with `interface`

3. **Updated `src/sdk/index.ts`** — exported all 6 functions + 6 param types

### Verification

- `bun tsc -b` passes clean
- All automation functions compose PostHog tracking and Attio CRM updates
- Parameters are fully typed using PLG constants (EventPayloads intersection types)
- All return `Effect<void, AttioErrorType, AttioDeps>`
