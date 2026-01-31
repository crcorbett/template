/**
 * Attio stage configuration for alchemy-effect.
 *
 * Unlike PostHog, Attio does not require a project/workspace ID —
 * the API key is workspace-scoped and implicitly provides context.
 */
export interface AttioStageConfig {
  /**
   * Attio API key. Falls back to ATTIO_API_KEY env var.
   */
  apiKey?: string;

  /**
   * Attio API endpoint. Defaults to https://api.attio.com.
   */
  endpoint?: string;
}

declare module "alchemy-effect" {
  interface StageConfig {
    attio?: AttioStageConfig;
  }
}
