/**
 * PLG Stack - Combined Attio CRM + PostHog Analytics Infrastructure
 *
 * This alchemy script provisions a complete product-led growth infrastructure
 * spanning both Attio CRM and PostHog analytics.
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
 * bun --env-file=../../.env run alchemy plan plg-stack.run.ts
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
import * as Attio from "@packages/alchemy-attio";
import { Attribute } from "@packages/alchemy-attio/attio/attribute";
import { SelectOption } from "@packages/alchemy-attio/attio/select-option";
import { Status } from "@packages/alchemy-attio/attio/status";
import { Webhook } from "@packages/alchemy-attio/attio/webhook";

// PostHog resources
import * as PostHog from "@packages/alchemy-posthog";
import { Dashboard } from "@packages/alchemy-posthog/posthog/dashboards";
import { Action } from "@packages/alchemy-posthog/posthog/actions";
import { Cohort } from "@packages/alchemy-posthog/posthog/cohorts";
import { FeatureFlag } from "@packages/alchemy-posthog/posthog/feature-flags";
import { Survey } from "@packages/alchemy-posthog/posthog/surveys";
import { Experiment } from "@packages/alchemy-posthog/posthog/experiments";
import { Insight } from "@packages/alchemy-posthog/posthog/insights";

// Import shared PLG constants (local to this package)
import {
  Events,
  FeatureFlags,
  AttioAttributes,
  LifecycleStages,
  IcpTiers,
  ChurnRiskLevels,
  ProductRoles,
  DealStages,
  Plans,
  UserProperties,
} from "./src/index.js";

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
  Plans,
  UserProperties,
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

/**
 * Webhook for deal record changes in Attio.
 *
 * **Placeholder URL** — replace `targetUrl` per environment to point at your
 * ingestion endpoint. Resource class props are static, so Config cannot be
 * used here. Set the real URL when deploying to staging/prod.
 *
 * @see ATTIO_DEAL_WEBHOOK_URL environment variable (future: make configurable
 *   via a wrapper that reads Config and passes the resolved URL)
 */
export class DealChangesWebhook extends Webhook("DealChangesWebhook", {
  targetUrl: "https://httpbin.org/post?hook=deal-changes",
  subscriptions: [
    { event_type: "record.created", filter: { $and: [] } },
    { event_type: "record.updated", filter: { $and: [] } },
    { event_type: "record.deleted", filter: { $and: [] } },
  ],
}) {}

/**
 * Webhook for company record changes in Attio.
 *
 * **Placeholder URL** — replace `targetUrl` per environment to point at your
 * ingestion endpoint. Resource class props are static, so Config cannot be
 * used here. Set the real URL when deploying to staging/prod.
 *
 * @see ATTIO_COMPANY_WEBHOOK_URL environment variable (future: make configurable
 *   via a wrapper that reads Config and passes the resolved URL)
 */
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

export class SignupStartedAction extends Action("SignupStartedAction", {
  name: "Signup Started",
  description: "User initiated the signup flow",
  tags: ["acquisition", "funnel", "managed-by-iac"],
  steps: [{ event: Events.SIGNUP_STARTED }],
}) {}

export class OnboardingStartedAction extends Action(
  "OnboardingStartedAction",
  {
    name: "Onboarding Started",
    description: "User started the onboarding flow",
    tags: ["activation", "funnel", "managed-by-iac"],
    steps: [{ event: Events.ONBOARDING_STARTED }],
  },
) {}

export class CheckoutStartedAction extends Action("CheckoutStartedAction", {
  name: "Checkout Started",
  description: "User initiated the checkout/payment flow",
  tags: ["monetization", "funnel", "managed-by-iac"],
  steps: [{ event: Events.CHECKOUT_STARTED }],
}) {}

export class CheckoutCompletedAction extends Action(
  "CheckoutCompletedAction",
  {
    name: "Checkout Completed",
    description: "User completed the checkout/payment flow",
    tags: ["monetization", "funnel", "managed-by-iac"],
    steps: [{ event: Events.CHECKOUT_COMPLETED }],
  },
) {}

export class AccountCancelledAction extends Action("AccountCancelledAction", {
  name: "Account Cancelled",
  description: "User cancelled their account",
  tags: ["churn", "managed-by-iac"],
  steps: [{ event: Events.ACCOUNT_CANCELLED }],
}) {}

export class PaymentFailedAction extends Action("PaymentFailedAction", {
  name: "Payment Failed",
  description: "A payment attempt failed",
  tags: ["monetization", "churn", "managed-by-iac"],
  steps: [{ event: Events.PAYMENT_FAILED }],
}) {}

export class TrialExpiredAction extends Action("TrialExpiredAction", {
  name: "Trial Expired",
  description: "User's trial period expired without conversion",
  tags: ["churn", "managed-by-iac"],
  steps: [{ event: Events.TRIAL_EXPIRED }],
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
          // "$pageview" is a PostHog built-in event, not a custom PLG event
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
          key: UserProperties.PLAN,
          operator: "exact",
          value: Plans.TRIAL,
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
// POSTHOG: Insights — Executive Dashboard
// =============================================================================

/**
 * NOTE: The PostHog Insight API no longer accepts `dashboards` as a writable
 * field (the provider filters it out). To associate insights with dashboards,
 * add them manually in the PostHog UI or via a separate tile API. The
 * `description` field notes the intended dashboard for reference.
 */

export class WeeklySignupsInsight extends Insight("WeeklySignupsInsight", {
  name: "Weekly Signups",
  description: "Weekly signup completions (Executive Overview)",
  saved: true,
  query: {
    kind: "TrendsQuery",
    series: [
      {
        kind: "EventsNode",
        event: Events.SIGNUP_COMPLETED,
        name: "Signups",
        math: "total",
      },
    ],
    interval: "week",
  },
}) {}

export class ActivationRateInsight extends Insight("ActivationRateInsight", {
  name: "Activation Rate",
  description:
    "Weekly activation rate — onboarding_completed / signup_completed × 100 (Executive Overview)",
  saved: true,
  query: {
    kind: "TrendsQuery",
    series: [
      {
        kind: "EventsNode",
        event: Events.ONBOARDING_COMPLETED,
        name: "Onboarding Completed",
        math: "total",
      },
      {
        kind: "EventsNode",
        event: Events.SIGNUP_COMPLETED,
        name: "Signup Completed",
        math: "total",
      },
    ],
    interval: "week",
    trendsFilter: {
      formula: "A / B * 100",
    },
  },
}) {}

export class WeeklyUpgradesInsight extends Insight("WeeklyUpgradesInsight", {
  name: "Weekly Upgrades",
  description: "Weekly plan upgrades (Executive Overview)",
  saved: true,
  query: {
    kind: "TrendsQuery",
    series: [
      {
        kind: "EventsNode",
        event: Events.PLAN_UPGRADED,
        name: "Upgrades",
        math: "total",
      },
    ],
    interval: "week",
  },
}) {}

export class WeeklyChurnInsight extends Insight("WeeklyChurnInsight", {
  name: "Weekly Churn",
  description:
    "Weekly downgrades + cancellations (Executive Overview)",
  saved: true,
  query: {
    kind: "TrendsQuery",
    series: [
      {
        kind: "EventsNode",
        event: Events.PLAN_DOWNGRADED,
        name: "Downgrades",
        math: "total",
      },
      {
        kind: "EventsNode",
        event: Events.ACCOUNT_CANCELLED,
        name: "Cancellations",
        math: "total",
      },
    ],
    interval: "week",
  },
}) {}

// =============================================================================
// POSTHOG: Insights — Product Dashboard
// =============================================================================

export class DailyActiveUsersInsight extends Insight(
  "DailyActiveUsersInsight",
  {
    name: "Daily Active Users",
    description: "DAU count (Product Metrics)",
    saved: true,
    query: {
      kind: "TrendsQuery",
      series: [
        {
          kind: "EventsNode",
          event: null,
          name: "DAU",
          math: "dau",
        },
      ],
      interval: "day",
    },
  },
) {}

export class FeatureAdoptionInsight extends Insight("FeatureAdoptionInsight", {
  name: "Feature Adoption",
  description: "Daily feature usage events (Product Metrics)",
  saved: true,
  query: {
    kind: "TrendsQuery",
    series: [
      {
        kind: "EventsNode",
        event: Events.FEATURE_USED,
        name: "Feature Used",
        math: "total",
      },
    ],
    interval: "day",
  },
}) {}

export class RetentionInsight extends Insight("RetentionInsight", {
  name: "8-Week Retention",
  description:
    "8-week retention cohort based on feature usage (Product Metrics)",
  saved: true,
  query: {
    kind: "RetentionQuery",
    retentionFilter: {
      targetEntity: {
        id: Events.FEATURE_USED,
        type: "events",
      },
      returningEntity: {
        id: Events.FEATURE_USED,
        type: "events",
      },
      period: "Week",
      totalIntervals: 8,
    },
  },
}) {}

// =============================================================================
// POSTHOG: Insights — Growth Dashboard
// =============================================================================

export class ActivationFunnelInsight extends Insight(
  "ActivationFunnelInsight",
  {
    name: "Activation Funnel",
    description:
      "Signup → Onboarding → Feature Used funnel (Growth & Activation)",
    saved: true,
    query: {
      kind: "FunnelsQuery",
      series: [
        {
          kind: "EventsNode",
          event: Events.SIGNUP_COMPLETED,
          name: "Step 1: Signup",
        },
        {
          kind: "EventsNode",
          event: Events.ONBOARDING_COMPLETED,
          name: "Step 2: Onboarding",
        },
        {
          kind: "EventsNode",
          event: Events.FEATURE_USED,
          name: "Step 3: Feature Used",
        },
      ],
    },
  },
) {}

export class TimeToActivationInsight extends Insight(
  "TimeToActivationInsight",
  {
    name: "Time to Activation",
    description:
      "Time-to-convert funnel: signup → feature used within 14 days (Growth & Activation)",
    saved: true,
    query: {
      kind: "FunnelsQuery",
      series: [
        {
          kind: "EventsNode",
          event: Events.SIGNUP_COMPLETED,
          name: "Signup",
        },
        {
          kind: "EventsNode",
          event: Events.FEATURE_USED,
          name: "First Feature Use",
        },
      ],
      funnelsFilter: {
        funnelVizType: "time_to_convert",
        funnelWindowInterval: 14,
        funnelWindowIntervalUnit: "day",
      },
    },
  },
) {}

export class UpgradeFunnelInsight extends Insight("UpgradeFunnelInsight", {
  name: "Upgrade Funnel",
  description:
    "Onboarding → Plan Upgraded funnel (Growth & Activation)",
  saved: true,
  query: {
    kind: "FunnelsQuery",
    series: [
      {
        kind: "EventsNode",
        event: Events.ONBOARDING_COMPLETED,
        name: "Onboarding Completed",
      },
      {
        kind: "EventsNode",
        event: Events.PLAN_UPGRADED,
        name: "Plan Upgraded",
      },
    ],
  },
}) {}

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

export class NewNavigationFlag extends FeatureFlag("NewNavigationFlag", {
  key: FeatureFlags.NEW_NAVIGATION,
  name: "New Navigation",
  active: false,
  rolloutPercentage: 0,
}) {}

export class NewPricingPageFlag extends FeatureFlag("NewPricingPageFlag", {
  key: FeatureFlags.NEW_PRICING_PAGE,
  name: "New Pricing Page",
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

export class PersonaSurvey extends Survey("PersonaSurvey", {
  name: "Persona Survey",
  type: "popover",
  description: "Identify user role and persona for segmentation",
  questions: [
    {
      type: "single_choice",
      question: "Which best describes your role?",
      choices: [
        "Founder / CEO",
        "Product Manager",
        "Engineer / Developer",
        "Designer",
        "Marketing / Growth",
        "Sales",
        "Other",
      ],
    },
  ],
}) {}

export class JtbdSurvey extends Survey("JtbdSurvey", {
  name: "Jobs To Be Done",
  type: "popover",
  description: "Discover primary jobs-to-be-done for product direction",
  questions: [
    {
      type: "open",
      question:
        "What is the main job you're trying to accomplish with our product?",
    },
  ],
}) {}

export class SupportCsatSurvey extends Survey("SupportCsatSurvey", {
  name: "Support CSAT",
  type: "api",
  description: "CSAT survey sent after support interactions",
  questions: [
    {
      type: "rating",
      question: "How satisfied are you with the support you received?",
      scale: 5,
      lowerBoundLabel: "Very dissatisfied",
      upperBoundLabel: "Very satisfied",
    },
  ],
}) {}

export class TrialExitSurvey extends Survey("TrialExitSurvey", {
  name: "Trial Exit Survey",
  type: "api",
  description: "Survey sent when trial expires without conversion",
  questions: [
    {
      type: "single_choice",
      question: "What's the main reason you didn't convert?",
      choices: [
        "Too expensive",
        "Didn't have enough time to evaluate",
        "Missing features I need",
        "Too complicated to set up",
        "Chose a different solution",
        "Other",
      ],
    },
    {
      type: "open",
      question: "What would have convinced you to upgrade?",
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

// DeploymentAnnotation removed — annotations mark a point-in-time event (a
// deploy) and should be created by CI at deploy time, not declared as static
// IaC resources. Using `new Date().toISOString()` at import time caused every
// `alchemy plan` to show drift.

// =============================================================================
// Stack Definition
// =============================================================================

const stack = defineStack({
  name: "plg-stack",
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
    SignupStartedAction,
    SignupCompletedAction,
    OnboardingStartedAction,
    OnboardingCompletedAction,
    FeatureUsedAction,
    PlanUpgradedAction,
    PlanDowngradedAction,
    CheckoutStartedAction,
    CheckoutCompletedAction,
    AccountCancelledAction,
    PaymentFailedAction,
    TrialExpiredAction,

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

    // === POSTHOG: Insights — Executive ===
    WeeklySignupsInsight,
    ActivationRateInsight,
    WeeklyUpgradesInsight,
    WeeklyChurnInsight,

    // === POSTHOG: Insights — Product ===
    DailyActiveUsersInsight,
    FeatureAdoptionInsight,
    RetentionInsight,

    // === POSTHOG: Insights — Growth ===
    ActivationFunnelInsight,
    TimeToActivationInsight,
    UpgradeFunnelInsight,

    // === POSTHOG: Feature Flags ===
    DarkModeFlag,
    BetaFeaturesFlag,
    NewOnboardingFlag,
    AdvancedExportsFlag,
    NewNavigationFlag,
    NewPricingPageFlag,

    // === POSTHOG: Surveys ===
    PostActivationNpsSurvey,
    MonthlyNpsSurvey,
    FeatureCsatSurvey,
    ChurnExitSurvey,
    PersonaSurvey,
    JtbdSurvey,
    SupportCsatSurvey,
    TrialExitSurvey,

    // === POSTHOG: Experiments ===
    OnboardingFlowExperiment,

  ],
  providers: providers(),
  tap: (outputs) =>
    Effect.log(
      `PLG Stack deployed: ${Object.keys(outputs).length} resources`,
    ),
});

// =============================================================================
// Stage References
// =============================================================================

export const PLGStack = stages
  .ref<typeof stack>("plg-stack")
  .as({
    prod: "prod",
    staging: "staging",
    dev: (user: USER = USER) => `dev_${user}`,
  });

export default stack;
