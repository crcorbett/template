import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Experiment.
 */
export interface ExperimentProps {
  /**
   * Experiment name.
   */
  name: string;

  /**
   * Description of the experiment.
   */
  description?: string | null;

  /**
   * Associated feature flag key. Changing this will replace the experiment.
   * @example "checkout-variant"
   */
  featureFlagKey: string;

  /**
   * ISO start date for the experiment.
   */
  startDate?: string | null;

  /**
   * ISO end date for the experiment.
   */
  endDate?: string | null;

  /**
   * Variant configuration parameters.
   */
  parameters?: unknown | null;

  /**
   * Filter configuration.
   */
  filters?: unknown;

  /**
   * Holdout group ID.
   */
  holdoutId?: Input<number | null>;

  /**
   * Experiment type.
   */
  type?: "web" | "product";

  /**
   * Primary metrics for the experiment.
   */
  metrics?: unknown | null;

  /**
   * Secondary metrics for the experiment.
   */
  metricsSecondary?: unknown | null;
}

/**
 * Output attributes for a PostHog Experiment resource.
 */
export interface ExperimentAttrs<_Props extends Input.Resolve<ExperimentProps> = Input.Resolve<ExperimentProps>> {
  /**
   * Server-generated ID (stable).
   */
  id: number;

  /**
   * Experiment name.
   */
  name: string;

  /**
   * Associated feature flag key (stable).
   */
  featureFlagKey: string | undefined;

  /**
   * ISO start date.
   */
  startDate: string | null | undefined;

  /**
   * ISO end date.
   */
  endDate: string | null | undefined;

  /**
   * Whether the experiment is archived.
   */
  archived: boolean | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | undefined;
}

/**
 * A PostHog Experiment for A/B testing with a linked feature flag.
 *
 * @section Creating Experiments
 * @example Basic A/B Test
 * ```typescript
 * class MyExperiment extends Experiment("MyExperiment", {
 *   name: "Checkout Flow Test",
 *   featureFlagKey: "checkout-flow-variant",
 * }) {}
 * ```
 *
 * @example Experiment with Date Range
 * ```typescript
 * class TimedExperiment extends Experiment("TimedExperiment", {
 *   name: "Holiday Promo Test",
 *   featureFlagKey: "holiday-promo",
 *   startDate: "2025-12-01T00:00:00Z",
 *   endDate: "2025-12-31T23:59:59Z",
 * }) {}
 * ```
 */
export interface Experiment<
  ID extends string = string,
  Props extends ExperimentProps = ExperimentProps,
> extends Resource<
  "PostHog.Experiment",
  ID,
  Props,
  ExperimentAttrs<Input.Resolve<Props>>,
  Experiment
> {}

export const Experiment = Resource<{
  <const ID extends string, const Props extends ExperimentProps>(
    id: ID,
    props: Props
  ): Experiment<ID, Props>;
}>("PostHog.Experiment");
