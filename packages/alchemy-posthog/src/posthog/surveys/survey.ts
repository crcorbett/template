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
   * @example "popover"
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
 * A PostHog Survey for collecting user feedback.
 *
 * @section Creating Surveys
 * @example Popover Survey
 * ```typescript
 * class NpsSurvey extends Survey("NpsSurvey", {
 *   name: "NPS Survey",
 *   type: "popover",
 *   questions: [{
 *     type: "rating",
 *     question: "How likely are you to recommend us?",
 *     scale: 10,
 *   }],
 * }) {}
 * ```
 *
 * @example API Survey with Response Limit
 * ```typescript
 * class FeedbackSurvey extends Survey("FeedbackSurvey", {
 *   name: "Post-Purchase Feedback",
 *   type: "api",
 *   responsesLimit: 1000,
 * }) {}
 * ```
 *
 * @section Linking to Feature Flags
 * @example Survey with Feature Flag Targeting
 * ```typescript
 * class TargetedSurvey extends Survey("TargetedSurvey", {
 *   name: "Beta Feedback",
 *   type: "popover",
 *   linkedFlagId: myFeatureFlag.id,
 * }) {}
 * ```
 */
export interface Survey<
  ID extends string = string,
  Props extends SurveyProps = SurveyProps,
> extends Resource<"PostHog.Survey", ID, Props, SurveyAttrs<Input.Resolve<Props>>, Survey> {}

export const Survey = Resource<{
  <const ID extends string, const Props extends SurveyProps>(
    id: ID,
    props: Props
  ): Survey<ID, Props>;
}>("PostHog.Survey");
