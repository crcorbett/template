import { FetchHttpClient, HttpClient } from "@effect/platform";
import {
  afterAll as _afterAll,
  beforeAll as _beforeAll,
  it,
  type TestContext,
} from "@effect/vitest";
import { LogLevel } from "effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Scope from "effect/Scope";

import { Credentials } from "../src/credentials.js";
import { Endpoint } from "../src/endpoint.js";

type Provided = Scope.Scope | HttpClient.HttpClient | Credentials | Endpoint;

const platform = Layer.mergeAll(FetchHttpClient.layer, Logger.pretty);

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
      return provideTestEnv(effect);
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
  await Effect.runPromise(provideTestEnv(Effect.scoped(effect)));
}

export const beforeAll = (
  effect: Effect.Effect<void, unknown, Provided>,
  timeout?: number
) => _beforeAll(() => run(effect), timeout ?? 30_000);

export const afterAll = (
  effect: Effect.Effect<void, unknown, Provided>,
  timeout?: number
) => _afterAll(() => run(effect), timeout ?? 30_000);

function provideTestEnv<A, E, R extends Provided>(
  effect: Effect.Effect<A, E, R>
) {
  return effect.pipe(
    Effect.provide(platform),
    Effect.provide(Credentials.fromEnv()),
    Effect.provideService(
      Endpoint,
      process.env.POSTHOG_ENDPOINT ?? "https://us.posthog.com"
    ),
    Logger.withMinimumLogLevel(
      process.env.DEBUG ? LogLevel.Debug : LogLevel.Info
    )
  );
}
