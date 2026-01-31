import { describe, expect } from "@effect/vitest";
import * as Effect from "effect/Effect";
import { test, withResource } from "./test.js";
import { createWebhook, getWebhook, updateWebhook, deleteWebhook, listWebhooks } from "../src/services/webhooks.js";

describe("Webhooks", () => {
  test("should perform full CRUD", { timeout: 60_000 }, () =>
    Effect.gen(function* () {
      yield* withResource({
        acquire: createWebhook({
          target_url: `https://example.com/webhook-test-${Date.now()}`,
          subscriptions: [{ event_type: "record.created", filter: null }],
        }),
        use: (created) =>
          Effect.gen(function* () {
            expect(created.data.id.webhook_id).toBeDefined();
            expect(created.data.target_url).toContain("example.com");

            // Read back
            const fetched = yield* getWebhook({ webhook_id: created.data.id.webhook_id });
            expect(fetched.data.id.webhook_id).toBe(created.data.id.webhook_id);

            // Update
            const updated = yield* updateWebhook({
              webhook_id: created.data.id.webhook_id,
              target_url: `https://example.com/webhook-updated-${Date.now()}`,
            });
            expect(updated.data.target_url).toContain("webhook-updated");
          }),
        release: (created) =>
          deleteWebhook({ webhook_id: created.data.id.webhook_id }).pipe(
            Effect.catchAll(() => Effect.void)
          ),
      });
    }));

  test("should handle not found", () =>
    Effect.gen(function* () {
      const result = yield* getWebhook({
        webhook_id: "00000000-0000-0000-0000-000000000000",
      }).pipe(Effect.either);
      expect(result._tag).toBe("Left");
    }));
});
