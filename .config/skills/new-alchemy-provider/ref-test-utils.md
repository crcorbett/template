# Reference: Test Utilities

Source: `packages/alchemy-posthog/test/posthog/test.ts`

Test utility module that provides the full service environment for tests.

```typescript
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
 * See full explanation in source file for when to remove.
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
      Layer.effect(
        App,
        Effect.gen(function* () {
          return App.of({
            name: appName,
            stage: "test",
            config: {
              adopt: true,
            },
          });
        }),
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
    options.timeout ?? 60_000
  );
}
```
