import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { Operation } from "../client/operation.js";
import { makeClient } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";
import { ObjectId } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioObject */
export class AttioObject extends S.Class<AttioObject>("AttioObject")({
  id: ObjectId,
  api_slug: S.NullOr(S.String),
  singular_noun: S.NullOr(S.String),
  plural_noun: S.NullOr(S.String),
  created_at: S.String,
}) {}

/** @example ObjectList */
export class ObjectList extends S.Class<ObjectList>("ObjectList")({
  data: S.Array(AttioObject),
}) {}

/** @example ObjectResponse */
export class ObjectResponse extends S.Class<ObjectResponse>("ObjectResponse")({
  data: AttioObject,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListObjectsRequest */
export class ListObjectsRequest extends S.Class<ListObjectsRequest>("ListObjectsRequest")(
  {},
  T.all(T.Http({ method: "GET", uri: "/v2/objects" }), T.RestJsonProtocol())
) {}

/** @example GetObjectRequest */
export class GetObjectRequest extends S.Class<GetObjectRequest>("GetObjectRequest")(
  { object: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/objects/{object}" }), T.RestJsonProtocol())
) {}

/** @example CreateObjectRequest */
export class CreateObjectRequest extends S.Class<CreateObjectRequest>("CreateObjectRequest")(
  {
    api_slug: S.String,
    singular_noun: S.String,
    plural_noun: S.String,
  },
  T.all(T.Http({ method: "POST", uri: "/v2/objects", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example UpdateObjectRequest */
export class UpdateObjectRequest extends S.Class<UpdateObjectRequest>("UpdateObjectRequest")(
  {
    object: S.String.pipe(T.HttpLabel()),
    api_slug: S.optional(S.String),
    singular_noun: S.optional(S.String),
    plural_noun: S.optional(S.String),
  },
  T.all(T.Http({ method: "PATCH", uri: "/v2/objects/{object}", dataWrapper: true }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listObjectsOp: Operation = {
  input: ListObjectsRequest,
  output: ObjectList,
  errors: [...COMMON_ERRORS],
};

const getObjectOp: Operation = {
  input: GetObjectRequest,
  output: ObjectResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const createObjectOp: Operation = {
  input: CreateObjectRequest,
  output: ObjectResponse,
  errors: [...COMMON_ERRORS],
};

const updateObjectOp: Operation = {
  input: UpdateObjectRequest,
  output: ObjectResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listObjects */
export const listObjects: (
  input: ListObjectsRequest
) => Effect.Effect<ObjectList, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(listObjectsOp);

/** @example getObject */
export const getObject: (
  input: GetObjectRequest
) => Effect.Effect<ObjectResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getObjectOp);

/** @example createObject */
export const createObject: (
  input: CreateObjectRequest
) => Effect.Effect<ObjectResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(createObjectOp);

/** @example updateObject */
export const updateObject: (
  input: UpdateObjectRequest
) => Effect.Effect<ObjectResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(updateObjectOp);
