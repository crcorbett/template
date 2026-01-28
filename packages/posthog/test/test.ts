import { FetchHttpClient, FileSystem, HttpClient } from "@effect/platform";
import { NodeContext } from "@effect/platform-node";
import * as Path from "@effect/platform/Path";
import * as PlatformConfigProvider from "@effect/platform/PlatformConfigProvider";
import {
  afterAll as _afterAll,
  beforeAll as _beforeAll,
  it,
  type TestContext,
} from "@effect/vitest";
import { Config, ConfigProvider, LogLevel } from "effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Scope from "effect/Scope";
import * as net from "node:net";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import * as Retry from "../src/retry.js";

/**
 * The PostHog project ID used for integration tests.
 * Resolved from POSTHOG_PROJECT_ID via the Effect Config system,
 * which reads from `.env` at runtime.
 */
export const TEST_PROJECT_ID: Effect.Effect<string, Error> = Config.string(
  "POSTHOG_PROJECT_ID"
).pipe(
  Effect.mapError(
    () => new Error("POSTHOG_PROJECT_ID is required. Set it in your .env file.")
  )
);

/**
 * Workaround for Node.js 20+ "Happy Eyeballs" (RFC 8305) bug.
 *
 * PROBLEM:
 * Node.js 20+ enables `autoSelectFamily` by default, which attempts to connect
 * via both IPv4 and IPv6 in parallel. However, the implementation is broken:
 * it cancels the first connection attempt after 250ms instead of racing them.
 *
 * When a machine has IPv6 DNS resolution but no actual IPv6 connectivity
 * (common with VPNs like Tailscale, macOS system tunnels, or ISPs without IPv6),
 * Node.js tries IPv4 first, cancels it after 250ms, then fails immediately on
 * IPv6 with ENETUNREACH - causing an ETIMEDOUT AggregateError.
 *
 * AFFECTED:
 * - PostHog API (us.posthog.com) - hosted on AWS with both A and AAAA records
 * - Any dual-stack host when the client lacks IPv6 connectivity
 * - macOS with Tailscale, iCloud Private Relay, or other tunnel interfaces
 *
 * REFERENCES:
 * - https://github.com/nodejs/node/issues/54359
 * - https://r1ch.net/blog/node-v20-aggregateeerror-etimedout-happy-eyeballs
 *
 * ALTERNATIVES:
 * - CLI: node --no-network-family-autoselection
 * - CLI: NODE_OPTIONS='--no-network-family-autoselection' bun run test
 */
net.setDefaultAutoSelectFamily(false);

type Provided =
  | Scope.Scope
  | HttpClient.HttpClient
  | FileSystem.FileSystem
  | Path.Path
  | Credentials
  | Endpoint;

const platform = Layer.mergeAll(
  NodeContext.layer,
  FetchHttpClient.layer,
  Logger.pretty
);

type TestCase =
  | Effect.Effect<void, unknown, Provided>
  | ((ctx: TestContext) => Effect.Effect<void, unknown, Provided>);

export function test(
  name: string,
  options: { timeout?: number },
  testCase: TestCase
): void;

export function test(name: string, testCase: TestCase): void;

export function test(
  name: string,
  ...args: [{ timeout?: number }, TestCase] | [TestCase]
) {
  const [options = {}, testCase] =
    args.length === 1 ? [undefined, args[0]] : args;

  return it.scopedLive(
    name,
    (ctx) => {
      const effect = typeof testCase === "function" ? testCase(ctx) : testCase;
      return provideTestEnv(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const configProvider = (yield* fs.exists("../../.env"))
            ? ConfigProvider.orElse(
                yield* PlatformConfigProvider.fromDotEnv("../../.env"),
                ConfigProvider.fromEnv
              )
            : ConfigProvider.fromEnv();

          return yield* effect.pipe(
            Effect.provide(Credentials.fromEnv()),
            Effect.withConfigProvider(configProvider)
          );
        })
      );
    },
    options.timeout ?? 30_000
  );
}

test.skip = function (
  name: string,
  ...args: [{ timeout?: number }, TestCase] | [TestCase]
) {
  const [options = {}] = args.length === 1 ? [undefined] : args;
  return it.skip(name, () => {}, options.timeout ?? 30_000);
};

export async function run<E>(
  effect: Effect.Effect<void, E, Provided>
): Promise<void> {
  await Effect.runPromise(
    provideTestEnv(
      Effect.scoped(
        Effect.gen(function* () {
          const fs = yield* FileSystem.FileSystem;
          const configProvider = (yield* fs.exists("../../.env"))
            ? ConfigProvider.orElse(
                yield* PlatformConfigProvider.fromDotEnv("../../.env"),
                ConfigProvider.fromEnv
              )
            : ConfigProvider.fromEnv();

          return yield* effect.pipe(
            Effect.provide(Credentials.fromEnv()),
            Effect.withConfigProvider(configProvider)
          );
        })
      )
    )
  );
}

export const beforeAll = (
  effect: Effect.Effect<void, unknown, Provided>,
  timeout?: number
) => _beforeAll(() => run(effect), timeout ?? 30_000);

export const afterAll = (
  effect: Effect.Effect<void, unknown, Provided>,
  timeout?: number
) => _afterAll(() => run(effect), timeout ?? 30_000);

/**
 * Test helper that guarantees resource cleanup via Effect.acquireUseRelease.
 *
 * Replaces the broken `let createdId` + `Effect.ensuring` pattern where the
 * ternary was eagerly evaluated at Effect construction time (before the
 * resource was created), so cleanup never ran on test failure.
 *
 * @param acquire - Effect that creates the resource (e.g. createAction)
 * @param use - Test body that receives the created resource
 * @param release - Cleanup function called with the resource (always runs)
 */
export const withResource = <A, E, R>(options: {
  readonly acquire: Effect.Effect<A, E, R>;
  readonly use: (resource: A) => Effect.Effect<void, E, R>;
  readonly release: (resource: A) => Effect.Effect<void, unknown, R>;
}): Effect.Effect<void, E, R> =>
  Effect.acquireUseRelease(options.acquire, options.use, (resource) =>
    options.release(resource).pipe(Effect.catchAll(() => Effect.void))
  );

export const expectSnapshot = (
  ctx: TestContext,
  value: unknown,
  filename?: string
): Effect.Effect<void> => {
  const sanitize = (s: string) =>
    s
      .toLowerCase()
      .replace(/\s+/g, "-")
      .replace(/[^a-z0-9-]/g, "");

  const suite = ctx.task.suite?.name ? sanitize(ctx.task.suite.name) : null;
  const testName = sanitize(ctx.task.name);

  const path =
    filename ?? (suite ? `${suite}/${testName}.json` : `${testName}.json`);

  return Effect.promise(() =>
    ctx
      .expect(JSON.stringify(value, null, 2))
      .toMatchFileSnapshot(`__snapshots__/${path}`)
  );
};

function provideTestEnv<A, E, R extends Provided>(
  effect: Effect.Effect<A, E, R>
) {
  return effect.pipe(
    Effect.provide(platform),
    Effect.provideService(Endpoint, "https://us.posthog.com"),
    Logger.withMinimumLogLevel(
      process.env.DEBUG ? LogLevel.Debug : LogLevel.Info
    ),
    Effect.provide(NodeContext.layer),
    Retry.transient
  );
}
