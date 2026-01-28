import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import * as T from "../traits.js";

export { UserBasic } from "../common.js";

// ---------------------------------------------------------------------------
// Dashboard tile sub-schemas
// ---------------------------------------------------------------------------

/** Grid layout entry describing tile position/size at a given breakpoint. */
export class LayoutEntry extends S.Class<LayoutEntry>("LayoutEntry")({
  h: S.optional(S.Number),
  w: S.optional(S.Number),
  x: S.optional(S.Number),
  y: S.optional(S.Number),
  minH: S.optional(S.Number),
  minW: S.optional(S.Number),
}) {}

/** Minimal insight reference embedded in a dashboard tile. */
export class TileInsight extends S.Class<TileInsight>("TileInsight")({
  id: S.Number,
  short_id: S.optional(S.NullOr(S.String)),
  name: S.optional(S.NullOr(S.String)),
  derived_name: S.optional(S.NullOr(S.String)),
  description: S.optional(S.NullOr(S.String)),
  tags: S.optional(S.Array(S.String)),
  favorited: S.optional(S.Boolean),
  saved: S.optional(S.Boolean),
}) {}

/** Text content for a text-only dashboard tile. */
export class TileText extends S.Class<TileText>("TileText")({
  body: S.optional(S.NullOr(S.String)),
  last_modified_at: S.optional(S.NullOr(S.String)),
}) {}

// ---------------------------------------------------------------------------
// Dashboard filter schema (from OpenAPI DashboardFilter)
// ---------------------------------------------------------------------------

/** Dashboard-level filter applied across all tiles. */
export class DashboardFilter extends S.Class<DashboardFilter>(
  "DashboardFilter"
)({
  date_from: S.optional(S.NullOr(S.String)),
  date_to: S.optional(S.NullOr(S.String)),
  explicitDate: S.optional(S.NullOr(S.Boolean)),
  properties: S.optional(
    S.NullOr(S.Array(S.Record({ key: S.String, value: S.Unknown })))
  ),
}) {}

// ---------------------------------------------------------------------------
// Core dashboard schemas
// ---------------------------------------------------------------------------

export class DashboardTile extends S.Class<DashboardTile>("DashboardTile")({
  id: S.Number,
  layouts: S.optional(S.Record({ key: S.String, value: LayoutEntry })),
  color: S.optional(S.NullOr(S.String)),
  insight: S.optional(S.NullOr(TileInsight)),
  text: S.optional(S.NullOr(TileText)),
}) {}

export class Dashboard extends S.Class<Dashboard>("Dashboard")({
  id: S.Number,
  name: S.NullOr(S.String),
  description: S.optional(S.String),
  pinned: S.optional(S.Boolean),
  created_at: S.optional(S.String),
  created_by: S.optional(S.NullOr(UserBasic)),
  is_shared: S.optional(S.Boolean),
  deleted: S.optional(S.Boolean),
  creation_mode: S.optional(S.String),
  tags: S.optional(S.Array(S.String)),
  tiles: S.optional(S.Array(DashboardTile)),
  filters: S.optional(DashboardFilter),
  restriction_level: S.optional(S.Number),
  effective_restriction_level: S.optional(S.Number),
  effective_privilege_level: S.optional(S.Number),
}) {}

export class DashboardBasic extends S.Class<DashboardBasic>("DashboardBasic")({
  id: S.Number,
  name: S.NullOr(S.String),
  description: S.optional(S.String),
  pinned: S.optional(S.Boolean),
  created_at: S.optional(S.String),
  created_by: S.optional(S.NullOr(UserBasic)),
  is_shared: S.optional(S.Boolean),
  deleted: S.optional(S.Boolean),
  creation_mode: S.optional(S.String),
  tags: S.optional(S.Array(S.String)),
}) {}

export class PaginatedDashboardList extends S.Class<PaginatedDashboardList>(
  "PaginatedDashboardList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(DashboardBasic),
}) {}

export class ListDashboardsRequest extends S.Class<ListDashboardsRequest>(
  "ListDashboardsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/environments/{project_id}/dashboards/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class GetDashboardRequest extends S.Class<GetDashboardRequest>(
  "GetDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/environments/{project_id}/dashboards/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateDashboardRequest extends S.Class<CreateDashboardRequest>(
  "CreateDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    name: S.NullOr(S.String),
    description: S.optional(S.String),
    pinned: S.optional(S.Boolean),
    tags: S.optional(S.Array(S.String)),
    restriction_level: S.optional(S.Number),
  },
  T.all(
    T.Http({
      method: "POST",
      uri: "/api/environments/{project_id}/dashboards/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateDashboardRequest extends S.Class<UpdateDashboardRequest>(
  "UpdateDashboardRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    name: S.optional(S.NullOr(S.String)),
    description: S.optional(S.String),
    pinned: S.optional(S.Boolean),
    tags: S.optional(S.Array(S.String)),
    restriction_level: S.optional(S.Number),
    deleted: S.optional(S.Boolean),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/environments/{project_id}/dashboards/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteDashboardRequest extends S.Class<DeleteDashboardRequest>(
  "DeleteDashboardRequest"
)({
  project_id: S.String,
  id: S.Number,
}) {}

const listDashboardsOperation: Operation = {
  input: ListDashboardsRequest,
  output: PaginatedDashboardList,
  errors: [],
};

const getDashboardOperation: Operation = {
  input: GetDashboardRequest,
  output: Dashboard,
  errors: [],
};

const createDashboardOperation: Operation = {
  input: CreateDashboardRequest,
  output: Dashboard,
  errors: [],
};

const updateDashboardOperation: Operation = {
  input: UpdateDashboardRequest,
  output: Dashboard,
  errors: [],
};

export const listDashboards = makeClient(listDashboardsOperation);
export const getDashboard = makeClient(getDashboardOperation);
export const createDashboard = makeClient(createDashboardOperation);
export const updateDashboard = makeClient(updateDashboardOperation);

export const deleteDashboard = (input: DeleteDashboardRequest) =>
  updateDashboard({
    project_id: input.project_id,
    id: input.id,
    deleted: true,
  });
