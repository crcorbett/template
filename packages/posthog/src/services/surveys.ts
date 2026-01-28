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

// Survey question (simplified - the full schema is complex)
export class SurveyQuestion extends S.Class<SurveyQuestion>("SurveyQuestion")({
  type: QuestionTypeEnum,
  question: S.String,
  description: S.optional(S.NullOr(S.String)),
  descriptionContentType: S.optional(S.Literal("html", "text")),
  optional: S.optional(S.Boolean),
  buttonText: S.optional(S.String),
  // Rating-specific fields
  display: S.optional(S.Literal("number", "emoji")),
  scale: S.optional(S.Number),
  lowerBoundLabel: S.optional(S.String),
  upperBoundLabel: S.optional(S.String),
  // Choice-specific fields
  choices: S.optional(S.Array(S.String)),
  shuffleOptions: S.optional(S.Boolean),
  hasOpenChoice: S.optional(S.Boolean),
  // Link-specific fields
  link: S.optional(S.String),
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
  questions: S.optional(S.NullOr(S.Array(S.Unknown))),
  appearance: S.optional(S.NullOr(S.Unknown)),
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
    questions: S.optional(S.Array(S.Unknown)),
    appearance: S.optional(S.Unknown),
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
    questions: S.optional(S.Array(S.Unknown)),
    appearance: S.optional(S.Unknown),
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

export const listSurveys = makeClient(listSurveysOperation);
export const getSurvey = makeClient(getSurveyOperation);
export const createSurvey = makeClient(createSurveyOperation);
export const updateSurvey = makeClient(updateSurveyOperation);
export const deleteSurvey = makeClient(deleteSurveyOperation);
