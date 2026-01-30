import { beforeAll, expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";

import * as AttioObjects from "@packages/attio/objects";
import * as AttioAttributes from "@packages/attio/attributes";
import * as AttioRecords from "@packages/attio/records";
import * as AttioWebhooks from "@packages/attio/webhooks";

import { Object as AttioObject } from "@/attio/object/index";
import { Attribute } from "@/attio/attribute/index";
import { Record } from "@/attio/record/index";
import { Webhook } from "@/attio/webhook/index";

import { test, makeAssertDeleted, cleanupStaleWebhooks } from "./test";
import * as Attio from "@/attio/index";

beforeAll(async () => {
  await Effect.runPromise(
    cleanupStaleWebhooks(/example\.com\/webhooks\/attio-smoke/),
  );
});

const assertWebhookDeleted = makeAssertDeleted(
  "Webhook",
  (webhookId: string) =>
    AttioWebhooks.getWebhook({ webhook_id: webhookId }),
);

const assertRecordDeleted = makeAssertDeleted(
  "Record",
  (recordId: string) =>
    AttioRecords.getRecord({
      object: "smoke_test_obj",
      record_id: recordId,
    }),
);

test("smoke: multi-resource apply and destroy", { timeout: 180_000 },
  Effect.gen(function* () {
    // Clean up any leftover state
    yield* destroy();

    // -- Tier 1: Schema resources --

    // Note: Objects can't be deleted, so use a unique slug for test isolation.
    class TestObject extends AttioObject("TestObject", {
      apiSlug: "smoke_test_obj",
      singularNoun: "Smoke Test",
      pluralNoun: "Smoke Tests",
    }) {}

    class TestAttr extends Attribute("TestAttr", {
      target: "objects",
      identifier: "smoke_test_obj",
      title: "Smoke Test Field",
      apiSlug: "smoke_test_field",
      type: "text",
      isUnique: true,
    }) {}

    // -- Tier 2: Data resources --

    class TestRecord extends Record("TestRecord", {
      object: "smoke_test_obj",
      matchingAttribute: "smoke_test_field",
      data: {
        smoke_test_field: [{ value: "Smoke Test Record" }],
      },
    }) {}

    // -- Tier 3: Supporting resources --

    class TestWebhook extends Webhook("TestWebhook", {
      targetUrl: "https://example.com/webhooks/attio-smoke-test",
      subscriptions: [{ event_type: "record.created", filter: { "$and": [] } }],
    }) {}

    // -- Apply in tiers (Attr/Record depend on Object existing) --

    // Tier 1: Object must exist first
    const tier1 = yield* apply(TestObject);

    expect(tier1.TestObject.objectId).toBeDefined();
    expect(tier1.TestObject.apiSlug).toBe("smoke_test_obj");

    const obj = yield* AttioObjects.getObject({ object: "smoke_test_obj" });
    expect(obj.data.singular_noun).toBe("Smoke Test");

    // Tier 2: Attribute + Webhook (depend on Object)
    const tier2 = yield* apply(TestObject, TestAttr, TestWebhook);

    expect(tier2.TestAttr.apiSlug).toBeDefined();

    const attr = yield* AttioAttributes.getAttribute({
      target: "objects",
      identifier: "smoke_test_obj",
      attribute: tier2.TestAttr.apiSlug!,
    });
    expect(attr.data.title).toBe("Smoke Test Field");

    expect(tier2.TestWebhook.webhookId).toBeDefined();

    const hook = yield* AttioWebhooks.getWebhook({
      webhook_id: tier2.TestWebhook.webhookId,
    });
    expect(hook.data.target_url).toBe(
      "https://example.com/webhooks/attio-smoke-test",
    );

    // Tier 3: Record (depends on Object + its attributes being ready)
    const stack = yield* apply(
      TestObject, TestAttr, TestWebhook, TestRecord,
    );

    expect(stack.TestRecord.recordId).toBeDefined();
    expect(stack.TestRecord.objectId).toBeDefined();

    const rec = yield* AttioRecords.getRecord({
      object: "smoke_test_obj",
      record_id: stack.TestRecord.recordId,
    });
    expect(rec.data.created_at).toBeDefined();

    // -- Destroy all --

    yield* destroy();

    // -- Verify cleanup --

    // Record should be deleted
    yield* assertRecordDeleted(stack.TestRecord.recordId);

    // Webhook should be deleted
    yield* assertWebhookDeleted(stack.TestWebhook.webhookId);

    // Object and Attribute persist (no delete API) — verify they still exist
    const objAfter = yield* AttioObjects.getObject({
      object: "smoke_test_obj",
    });
    expect(objAfter.data.api_slug).toBe("smoke_test_obj");
  }).pipe(Effect.provide(Attio.providers())),
);
