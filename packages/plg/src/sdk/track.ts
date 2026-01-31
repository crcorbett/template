/**
 * Type-safe PLG event tracking client.
 *
 * Wraps a PostHog-compatible capture function with compile-time
 * event payload validation using {@link EventPayloads}.
 *
 * @example
 * ```typescript
 * import { createPlgClient, Events } from "@packages/plg";
 *
 * const plg = createPlgClient(posthog);
 * plg.track(Events.FEATURE_USED, { feature: "export" });
 * ```
 */

import type { Events, EventPayloads } from "../events.js";

type EventName = (typeof Events)[keyof typeof Events];

/**
 * Minimal PostHog client interface required by the PLG SDK.
 * Any object satisfying this contract can be wrapped.
 */
export interface PostHogClient {
  capture(event: string, properties?: Record<string, unknown>): void;
}

/**
 * Type-safe PLG tracking client.
 *
 * The `track` method enforces that the `properties` argument
 * matches the payload schema defined in {@link EventPayloads}.
 */
export interface PlgClient {
  track<E extends EventName>(
    event: E,
    properties: EventPayloads[E],
  ): void;
}

/**
 * Create a type-safe PLG client that wraps a PostHog capture function.
 *
 * @param posthog - A PostHog client (or any object with a `capture` method)
 * @returns A {@link PlgClient} with typed `track` calls
 */
export function createPlgClient(posthog: PostHogClient): PlgClient {
  return {
    track(event, properties) {
      posthog.capture(event, properties as Record<string, unknown>);
    },
  };
}
