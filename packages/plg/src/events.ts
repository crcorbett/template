/**
 * PLG Event Names
 *
 * Standard event names for product-led growth analytics.
 * Use these constants in your application code for type safety.
 *
 * @example
 * ```typescript
 * import { Events } from "@packages/plg/events";
 * posthog.capture(Events.SIGNUP_COMPLETED, { method: "google" });
 * ```
 */
export const Events = {
  // Acquisition funnel
  SIGNUP_STARTED: "signup_started",
  SIGNUP_COMPLETED: "signup_completed",
  ONBOARDING_STARTED: "onboarding_started",
  ONBOARDING_COMPLETED: "onboarding_completed",

  // Engagement / Usage
  FEATURE_USED: "feature_used",
  SESSION_STARTED: "session_started",
  SESSION_ENDED: "session_ended",

  // Monetization
  CHECKOUT_STARTED: "checkout_started",
  CHECKOUT_COMPLETED: "checkout_completed",
  PLAN_UPGRADED: "plan_upgraded",
  PLAN_DOWNGRADED: "plan_downgraded",
  PAYMENT_FAILED: "payment_failed",

  // Churn signals
  ACCOUNT_CANCELLED: "account_cancelled",
  TRIAL_EXPIRED: "trial_expired",
} as const;

export type EventName = (typeof Events)[keyof typeof Events];
