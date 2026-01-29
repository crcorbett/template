import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Cohort.
 */
export interface CohortProps {
  /**
   * Cohort name.
   */
  name: string | null;

  /**
   * Description of the cohort.
   */
  description?: string;

  /**
   * Group definitions for the cohort.
   */
  groups?: unknown;

  /**
   * Filter configuration for the cohort.
   */
  filters?: unknown;

  /**
   * Whether this is a static (uploaded) cohort. Changing this will replace the cohort.
   */
  isStatic?: boolean;
}

/**
 * Output attributes for a PostHog Cohort resource.
 */
export interface CohortAttrs<_Props extends CohortProps = CohortProps> {
  /**
   * Server-generated ID (stable).
   */
  id: number;

  /**
   * Cohort name.
   */
  name: string | null | undefined;

  /**
   * Description.
   */
  description: string | undefined;

  /**
   * Whether the cohort is currently being calculated.
   */
  isCalculating: boolean | undefined;

  /**
   * Person count in the cohort.
   */
  count: number | null | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | null | undefined;
}

/**
 * A PostHog Cohort for grouping users by shared properties or behaviors.
 *
 * @section Creating Cohorts
 * @example Dynamic Cohort
 * ```typescript
 * class PowerUsers extends Cohort("PowerUsers", {
 *   name: "Power Users",
 *   description: "Users with 10+ sessions",
 *   filters: {
 *     properties: {
 *       type: "AND",
 *       values: [{ type: "behavioral", value: "performed_event", event_type: "session_start", operator: "gte", property_value: 10 }],
 *     },
 *   },
 * }) {}
 * ```
 *
 * @example Static Cohort
 * ```typescript
 * class BetaTesters extends Cohort("BetaTesters", {
 *   name: "Beta Testers",
 *   isStatic: true,
 * }) {}
 * ```
 */
export interface Cohort<
  ID extends string = string,
  Props extends CohortProps = CohortProps,
> extends Resource<"PostHog.Cohort", ID, Props, CohortAttrs<Props>, Cohort> {}

export const Cohort = Resource<{
  <const ID extends string, const Props extends CohortProps>(
    id: ID,
    props: Props
  ): Cohort<ID, Props>;
}>("PostHog.Cohort");
