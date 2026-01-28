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
export interface CohortAttrs {
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
 * PostHog Cohort resource.
 */
export interface Cohort<
  ID extends string = string,
  Props extends CohortProps = CohortProps,
> extends Resource<"PostHog.Cohorts.Cohort", ID, Props, CohortAttrs, Cohort> {}

export const Cohort = Resource<{
  <const ID extends string, const Props extends CohortProps>(
    id: ID,
    props: Props
  ): Cohort<ID, Props>;
}>("PostHog.Cohorts.Cohort");
