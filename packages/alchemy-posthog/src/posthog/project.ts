import { App } from "alchemy-effect";
import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export class Project extends Context.Tag("PostHog::ProjectId")<
  Project,
  string
>() {}

export const fromStageConfig = () =>
  Layer.effect(
    Project,
    Effect.gen(function* () {
      const app = yield* App;
      if (app.config.posthog?.projectId) {
        return app.config.posthog.projectId;
      }
      const projectId = yield* Config.string("POSTHOG_PROJECT_ID").pipe(
        Effect.catchAll(() =>
          Effect.dieMessage(
            "PostHog project ID is not set. Provide it via stage config (posthog.projectId) or POSTHOG_PROJECT_ID env var."
          )
        )
      );
      return projectId;
    })
  );
