import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import { App } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

import "./config";
import * as Credentials from "./credentials";
import * as Endpoint from "./endpoint";
export { Project } from "./project";
import * as Dashboards from "./dashboards/index";
import * as Experiments from "./experiments/index";
import * as FeatureFlags from "./feature-flags/index";
import * as Project from "./project";
import * as Actions from "./actions/index";
import * as Cohorts from "./cohorts/index";
import * as Annotations from "./annotations/index";
import * as Insights from "./insights/index";
import * as Surveys from "./surveys/index";
export {
  Actions,
  Annotations,
  Cohorts,
  Dashboards,
  Experiments,
  FeatureFlags,
  Insights,
  Surveys,
};

/**
 * Read the PostHog stage config from the App context.
 */
export const stageConfig = () =>
  Effect.gen(function* () {
    const app = yield* App;
    return app.config.posthog;
  });

/**
 * Compose a Layer with PostHog stage config layers (Project, Credentials, Endpoint).
 * Does not include HttpClient, allowing callers to provide their own.
 */
export const config = <L extends Layer.Layer<any, any, any>>(layer: L) =>
  layer.pipe(
    Layer.provideMerge(Project.fromStageConfig()),
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig()),
  );

export const resources = () =>
  Layer.mergeAll(
    FeatureFlags.featureFlagProvider(),
    Dashboards.dashboardProvider(),
    Experiments.experimentProvider(),
    Surveys.surveyProvider(),
    Cohorts.cohortProvider(),
    Actions.actionProvider(),
    Annotations.annotationProvider(),
    Insights.insightProvider()
  );

/**
 * Compose all PostHog provider resources with stage config layers.
 * Uses config() internally to avoid duplicating layer provision.
 *
 * NOTE: precreate is intentionally omitted from all PostHog providers because
 * PostHog SaaS resources do not exhibit circular dependency patterns that would
 * require pre-creation with placeholder values (unlike e.g. AWS Lambda which
 * needs a dummy code bundle to break Lambda <-> IAM Role cycles).
 */
export const bareProviders = () => config(resources());

export const providers = () =>
  bareProviders().pipe(Layer.provideMerge(FetchHttpClient.layer));
