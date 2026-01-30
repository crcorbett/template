# Reference: Test Utilities

## Test Helper (`test/attio/test.ts`)

```typescript
import { setDefaultAutoSelectFamily } from "node:net";
setDefaultAutoSelectFamily(false);

import * as NodeContext from "@effect/platform-node/NodeContext";
import * as FetchHttpClient from "@effect/platform/FetchHttpClient";
import { it } from "@effect/vitest";
import { App, CLI, DotAlchemy, State } from "alchemy-effect";
import * as Effect from "effect/Effect";
import * as Layer from "effect/Layer";
import * as Logger from "effect/Logger";
import * as Schedule from "effect/Schedule";

import { Credentials } from "@packages/attio/Credentials";
import { Endpoint } from "@packages/attio";

import * as Config from "effect/Config";
import * as Redacted from "effect/Redacted";

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
      Effect.catchTag("NotFoundError", () => Effect.void),
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

const testCLI = (): Layer.Layer<CLI> =>
  Layer.succeed(CLI, {
    prompt: () => Effect.succeed(true),
    note: () => Effect.void,
    notes: () => Effect.void,
    confirm: () => Effect.succeed(true),
    enabled: true,
  });

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
  return it.scopedLive(
    name,
    () =>
      testCase.pipe(
        Effect.provide(
          Layer.mergeAll(
            Layer.effect(
              App,
              Effect.gen(function* () {
                return App.of({
                  name: `test/attio/${name}`,
                  stage: "test",
                  config: {},
                  phase: "apply",
                });
              }),
            ),
            State.memory(),
            DotAlchemy.empty,
            testCLI(),
            NodeContext.layer,
            FetchHttpClient.layer,
            Layer.effect(
              Credentials,
              Effect.gen(function* () {
                const apiKey = yield* Config.redacted("ATTIO_API_KEY");
                return { apiKey };
              }),
            ),
            Layer.succeed(Endpoint, "https://api.attio.com"),
            Logger.minimumLogLevel("Info"),
          ),
        ),
      ),
    options.timeout ?? 60_000,
  );
}

export namespace test {
  export const state = (
    resources: Record<string, State.ResourceState> = {},
  ) =>
    Layer.effect(
      State.State,
      Effect.gen(function* () {
        const state = yield* State.memory();
        // Pre-populate state if needed
        return state;
      }),
    );

  export const defaultState = (
    resources: Record<string, State.ResourceState> = {},
  ) => Layer.succeed(State.State, State.memory());

  export function skip(
    name: string,
    options: { timeout?: number },
    testCase: Effect.Effect<void, unknown, any>,
  ): void {
    it.skip(name, () => {});
  }

  export function skipIf(condition: boolean) {
    return condition ? test.skip : test;
  }
}
```

## Key Differences from PostHog Test Utils

1. **No Project layer** — PostHog tests provide `Project` (project ID) in every test. Attio
   tests don't need this since the API key is workspace-scoped.

2. **`makeAssertArchived` helper** — New helper for soft-archived resources (SelectOption, Status)
   that verifies `is_archived: true` rather than `NotFoundError`.

3. **`makeAssertDeleted` simplified** — Only needs the resource ID (string), not a project_id +
   resource_id tuple like PostHog.

## Usage Pattern

```typescript
// test/attio/webhook/webhook.provider.test.ts
import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioWebhooks from "@packages/attio/webhooks";
import { Webhook } from "@/attio/webhook/index";
import { test, makeAssertDeleted } from "../test";
import * as Attio from "@/attio/index";

const assertWebhookDeleted = makeAssertDeleted(
  "Webhook",
  (webhookId: string) =>
    AttioWebhooks.getWebhook({ webhook_id: webhookId }),
);

test("create, update, delete webhook", { timeout: 120_000 },
  Effect.gen(function* () {
    yield* destroy();

    class TestWebhook extends Webhook("TestWebhook", {
      targetUrl: "https://example.com/webhooks/attio-test",
      subscriptions: [{ event_type: "record.created" }],
    }) {}

    const stack = yield* apply(TestWebhook);
    expect(stack.TestWebhook.webhookId).toBeDefined();

    // Verify via direct API call
    const fetched = yield* AttioWebhooks.getWebhook({
      webhook_id: stack.TestWebhook.webhookId,
    });
    expect(fetched.data.target_url).toBe("https://example.com/webhooks/attio-test");

    // Update
    class UpdatedWebhook extends Webhook("TestWebhook", {
      targetUrl: "https://example.com/webhooks/attio-test",
      subscriptions: [
        { event_type: "record.created" },
        { event_type: "record.deleted" },
      ],
    }) {}
    const updated = yield* apply(UpdatedWebhook);
    expect(updated.TestWebhook.webhookId).toBe(stack.TestWebhook.webhookId);

    // Destroy
    yield* destroy();
    yield* assertWebhookDeleted(stack.TestWebhook.webhookId);
  }).pipe(Effect.provide(Attio.providers())),
);
```
