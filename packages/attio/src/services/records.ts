import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import type * as Stream from "effect/Stream";
import * as S from "effect/Schema";
import type { Operation, PaginatedOperation } from "../client/operation.js";
import { makeClient, makePaginated } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, COMMON_ERRORS_WITH_CONFLICT, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";
import { RecordId } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioRecord */
export class AttioRecord extends S.Class<AttioRecord>("AttioRecord")({
  id: RecordId,
  created_at: S.String,
  web_url: S.optional(S.String),
  values: S.optional(S.Record({ key: S.String, value: S.Unknown })),
}) {}

/** @example RecordList */
export class RecordList extends S.Class<RecordList>("RecordList")({
  data: S.Array(AttioRecord),
}) {}

/** @example RecordResponse */
export class RecordResponse extends S.Class<RecordResponse>("RecordResponse")({
  data: AttioRecord,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example QueryRecordsRequest */
export class QueryRecordsRequest extends S.Class<QueryRecordsRequest>("QueryRecordsRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    filter: S.optional(S.Unknown),
    sorts: S.optional(S.Array(S.Unknown)),
    limit: S.optional(S.Number),
    offset: S.optional(S.Number),
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/objects/{object}/records/query" }),
    T.RestJsonProtocol()
  )
) {}

/** @example CreateRecordRequest */
export class CreateRecordRequest extends S.Class<CreateRecordRequest>("CreateRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    data: S.Unknown,
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/objects/{object}/records" }),
    T.RestJsonProtocol()
  )
) {}

/** @example GetRecordRequest */
export class GetRecordRequest extends S.Class<GetRecordRequest>("GetRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    record_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/objects/{object}/records/{record_id}" }),
    T.RestJsonProtocol()
  )
) {}

/** @example UpdateRecordRequest */
export class UpdateRecordRequest extends S.Class<UpdateRecordRequest>("UpdateRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    record_id: S.String.pipe(T.HttpLabel()),
    data: S.optional(S.Unknown),
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/v2/objects/{object}/records/{record_id}" }),
    T.RestJsonProtocol()
  )
) {}

/** @example DeleteRecordRequest */
export class DeleteRecordRequest extends S.Class<DeleteRecordRequest>("DeleteRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    record_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "DELETE", uri: "/v2/objects/{object}/records/{record_id}" }),
    T.RestJsonProtocol()
  )
) {}

/** @example AssertRecordRequest */
export class AssertRecordRequest extends S.Class<AssertRecordRequest>("AssertRecordRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    matching_attribute: S.String.pipe(T.HttpQuery("matching_attribute")),
    data: S.Unknown,
  },
  T.all(
    T.Http({ method: "PUT", uri: "/v2/objects/{object}/records" }),
    T.RestJsonProtocol()
  )
) {}

// --- Operations ---

const queryRecordsOp: PaginatedOperation = {
  input: QueryRecordsRequest,
  output: RecordList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "offset",
    inputToken: "offset",
    items: "data",
    pageSize: "limit",
  },
};

const createRecordOp: Operation = {
  input: CreateRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS],
};

const getRecordOp: Operation = {
  input: GetRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const updateRecordOp: Operation = {
  input: UpdateRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteRecordOp: Operation = {
  input: DeleteRecordRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const assertRecordOp: Operation = {
  input: AssertRecordRequest,
  output: RecordResponse,
  errors: [...COMMON_ERRORS_WITH_CONFLICT],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example queryRecords */
export const queryRecords: ((
  input: QueryRecordsRequest
) => Effect.Effect<RecordList, AttioErrorType, Deps>) & {
  pages: (input: QueryRecordsRequest) => Stream.Stream<RecordList, AttioErrorType, Deps>;
  items: (input: QueryRecordsRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(queryRecordsOp);

/** @example createRecord */
export const createRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(createRecordOp);

/** @example getRecord */
export const getRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(getRecordOp);

/** @example updateRecord */
export const updateRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateRecordOp);

/** @example deleteRecord */
export const deleteRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteRecordOp);

/** @example assertRecord */
export const assertRecord = /*@__PURE__*/ /*#__PURE__*/ makeClient(assertRecordOp);
