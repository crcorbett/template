import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import * as T from "../traits.js";

export class Person extends S.Class<Person>("Person")({
  id: S.Number,
  name: S.optional(S.String),
  distinct_ids: S.Array(S.String),
  properties: S.optional(S.Unknown),
  created_at: S.optional(S.String),
  uuid: S.String,
}) {}

export class PaginatedPersonList extends S.Class<PaginatedPersonList>(
  "PaginatedPersonList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Person),
}) {}

export class ListPersonsRequest extends S.Class<ListPersonsRequest>(
  "ListPersonsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    distinct_id: S.optional(S.String).pipe(T.HttpQuery("distinct_id")),
    email: S.optional(S.String).pipe(T.HttpQuery("email")),
    search: S.optional(S.String).pipe(T.HttpQuery("search")),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/projects/{project_id}/persons/" }),
    T.RestJsonProtocol()
  )
) {}

export class GetPersonRequest extends S.Class<GetPersonRequest>(
  "GetPersonRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/persons/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeletePersonRequest extends S.Class<DeletePersonRequest>(
  "DeletePersonRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "DELETE",
      uri: "/api/projects/{project_id}/persons/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class EmptyResponse extends S.Class<EmptyResponse>("EmptyResponse")(
  {}
) {}

const listPersonsOperation: Operation = {
  input: ListPersonsRequest,
  output: PaginatedPersonList,
  errors: [],
};

const getPersonOperation: Operation = {
  input: GetPersonRequest,
  output: Person,
  errors: [],
};

const deletePersonOperation: Operation = {
  input: DeletePersonRequest,
  output: EmptyResponse,
  errors: [],
};

export const listPersons = makeClient(listPersonsOperation);
export const getPerson = makeClient(getPersonOperation);
export const deletePerson = makeClient(deletePersonOperation);
