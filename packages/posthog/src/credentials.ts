/**
 * PostHog Credentials Management
 *
 * Provides API key authentication for PostHog API.
 */

import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Redacted from "effect/Redacted";

/**
 * PostHog API credentials containing the API key.
 */
export interface PostHogCredentials {
  readonly apiKey: Redacted.Redacted<string>;
}

/**
 * Context tag for PostHog credentials.
 */
export class Credentials extends Context.Tag("@posthog/Credentials")<
  Credentials,
  PostHogCredentials
>() {
  /**
   * Create credentials from environment variable.
   * Reads POSTHOG_API_KEY from the environment.
   */
  static fromEnv(): Layer.Layer<Credentials, Error> {
    return Layer.effect(
      Credentials,
      Effect.gen(function* () {
        const apiKey = process.env["POSTHOG_API_KEY"];
        if (!apiKey) {
          return yield* Effect.fail(
            new Error("POSTHOG_API_KEY environment variable is not set")
          );
        }
        return { apiKey: Redacted.make(apiKey) };
      })
    );
  }

  /**
   * Create credentials from a provided API key string.
   */
  static fromApiKey(apiKey: string): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey: Redacted.make(apiKey) });
  }

  /**
   * Create credentials from a Redacted API key.
   */
  static fromRedactedApiKey(
    apiKey: Redacted.Redacted<string>
  ): Layer.Layer<Credentials> {
    return Layer.succeed(Credentials, { apiKey });
  }
}
