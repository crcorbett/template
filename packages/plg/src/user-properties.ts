/**
 * PostHog Person Properties
 *
 * Standard person property keys for PostHog user profiles.
 * These map to the properties set on PostHog person records
 * and are referenced by cohort filters and feature flag conditions.
 *
 * @example
 * ```typescript
 * import { UserProperties } from "@packages/plg/user-properties";
 * posthog.identify(userId, { [UserProperties.PLAN]: "pro" });
 * ```
 */

export const UserProperties = {
  PLAN: "plan",
  COMPANY: "company",
  SIGNUP_DATE: "signup_date",
  LIFECYCLE_STAGE: "lifecycle_stage",
  LAST_ACTIVE: "last_active",
  FEATURE_COUNT: "feature_count",
  IS_PQL: "is_pql",
} as const;

export type UserPropertyKey =
  (typeof UserProperties)[keyof typeof UserProperties];
