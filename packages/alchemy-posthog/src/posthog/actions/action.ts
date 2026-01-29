import { Resource } from "alchemy-effect";

/**
 * Defines a single match step for a PostHog Action.
 */
export interface ActionStepDef {
  event?: string;
  properties?: unknown;
  selector?: string;
  tagName?: string;
  text?: string;
  textMatching?: string;
  href?: string;
  hrefMatching?: string;
  url?: string;
  urlMatching?: string;
}

/**
 * Properties for creating or updating a PostHog Action.
 */
export interface ActionProps {
  /**
   * Action name.
   */
  name: string | null;

  /**
   * Description of the action.
   */
  description?: string;

  /**
   * Tags for the action.
   */
  tags?: string[];

  /**
   * Whether to post to Slack when the action is triggered.
   */
  postToSlack?: boolean;

  /**
   * Slack message format string.
   */
  slackMessageFormat?: string;

  /**
   * Match steps for the action.
   */
  steps?: ActionStepDef[];
}

/**
 * Output attributes for a PostHog Action resource.
 */
export interface ActionAttrs<_Props extends ActionProps = ActionProps> {
  /**
   * Server-generated ID (stable).
   */
  id: number;

  /**
   * Action name.
   */
  name: string | null;

  /**
   * Description.
   */
  description: string | undefined;

  /**
   * Tags.
   */
  tags: unknown[] | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | undefined;
}

/**
 * PostHog Action resource.
 */
export interface Action<
  ID extends string = string,
  Props extends ActionProps = ActionProps,
> extends Resource<"PostHog.Actions.Action", ID, Props, ActionAttrs<Props>, Action> {}

export const Action = Resource<{
  <const ID extends string, const Props extends ActionProps>(
    id: ID,
    props: Props
  ): Action<ID, Props>;
}>("PostHog.Actions.Action");
