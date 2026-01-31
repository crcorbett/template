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
import { ConfigProvider, LogLevel, pipe } from "effect";
import * as Duration from "effect/Duration";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Schedule from "effect/Schedule";
import * as Scope from "effect/Scope";
import * as net from "node:net";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";
import * as Retry from "../src/retry.js";

/**
 * Workaround for Node.js 20+ "Happy Eyeballs" (RFC 8305) bug.
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

const resolveConfigProvider = Effect.gen(function* () {
  const fs = yield* FileSystem.FileSystem;
  return (yield* fs.exists("../../.env"))
    ? ConfigProvider.orElse(
        yield* PlatformConfigProvider.fromDotEnv("../../.env"),
        ConfigProvider.fromEnv
      )
    : ConfigProvider.fromEnv();
});

const withConfigAndCredentials = <A, E, R>(
  effect: Effect.Effect<A, E, R>
) =>
  Effect.gen(function* () {
    const configProvider = yield* resolveConfigProvider;
    return yield* effect.pipe(
      Effect.provide(Credentials.fromEnv()),
      Effect.withConfigProvider(configProvider)
    );
  });

type TestCase =
  | Effect.Effect<void, unknown, Provided>
  | ((ctx: TestContext) => Effect.Effect<void, unknown, Provided>);

/**
 * Test-specific retry policy with shorter backoff than production.
 */
const testRetryOptions: Retry.Options = {
  while: Retry.isTransientError,
  schedule: pipe(
    Schedule.exponential(Duration.millis(200), 2),
    Schedule.modifyDelay((d) =>
      Duration.toMillis(d) > 2000 ? Duration.millis(2000) : d
    ),
    Schedule.intersect(Schedule.recurs(3)),
    Schedule.jittered
  ),
};

function provideTestEnv<A, E, R extends Provided>(
  effect: Effect.Effect<A, E, R>
) {
  return effect.pipe(
    Effect.provide(platform),
    Effect.provideService(Endpoint, "https://api.attio.com"),
    Logger.withMinimumLogLevel(
      process.env.DEBUG ? LogLevel.Debug : LogLevel.Info
    ),
    Effect.provide(NodeContext.layer),
    Retry.policy(testRetryOptions)
  );
}

// --- Exported test utilities ---

export function test(name: string, options: { timeout?: number }, testCase: TestCase): void;
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
      return provideTestEnv(withConfigAndCredentials(effect));
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
    provideTestEnv(Effect.scoped(withConfigAndCredentials(effect)))
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
    s.toLowerCase().replace(/\s+/g, "-").replace(/[^a-z0-9-]/g, "");
  const suite = ctx.task.suite?.name ? sanitize(ctx.task.suite.name) : null;
  const testName = sanitize(ctx.task.name);
  const path = filename ?? (suite ? `${suite}/${testName}.json` : `${testName}.json`);
  return Effect.promise(() =>
    ctx.expect(JSON.stringify(value, null, 2)).toMatchFileSnapshot(`__snapshots__/${path}`)
  );
};
