import { FetchHttpClient, FileSystem, HttpClient } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as Path from "@effect/platform/Path";
import * as PlatformConfigProvider from "@effect/platform/PlatformConfigProvider";
import { expect, it } from "@effect/vitest";
import { Endpoint } from "@packages/posthog";
import { Credentials } from "@packages/posthog/Credentials";
import {
  App,
  DotAlchemy,
  dotAlchemy,
  State,
} from "alchemy-effect";
import { CLI } from "alchemy-effect/cli";
import { Config, ConfigProvider, LogLevel } from "effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Scope from "effect/Scope";
import * as net from "node:net";
import * as NodePath from "node:path";

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

const testCLI = Layer.succeed(
  CLI,
  CLI.of({
    approvePlan: () => Effect.succeed(true),
    displayPlan: () => Effect.void,
    startApplySession: () =>
      Effect.succeed({
        done: () => Effect.void,
        emit: (event: import("alchemy-effect").ApplyEvent) =>
          Effect.log(
            event.kind === "status-change"
              ? `${event.status} ${event.id}(${event.type})`
              : `${event.id}: ${event.message}`
          ),
      }),
  })
);

type Provided =
  | Scope.Scope
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | Credentials
  | Endpoint
  | DotAlchemy
  | App
  | State.State;

const platform = Layer.mergeAll(
  NodeContext.layer,
  FetchHttpClient.layer,
  Logger.pretty
);

const posthog = Layer.mergeAll(
  Credentials.fromEnv(),
  Layer.succeed(Endpoint, "https://us.posthog.com"),
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

  // Include test file path to prevent state collisions between tests with the same name
  const testPath = expect.getState().testPath ?? "";
  const testDir = testPath.includes("/test/")
    ? (testPath.split("/test/").pop() ?? "")
    : NodePath.basename(testPath);
  const testPathWithoutExt = testDir.replace(/\.[^.]+$/, "");
  const appName = `${testPathWithoutExt}-${name}`
    .replaceAll(/[^a-zA-Z0-9_]/g, "-")
    .replace(/-+/g, "-");

  // Create alchemy test infrastructure
  const alchemy = Layer.provideMerge(
    Layer.mergeAll(State.localFs, testCLI),
    Layer.mergeAll(
      Layer.succeed(
        App,
        App.of({
          name: appName,
          stage: "test",
          config: {
            adopt: true,
          },
        })
      ),
      dotAlchemy
    )
  );

  return it.scopedLive(
    name,
    () =>
      Effect.gen(function* () {
        const configProvider = ConfigProvider.orElse(
          yield* PlatformConfigProvider.fromDotEnv(".env"),
          ConfigProvider.fromEnv,
        );

        return yield* testCase.pipe(
          Effect.withConfigProvider(configProvider)
        );
      }).pipe(
        Effect.provide(
          Layer.provideMerge(posthog, Layer.provideMerge(alchemy, platform)),
        ),
        Logger.withMinimumLogLevel(
          process.env["DEBUG"] ? LogLevel.Debug : LogLevel.Info
        ),
        Effect.provide(NodeContext.layer)
      ),
    options.timeout ?? 60_000
  );
}

export namespace test {
  export function skip(
    name: string,
    options: { timeout?: number },
    testCase: Effect.Effect<void, unknown, Provided>,
  ): void;

  export function skip(
    name: string,
    testCase: Effect.Effect<void, unknown, Provided>,
  ): void;

  export function skip(
    name: string,
    ...args:
      | [{ timeout?: number }, Effect.Effect<void, unknown, Provided>]
      | [Effect.Effect<void, unknown, Provided>]
  ) {
    const [options = {}] = args.length === 1 ? [undefined] : args;
    return it.skip(name, () => {}, options.timeout ?? 60_000);
  }

  export const state = (
    resources: Record<string, State.ResourceState> = {},
  ) =>
    Layer.effect(
      State.State,
      Effect.gen(function* () {
        const app = yield* App;
        return State.inMemoryService({
          [app.name]: {
            [app.stage]: resources,
          },
        });
      }),
    );

  export const defaultState = (
    resources: Record<string, State.ResourceState> = {},
    other?: {
      [stack: string]: {
        [stage: string]: {
          [resourceId: string]: State.ResourceState;
        };
      };
    },
  ) =>
    Layer.succeed(
      State.State,
      State.inMemoryService({
        ["test-app"]: {
          ["test-stage"]: resources,
        },
        ...other,
      }),
    );
}
