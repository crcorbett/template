import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import * as T from "../traits.js";

// Survey Type enum
export const SurveyTypeEnum = S.Literal(
  "popover",
  "widget",
  "external_survey",
  "api"
);
export type SurveyType = S.Schema.Type<typeof SurveyTypeEnum>;

// Question types
export const QuestionTypeEnum = S.Literal(
  "open",
  "link",
  "rating",
  "single_choice",
  "multiple_choice"
);

// Survey question description content type
export const SurveyQuestionDescriptionContentType = S.Literal("html", "text");

// Survey position enum (from PostHog JS SDK)
export const SurveyPositionEnum = S.Literal(
  "top_left",
  "top_right",
  "top_center",
  "middle_left",
  "middle_right",
  "middle_center",
  "left",
  "center",
  "right",
  "next_to_trigger"
);
export type SurveyPosition = S.Schema.Type<typeof SurveyPositionEnum>;

// Survey tab position enum
export const SurveyTabPositionEnum = S.Literal(
  "top",
  "left",
  "right",
  "bottom"
);
export type SurveyTabPosition = S.Schema.Type<typeof SurveyTabPositionEnum>;

// Survey widget type enum
export const SurveyWidgetTypeEnum = S.Literal("button", "tab", "selector");
export type SurveyWidgetType = S.Schema.Type<typeof SurveyWidgetTypeEnum>;

// Branching logic types (from OpenAPI description)
// - next_question: Proceeds to the next question
// - end: Ends the survey
// - response_based: Branches based on response values
// - specific_question: Proceeds to a specific question by index
export const SurveyBranchingNextQuestion = S.Struct({
  type: S.Literal("next_question"),
});

export const SurveyBranchingEnd = S.Struct({
  type: S.Literal("end"),
});

export const SurveyBranchingResponseBased = S.Struct({
  type: S.Literal("response_based"),
  responseValues: S.optional(S.Record({ key: S.String, value: S.Unknown })),
});

export const SurveyBranchingSpecificQuestion = S.Struct({
  type: S.Literal("specific_question"),
  index: S.Number,
});

export const SurveyBranching = S.Union(
  SurveyBranchingNextQuestion,
  SurveyBranchingEnd,
  SurveyBranchingResponseBased,
  SurveyBranchingSpecificQuestion
);
export type SurveyBranching = S.Schema.Type<typeof SurveyBranching>;

// Survey question - complete schema from OpenAPI description
export class SurveyQuestion extends S.Class<SurveyQuestion>("SurveyQuestion")({
  // Common fields for all question types
  id: S.optional(S.String), // UUID, optional for create requests
  type: QuestionTypeEnum,
  question: S.String,
  description: S.optional(S.NullOr(S.String)),
  descriptionContentType: S.optional(SurveyQuestionDescriptionContentType),
  optional: S.optional(S.Boolean),
  buttonText: S.optional(S.String),
  branching: S.optional(SurveyBranching),
  // Rating-specific fields
  display: S.optional(S.Literal("number", "emoji")),
  scale: S.optional(S.Number),
  lowerBoundLabel: S.optional(S.String),
  upperBoundLabel: S.optional(S.String),
  isNpsQuestion: S.optional(S.Boolean), // Whether it's an NPS rating
  // Choice-specific fields
  choices: S.optional(S.Array(S.String)),
  shuffleOptions: S.optional(S.Boolean),
  hasOpenChoice: S.optional(S.Boolean),
  // Link-specific fields
  link: S.optional(S.String),
}) {}

// Survey appearance - from PostHog JS SDK types
export class SurveyAppearance extends S.Class<SurveyAppearance>(
  "SurveyAppearance"
)({
  // Color settings
  backgroundColor: S.optional(S.String),
  submitButtonColor: S.optional(S.String),
  submitButtonTextColor: S.optional(S.String),
  descriptionTextColor: S.optional(S.String),
  ratingButtonColor: S.optional(S.String),
  ratingButtonActiveColor: S.optional(S.String),
  ratingButtonHoverColor: S.optional(S.String),
  borderColor: S.optional(S.String),
  widgetColor: S.optional(S.String),
  // Deprecated fields (still supported)
  textColor: S.optional(S.String), // deprecated
  submitButtonText: S.optional(S.String), // deprecated
  // Boolean settings
  whiteLabel: S.optional(S.Boolean),
  autoDisappear: S.optional(S.Boolean),
  displayThankYouMessage: S.optional(S.Boolean),
  shuffleQuestions: S.optional(S.Boolean),
  // Thank you message settings
  thankYouMessageHeader: S.optional(S.String),
  thankYouMessageDescription: S.optional(S.String),
  thankYouMessageDescriptionContentType: S.optional(
    SurveyQuestionDescriptionContentType
  ),
  thankYouMessageCloseButtonText: S.optional(S.String),
  // Position and layout
  position: S.optional(SurveyPositionEnum),
  tabPosition: S.optional(SurveyTabPositionEnum),
  placeholder: S.optional(S.String),
  surveyPopupDelaySeconds: S.optional(S.Number),
  // Widget settings
  widgetType: S.optional(SurveyWidgetTypeEnum),
  widgetSelector: S.optional(S.String),
  widgetLabel: S.optional(S.String),
  // Styling
  fontFamily: S.optional(S.String),
  maxWidth: S.optional(S.String),
  zIndex: S.optional(S.String),
  disabledButtonOpacity: S.optional(S.String),
  boxPadding: S.optional(S.String),
}) {}

export { UserBasic } from "../common.js";

export class MinimalFeatureFlag extends S.Class<MinimalFeatureFlag>(
  "MinimalFeatureFlag"
)({
  id: S.Number,
  key: S.String,
  name: S.optional(S.NullOr(S.String)),
}) {}

export class Survey extends S.Class<Survey>("Survey")({
  id: S.String, // UUID
  name: S.String,
  description: S.optional(S.String),
  type: SurveyTypeEnum,
  questions: S.optional(S.NullOr(S.Array(SurveyQuestion))),
  appearance: S.optional(S.NullOr(SurveyAppearance)),
  start_date: S.optional(S.NullOr(S.String)),
  end_date: S.optional(S.NullOr(S.String)),
  archived: S.optional(S.Boolean),
  responses_limit: S.optional(S.NullOr(S.Number)),
  linked_flag_id: S.optional(S.NullOr(S.Number)),
  linked_flag: S.optional(S.NullOr(MinimalFeatureFlag)),
  targeting_flag: S.optional(S.NullOr(MinimalFeatureFlag)),
  conditions: S.optional(S.NullOr(S.String)),
  created_at: S.optional(S.String),
  created_by: S.optional(S.NullOr(UserBasic)),
}) {}

export class SurveyBasic extends S.Class<SurveyBasic>("SurveyBasic")({
  id: S.String,
  name: S.String,
  description: S.optional(S.String),
  type: SurveyTypeEnum,
  start_date: S.optional(S.NullOr(S.String)),
  end_date: S.optional(S.NullOr(S.String)),
  archived: S.optional(S.Boolean),
  created_at: S.optional(S.String),
}) {}

export class PaginatedSurveyList extends S.Class<PaginatedSurveyList>(
  "PaginatedSurveyList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Survey),
}) {}

export class ListSurveysRequest extends S.Class<ListSurveysRequest>(
  "ListSurveysRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    search: S.optional(S.String).pipe(T.HttpQuery("search")),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/surveys/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class GetSurveyRequest extends S.Class<GetSurveyRequest>(
  "GetSurveyRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.String.pipe(T.HttpLabel()), // UUID
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/surveys/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateSurveyRequest extends S.Class<CreateSurveyRequest>(
  "CreateSurveyRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    name: S.String,
    description: S.optional(S.String),
    type: SurveyTypeEnum,
    questions: S.optional(S.Array(SurveyQuestion)),
    appearance: S.optional(SurveyAppearance),
    start_date: S.optional(S.NullOr(S.String)),
    end_date: S.optional(S.NullOr(S.String)),
    responses_limit: S.optional(S.NullOr(S.Number)),
    linked_flag_id: S.optional(S.NullOr(S.Number)),
  },
  T.all(
    T.Http({
      method: "POST",
      uri: "/api/projects/{project_id}/surveys/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateSurveyRequest extends S.Class<UpdateSurveyRequest>(
  "UpdateSurveyRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.String.pipe(T.HttpLabel()),
    name: S.optional(S.String),
    description: S.optional(S.String),
    type: S.optional(SurveyTypeEnum),
    questions: S.optional(S.Array(SurveyQuestion)),
    appearance: S.optional(SurveyAppearance),
    start_date: S.optional(S.NullOr(S.String)),
    end_date: S.optional(S.NullOr(S.String)),
    archived: S.optional(S.Boolean),
    responses_limit: S.optional(S.NullOr(S.Number)),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/projects/{project_id}/surveys/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteSurveyRequest extends S.Class<DeleteSurveyRequest>(
  "DeleteSurveyRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "DELETE",
      uri: "/api/projects/{project_id}/surveys/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

// Void response for delete
const VoidResponse = S.Struct({});

const listSurveysOperation: Operation = {
  input: ListSurveysRequest,
  output: PaginatedSurveyList,
  errors: [],
};

const getSurveyOperation: Operation = {
  input: GetSurveyRequest,
  output: Survey,
  errors: [],
};

const createSurveyOperation: Operation = {
  input: CreateSurveyRequest,
  output: Survey,
  errors: [],
};

const updateSurveyOperation: Operation = {
  input: UpdateSurveyRequest,
  output: Survey,
  errors: [],
};

const deleteSurveyOperation: Operation = {
  input: DeleteSurveyRequest,
  output: VoidResponse,
  errors: [],
};

export const listSurveys = /*@__PURE__*/ /*#__PURE__*/ makeClient(listSurveysOperation);
export const getSurvey = /*@__PURE__*/ /*#__PURE__*/ makeClient(getSurveyOperation);
export const createSurvey = /*@__PURE__*/ /*#__PURE__*/ makeClient(createSurveyOperation);
export const updateSurvey = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateSurveyOperation);
export const deleteSurvey = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteSurveyOperation);
