# Reference: Webhook Resource

## Resource Definition (`src/attio/webhook/webhook.ts`)

```typescript
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating an Attio Webhook.
 */
export interface WebhookProps {
  /**
   * URL where webhook events will be delivered.
   * @example "https://example.com/webhooks/attio"
   */
  targetUrl: string;

  /**
   * Event subscriptions for this webhook.
   * @example [{ event_type: "record.created", filter: { "$or": [{ field: "object_id", value: "..." }] } }]
   */
  subscriptions: unknown[];
}

/**
 * Output attributes for an Attio Webhook.
 */
export interface WebhookAttrs<
  _Props extends Input.Resolve<WebhookProps> = Input.Resolve<WebhookProps>
> {
  /** Webhook ID extracted from composite WebhookId. */
  webhookId: string;

  /** Delivery URL. */
  targetUrl: string;

  /** Event subscriptions. */
  subscriptions: unknown[] | undefined;

  /** Webhook status (active, paused, etc.). */
  status: string | null;

  /** ISO creation timestamp. */
  createdAt: string | undefined;
}

/**
 * An Attio Webhook subscribes to workspace events.
 *
 * @section Creating Webhooks
 * @example Record Change Webhook
 * ```typescript
 * class RecordChanges extends Webhook("RecordChanges", {
 *   targetUrl: "https://example.com/webhooks/attio",
 *   subscriptions: [
 *     { event_type: "record.created" },
 *     { event_type: "record.updated" },
 *     { event_type: "record.deleted" },
 *   ],
 * }) {}
 * ```
 */
export interface Webhook<
  ID extends string = string,
  Props extends WebhookProps = WebhookProps,
> extends Resource<
  "Attio.Webhook",
  ID,
  Props,
  WebhookAttrs<Input.Resolve<Props>>,
  Webhook
> {}

export const Webhook = Resource<{
  <const ID extends string, const Props extends WebhookProps>(
    id: ID,
    props: Props,
  ): Webhook<ID, Props>;
}>("Attio.Webhook");
```

## Provider Notes

- `stables: ["webhookId"]`
- `diff`: all prop changes → update (no replacement triggers)
- `read`: getWebhook by webhookId; fallback paginated scan by targetUrl
- `create`: paginated scan listWebhooks for matching targetUrl
- `update`: updateWebhook with target_url, subscriptions
- `delete`: hard delete via deleteWebhook + catch NotFoundError
