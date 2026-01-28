import { FetchHttpClient, FileSystem, HttpClient } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as Path from "@effect/platform/Path";
import * as PlatformConfigProvider from "@effect/platform/PlatformConfigProvider";
import { it } from "@effect/vitest";
import { Endpoint } from "@packages/posthog";
import { Credentials } from "@packages/posthog/Credentials";
import { App, State, make as makeApp } from "alchemy-effect";
import { Config, ConfigProvider, LogLevel } from "effect";
import * as Context from "effect/Context";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Scope from "effect/Scope";
import * as net from "node:net";

/**
 * Workaround for Node.js 20+ "Happy Eyeballs" (RFC 8305) bug.
 */
net.setDefaultAutoSelectFamily(false);

/**
 * The PostHog project ID used for integration tests.
 */
export const TEST_PROJECT_ID: Effect.Effect<string, Error> = Config.string(
  "POSTHOG_PROJECT_ID"
).pipe(
  Effect.mapError(
    () => new Error("POSTHOG_PROJECT_ID is required. Set it in your .env file.")
  )
);

/**
 * CLI service mock for tests
 */
class CLI extends Context.Tag("CLIService")<
  CLI,
  {
    approvePlan: (plan: unknown) => Effect.Effect<boolean>;
    displayPlan: (plan: unknown) => Effect.Effect<void>;
    startApplySession: (plan: unknown) => Effect.Effect<{
      emit: (event: unknown) => Effect.Effect<void>;
      done: () => Effect.Effect<void>;
    }>;
  }
>() {}

const testCLI = Layer.succeed(CLI, {
  approvePlan: () => Effect.succeed(true),
  displayPlan: () => Effect.void,
  startApplySession: () =>
    Effect.succeed({
      done: () => Effect.void,
      emit: (event: unknown) => {
        const e = event as {
          kind: string;
          status?: string;
          id?: string;
          type?: string;
          message?: string;
        };
        return Effect.log(
          e.kind === "status-change"
            ? `${e.status} ${e.id}(${e.type})`
            : `${e.id}: ${e.message}`
        );
      },
    }),
});

type Provided =
  | Scope.Scope
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | Credentials
  | Endpoint
  | App
  | State.State;

const platform = Layer.mergeAll(
  NodeContext.layer,
  FetchHttpClient.layer,
  Logger.pretty
);

export function test(
  name: string,
  options: { timeout?: number },
  testCase: Effect.Effect<void, unknown, Provided>
): void;

export function test(
  name: string,
  testCase: Effect.Effect<void, unknown, Provided>
): void;

export function test(
  name: string,
  ...args:
    | [{ timeout?: number }, Effect.Effect<void, unknown, Provided>]
    | [Effect.Effect<void, unknown, Provided>]
) {
  const [options = {}, testCase] =
    args.length === 1 ? [undefined, args[0]] : args;

  // Create alchemy test infrastructure
  const alchemy = Layer.provideMerge(
    Layer.mergeAll(State.localFs, testCLI),
    makeApp({
      name: name.replace(/[^a-zA-Z0-9_]/g, "-"),
      stage: "test",
      config: {
        adopt: true,
      },
    })
  );

  return it.scopedLive(
    name,
    () =>
      Effect.gen(function* () {
        const fs = yield* FileSystem.FileSystem;
        const envExists = yield* fs.exists("../../.env");
        const configProvider = envExists
          ? ConfigProvider.orElse(
              yield* PlatformConfigProvider.fromDotEnv("../../.env"),
              ConfigProvider.fromEnv
            )
          : ConfigProvider.fromEnv();

        return yield* testCase.pipe(
          Effect.provide(Credentials.fromEnv()),
          Effect.withConfigProvider(configProvider)
        );
      }).pipe(
        Effect.provide(Layer.provideMerge(alchemy, platform)),
        Effect.provideService(Endpoint, "https://us.posthog.com"),
        Logger.withMinimumLogLevel(
          process.env["DEBUG"] ? LogLevel.Debug : LogLevel.Info
        ),
        Effect.provide(NodeContext.layer)
      ),
    options.timeout ?? 60_000
  );
}

test.skip = function (
  name: string,
  ...args:
    | [{ timeout?: number }, Effect.Effect<void, unknown, Provided>]
    | [Effect.Effect<void, unknown, Provided>]
) {
  const [options = {}] = args.length === 1 ? [undefined] : args;
  return it.skip(name, () => {}, options.timeout ?? 60_000);
};
