export interface PostHogStageConfig {
  /** PostHog project ID */
  projectId: string;
  /** PostHog personal API key. Falls back to POSTHOG_API_KEY env var. */
  apiKey?: string;
  /** PostHog API endpoint. Defaults to https://us.posthog.com */
  endpoint?: string;
}

declare module "alchemy-effect" {
  interface StageConfig {
    posthog?: PostHogStageConfig;
  }
}
