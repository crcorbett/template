import { setDefaultAutoSelectFamily } from "node:net";
setDefaultAutoSelectFamily(false);

import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import * as NodeContext from "@effect/platform-node/NodeContext";
import { it } from "@effect/vitest";
import { App, dotAlchemy, State } from "alchemy-effect";
import { CLI } from "alchemy-effect/cli";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as LogLevel from "effect/LogLevel";
import * as Schedule from "effect/Schedule";

import { Credentials } from "@packages/attio/Credentials";
import { Endpoint } from "@packages/attio";
import * as AttioAttributes from "@packages/attio/attributes";
import * as AttioWebhooks from "@packages/attio/webhooks";

import * as Config from "effect/Config";

/**
 * Generic assertDeleted factory.
 * Retries the get operation to confirm the resource is gone (NotFoundError).
 */
export function makeAssertDeleted<
  Id extends string,
  R,
  E extends { readonly _tag: string },
>(
  resourceType: string,
  getResource: (id: Id) => Effect.Effect<R, E, any>,
) {
  return Effect.fn(function* (id: Id) {
    yield* getResource(id).pipe(
      Effect.flatMap(() =>
        Effect.fail(
          new Error(`${resourceType} ${id} still exists after deletion`),
        ),
      ),
      Effect.catchTag("NotFoundError" as any, () => Effect.void),
      Effect.retry(
        Schedule.intersect(
          Schedule.recurs(5),
          Schedule.exponential("100 millis"),
        ),
      ),
    );
  });
}

/**
 * Generic assertArchived factory for soft-deleted resources.
 * Verifies the resource exists but has is_archived: true.
 */
export function makeAssertArchived<
  R extends { is_archived?: boolean },
  E extends { readonly _tag: string },
>(
  resourceType: string,
  getResource: () => Effect.Effect<R, E, any>,
) {
  return Effect.fn(function* () {
    const result = yield* getResource().pipe(
      Effect.retry(
        Schedule.intersect(
          Schedule.recurs(5),
          Schedule.exponential("100 millis"),
        ),
      ),
    );

    if (!result.is_archived) {
      yield* Effect.fail(
        new Error(`${resourceType} is not archived after deletion`),
      );
    }
  });
}

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

/**
 * Test wrapper providing full alchemy environment for Attio provider tests.
 *
 * Provides:
 * - App context with test-specific name
 * - State management
 * - CLI mock (auto-approve)
 * - Platform layers (NodeContext, FetchHttpClient)
 * - Attio Credentials and Endpoint from env vars
 * - Logger (minimal level)
 */
export function test(
  name: string,
  options: { timeout?: number },
  testCase: Effect.Effect<void, unknown, any>,
): void {
  const alchemy = Layer.provideMerge(
    Layer.mergeAll(State.localFs, testCLI),
    Layer.mergeAll(
      Layer.effect(
        App,
        Effect.gen(function* () {
          return App.of({
            name: `test/attio/${name}`,
            stage: "test",
            config: {},
          });
        }),
      ),
      dotAlchemy,
    ),
  );

  const platform = Layer.mergeAll(
    NodeContext.layer,
    FetchHttpClient.layer,
    Logger.pretty,
  );

  const attio = Layer.mergeAll(
    Layer.effect(
      Credentials,
      Effect.gen(function* () {
        const apiKey = yield* Config.redacted("ATTIO_API_KEY");
        return { apiKey };
      }),
    ),
    Layer.succeed(Endpoint, "https://api.attio.com"),
  );

  return it.scopedLive(
    name,
    () =>
      testCase.pipe(
        Effect.provide(
          Layer.provideMerge(attio, Layer.provideMerge(alchemy, platform)),
        ),
        Logger.withMinimumLogLevel(LogLevel.Info),
        Effect.provide(NodeContext.layer),
      ),
    options.timeout ?? 60_000,
  );
}

export namespace test {
  export function skip(
    _name: string,
    _options: { timeout?: number },
    _testCase: Effect.Effect<void, unknown, any>,
  ): void {
    it.skip(_name, () => {});
  }

  export function skipIf(condition: boolean) {
    return condition ? test.skip : test;
  }
}

/**
 * Reset an attribute's title to a known value.
 * Use in beforeAll to undo leftover mutations from previous test runs
 * (attributes can't be deleted via the Attio API).
 */
export const resetAttribute = (opts: {
  target: string;
  identifier: string;
  attribute: string;
  title: string;
}) =>
  AttioAttributes.updateAttribute({
    target: opts.target,
    identifier: opts.identifier,
    attribute: opts.attribute,
    title: opts.title,
  }).pipe(
    Effect.catchAll(() => Effect.void),
    Effect.provide(
      Layer.mergeAll(
        FetchHttpClient.layer,
        Layer.effect(
          Credentials,
          Effect.gen(function* () {
            const apiKey = yield* Config.redacted("ATTIO_API_KEY");
            return { apiKey };
          }),
        ),
        Layer.succeed(Endpoint, "https://api.attio.com"),
      ),
    ),
  );

/**
 * Delete any webhooks whose target_url matches the given pattern.
 * Use in beforeAll to clean up stale webhooks from previous failed test runs
 * so Attio doesn't send "failing webhook" alert emails.
 *
 * Provides its own Attio credentials from env vars — no alchemy context needed.
 */
export const cleanupStaleWebhooks = (urlPattern: RegExp) =>
  Effect.gen(function* () {
    const list = yield* AttioWebhooks.listWebhooks({}).pipe(
      Effect.catchAll(() => Effect.succeed(undefined)),
    );
    if (!list?.data) return;

    for (const webhook of list.data) {
      if (urlPattern.test(webhook.target_url)) {
        yield* AttioWebhooks.deleteWebhook({
          webhook_id: webhook.id.webhook_id,
        }).pipe(Effect.catchAll(() => Effect.void));
      }
    }
  }).pipe(
    Effect.provide(
      Layer.mergeAll(
        FetchHttpClient.layer,
        Layer.effect(
          Credentials,
          Effect.gen(function* () {
            const apiKey = yield* Config.redacted("ATTIO_API_KEY");
            return { apiKey };
          }),
        ),
        Layer.succeed(Endpoint, "https://api.attio.com"),
      ),
    ),
  );
