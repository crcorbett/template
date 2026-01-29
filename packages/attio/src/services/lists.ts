import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { Operation } from "../client/operation.js";
import { makeClient } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";
import { ListId, ActorReference } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioList */
export class AttioList extends S.Class<AttioList>("AttioList")({
  id: ListId,
  api_slug: S.NullOr(S.String),
  name: S.NullOr(S.String),
  parent_object: S.optional(S.Array(S.String)),
  workspace_access: S.optional(S.NullOr(S.String)),
  created_by_actor: S.optional(ActorReference),
}) {}

/** @example ListList */
export class ListList extends S.Class<ListList>("ListList")({
  data: S.Array(AttioList),
}) {}

/** @example ListResponse */
export class ListResponse extends S.Class<ListResponse>("ListResponse")({
  data: AttioList,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListListsRequest */
export class ListListsRequest extends S.Class<ListListsRequest>("ListListsRequest")(
  {},
  T.all(T.Http({ method: "GET", uri: "/v2/lists" }), T.RestJsonProtocol())
) {}

/** @example GetListRequest */
export class GetListRequest extends S.Class<GetListRequest>("GetListRequest")(
  { list: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/lists/{list}" }), T.RestJsonProtocol())
) {}

/** @example CreateListRequest */
export class CreateListRequest extends S.Class<CreateListRequest>("CreateListRequest")(
  {
    name: S.String,
    parent_object: S.optional(S.Array(S.String)),
  },
  T.all(T.Http({ method: "POST", uri: "/v2/lists", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example UpdateListRequest */
export class UpdateListRequest extends S.Class<UpdateListRequest>("UpdateListRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    name: S.optional(S.String),
  },
  T.all(T.Http({ method: "PATCH", uri: "/v2/lists/{list}", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example DeleteListRequest */
export class DeleteListRequest extends S.Class<DeleteListRequest>("DeleteListRequest")(
  { list: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "DELETE", uri: "/v2/lists/{list}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listListsOp: Operation = {
  input: ListListsRequest,
  output: ListList,
  errors: [...COMMON_ERRORS],
};

const getListOp: Operation = {
  input: GetListRequest,
  output: ListResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const createListOp: Operation = {
  input: CreateListRequest,
  output: ListResponse,
  errors: [...COMMON_ERRORS],
};

const updateListOp: Operation = {
  input: UpdateListRequest,
  output: ListResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteListOp: Operation = {
  input: DeleteListRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listLists */
export const listLists: (
  input: ListListsRequest
) => Effect.Effect<ListList, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(listListsOp);

/** @example getList */
export const getList: (
  input: GetListRequest
) => Effect.Effect<ListResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getListOp);

/** @example createList */
export const createList: (
  input: CreateListRequest
) => Effect.Effect<ListResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(createListOp);

/** @example updateList */
export const updateList: (
  input: UpdateListRequest
) => Effect.Effect<ListResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(updateListOp);

/** @example deleteList */
export const deleteList: (
  input: DeleteListRequest
) => Effect.Effect<{}, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteListOp);
