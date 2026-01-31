# Reference: Smoke Test (Multi-Resource Integration)

## Smoke Test (`test/attio/attio.smoke.test.ts`)

```typescript
import { expect } from "vitest";
import * as Effect from "effect/Effect";
import { apply, destroy } from "alchemy-effect";

import * as AttioObjects from "@packages/attio/objects";
import * as AttioAttributes from "@packages/attio/attributes";
import * as AttioRecords from "@packages/attio/records";
import * as AttioWebhooks from "@packages/attio/webhooks";

import { Object as AttioObject } from "@/attio/object/index";
import { Attribute } from "@/attio/attribute/index";
import { SelectOption } from "@/attio/select-option/index";
import { Record } from "@/attio/record/index";
import { Webhook } from "@/attio/webhook/index";

import { test, makeAssertDeleted } from "./test";
import * as Attio from "@/attio/index";

const assertWebhookDeleted = makeAssertDeleted(
  "Webhook",
  (webhookId: string) =>
    AttioWebhooks.getWebhook({ webhook_id: webhookId }),
);

const assertRecordDeleted = makeAssertDeleted(
  "Record",
  (recordId: string) =>
    AttioRecords.getRecord({
      object: "smoke-test-obj",
      record_id: recordId,
    }),
);

test("smoke: multi-resource apply and destroy", { timeout: 180_000 },
  Effect.gen(function* () {
    // Clean up any leftover state
    yield* destroy();

    // ── Tier 1: Schema resources ──

    // Note: Objects can't be deleted, so use a unique slug for test isolation.
    // In real tests, you may need to handle pre-existing objects.
    class TestObject extends AttioObject("TestObject", {
      apiSlug: "smoke-test-obj",
      singularNoun: "Smoke Test",
      pluralNoun: "Smoke Tests",
    }) {}

    class TestAttr extends Attribute("TestAttr", {
      target: "objects",
      identifier: TestObject.apiSlug,   // Cross-resource binding
      title: "Smoke Test Field",
      type: "text",
    }) {}

    // ── Tier 2: Data resources ──

    class TestRecord extends Record("TestRecord", {
      object: TestObject.apiSlug,        // Cross-resource binding
      matchingAttribute: "name",
      data: {
        name: [{ value: "Smoke Test Record" }],
      },
    }) {}

    // ── Tier 3: Supporting resources ──

    class TestWebhook extends Webhook("TestWebhook", {
      targetUrl: "https://example.com/webhooks/attio-smoke-test",
      subscriptions: [{ event_type: "record.created" }],
    }) {}

    // ── Apply all resources ──

    const stack = yield* apply(
      TestObject,
      TestAttr,
      TestRecord,
      TestWebhook,
    );

    // ── Verify all resources ──

    // Object
    expect(stack.TestObject.objectId).toBeDefined();
    expect(stack.TestObject.apiSlug).toBe("smoke-test-obj");

    const obj = yield* AttioObjects.getObject({ object: "smoke-test-obj" });
    expect(obj.data.singular_noun).toBe("Smoke Test");

    // Attribute
    expect(stack.TestAttr.apiSlug).toBeDefined();

    const attr = yield* AttioAttributes.getAttribute({
      target: "objects",
      identifier: "smoke-test-obj",
      attribute: stack.TestAttr.apiSlug!,
    });
    expect(attr.data.title).toBe("Smoke Test Field");

    // Record
    expect(stack.TestRecord.recordId).toBeDefined();
    expect(stack.TestRecord.objectId).toBeDefined();

    const rec = yield* AttioRecords.getRecord({
      object: "smoke-test-obj",
      record_id: stack.TestRecord.recordId,
    });
    expect(rec.data.created_at).toBeDefined();

    // Webhook
    expect(stack.TestWebhook.webhookId).toBeDefined();

    const hook = yield* AttioWebhooks.getWebhook({
      webhook_id: stack.TestWebhook.webhookId,
    });
    expect(hook.data.target_url).toBe(
      "https://example.com/webhooks/attio-smoke-test",
    );

    // ── Destroy all ──

    yield* destroy();

    // ── Verify cleanup ──

    // Record should be deleted
    yield* assertRecordDeleted(stack.TestRecord.recordId);

    // Webhook should be deleted
    yield* assertWebhookDeleted(stack.TestWebhook.webhookId);

    // Object and Attribute persist (no delete API) — verify they still exist
    const objAfter = yield* AttioObjects.getObject({
      object: "smoke-test-obj",
    });
    expect(objAfter.data.api_slug).toBe("smoke-test-obj");
  }).pipe(Effect.provide(Attio.providers())),
);
```

## Key Considerations

1. **Objects persist after destroy** — Since Attio's API doesn't support object deletion,
   the smoke test verifies that objects remain accessible. Repeated test runs are idempotent.

2. **Cross-resource bindings** — The test demonstrates `Input<T>` bindings:
   - TestAttr references TestObject.apiSlug
   - TestRecord references TestObject.apiSlug

3. **Timeout** — 180 seconds to account for multiple API round-trips with retry.

4. **Cleanup isolation** — Use unique slugs/names per test suite to avoid conflicts
   with other test files.
