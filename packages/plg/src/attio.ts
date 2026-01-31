/**
 * Attio CRM Constants for PLG
 *
 * Standard attribute slugs and option values for Attio CRM integration.
 *
 * @example
 * ```typescript
 * import { AttioAttributes, LifecycleStages } from "@packages/plg/attio";
 * await attio.records.update({
 *   object: "companies",
 *   values: {
 *     [AttioAttributes.LIFECYCLE_STAGE]: LifecycleStages.ACTIVE,
 *   },
 * });
 * ```
 */

// =============================================================================
// Attribute API Slugs
// =============================================================================

export const AttioAttributes = {
  // Company attributes
  LIFECYCLE_STAGE: "lifecycle_stage",
  MRR: "mrr",
  ARR: "arr",
  CHURN_RISK: "churn_risk",
  HEALTH_SCORE: "health_score",
  ICP_FIT: "icp_fit",

  // People attributes
  PRODUCT_ROLE: "product_role",
  LAST_LOGIN: "last_login",

  // Deal attributes
  DEAL_STAGE: "deal_stage",
  DEAL_VALUE: "deal_value",
  IS_PQL: "is_pql",
} as const;

export type AttioAttribute = (typeof AttioAttributes)[keyof typeof AttioAttributes];

// =============================================================================
// Select Option Values
// =============================================================================

/**
 * Customer lifecycle stages.
 */
export const LifecycleStages = {
  TRIAL: "Trial",
  ACTIVE: "Active",
  EXPANDING: "Expanding",
  AT_RISK: "At Risk",
  CHURNED: "Churned",
} as const;

export type LifecycleStage = (typeof LifecycleStages)[keyof typeof LifecycleStages];

/**
 * ICP fit tiers.
 */
export const IcpTiers = {
  TIER_1: "Tier 1",
  TIER_2: "Tier 2",
  TIER_3: "Tier 3",
} as const;

export type IcpTier = (typeof IcpTiers)[keyof typeof IcpTiers];

/**
 * Churn risk levels.
 */
export const ChurnRiskLevels = {
  HIGH: "High",
  MEDIUM: "Medium",
  LOW: "Low",
} as const;

export type ChurnRiskLevel = (typeof ChurnRiskLevels)[keyof typeof ChurnRiskLevels];

/**
 * Product role classifications.
 */
export const ProductRoles = {
  POWER_USER: "Power User",
  REGULAR: "Regular",
  INACTIVE: "Inactive",
} as const;

export type ProductRole = (typeof ProductRoles)[keyof typeof ProductRoles];

/**
 * Deal pipeline stages.
 */
export const DealStages = {
  PROSPECT: "Prospect",
  QUALIFIED: "Qualified",
  PROPOSAL: "Proposal",
  NEGOTIATION: "Negotiation",
  CLOSED_WON: "Closed Won",
  CLOSED_LOST: "Closed Lost",
} as const;

export type DealStage = (typeof DealStages)[keyof typeof DealStages];
