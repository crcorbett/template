/**
 * Type-safe Attio CRM sync helpers for PLG workflows.
 *
 * Provides typed methods for updating Attio company, person, and deal
 * records using PLG constants. Each method enforces the correct value
 * type and uses {@link AttioAttributes} for attribute slugs.
 *
 * @example
 * ```typescript
 * import { updateLifecycleStage, LifecycleStages } from "@packages/plg";
 *
 * // Update a company's lifecycle stage
 * const effect = updateLifecycleStage("company-123", LifecycleStages.ACTIVE);
 * ```
 */

import * as Effect from "effect/Effect";
import { Records } from "@packages/attio";
import type { AttioErrorType } from "@packages/attio";
import type { HttpClient } from "@effect/platform";
import type { Credentials, Endpoint } from "@packages/attio";

import {
  AttioAttributes,
  type LifecycleStage,
  type ChurnRiskLevel,
  type ProductRole,
} from "../attio.js";

/** Effect dependencies required by all Attio sync operations. */
type AttioDeps = HttpClient.HttpClient | Credentials | Endpoint;

/**
 * Update a company's lifecycle stage in Attio.
 *
 * @param companyId - The Attio record ID of the company
 * @param stage - A {@link LifecycleStage} value
 */
export const updateLifecycleStage = (
  companyId: string,
  stage: LifecycleStage,
): Effect.Effect<void, AttioErrorType, AttioDeps> =>
  Records.updateRecord(
    new Records.UpdateRecordRequest({
      object: "companies",
      record_id: companyId,
      data: { [AttioAttributes.LIFECYCLE_STAGE]: stage },
    }),
  ).pipe(Effect.asVoid);

/**
 * Update a company's churn risk level in Attio.
 *
 * @param companyId - The Attio record ID of the company
 * @param risk - A {@link ChurnRiskLevel} value
 */
export const updateChurnRisk = (
  companyId: string,
  risk: ChurnRiskLevel,
): Effect.Effect<void, AttioErrorType, AttioDeps> =>
  Records.updateRecord(
    new Records.UpdateRecordRequest({
      object: "companies",
      record_id: companyId,
      data: { [AttioAttributes.CHURN_RISK]: risk },
    }),
  ).pipe(Effect.asVoid);

/**
 * Update a company's health score in Attio.
 *
 * @param companyId - The Attio record ID of the company
 * @param score - Health score (0–100)
 */
export const updateHealthScore = (
  companyId: string,
  score: number,
): Effect.Effect<void, AttioErrorType, AttioDeps> =>
  Records.updateRecord(
    new Records.UpdateRecordRequest({
      object: "companies",
      record_id: companyId,
      data: { [AttioAttributes.HEALTH_SCORE]: score },
    }),
  ).pipe(Effect.asVoid);

/**
 * Update a company's MRR in Attio.
 *
 * @param companyId - The Attio record ID of the company
 * @param mrrCents - Monthly recurring revenue in cents
 */
export const updateMrr = (
  companyId: string,
  mrrCents: number,
): Effect.Effect<void, AttioErrorType, AttioDeps> =>
  Records.updateRecord(
    new Records.UpdateRecordRequest({
      object: "companies",
      record_id: companyId,
      data: { [AttioAttributes.MRR]: mrrCents },
    }),
  ).pipe(Effect.asVoid);

/**
 * Update a person's product role in Attio.
 *
 * @param personId - The Attio record ID of the person
 * @param role - A {@link ProductRole} value
 */
export const updateProductRole = (
  personId: string,
  role: ProductRole,
): Effect.Effect<void, AttioErrorType, AttioDeps> =>
  Records.updateRecord(
    new Records.UpdateRecordRequest({
      object: "people",
      record_id: personId,
      data: { [AttioAttributes.PRODUCT_ROLE]: role },
    }),
  ).pipe(Effect.asVoid);

/**
 * Mark a deal as Product Qualified Lead (PQL) in Attio.
 *
 * @param dealId - The Attio record ID of the deal
 */
export const markAsPql = (
  dealId: string,
): Effect.Effect<void, AttioErrorType, AttioDeps> =>
  Records.updateRecord(
    new Records.UpdateRecordRequest({
      object: "deals",
      record_id: dealId,
      data: { [AttioAttributes.IS_PQL]: true },
    }),
  ).pipe(Effect.asVoid);
