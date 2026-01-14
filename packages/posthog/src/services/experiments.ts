import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import * as T from "../traits.js";

// Experiment type enum
export const ExperimentTypeEnum = S.Literal("web", "product");
export type ExperimentType = S.Schema.Type<typeof ExperimentTypeEnum>;

// Conclusion enum
export const ConclusionEnum = S.Literal(
  "significant_positive",
  "significant_negative",
  "inconclusive"
);
export type Conclusion = S.Schema.Type<typeof ConclusionEnum>;

export class UserBasic extends S.Class<UserBasic>("UserBasic")({
  id: S.Number,
  uuid: S.String,
  distinct_id: S.optional(S.String),
  first_name: S.optional(S.String),
  last_name: S.optional(S.String),
  email: S.String,
}) {}

export class MinimalFeatureFlag extends S.Class<MinimalFeatureFlag>(
  "MinimalFeatureFlag"
)({
  id: S.Number,
  key: S.String,
  name: S.optional(S.NullOr(S.String)),
}) {}

export class ExperimentHoldout extends S.Class<ExperimentHoldout>(
  "ExperimentHoldout"
)({
  id: S.Number,
  name: S.String,
}) {}

export class ExperimentVariant extends S.Class<ExperimentVariant>(
  "ExperimentVariant"
)({
  key: S.String,
  name: S.optional(S.String),
  rollout_percentage: S.optional(S.Number),
}) {}

export class Experiment extends S.Class<Experiment>("Experiment")({
  id: S.Number,
  name: S.String,
  description: S.optional(S.NullOr(S.String)),
  start_date: S.optional(S.NullOr(S.String)),
  end_date: S.optional(S.NullOr(S.String)),
  feature_flag_key: S.optional(S.String),
  feature_flag: S.optional(S.NullOr(MinimalFeatureFlag)),
  holdout: S.optional(S.NullOr(ExperimentHoldout)),
  holdout_id: S.optional(S.NullOr(S.Number)),
  exposure_cohort: S.optional(S.NullOr(S.Number)),
  parameters: S.optional(S.NullOr(S.Unknown)),
  secondary_metrics: S.optional(S.NullOr(S.Unknown)),
  filters: S.optional(S.Unknown),
  archived: S.optional(S.Boolean),
  deleted: S.optional(S.NullOr(S.Boolean)),
  created_by: S.optional(S.NullOr(UserBasic)),
  created_at: S.optional(S.String),
  updated_at: S.optional(S.String),
  type: S.optional(S.NullOr(ExperimentTypeEnum)),
  metrics: S.optional(S.NullOr(S.Unknown)),
  metrics_secondary: S.optional(S.NullOr(S.Unknown)),
  stats_config: S.optional(S.NullOr(S.Unknown)),
  conclusion: S.optional(S.NullOr(ConclusionEnum)),
  conclusion_comment: S.optional(S.NullOr(S.String)),
}) {}

export class ExperimentBasic extends S.Class<ExperimentBasic>(
  "ExperimentBasic"
)({
  id: S.Number,
  name: S.String,
  description: S.optional(S.NullOr(S.String)),
  start_date: S.optional(S.NullOr(S.String)),
  end_date: S.optional(S.NullOr(S.String)),
  feature_flag_key: S.optional(S.String),
  archived: S.optional(S.Boolean),
  created_at: S.optional(S.String),
}) {}

export class PaginatedExperimentList extends S.Class<PaginatedExperimentList>(
  "PaginatedExperimentList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Experiment),
}) {}

export class ListExperimentsRequest extends S.Class<ListExperimentsRequest>(
  "ListExperimentsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/experiments/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class GetExperimentRequest extends S.Class<GetExperimentRequest>(
  "GetExperimentRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/experiments/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateExperimentRequest extends S.Class<CreateExperimentRequest>(
  "CreateExperimentRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    name: S.String,
    description: S.optional(S.NullOr(S.String)),
    feature_flag_key: S.String,
    start_date: S.optional(S.NullOr(S.String)),
    end_date: S.optional(S.NullOr(S.String)),
    parameters: S.optional(S.NullOr(S.Unknown)),
    filters: S.optional(S.Unknown),
    holdout_id: S.optional(S.NullOr(S.Number)),
    type: S.optional(ExperimentTypeEnum),
    metrics: S.optional(S.NullOr(S.Unknown)),
    metrics_secondary: S.optional(S.NullOr(S.Unknown)),
  },
  T.all(
    T.Http({
      method: "POST",
      uri: "/api/projects/{project_id}/experiments/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateExperimentRequest extends S.Class<UpdateExperimentRequest>(
  "UpdateExperimentRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    name: S.optional(S.String),
    description: S.optional(S.NullOr(S.String)),
    start_date: S.optional(S.NullOr(S.String)),
    end_date: S.optional(S.NullOr(S.String)),
    parameters: S.optional(S.NullOr(S.Unknown)),
    filters: S.optional(S.Unknown),
    archived: S.optional(S.Boolean),
    deleted: S.optional(S.NullOr(S.Boolean)),
    holdout_id: S.optional(S.NullOr(S.Number)),
    metrics: S.optional(S.NullOr(S.Unknown)),
    metrics_secondary: S.optional(S.NullOr(S.Unknown)),
    conclusion: S.optional(S.NullOr(ConclusionEnum)),
    conclusion_comment: S.optional(S.NullOr(S.String)),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/projects/{project_id}/experiments/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteExperimentRequest extends S.Class<DeleteExperimentRequest>(
  "DeleteExperimentRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "DELETE",
      uri: "/api/projects/{project_id}/experiments/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

// Void response for delete
const VoidResponse = S.Struct({});

const listExperimentsOperation: Operation = {
  input: ListExperimentsRequest,
  output: PaginatedExperimentList,
  errors: [],
};

const getExperimentOperation: Operation = {
  input: GetExperimentRequest,
  output: Experiment,
  errors: [],
};

const createExperimentOperation: Operation = {
  input: CreateExperimentRequest,
  output: Experiment,
  errors: [],
};

const updateExperimentOperation: Operation = {
  input: UpdateExperimentRequest,
  output: Experiment,
  errors: [],
};

const deleteExperimentOperation: Operation = {
  input: DeleteExperimentRequest,
  output: VoidResponse,
  errors: [],
};

export const listExperiments = makeClient(listExperimentsOperation);
export const getExperiment = makeClient(getExperimentOperation);
export const createExperiment = makeClient(createExperimentOperation);
export const updateExperiment = makeClient(updateExperimentOperation);
export const deleteExperiment = makeClient(deleteExperimentOperation);
