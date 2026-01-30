/**
 * Combined PLG Stack - Attio CRM + PostHog Analytics
 *
 * This alchemy script provisions a complete product-led growth infrastructure
 * spanning both Attio CRM and PostHog analytics. Use this when you need both
 * systems configured together with shared naming conventions.
 *
 * ## Architecture
 *
 * The stack creates a unified view across your sales pipeline (Attio) and
 * product analytics (PostHog):
 *
 * 1. **Attio CRM**: Custom attributes on Companies/People/Deals for lifecycle
 *    tracking, revenue metrics, and health scoring
 * 2. **PostHog Analytics**: Dashboards, actions, cohorts, feature flags,
 *    surveys, and experiments following PLG best practices
 *
 * ## Code Integration
 *
 * Import constants from the shared @packages/plg package:
 *
 * ```typescript
 * import { Events, FeatureFlags, AttioAttributes, LifecycleStages } from "@packages/plg";
 *
 * // Track events
 * posthog.capture(Events.SIGNUP_COMPLETED);
 *
 * // Update Attio records
 * attio.records.update({ values: { [AttioAttributes.LIFECYCLE_STAGE]: LifecycleStages.ACTIVE } });
 * ```
 *
 * ## Keeping Systems in Sync
 *
 * Both PostHog and Attio are SaaS with GUIs that users can modify directly.
 * To prevent drift:
 *
 * 1. **Drift Detection**: Run `bun alchemy diff` before deployments
 * 2. **Tagging**: Resources are tagged with "managed-by-iac" for visibility
 * 3. **Permissions**: Restrict edit access for managed resources where possible
 * 4. **Webhooks**: Use Attio webhooks to sync changes back to PostHog
 *
 * @example
 * ```bash
 * # Deploy both systems
 * ATTIO_API_KEY=... POSTHOG_PROJECT_ID=... POSTHOG_API_KEY=... bun run plg-stack.run.ts
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
import * as Layer from "effect/Layer";

// Attio resources
import * as Attio from "./src/attio/index.js";
import { Attribute } from "./src/attio/attribute/index.js";
import { SelectOption } from "./src/attio/select-option/index.js";
import { Status } from "./src/attio/status/index.js";
import { Webhook } from "./src/attio/webhook/index.js";

// PostHog resources
import * as PostHog from "@packages/alchemy-posthog";
import { Dashboard } from "@packages/alchemy-posthog/posthog/dashboards";
import { Action } from "@packages/alchemy-posthog/posthog/actions";
import { Cohort } from "@packages/alchemy-posthog/posthog/cohorts";
import { FeatureFlag } from "@packages/alchemy-posthog/posthog/feature-flags";
import { Survey } from "@packages/alchemy-posthog/posthog/surveys";
import { Experiment } from "@packages/alchemy-posthog/posthog/experiments";
import { Annotation } from "@packages/alchemy-posthog/posthog/annotations";

// Import shared PLG constants
import {
  Events,
  FeatureFlags,
  AttioAttributes,
  LifecycleStages,
  IcpTiers,
  ChurnRiskLevels,
  ProductRoles,
  DealStages,
} from "@packages/plg";

// Re-export for convenience
export {
  Events,
  FeatureFlags,
  AttioAttributes,
  LifecycleStages,
  IcpTiers,
  ChurnRiskLevels,
  ProductRoles,
  DealStages,
};

// =============================================================================
// Stage Configuration
// =============================================================================

const stages = defineStages(
  Effect.fn(function* () {
    return {
      attio: {
        // ATTIO_API_KEY from environment
      },
      posthog: {
        projectId: yield* Config.string("POSTHOG_PROJECT_ID"),
      },
    } satisfies StageConfig;
  }),
);

// =============================================================================
// Combined Providers
// =============================================================================

const providers = () =>
  Layer.mergeAll(Attio.providers(), PostHog.providers());

// =============================================================================
// ATTIO: Company Attributes
// =============================================================================

export class LifecycleStageAttr extends Attribute("LifecycleStageAttr", {
  target: "objects",
  identifier: "companies",
  title: "Lifecycle Stage",
  apiSlug: AttioAttributes.LIFECYCLE_STAGE,
  type: "select",
  description: "Customer lifecycle stage for tracking journey and health",
}) {}

export class MrrAttr extends Attribute("MrrAttr", {
  target: "objects",
  identifier: "companies",
  title: "MRR",
  apiSlug: AttioAttributes.MRR,
  type: "number",
  description: "Monthly recurring revenue in USD",
}) {}

export class ArrAttr extends Attribute("ArrAttr", {
  target: "objects",
  identifier: "companies",
  title: "ARR",
  apiSlug: AttioAttributes.ARR,
  type: "number",
  description: "Annual recurring revenue in USD",
}) {}

export class ChurnRiskAttr extends Attribute("ChurnRiskAttr", {
  target: "objects",
  identifier: "companies",
  title: "Churn Risk",
  apiSlug: AttioAttributes.CHURN_RISK,
  type: "select",
  description: "Risk level for customer churn based on engagement signals",
}) {}

export class HealthScoreAttr extends Attribute("HealthScoreAttr", {
  target: "objects",
  identifier: "companies",
  title: "Health Score",
  apiSlug: AttioAttributes.HEALTH_SCORE,
  type: "number",
  description: "Composite health score (0-100) based on engagement and usage",
}) {}

export class IcpFitAttr extends Attribute("IcpFitAttr", {
  target: "objects",
  identifier: "companies",
  title: "ICP Fit",
  apiSlug: AttioAttributes.ICP_FIT,
  type: "select",
  description: "Ideal Customer Profile fit tier for prioritization",
}) {}

// =============================================================================
// ATTIO: People Attributes
// =============================================================================

export class ProductRoleAttr extends Attribute("ProductRoleAttr", {
  target: "objects",
  identifier: "people",
  title: "Product Role",
  apiSlug: AttioAttributes.PRODUCT_ROLE,
  type: "select",
  description: "Product engagement level based on usage patterns",
}) {}

export class LastLoginAttr extends Attribute("LastLoginAttr", {
  target: "objects",
  identifier: "people",
  title: "Last Login",
  apiSlug: AttioAttributes.LAST_LOGIN,
  type: "date",
  description: "Last product login timestamp synced from analytics",
}) {}

// =============================================================================
// ATTIO: Deal Attributes
// =============================================================================

export class DealStageAttr extends Attribute("DealStageAttr", {
  target: "objects",
  identifier: "deals",
  title: "Deal Stage",
  apiSlug: AttioAttributes.DEAL_STAGE,
  type: "status",
  description: "Sales pipeline stage with time tracking",
}) {}

export class DealValueAttr extends Attribute("DealValueAttr", {
  target: "objects",
  identifier: "deals",
  title: "Deal Value",
  apiSlug: AttioAttributes.DEAL_VALUE,
  type: "number",
  description: "Deal value in USD",
}) {}

export class IsPqlAttr extends Attribute("IsPqlAttr", {
  target: "objects",
  identifier: "deals",
  title: "Is PQL",
  apiSlug: AttioAttributes.IS_PQL,
  type: "checkbox",
  description: "Whether this deal originated from a Product-Qualified Lead",
}) {}

// =============================================================================
// ATTIO: Select Options - Lifecycle Stages
// =============================================================================

export class LifecycleTrial extends SelectOption("LifecycleTrial", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.LIFECYCLE_STAGE,
  title: LifecycleStages.TRIAL,
}) {}

export class LifecycleActive extends SelectOption("LifecycleActive", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.LIFECYCLE_STAGE,
  title: LifecycleStages.ACTIVE,
}) {}

export class LifecycleExpanding extends SelectOption("LifecycleExpanding", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.LIFECYCLE_STAGE,
  title: LifecycleStages.EXPANDING,
}) {}

export class LifecycleAtRisk extends SelectOption("LifecycleAtRisk", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.LIFECYCLE_STAGE,
  title: LifecycleStages.AT_RISK,
}) {}

export class LifecycleChurned extends SelectOption("LifecycleChurned", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.LIFECYCLE_STAGE,
  title: LifecycleStages.CHURNED,
}) {}

// =============================================================================
// ATTIO: Select Options - ICP Tiers
// =============================================================================

export class IcpTier1 extends SelectOption("IcpTier1", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.ICP_FIT,
  title: IcpTiers.TIER_1,
}) {}

export class IcpTier2 extends SelectOption("IcpTier2", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.ICP_FIT,
  title: IcpTiers.TIER_2,
}) {}

export class IcpTier3 extends SelectOption("IcpTier3", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.ICP_FIT,
  title: IcpTiers.TIER_3,
}) {}

// =============================================================================
// ATTIO: Select Options - Churn Risk
// =============================================================================

export class ChurnRiskHigh extends SelectOption("ChurnRiskHigh", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.CHURN_RISK,
  title: ChurnRiskLevels.HIGH,
}) {}

export class ChurnRiskMedium extends SelectOption("ChurnRiskMedium", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.CHURN_RISK,
  title: ChurnRiskLevels.MEDIUM,
}) {}

export class ChurnRiskLow extends SelectOption("ChurnRiskLow", {
  target: "objects",
  identifier: "companies",
  attribute: AttioAttributes.CHURN_RISK,
  title: ChurnRiskLevels.LOW,
}) {}

// =============================================================================
// ATTIO: Select Options - Product Role
// =============================================================================

export class ProductRolePower extends SelectOption("ProductRolePower", {
  target: "objects",
  identifier: "people",
  attribute: AttioAttributes.PRODUCT_ROLE,
  title: ProductRoles.POWER_USER,
}) {}

export class ProductRoleRegular extends SelectOption("ProductRoleRegular", {
  target: "objects",
  identifier: "people",
  attribute: AttioAttributes.PRODUCT_ROLE,
  title: ProductRoles.REGULAR,
}) {}

export class ProductRoleInactive extends SelectOption("ProductRoleInactive", {
  target: "objects",
  identifier: "people",
  attribute: AttioAttributes.PRODUCT_ROLE,
  title: ProductRoles.INACTIVE,
}) {}

// =============================================================================
// ATTIO: Status Options - Deal Pipeline
// =============================================================================

export class StatusProspect extends Status("StatusProspect", {
  target: "objects",
  identifier: "deals",
  attribute: AttioAttributes.DEAL_STAGE,
  title: DealStages.PROSPECT,
}) {}

export class StatusQualified extends Status("StatusQualified", {
  target: "objects",
  identifier: "deals",
  attribute: AttioAttributes.DEAL_STAGE,
  title: DealStages.QUALIFIED,
}) {}

export class StatusProposal extends Status("StatusProposal", {
  target: "objects",
  identifier: "deals",
  attribute: AttioAttributes.DEAL_STAGE,
  title: DealStages.PROPOSAL,
}) {}

export class StatusNegotiation extends Status("StatusNegotiation", {
  target: "objects",
  identifier: "deals",
  attribute: AttioAttributes.DEAL_STAGE,
  title: DealStages.NEGOTIATION,
}) {}

export class StatusClosedWon extends Status("StatusClosedWon", {
  target: "objects",
  identifier: "deals",
  attribute: AttioAttributes.DEAL_STAGE,
  title: DealStages.CLOSED_WON,
  celebrationEnabled: true,
}) {}

export class StatusClosedLost extends Status("StatusClosedLost", {
  target: "objects",
  identifier: "deals",
  attribute: AttioAttributes.DEAL_STAGE,
  title: DealStages.CLOSED_LOST,
}) {}

// =============================================================================
// ATTIO: Webhooks
// =============================================================================

export class DealChangesWebhook extends Webhook("DealChangesWebhook", {
  targetUrl: "https://httpbin.org/post?hook=deal-changes",
  subscriptions: [
    { event_type: "record.created", filter: { $and: [] } },
    { event_type: "record.updated", filter: { $and: [] } },
    { event_type: "record.deleted", filter: { $and: [] } },
  ],
}) {}

export class CompanyChangesWebhook extends Webhook("CompanyChangesWebhook", {
  targetUrl: "https://httpbin.org/post?hook=company-changes",
  subscriptions: [
    { event_type: "record.created", filter: { $and: [] } },
    { event_type: "record.updated", filter: { $and: [] } },
  ],
}) {}

// =============================================================================
// POSTHOG: Actions
// =============================================================================

export class SignupCompletedAction extends Action("SignupCompletedAction", {
  name: "Signup Completed",
  description: "User completed the signup flow",
  tags: ["acquisition", "funnel", "managed-by-iac"],
  steps: [{ event: Events.SIGNUP_COMPLETED }],
}) {}

export class OnboardingCompletedAction extends Action(
  "OnboardingCompletedAction",
  {
    name: "Onboarding Completed",
    description: "User completed onboarding (activation)",
    tags: ["activation", "funnel", "managed-by-iac"],
    steps: [{ event: Events.ONBOARDING_COMPLETED }],
  },
) {}

export class FeatureUsedAction extends Action("FeatureUsedAction", {
  name: "Feature Used",
  description: "User engaged with a core product feature",
  tags: ["engagement", "retention", "managed-by-iac"],
  steps: [{ event: Events.FEATURE_USED }],
}) {}

export class PlanUpgradedAction extends Action("PlanUpgradedAction", {
  name: "Plan Upgraded",
  description: "User upgraded their subscription plan",
  tags: ["monetization", "expansion", "managed-by-iac"],
  steps: [{ event: Events.PLAN_UPGRADED }],
}) {}

export class PlanDowngradedAction extends Action("PlanDowngradedAction", {
  name: "Plan Downgraded",
  description: "User downgraded their subscription plan (churn signal)",
  tags: ["monetization", "churn", "managed-by-iac"],
  steps: [{ event: Events.PLAN_DOWNGRADED }],
}) {}

// =============================================================================
// POSTHOG: Cohorts
// =============================================================================

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

export class ExpansionCandidatesCohort extends Cohort(
  "ExpansionCandidatesCohort",
  {
    name: "Expansion Candidates",
    description:
      "Accounts with growing usage (20+ feature uses in last 30 days)",
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
// POSTHOG: Dashboards
// =============================================================================

export class ExecutiveOverviewDashboard extends Dashboard(
  "ExecutiveOverviewDashboard",
  {
    name: "Executive Overview",
    description:
      "High-level business metrics including MRR, signups, activation, and churn.",
    pinned: true,
    tags: ["executive", "weekly", "managed-by-iac"],
  },
) {}

export class ProductMetricsDashboard extends Dashboard(
  "ProductMetricsDashboard",
  {
    name: "Product Metrics",
    description:
      "Activation funnels, feature adoption, engagement, and session metrics.",
    tags: ["product", "daily", "managed-by-iac"],
  },
) {}

export class GrowthActivationDashboard extends Dashboard(
  "GrowthActivationDashboard",
  {
    name: "Growth & Activation",
    description:
      "PQL identification, time-to-activation, and conversion funnels.",
    tags: ["growth", "daily", "managed-by-iac"],
  },
) {}

// =============================================================================
// POSTHOG: Feature Flags
// =============================================================================

export class DarkModeFlag extends FeatureFlag("DarkModeFlag", {
  key: FeatureFlags.DARK_MODE,
  name: "Dark Mode",
  active: true,
  rolloutPercentage: 100,
}) {}

export class BetaFeaturesFlag extends FeatureFlag("BetaFeaturesFlag", {
  key: FeatureFlags.BETA_FEATURES,
  name: "Beta Features Access",
  active: true,
  rolloutPercentage: 10,
}) {}

export class NewOnboardingFlag extends FeatureFlag("NewOnboardingFlag", {
  key: FeatureFlags.NEW_ONBOARDING,
  name: "New Onboarding Flow",
  active: false,
  rolloutPercentage: 0,
}) {}

export class AdvancedExportsFlag extends FeatureFlag("AdvancedExportsFlag", {
  key: FeatureFlags.ADVANCED_EXPORTS,
  name: "Advanced Exports",
  active: false,
  rolloutPercentage: 0,
}) {}

// =============================================================================
// POSTHOG: Surveys
// =============================================================================

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
// POSTHOG: Experiments
// =============================================================================

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
// POSTHOG: Annotations
// =============================================================================

export class DeploymentAnnotation extends Annotation("DeploymentAnnotation", {
  content: "PLG Combined Stack deployed via alchemy",
  dateMarker: new Date().toISOString(),
  scope: "project",
  creationType: "USR",
}) {}

// =============================================================================
// Stack Definition
// =============================================================================

const stack = defineStack({
  name: "plg-combined-stack",
  stages,
  resources: [
    // === ATTIO: Attributes ===
    LifecycleStageAttr,
    MrrAttr,
    ArrAttr,
    ChurnRiskAttr,
    HealthScoreAttr,
    IcpFitAttr,
    ProductRoleAttr,
    LastLoginAttr,
    DealStageAttr,
    DealValueAttr,
    IsPqlAttr,

    // === ATTIO: Select Options ===
    LifecycleTrial,
    LifecycleActive,
    LifecycleExpanding,
    LifecycleAtRisk,
    LifecycleChurned,
    IcpTier1,
    IcpTier2,
    IcpTier3,
    ChurnRiskHigh,
    ChurnRiskMedium,
    ChurnRiskLow,
    ProductRolePower,
    ProductRoleRegular,
    ProductRoleInactive,

    // === ATTIO: Statuses ===
    StatusProspect,
    StatusQualified,
    StatusProposal,
    StatusNegotiation,
    StatusClosedWon,
    StatusClosedLost,

    // === ATTIO: Webhooks ===
    DealChangesWebhook,
    CompanyChangesWebhook,

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

    // === POSTHOG: Dashboards ===
    ExecutiveOverviewDashboard,
    ProductMetricsDashboard,
    GrowthActivationDashboard,

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
  tap: (outputs) =>
    Effect.log(
      `PLG Combined Stack deployed: ${Object.keys(outputs).length} resources`,
    ),
});

// =============================================================================
// Stage References
// =============================================================================

export const PLGCombinedStack = stages
  .ref<typeof stack>("plg-combined-stack")
  .as({
    prod: "prod",
    staging: "staging",
    dev: (user: USER = USER) => `dev_${user}`,
  });

export default stack;
