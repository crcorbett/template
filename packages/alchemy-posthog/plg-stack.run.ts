/**
 * PostHog PLG Stack - Product-Led Growth Analytics Infrastructure
 *
 * This alchemy script provisions a complete PostHog analytics stack following
 * PLG best practices for SaaS companies.
 *
 * ## Architecture
 *
 * Resources are organized in tiers:
 * 1. **Foundation** - Actions (event definitions) that your app emits
 * 2. **Segmentation** - Cohorts for targeting and analysis
 * 3. **Presentation** - Dashboards for metrics visualization
 * 4. **Experimentation** - Feature flags, surveys, experiments
 *
 * ## Code Integration
 *
 * Import constants from the shared @packages/plg package:
 *
 * ```typescript
 * import { Events, FeatureFlags, Surveys } from "@packages/plg";
 *
 * // Track events with type safety
 * posthog.capture(Events.SIGNUP_COMPLETED);
 *
 * // Check feature flags with type safety
 * if (posthog.isFeatureEnabled(FeatureFlags.DARK_MODE)) { ... }
 * ```
 *
 * ## Drift Prevention
 *
 * To prevent GUI changes from diverging from IaC:
 * 1. Run `bun alchemy diff` to detect changes before deployments
 * 2. Use PostHog's "Managed by API" tags on resources
 * 3. Consider restricting editor permissions for managed resources
 *
 * @example
 * ```bash
 * # Deploy the stack
 * POSTHOG_PROJECT_ID=... POSTHOG_API_KEY=... bun run plg-stack.run.ts
 *
 * # Check for drift
 * POSTHOG_PROJECT_ID=... POSTHOG_API_KEY=... bun alchemy diff
 * ```
 */

import {
  defineStack,
  defineStages,
  type StageConfig,
  USER,
} from "alchemy-effect";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";

import * as PostHog from "./src/posthog/index.js";
import { Dashboard } from "./src/posthog/dashboards/index.js";
import { Action } from "./src/posthog/actions/index.js";
import { Cohort } from "./src/posthog/cohorts/index.js";
import { FeatureFlag } from "./src/posthog/feature-flags/index.js";
import { Survey } from "./src/posthog/surveys/index.js";
import { Experiment } from "./src/posthog/experiments/index.js";
import { Annotation } from "./src/posthog/annotations/index.js";
import { Insight } from "./src/posthog/insights/index.js";

// Import shared PLG constants
import { Events, FeatureFlags, Surveys } from "@packages/plg";

// Re-export for convenience
export { Events, FeatureFlags, Surveys };
export type { EventName, FeatureFlagKey, SurveyId } from "@packages/plg";

// =============================================================================
// Stage Configuration
// =============================================================================

const stages = defineStages(
  Effect.fn(function* () {
    return {
      posthog: {
        projectId: yield* Config.string("POSTHOG_PROJECT_ID"),
      },
    } satisfies StageConfig;
  }),
);

// =============================================================================
// TIER 1: Actions (Event Definitions)
// =============================================================================

/**
 * Signup completion - the start of the user journey.
 */
export class SignupCompletedAction extends Action("SignupCompletedAction", {
  name: "Signup Completed",
  description: "User completed the signup flow",
  tags: ["acquisition", "funnel", "managed-by-iac"],
  steps: [{ event: Events.SIGNUP_COMPLETED }],
}) {}

/**
 * Onboarding completion - the activation moment.
 */
export class OnboardingCompletedAction extends Action(
  "OnboardingCompletedAction",
  {
    name: "Onboarding Completed",
    description: "User completed onboarding (activation)",
    tags: ["activation", "funnel", "managed-by-iac"],
    steps: [{ event: Events.ONBOARDING_COMPLETED }],
  },
) {}

/**
 * Feature usage - core engagement signal.
 */
export class FeatureUsedAction extends Action("FeatureUsedAction", {
  name: "Feature Used",
  description: "User engaged with a core product feature",
  tags: ["engagement", "retention", "managed-by-iac"],
  steps: [{ event: Events.FEATURE_USED }],
}) {}

/**
 * Plan upgrade - expansion signal.
 */
export class PlanUpgradedAction extends Action("PlanUpgradedAction", {
  name: "Plan Upgraded",
  description: "User upgraded their subscription plan",
  tags: ["monetization", "expansion", "managed-by-iac"],
  steps: [{ event: Events.PLAN_UPGRADED }],
}) {}

/**
 * Plan downgrade - churn signal.
 */
export class PlanDowngradedAction extends Action("PlanDowngradedAction", {
  name: "Plan Downgraded",
  description: "User downgraded their subscription plan (churn signal)",
  tags: ["monetization", "churn", "managed-by-iac"],
  steps: [{ event: Events.PLAN_DOWNGRADED }],
}) {}

// =============================================================================
// TIER 2: Cohorts (User Segments)
// =============================================================================

/**
 * Power Users - highly engaged product champions.
 */
export class PowerUsersCohort extends Cohort("PowerUsersCohort", {
  name: "Power Users",
  description: "Users with high engagement (10+ feature uses in last 7 days)",
  filters: {
    properties: {
      type: "AND",
      values: [
        {
          type: "behavioral",
          value: "performed_event_multiple",
          event_type: Events.FEATURE_USED,
          operator: "gte",
          property_value: 10,
          time_value: 7,
          time_interval: "day",
        },
      ],
    },
  },
}) {}

/**
 * New Users - recently signed up, for onboarding targeting.
 */
export class NewUsersCohort extends Cohort("NewUsersCohort", {
  name: "New Users",
  description: "Users who signed up in the last 7 days",
  filters: {
    properties: {
      type: "AND",
      values: [
        {
          type: "behavioral",
          value: "performed_event",
          event_type: Events.SIGNUP_COMPLETED,
          time_value: 7,
          time_interval: "day",
        },
      ],
    },
  },
}) {}

/**
 * Low Engagement - users at risk of churning.
 */
export class LowEngagementCohort extends Cohort("LowEngagementCohort", {
  name: "Low Engagement",
  description: "Users with no activity in the last 7 days (churn risk)",
  filters: {
    properties: {
      type: "AND",
      values: [
        {
          type: "behavioral",
          value: "performed_event",
          event_type: "$pageview",
          negation: true,
          time_value: 7,
          time_interval: "day",
        },
      ],
    },
  },
}) {}

/**
 * Trial Ending Soon - conversion push targets.
 */
export class TrialEndingSoonCohort extends Cohort("TrialEndingSoonCohort", {
  name: "Trial Ending Soon",
  description: "Trial users whose trial ends within 7 days",
  filters: {
    properties: {
      type: "AND",
      values: [
        {
          type: "person",
          key: "plan",
          operator: "exact",
          value: "trial",
        },
      ],
    },
  },
}) {}

/**
 * Expansion Candidates - accounts ready for upsell.
 */
export class ExpansionCandidatesCohort extends Cohort(
  "ExpansionCandidatesCohort",
  {
    name: "Expansion Candidates",
    description: "Accounts with growing usage (20+ feature uses in last 30 days)",
    filters: {
      properties: {
        type: "AND",
        values: [
          {
            type: "behavioral",
            value: "performed_event_multiple",
            event_type: Events.FEATURE_USED,
            operator: "gte",
            property_value: 20,
            time_value: 30,
            time_interval: "day",
          },
        ],
      },
    },
  },
) {}

// =============================================================================
// TIER 3: Dashboards
// =============================================================================

/**
 * Executive Overview - high-level business metrics.
 * Populate with Insights for: MRR, signups, activation rate, churn.
 */
export class ExecutiveOverviewDashboard extends Dashboard(
  "ExecutiveOverviewDashboard",
  {
    name: "Executive Overview",
    description:
      "High-level business metrics including MRR, signups, activation, and churn. Weekly leadership review.",
    pinned: true,
    tags: ["executive", "weekly", "managed-by-iac"],
  },
) {}

/**
 * Product Metrics - daily product health indicators.
 * Populate with Insights for: DAU/MAU, feature adoption, session metrics.
 */
export class ProductMetricsDashboard extends Dashboard(
  "ProductMetricsDashboard",
  {
    name: "Product Metrics",
    description:
      "Activation funnels, feature adoption, engagement, and session metrics. Daily product team review.",
    tags: ["product", "daily", "managed-by-iac"],
  },
) {}

/**
 * Growth & Activation - funnel analysis and conversion.
 * Populate with Insights for: PQL identification, time-to-activation, conversion funnels.
 */
export class GrowthActivationDashboard extends Dashboard(
  "GrowthActivationDashboard",
  {
    name: "Growth & Activation",
    description:
      "PQL identification, time-to-activation, and conversion funnels. Daily growth team review.",
    tags: ["growth", "daily", "managed-by-iac"],
  },
) {}

// =============================================================================
// TIER 3b: Insights (Dashboard Visualizations)
// =============================================================================

// --- Executive Dashboard Insights ---
// Note: Link these to ExecutiveOverviewDashboard after deployment via PostHog UI
// or by adding `dashboards: [ExecutiveOverviewDashboard.id]` once modules resolve

/**
 * Weekly signups trend.
 */
export class WeeklySignupsInsight extends Insight("WeeklySignupsInsight", {
  name: "Weekly Signups",
  description: "Number of signups per week (Executive Dashboard)",
  query: {
    kind: "TrendsQuery",
    interval: "week",
    series: [{ kind: "EventsNode", event: Events.SIGNUP_COMPLETED, name: "Signups" }],
  },
  saved: true,
}) {}

/**
 * Weekly activation rate.
 */
export class ActivationRateInsight extends Insight("ActivationRateInsight", {
  name: "Activation Rate",
  description: "Percentage of signups that complete onboarding (Executive Dashboard)",
  query: {
    kind: "TrendsQuery",
    interval: "week",
    series: [
      { kind: "EventsNode", event: Events.ONBOARDING_COMPLETED, name: "Activated" },
      { kind: "EventsNode", event: Events.SIGNUP_COMPLETED, name: "Signups" },
    ],
    trendsFilter: { formula: "A / B * 100" },
  },
  saved: true,
}) {}

/**
 * Weekly plan upgrades.
 */
export class WeeklyUpgradesInsight extends Insight("WeeklyUpgradesInsight", {
  name: "Weekly Upgrades",
  description: "Number of plan upgrades per week (Executive Dashboard)",
  query: {
    kind: "TrendsQuery",
    interval: "week",
    series: [{ kind: "EventsNode", event: Events.PLAN_UPGRADED, name: "Upgrades" }],
  },
  saved: true,
}) {}

/**
 * Weekly churn signals.
 */
export class WeeklyChurnInsight extends Insight("WeeklyChurnInsight", {
  name: "Weekly Churn Signals",
  description: "Number of downgrades and cancellations per week (Executive Dashboard)",
  query: {
    kind: "TrendsQuery",
    interval: "week",
    series: [
      { kind: "EventsNode", event: Events.PLAN_DOWNGRADED, name: "Downgrades" },
      { kind: "EventsNode", event: Events.ACCOUNT_CANCELLED, name: "Cancellations" },
    ],
  },
  saved: true,
}) {}

// --- Product Metrics Dashboard Insights ---
// Note: Link these to ProductMetricsDashboard after deployment

/**
 * Daily active users trend.
 */
export class DailyActiveUsersInsight extends Insight("DailyActiveUsersInsight", {
  name: "Daily Active Users",
  description: "Unique users with any activity per day (Product Dashboard)",
  query: {
    kind: "TrendsQuery",
    interval: "day",
    series: [
      {
        kind: "EventsNode",
        event: null,
        math: "dau",
        name: "DAU",
      },
    ],
  },
  saved: true,
}) {}

/**
 * Feature adoption breakdown.
 */
export class FeatureAdoptionInsight extends Insight("FeatureAdoptionInsight", {
  name: "Feature Usage",
  description: "Daily feature usage events (Product Dashboard)",
  query: {
    kind: "TrendsQuery",
    interval: "day",
    series: [{ kind: "EventsNode", event: Events.FEATURE_USED, name: "Feature Uses" }],
  },
  saved: true,
}) {}

/**
 * User retention cohort.
 */
export class RetentionInsight extends Insight("RetentionInsight", {
  name: "User Retention",
  description: "Retention of users who signed up, measured by feature usage (Product Dashboard)",
  query: {
    kind: "RetentionQuery",
    retentionFilter: {
      targetEntity: { id: Events.FEATURE_USED, type: "events" },
      returningEntity: { id: Events.FEATURE_USED, type: "events" },
      period: "Week",
      totalIntervals: 8,
    },
  },
  saved: true,
}) {}

// --- Growth & Activation Dashboard Insights ---
// Note: Link these to GrowthActivationDashboard after deployment

/**
 * Signup to activation funnel.
 */
export class ActivationFunnelInsight extends Insight("ActivationFunnelInsight", {
  name: "Activation Funnel",
  description: "Conversion from signup to onboarding completion (Growth Dashboard)",
  query: {
    kind: "FunnelsQuery",
    funnelsFilter: { funnelVizType: "steps" },
    series: [
      { kind: "EventsNode", event: Events.SIGNUP_COMPLETED, name: "Signed Up" },
      { kind: "EventsNode", event: Events.ONBOARDING_COMPLETED, name: "Completed Onboarding" },
      { kind: "EventsNode", event: Events.FEATURE_USED, name: "Used Feature" },
    ],
  },
  saved: true,
}) {}

/**
 * Time to first feature use.
 */
export class TimeToActivationInsight extends Insight("TimeToActivationInsight", {
  name: "Time to First Feature Use",
  description: "How long from signup to first feature usage (Growth Dashboard)",
  query: {
    kind: "FunnelsQuery",
    funnelsFilter: {
      funnelVizType: "time_to_convert",
      funnelWindowInterval: 14,
      funnelWindowIntervalUnit: "day",
    },
    series: [
      { kind: "EventsNode", event: Events.SIGNUP_COMPLETED, name: "Signed Up" },
      { kind: "EventsNode", event: Events.FEATURE_USED, name: "Used Feature" },
    ],
  },
  saved: true,
}) {}

/**
 * Upgrade conversion funnel.
 */
export class UpgradeFunnelInsight extends Insight("UpgradeFunnelInsight", {
  name: "Upgrade Funnel",
  description: "Conversion from activation to paid upgrade (Growth Dashboard)",
  query: {
    kind: "FunnelsQuery",
    funnelsFilter: { funnelVizType: "steps" },
    series: [
      { kind: "EventsNode", event: Events.ONBOARDING_COMPLETED, name: "Activated" },
      { kind: "EventsNode", event: Events.PLAN_UPGRADED, name: "Upgraded" },
    ],
  },
  saved: true,
}) {}

// =============================================================================
// TIER 4: Feature Flags
// =============================================================================

/**
 * Dark mode - fully rolled out UI preference.
 */
export class DarkModeFlag extends FeatureFlag("DarkModeFlag", {
  key: FeatureFlags.DARK_MODE,
  name: "Dark Mode",
  active: true,
  rolloutPercentage: 100,
}) {}

/**
 * Beta features - limited access for early adopters.
 */
export class BetaFeaturesFlag extends FeatureFlag("BetaFeaturesFlag", {
  key: FeatureFlags.BETA_FEATURES,
  name: "Beta Features Access",
  active: true,
  rolloutPercentage: 10,
}) {}

/**
 * New onboarding flow - experiment candidate.
 */
export class NewOnboardingFlag extends FeatureFlag("NewOnboardingFlag", {
  key: FeatureFlags.NEW_ONBOARDING,
  name: "New Onboarding Flow",
  active: false,
  rolloutPercentage: 0,
}) {}

/**
 * Advanced exports - enterprise feature gate.
 */
export class AdvancedExportsFlag extends FeatureFlag("AdvancedExportsFlag", {
  key: FeatureFlags.ADVANCED_EXPORTS,
  name: "Advanced Exports",
  active: false,
  rolloutPercentage: 0,
}) {}

// =============================================================================
// TIER 5: Surveys
// =============================================================================

/**
 * Post-activation NPS - early satisfaction measurement.
 */
export class PostActivationNpsSurvey extends Survey("PostActivationNpsSurvey", {
  name: "Post-Activation NPS",
  type: "popover",
  description: "NPS survey shown after completing onboarding",
  questions: [
    {
      type: "rating",
      question: "How likely are you to recommend us to a friend or colleague?",
      scale: 10,
      lowerBoundLabel: "Not likely",
      upperBoundLabel: "Very likely",
    },
    {
      type: "open",
      question: "What's the primary reason for your score?",
      optional: true,
    },
  ],
}) {}

/**
 * Monthly NPS - recurring satisfaction tracking.
 */
export class MonthlyNpsSurvey extends Survey("MonthlyNpsSurvey", {
  name: "Monthly NPS",
  type: "popover",
  description: "Monthly NPS survey for all active users",
  questions: [
    {
      type: "rating",
      question: "How likely are you to recommend us to a friend or colleague?",
      scale: 10,
      lowerBoundLabel: "Not likely",
      upperBoundLabel: "Very likely",
    },
  ],
}) {}

/**
 * Feature CSAT - quick satisfaction after feature use.
 */
export class FeatureCsatSurvey extends Survey("FeatureCsatSurvey", {
  name: "Feature CSAT",
  type: "popover",
  description: "CSAT survey after feature usage",
  questions: [
    {
      type: "rating",
      question: "How satisfied are you with this feature?",
      scale: 5,
      lowerBoundLabel: "Very dissatisfied",
      upperBoundLabel: "Very satisfied",
    },
  ],
}) {}

/**
 * Churn exit survey - capture reasons for leaving.
 */
export class ChurnExitSurvey extends Survey("ChurnExitSurvey", {
  name: "Churn Exit Survey",
  type: "api",
  description: "Survey sent when users downgrade or cancel",
  questions: [
    {
      type: "single_choice",
      question: "What's the main reason you're leaving?",
      choices: [
        "Too expensive",
        "Missing features I need",
        "Switching to a competitor",
        "No longer need this type of product",
        "Technical issues",
        "Other",
      ],
    },
    {
      type: "open",
      question: "Is there anything we could have done better?",
      optional: true,
    },
  ],
}) {}

// =============================================================================
// TIER 6: Experiments
// =============================================================================

/**
 * Onboarding A/B test - testing new flow against control.
 */
export class OnboardingFlowExperiment extends Experiment(
  "OnboardingFlowExperiment",
  {
    name: "Onboarding Flow Test",
    description:
      "A/B test comparing current onboarding vs new streamlined flow",
    featureFlagKey: FeatureFlags.NEW_ONBOARDING,
    type: "product",
  },
) {}

// =============================================================================
// Annotations
// =============================================================================

/**
 * Deployment marker - tracks IaC deployments on charts.
 */
export class DeploymentAnnotation extends Annotation("DeploymentAnnotation", {
  content: "PLG Stack deployed via alchemy",
  dateMarker: new Date().toISOString(),
  scope: "project",
  creationType: "USR",
}) {}

// =============================================================================
// Stack Definition
// =============================================================================

const stack = defineStack({
  name: "posthog-plg-stack",
  stages,
  resources: [
    // Tier 1: Actions
    SignupCompletedAction,
    OnboardingCompletedAction,
    FeatureUsedAction,
    PlanUpgradedAction,
    PlanDowngradedAction,

    // Tier 2: Cohorts
    PowerUsersCohort,
    NewUsersCohort,
    LowEngagementCohort,
    TrialEndingSoonCohort,
    ExpansionCandidatesCohort,

    // Tier 3: Dashboards
    ExecutiveOverviewDashboard,
    ProductMetricsDashboard,
    GrowthActivationDashboard,

    // Tier 3b: Insights (link to dashboards after deployment)
    WeeklySignupsInsight,
    ActivationRateInsight,
    WeeklyUpgradesInsight,
    WeeklyChurnInsight,
    DailyActiveUsersInsight,
    FeatureAdoptionInsight,
    RetentionInsight,
    ActivationFunnelInsight,
    TimeToActivationInsight,
    UpgradeFunnelInsight,

    // Tier 4: Feature Flags
    DarkModeFlag,
    BetaFeaturesFlag,
    NewOnboardingFlag,
    AdvancedExportsFlag,

    // Tier 5: Surveys
    PostActivationNpsSurvey,
    MonthlyNpsSurvey,
    FeatureCsatSurvey,
    ChurnExitSurvey,

    // Tier 6: Experiments
    OnboardingFlowExperiment,

    // Annotations
    DeploymentAnnotation,
  ],
  providers: PostHog.providers(),
  tap: (outputs) =>
    Effect.log(
      `PostHog PLG Stack deployed: ${Object.keys(outputs).length} resources`,
    ),
});

// =============================================================================
// Stage References
// =============================================================================

export const PLGStack = stages.ref<typeof stack>("posthog-plg-stack").as({
  prod: "prod",
  staging: "staging",
  dev: (user: USER = USER) => `dev_${user}`,
});

export default stack;
