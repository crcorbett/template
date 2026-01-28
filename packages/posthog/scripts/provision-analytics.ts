/**
 * Provision SaaS Analytics Setup
 *
 * Creates a complete PostHog analytics stack for "Acme Project Manager"
 * and leaves all resources in place (no cleanup).
 *
 * Run with: bun run scripts/provision-analytics.ts
 */

import { FetchHttpClient, FileSystem } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as PlatformConfigProvider from "@effect/platform/PlatformConfigProvider";
import {
  Cause,
  Config,
  ConfigProvider,
  Effect,
  Layer,
  LogLevel,
  Logger,
} from "effect";
import * as net from "node:net";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import { createAction } from "../src/services/actions.js";
import { createAnnotation } from "../src/services/annotations.js";
import { createCohort } from "../src/services/cohorts.js";
import { createDashboard } from "../src/services/dashboards.js";
import { createExperiment } from "../src/services/experiments.js";
import { createFeatureFlag } from "../src/services/feature-flags.js";
import { createInsight } from "../src/services/insights.js";
import { createSurvey } from "../src/services/surveys.js";

// Disable Happy Eyeballs (IPv6 issues)
net.setDefaultAutoSelectFamily(false);

const PREFIX = `acme-${Date.now()}`;

interface CreatedResources {
  cohorts: Array<{ id: number; name: string }>;
  featureFlags: Array<{ id: number; key: string }>;
  insights: Array<{ id: number; name: string }>;
  dashboards: Array<{ id: number; name: string }>;
  surveys: Array<{ id: string; name: string }>;
  actions: Array<{ id: number; name: string }>;
  annotations: Array<{ id: number; content: string }>;
  experiments: Array<{ id: number; name: string }>;
}

const created: CreatedResources = {
  cohorts: [],
  featureFlags: [],
  insights: [],
  dashboards: [],
  surveys: [],
  actions: [],
  annotations: [],
  experiments: [],
};

const provision = Effect.gen(function* () {
  const PROJECT_ID = yield* Config.string("POSTHOG_PROJECT_ID");

  yield* Effect.logInfo("Provisioning Acme Project Manager Analytics Stack").pipe(
    Effect.annotateLogs({ projectId: PROJECT_ID, prefix: PREFIX })
  );

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 1: COHORTS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 1: Creating Cohorts");

  const powerUsers = yield* createCohort({
    project_id: PROJECT_ID,
    name: `${PREFIX}-power-users`,
    description: "Users with high engagement (10+ events/week)",
    is_static: false,
    filters: {
      properties: {
        type: "AND",
        values: [
          {
            type: "AND",
            values: [
              {
                key: "$pageview",
                type: "behavioral",
                value: "performed_event",
                operator: "gte",
                event_type: "events",
                time_value: 7,
                time_interval: "day",
                total_periods: 10,
              },
            ],
          },
        ],
      },
    },
  });
  created.cohorts.push({ id: powerUsers.id, name: powerUsers.name });
  yield* Effect.logInfo(`Created cohort: ${powerUsers.name}`);

  const trialUsers = yield* createCohort({
    project_id: PROJECT_ID,
    name: `${PREFIX}-trial-users`,
    description: "Users currently on trial plan",
    is_static: false,
    filters: {
      properties: {
        type: "AND",
        values: [
          {
            type: "AND",
            values: [
              {
                key: "plan",
                type: "person",
                value: ["trial"],
                operator: "exact",
              },
            ],
          },
        ],
      },
    },
  });
  created.cohorts.push({ id: trialUsers.id, name: trialUsers.name });
  yield* Effect.logInfo(`Created cohort: ${trialUsers.name}`);

  const atRiskUsers = yield* createCohort({
    project_id: PROJECT_ID,
    name: `${PREFIX}-at-risk-users`,
    description: "Users active 30d ago but not in last 14d",
    is_static: false,
    filters: {
      properties: {
        type: "AND",
        values: [
          {
            type: "AND",
            values: [
              {
                key: "$pageview",
                type: "behavioral",
                value: "performed_event",
                operator: "gte",
                event_type: "events",
                time_value: 30,
                time_interval: "day",
              },
            ],
          },
        ],
      },
    },
  });
  created.cohorts.push({ id: atRiskUsers.id, name: atRiskUsers.name });
  yield* Effect.logInfo(`Created cohort: ${atRiskUsers.name}`);

  const enterpriseProspects = yield* createCohort({
    project_id: PROJECT_ID,
    name: `${PREFIX}-enterprise-prospects`,
    description: "Users with team_size > 20 or on pro plan",
    is_static: false,
    filters: {
      properties: {
        type: "OR",
        values: [
          {
            type: "AND",
            values: [
              { key: "team_size", type: "person", value: "20", operator: "gt" },
            ],
          },
          {
            type: "AND",
            values: [
              {
                key: "plan",
                type: "person",
                value: ["pro"],
                operator: "exact",
              },
            ],
          },
        ],
      },
    },
  });
  created.cohorts.push({
    id: enterpriseProspects.id,
    name: enterpriseProspects.name,
  });
  yield* Effect.logInfo(`Created cohort: ${enterpriseProspects.name}`);

  const newSignups = yield* createCohort({
    project_id: PROJECT_ID,
    name: `${PREFIX}-new-signups-7d`,
    description: "Users who signed up in the last 7 days",
    is_static: false,
    filters: {
      properties: {
        type: "AND",
        values: [
          {
            type: "AND",
            values: [
              {
                key: "user_signed_up",
                type: "behavioral",
                value: "performed_event",
                event_type: "events",
                time_value: 7,
                time_interval: "day",
              },
            ],
          },
        ],
      },
    },
  });
  created.cohorts.push({ id: newSignups.id, name: newSignups.name });
  yield* Effect.logInfo(`Created cohort: ${newSignups.name}`);

  const mobileUsers = yield* createCohort({
    project_id: PROJECT_ID,
    name: `${PREFIX}-mobile-users`,
    description: "Users accessing from mobile devices",
    is_static: false,
    filters: {
      properties: {
        type: "AND",
        values: [
          {
            type: "AND",
            values: [
              {
                key: "$device_type",
                type: "person",
                value: ["Mobile"],
                operator: "exact",
              },
            ],
          },
        ],
      },
    },
  });
  created.cohorts.push({ id: mobileUsers.id, name: mobileUsers.name });
  yield* Effect.logInfo(`Created cohort: ${mobileUsers.name}`);

  const integrationUsers = yield* createCohort({
    project_id: PROJECT_ID,
    name: `${PREFIX}-integration-users`,
    description: "Users who have connected integrations",
    is_static: false,
    filters: {
      properties: {
        type: "AND",
        values: [
          {
            type: "AND",
            values: [
              {
                key: "integration_connected",
                type: "behavioral",
                value: "performed_event",
                event_type: "events",
              },
            ],
          },
        ],
      },
    },
  });
  created.cohorts.push({
    id: integrationUsers.id,
    name: integrationUsers.name,
  });
  yield* Effect.logInfo(`Created cohort: ${integrationUsers.name}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 2: FEATURE FLAGS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 2: Creating Feature Flags");

  const onboardingFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-new-onboarding-flow`,
    name: "New Onboarding Flow",
    filters: { groups: [{ properties: [], rollout_percentage: 50 }] },
    active: true,
  });
  created.featureFlags.push({ id: onboardingFlag.id, key: onboardingFlag.key });
  yield* Effect.logInfo(`Created flag: ${onboardingFlag.key} (50% rollout)`);

  const aiFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-ai-task-suggestions`,
    name: "AI Task Suggestions",
    filters: {
      groups: [
        {
          properties: [
            {
              key: "plan",
              type: "person",
              value: ["enterprise"],
              operator: "exact",
            },
          ],
          rollout_percentage: 100,
        },
      ],
    },
    active: true,
  });
  created.featureFlags.push({ id: aiFlag.id, key: aiFlag.key });
  yield* Effect.logInfo(`Created flag: ${aiFlag.key} (enterprise only)`);

  const darkModeFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-dark-mode`,
    name: "Dark Mode",
    filters: { groups: [{ properties: [], rollout_percentage: 100 }] },
    active: true,
  });
  created.featureFlags.push({ id: darkModeFlag.id, key: darkModeFlag.key });
  yield* Effect.logInfo(`Created flag: ${darkModeFlag.key} (100% rollout)`);

  const ganttFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-beta-gantt-chart`,
    name: "Beta Gantt Chart",
    filters: {
      groups: [
        {
          properties: [
            {
              key: "is_power_user",
              type: "person",
              value: ["true"],
              operator: "exact",
            },
          ],
          rollout_percentage: 100,
        },
      ],
    },
    active: true,
  });
  created.featureFlags.push({ id: ganttFlag.id, key: ganttFlag.key });
  yield* Effect.logInfo(`Created flag: ${ganttFlag.key} (power users)`);

  const pricingFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-pricing-experiment-v2`,
    name: "Pricing Experiment V2",
    filters: {
      groups: [{ properties: [], rollout_percentage: 100 }],
      multivariate: {
        variants: [
          { key: "control", rollout_percentage: 34 },
          { key: "variant-a", rollout_percentage: 33 },
          { key: "variant-b", rollout_percentage: 33 },
        ],
      },
    },
    active: true,
  });
  created.featureFlags.push({ id: pricingFlag.id, key: pricingFlag.key });
  yield* Effect.logInfo(`Created flag: ${pricingFlag.key} (multivariate)`);

  const maintenanceFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-maintenance-mode`,
    name: "Maintenance Mode (Kill Switch)",
    filters: { groups: [{ properties: [], rollout_percentage: 0 }] },
    active: false,
  });
  created.featureFlags.push({
    id: maintenanceFlag.id,
    key: maintenanceFlag.key,
  });
  yield* Effect.logInfo(`Created flag: ${maintenanceFlag.key} (kill switch)`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 3: INSIGHTS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 3: Creating Insights");

  const weeklySignups = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-weekly-signups`,
    description: "Track user signups by day",
    query: {
      kind: "TrendsQuery",
      series: [
        { kind: "EventsNode", event: "user_signed_up", name: "User Signed Up" },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
    },
  });
  created.insights.push({ id: weeklySignups.id, name: weeklySignups.name ?? PREFIX });
  yield* Effect.logInfo(`Created insight: ${weeklySignups.name}`);

  const activationFunnel = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-signup-to-activation-funnel`,
    description: "Funnel: signup -> project -> invite -> task",
    query: {
      kind: "FunnelsQuery",
      series: [
        { kind: "EventsNode", event: "user_signed_up", name: "Signup" },
        {
          kind: "EventsNode",
          event: "project_created",
          name: "Created Project",
        },
        { kind: "EventsNode", event: "member_invited", name: "Invited Member" },
        { kind: "EventsNode", event: "task_created", name: "Created Task" },
      ],
      dateRange: { date_from: "-30d" },
    },
  });
  created.insights.push({
    id: activationFunnel.id,
    name: activationFunnel.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created insight: ${activationFunnel.name}`);

  const activationBySource = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-activation-rate-by-source`,
    description: "Activation rate by UTM source",
    query: {
      kind: "TrendsQuery",
      series: [
        { kind: "EventsNode", event: "user_activated", name: "User Activated" },
      ],
      breakdownFilter: {
        breakdown: "$initial_utm_source",
        breakdown_type: "person",
      },
      interval: "week",
      dateRange: { date_from: "-90d" },
    },
  });
  created.insights.push({
    id: activationBySource.id,
    name: activationBySource.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created insight: ${activationBySource.name}`);

  const onboardingFunnel = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-onboarding-completion`,
    description: "Onboarding steps completion funnel",
    query: {
      kind: "FunnelsQuery",
      series: [
        { kind: "EventsNode", event: "onboarding_started", name: "Started" },
        { kind: "EventsNode", event: "onboarding_step_1", name: "Step 1" },
        { kind: "EventsNode", event: "onboarding_step_2", name: "Step 2" },
        {
          kind: "EventsNode",
          event: "onboarding_completed",
          name: "Completed",
        },
      ],
      dateRange: { date_from: "-30d" },
    },
  });
  created.insights.push({
    id: onboardingFunnel.id,
    name: onboardingFunnel.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created insight: ${onboardingFunnel.name}`);

  const dau = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-daily-active-users`,
    description: "Unique users per day",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          kind: "EventsNode",
          event: "$pageview",
          name: "Active Users",
          math: "dau",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
    },
  });
  created.insights.push({ id: dau.id, name: dau.name ?? PREFIX });
  yield* Effect.logInfo(`Created insight: ${dau.name}`);

  const retention = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-weekly-retention`,
    description: "8-week retention cohort analysis",
    query: {
      kind: "RetentionQuery",
      retentionFilter: {
        retentionType: "retention_first_time",
        totalIntervals: 8,
        period: "Week",
        targetEntity: { id: "$pageview", type: "events" },
        returningEntity: { id: "$pageview", type: "events" },
      },
      dateRange: { date_from: "-60d" },
    },
  });
  created.insights.push({ id: retention.id, name: retention.name ?? PREFIX });
  yield* Effect.logInfo(`Created insight: ${retention.name}`);

  const featureUsage = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-feature-usage-breakdown`,
    description: "Key feature usage stacked by feature",
    query: {
      kind: "TrendsQuery",
      series: [
        { kind: "EventsNode", event: "task_created", name: "Tasks" },
        { kind: "EventsNode", event: "project_created", name: "Projects" },
        { kind: "EventsNode", event: "comment_added", name: "Comments" },
        { kind: "EventsNode", event: "file_uploaded", name: "File Uploads" },
      ],
      interval: "week",
      dateRange: { date_from: "-30d" },
    },
  });
  created.insights.push({ id: featureUsage.id, name: featureUsage.name ?? PREFIX });
  yield* Effect.logInfo(`Created insight: ${featureUsage.name}`);

  const sessionDuration = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-session-duration`,
    description: "Average session time trend",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          kind: "EventsNode",
          event: "$pageview",
          name: "Session Duration",
          math: "avg",
          math_property: "$session_duration",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-30d" },
    },
  });
  created.insights.push({
    id: sessionDuration.id,
    name: sessionDuration.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created insight: ${sessionDuration.name}`);

  const trialToPaidFunnel = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-trial-to-paid-funnel`,
    description: "Funnel: trial -> pricing -> checkout -> paid",
    query: {
      kind: "FunnelsQuery",
      series: [
        { kind: "EventsNode", event: "trial_started", name: "Trial Started" },
        { kind: "EventsNode", event: "pricing_viewed", name: "Viewed Pricing" },
        {
          kind: "EventsNode",
          event: "checkout_started",
          name: "Started Checkout",
        },
        {
          kind: "EventsNode",
          event: "subscription_created",
          name: "Subscribed",
        },
      ],
      dateRange: { date_from: "-90d" },
    },
  });
  created.insights.push({
    id: trialToPaidFunnel.id,
    name: trialToPaidFunnel.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created insight: ${trialToPaidFunnel.name}`);

  const upgradeFunnel = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-upgrade-funnel`,
    description: "Upgrade prompt to completion",
    query: {
      kind: "FunnelsQuery",
      series: [
        {
          kind: "EventsNode",
          event: "upgrade_prompt_shown",
          name: "Prompt Shown",
        },
        { kind: "EventsNode", event: "pricing_viewed", name: "Viewed Pricing" },
        { kind: "EventsNode", event: "plan_upgraded", name: "Upgraded" },
      ],
      dateRange: { date_from: "-30d" },
    },
  });
  created.insights.push({ id: upgradeFunnel.id, name: upgradeFunnel.name ?? PREFIX });
  yield* Effect.logInfo(`Created insight: ${upgradeFunnel.name}`);

  const mrrByPlan = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-mrr-by-plan`,
    description: "Subscriptions broken down by plan",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          kind: "EventsNode",
          event: "subscription_created",
          name: "New Subscriptions",
        },
      ],
      breakdownFilter: { breakdown: "plan", breakdown_type: "event" },
      interval: "month",
      dateRange: { date_from: "-180d" },
    },
  });
  created.insights.push({ id: mrrByPlan.id, name: mrrByPlan.name ?? PREFIX });
  yield* Effect.logInfo(`Created insight: ${mrrByPlan.name}`);

  const churnIndicators = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-churn-indicators`,
    description: "At-risk user activity tracking",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          kind: "EventsNode",
          event: "subscription_cancelled",
          name: "Cancellations",
        },
        {
          kind: "EventsNode",
          event: "downgrade_requested",
          name: "Downgrade Requests",
        },
      ],
      interval: "week",
      dateRange: { date_from: "-90d" },
    },
  });
  created.insights.push({
    id: churnIndicators.id,
    name: churnIndicators.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created insight: ${churnIndicators.name}`);

  const errorRate = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-error-rate`,
    description: "Error events tracking",
    query: {
      kind: "TrendsQuery",
      series: [{ kind: "EventsNode", event: "error_occurred", name: "Errors" }],
      breakdownFilter: { breakdown: "error_type", breakdown_type: "event" },
      interval: "day",
      dateRange: { date_from: "-14d" },
    },
  });
  created.insights.push({ id: errorRate.id, name: errorRate.name ?? PREFIX });
  yield* Effect.logInfo(`Created insight: ${errorRate.name}`);

  const pagePerformance = yield* createInsight({
    project_id: PROJECT_ID,
    name: `${PREFIX}-page-performance`,
    description: "Page load time tracking",
    query: {
      kind: "TrendsQuery",
      series: [
        {
          kind: "EventsNode",
          event: "$pageview",
          name: "Page Load Time",
          math: "avg",
          math_property: "$performance_page_load",
        },
      ],
      interval: "day",
      dateRange: { date_from: "-14d" },
    },
  });
  created.insights.push({
    id: pagePerformance.id,
    name: pagePerformance.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created insight: ${pagePerformance.name}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 4: DASHBOARDS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 4: Creating Dashboards");

  const execDashboard = yield* createDashboard({
    project_id: PROJECT_ID,
    name: `${PREFIX}-executive-dashboard`,
    description:
      "High-level metrics for leadership: MAU, MRR, conversion, churn",
    pinned: true,
    tags: ["executive", "kpis"],
  });
  created.dashboards.push({ id: execDashboard.id, name: execDashboard.name ?? PREFIX });
  yield* Effect.logInfo(`Created dashboard: ${execDashboard.name}`);

  const productDashboard = yield* createDashboard({
    project_id: PROJECT_ID,
    name: `${PREFIX}-product-dashboard`,
    description: "Feature usage, activation, retention, and error tracking",
    pinned: false,
    tags: ["product", "features"],
  });
  created.dashboards.push({
    id: productDashboard.id,
    name: productDashboard.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created dashboard: ${productDashboard.name}`);

  const growthDashboard = yield* createDashboard({
    project_id: PROJECT_ID,
    name: `${PREFIX}-growth-dashboard`,
    description: "Acquisition funnels, signup sources, conversion rates",
    pinned: false,
    tags: ["growth", "acquisition"],
  });
  created.dashboards.push({
    id: growthDashboard.id,
    name: growthDashboard.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created dashboard: ${growthDashboard.name}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 5: SURVEYS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 5: Creating Surveys");

  const npsSurvey = yield* createSurvey({
    project_id: PROJECT_ID,
    name: `${PREFIX}-nps-survey`,
    description: "NPS survey shown 30 days after signup",
    type: "popover",
    questions: [
      {
        type: "rating",
        question:
          "How likely are you to recommend Acme Project Manager to a friend or colleague?",
        display: "number",
        scale: 10,
        lowerBoundLabel: "Not at all likely",
        upperBoundLabel: "Extremely likely",
      },
      {
        type: "open",
        question: "What's the primary reason for your score?",
        optional: true,
      },
    ],
  });
  created.surveys.push({ id: npsSurvey.id, name: npsSurvey.name });
  yield* Effect.logInfo(`Created survey: ${npsSurvey.name}`);

  const featureFeedback = yield* createSurvey({
    project_id: PROJECT_ID,
    name: `${PREFIX}-feature-feedback`,
    description: "Feedback survey after using new features",
    type: "popover",
    questions: [
      {
        type: "rating",
        question: "How useful did you find this feature?",
        display: "emoji",
        scale: 5,
        lowerBoundLabel: "Not useful",
        upperBoundLabel: "Very useful",
      },
      {
        type: "open",
        question: "Any suggestions for improvement?",
        optional: true,
      },
    ],
  });
  created.surveys.push({ id: featureFeedback.id, name: featureFeedback.name });
  yield* Effect.logInfo(`Created survey: ${featureFeedback.name}`);

  const churnSurvey = yield* createSurvey({
    project_id: PROJECT_ID,
    name: `${PREFIX}-churn-survey`,
    description: "Survey shown when user cancels subscription",
    type: "api",
    questions: [
      {
        type: "single_choice",
        question: "Why are you cancelling your subscription?",
        choices: [
          "Too expensive",
          "Missing features I need",
          "Switching to competitor",
          "Not using it enough",
          "Technical issues",
          "Other",
        ],
      },
      {
        type: "open",
        question: "Is there anything we could have done differently?",
        optional: true,
      },
    ],
  });
  created.surveys.push({ id: churnSurvey.id, name: churnSurvey.name });
  yield* Effect.logInfo(`Created survey: ${churnSurvey.name}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 6: ACTIONS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 6: Creating Actions");

  const userActivatedAction = yield* createAction({
    project_id: PROJECT_ID,
    name: `${PREFIX}-user-activated`,
    description: "Composite: user has created project + task + invited member",
    steps: [
      { event: "project_created" },
      { event: "task_created" },
      { event: "member_invited" },
    ],
    tags: ["activation", "milestone"],
  });
  created.actions.push({
    id: userActivatedAction.id,
    name: userActivatedAction.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created action: ${userActivatedAction.name}`);

  const engagedSessionAction = yield* createAction({
    project_id: PROJECT_ID,
    name: `${PREFIX}-engaged-session`,
    description: "Composite: meaningful events in one session",
    steps: [
      { event: "task_created" },
      { event: "task_completed" },
      { event: "comment_added" },
    ],
    tags: ["engagement", "session"],
  });
  created.actions.push({
    id: engagedSessionAction.id,
    name: engagedSessionAction.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created action: ${engagedSessionAction.name}`);

  const integrationSetupAction = yield* createAction({
    project_id: PROJECT_ID,
    name: `${PREFIX}-integration-setup`,
    description: "Any integration connection event",
    steps: [
      { event: "integration_connected" },
      { event: "integration_configured" },
    ],
    tags: ["integrations", "activation"],
  });
  created.actions.push({
    id: integrationSetupAction.id,
    name: integrationSetupAction.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created action: ${integrationSetupAction.name}`);

  const paymentFlowAction = yield* createAction({
    project_id: PROJECT_ID,
    name: `${PREFIX}-payment-flow`,
    description: "Payment flow from pricing to completion",
    steps: [
      { event: "pricing_viewed" },
      { event: "checkout_started" },
      { event: "payment_submitted" },
    ],
    tags: ["payment", "conversion"],
  });
  created.actions.push({
    id: paymentFlowAction.id,
    name: paymentFlowAction.name ?? PREFIX,
  });
  yield* Effect.logInfo(`Created action: ${paymentFlowAction.name}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 7: ANNOTATIONS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 7: Creating Annotations");

  const v2Launch = yield* createAnnotation({
    project_id: PROJECT_ID,
    content: `${PREFIX}: v2.0.0 Major Release`,
    date_marker: new Date().toISOString(),
    scope: "project",
  });
  created.annotations.push({ id: v2Launch.id, content: v2Launch.content ?? PREFIX });
  yield* Effect.logInfo(`Created annotation: ${v2Launch.content}`);

  const pricingChange = yield* createAnnotation({
    project_id: PROJECT_ID,
    content: `${PREFIX}: Pricing tier update`,
    date_marker: new Date().toISOString(),
    scope: "project",
  });
  created.annotations.push({
    id: pricingChange.id,
    content: pricingChange.content ?? PREFIX,
  });
  yield* Effect.logInfo(`Created annotation: ${pricingChange.content}`);

  const marketingCampaign = yield* createAnnotation({
    project_id: PROJECT_ID,
    content: `${PREFIX}: Q1 Marketing Campaign Start`,
    date_marker: new Date().toISOString(),
    scope: "project",
  });
  created.annotations.push({
    id: marketingCampaign.id,
    content: marketingCampaign.content ?? PREFIX,
  });
  yield* Effect.logInfo(`Created annotation: ${marketingCampaign.content}`);

  const infraUpgrade = yield* createAnnotation({
    project_id: PROJECT_ID,
    content: `${PREFIX}: Infrastructure performance upgrade`,
    date_marker: new Date().toISOString(),
    scope: "project",
  });
  created.annotations.push({
    id: infraUpgrade.id,
    content: infraUpgrade.content ?? PREFIX,
  });
  yield* Effect.logInfo(`Created annotation: ${infraUpgrade.content}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // PHASE 8: EXPERIMENTS
  // ═══════════════════════════════════════════════════════════════════════════
  yield* Effect.logInfo("Phase 8: Creating Experiments");

  const onboardingExpFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-onboarding-exp-flag`,
    name: "Onboarding Experiment Flag",
    filters: {
      groups: [{ properties: [], rollout_percentage: 100 }],
      multivariate: {
        variants: [
          { key: "control", rollout_percentage: 50 },
          { key: "variant", rollout_percentage: 50 },
        ],
      },
    },
    active: true,
  });
  created.featureFlags.push({
    id: onboardingExpFlag.id,
    key: onboardingExpFlag.key,
  });

  const onboardingExp = yield* createExperiment({
    project_id: PROJECT_ID,
    name: `${PREFIX}-onboarding-experiment`,
    description: "Test new onboarding flow vs control",
    feature_flag_key: onboardingExpFlag.key,
  });
  created.experiments.push({ id: onboardingExp.id, name: onboardingExp.name });
  yield* Effect.logInfo(`Created experiment: ${onboardingExp.name}`);

  const pricingExpFlag = yield* createFeatureFlag({
    project_id: PROJECT_ID,
    key: `${PREFIX}-pricing-exp-flag`,
    name: "Pricing Experiment Flag",
    filters: {
      groups: [{ properties: [], rollout_percentage: 100 }],
      multivariate: {
        variants: [
          { key: "control", rollout_percentage: 34 },
          { key: "variant-a", rollout_percentage: 33 },
          { key: "variant-b", rollout_percentage: 33 },
        ],
      },
    },
    active: true,
  });
  created.featureFlags.push({ id: pricingExpFlag.id, key: pricingExpFlag.key });

  const pricingExp = yield* createExperiment({
    project_id: PROJECT_ID,
    name: `${PREFIX}-pricing-experiment`,
    description: "Test 3 pricing page variants",
    feature_flag_key: pricingExpFlag.key,
  });
  created.experiments.push({ id: pricingExp.id, name: pricingExp.name });
  yield* Effect.logInfo(`Created experiment: ${pricingExp.name}`);

  // ═══════════════════════════════════════════════════════════════════════════
  // SUMMARY
  // ═══════════════════════════════════════════════════════════════════════════
  const total =
    created.cohorts.length +
    created.featureFlags.length +
    created.insights.length +
    created.dashboards.length +
    created.surveys.length +
    created.actions.length +
    created.annotations.length +
    created.experiments.length;

  yield* Effect.logInfo("SaaS Analytics Setup Complete").pipe(
    Effect.annotateLogs({
      cohorts: created.cohorts.length,
      featureFlags: created.featureFlags.length,
      insights: created.insights.length,
      dashboards: created.dashboards.length,
      surveys: created.surveys.length,
      actions: created.actions.length,
      annotations: created.annotations.length,
      experiments: created.experiments.length,
      total,
      postHogUrl: `https://us.posthog.com/project/${PROJECT_ID}`,
    })
  );

  return created;
});

// Platform layer
const platform = Layer.mergeAll(
  NodeContext.layer,
  FetchHttpClient.layer,
  Logger.pretty
);

// Run the provisioning
Effect.runPromise(
  Effect.scoped(
    Effect.gen(function* () {
      const fs = yield* FileSystem.FileSystem;
      const configProvider = (yield* fs.exists("../../.env"))
        ? ConfigProvider.orElse(
            yield* PlatformConfigProvider.fromDotEnv("../../.env"),
            ConfigProvider.fromEnv
          )
        : ConfigProvider.fromEnv();

      return yield* provision.pipe(
        Effect.provide(Credentials.fromEnv()),
        Effect.withConfigProvider(configProvider)
      );
    })
  ).pipe(
    Effect.provide(platform),
    Effect.provideService(Endpoint, "https://us.posthog.com"),
    Effect.tapErrorCause((cause) =>
      Effect.logError("Provisioning failed", Cause.pretty(cause))
    ),
    Logger.withMinimumLogLevel(LogLevel.Info)
  )
);
