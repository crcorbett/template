/**
 * PLG automation helpers for cross-system workflows.
 *
 * Each function composes PostHog event tracking with Attio CRM updates,
 * providing a single Effect-based call for common PLG lifecycle transitions.
 *
 * @example
 * ```typescript
 * import { onUpgrade, Events } from "@packages/plg";
 *
 * const effect = onUpgrade(plg, {
 *   companyId: "company-123",
 *   from_plan: "starter",
 *   to_plan: "pro",
 *   mrr_cents: 4900,
 * });
 * ```
 */

import * as Effect from "effect/Effect";
import type { AttioErrorType } from "@packages/attio";
import type { HttpClient } from "@effect/platform";
import type { Credentials, Endpoint } from "@packages/attio";

import { Events, type EventPayloads } from "../events.js";
import { LifecycleStages, ChurnRiskLevels, type ProductRole } from "../attio.js";
import type { PlgClient } from "./track.js";
import {
  updateLifecycleStage,
  updateChurnRisk,
  updateMrr,
  updateProductRole,
} from "./attio-sync.js";

/** Effect dependencies required by automation functions that touch Attio. */
type AttioDeps = HttpClient.HttpClient | Credentials | Endpoint;

// ---------------------------------------------------------------------------
// onSignupCompleted
// ---------------------------------------------------------------------------

export type OnSignupCompletedParams =
  EventPayloads[typeof Events.SIGNUP_COMPLETED] & { companyId: string };

/**
 * Handle a signup completion: track the PostHog event and set the
 * company's Attio lifecycle stage to Trial.
 */
export const onSignupCompleted = (
  plg: PlgClient,
  params: OnSignupCompletedParams,
): Effect.Effect<void, AttioErrorType, AttioDeps> => {
  const { companyId, ...properties } = params;
  return Effect.sync(() =>
    plg.track(Events.SIGNUP_COMPLETED, properties),
  ).pipe(
    Effect.andThen(updateLifecycleStage(companyId, LifecycleStages.TRIAL)),
  );
};

// ---------------------------------------------------------------------------
// onActivation
// ---------------------------------------------------------------------------

export type OnActivationParams =
  EventPayloads[typeof Events.ONBOARDING_COMPLETED] & {
    companyId: string;
    personId: string;
    role: ProductRole;
  };

/**
 * Handle user activation: track the PostHog onboarding-completed event,
 * set the company's lifecycle stage to Active, and assign a product role.
 */
export const onActivation = (
  plg: PlgClient,
  params: OnActivationParams,
): Effect.Effect<void, AttioErrorType, AttioDeps> => {
  const { companyId, personId, role, ...properties } = params;
  return Effect.sync(() =>
    plg.track(Events.ONBOARDING_COMPLETED, properties),
  ).pipe(
    Effect.andThen(
      Effect.all(
        [
          updateLifecycleStage(companyId, LifecycleStages.ACTIVE),
          updateProductRole(personId, role),
        ],
        { concurrency: "unbounded" },
      ),
    ),
    Effect.asVoid,
  );
};

// ---------------------------------------------------------------------------
// onUpgrade
// ---------------------------------------------------------------------------

export type OnUpgradeParams =
  EventPayloads[typeof Events.PLAN_UPGRADED] & { companyId: string };

/**
 * Handle a plan upgrade: track the PostHog event, update Attio MRR,
 * and set lifecycle stage to Expanding.
 */
export const onUpgrade = (
  plg: PlgClient,
  params: OnUpgradeParams,
): Effect.Effect<void, AttioErrorType, AttioDeps> => {
  const { companyId, ...properties } = params;
  return Effect.sync(() =>
    plg.track(Events.PLAN_UPGRADED, properties),
  ).pipe(
    Effect.andThen(
      Effect.all(
        [
          updateMrr(companyId, properties.mrr_cents),
          updateLifecycleStage(companyId, LifecycleStages.EXPANDING),
        ],
        { concurrency: "unbounded" },
      ),
    ),
    Effect.asVoid,
  );
};

// ---------------------------------------------------------------------------
// onDowngrade
// ---------------------------------------------------------------------------

export type OnDowngradeParams =
  EventPayloads[typeof Events.PLAN_DOWNGRADED] & { companyId: string };

/**
 * Handle a plan downgrade: track the PostHog event, update Attio MRR,
 * and set churn risk to High.
 */
export const onDowngrade = (
  plg: PlgClient,
  params: OnDowngradeParams,
): Effect.Effect<void, AttioErrorType, AttioDeps> => {
  const { companyId, ...properties } = params;
  return Effect.sync(() =>
    plg.track(Events.PLAN_DOWNGRADED, properties),
  ).pipe(
    Effect.andThen(
      Effect.all(
        [
          updateMrr(companyId, properties.mrr_cents),
          updateChurnRisk(companyId, ChurnRiskLevels.HIGH),
        ],
        { concurrency: "unbounded" },
      ),
    ),
    Effect.asVoid,
  );
};

// ---------------------------------------------------------------------------
// onChurnSignal
// ---------------------------------------------------------------------------

export type OnChurnSignalParams = { companyId: string };

/**
 * Handle a churn signal: update Attio churn risk to High and set
 * lifecycle stage to At Risk.
 *
 * This is a CRM-only operation — no PostHog event is tracked because
 * churn signals are derived from analytics, not direct user actions.
 */
export const onChurnSignal = (
  params: OnChurnSignalParams,
): Effect.Effect<void, AttioErrorType, AttioDeps> => {
  const { companyId } = params;
  return Effect.all(
    [
      updateChurnRisk(companyId, ChurnRiskLevels.HIGH),
      updateLifecycleStage(companyId, LifecycleStages.AT_RISK),
    ],
    { concurrency: "unbounded" },
  ).pipe(Effect.asVoid);
};

// ---------------------------------------------------------------------------
// onCancellation
// ---------------------------------------------------------------------------

export type OnCancellationParams =
  EventPayloads[typeof Events.ACCOUNT_CANCELLED] & { companyId: string };

/**
 * Handle an account cancellation: track the PostHog event and set
 * the company's Attio lifecycle stage to Churned.
 */
export const onCancellation = (
  plg: PlgClient,
  params: OnCancellationParams,
): Effect.Effect<void, AttioErrorType, AttioDeps> => {
  const { companyId, ...properties } = params;
  return Effect.sync(() =>
    plg.track(Events.ACCOUNT_CANCELLED, properties),
  ).pipe(
    Effect.andThen(updateLifecycleStage(companyId, LifecycleStages.CHURNED)),
  );
};
