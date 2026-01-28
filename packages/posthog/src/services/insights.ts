import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import * as T from "../traits.js";

export { UserBasic } from "../common.js";

export class DashboardTileBasic extends S.Class<DashboardTileBasic>(
  "DashboardTileBasic"
)({
  id: S.Number,
  dashboard_id: S.Number,
}) {}

export class Insight extends S.Class<Insight>("Insight")({
  id: S.Number,
  short_id: S.optional(S.String),
  name: S.optional(S.NullOr(S.String)),
  derived_name: S.optional(S.NullOr(S.String)),
  query: S.optional(S.NullOr(S.Unknown)),
  order: S.optional(S.NullOr(S.Number)),
  deleted: S.optional(S.Boolean),
  dashboards: S.optional(S.Array(S.Number)),
  dashboard_tiles: S.optional(S.Array(DashboardTileBasic)),
  last_refresh: S.optional(S.NullOr(S.String)),
  cache_target_age: S.optional(S.NullOr(S.String)),
  next_allowed_client_refresh: S.optional(S.NullOr(S.String)),
  result: S.optional(S.Unknown),
  hasMore: S.optional(S.Unknown),
  columns: S.optional(S.Unknown),
  created_at: S.optional(S.NullOr(S.String)),
  created_by: S.optional(S.NullOr(UserBasic)),
  description: S.optional(S.NullOr(S.String)),
  updated_at: S.optional(S.NullOr(S.String)),
  last_modified_at: S.optional(S.NullOr(S.String)),
  last_modified_by: S.optional(S.NullOr(UserBasic)),
  favorited: S.optional(S.Boolean),
  saved: S.optional(S.Boolean),
  tags: S.optional(S.Array(S.Unknown)),
  is_cached: S.optional(S.Boolean),
  filters: S.optional(S.Unknown),
  filters_hash: S.optional(S.NullOr(S.String)),
  timezone: S.optional(S.NullOr(S.String)),
  effective_restriction_level: S.optional(S.Number),
  effective_privilege_level: S.optional(S.Number),
}) {}

export class PaginatedInsightList extends S.Class<PaginatedInsightList>(
  "PaginatedInsightList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Insight),
}) {}

export class ListInsightsRequest extends S.Class<ListInsightsRequest>(
  "ListInsightsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    basic: S.optional(S.Boolean).pipe(T.HttpQuery("basic")),
    saved: S.optional(S.Boolean).pipe(T.HttpQuery("saved")),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/projects/{project_id}/insights/" }),
    T.RestJsonProtocol()
  )
) {}

export class GetInsightRequest extends S.Class<GetInsightRequest>(
  "GetInsightRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/insights/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateInsightRequest extends S.Class<CreateInsightRequest>(
  "CreateInsightRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    name: S.optional(S.NullOr(S.String)),
    description: S.optional(S.NullOr(S.String)),
    query: S.optional(S.Unknown),
    filters: S.optional(S.Unknown),
    dashboards: S.optional(S.Array(S.Number)),
    saved: S.optional(S.Boolean),
  },
  T.all(
    T.Http({ method: "POST", uri: "/api/projects/{project_id}/insights/" }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateInsightRequest extends S.Class<UpdateInsightRequest>(
  "UpdateInsightRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    name: S.optional(S.NullOr(S.String)),
    description: S.optional(S.NullOr(S.String)),
    query: S.optional(S.Unknown),
    filters: S.optional(S.Unknown),
    dashboards: S.optional(S.Array(S.Number)),
    deleted: S.optional(S.Boolean),
    saved: S.optional(S.Boolean),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/projects/{project_id}/insights/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteInsightRequest extends S.Class<DeleteInsightRequest>(
  "DeleteInsightRequest"
)({
  project_id: S.String,
  id: S.Number,
}) {}

const listInsightsOperation: Operation = {
  input: ListInsightsRequest,
  output: PaginatedInsightList,
  errors: [],
};

const getInsightOperation: Operation = {
  input: GetInsightRequest,
  output: Insight,
  errors: [],
};

const createInsightOperation: Operation = {
  input: CreateInsightRequest,
  output: Insight,
  errors: [],
};

const updateInsightOperation: Operation = {
  input: UpdateInsightRequest,
  output: Insight,
  errors: [],
};

export const listInsights = makeClient(listInsightsOperation);
export const getInsight = makeClient(getInsightOperation);
export const createInsight = makeClient(createInsightOperation);
export const updateInsight = makeClient(updateInsightOperation);

export const deleteInsight = (input: DeleteInsightRequest) =>
  updateInsight({
    project_id: input.project_id,
    id: input.id,
    deleted: true,
  });
