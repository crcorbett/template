/**
 * PostHog Endpoint Configuration
 *
 * Allows customization of the PostHog API endpoint.
 */

import * as Context from "effect/Context";

/**
 * PostHog API endpoint URL.
 * Defaults to https://app.posthog.com if not provided.
 */
export class Endpoint extends Context.Tag("@posthog/Endpoint")<
  Endpoint,
  string
>() {
  static readonly DEFAULT = "https://app.posthog.com";
}
