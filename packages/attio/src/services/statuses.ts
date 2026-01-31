import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { Operation } from "../client/operation.js";
import { makeClient } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";
import { StatusId } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioStatus */
export class AttioStatus extends S.Class<AttioStatus>("AttioStatus")({
  id: StatusId,
  title: S.String,
  is_archived: S.Boolean,
  celebration_enabled: S.Boolean,
  target_time_in_status: S.NullOr(S.String),
}) {}

/** @example StatusList */
export class StatusList extends S.Class<StatusList>("StatusList")({
  data: S.Array(AttioStatus),
}) {}

/** @example StatusResponse */
export class StatusResponse extends S.Class<StatusResponse>("StatusResponse")({
  data: AttioStatus,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListStatusesRequest */
export class ListStatusesRequest extends S.Class<ListStatusesRequest>("ListStatusesRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/{target}/{identifier}/attributes/{attribute}/statuses" }),
    T.RestJsonProtocol()
  )
) {}

/** @example CreateStatusRequest */
export class CreateStatusRequest extends S.Class<CreateStatusRequest>("CreateStatusRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
    title: S.String,
    celebration_enabled: S.optional(S.Boolean),
    target_time_in_status: S.optional(S.NullOr(S.String)),
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/{target}/{identifier}/attributes/{attribute}/statuses", dataWrapper: true }),
    T.RestJsonProtocol()
  )
) {}

/** @example UpdateStatusRequest */
export class UpdateStatusRequest extends S.Class<UpdateStatusRequest>("UpdateStatusRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
    status: S.String.pipe(T.HttpLabel()),
    title: S.optional(S.String),
    celebration_enabled: S.optional(S.Boolean),
    target_time_in_status: S.optional(S.NullOr(S.String)),
    is_archived: S.optional(S.Boolean),
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/v2/{target}/{identifier}/attributes/{attribute}/statuses/{status}", dataWrapper: true }),
    T.RestJsonProtocol()
  )
) {}

// --- Operations ---

const listStatusesOp: Operation = {
  input: ListStatusesRequest,
  output: StatusList,
  errors: [...COMMON_ERRORS],
};

const createStatusOp: Operation = {
  input: CreateStatusRequest,
  output: StatusResponse,
  errors: [...COMMON_ERRORS],
};

const updateStatusOp: Operation = {
  input: UpdateStatusRequest,
  output: StatusResponse,
  errors: [...COMMON_ERRORS],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listStatuses */
export const listStatuses: (
  input: ListStatusesRequest
) => Effect.Effect<StatusList, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(listStatusesOp);

/** @example createStatus */
export const createStatus: (
  input: CreateStatusRequest
) => Effect.Effect<StatusResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(createStatusOp);

/** @example updateStatus */
export const updateStatus: (
  input: UpdateStatusRequest
) => Effect.Effect<StatusResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(updateStatusOp);
