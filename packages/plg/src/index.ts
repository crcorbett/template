/**
 * @packages/plg - PLG Constants
 *
 * Shared constants for Product-Led Growth infrastructure spanning
 * PostHog analytics and Attio CRM.
 *
 * ## Usage
 *
 * ```typescript
 * import { Events, FeatureFlags, Surveys } from "@packages/plg";
 * import { AttioAttributes, LifecycleStages } from "@packages/plg/attio";
 *
 * // Track events
 * posthog.capture(Events.SIGNUP_COMPLETED);
 *
 * // Check feature flags
 * if (posthog.isFeatureEnabled(FeatureFlags.DARK_MODE)) { ... }
 *
 * // Update Attio records
 * attio.records.update({
 *   values: { [AttioAttributes.LIFECYCLE_STAGE]: LifecycleStages.ACTIVE }
 * });
 * ```
 */

// PostHog constants
export * from "./events.js";
export * from "./feature-flags.js";
export * from "./surveys.js";
export * from "./plans.js";
export * from "./user-properties.js";

// Attio constants
export * from "./attio.js";
