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

export const config = () =>
  Effect.gen(function* () {
    const app = yield* App;
    return app.config.posthog;
  });

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

export const bareProviders = () =>
  resources().pipe(
    Layer.provideMerge(Project.fromStageConfig()),
    Layer.provideMerge(Credentials.fromStageConfig()),
    Layer.provideMerge(Endpoint.fromStageConfig())
  );

export const providers = () =>
  bareProviders().pipe(Layer.provideMerge(FetchHttpClient.layer));
