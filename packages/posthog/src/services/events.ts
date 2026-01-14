import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import * as T from "../traits.js";

export class ClickhouseEvent extends S.Class<ClickhouseEvent>(
  "ClickhouseEvent"
)({
  id: S.String,
  distinct_id: S.String,
  properties: S.optional(S.Unknown),
  event: S.String,
  timestamp: S.String,
  person: S.optional(S.Unknown),
  elements: S.optional(S.Unknown),
  elements_chain: S.optional(S.String),
}) {}

export class PaginatedClickhouseEventList extends S.Class<PaginatedClickhouseEventList>(
  "PaginatedClickhouseEventList"
)({
  next: S.optional(S.NullOr(S.String)),
  results: S.Array(ClickhouseEvent),
}) {}

export class ListEventsRequest extends S.Class<ListEventsRequest>(
  "ListEventsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    after: S.optional(S.String).pipe(T.HttpQuery("after")),
    before: S.optional(S.String).pipe(T.HttpQuery("before")),
    distinct_id: S.optional(S.String).pipe(T.HttpQuery("distinct_id")),
    event: S.optional(S.String).pipe(T.HttpQuery("event")),
    person_id: S.optional(S.String).pipe(T.HttpQuery("person_id")),
    properties: S.optional(S.String).pipe(T.HttpQuery("properties")),
  },
  T.all(
    T.Http({ method: "GET", uri: "/api/projects/{project_id}/events/" }),
    T.RestJsonProtocol()
  )
) {}

export class GetEventRequest extends S.Class<GetEventRequest>(
  "GetEventRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/events/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

const listEventsOperation: Operation = {
  input: ListEventsRequest,
  output: PaginatedClickhouseEventList,
  errors: [],
};

const getEventOperation: Operation = {
  input: GetEventRequest,
  output: ClickhouseEvent,
  errors: [],
};

export const listEvents = makeClient(listEventsOperation);
export const getEvent = makeClient(getEventOperation);
