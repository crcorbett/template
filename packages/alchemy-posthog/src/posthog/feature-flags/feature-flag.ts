import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Feature Flag.
 */
export interface FeatureFlagProps {
  /**
   * Unique feature flag key. Changing this will replace the flag.
   */
  key: string;

  /**
   * Human-readable name for the feature flag.
   */
  name?: string;

  /**
   * Whether the feature flag is active.
   */
  active?: boolean;

  /**
   * Filter/rollout configuration for the feature flag.
   */
  filters?: Record<string, unknown>;

  /**
   * Rollout percentage (0-100).
   */
  rolloutPercentage?: number | null;

  /**
   * Whether to ensure experience continuity across sessions.
   */
  ensureExperienceContinuity?: boolean | null;
}

/**
 * Output attributes for a PostHog Feature Flag resource.
 */
export interface FeatureFlagAttrs<_Props extends FeatureFlagProps = FeatureFlagProps> {
  /**
   * Server-generated ID (stable).
   */
  id: number;

  /**
   * Feature flag key (stable).
   */
  key: string;

  /**
   * Human-readable name.
   */
  name: string | undefined;

  /**
   * Whether the flag is active.
   */
  active: boolean | undefined;

  /**
   * Filter configuration.
   */
  filters: unknown | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | undefined;
}

/**
 * PostHog Feature Flag resource.
 */
export interface FeatureFlag<
  ID extends string = string,
  Props extends FeatureFlagProps = FeatureFlagProps,
> extends Resource<
  "PostHog.FeatureFlag",
  ID,
  Props,
  FeatureFlagAttrs<Props>,
  FeatureFlag
> {}

export const FeatureFlag = Resource<{
  <const ID extends string, const Props extends FeatureFlagProps>(
    id: ID,
    props: Props
  ): FeatureFlag<ID, Props>;
}>("PostHog.FeatureFlag");
