import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import type { PostHogErrorType } from "../errors.js";
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

export { UserBasic } from "../common.js";

// ---------------------------------------------------------------------------
// Experiment sub-schemas
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Experiment Parameters - configuration for the experiment
// ---------------------------------------------------------------------------

/** Parameters for experiment configuration (feature flag variants, sample size, etc.) */
export class ExperimentParameters extends S.Class<ExperimentParameters>(
  "ExperimentParameters"
)({
  /** Feature flag variants for the experiment */
  feature_flag_variants: S.optional(S.Array(ExperimentVariant)),
  /** Recommended sample size for statistical significance */
  recommended_sample_size: S.optional(S.Number),
  /** Recommended running time in days */
  recommended_running_time: S.optional(S.Number),
  /** Minimum detectable effect size */
  minimum_detectable_effect: S.optional(S.Number),
  /** Aggregation group type index for group analytics */
  aggregation_group_type_index: S.optional(S.NullOr(S.Number)),
}) {}

// ---------------------------------------------------------------------------
// Experiment Metrics - metric configuration for experiments
// ---------------------------------------------------------------------------

/** Metric type enum for experiment metrics */
export const ExperimentMetricTypeEnum = S.Literal("primary", "secondary");
export type ExperimentMetricType = S.Schema.Type<
  typeof ExperimentMetricTypeEnum
>;

/** Metric kind enum (from PostHog metric types) */
export const ExperimentMetricKindEnum = S.Literal(
  "ExperimentTrendsQuery",
  "ExperimentFunnelsQuery"
);
export type ExperimentMetricKind = S.Schema.Type<
  typeof ExperimentMetricKindEnum
>;

/** Event node for experiment queries */
export class ExperimentEventNode extends S.Class<ExperimentEventNode>(
  "ExperimentEventNode"
)({
  kind: S.optional(S.Literal("EventsNode")),
  event: S.optional(S.NullOr(S.String)),
  name: S.optional(S.NullOr(S.String)),
  /** Property filters for the event (complex union in OpenAPI) */
  properties: S.optional(S.NullOr(S.Array(S.Unknown))),
  math: S.optional(S.NullOr(S.String)),
  math_property: S.optional(S.NullOr(S.String)),
  math_hogql: S.optional(S.NullOr(S.String)),
  math_group_type_index: S.optional(S.NullOr(S.Number)),
}) {}

/** Trends query for experiment metrics (count, sum, unique users, etc.) */
export class ExperimentTrendsQuery extends S.Class<ExperimentTrendsQuery>(
  "ExperimentTrendsQuery"
)({
  kind: S.Literal("ExperimentTrendsQuery"),
  /** Event or action to track */
  count_query: S.optional(
    S.Struct({
      kind: S.optional(S.Literal("TrendsQuery")),
      series: S.optional(S.Array(ExperimentEventNode)),
      /** Date range for the query */
      dateRange: S.optional(
        S.Struct({
          date_from: S.optional(S.NullOr(S.String)),
          date_to: S.optional(S.NullOr(S.String)),
        })
      ),
      /** Filter test accounts */
      filterTestAccounts: S.optional(S.Boolean),
      /** Sampling factor */
      samplingFactor: S.optional(S.NullOr(S.Number)),
    })
  ),
  /** Optional exposure query */
  exposure_query: S.optional(S.NullOr(S.Unknown)),
}) {}

/** Funnels query for experiment metrics (conversion tracking) */
export class ExperimentFunnelsQuery extends S.Class<ExperimentFunnelsQuery>(
  "ExperimentFunnelsQuery"
)({
  kind: S.Literal("ExperimentFunnelsQuery"),
  /** Funnel steps to track */
  funnels_query: S.optional(
    S.Struct({
      kind: S.optional(S.Literal("FunnelsQuery")),
      series: S.optional(S.Array(ExperimentEventNode)),
      /** Funnel window interval */
      funnelWindowInterval: S.optional(S.Number),
      /** Funnel window interval unit */
      funnelWindowIntervalUnit: S.optional(
        S.Literal("second", "minute", "hour", "day", "week", "month")
      ),
      /** Date range for the query */
      dateRange: S.optional(
        S.Struct({
          date_from: S.optional(S.NullOr(S.String)),
          date_to: S.optional(S.NullOr(S.String)),
        })
      ),
      /** Filter test accounts */
      filterTestAccounts: S.optional(S.Boolean),
      /** Sampling factor */
      samplingFactor: S.optional(S.NullOr(S.Number)),
    })
  ),
}) {}

/** Experiment metric - union of trends and funnels queries */
export const ExperimentMetric = S.Union(
  ExperimentTrendsQuery,
  ExperimentFunnelsQuery
);
export type ExperimentMetric = S.Schema.Type<typeof ExperimentMetric>;

// ---------------------------------------------------------------------------
// Experiment Stats Config - statistical analysis configuration
// ---------------------------------------------------------------------------

/** Statistics engine type */
export const StatsEngineEnum = S.Literal("bayesian", "frequentist");
export type StatsEngine = S.Schema.Type<typeof StatsEngineEnum>;

/** Statistics configuration for experiment analysis */
export class ExperimentStatsConfig extends S.Class<ExperimentStatsConfig>(
  "ExperimentStatsConfig"
)({
  /** Statistics engine to use */
  stats_engine: S.optional(StatsEngineEnum),
  /** Significance level (alpha) for frequentist tests */
  significance_level: S.optional(S.Number),
  /** Minimum sample size per variant */
  minimum_sample_size: S.optional(S.Number),
}) {}

// ---------------------------------------------------------------------------
// Experiment Filters - targeting configuration (similar to feature flags)
// ---------------------------------------------------------------------------

/** Filter group for experiment targeting */
export class ExperimentFilterGroup extends S.Class<ExperimentFilterGroup>(
  "ExperimentFilterGroup"
)({
  /** Property filter conditions (complex union in OpenAPI) */
  properties: S.optional(S.NullOr(S.Array(S.Unknown))),
  rollout_percentage: S.optional(S.NullOr(S.Number)),
  variant: S.optional(S.NullOr(S.String)),
}) {}

/** Top-level filters for experiment targeting */
export class ExperimentFilters extends S.Class<ExperimentFilters>(
  "ExperimentFilters"
)({
  /** Filter groups for targeting */
  groups: S.optional(S.Array(ExperimentFilterGroup)),
  /** Multivariate configuration */
  multivariate: S.optional(
    S.NullOr(
      S.Struct({
        variants: S.Array(ExperimentVariant),
      })
    )
  ),
  /** Aggregation group type index */
  aggregation_group_type_index: S.optional(S.NullOr(S.Number)),
  /** Date range for events */
  events: S.optional(S.NullOr(S.Array(S.Unknown))),
}) {}

// ---------------------------------------------------------------------------
// Legacy/Deprecated Metric Schema (secondary_metrics field)
// ---------------------------------------------------------------------------

/** Legacy secondary metric (deprecated, use metrics_secondary instead) */
export class LegacyExperimentMetric extends S.Class<LegacyExperimentMetric>(
  "LegacyExperimentMetric"
)({
  name: S.optional(S.String),
  type: S.optional(S.String),
  /** Query configuration */
  query: S.optional(S.Unknown),
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
  /** Experiment configuration parameters (variants, sample size, etc.) */
  parameters: S.optional(S.NullOr(ExperimentParameters)),
  /** @deprecated Use metrics_secondary instead. Legacy secondary metrics array. */
  secondary_metrics: S.optional(S.NullOr(S.Array(LegacyExperimentMetric))),
  /** Experiment targeting filters (similar to feature flag filters) */
  filters: S.optional(S.NullOr(ExperimentFilters)),
  archived: S.optional(S.Boolean),
  deleted: S.optional(S.NullOr(S.Boolean)),
  created_by: S.optional(S.NullOr(UserBasic)),
  created_at: S.optional(S.String),
  updated_at: S.optional(S.String),
  type: S.optional(S.NullOr(ExperimentTypeEnum)),
  /** Primary metrics for the experiment (trends or funnels queries) */
  metrics: S.optional(S.NullOr(S.Array(ExperimentMetric))),
  /** Secondary metrics for the experiment */
  metrics_secondary: S.optional(S.NullOr(S.Array(ExperimentMetric))),
  /** Statistical configuration for experiment analysis */
  stats_config: S.optional(S.NullOr(ExperimentStatsConfig)),
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
    /** Experiment configuration parameters */
    parameters: S.optional(S.NullOr(ExperimentParameters)),
    /** Experiment targeting filters */
    filters: S.optional(S.NullOr(ExperimentFilters)),
    holdout_id: S.optional(S.NullOr(S.Number)),
    type: S.optional(ExperimentTypeEnum),
    /** Primary metrics for the experiment */
    metrics: S.optional(S.NullOr(S.Array(ExperimentMetric))),
    /** Secondary metrics for the experiment */
    metrics_secondary: S.optional(S.NullOr(S.Array(ExperimentMetric))),
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
    /** Experiment configuration parameters */
    parameters: S.optional(S.NullOr(ExperimentParameters)),
    /** Experiment targeting filters */
    filters: S.optional(S.NullOr(ExperimentFilters)),
    archived: S.optional(S.Boolean),
    deleted: S.optional(S.NullOr(S.Boolean)),
    holdout_id: S.optional(S.NullOr(S.Number)),
    /** Primary metrics for the experiment */
    metrics: S.optional(S.NullOr(S.Array(ExperimentMetric))),
    /** Secondary metrics for the experiment */
    metrics_secondary: S.optional(S.NullOr(S.Array(ExperimentMetric))),
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
  pagination: { inputToken: "offset", outputToken: "next", items: "results", pageSize: "limit" },
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

/** Dependencies required by all experiment operations. */
type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listExperiments: (
  input: ListExperimentsRequest
) => Effect.Effect<PaginatedExperimentList, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(listExperimentsOperation);

export const getExperiment: (
  input: GetExperimentRequest
) => Effect.Effect<Experiment, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(getExperimentOperation);

export const createExperiment: (
  input: CreateExperimentRequest
) => Effect.Effect<Experiment, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(createExperimentOperation);

export const updateExperiment: (
  input: UpdateExperimentRequest
) => Effect.Effect<Experiment, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateExperimentOperation);

export const deleteExperiment: (
  input: DeleteExperimentRequest
) => Effect.Effect<{}, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteExperimentOperation);
