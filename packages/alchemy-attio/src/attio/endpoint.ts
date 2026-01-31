import { Endpoint } from "@packages/attio";
import { App } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";

export const fromStageConfig = () =>
  Layer.effect(
    Endpoint,
    Effect.gen(function* () {
      const app = yield* App;
      return app.config.attio?.endpoint ?? "https://api.attio.com";
    }),
  );
