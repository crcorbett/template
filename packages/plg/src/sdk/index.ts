export { createPlgClient, type PlgClient, type PostHogClient } from "./track.js";
export { identify, type UserPropertyMap, type PostHogIdentifyClient } from "./identify.js";
export {
  updateLifecycleStage,
  updateChurnRisk,
  updateHealthScore,
  updateMrr,
  updateProductRole,
  markAsPql,
} from "./attio-sync.js";
export {
  onSignupCompleted,
  onActivation,
  onUpgrade,
  onDowngrade,
  onChurnSignal,
  onCancellation,
  type OnSignupCompletedParams,
  type OnActivationParams,
  type OnUpgradeParams,
  type OnDowngradeParams,
  type OnChurnSignalParams,
  type OnCancellationParams,
} from "./automations.js";
