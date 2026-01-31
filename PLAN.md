# PLG SaaS Infrastructure Script Plan

## Overview

Create a comprehensive alchemy infrastructure script that provisions a complete product + growth stack for a PLG SaaS company using Attio CRM and PostHog analytics together.

## File Location

`infra/plg-stack.run.ts` - New directory `infra/` at repo root for infrastructure-as-code scripts.

## Architecture

### Provider Composition

```typescript
import * as Layer from "effect/Layer";
import * as Attio from "@packages/alchemy-attio";
import * as PostHog from "@packages/alchemy-posthog";

// Merge both provider layers
const providers = () => Layer.mergeAll(
  Attio.providers(),
  PostHog.providers(),
);
```

### Stage Configuration

```typescript
const stages = defineStages(
  Effect.fn(function* () {
    return {
      attio: {
        // ATTIO_API_KEY from env
      },
      posthog: {
        projectId: 12345, // or from env
        // POSTHOG_API_KEY from env
      },
    } satisfies StageConfig;
  }),
);
```

## Resource Tiers

### Tier 1: Schema (Attio CRM Structure)

**Custom Object: Workspaces**
- Track product accounts/tenants separately from Companies

**Attributes on Companies (built-in object):**
| Name | Type | Purpose |
|------|------|---------|
| `lifecycle_stage` | select | Trial → Active → Expanding → At Risk → Churned |
| `mrr` | number | Monthly recurring revenue |
| `arr` | number | Annual recurring revenue |
| `churn_risk` | select | High / Medium / Low |
| `health_score` | number | 0-100 composite metric |
| `icp_fit` | select | Tier 1 / Tier 2 / Tier 3 |

**Attributes on People (built-in object):**
| Name | Type | Purpose |
|------|------|---------|
| `product_role` | select | Power User / Regular / Inactive |
| `last_login` | date | Last product login timestamp |

**Attributes on Deals (built-in object):**
| Name | Type | Purpose |
|------|------|---------|
| `deal_stage` | status | Pipeline stages with time tracking |
| `deal_value` | currency | Deal monetary value |
| `is_pql` | checkbox | Product-Qualified Lead flag |

**Select Options:**
- Lifecycle stages: Trial, Active, Expanding, At Risk, Churned
- ICP tiers: Tier 1, Tier 2, Tier 3
- Churn risk: High, Medium, Low
- Product role: Power User, Regular, Inactive

**Status Options (for deal_stage):**
- Prospect
- Qualified
- Proposal
- Negotiation
- Closed Won (celebration enabled)
- Closed Lost

### Tier 2: Webhooks (Attio Real-time Events)

| Webhook | Events | Purpose |
|---------|--------|---------|
| `DealChanges` | record.created, record.updated, record.deleted | Sync deals to external systems |
| `CompanyChanges` | record.created, record.updated | Track company lifecycle changes |

URLs: Use `https://httpbin.org/post?hook=<name>` as placeholders.

### Tier 3: PostHog Dashboards

**Executive Overview Dashboard**
- Pinned, tags: ["executive", "weekly"]
- Description: High-level business metrics for leadership

**Product Metrics Dashboard**
- Tags: ["product", "daily"]
- Description: Activation, engagement, and feature adoption

**Growth & Activation Dashboard**
- Tags: ["growth", "daily"]
- Description: Funnel analysis and conversion metrics

### Tier 4: PostHog Actions (Event Definitions)

| Action | Event Match | Purpose |
|--------|------------|---------|
| `SignupCompleted` | `signup_completed` | Track new signups |
| `OnboardingCompleted` | `onboarding_completed` | Track activation |
| `FeatureUsed` | `feature_used` | Track feature engagement |
| `PlanUpgraded` | `plan_upgraded` | Track expansion |
| `PlanDowngraded` | `plan_downgraded` | Track churn signals |

### Tier 5: PostHog Cohorts

| Cohort | Definition | Purpose |
|--------|-----------|---------|
| `PowerUsers` | High engagement (10+ events/week) | Identify champions |
| `NewUsers` | Signed up in last 7 days | Onboarding targeting |
| `LowEngagement` | 0 events in last 7 days | Churn risk detection |
| `TrialEndingSoon` | Trial ending in 7 days | Conversion targeting |
| `ExpansionCandidates` | Growing usage + multi-user | Upsell targeting |

### Tier 6: PostHog Feature Flags

| Flag | Key | Rollout | Purpose |
|------|-----|---------|---------|
| `DarkMode` | `dark-mode` | 100% | Fully rolled out feature |
| `BetaFeatures` | `beta-features` | 10% | Limited beta access |
| `NewOnboarding` | `new-onboarding-flow` | 0% | Ready for experiment |
| `AdvancedExports` | `advanced-exports` | 0% | Enterprise feature gate |

### Tier 7: PostHog Surveys

**Post-Activation NPS**
- Type: `popover`
- Questions: Rating (0-10), Open text follow-up
- Trigger: After onboarding completion

**Monthly NPS**
- Type: `popover`
- Questions: Rating (0-10)
- Schedule: 1st of each month

**Feature CSAT**
- Type: `popover`
- Questions: 1-5 satisfaction scale
- Trigger: After feature usage

**Churn Exit Survey**
- Type: `api`
- Questions: Multiple choice reasons, open text
- Trigger: On downgrade/cancellation

### Tier 8: PostHog Experiments

**Onboarding Flow Test**
- Feature flag: `new-onboarding-flow`
- Description: Test streamlined onboarding vs current
- Type: `product`

### Tier 9: PostHog Annotations

**Stack Deployment Marker**
- Content: "PLG Stack deployed via alchemy"
- Scope: `project`
- Date: Current deployment time

## Complete Resource List

```typescript
const stack = defineStack({
  name: "plg-saas-stack",
  stages,
  resources: [
    // === ATTIO: Schema ===
    // Attributes on Companies
    LifecycleStageAttr,
    MrrAttr,
    ArrAttr,
    ChurnRiskAttr,
    HealthScoreAttr,
    IcpFitAttr,

    // Attributes on People
    ProductRoleAttr,
    LastLoginAttr,

    // Attributes on Deals
    DealStageAttr,
    DealValueAttr,
    IsPqlAttr,

    // Select Options
    LifecycleTrial, LifecycleActive, LifecycleExpanding, LifecycleAtRisk, LifecycleChurned,
    IcpTier1, IcpTier2, IcpTier3,
    ChurnRiskHigh, ChurnRiskMedium, ChurnRiskLow,
    ProductRolePower, ProductRoleRegular, ProductRoleInactive,

    // Status Options (Deal Pipeline)
    StatusProspect, StatusQualified, StatusProposal, StatusNegotiation,
    StatusClosedWon, StatusClosedLost,

    // === ATTIO: Webhooks ===
    DealChangesWebhook,
    CompanyChangesWebhook,

    // === POSTHOG: Dashboards ===
    ExecutiveOverviewDashboard,
    ProductMetricsDashboard,
    GrowthActivationDashboard,

    // === POSTHOG: Actions ===
    SignupCompletedAction,
    OnboardingCompletedAction,
    FeatureUsedAction,
    PlanUpgradedAction,
    PlanDowngradedAction,

    // === POSTHOG: Cohorts ===
    PowerUsersCohort,
    NewUsersCohort,
    LowEngagementCohort,
    TrialEndingSoonCohort,
    ExpansionCandidatesCohort,

    // === POSTHOG: Feature Flags ===
    DarkModeFlag,
    BetaFeaturesFlag,
    NewOnboardingFlag,
    AdvancedExportsFlag,

    // === POSTHOG: Surveys ===
    PostActivationNpsSurvey,
    MonthlyNpsSurvey,
    FeatureCsatSurvey,
    ChurnExitSurvey,

    // === POSTHOG: Experiments ===
    OnboardingFlowExperiment,

    // === POSTHOG: Annotations ===
    DeploymentAnnotation,
  ],
  providers: providers(),
  tap: (outputs) => Effect.log(`PLG Stack deployed: ${Object.keys(outputs).length} resources`),
});
```

## Dependencies

Resources will be declared in dependency order:
1. Attributes before SelectOptions/Statuses (attribute → options)
2. Feature flags before Experiments (flag → experiment)
3. Dashboards can be standalone

## Limitations & Notes

1. **Attio Object/Attribute deletion**: These are no-op deletes. Once created, schema resources persist in Attio.

2. **Attio built-in objects**: Companies, People, Deals are pre-existing. We only add custom attributes to them.

3. **PostHog Survey questions**: The Survey resource accepts `questions` but the exact format depends on PostHog API. Will use simple structures.

4. **Webhook URLs**: Using `httpbin.org/post` as placeholders. Real deployment would use actual webhook endpoints.

5. **Cohort filters**: PostHog cohort filters use a complex structure. Will use simplified behavioral filters.

6. **Feature flag rollout**: Uses `rolloutPercentage` prop for percentage-based rollouts.

## Estimated Resource Count

- Attio Attributes: 11
- Attio SelectOptions: 13
- Attio Statuses: 6
- Attio Webhooks: 2
- PostHog Dashboards: 3
- PostHog Actions: 5
- PostHog Cohorts: 5
- PostHog Feature Flags: 4
- PostHog Surveys: 4
- PostHog Experiments: 1
- PostHog Annotations: 1

**Total: ~55 resources**

## Next Steps

1. Create `infra/` directory
2. Write `infra/plg-stack.run.ts` with all resource definitions
3. Add package.json script to run it
4. Test with `bun run infra/plg-stack.run.ts`
