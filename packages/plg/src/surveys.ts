/**
 * PLG Survey Identifiers
 *
 * Survey keys for programmatic triggering and referencing.
 *
 * @example
 * ```typescript
 * import { Surveys } from "@packages/plg/surveys";
 * posthog.capture("survey shown", { $survey_id: Surveys.POST_ACTIVATION_NPS });
 * ```
 */
export const Surveys = {
  // NPS
  POST_ACTIVATION_NPS: "post-activation-nps",
  MONTHLY_NPS: "monthly-nps",

  // CSAT
  FEATURE_CSAT: "feature-csat",
  /** @pending Not yet provisioned as a Survey resource in the PLG stack. See STACK-002. */
  SUPPORT_CSAT: "support-csat",

  // Exit surveys
  CHURN_EXIT: "churn-exit-survey",
  /** @pending Not yet provisioned as a Survey resource in the PLG stack. See STACK-002. */
  TRIAL_EXIT: "trial-exit-survey",

  // Research
  /** @pending Not yet provisioned as a Survey resource in the PLG stack. See STACK-002. */
  PERSONA_SURVEY: "persona-survey",
  /** @pending Not yet provisioned as a Survey resource in the PLG stack. See STACK-002. */
  JOBS_TO_BE_DONE: "jtbd-survey",
} as const;

export type SurveyId = (typeof Surveys)[keyof typeof Surveys];
