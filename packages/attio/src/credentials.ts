import * as Config from "effect/Config";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";
import { MissingCredentialsError } from "./errors.js";

export interface AttioCredentials {
  readonly apiKey: Redacted.Redacted<string>;
}

export class Credentials extends Context.Tag("@attio/Credentials")<
  Credentials,
  AttioCredentials
>() {
  static fromEnv(): Layer.Layer<Credentials, MissingCredentialsError> {
    return Layer.effect(
      Credentials,
      Effect.gen(function* () {
        const apiKey = yield* Config.redacted("ATTIO_API_KEY").pipe(
          Effect.mapError(
            () =>
              new MissingCredentialsError({
                message: "ATTIO_API_KEY environment variable is not set",
              })
          )
        );
        return { apiKey };
      })
    );
  }

  static fromApiKey(apiKey: string): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey: Redacted.make(apiKey) });
  }

  static fromRedactedApiKey(
    apiKey: Redacted.Redacted<string>
  ): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey });
  }
}
