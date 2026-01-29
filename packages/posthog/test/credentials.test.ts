import { describe, expect, it } from "@effect/vitest";
import * as Effect from "effect/Effect";
import * as Redacted from "effect/Redacted";

import { Credentials } from "../src/credentials.js";
import { MissingCredentialsError } from "../src/errors.js";

const withClearedEnv = <A, E, R>(
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = process.env.POSTHOG_API_KEY;
      delete process.env.POSTHOG_API_KEY;
      return previous;
    }),
    () => effect,
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) {
          delete process.env.POSTHOG_API_KEY;
        } else {
          process.env.POSTHOG_API_KEY = previous;
        }
      })
  );

const withEnvValue = <A, E, R>(
  value: string,
  effect: Effect.Effect<A, E, R>
): Effect.Effect<A, E, R> =>
  Effect.acquireUseRelease(
    Effect.sync(() => {
      const previous = process.env.POSTHOG_API_KEY;
      process.env.POSTHOG_API_KEY = value;
      return previous;
    }),
    () => effect,
    (previous) =>
      Effect.sync(() => {
        if (previous === undefined) {
          delete process.env.POSTHOG_API_KEY;
        } else {
          process.env.POSTHOG_API_KEY = previous;
        }
      })
  );

describe("Credentials", () => {
  describe("fromEnv", () => {
    it.effect("should fail when POSTHOG_API_KEY is not set", () =>
      withClearedEnv(
        Effect.gen(function* () {
          const error = yield* Effect.flip(
            Effect.gen(function* () {
              yield* Credentials;
            }).pipe(Effect.provide(Credentials.fromEnv()))
          );

          expect(error._tag).toBe("MissingCredentialsError");
          expect(error).toBeInstanceOf(MissingCredentialsError);
          expect(error.message).toContain("POSTHOG_API_KEY");
        })
      )
    );

    it.effect("should succeed when POSTHOG_API_KEY is set", () =>
      withEnvValue(
        "phx_test_key_123",
        Effect.gen(function* () {
          const credentials = yield* Credentials;
          expect(Redacted.value(credentials.apiKey)).toBe("phx_test_key_123");
        }).pipe(Effect.provide(Credentials.fromEnv()))
      )
    );
  });

  describe("fromApiKey", () => {
    it.effect("should create credentials from a plain string", () =>
      Effect.gen(function* () {
        const credentials = yield* Credentials;
        expect(Redacted.value(credentials.apiKey)).toBe("phx_plain_string_key");
      }).pipe(Effect.provide(Credentials.fromApiKey("phx_plain_string_key")))
    );

    it.effect("should handle empty string", () =>
      Effect.gen(function* () {
        const credentials = yield* Credentials;
        expect(Redacted.value(credentials.apiKey)).toBe("");
      }).pipe(Effect.provide(Credentials.fromApiKey("")))
    );

    it.effect("should handle special characters in API key", () =>
      Effect.gen(function* () {
        const testApiKey = "phx_key_with_special_chars_!@#$%^&*()";
        const credentials = yield* Credentials;
        expect(Redacted.value(credentials.apiKey)).toBe(testApiKey);
      }).pipe(
        Effect.provide(
          Credentials.fromApiKey("phx_key_with_special_chars_!@#$%^&*()")
        )
      )
    );
  });

  describe("fromRedactedApiKey", () => {
    it.effect("should create credentials from a Redacted value", () =>
      Effect.gen(function* () {
        const credentials = yield* Credentials;
        expect(Redacted.value(credentials.apiKey)).toBe("phx_redacted_key");
      }).pipe(
        Effect.provide(
          Credentials.fromRedactedApiKey(Redacted.make("phx_redacted_key"))
        )
      )
    );
  });

  describe("PostHogCredentials interface", () => {
    it.effect("should have apiKey as Redacted type", () =>
      Effect.gen(function* () {
        const credentials = yield* Credentials;
        const redactedKey: Redacted.Redacted<string> = credentials.apiKey;
        expect(Redacted.value(redactedKey)).toBe("phx_interface_test");
      }).pipe(Effect.provide(Credentials.fromApiKey("phx_interface_test")))
    );

    it.effect("should prevent accidental logging of API key", () =>
      Effect.gen(function* () {
        const credentials = yield* Credentials;
        const stringified = String(credentials.apiKey);
        expect(stringified).not.toContain("phx_secret_key_do_not_log");
      }).pipe(
        Effect.provide(Credentials.fromApiKey("phx_secret_key_do_not_log"))
      )
    );
  });
});
