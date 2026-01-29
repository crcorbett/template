import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Dashboard.
 */
export interface DashboardProps {
  /**
   * Dashboard name.
   */
  name: string;

  /**
   * Dashboard description.
   */
  description?: string;

  /**
   * Whether the dashboard is pinned.
   */
  pinned?: boolean;

  /**
   * Tags for organizing dashboards.
   */
  tags?: string[];

  /**
   * Access restriction level for the dashboard.
   */
  restrictionLevel?: number;
}

/**
 * Output attributes for a PostHog Dashboard resource.
 */
export interface DashboardAttrs<_Props extends DashboardProps = DashboardProps> {
  /**
   * Server-generated ID (stable).
   */
  id: number;

  /**
   * Dashboard name.
   */
  name: string;

  /**
   * Dashboard description.
   */
  description: string | undefined;

  /**
   * Whether the dashboard is pinned.
   */
  pinned: boolean | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | undefined;
}

/**
 * A PostHog Dashboard for organizing insights.
 *
 * @section Creating Dashboards
 * @example Basic Dashboard
 * ```typescript
 * class MyDashboard extends Dashboard("MyDashboard", {
 *   name: "Product Metrics",
 *   description: "Key product health indicators",
 * }) {}
 * ```
 *
 * @example Pinned Dashboard with Tags
 * ```typescript
 * class PinnedDashboard extends Dashboard("PinnedDashboard", {
 *   name: "Executive Summary",
 *   pinned: true,
 *   tags: ["executive", "weekly"],
 * }) {}
 * ```
 */
export interface Dashboard<
  ID extends string = string,
  Props extends DashboardProps = DashboardProps,
> extends Resource<
  "PostHog.Dashboard",
  ID,
  Props,
  DashboardAttrs<Props>,
  Dashboard
> {}

export const Dashboard = Resource<{
  <const ID extends string, const Props extends DashboardProps>(
    id: ID,
    props: Props
  ): Dashboard<ID, Props>;
}>("PostHog.Dashboard");
