import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import * as T from "../traits.js";

export { UserBasic } from "../common.js";

export class FeatureFlag extends S.Class<FeatureFlag>("FeatureFlag")({
  id: S.Number,
  name: S.optional(S.String),
  key: S.String,
  filters: S.optional(S.Unknown),
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
  experiment_set: S.optional(S.Unknown),
  surveys: S.optional(S.Unknown),
  features: S.optional(S.Unknown),
  rollback_conditions: S.optional(S.NullOr(S.Unknown)),
  performed_rollback: S.optional(S.NullOr(S.Boolean)),
  can_edit: S.optional(S.Boolean),
  tags: S.optional(S.Array(S.Unknown)),
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
    filters: S.optional(S.Record({ key: S.String, value: S.Unknown })),
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
    filters: S.optional(S.Record({ key: S.String, value: S.Unknown })),
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

export const listFeatureFlags = makeClient(listFeatureFlagsOperation);
export const getFeatureFlag = makeClient(getFeatureFlagOperation);
export const createFeatureFlag = makeClient(createFeatureFlagOperation);
export const updateFeatureFlag = makeClient(updateFeatureFlagOperation);

export const deleteFeatureFlag = (input: DeleteFeatureFlagRequest) =>
  updateFeatureFlag({
    project_id: input.project_id,
    id: input.id,
    deleted: true,
  });
