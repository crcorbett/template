import * as AttioWebhooks from "@packages/attio/webhooks";
import * as Effect from "effect/Effect";

import type { WebhookAttrs } from "./webhook";

import { retryPolicy } from "../retry";
import { Webhook as WebhookResource } from "./webhook";

function mapResponseToAttrs(
  result: typeof AttioWebhooks.AttioWebhook.Type,
): WebhookAttrs {
  return {
    webhookId: result.id.webhook_id,
    targetUrl: result.target_url,
    subscriptions: result.subscriptions as unknown[] | undefined,
    status: result.status ?? null,
    createdAt: result.created_at,
  };
}

export const webhookProvider = () =>
  WebhookResource.provider.effect(
    Effect.gen(function* () {
      return {
        stables: ["webhookId"] as const,

        diff: Effect.fnUntraced(function* ({ news, olds }) {
          // All prop changes -> update (no replacement triggers)
          if (
            news.targetUrl !== olds.targetUrl ||
            JSON.stringify(news.subscriptions) !==
              JSON.stringify(olds.subscriptions)
          ) {
            return { action: "update" };
          }
          return undefined;
        }),

        read: Effect.fn(function* ({ olds, output }) {
          // Primary: lookup by webhookId
          if (output?.webhookId) {
            const result = yield* retryPolicy(
              AttioWebhooks.getWebhook({
                webhook_id: output.webhookId,
              }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (result) {
              return mapResponseToAttrs(result.data);
            }
          }

          // Fallback: paginated scan by targetUrl
          if (olds?.targetUrl) {
            let offset = 0;
            const limit = 50;
            while (true) {
              const page = yield* retryPolicy(
                AttioWebhooks.listWebhooks({ limit, offset }),
              ).pipe(
                Effect.catchTag("NotFoundError", () =>
                  Effect.succeed(undefined),
                ),
              );

              if (!page?.data || page.data.length === 0) break;

              const match = page.data.find(
                (w) => w.target_url === olds.targetUrl,
              );
              if (match) return mapResponseToAttrs(match);

              if (page.data.length < limit) break;
              offset += limit;
            }
          }

          return undefined;
        }),

        create: Effect.fn(function* ({ news, session }) {
          // Idempotency: paginated scan by targetUrl
          let offset = 0;
          const limit = 50;
          while (true) {
            const page = yield* retryPolicy(
              AttioWebhooks.listWebhooks({ limit, offset }),
            ).pipe(
              Effect.catchTag("NotFoundError", () =>
                Effect.succeed(undefined),
              ),
            );

            if (!page?.data || page.data.length === 0) break;

            const existing = page.data.find(
              (w) => w.target_url === news.targetUrl,
            );

            if (existing) {
              yield* session.note(
                `Idempotent Webhook: found existing for ${news.targetUrl}`,
              );
              return mapResponseToAttrs(existing);
            }

            if (page.data.length < limit) break;
            offset += limit;
          }

          const result = yield* retryPolicy(
            AttioWebhooks.createWebhook({
              target_url: news.targetUrl,
              subscriptions: news.subscriptions,
            }),
          );

          yield* session.note(
            `Created Webhook: ${news.targetUrl}`,
          );

          return mapResponseToAttrs(result.data);
        }),

        update: Effect.fn(function* ({ news, output, session }) {
          const result = yield* retryPolicy(
            AttioWebhooks.updateWebhook({
              webhook_id: output.webhookId,
              target_url: news.targetUrl,
              subscriptions: news.subscriptions,
            }),
          );

          yield* session.note(
            `Updated Webhook: ${news.targetUrl}`,
          );

          return { ...output, ...mapResponseToAttrs(result.data) };
        }),

        delete: Effect.fn(function* ({ output, session }) {
          yield* retryPolicy(
            AttioWebhooks.deleteWebhook({
              webhook_id: output.webhookId,
            }),
          ).pipe(
            Effect.catchTag("NotFoundError", () => Effect.void),
          );

          yield* session.note(
            `Deleted Webhook: ${output.targetUrl}`,
          );
        }),
      };
    }),
  );
