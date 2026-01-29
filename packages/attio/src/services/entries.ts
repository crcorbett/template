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
import { EntryId } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioEntry */
export class AttioEntry extends S.Class<AttioEntry>("AttioEntry")({
  id: EntryId,
  created_at: S.String,
  values: S.optional(S.Record({ key: S.String, value: S.Unknown })),
}) {}

/** @example EntryList */
export class EntryList extends S.Class<EntryList>("EntryList")({
  data: S.Array(AttioEntry),
}) {}

/** @example EntryResponse */
export class EntryResponse extends S.Class<EntryResponse>("EntryResponse")({
  data: AttioEntry,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example QueryEntriesRequest */
export class QueryEntriesRequest extends S.Class<QueryEntriesRequest>("QueryEntriesRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    filter: S.optional(S.Unknown),
    sorts: S.optional(S.Array(S.Unknown)),
    limit: S.optional(S.Number),
    offset: S.optional(S.Number),
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/lists/{list}/entries/query" }),
    T.RestJsonProtocol()
  )
) {}

/** @example CreateEntryRequest */
export class CreateEntryRequest extends S.Class<CreateEntryRequest>("CreateEntryRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    data: S.Unknown,
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/lists/{list}/entries" }),
    T.RestJsonProtocol()
  )
) {}

/** @example GetEntryRequest */
export class GetEntryRequest extends S.Class<GetEntryRequest>("GetEntryRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    entry_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/lists/{list}/entries/{entry_id}" }),
    T.RestJsonProtocol()
  )
) {}

/** @example UpdateEntryRequest */
export class UpdateEntryRequest extends S.Class<UpdateEntryRequest>("UpdateEntryRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    entry_id: S.String.pipe(T.HttpLabel()),
    data: S.optional(S.Unknown),
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/v2/lists/{list}/entries/{entry_id}" }),
    T.RestJsonProtocol()
  )
) {}

/** @example DeleteEntryRequest */
export class DeleteEntryRequest extends S.Class<DeleteEntryRequest>("DeleteEntryRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    entry_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "DELETE", uri: "/v2/lists/{list}/entries/{entry_id}" }),
    T.RestJsonProtocol()
  )
) {}

/** @example AssertEntryRequest */
export class AssertEntryRequest extends S.Class<AssertEntryRequest>("AssertEntryRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    matching_attribute: S.String.pipe(T.HttpQuery("matching_attribute")),
    data: S.Unknown,
  },
  T.all(
    T.Http({ method: "PUT", uri: "/v2/lists/{list}/entries" }),
    T.RestJsonProtocol()
  )
) {}

/** @example OverwriteEntryRequest */
export class OverwriteEntryRequest extends S.Class<OverwriteEntryRequest>("OverwriteEntryRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    entry_id: S.String.pipe(T.HttpLabel()),
    data: S.Unknown,
  },
  T.all(
    T.Http({ method: "PUT", uri: "/v2/lists/{list}/entries/{entry_id}", dataWrapper: true }),
    T.RestJsonProtocol()
  )
) {}

/** @example ListEntryAttributeValuesRequest */
export class ListEntryAttributeValuesRequest extends S.Class<ListEntryAttributeValuesRequest>("ListEntryAttributeValuesRequest")(
  {
    list: S.String.pipe(T.HttpLabel()),
    entry_id: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/lists/{list}/entries/{entry_id}/attributes/{attribute}/values" }),
    T.RestJsonProtocol()
  )
) {}

/** @example EntryAttributeValueList */
export class EntryAttributeValueList extends S.Class<EntryAttributeValueList>("EntryAttributeValueList")({
  data: S.Array(S.Unknown),
}) {}

// --- Operations ---

const queryEntriesOp: PaginatedOperation = {
  input: QueryEntriesRequest,
  output: EntryList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "offset",
    inputToken: "offset",
    items: "data",
    pageSize: "limit",
  },
};

const createEntryOp: Operation = {
  input: CreateEntryRequest,
  output: EntryResponse,
  errors: [...COMMON_ERRORS],
};

const getEntryOp: Operation = {
  input: GetEntryRequest,
  output: EntryResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const updateEntryOp: Operation = {
  input: UpdateEntryRequest,
  output: EntryResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteEntryOp: Operation = {
  input: DeleteEntryRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const assertEntryOp: Operation = {
  input: AssertEntryRequest,
  output: EntryResponse,
  errors: [...COMMON_ERRORS_WITH_CONFLICT],
};

const overwriteEntryOp: Operation = {
  input: OverwriteEntryRequest,
  output: EntryResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const listEntryAttributeValuesOp: Operation = {
  input: ListEntryAttributeValuesRequest,
  output: EntryAttributeValueList,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example queryEntries */
export const queryEntries: ((
  input: QueryEntriesRequest
) => Effect.Effect<EntryList, AttioErrorType, Deps>) & {
  pages: (input: QueryEntriesRequest) => Stream.Stream<EntryList, AttioErrorType, Deps>;
  items: (input: QueryEntriesRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(queryEntriesOp);

/** @example createEntry */
export const createEntry = /*@__PURE__*/ /*#__PURE__*/ makeClient(createEntryOp);

/** @example getEntry */
export const getEntry = /*@__PURE__*/ /*#__PURE__*/ makeClient(getEntryOp);

/** @example updateEntry */
export const updateEntry = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateEntryOp);

/** @example deleteEntry */
export const deleteEntry = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteEntryOp);

/** @example assertEntry */
export const assertEntry = /*@__PURE__*/ /*#__PURE__*/ makeClient(assertEntryOp);

/** @example overwriteEntry */
export const overwriteEntry = /*@__PURE__*/ /*#__PURE__*/ makeClient(overwriteEntryOp);

/** @example listEntryAttributeValues */
export const listEntryAttributeValues = /*@__PURE__*/ /*#__PURE__*/ makeClient(listEntryAttributeValuesOp);
