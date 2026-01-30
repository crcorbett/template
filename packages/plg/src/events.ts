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

/**
 * Typed payload schemas for each PLG event.
 *
 * Use with the PLG SDK to get compile-time safety on event properties:
 * ```typescript
 * import type { EventPayloads } from "@packages/plg/events";
 * ```
 */
export interface EventPayloads {
  // Acquisition funnel
  [Events.SIGNUP_STARTED]: { method?: "email" | "google" | "github" };
  [Events.SIGNUP_COMPLETED]: { method: "email" | "google" | "github" };
  [Events.ONBOARDING_STARTED]: {};
  [Events.ONBOARDING_COMPLETED]: { steps_completed?: number };

  // Engagement / Usage
  [Events.FEATURE_USED]: { feature: string; context?: string };
  [Events.SESSION_STARTED]: {};
  [Events.SESSION_ENDED]: { duration_seconds?: number };

  // Monetization
  [Events.CHECKOUT_STARTED]: { plan: string };
  [Events.CHECKOUT_COMPLETED]: {
    plan: string;
    amount_cents: number;
    currency?: string;
  };
  [Events.PLAN_UPGRADED]: {
    from_plan: string;
    to_plan: string;
    mrr_cents: number;
  };
  [Events.PLAN_DOWNGRADED]: {
    from_plan: string;
    to_plan: string;
    mrr_cents: number;
  };
  [Events.PAYMENT_FAILED]: { plan: string; reason?: string };

  // Churn signals
  [Events.ACCOUNT_CANCELLED]: { reason?: string; plan: string };
  [Events.TRIAL_EXPIRED]: { plan: string };
}
