import { Credentials } from "@packages/attio/Credentials";
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
      if (app.config.attio?.apiKey) {
        return { apiKey: Redacted.make(app.config.attio.apiKey) };
      }
      const apiKey = yield* Config.redacted("ATTIO_API_KEY");
      return { apiKey };
    }),
  );
