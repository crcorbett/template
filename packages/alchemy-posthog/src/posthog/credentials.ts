import { Credentials } from "@packages/posthog/Credentials";
import { App } from "alchemy-effect";
import * as Config from "effect/Config";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

export const fromStageConfig = () =>
  Layer.effect(
    Credentials,
    Effect.gen(function* () {
      const app = yield* App;
      if (app.config.posthog?.apiKey) {
        return { apiKey: Redacted.make(app.config.posthog.apiKey) };
      }
      const apiKey = yield* Config.redacted("POSTHOG_API_KEY");
      return { apiKey };
    })
  );
