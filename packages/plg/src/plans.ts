/**
 * PLG Plans & Billing Constants
 *
 * Standard plan tiers and billing intervals for product-led growth.
 *
 * @example
 * ```typescript
 * import { Plans, BillingIntervals } from "@packages/plg/plans";
 * const plan = Plans.PRO;
 * const interval = BillingIntervals.ANNUAL;
 * ```
 */

export const Plans = {
  FREE: "free",
  STARTER: "starter",
  PRO: "pro",
  ENTERPRISE: "enterprise",
  TRIAL: "trial",
} as const;

export type PlanType = (typeof Plans)[keyof typeof Plans];

export const BillingIntervals = {
  MONTHLY: "monthly",
  ANNUAL: "annual",
} as const;

export type BillingInterval =
  (typeof BillingIntervals)[keyof typeof BillingIntervals];
