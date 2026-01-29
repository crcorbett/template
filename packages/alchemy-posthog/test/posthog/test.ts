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
import * as Data from "effect/Data";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as net from "node:net";
import * as NodePath from "node:path";

import { Project } from "@/posthog/project.js";

/**
 * Workaround: Disable Node.js "Happy Eyeballs" (RFC 8305) auto-select family.
 *
 * **Affected versions:** Node.js >= 20.0.0 (where `autoSelectFamily` defaults to `true`).
 *
 * **Symptoms without workaround:**
 * - Intermittent `ECONNREFUSED` or `ETIMEDOUT` errors on outbound HTTP requests
 *   (e.g., to `https://us.posthog.com`) when the DNS resolver returns both IPv4
 *   and IPv6 addresses but one address family is unreachable on the host network.
 * - Connections stall for the Happy Eyeballs timeout (~250ms per attempt) before
 *   falling back, causing flaky CI and slow integration tests.
 *
 * **Root cause:**
 * Node.js 20 enabled RFC 8305 "Happy Eyeballs" by default (`autoSelectFamily: true`),
 * which races IPv4 and IPv6 connections. On networks/containers where IPv6 is
 * partially configured (routable addresses but no connectivity), the racing logic
 * can pick the broken family and fail or timeout before trying the working one.
 *
 * **When to remove:**
 * This workaround can be removed once all of these conditions are met:
 * 1. The upstream Node.js Happy Eyeballs implementation reliably handles
 *    partial IPv6 environments (track https://github.com/nodejs/node/issues/47822).
 * 2. CI and local development environments consistently support dual-stack networking.
 * 3. The minimum Node.js version for this project includes the fix.
 *
 * @see https://github.com/nodejs/node/issues/47822 - Node.js autoSelectFamily issues
 * @see https://nodejs.org/api/net.html#netsetdefaultautoselectfamilyvalue - API docs
 */
net.setDefaultAutoSelectFamily(false);

/**
 * Error thrown when a resource still exists when it should have been deleted.
 */
class ResourceNotDeletedError extends Data.TaggedError(
  "ResourceNotDeletedError"
)<{
  readonly resourceType: string;
  readonly id: string | number;
}> {}

/**
 * Creates an assertDeleted helper for a PostHog resource.
 *
 * All PostHog resources share a common deletion verification pattern:
 * - Call the get API for the resource
 * - Check a deletion indicator field (e.g. `deleted` or `archived`)
 * - Treat NotFoundError or PostHogError 404 as successfully deleted
 * - Retry with exponential backoff (5 retries, 100ms base)
 *
 * @param resourceType - Human-readable resource type name for error messages
 * @param getResource - API function to fetch the resource by project_id and id
 * @param isDeletionIndicator - Function to check if the response indicates deletion
 *   (e.g. `(r) => r.deleted === true` or `(r) => r.archived === true`)
 */
export function makeAssertDeleted<Id extends string | number, R>(
  resourceType: string,
  getResource: (params: {
    project_id: string;
    id: Id;
  }) => Effect.Effect<R, any, any>,
  isDeletionIndicator: (resource: R) => boolean,
) {
  return Effect.fn(function* (id: Id) {
    const projectId = yield* Project;
    yield* getResource({
      project_id: projectId,
      id,
    }).pipe(
      Effect.flatMap((resource) => {
        if (isDeletionIndicator(resource)) {
          return Effect.void;
        }
        return Effect.fail(new ResourceNotDeletedError({ resourceType, id }));
      }),
      Effect.catchTag("NotFoundError", () => Effect.void),
      Effect.catchTag("PostHogError", (err: { code: string }) => {
        if (err.code === "404") {
          return Effect.void;
        }
        return Effect.fail(err);
      }),
      Effect.retry(
        Schedule.intersect(Schedule.recurs(5), Schedule.exponential("100 millis"))
      )
    );
  });
}

export const testCLI = Layer.succeed(
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
  | Project
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
  Layer.effect(
    Project,
    Config.string("POSTHOG_PROJECT_ID").pipe(
      Effect.catchAll(() =>
        Effect.dieMessage(
          "POSTHOG_PROJECT_ID is required. Set it in your .env file."
        )
      )
    )
  ),
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
    // PostHog integration tests make real HTTP API calls that can be slow
    // (especially create/update/delete cycles with retry logic).
    // 60s is necessary; vitest's default 5s is insufficient for external API round-trips.
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
    return it.skip(name, () => {}, options.timeout ?? 60_000); // see timeout rationale in test()
  }

  export function skipIf(condition: boolean) {
    return function (
      name: string,
      ...args:
        | [{ timeout?: number }, Effect.Effect<void, unknown, Provided>]
        | [Effect.Effect<void, unknown, Provided>]
    ) {
      if (condition) {
        const [options = {}] = args.length === 1 ? [undefined] : args;
        it.skip(name, () => {}, options.timeout ?? 60_000); // see timeout rationale in test()
      } else {
        test(name, ...(args as [Effect.Effect<void, unknown, Provided>]));
      }
    };
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
