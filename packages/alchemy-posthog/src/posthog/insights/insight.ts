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
 * A PostHog Insight for querying and visualizing analytics data.
 *
 * @section Creating Insights
 * @example Trends Insight
 * ```typescript
 * class PageviewTrend extends Insight("PageviewTrend", {
 *   name: "Daily Pageviews",
 *   query: {
 *     kind: "TrendsQuery",
 *     series: [{ kind: "EventsNode", event: "$pageview" }],
 *   },
 *   saved: true,
 * }) {}
 * ```
 *
 * @section Attaching to Dashboards
 * @example Insight on a Dashboard
 * ```typescript
 * class DashboardInsight extends Insight("DashboardInsight", {
 *   name: "Revenue Trend",
 *   query: { kind: "TrendsQuery", series: [{ kind: "EventsNode", event: "purchase" }] },
 *   dashboards: [myDashboard.id],
 *   saved: true,
 * }) {}
 * ```
 */
export interface Insight<
  ID extends string = string,
  Props extends InsightProps = InsightProps,
> extends Resource<
    "PostHog.Insight",
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
}>("PostHog.Insight");
