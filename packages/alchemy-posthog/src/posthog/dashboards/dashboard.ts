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
export interface DashboardAttrs {
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
 * PostHog Dashboard resource.
 */
export interface Dashboard<
  ID extends string = string,
  Props extends DashboardProps = DashboardProps,
> extends Resource<
  "PostHog.Dashboards.Dashboard",
  ID,
  Props,
  DashboardAttrs,
  Dashboard
> {}

export const Dashboard = Resource<{
  <const ID extends string, const Props extends DashboardProps>(
    id: ID,
    props: Props
  ): Dashboard<ID, Props>;
}>("PostHog.Dashboards.Dashboard");
