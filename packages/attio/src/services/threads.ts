import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";
import * as S from "effect/Schema";
import type { Operation, PaginatedOperation } from "../client/operation.js";
import { makeClient, makePaginated } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";
import { ThreadId } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioThread */
export class AttioThread extends S.Class<AttioThread>("AttioThread")({
  id: ThreadId,
  comments: S.optional(S.Array(S.Unknown)),
  created_at: S.optional(S.String),
}) {}

/** @example ThreadList */
export class ThreadList extends S.Class<ThreadList>("ThreadList")({
  data: S.Array(AttioThread),
}) {}

/** @example ThreadResponse */
export class ThreadResponse extends S.Class<ThreadResponse>("ThreadResponse")({
  data: AttioThread,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListThreadsRequest */
export class ListThreadsRequest extends S.Class<ListThreadsRequest>("ListThreadsRequest")(
  {
    record_id: S.optional(S.String).pipe(T.HttpQuery("record_id")),
    object: S.optional(S.String).pipe(T.HttpQuery("object")),
    entry_id: S.optional(S.String).pipe(T.HttpQuery("entry_id")),
    list: S.optional(S.String).pipe(T.HttpQuery("list")),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/threads" }), T.RestJsonProtocol())
) {}

/** @example GetThreadRequest */
export class GetThreadRequest extends S.Class<GetThreadRequest>("GetThreadRequest")(
  { thread_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/threads/{thread_id}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listThreadsOp: PaginatedOperation = {
  input: ListThreadsRequest,
  output: ThreadList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "offset",
    inputToken: "offset",
    items: "data",
    pageSize: "limit",
  },
};

const getThreadOp: Operation = {
  input: GetThreadRequest,
  output: ThreadResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listThreads */
export const listThreads: ((
  input: ListThreadsRequest
) => Effect.Effect<ThreadList, AttioErrorType, Deps>) & {
  pages: (input: ListThreadsRequest) => Stream.Stream<ThreadList, AttioErrorType, Deps>;
  items: (input: ListThreadsRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(listThreadsOp);

/** @example getThread */
export const getThread = /*@__PURE__*/ /*#__PURE__*/ makeClient(getThreadOp);
