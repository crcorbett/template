import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import * as T from "../traits.js";

export { UserBasic } from "../common.js";

// ---------------------------------------------------------------------------
// Cohort filter sub-schemas
// ---------------------------------------------------------------------------

/**
 * A single property filter condition within a cohort.
 * Supports person properties, behavioral events, and nested cohort membership.
 */
export class CohortPropertyValue extends S.Class<CohortPropertyValue>(
  "CohortPropertyValue"
)({
  /** Property key to filter on (e.g., "$browser", "email"). */
  key: S.String,
  /** Filter type: person property, behavioral event, or cohort membership. */
  type: S.String,
  /** Values to match against (varies by filter type). */
  value: S.Unknown,
  /** Comparison operator (e.g., "exact", "icontains", "is_set"). */
  operator: S.optional(S.String),
  /** Whether to negate the condition. */
  negation: S.optional(S.Boolean),
  /** Event type for behavioral filters (e.g., "events", "actions"). */
  event_type: S.optional(S.String),
  /** Time value for behavioral filters (API may return string or number). */
  time_value: S.optional(S.Union(S.String, S.Number)),
  /** Time interval unit for behavioral filters (e.g., "day", "week"). */
  time_interval: S.optional(S.String),
  /** Compiled bytecode for the filter (internal PostHog usage). */
  bytecode: S.optional(S.Array(S.Unknown)),
  /** Hash of the filter condition (internal PostHog usage). */
  conditionHash: S.optional(S.String),
}) {}

/**
 * A group of property conditions combined with AND/OR logic.
 */
export class CohortFilterGroup extends S.Class<CohortFilterGroup>(
  "CohortFilterGroup"
)({
  /** Logical operator for combining values: "AND" or "OR". */
  type: S.String,
  /** Array of property conditions within this group. */
  values: S.Array(CohortPropertyValue),
}) {}

/**
 * Top-level filter properties containing groups of conditions.
 */
export class CohortFilterProperties extends S.Class<CohortFilterProperties>(
  "CohortFilterProperties"
)({
  /** Logical operator for combining groups: "AND" or "OR". */
  type: S.String,
  /** Array of filter groups. */
  values: S.Array(CohortFilterGroup),
}) {}

/**
 * The complete filters object for a cohort.
 * Contains the properties field with nested AND/OR logic.
 */
export class CohortFilters extends S.Class<CohortFilters>("CohortFilters")({
  /** Nested filter properties with AND/OR group logic. */
  properties: CohortFilterProperties,
}) {}

// ---------------------------------------------------------------------------
// Cohort response schema
// ---------------------------------------------------------------------------

export class Cohort extends S.Class<Cohort>("Cohort")({
  id: S.Number,
  name: S.optional(S.NullOr(S.String)),
  description: S.optional(S.String),
  /** @deprecated Legacy groups format; use filters instead. */
  groups: S.optional(S.Array(S.Unknown)),
  deleted: S.optional(S.Boolean),
  /** Cohort filter configuration with nested AND/OR logic. */
  filters: S.optional(S.NullOr(CohortFilters)),
  /** Alternative query-based cohort definition (unstructured). */
  query: S.optional(S.NullOr(S.Unknown)),
  is_calculating: S.optional(S.Boolean),
  created_by: S.optional(S.NullOr(UserBasic)),
  created_at: S.optional(S.NullOr(S.String)),
  last_calculation: S.optional(S.NullOr(S.String)),
  errors_calculating: S.optional(S.Number),
  count: S.optional(S.NullOr(S.Number)),
  is_static: S.optional(S.Boolean),
}) {}

export class PaginatedCohortList extends S.Class<PaginatedCohortList>(
  "PaginatedCohortList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Cohort),
}) {}

export class ListCohortsRequest extends S.Class<ListCohortsRequest>(
  "ListCohortsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/projects/{project_id}/cohorts/" }),
    T.RestJsonProtocol()
  )
) {}

export class GetCohortRequest extends S.Class<GetCohortRequest>(
  "GetCohortRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/cohorts/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateCohortRequest extends S.Class<CreateCohortRequest>(
  "CreateCohortRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    name: S.NullOr(S.String),
    description: S.optional(S.String),
    /** @deprecated Legacy groups format; use filters instead. */
    groups: S.optional(S.Array(S.Unknown)),
    /** Cohort filter configuration with nested AND/OR logic. */
    filters: S.optional(CohortFilters),
    is_static: S.optional(S.Boolean),
  },
  T.all(
    T.Http({ method: "POST", uri: "/api/projects/{project_id}/cohorts/" }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateCohortRequest extends S.Class<UpdateCohortRequest>(
  "UpdateCohortRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    name: S.optional(S.NullOr(S.String)),
    description: S.optional(S.String),
    /** @deprecated Legacy groups format; use filters instead. */
    groups: S.optional(S.Array(S.Unknown)),
    /** Cohort filter configuration with nested AND/OR logic. */
    filters: S.optional(CohortFilters),
    deleted: S.optional(S.Boolean),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/projects/{project_id}/cohorts/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteCohortRequest extends S.Class<DeleteCohortRequest>(
  "DeleteCohortRequest"
)({
  project_id: S.String,
  id: S.Number,
}) {}

const listCohortsOperation: Operation = {
  input: ListCohortsRequest,
  output: PaginatedCohortList,
  errors: [],
};

const getCohortOperation: Operation = {
  input: GetCohortRequest,
  output: Cohort,
  errors: [],
};

const createCohortOperation: Operation = {
  input: CreateCohortRequest,
  output: Cohort,
  errors: [],
};

const updateCohortOperation: Operation = {
  input: UpdateCohortRequest,
  output: Cohort,
  errors: [],
};

export const listCohorts = makeClient(listCohortsOperation);
export const getCohort = makeClient(getCohortOperation);
export const createCohort = makeClient(createCohortOperation);
export const updateCohort = makeClient(updateCohortOperation);

export const deleteCohort = (input: DeleteCohortRequest) =>
  updateCohort({
    project_id: input.project_id,
    id: input.id,
    deleted: true,
  });
