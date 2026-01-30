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
  SUPPORT_CSAT: "support-csat",

  // Exit surveys
  CHURN_EXIT: "churn-exit-survey",
  TRIAL_EXIT: "trial-exit-survey",

  // Research
  PERSONA_SURVEY: "persona-survey",
  JOBS_TO_BE_DONE: "jtbd-survey",
} as const;

export type SurveyId = (typeof Surveys)[keyof typeof Surveys];
