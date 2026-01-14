import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import * as T from "../traits.js";

export class UserBasic extends S.Class<UserBasic>("UserBasic")({
  id: S.Number,
  uuid: S.String,
  distinct_id: S.optional(S.String),
  first_name: S.optional(S.String),
  last_name: S.optional(S.String),
  email: S.String,
}) {}

export class Cohort extends S.Class<Cohort>("Cohort")({
  id: S.Number,
  name: S.optional(S.NullOr(S.String)),
  description: S.optional(S.String),
  groups: S.optional(S.Unknown),
  deleted: S.optional(S.Boolean),
  filters: S.optional(S.NullOr(S.Unknown)),
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
    groups: S.optional(S.Unknown),
    filters: S.optional(S.Unknown),
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
    groups: S.optional(S.Unknown),
    filters: S.optional(S.Unknown),
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
