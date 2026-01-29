import type { SurveyAppearance, SurveyQuestion } from "@packages/posthog/surveys";
import type { Input } from "alchemy-effect";
import { Resource } from "alchemy-effect";

/**
 * Properties for creating or updating a PostHog Survey.
 */
export interface SurveyProps {
  /**
   * Survey name.
   */
  name: string;

  /**
   * Description of the survey.
   */
  description?: string;

  /**
   * Survey type. Changing this will replace the survey.
   */
  type: "popover" | "widget" | "external_survey" | "api";

  /**
   * Survey questions configuration.
   */
  questions?: readonly SurveyQuestion[];

  /**
   * Visual appearance configuration.
   */
  appearance?: SurveyAppearance;

  /**
   * ISO start date for the survey.
   */
  startDate?: string | null;

  /**
   * ISO end date for the survey.
   */
  endDate?: string | null;

  /**
   * Maximum number of responses.
   */
  responsesLimit?: number | null;

  /**
   * Linked feature flag ID.
   */
  linkedFlagId?: Input<number | null>;
}

/**
 * Output attributes for a PostHog Survey resource.
 * NOTE: Survey IDs are string UUIDs, not numbers.
 */
export interface SurveyAttrs<_Props extends Input.Resolve<SurveyProps> = Input.Resolve<SurveyProps>> {
  /**
   * Server-generated UUID (stable).
   */
  id: string;

  /**
   * Survey name.
   */
  name: string;

  /**
   * Survey type (stable).
   */
  type: string;

  /**
   * ISO start date.
   */
  startDate: string | null | undefined;

  /**
   * ISO end date.
   */
  endDate: string | null | undefined;

  /**
   * Whether the survey is archived.
   */
  archived: boolean | undefined;

  /**
   * ISO creation timestamp.
   */
  createdAt: string | undefined;
}

/**
 * PostHog Survey resource.
 */
export interface Survey<
  ID extends string = string,
  Props extends SurveyProps = SurveyProps,
> extends Resource<"PostHog.Surveys.Survey", ID, Props, SurveyAttrs<Input.Resolve<Props>>, Survey> {}

export const Survey = Resource<{
  <const ID extends string, const Props extends SurveyProps>(
    id: ID,
    props: Props
  ): Survey<ID, Props>;
}>("PostHog.Surveys.Survey");
