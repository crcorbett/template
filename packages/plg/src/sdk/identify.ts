/**
 * Type-safe PostHog person identification.
 *
 * Ensures person properties sent to PostHog conform to the
 * expected value types defined in {@link UserPropertyMap}.
 *
 * @example
 * ```typescript
 * import { identify, Plans } from "@packages/plg";
 *
 * identify(posthog, "user-123", {
 *   plan: Plans.PRO,
 *   lifecycle_stage: "active",
 *   is_pql: true,
 * });
 * ```
 */

import type { PlanType } from "../plans.js";
import type { LifecycleStage } from "../attio.js";

/**
 * Typed map of PostHog person properties and their expected value types.
 *
 * Keys correspond to {@link UserProperties} values.
 */
export interface UserPropertyMap {
  plan: PlanType;
  company: string;
  signup_date: string;
  lifecycle_stage: LifecycleStage;
  last_active: string;
  feature_count: number;
  is_pql: boolean;
}

/**
 * Minimal PostHog client interface for identification.
 */
export interface PostHogIdentifyClient {
  identify(distinctId: string, properties?: Record<string, unknown>): void;
}

/**
 * Identify a user in PostHog with type-safe person properties.
 *
 * @param posthog - A PostHog client with an `identify` method
 * @param distinctId - The user's distinct ID
 * @param properties - Partial set of typed person properties
 */
export function identify(
  posthog: PostHogIdentifyClient,
  distinctId: string,
  properties: Partial<UserPropertyMap>,
): void {
  posthog.identify(distinctId, properties as Record<string, unknown>);
}
