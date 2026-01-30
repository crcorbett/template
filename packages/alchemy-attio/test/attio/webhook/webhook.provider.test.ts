import { beforeAll } from "vitest";
import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";
import * as AttioWebhooks from "@packages/attio/webhooks";
import { Webhook } from "@/attio/webhook/index";
import { test, makeAssertDeleted, cleanupStaleWebhooks } from "../test";
import * as Attio from "@/attio/index";

beforeAll(async () => {
  await Effect.runPromise(
    cleanupStaleWebhooks(/example\.com\/webhooks\/attio-test/),
  );
});

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
      subscriptions: [{ event_type: "record.created", filter: { "$and": [] } }],
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
        { event_type: "record.created", filter: { "$and": [] } },
        { event_type: "record.deleted", filter: { "$and": [] } },
      ],
    }) {}
    const updated = yield* apply(UpdatedWebhook);
    expect(updated.TestWebhook.webhookId).toBe(stack.TestWebhook.webhookId);

    // Destroy
    yield* destroy();
    yield* assertWebhookDeleted(stack.TestWebhook.webhookId);
  }).pipe(Effect.provide(Attio.providers())),
);
