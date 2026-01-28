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

export { UserBasic } from "../common.js";

// ---------------------------------------------------------------------------
// Feature flag sub-schemas
// ---------------------------------------------------------------------------

/** A single group in the feature flag filter configuration. */
export class FeatureFlagGroup extends S.Class<FeatureFlagGroup>(
  "FeatureFlagGroup"
)({
  /** Property filter conditions for this group (complex union in OpenAPI). */
  properties: S.optional(S.NullOr(S.Array(S.Unknown))),
  rollout_percentage: S.optional(S.NullOr(S.Number)),
  description: S.optional(S.NullOr(S.String)),
  sort_key: S.optional(S.NullOr(S.String)),
  users_affected: S.optional(S.NullOr(S.Number)),
  variant: S.optional(S.NullOr(S.String)),
}) {}

/** A single variant for multivariate feature flags. */
export class FeatureFlagVariant extends S.Class<FeatureFlagVariant>(
  "FeatureFlagVariant"
)({
  key: S.String,
  name: S.optional(S.NullOr(S.String)),
  rollout_percentage: S.Number,
}) {}

/** Multivariate configuration containing variants. */
export class FeatureFlagMultivariate extends S.Class<FeatureFlagMultivariate>(
  "FeatureFlagMultivariate"
)({
  variants: S.Array(FeatureFlagVariant),
}) {}

/** Top-level filters object for a feature flag. */
export class FeatureFlagFilters extends S.Class<FeatureFlagFilters>(
  "FeatureFlagFilters"
)({
  groups: S.optional(S.Array(FeatureFlagGroup)),
  multivariate: S.optional(S.NullOr(FeatureFlagMultivariate)),
  payloads: S.optional(S.Record({ key: S.String, value: S.Unknown })),
  aggregation_group_type_index: S.optional(S.NullOr(S.Number)),
  super_groups: S.optional(S.Array(FeatureFlagGroup)),
}) {}

// ---------------------------------------------------------------------------
// Feature flag response schema
// ---------------------------------------------------------------------------

export class FeatureFlag extends S.Class<FeatureFlag>("FeatureFlag")({
  id: S.Number,
  name: S.optional(S.String),
  key: S.String,
  filters: S.optional(FeatureFlagFilters),
  deleted: S.optional(S.Boolean),
  active: S.optional(S.Boolean),
  created_by: S.optional(S.NullOr(UserBasic)),
  created_at: S.optional(S.String),
  updated_at: S.optional(S.NullOr(S.String)),
  version: S.optional(S.Number),
  last_modified_by: S.optional(S.NullOr(UserBasic)),
  is_simple_flag: S.optional(S.Boolean),
  rollout_percentage: S.optional(S.NullOr(S.Number)),
  ensure_experience_continuity: S.optional(S.NullOr(S.Boolean)),
  /** Array of experiment IDs associated with this flag. */
  experiment_set: S.optional(S.NullOr(S.Array(S.Number))),
  /** Array of survey references (OpenAPI claims object but API returns array). */
  surveys: S.optional(S.Array(S.Unknown)),
  /** Array of early access feature references (OpenAPI claims object but API returns array). */
  features: S.optional(S.Array(S.Unknown)),
  rollback_conditions: S.optional(S.NullOr(S.Array(S.Unknown))),
  performed_rollback: S.optional(S.NullOr(S.Boolean)),
  can_edit: S.optional(S.Boolean),
  tags: S.optional(S.Array(S.String)),
  usage_dashboard: S.optional(S.NullOr(S.Number)),
  analytics_dashboards: S.optional(S.Array(S.Number)),
  has_enriched_analytics: S.optional(S.NullOr(S.Boolean)),
  user_access_level: S.optional(S.NullOr(S.String)),
}) {}

export class PaginatedFeatureFlagList extends S.Class<PaginatedFeatureFlagList>(
  "PaginatedFeatureFlagList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(FeatureFlag),
}) {}

export class ListFeatureFlagsRequest extends S.Class<ListFeatureFlagsRequest>(
  "ListFeatureFlagsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    active: S.optional(S.String).pipe(T.HttpQuery("active")),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/projects/{project_id}/feature_flags/" }),
    T.RestJsonProtocol()
  )
) {}

export class GetFeatureFlagRequest extends S.Class<GetFeatureFlagRequest>(
  "GetFeatureFlagRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/feature_flags/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateFeatureFlagRequest extends S.Class<CreateFeatureFlagRequest>(
  "CreateFeatureFlagRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    key: S.String,
    name: S.optional(S.String),
    filters: S.optional(FeatureFlagFilters),
    active: S.optional(S.Boolean),
    ensure_experience_continuity: S.optional(S.NullOr(S.Boolean)),
    rollout_percentage: S.optional(S.NullOr(S.Number)),
  },
  T.all(
    T.Http({
      method: "POST",
      uri: "/api/projects/{project_id}/feature_flags/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateFeatureFlagRequest extends S.Class<UpdateFeatureFlagRequest>(
  "UpdateFeatureFlagRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    key: S.optional(S.String),
    name: S.optional(S.String),
    filters: S.optional(FeatureFlagFilters),
    active: S.optional(S.Boolean),
    deleted: S.optional(S.Boolean),
    ensure_experience_continuity: S.optional(S.NullOr(S.Boolean)),
    rollout_percentage: S.optional(S.NullOr(S.Number)),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/projects/{project_id}/feature_flags/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteFeatureFlagRequest extends S.Class<DeleteFeatureFlagRequest>(
  "DeleteFeatureFlagRequest"
)({
  project_id: S.String,
  id: S.Number,
}) {}

const listFeatureFlagsOperation: Operation = {
  input: ListFeatureFlagsRequest,
  output: PaginatedFeatureFlagList,
  errors: [],
  pagination: { inputToken: "offset", outputToken: "next", items: "results", pageSize: "limit" },
};

const getFeatureFlagOperation: Operation = {
  input: GetFeatureFlagRequest,
  output: FeatureFlag,
  errors: [],
};

const createFeatureFlagOperation: Operation = {
  input: CreateFeatureFlagRequest,
  output: FeatureFlag,
  errors: [],
};

const updateFeatureFlagOperation: Operation = {
  input: UpdateFeatureFlagRequest,
  output: FeatureFlag,
  errors: [],
};

/** Dependencies required by all feature flag operations. */
type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listFeatureFlags: (
  input: ListFeatureFlagsRequest
) => Effect.Effect<PaginatedFeatureFlagList, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(listFeatureFlagsOperation);

export const getFeatureFlag: (
  input: GetFeatureFlagRequest
) => Effect.Effect<FeatureFlag, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(getFeatureFlagOperation);

export const createFeatureFlag: (
  input: CreateFeatureFlagRequest
) => Effect.Effect<FeatureFlag, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(createFeatureFlagOperation);

export const updateFeatureFlag: (
  input: UpdateFeatureFlagRequest
) => Effect.Effect<FeatureFlag, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateFeatureFlagOperation);

export const deleteFeatureFlag: (
  input: DeleteFeatureFlagRequest
) => Effect.Effect<FeatureFlag, PostHogErrorType, Deps> = (input) =>
  updateFeatureFlag({
    project_id: input.project_id,
    id: input.id,
    deleted: true,
  });
