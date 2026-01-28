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
// Shared query sub-schemas (from OpenAPI spec)
// ---------------------------------------------------------------------------

/** Date range for queries. OpenAPI: DateRange. */
export class DateRange extends S.Class<DateRange>("DateRange")({
  date_from: S.optional(S.NullOr(S.String)),
  date_to: S.optional(S.NullOr(S.String)),
  explicitDate: S.optional(S.NullOr(S.Boolean)),
}) {}

// ---------------------------------------------------------------------------
// Series node schemas (from OpenAPI: EventsNode, ActionsNode)
// ---------------------------------------------------------------------------

/**
 * An event series node. OpenAPI: EventsNode.
 *
 * Fields sourced from EventsNode schema (additionalProperties: false).
 * Excess properties are stripped during decode by S.Class.
 */
export class EventsNode extends S.Class<EventsNode>("EventsNode")({
  kind: S.Literal("EventsNode"),
  event: S.optional(S.NullOr(S.String)),
  name: S.optional(S.NullOr(S.String)),
  custom_name: S.optional(S.NullOr(S.String)),
  math: S.optional(S.NullOr(S.String)),
  math_property: S.optional(S.NullOr(S.String)),
  math_hogql: S.optional(S.NullOr(S.String)),
  math_group_type_index: S.optional(S.NullOr(S.Number)),
  /** Property filters (17-member union in OpenAPI). */
  properties: S.optional(S.NullOr(S.Array(S.Unknown))),
  /** Fixed properties, not editable in UI. */
  fixedProperties: S.optional(S.NullOr(S.Array(S.Unknown))),
  limit: S.optional(S.NullOr(S.Number)),
  orderBy: S.optional(S.NullOr(S.Array(S.String))),
  version: S.optional(S.NullOr(S.Number)),
}) {}

/**
 * An action series node. OpenAPI: ActionsNode.
 *
 * Similar to EventsNode but references an action by id instead of event name.
 */
export class ActionsNode extends S.Class<ActionsNode>("ActionsNode")({
  kind: S.Literal("ActionsNode"),
  id: S.Number,
  name: S.optional(S.NullOr(S.String)),
  custom_name: S.optional(S.NullOr(S.String)),
  math: S.optional(S.NullOr(S.String)),
  math_property: S.optional(S.NullOr(S.String)),
  math_hogql: S.optional(S.NullOr(S.String)),
  math_group_type_index: S.optional(S.NullOr(S.Number)),
  /** Property filters (17-member union in OpenAPI). */
  properties: S.optional(S.NullOr(S.Array(S.Unknown))),
  fixedProperties: S.optional(S.NullOr(S.Array(S.Unknown))),
  version: S.optional(S.NullOr(S.Number)),
}) {}

/** Union of series node types used in query series arrays. */
const SeriesNode = S.Union(EventsNode, ActionsNode);

// ---------------------------------------------------------------------------
// Retention sub-schemas (from OpenAPI: RetentionEntity, RetentionFilter)
// ---------------------------------------------------------------------------

/**
 * Entity reference in retention queries. OpenAPI: RetentionEntity.
 *
 * id is string | number per spec (event name or action id).
 */
export class RetentionEntity extends S.Class<RetentionEntity>(
  "RetentionEntity"
)({
  id: S.optional(S.NullOr(S.Union(S.String, S.Number))),
  type: S.optional(S.NullOr(S.String)),
  kind: S.optional(S.NullOr(S.String)),
  name: S.optional(S.NullOr(S.String)),
  custom_name: S.optional(S.NullOr(S.String)),
  order: S.optional(S.NullOr(S.Number)),
  uuid: S.optional(S.NullOr(S.String)),
  /** Property filters (17-member union in OpenAPI). */
  properties: S.optional(S.NullOr(S.Array(S.Unknown))),
}) {}

/**
 * Retention-specific filter configuration. OpenAPI: RetentionFilter.
 *
 * All fields are optional with null defaults per spec.
 */
export class RetentionFilter extends S.Class<RetentionFilter>(
  "RetentionFilter"
)({
  targetEntity: S.optional(S.NullOr(RetentionEntity)),
  returningEntity: S.optional(S.NullOr(RetentionEntity)),
  period: S.optional(S.NullOr(S.String)),
  totalIntervals: S.optional(S.NullOr(S.Number)),
  retentionType: S.optional(S.NullOr(S.String)),
  retentionReference: S.optional(S.NullOr(S.String)),
  cumulative: S.optional(S.NullOr(S.Boolean)),
  display: S.optional(S.NullOr(S.String)),
  minimumOccurrences: S.optional(S.NullOr(S.Number)),
  selectedInterval: S.optional(S.NullOr(S.Number)),
  showTrendLines: S.optional(S.NullOr(S.Boolean)),
}) {}

// ---------------------------------------------------------------------------
// Insight query schema
// ---------------------------------------------------------------------------

/**
 * Top-level insight query object, discriminated by `kind`.
 *
 * OpenAPI defines separate schemas per query type (TrendsQuery, FunnelsQuery,
 * RetentionQuery, PathsQuery, StickinessQuery, LifecycleQuery) plus the
 * InsightVizNode wrapper. All share common fields; type-specific fields are
 * optional here. S.Class strips excess properties on decode, so unknown
 * type-specific fields (e.g. trendsFilter, funnelsFilter) are safely ignored.
 *
 * InsightVizNode has a `source` field that is itself a query — modelled as a
 * recursive reference via S.suspend.
 */
export class InsightQuery extends S.Class<InsightQuery>("InsightQuery")({
  kind: S.String,

  // -- Common fields across all query types --
  dateRange: S.optional(S.NullOr(DateRange)),
  filterTestAccounts: S.optional(S.NullOr(S.Boolean)),
  /**
   * Property filters. Can be either an array of property filter items, or a
   * PropertyGroupFilter object (`{type: "AND"|"OR", values: [...]}`).
   * Kept as S.Unknown since these are fundamentally different shapes.
   */
  properties: S.optional(S.Unknown),
  samplingFactor: S.optional(S.NullOr(S.Number)),
  aggregation_group_type_index: S.optional(S.NullOr(S.Number)),
  version: S.optional(S.NullOr(S.Number)),

  // -- Series-based queries (Trends, Funnels, Stickiness, Lifecycle) --
  series: S.optional(S.Array(SeriesNode)),
  interval: S.optional(S.NullOr(S.String)),

  // -- Breakdown --
  breakdownFilter: S.optional(S.NullOr(S.Record({ key: S.String, value: S.Unknown }))),

  // -- Retention --
  retentionFilter: S.optional(S.NullOr(RetentionFilter)),

  // -- InsightVizNode wrapper --
  /** Nested source query (InsightVizNode only). Recursive via S.suspend. */
  source: S.optional(S.suspend((): S.Schema<InsightQuery> => InsightQuery)),
}) {}

// ---------------------------------------------------------------------------
// Core insight schemas (from OpenAPI: Insight, DashboardTileBasic)
// ---------------------------------------------------------------------------

export class DashboardTileBasic extends S.Class<DashboardTileBasic>(
  "DashboardTileBasic"
)({
  id: S.Number,
  dashboard_id: S.Number,
}) {}

/**
 * Insight response schema. OpenAPI: Insight.
 *
 * Fields match the OpenAPI Insight schema. The deprecated `dashboards` field
 * is included (readOnly, still returned by the API) but `filters` is omitted
 * as it does not appear in the OpenAPI spec (legacy field).
 */
export class Insight extends S.Class<Insight>("Insight")({
  id: S.Number,
  short_id: S.optional(S.String),
  name: S.optional(S.NullOr(S.String)),
  derived_name: S.optional(S.NullOr(S.String)),
  query: S.optional(S.NullOr(InsightQuery)),
  order: S.optional(S.NullOr(S.Number)),
  deleted: S.optional(S.Boolean),
  /** @deprecated Use dashboard_tiles instead. Still returned by the API. */
  dashboards: S.optional(S.Array(S.Number)),
  dashboard_tiles: S.optional(S.Array(DashboardTileBasic)),
  last_refresh: S.optional(S.NullOr(S.String)),
  cache_target_age: S.optional(S.NullOr(S.String)),
  next_allowed_client_refresh: S.optional(S.NullOr(S.String)),
  /**
   * Computed query result data. Shape varies by insight type (arrays of data
   * points for trends, funnel steps for funnels, etc.). The OpenAPI spec types
   * this as `string` (readOnly) — it is actually a polymorphic JSON value
   * whose shape depends on the query kind. Kept as S.Unknown since fully
   * typing every result variant is not practical.
   */
  result: S.optional(S.Unknown),
  /** Whether more result rows exist. OpenAPI: string (actually boolean). */
  hasMore: S.optional(S.NullOr(S.Boolean)),
  /** Column names for tabular result data. OpenAPI: string (actually string[]). */
  columns: S.optional(S.NullOr(S.Array(S.String))),
  created_at: S.optional(S.NullOr(S.String)),
  created_by: S.optional(S.NullOr(UserBasic)),
  description: S.optional(S.NullOr(S.String)),
  updated_at: S.optional(S.NullOr(S.String)),
  last_modified_at: S.optional(S.NullOr(S.String)),
  last_modified_by: S.optional(S.NullOr(UserBasic)),
  favorited: S.optional(S.Boolean),
  tags: S.optional(S.Array(S.String)),
  is_sample: S.optional(S.Boolean),
  effective_restriction_level: S.optional(S.Number),
  effective_privilege_level: S.optional(S.Number),
  timezone: S.optional(S.NullOr(S.String)),
  /** OpenAPI: string. Actual API returns boolean. */
  is_cached: S.optional(S.Unknown),
}) {}

export class PaginatedInsightList extends S.Class<PaginatedInsightList>(
  "PaginatedInsightList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Insight),
}) {}

// ---------------------------------------------------------------------------
// Request schemas
// ---------------------------------------------------------------------------

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
    query: S.optional(InsightQuery),
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
    query: S.optional(InsightQuery),
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

// ---------------------------------------------------------------------------
// Operations
// ---------------------------------------------------------------------------

const listInsightsOperation: Operation = {
  input: ListInsightsRequest,
  output: PaginatedInsightList,
  errors: [],
  pagination: { inputToken: "offset", outputToken: "next", items: "results", pageSize: "limit" },
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

/** Dependencies required by all insight operations. */
type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listInsights: (
  input: ListInsightsRequest
) => Effect.Effect<PaginatedInsightList, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(listInsightsOperation);

export const getInsight: (
  input: GetInsightRequest
) => Effect.Effect<Insight, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(getInsightOperation);

export const createInsight: (
  input: CreateInsightRequest
) => Effect.Effect<Insight, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(createInsightOperation);

export const updateInsight: (
  input: UpdateInsightRequest
) => Effect.Effect<Insight, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateInsightOperation);

export const deleteInsight: (
  input: DeleteInsightRequest
) => Effect.Effect<Insight, PostHogErrorType, Deps> = (input) =>
  updateInsight({
    project_id: input.project_id,
    id: input.id,
    deleted: true,
  });
