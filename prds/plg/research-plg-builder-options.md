# PLG Stack Builder - Option Taxonomy & Dependency Constraints

> Research document for a web-based PLG (Product-Led Growth) stack builder,
> inspired by [Better T Stack's builder](https://www.better-t-stack.dev/new).
>
> The builder generates a configured `@plg/*` ShadCN registry installation
> plus an `alchemy-effect` IaC script that provisions analytics, CRM, feature
> flags, surveys, and experiments across providers.

---

## Table of Contents

1. [Category Overview](#1-category-overview)
2. [Category Definitions](#2-category-definitions)
3. [Dependency Constraint Rules](#3-dependency-constraint-rules)
4. [Presets](#4-presets)
5. [Generated Artifacts per Selection](#5-generated-artifacts-per-selection)
6. [Mapping to Existing Packages](#6-mapping-to-existing-packages)
7. [Builder UI Flow](#7-builder-ui-flow)

---

## 1. Category Overview

| # | Category | Selection Type | Default |
|---|----------|---------------|---------|
| 1 | Analytics Provider | single-select | PostHog |
| 2 | Feature Flags | single-select | PostHog Flags |
| 3 | Experimentation | single-select | PostHog Experiments |
| 4 | Surveys | single-select | PostHog Surveys |
| 5 | CRM Provider | single-select | Attio |
| 6 | Pricing Model | single-select | Freemium |
| 7 | Plans | dynamic form | (depends on Pricing Model) |
| 8 | Events to Track | multi-select | (preset per pricing model) |
| 9 | Feature Flags to Create | user-defined list | (preset defaults) |
| 10 | IaC Provider | single-select | Alchemy-Effect |
| 11 | Distribution | single-select | ShadCN Registry |

---

## 2. Category Definitions

### 2.1 Analytics Provider

The core event tracking and user identification system.

| Option | Description | SDK / Package |
|--------|-------------|---------------|
| **PostHog** | Open-source product analytics with autocapture, session replay, heatmaps | `posthog-js`, `posthog-node` |
| **Amplitude** | Enterprise product analytics with behavioral cohorting | `@amplitude/analytics-browser` |
| **Mixpanel** | Event analytics with funnel and retention analysis | `mixpanel-browser` |
| **Segment** | Customer Data Platform (CDP) - routes events to downstream tools | `@segment/analytics-next` |
| **None** | No analytics provider; constants-only mode (typed events, no SDK wiring) | - |

**Notes:**
- Segment is a CDP, not a direct analytics tool. When Segment is selected, a downstream analytics destination must also be chosen (PostHog, Amplitude, or Mixpanel).
- Selecting "None" still generates typed event constants and payload interfaces but omits all provider-specific SDK code.

### 2.2 Feature Flags

Runtime feature toggling with targeting rules.

| Option | Description | Requires |
|--------|-------------|----------|
| **PostHog Flags** | Built-in feature flags in PostHog with person property targeting | Analytics = PostHog |
| **LaunchDarkly** | Enterprise feature management platform | - |
| **Statsig** | Feature gates with statistical rigor and auto-experiments | - |
| **GrowthBook** | Open-source feature flagging with Bayesian experimentation | - |
| **None** | No feature flags; all features are always on | - |

### 2.3 Experimentation

A/B testing and multivariate experiments.

| Option | Description | Requires |
|--------|-------------|----------|
| **PostHog Experiments** | Built-in experimentation in PostHog with Bayesian analysis | Analytics = PostHog, Feature Flags = PostHog Flags |
| **Statsig** | Statistical experimentation engine with auto-analysis | Feature Flags != None |
| **Amplitude Experiment** | Server/client-side experimentation | Analytics = Amplitude |
| **GrowthBook Experiments** | Open-source Bayesian experimentation | Feature Flags = GrowthBook |
| **None** | No experimentation framework | - |

### 2.4 Surveys

In-app surveys for NPS, CSAT, churn exit, persona research.

| Option | Description | Requires |
|--------|-------------|----------|
| **PostHog Surveys** | Built-in popover and API surveys in PostHog | Analytics = PostHog |
| **Typeform** | External survey tool with embed/link integration | - |
| **Formbricks** | Open-source in-app survey tool | - |
| **None** | No survey infrastructure | - |

### 2.5 CRM Provider

Customer relationship management for lifecycle tracking, deal pipeline, and PQL routing.

| Option | Description |
|--------|-------------|
| **Attio** | Modern API-first CRM with custom objects, automations |
| **HubSpot** | Enterprise CRM with marketing automation |
| **Salesforce** | Enterprise CRM with AppExchange ecosystem |
| **None** | No CRM integration; analytics-only PLG |

### 2.6 Pricing Model

Determines plan structure, billing logic, and which monetization events are relevant.

| Option | Description | Plan Config Required |
|--------|-------------|---------------------|
| **Free** | Completely free product, no paid tiers | No |
| **Freemium** | Free tier + paid tiers with feature gating | Yes |
| **Free Trial** | Time-limited free access, then paid | Yes |
| **Usage-Based** | Pay per unit of consumption (API calls, seats, storage) | Yes |
| **Seat-Based** | Per-user pricing with tier thresholds | Yes |
| **Custom** | User defines their own pricing structure | Yes |

### 2.7 Plans

Dynamic form that appears when Pricing Model != Free.

| Field | Type | Description |
|-------|------|-------------|
| **Number of tiers** | number (1-10) | How many plan tiers |
| **Tier names** | string[] | e.g., `["free", "starter", "pro", "enterprise"]` |
| **Billing intervals** | multi-select | `monthly`, `annual`, `quarterly` |
| **Trial days** | number (0-90) | Days of free trial (only if Pricing = Free Trial) |
| **Usage metric** | string | Name of the metered dimension (only if Pricing = Usage-Based) |
| **Seat thresholds** | number[] | Per-tier seat limits (only if Pricing = Seat-Based) |

**Default tier configurations per pricing model:**

| Pricing Model | Default Tiers |
|---------------|---------------|
| Freemium | `free`, `starter`, `pro`, `enterprise` |
| Free Trial | `trial`, `starter`, `pro`, `enterprise` |
| Usage-Based | `free`, `growth`, `scale`, `enterprise` |
| Seat-Based | `team`, `business`, `enterprise` |
| Custom | `free`, `pro` |

### 2.8 Events to Track

Multi-select of PLG lifecycle events. Each selected event generates a typed constant, payload interface, and PostHog Action.

| Event | Category | Always Included | Description |
|-------|----------|-----------------|-------------|
| `signup_started` | Acquisition | Yes | User initiated signup flow |
| `signup_completed` | Acquisition | Yes | User completed signup |
| `onboarding_started` | Activation | Yes | User started onboarding |
| `onboarding_completed` | Activation | Yes | User completed onboarding |
| `feature_used` | Engagement | Yes | User engaged with a product feature |
| `session_started` | Engagement | No | Session began |
| `session_ended` | Engagement | No | Session ended |
| `checkout_started` | Monetization | If Pricing != Free | User initiated checkout |
| `checkout_completed` | Monetization | If Pricing != Free | User completed checkout |
| `plan_upgraded` | Monetization | If Pricing != Free | User upgraded plan |
| `plan_downgraded` | Monetization | If Pricing != Free | User downgraded plan |
| `payment_failed` | Monetization | If Pricing != Free | Payment attempt failed |
| `account_cancelled` | Churn | If Pricing != Free | User cancelled account |
| `trial_expired` | Churn | If Pricing = Free Trial | Trial period ended without conversion |
| `invite_sent` | Referral | No | User sent an invitation |
| `invite_accepted` | Referral | No | Invited user accepted |
| `usage_limit_approached` | Usage | If Pricing = Usage-Based | User nearing usage limit |
| `usage_limit_reached` | Usage | If Pricing = Usage-Based | User hit usage limit |
| `seat_added` | Usage | If Pricing = Seat-Based | New seat added to account |
| `seat_removed` | Usage | If Pricing = Seat-Based | Seat removed from account |

### 2.9 Feature Flags to Create

User-defined list of feature flag keys. Each generates a typed constant and, if IaC is enabled, a provisioned flag resource.

**Default flags (always suggested):**

| Flag Key | Description | Default Rollout |
|----------|-------------|-----------------|
| `dark-mode` | UI dark mode toggle | 100% |
| `beta-features` | Beta feature access gate | 10% |
| `new-onboarding-flow` | Experiment: onboarding variant | 0% (experiment) |
| `new-pricing-page` | Experiment: pricing page variant | 0% (experiment) |

**Additional suggested flags (based on selections):**

| Condition | Suggested Flag | Description |
|-----------|---------------|-------------|
| Pricing = Usage-Based | `usage-based-billing-v2` | New usage metering implementation |
| Pricing = Seat-Based | `seat-management-ui` | New seat management interface |
| CRM != None | `crm-sync-enabled` | Toggle CRM data synchronization |
| Any experiment selected | `<experiment-key>` | One flag per experiment |

Users can add, remove, or rename any flag. The builder provides a text input with add/remove controls.

### 2.10 IaC Provider

Infrastructure-as-Code tool for provisioning analytics resources (dashboards, flags, surveys, CRM attributes).

| Option | Description | Output |
|--------|-------------|--------|
| **Alchemy-Effect** | Effect-based IaC with typed resource classes (current stack) | `plg-stack.run.ts` |
| **Terraform** | HashiCorp IaC with HCL configuration | `main.tf` + `variables.tf` |
| **Pulumi** | TypeScript-native IaC | `index.ts` (Pulumi program) |
| **None** | No IaC; constants and SDK code only | - |

### 2.11 Distribution

How the generated PLG code is packaged and consumed.

| Option | Description | Output Structure |
|--------|-------------|------------------|
| **ShadCN Registry** | Publishable ShadCN registry items installable via `npx shadcn add @plg/*` | `registry.json` + `public/r/*.json` |
| **npm Package** | Traditional npm package with `package.json` exports | `packages/plg/` with `src/`, `dist/` |
| **Monorepo Internal** | Workspace package in a monorepo (current structure) | `packages/plg/` referenced via `workspace:*` |

---

## 3. Dependency Constraint Rules

### 3.1 Hard Constraints (MUST)

These constraints are enforced by the builder and cannot be overridden.

```
RULE H1: IF Analytics = None THEN Feature Flags MUST be None
  Reason: Feature flags require user identification from an analytics provider.

RULE H2: IF Feature Flags = None THEN Experimentation MUST be None
  Reason: Experiments require feature flags to split traffic between variants.

RULE H3: IF Analytics = None THEN Surveys MUST be None OR Typeform OR Formbricks
  Reason: PostHog Surveys require the PostHog analytics provider.

RULE H4: IF Pricing Model = Free THEN Plans section is HIDDEN
  Reason: No plan configuration needed for a fully free product.

RULE H5: IF Pricing Model = Free THEN monetization events are EXCLUDED from defaults
  Reason: checkout_*, plan_*, payment_failed events are irrelevant without pricing.

RULE H6: IF Analytics != PostHog THEN Feature Flags CANNOT be PostHog Flags
  Reason: PostHog feature flags are part of the PostHog platform.

RULE H7: IF Analytics != PostHog THEN Surveys CANNOT be PostHog Surveys
  Reason: PostHog surveys are part of the PostHog platform.

RULE H8: IF Analytics != PostHog THEN Experimentation CANNOT be PostHog Experiments
  Reason: PostHog experiments are part of the PostHog platform.

RULE H9: IF Analytics != Amplitude THEN Experimentation CANNOT be Amplitude Experiment
  Reason: Amplitude Experiment requires the Amplitude analytics SDK.

RULE H10: IF Feature Flags != GrowthBook THEN Experimentation CANNOT be GrowthBook Experiments
  Reason: GrowthBook experiments are tightly coupled to GrowthBook feature flags.

RULE H11: IF IaC = None AND CRM != None THEN warn "CRM attributes must be configured manually"
  Reason: Without IaC, CRM custom attributes are not auto-provisioned.
```

### 3.2 Soft Constraints (SHOULD / RECOMMENDED)

These constraints produce warnings but can be overridden.

```
RULE S1: IF Analytics = PostHog THEN Feature Flags SHOULD be PostHog Flags
  Reason: Using PostHog for both analytics and flags gives unified user profiles.

RULE S2: IF Analytics = PostHog AND Feature Flags = PostHog Flags
         THEN Experimentation SHOULD be PostHog Experiments
  Reason: Full PostHog suite gives the most integrated experience.

RULE S3: IF Analytics = PostHog THEN Surveys SHOULD be PostHog Surveys
  Reason: PostHog surveys can target based on analytics cohorts.

RULE S4: IF CRM != None THEN at least one monetization event SHOULD be selected
  Reason: CRM lifecycle tracking requires revenue events for MRR/ARR sync.

RULE S5: IF Experimentation != None THEN at least one experiment flag SHOULD be created
  Reason: Experiments need at least one feature flag to function.

RULE S6: IF Pricing Model = Free Trial THEN trial_expired event SHOULD be selected
  Reason: Trial expiration is a critical churn signal for free trial models.

RULE S7: IF CRM != None THEN IaC SHOULD not be None
  Reason: CRM attribute provisioning is error-prone without IaC automation.
```

### 3.3 Availability Constraints (CAN)

These rules control which options appear in each dropdown.

```
RULE A1: Feature Flags options available:
  - PostHog Flags:  ONLY IF Analytics = PostHog
  - LaunchDarkly:   Always available
  - Statsig:        Always available
  - GrowthBook:     Always available
  - None:           Always available

RULE A2: Experimentation options available:
  - PostHog Experiments:    ONLY IF Analytics = PostHog AND Feature Flags = PostHog Flags
  - Statsig:                ONLY IF Feature Flags != None
  - Amplitude Experiment:   ONLY IF Analytics = Amplitude
  - GrowthBook Experiments: ONLY IF Feature Flags = GrowthBook
  - None:                   Always available

RULE A3: Surveys options available:
  - PostHog Surveys: ONLY IF Analytics = PostHog
  - Typeform:        Always available
  - Formbricks:      Always available
  - None:            Always available

RULE A4: Plans section visible:
  - ONLY IF Pricing Model != Free

RULE A5: Trial-specific fields visible:
  - Trial days: ONLY IF Pricing Model = Free Trial
  - Usage metric: ONLY IF Pricing Model = Usage-Based
  - Seat thresholds: ONLY IF Pricing Model = Seat-Based
```

### 3.4 Cascade Rules

When a parent selection changes, dependent selections are automatically adjusted.

```
CASCADE C1: IF Analytics changes FROM PostHog TO anything else:
  - IF Feature Flags = PostHog Flags THEN Feature Flags -> None
  - IF Surveys = PostHog Surveys THEN Surveys -> None
  - (Experimentation cascades via C2)

CASCADE C2: IF Feature Flags changes TO None:
  - IF Experimentation != None THEN Experimentation -> None

CASCADE C3: IF Analytics changes TO PostHog:
  - Feature Flags suggested -> PostHog Flags (soft, user can dismiss)
  - Surveys suggested -> PostHog Surveys (soft, user can dismiss)

CASCADE C4: IF Pricing Model changes TO Free:
  - Remove all monetization events from Events to Track
  - Hide Plans section

CASCADE C5: IF Pricing Model changes FROM Free TO anything:
  - Add default monetization events to Events to Track
  - Show Plans section with defaults for the new pricing model
```

### 3.5 Constraint Dependency Graph

```
Analytics Provider
  |
  +---> Feature Flags (H1, H6, A1)
  |       |
  |       +---> Experimentation (H2, H8, H9, H10, A2)
  |
  +---> Surveys (H3, H7, A3)
  |
  +---> Events to Track (implicitly: provider determines SDK shape)

Pricing Model
  |
  +---> Plans (H4, A4)
  |
  +---> Events to Track (H5, C4, C5)
  |
  +---> Feature Flags to Create (suggested flags change)

CRM Provider
  |
  +---> IaC Provider (S7, H11)
  |
  +---> Automation helpers (attio-sync, lifecycle stage tracking)

IaC Provider
  |
  +---> Output format (alchemy .run.ts vs terraform .tf vs pulumi index.ts)

Distribution
  |
  +---> Output structure (registry.json vs package.json vs workspace)
```

---

## 4. Presets

Presets pre-fill all categories at once. Users can customize after selecting a preset.

### 4.1 Minimal

For early-stage products that need basic analytics.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | None |
| Experimentation | None |
| Surveys | None |
| CRM | None |
| Pricing Model | Free |
| Plans | (hidden) |
| Events | `signup_started`, `signup_completed`, `onboarding_started`, `onboarding_completed`, `feature_used` |
| Feature Flags | (empty) |
| IaC | None |
| Distribution | npm Package |

**Generated:** Event constants, payload types, basic tracking SDK wrapper. No IaC, no CRM, no surveys.

### 4.2 Growth

For products adding monetization and optimizing conversion.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | PostHog Flags |
| Experimentation | PostHog Experiments |
| Surveys | PostHog Surveys |
| CRM | None |
| Pricing Model | Freemium |
| Plans | `free`, `starter`, `pro`, `enterprise` |
| Events | All acquisition + engagement + monetization events |
| Feature Flags | `dark-mode`, `beta-features`, `new-onboarding-flow`, `new-pricing-page` |
| IaC | Alchemy-Effect |
| Distribution | ShadCN Registry |

**Generated:** Full PostHog stack with typed events, feature flags, experiments, surveys, dashboards, insights, cohorts, and IaC provisioning script. No CRM sync.

### 4.3 Full (Default)

Complete PLG infrastructure spanning analytics and CRM.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | PostHog Flags |
| Experimentation | PostHog Experiments |
| Surveys | PostHog Surveys |
| CRM | Attio |
| Pricing Model | Freemium |
| Plans | `free`, `starter`, `pro`, `enterprise` |
| Events | All events |
| Feature Flags | `dark-mode`, `beta-features`, `new-onboarding-flow`, `new-pricing-page` |
| IaC | Alchemy-Effect |
| Distribution | Monorepo Internal |

**Generated:** Everything from Growth preset plus Attio CRM attributes, lifecycle stages, deal pipeline, webhook configuration, and Effect-based automation helpers (`onSignupCompleted`, `onUpgrade`, etc.).

### 4.4 Enterprise

For products with complex sales pipelines and enterprise CRM needs.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | LaunchDarkly |
| Experimentation | None |
| Surveys | PostHog Surveys |
| CRM | Salesforce |
| Pricing Model | Seat-Based |
| Plans | `team`, `business`, `enterprise` |
| Events | All events + `seat_added`, `seat_removed` |
| Feature Flags | `dark-mode`, `beta-features`, `seat-management-ui`, `crm-sync-enabled` |
| IaC | Terraform |
| Distribution | Monorepo Internal |

**Generated:** PostHog analytics + LaunchDarkly flags + Salesforce CRM sync + Terraform IaC. Separate SDKs for analytics and feature flags.

### 4.5 Self-Hosted / Open-Source

For teams preferring fully open-source tooling.

| Category | Selection |
|----------|-----------|
| Analytics | PostHog |
| Feature Flags | GrowthBook |
| Experimentation | GrowthBook Experiments |
| Surveys | Formbricks |
| CRM | Attio |
| Pricing Model | Freemium |
| Plans | `free`, `pro`, `enterprise` |
| Events | All acquisition + engagement + monetization events |
| Feature Flags | `dark-mode`, `beta-features`, `new-onboarding-flow` |
| IaC | Alchemy-Effect |
| Distribution | ShadCN Registry |

**Generated:** PostHog analytics + GrowthBook flags/experiments + Formbricks surveys + Attio CRM. All tools are self-hostable.

---

## 5. Generated Artifacts per Selection

### 5.1 Constants Layer (always generated)

Regardless of provider choices, the builder always generates typed constants.

| Selection | Generated File | Contents |
|-----------|---------------|----------|
| Events to Track | `src/events.ts` | `Events` const object + `EventPayloads` interface |
| Plans (if applicable) | `src/plans.ts` | `Plans` const + `BillingIntervals` const |
| Feature Flags to Create | `src/feature-flags.ts` | `FeatureFlags` const + `FeatureFlagKey` type |
| Surveys (if not None) | `src/surveys.ts` | `Surveys` const + `SurveyId` type |
| CRM (if not None) | `src/crm.ts` | CRM attribute keys, lifecycle stages, risk levels |
| User Properties | `src/user-properties.ts` | `UserProperties` const for person profile keys |

### 5.2 SDK Layer (generated if Analytics != None)

| Selection | Generated File | Contents |
|-----------|---------------|----------|
| Analytics = PostHog | `src/sdk/track.ts` | `createPlgClient()` wrapping PostHog capture |
| Analytics = Amplitude | `src/sdk/track.ts` | `createPlgClient()` wrapping Amplitude track |
| Analytics = Mixpanel | `src/sdk/track.ts` | `createPlgClient()` wrapping Mixpanel track |
| Analytics = Segment | `src/sdk/track.ts` | `createPlgClient()` wrapping Segment track |
| Any Analytics | `src/sdk/identify.ts` | `identify()` function for user properties |

### 5.3 CRM Sync Layer (generated if CRM != None)

| Selection | Generated File | Contents |
|-----------|---------------|----------|
| CRM = Attio | `src/sdk/attio-sync.ts` | Effect-based Attio record update helpers |
| CRM = HubSpot | `src/sdk/hubspot-sync.ts` | HubSpot API contact/deal update helpers |
| CRM = Salesforce | `src/sdk/salesforce-sync.ts` | Salesforce API lead/opportunity helpers |

### 5.4 Automation Layer (generated if Analytics != None AND CRM != None)

| Generated File | Contents |
|---------------|----------|
| `src/sdk/automations.ts` | Composed lifecycle helpers: `onSignupCompleted`, `onActivation`, `onUpgrade`, `onDowngrade`, `onChurnSignal`, `onCancellation` |

Each automation function:
1. Tracks the PostHog event (via the analytics SDK)
2. Updates the CRM record (via the CRM sync layer)
3. Returns an Effect that composes both operations

### 5.5 IaC Layer (generated if IaC != None)

| IaC Provider | Generated File | PostHog Resources | CRM Resources |
|-------------|---------------|-------------------|---------------|
| Alchemy-Effect | `plg-stack.run.ts` | Actions, Cohorts, Dashboards, Insights, Feature Flags, Surveys, Experiments | Attributes, Select Options, Statuses, Webhooks |
| Terraform | `main.tf` + `variables.tf` | `posthog_action`, `posthog_feature_flag`, `posthog_cohort` | `attio_attribute`, `attio_webhook` |
| Pulumi | `index.ts` | Pulumi PostHog provider resources | Pulumi Attio provider resources |

**PostHog resources generated (when Analytics = PostHog and IaC != None):**

| Resource Type | Generated For |
|--------------|---------------|
| Action | One per selected event |
| Cohort | `PowerUsers`, `NewUsers`, `LowEngagement`, `TrialEndingSoon` (if trial), `ExpansionCandidates` |
| Dashboard | `ExecutiveOverview`, `ProductMetrics`, `GrowthActivation` |
| Insight | Trends (signups, activation rate, upgrades, churn, DAU, feature adoption), Retention, Funnels (activation, time-to-activation, upgrade) |
| Feature Flag | One per user-defined flag key |
| Survey | `PostActivationNPS`, `MonthlyNPS`, `FeatureCSAT`, `ChurnExit`, `Persona`, `JTBD`, `SupportCSAT`, `TrialExit` (if trial) |
| Experiment | One per experiment-linked flag |

**Attio resources generated (when CRM = Attio and IaC != None):**

| Resource Type | Generated For |
|--------------|---------------|
| Attribute (companies) | `lifecycle_stage`, `mrr`, `arr`, `churn_risk`, `health_score`, `icp_fit` |
| Attribute (people) | `product_role`, `last_login` |
| Attribute (deals) | `deal_stage`, `deal_value`, `is_pql` |
| Select Option | Lifecycle stages (5), ICP tiers (3), Churn risk (3), Product roles (3) |
| Status | Deal pipeline stages (6) |
| Webhook | `DealChanges`, `CompanyChanges` |

### 5.6 Distribution Layer

| Distribution | Generated Structure |
|-------------|-------------------|
| ShadCN Registry | `registry.json` with items: `@plg/core` (constants), `@plg/posthog` (PostHog SDK), `@plg/attio` (Attio sync), `@plg/stack` (IaC script) |
| npm Package | `package.json` with exports map: `.`, `./events`, `./feature-flags`, `./surveys`, `./attio`, `./plans`, `./user-properties`, `./sdk` |
| Monorepo Internal | Same as npm package but with `"private": true` and `workspace:*` dependencies |

---

## 6. Mapping to Existing Packages

The current codebase has the following packages. The builder maps selections to these existing artifacts.

### 6.1 `@packages/plg` (constants + SDK)

**Maps to builder output when:** Always generated.

| Source File | Builder Category | Condition |
|-------------|-----------------|-----------|
| `src/events.ts` | Events to Track | Always |
| `src/plans.ts` | Plans | Pricing != Free |
| `src/feature-flags.ts` | Feature Flags to Create | Feature Flags != None |
| `src/surveys.ts` | Surveys | Surveys != None |
| `src/attio.ts` | CRM Provider | CRM = Attio |
| `src/user-properties.ts` | Analytics Provider | Analytics != None |
| `src/sdk/track.ts` | Analytics Provider | Analytics != None |
| `src/sdk/identify.ts` | Analytics Provider | Analytics != None |
| `src/sdk/attio-sync.ts` | CRM Provider | CRM = Attio |
| `src/sdk/automations.ts` | CRM + Analytics | CRM != None AND Analytics != None |

### 6.2 `@packages/alchemy-posthog` (PostHog IaC provider)

**Maps to builder output when:** IaC = Alchemy-Effect AND Analytics = PostHog.

Provides the resource classes used in `plg-stack.run.ts`:
- `Dashboard`, `Action`, `Cohort`, `FeatureFlag`, `Survey`, `Experiment`, `Insight`

### 6.3 `@packages/alchemy-attio` (Attio IaC provider)

**Maps to builder output when:** IaC = Alchemy-Effect AND CRM = Attio.

Provides the resource classes used in `plg-stack.run.ts`:
- `Attribute`, `SelectOption`, `Status`, `Webhook`

### 6.4 `@packages/attio` (Attio API client)

**Maps to builder output when:** CRM = Attio.

Provides the Effect-based API client used by `attio-sync.ts`:
- `Records.updateRecord`, `Credentials`, `Endpoint`

### 6.5 `@packages/posthog` (PostHog API client)

**Maps to builder output when:** Analytics = PostHog AND IaC = Alchemy-Effect.

Provides the Effect-based API client used by the Alchemy PostHog provider.

### 6.6 ShadCN Registry Items (future)

When Distribution = ShadCN Registry, the builder produces registry items:

| Registry Item | Type | Includes | Registry Dependencies |
|--------------|------|----------|----------------------|
| `@plg/core` | `registry:lib` | `events.ts`, `plans.ts`, `feature-flags.ts`, `surveys.ts`, `user-properties.ts` | - |
| `@plg/posthog` | `registry:lib` | `sdk/track.ts`, `sdk/identify.ts` (PostHog-specific) | `@plg/core` |
| `@plg/attio` | `registry:lib` | `attio.ts`, `sdk/attio-sync.ts`, `sdk/automations.ts` | `@plg/core`, `@plg/posthog` |
| `@plg/stack` | `registry:file` | `plg-stack.run.ts` | `@plg/core`, `@plg/posthog`, `@plg/attio` |

---

## 7. Builder UI Flow

The builder presents categories in a linear stepper with real-time constraint validation.

### Step Ordering

```
1. Analytics Provider          (root decision, affects everything downstream)
2. Feature Flags               (depends on Analytics)
3. Experimentation             (depends on Feature Flags)
4. Surveys                     (depends on Analytics)
5. CRM Provider                (independent)
6. Pricing Model               (independent)
7. Plans                       (depends on Pricing Model; conditionally shown)
8. Events to Track             (depends on Pricing Model; pre-populated)
9. Feature Flags to Create     (depends on Feature Flags; conditionally shown)
10. IaC Provider               (independent; affects output format)
11. Distribution               (independent; affects output structure)
```

### Interaction Model

1. **Preset selector** at the top: Minimal, Growth, Full, Enterprise, Self-Hosted
2. Each category is a card with radio buttons (single-select) or checkboxes (multi-select)
3. Unavailable options are greyed out with a tooltip explaining the constraint
4. When a parent changes, cascading resets happen with an animation/toast notification
5. A live "Summary" panel on the right shows what will be generated
6. "Generate" button produces a CLI command:

```bash
# ShadCN Registry distribution
npx shadcn add @plg/core @plg/posthog @plg/attio @plg/stack

# npm Package distribution
npx create-plg-stack \
  --analytics posthog \
  --flags posthog \
  --experiments posthog \
  --surveys posthog \
  --crm attio \
  --pricing freemium \
  --plans free,starter,pro,enterprise \
  --iac alchemy \
  --distribution npm
```

### URL Encoding

All selections are encoded in the URL query string for shareability:

```
https://plg-stack.dev/new?analytics=posthog&flags=posthog&experiments=posthog&surveys=posthog&crm=attio&pricing=freemium&plans=free,starter,pro,enterprise&iac=alchemy&dist=shadcn
```

---

## Appendix A: Constraint Matrix

Quick reference showing which options are valid for each combination.

### Feature Flags availability by Analytics Provider

| Analytics \ Flags | PostHog Flags | LaunchDarkly | Statsig | GrowthBook | None |
|-------------------|:---:|:---:|:---:|:---:|:---:|
| PostHog           | Y | Y | Y | Y | Y |
| Amplitude         | - | Y | Y | Y | Y |
| Mixpanel          | - | Y | Y | Y | Y |
| Segment           | - | Y | Y | Y | Y |
| None              | - | - | - | - | Y |

### Experimentation availability by Analytics + Feature Flags

| Analytics + Flags \ Experiments | PostHog Exp | Statsig | Amplitude Exp | GrowthBook Exp | None |
|---------------------------------|:---:|:---:|:---:|:---:|:---:|
| PostHog + PostHog Flags         | Y | Y | - | - | Y |
| PostHog + LaunchDarkly          | - | Y | - | - | Y |
| PostHog + GrowthBook            | - | Y | - | Y | Y |
| Amplitude + LaunchDarkly        | - | Y | Y | - | Y |
| Amplitude + Statsig             | - | Y | Y | - | Y |
| Amplitude + GrowthBook          | - | Y | Y | Y | Y |
| Mixpanel + Any flags            | - | Y | - | see flags | Y |
| Segment + Any flags             | - | Y | - | see flags | Y |
| Any + None flags                | - | - | - | - | Y |

### Surveys availability by Analytics Provider

| Analytics \ Surveys | PostHog Surveys | Typeform | Formbricks | None |
|---------------------|:---:|:---:|:---:|:---:|
| PostHog             | Y | Y | Y | Y |
| Amplitude           | - | Y | Y | Y |
| Mixpanel            | - | Y | Y | Y |
| Segment             | - | Y | Y | Y |
| None                | - | Y | Y | Y |

---

## Appendix B: Comparison with Better T Stack Categories

| Better T Stack Category | PLG Builder Equivalent | Notes |
|------------------------|----------------------|-------|
| Web Frontend | - | PLG is backend/infrastructure; frontend is the consumer |
| Native Frontend | - | Same as above |
| Backend | - | PLG hooks into any backend |
| Runtime | IaC Provider | Runtime for IaC execution (bun/node for Alchemy, terraform CLI, pulumi CLI) |
| Api | - | PLG generates SDK code, not API routes |
| Database | CRM Provider | CRM is the "database" for customer data in PLG |
| Orm | - | CRM SDKs serve the ORM role |
| Db Setup | Plans | Pricing/plan configuration is analogous to DB schema setup |
| Web Deploy | - | PLG infrastructure is deployed via IaC, not web hosting |
| Server Deploy | IaC Provider | IaC deploys the PLG infrastructure |
| Auth | Analytics Provider | Analytics identifies users (the "auth" of product data) |
| Payments | Pricing Model | Pricing model drives payment event shapes |
| Package Manager | Distribution | How the generated code is distributed/consumed |
| Addons | Feature Flags, Experimentation, Surveys | Optional capabilities added to the core analytics |
| Examples | Events to Track, Feature Flags to Create | Concrete instances of the abstract categories |
| Git | - | Git is orthogonal to PLG infrastructure |
| Install | - | Install is handled by the distribution channel |
