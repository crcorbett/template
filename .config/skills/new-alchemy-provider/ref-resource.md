# Reference: Resource Definition

Source: `packages/alchemy-posthog/src/posthog/feature-flags/feature-flag.ts`

Complete example of a resource definition with Props, Attrs, and Resource export.

```typescript
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Feature Flag.
 */
export interface FeatureFlagProps {
  /**
   * Unique feature flag key. Changing this will replace the flag.
   * @example "enable-new-checkout"
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
 * A PostHog Feature Flag for controlling feature rollout.
 *
 * @section Creating Feature Flags
 * @example Basic Boolean Flag
 * ```typescript
 * class MyFlag extends FeatureFlag("MyFlag", {
 *   key: "enable-new-ui",
 *   name: "Enable New UI",
 *   active: true,
 * }) {}
 * ```
 *
 * @example Percentage Rollout
 * ```typescript
 * class GradualRollout extends FeatureFlag("GradualRollout", {
 *   key: "new-checkout-flow",
 *   name: "New Checkout Flow",
 *   active: true,
 *   rolloutPercentage: 25,
 * }) {}
 * ```
 *
 * @section Updating Feature Flags
 * @example Update Rollout Percentage
 * ```typescript
 * class UpdatedFlag extends FeatureFlag("MyFlag", {
 *   key: "enable-new-ui",
 *   name: "Enable New UI",
 *   active: true,
 *   rolloutPercentage: 100,
 * }) {}
 * ```
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
```
