/**
 * PLG Feature Flag Keys
 *
 * Standard feature flag keys for product-led growth experimentation.
 * Use these constants for type-safe feature checks.
 *
 * @example
 * ```typescript
 * import { FeatureFlags } from "@packages/plg/feature-flags";
 * if (posthog.isFeatureEnabled(FeatureFlags.DARK_MODE)) { ... }
 * ```
 */
export const FeatureFlags = {
  // UI/UX
  DARK_MODE: "dark-mode",
  /** @pending Not yet provisioned as a FeatureFlag resource in the PLG stack. See STACK-002. */
  NEW_NAVIGATION: "new-navigation",

  // Feature access
  BETA_FEATURES: "beta-features",
  ADVANCED_EXPORTS: "advanced-exports",

  // Experiments
  NEW_ONBOARDING: "new-onboarding-flow",
  /** @pending Not yet provisioned as a FeatureFlag resource in the PLG stack. See STACK-002. */
  NEW_PRICING_PAGE: "new-pricing-page",
} as const;

export type FeatureFlagKey = (typeof FeatureFlags)[keyof typeof FeatureFlags];
