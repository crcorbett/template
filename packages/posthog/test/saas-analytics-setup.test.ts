/**
 * SaaS Product Analytics Setup Test
 *
 * This comprehensive test provisions a complete PostHog analytics setup for
 * "Acme Project Manager" - a hypothetical B2B SaaS project management tool.
 *
 * It creates:
 * - 7 User Cohorts (power-users, trial-users, at-risk-users, etc.)
 * - 6 Feature Flags (new-onboarding-flow, ai-task-suggestions, etc.)
 * - 15 Insights (trends, funnels, retention)
 * - 3 Dashboards (Executive, Product, Growth)
 * - 3 Surveys (NPS, feature feedback, churn)
 * - 4 Actions (composite events)
 * - 4 Annotations (deployment markers)
 * - 2 Experiments (A/B tests)
 */

import { describe, expect } from "@effect/vitest";
import { Effect } from "effect";

import { createAction, deleteAction } from "../src/services/actions.js";
import {
  createAnnotation,
  deleteAnnotation,
} from "../src/services/annotations.js";
import { createCohort, deleteCohort } from "../src/services/cohorts.js";
import {
  createDashboard,
  deleteDashboard,
} from "../src/services/dashboards.js";
import {
  createExperiment,
  deleteExperiment,
} from "../src/services/experiments.js";
import {
  createFeatureFlag,
  deleteFeatureFlag,
} from "../src/services/feature-flags.js";
import { createInsight, deleteInsight } from "../src/services/insights.js";
import { createSurvey, deleteSurvey } from "../src/services/surveys.js";
import { test, afterAll, TEST_PROJECT_ID } from "./test.js";
const TEST_PREFIX = `acme-${Date.now()}`;

// Track created resources for cleanup
const created = {
  cohorts: [] as number[],
  featureFlags: [] as number[],
  insights: [] as number[],
  dashboards: [] as number[],
  surveys: [] as string[],
  actions: [] as number[],
  annotations: [] as number[],
  experiments: [] as number[],
};

// Cleanup function to remove all created resources
const cleanupAll = Effect.gen(function* () {
  const projectId = yield* TEST_PROJECT_ID;
  // Delete in reverse order of dependencies
  for (const id of created.experiments) {
    yield* deleteExperiment({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
  for (const id of created.annotations) {
    yield* deleteAnnotation({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
  for (const id of created.actions) {
    yield* deleteAction({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
  for (const id of created.surveys) {
    yield* deleteSurvey({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
  for (const id of created.dashboards) {
    yield* deleteDashboard({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
  for (const id of created.insights) {
    yield* deleteInsight({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
  for (const id of created.featureFlags) {
    yield* deleteFeatureFlag({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
  for (const id of created.cohorts) {
    yield* deleteCohort({ project_id: projectId, id }).pipe(
      Effect.catchAll(() => Effect.void)
    );
  }
});

// Cleanup after all tests
afterAll(cleanupAll, 120_000);

describe("SaaS Analytics Setup for Acme Project Manager", () => {
  describe("Phase 1: User Cohorts", () => {
    test("creates power-users cohort", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const cohort = yield* createCohort({
          project_id: projectId,
          name: `${TEST_PREFIX}-power-users`,
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
        created.cohorts.push(cohort.id);
        expect(cohort.name).toContain("power-users");
      }));

    test("creates trial-users cohort", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const cohort = yield* createCohort({
          project_id: projectId,
          name: `${TEST_PREFIX}-trial-users`,
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
        created.cohorts.push(cohort.id);
        expect(cohort.name).toContain("trial-users");
      }));

    test("creates at-risk-users cohort", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const cohort = yield* createCohort({
          project_id: projectId,
          name: `${TEST_PREFIX}-at-risk-users`,
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
        created.cohorts.push(cohort.id);
        expect(cohort.name).toContain("at-risk-users");
      }));

    test("creates enterprise-prospects cohort", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const cohort = yield* createCohort({
          project_id: projectId,
          name: `${TEST_PREFIX}-enterprise-prospects`,
          description: "Users with team_size > 20 or on pro plan",
          is_static: false,
          filters: {
            properties: {
              type: "OR",
              values: [
                {
                  type: "AND",
                  values: [
                    {
                      key: "team_size",
                      type: "person",
                      value: "20",
                      operator: "gt",
                    },
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
        created.cohorts.push(cohort.id);
        expect(cohort.name).toContain("enterprise-prospects");
      }));

    test("creates new-signups-7d cohort", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const cohort = yield* createCohort({
          project_id: projectId,
          name: `${TEST_PREFIX}-new-signups-7d`,
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
        created.cohorts.push(cohort.id);
        expect(cohort.name).toContain("new-signups-7d");
      }));

    test("creates mobile-users cohort", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const cohort = yield* createCohort({
          project_id: projectId,
          name: `${TEST_PREFIX}-mobile-users`,
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
        created.cohorts.push(cohort.id);
        expect(cohort.name).toContain("mobile-users");
      }));

    test("creates integration-users cohort", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const cohort = yield* createCohort({
          project_id: projectId,
          name: `${TEST_PREFIX}-integration-users`,
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
        created.cohorts.push(cohort.id);
        expect(cohort.name).toContain("integration-users");
      }));
  });

  describe("Phase 2: Feature Flags", () => {
    test("creates new-onboarding-flow flag (50% rollout)", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-new-onboarding-flow`,
          name: "New Onboarding Flow",
          filters: {
            groups: [
              {
                properties: [],
                rollout_percentage: 50,
              },
            ],
          },
          active: true,
        });
        created.featureFlags.push(flag.id);
        expect(flag.key).toContain("new-onboarding-flow");
      }));

    test("creates ai-task-suggestions flag (enterprise only)", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-ai-task-suggestions`,
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
        created.featureFlags.push(flag.id);
        expect(flag.key).toContain("ai-task-suggestions");
      }));

    test("creates dark-mode flag (100% rollout)", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-dark-mode`,
          name: "Dark Mode",
          filters: {
            groups: [
              {
                properties: [],
                rollout_percentage: 100,
              },
            ],
          },
          active: true,
        });
        created.featureFlags.push(flag.id);
        expect(flag.key).toContain("dark-mode");
      }));

    test("creates beta-gantt-chart flag (power users)", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-beta-gantt-chart`,
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
        created.featureFlags.push(flag.id);
        expect(flag.key).toContain("beta-gantt-chart");
      }));

    test("creates pricing-experiment-v2 multivariate flag", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-pricing-experiment-v2`,
          name: "Pricing Experiment V2",
          filters: {
            groups: [
              {
                properties: [],
                rollout_percentage: 100,
              },
            ],
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
        created.featureFlags.push(flag.id);
        expect(flag.key).toContain("pricing-experiment-v2");
      }));

    test("creates maintenance-mode kill switch (0%)", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-maintenance-mode`,
          name: "Maintenance Mode (Kill Switch)",
          filters: {
            groups: [
              {
                properties: [],
                rollout_percentage: 0,
              },
            ],
          },
          active: false,
        });
        created.featureFlags.push(flag.id);
        expect(flag.key).toContain("maintenance-mode");
      }));
  });

  describe("Phase 3: Analytics Insights", () => {
    // Acquisition & Activation
    test("creates weekly-signups trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-weekly-signups`,
          description: "Track user signups by day",
          query: {
            kind: "TrendsQuery",
            series: [
              {
                kind: "EventsNode",
                event: "user_signed_up",
                name: "User Signed Up",
              },
            ],
            interval: "day",
            dateRange: { date_from: "-30d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("weekly-signups");
      }));

    test("creates signup-to-activation funnel", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-signup-to-activation-funnel`,
          description: "Funnel: signup → project → invite → task",
          query: {
            kind: "FunnelsQuery",
            series: [
              { kind: "EventsNode", event: "user_signed_up", name: "Signup" },
              {
                kind: "EventsNode",
                event: "project_created",
                name: "Created Project",
              },
              {
                kind: "EventsNode",
                event: "member_invited",
                name: "Invited Member",
              },
              {
                kind: "EventsNode",
                event: "task_created",
                name: "Created Task",
              },
            ],
            dateRange: { date_from: "-30d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("signup-to-activation-funnel");
      }));

    test("creates activation-rate-by-source trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-activation-rate-by-source`,
          description: "Activation rate by UTM source",
          query: {
            kind: "TrendsQuery",
            series: [
              {
                kind: "EventsNode",
                event: "user_activated",
                name: "User Activated",
              },
            ],
            breakdownFilter: {
              breakdown: "$initial_utm_source",
              breakdown_type: "person",
            },
            interval: "week",
            dateRange: { date_from: "-90d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("activation-rate-by-source");
      }));

    test("creates onboarding-completion funnel", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-onboarding-completion`,
          description: "Onboarding steps completion funnel",
          query: {
            kind: "FunnelsQuery",
            series: [
              {
                kind: "EventsNode",
                event: "onboarding_started",
                name: "Started",
              },
              {
                kind: "EventsNode",
                event: "onboarding_step_1",
                name: "Step 1",
              },
              {
                kind: "EventsNode",
                event: "onboarding_step_2",
                name: "Step 2",
              },
              {
                kind: "EventsNode",
                event: "onboarding_completed",
                name: "Completed",
              },
            ],
            dateRange: { date_from: "-30d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("onboarding-completion");
      }));

    // Engagement & Retention
    test("creates daily-active-users trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-daily-active-users`,
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
        created.insights.push(insight.id);
        expect(insight.name).toContain("daily-active-users");
      }));

    test("creates weekly-retention analysis", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-weekly-retention`,
          description: "8-week retention cohort analysis",
          query: {
            kind: "RetentionQuery",
            retentionFilter: {
              retentionType: "retention_first_time",
              totalIntervals: 8,
              period: "Week",
              targetEntity: {
                id: "$pageview",
                type: "events",
              },
              returningEntity: {
                id: "$pageview",
                type: "events",
              },
            },
            dateRange: { date_from: "-60d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("weekly-retention");
      }));

    test("creates feature-usage-breakdown trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-feature-usage-breakdown`,
          description: "Key feature usage stacked by feature",
          query: {
            kind: "TrendsQuery",
            series: [
              { kind: "EventsNode", event: "task_created", name: "Tasks" },
              {
                kind: "EventsNode",
                event: "project_created",
                name: "Projects",
              },
              { kind: "EventsNode", event: "comment_added", name: "Comments" },
              {
                kind: "EventsNode",
                event: "file_uploaded",
                name: "File Uploads",
              },
            ],
            interval: "week",
            dateRange: { date_from: "-30d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("feature-usage-breakdown");
      }));

    test("creates power-user-actions trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-power-user-actions`,
          description: "Event trends from power users",
          query: {
            kind: "TrendsQuery",
            series: [
              {
                kind: "EventsNode",
                event: "$pageview",
                name: "Power User Events",
              },
            ],
            properties: {
              type: "AND",
              values: [
                {
                  type: "AND",
                  values: [
                    {
                      key: "is_power_user",
                      type: "person",
                      value: ["true"],
                      operator: "exact",
                    },
                  ],
                },
              ],
            },
            interval: "day",
            dateRange: { date_from: "-30d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("power-user-actions");
      }));

    test("creates session-duration trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-session-duration`,
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
        created.insights.push(insight.id);
        expect(insight.name).toContain("session-duration");
      }));

    // Conversion & Revenue
    test("creates trial-to-paid funnel", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-trial-to-paid-funnel`,
          description: "Funnel: trial → pricing → checkout → paid",
          query: {
            kind: "FunnelsQuery",
            series: [
              {
                kind: "EventsNode",
                event: "trial_started",
                name: "Trial Started",
              },
              {
                kind: "EventsNode",
                event: "pricing_viewed",
                name: "Viewed Pricing",
              },
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
        created.insights.push(insight.id);
        expect(insight.name).toContain("trial-to-paid-funnel");
      }));

    test("creates upgrade-funnel", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-upgrade-funnel`,
          description: "Upgrade prompt to completion",
          query: {
            kind: "FunnelsQuery",
            series: [
              {
                kind: "EventsNode",
                event: "upgrade_prompt_shown",
                name: "Prompt Shown",
              },
              {
                kind: "EventsNode",
                event: "pricing_viewed",
                name: "Viewed Pricing",
              },
              {
                kind: "EventsNode",
                event: "plan_upgraded",
                name: "Upgraded",
              },
            ],
            dateRange: { date_from: "-30d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("upgrade-funnel");
      }));

    test("creates mrr-by-plan trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-mrr-by-plan`,
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
            breakdownFilter: {
              breakdown: "plan",
              breakdown_type: "event",
            },
            interval: "month",
            dateRange: { date_from: "-180d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("mrr-by-plan");
      }));

    test("creates churn-indicators trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-churn-indicators`,
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
        created.insights.push(insight.id);
        expect(insight.name).toContain("churn-indicators");
      }));

    // Product Health
    test("creates error-rate trend", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const insight = yield* createInsight({
          project_id: projectId,
          name: `${TEST_PREFIX}-error-rate`,
          description: "Error events tracking",
          query: {
            kind: "TrendsQuery",
            series: [
              {
                kind: "EventsNode",
                event: "error_occurred",
                name: "Errors",
              },
            ],
            breakdownFilter: {
              breakdown: "error_type",
              breakdown_type: "event",
            },
            interval: "day",
            dateRange: { date_from: "-14d" },
          },
        });
        created.insights.push(insight.id);
        expect(insight.name).toContain("error-rate");
      }));
  });

  describe("Phase 4: Dashboards", () => {
    test("creates Executive Dashboard", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const dashboard = yield* createDashboard({
          project_id: projectId,
          name: `${TEST_PREFIX}-executive-dashboard`,
          description:
            "High-level metrics for leadership: MAU, MRR, conversion, churn",
          pinned: true,
          tags: ["executive", "kpis"],
        });
        created.dashboards.push(dashboard.id);
        expect(dashboard.name).toContain("executive-dashboard");
      }));

    test("creates Product Dashboard", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const dashboard = yield* createDashboard({
          project_id: projectId,
          name: `${TEST_PREFIX}-product-dashboard`,
          description:
            "Feature usage, activation, retention, and error tracking",
          pinned: false,
          tags: ["product", "features"],
        });
        created.dashboards.push(dashboard.id);
        expect(dashboard.name).toContain("product-dashboard");
      }));

    test("creates Growth Dashboard", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const dashboard = yield* createDashboard({
          project_id: projectId,
          name: `${TEST_PREFIX}-growth-dashboard`,
          description: "Acquisition funnels, signup sources, conversion rates",
          pinned: false,
          tags: ["growth", "acquisition"],
        });
        created.dashboards.push(dashboard.id);
        expect(dashboard.name).toContain("growth-dashboard");
      }));
  });

  describe("Phase 5: Surveys", () => {
    test("creates NPS survey", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const survey = yield* createSurvey({
          project_id: projectId,
          name: `${TEST_PREFIX}-nps-survey`,
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
        created.surveys.push(survey.id);
        expect(survey.name).toContain("nps-survey");
      }));

    test("creates feature feedback survey", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const survey = yield* createSurvey({
          project_id: projectId,
          name: `${TEST_PREFIX}-feature-feedback`,
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
        created.surveys.push(survey.id);
        expect(survey.name).toContain("feature-feedback");
      }));

    test("creates churn survey", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const survey = yield* createSurvey({
          project_id: projectId,
          name: `${TEST_PREFIX}-churn-survey`,
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
        created.surveys.push(survey.id);
        expect(survey.name).toContain("churn-survey");
      }));
  });

  describe("Phase 6: Actions (Composite Events)", () => {
    test("creates user-activated action", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const action = yield* createAction({
          project_id: projectId,
          name: `${TEST_PREFIX}-user-activated`,
          description:
            "Composite: user has created project + task + invited member",
          steps: [
            { event: "project_created" },
            { event: "task_created" },
            { event: "member_invited" },
          ],
          tags: ["activation", "milestone"],
        });
        created.actions.push(action.id);
        expect(action.name).toContain("user-activated");
      }));

    test("creates engaged-session action", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const action = yield* createAction({
          project_id: projectId,
          name: `${TEST_PREFIX}-engaged-session`,
          description: "Composite: 5+ meaningful events in one session",
          steps: [
            { event: "task_created" },
            { event: "task_completed" },
            { event: "comment_added" },
          ],
          tags: ["engagement", "session"],
        });
        created.actions.push(action.id);
        expect(action.name).toContain("engaged-session");
      }));

    test("creates integration-setup action", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const action = yield* createAction({
          project_id: projectId,
          name: `${TEST_PREFIX}-integration-setup`,
          description: "Any integration connection event",
          steps: [
            { event: "integration_connected" },
            { event: "integration_configured" },
          ],
          tags: ["integrations", "activation"],
        });
        created.actions.push(action.id);
        expect(action.name).toContain("integration-setup");
      }));

    test("creates payment-flow action", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const action = yield* createAction({
          project_id: projectId,
          name: `${TEST_PREFIX}-payment-flow`,
          description: "Payment flow from pricing to completion",
          steps: [
            { event: "pricing_viewed" },
            { event: "checkout_started" },
            { event: "payment_submitted" },
          ],
          tags: ["payment", "conversion"],
        });
        created.actions.push(action.id);
        expect(action.name).toContain("payment-flow");
      }));
  });

  describe("Phase 7: Annotations", () => {
    test("creates v2-launch annotation", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const annotation = yield* createAnnotation({
          project_id: projectId,
          content: `${TEST_PREFIX}: v2.0.0 Major Release`,
          date_marker: new Date().toISOString(),
          scope: "project",
        });
        created.annotations.push(annotation.id);
        expect(annotation.content).toContain("v2.0.0");
      }));

    test("creates pricing-change annotation", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const annotation = yield* createAnnotation({
          project_id: projectId,
          content: `${TEST_PREFIX}: Pricing tier update`,
          date_marker: new Date().toISOString(),
          scope: "project",
        });
        created.annotations.push(annotation.id);
        expect(annotation.content).toContain("Pricing");
      }));

    test("creates marketing-campaign annotation", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const annotation = yield* createAnnotation({
          project_id: projectId,
          content: `${TEST_PREFIX}: Q1 Marketing Campaign Start`,
          date_marker: new Date().toISOString(),
          scope: "project",
        });
        created.annotations.push(annotation.id);
        expect(annotation.content).toContain("Marketing Campaign");
      }));

    test("creates infrastructure-upgrade annotation", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        const annotation = yield* createAnnotation({
          project_id: projectId,
          content: `${TEST_PREFIX}: Infrastructure performance upgrade`,
          date_marker: new Date().toISOString(),
          scope: "project",
        });
        created.annotations.push(annotation.id);
        expect(annotation.content).toContain("Infrastructure");
      }));
  });

  describe("Phase 8: A/B Experiments", () => {
    test("creates onboarding-experiment", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        // Create the experiment flag first
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-onboarding-exp-flag`,
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
        created.featureFlags.push(flag.id);

        const experiment = yield* createExperiment({
          project_id: projectId,
          name: `${TEST_PREFIX}-onboarding-experiment`,
          description: "Test new onboarding flow vs control",
          feature_flag_key: flag.key,
        });
        created.experiments.push(experiment.id);
        expect(experiment.name).toContain("onboarding-experiment");
      }));

    test("creates pricing-experiment", () =>
      Effect.gen(function* () {
        const projectId = yield* TEST_PROJECT_ID;
        // Create the experiment flag first
        const flag = yield* createFeatureFlag({
          project_id: projectId,
          key: `${TEST_PREFIX}-pricing-exp-flag`,
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
        created.featureFlags.push(flag.id);

        const experiment = yield* createExperiment({
          project_id: projectId,
          name: `${TEST_PREFIX}-pricing-experiment`,
          description: "Test 3 pricing page variants",
          feature_flag_key: flag.key,
        });
        created.experiments.push(experiment.id);
        expect(experiment.name).toContain("pricing-experiment");
      }));
  });

  describe("Summary", () => {
    test("verifies all resources were created", () =>
      Effect.gen(function* () {
        // Yield to make this a proper generator
        yield* Effect.void;

        expect(created.cohorts.length).toBe(7);
        expect(created.featureFlags.length).toBe(8); // 6 + 2 experiment flags
        expect(created.insights.length).toBe(14); // We created 14 insights
        expect(created.dashboards.length).toBe(3);
        expect(created.surveys.length).toBe(3);
        expect(created.actions.length).toBe(4);
        expect(created.annotations.length).toBe(4);
        expect(created.experiments.length).toBe(2);

        const total =
          created.cohorts.length +
          created.featureFlags.length +
          created.insights.length +
          created.dashboards.length +
          created.surveys.length +
          created.actions.length +
          created.annotations.length +
          created.experiments.length;

        console.log(`\nSaaS Analytics Setup Complete!`);
        console.log(`   - Cohorts: ${created.cohorts.length}`);
        console.log(`   - Feature Flags: ${created.featureFlags.length}`);
        console.log(`   - Insights: ${created.insights.length}`);
        console.log(`   - Dashboards: ${created.dashboards.length}`);
        console.log(`   - Surveys: ${created.surveys.length}`);
        console.log(`   - Actions: ${created.actions.length}`);
        console.log(`   - Annotations: ${created.annotations.length}`);
        console.log(`   - Experiments: ${created.experiments.length}`);
        console.log(`   - Total Resources: ${total}`);
      }));
  });
});
