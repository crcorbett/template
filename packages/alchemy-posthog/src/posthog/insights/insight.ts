import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Insight.
 */
export interface InsightProps {
  /**
   * Insight name.
   */
  name?: string | null;

  /**
   * Description of the insight.
   */
  description?: string | null;

  /**
   * HogQL or legacy query definition.
   */
  query?: unknown;

  /**
   * Legacy filter configuration.
   */
  filters?: unknown;

  /**
   * Dashboard IDs this insight is attached to.
   */
  dashboards?: Input<number>[];

  /**
   * Whether the insight is saved.
   */
  saved?: boolean;
}

/**
 * Output attributes for a PostHog Insight resource.
 */
export interface InsightAttrs<_Props extends Input.Resolve<InsightProps> = Input.Resolve<InsightProps>> {
  /**
   * Server-generated ID (stable).
   */
  id: number;

  /**
   * Short ID.
   */
  shortId: string | undefined;

  /**
   * Insight name.
   */
  name: string | null | undefined;

  /**
   * Description.
   */
  description: string | null | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | null | undefined;

  /**
   * Whether favorited.
   */
  favorited: boolean | undefined;
}

/**
 * PostHog Insight resource.
 */
export interface Insight<
  ID extends string = string,
  Props extends InsightProps = InsightProps,
> extends Resource<
    "PostHog.Insights.Insight",
    ID,
    Props,
    InsightAttrs<Input.Resolve<Props>>,
    Insight
  > {}

export const Insight = Resource<{
  <const ID extends string, const Props extends InsightProps>(
    id: ID,
    props: Props
  ): Insight<ID, Props>;
}>("PostHog.Insights.Insight");
