import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import {
  COMMON_ERRORS,
  COMMON_ERRORS_WITH_NOT_FOUND,
  type PostHogErrorType,
} from "../errors.js";
import * as T from "../traits.js";

// ---------------------------------------------------------------------------
// Event sub-schemas
// ---------------------------------------------------------------------------

/**
 * Person reference within an event.
 * Contains the basic person information associated with the event.
 */
export class EventPerson extends S.Class<EventPerson>("EventPerson")({
  /** Unique identifier for the person. */
  id: S.optional(S.String),
  /** Primary distinct ID for the person. */
  distinct_id: S.optional(S.String),
  /** Additional distinct IDs linked to this person. */
  distinct_ids: S.optional(S.Array(S.String)),
  /** Person properties (key-value pairs). */
  properties: S.optional(S.Record({ key: S.String, value: S.Unknown })),
  /** Person creation timestamp. */
  created_at: S.optional(S.String),
  /** UUID of the person. */
  uuid: S.optional(S.String),
  /** Whether the person has been identified. */
  is_identified: S.optional(S.Boolean),
}) {}

/**
 * DOM element captured during autocapture events.
 * Represents an element in the DOM hierarchy that triggered or was involved in the event.
 */
export class EventElement extends S.Class<EventElement>("EventElement")({
  /** Element tag name (e.g., "button", "a", "div"). */
  tag_name: S.optional(S.String),
  /** CSS classes on the element. */
  $el_text: S.optional(S.String),
  /** Text content of the element. */
  text: S.optional(S.String),
  /** href attribute for links. */
  href: S.optional(S.String),
  /** Element attributes as key-value pairs. */
  attr__class: S.optional(S.String),
  attr__id: S.optional(S.String),
  /** Position in the element hierarchy (0 = target element). */
  nth_child: S.optional(S.Number),
  nth_of_type: S.optional(S.Number),
  /** Additional attributes captured. */
  attributes: S.optional(S.Record({ key: S.String, value: S.Unknown })),
}) {}

// ---------------------------------------------------------------------------
// Event response schema
// ---------------------------------------------------------------------------

export class ClickhouseEvent extends S.Class<ClickhouseEvent>(
  "ClickhouseEvent"
)({
  id: S.String,
  distinct_id: S.String,
  /** Event properties as key-value pairs (e.g., $browser, $os, custom properties). */
  properties: S.optional(S.Record({ key: S.String, value: S.Unknown })),
  event: S.String,
  timestamp: S.String,
  /** Person associated with the event. */
  person: S.optional(EventPerson),
  /** DOM elements captured (for autocapture events). */
  elements: S.optional(S.Array(EventElement)),
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
  errors: [...COMMON_ERRORS],
  pagination: { inputToken: "after", outputToken: "next", items: "results" },
};

const getEventOperation: Operation = {
  input: GetEventRequest,
  output: ClickhouseEvent,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

/** Dependencies required by all event operations. */
type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listEvents: (
  input: ListEventsRequest
) => Effect.Effect<PaginatedClickhouseEventList, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(listEventsOperation);

export const getEvent: (
  input: GetEventRequest
) => Effect.Effect<ClickhouseEvent, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(getEventOperation);
