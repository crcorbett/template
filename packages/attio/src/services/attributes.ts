import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { Operation } from "../client/operation.js";
import { makeClient } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioAttribute */
export class AttioAttribute extends S.Class<AttioAttribute>("AttioAttribute")({
  id: S.Unknown,
  title: S.NullOr(S.String),
  description: S.optional(S.NullOr(S.String)),
  api_slug: S.NullOr(S.String),
  type: S.NullOr(S.String),
  is_required: S.optional(S.Boolean),
  is_unique: S.optional(S.Boolean),
  is_multiselect: S.optional(S.Boolean),
}) {}

/** @example AttributeList */
export class AttributeList extends S.Class<AttributeList>("AttributeList")({
  data: S.Array(AttioAttribute),
}) {}

/** @example AttributeResponse */
export class AttributeResponse extends S.Class<AttributeResponse>("AttributeResponse")({
  data: AttioAttribute,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListAttributesRequest */
export class ListAttributesRequest extends S.Class<ListAttributesRequest>("ListAttributesRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/{target}/{identifier}/attributes" }),
    T.RestJsonProtocol()
  )
) {}

/** @example CreateAttributeRequest */
export class CreateAttributeRequest extends S.Class<CreateAttributeRequest>("CreateAttributeRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    title: S.String,
    type: S.String,
    description: S.optional(S.String),
    is_required: S.optional(S.Boolean),
    is_unique: S.optional(S.Boolean),
    is_multiselect: S.optional(S.Boolean),
    api_slug: S.optional(S.String),
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/{target}/{identifier}/attributes" }),
    T.RestJsonProtocol()
  )
) {}

/** @example GetAttributeRequest */
export class GetAttributeRequest extends S.Class<GetAttributeRequest>("GetAttributeRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/{target}/{identifier}/attributes/{attribute}" }),
    T.RestJsonProtocol()
  )
) {}

/** @example UpdateAttributeRequest */
export class UpdateAttributeRequest extends S.Class<UpdateAttributeRequest>("UpdateAttributeRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
    title: S.optional(S.String),
    description: S.optional(S.String),
    is_required: S.optional(S.Boolean),
    is_unique: S.optional(S.Boolean),
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/v2/{target}/{identifier}/attributes/{attribute}" }),
    T.RestJsonProtocol()
  )
) {}

// --- Operations ---

const listAttributesOp: Operation = {
  input: ListAttributesRequest,
  output: AttributeList,
  errors: [...COMMON_ERRORS],
};

const createAttributeOp: Operation = {
  input: CreateAttributeRequest,
  output: AttributeResponse,
  errors: [...COMMON_ERRORS],
};

const getAttributeOp: Operation = {
  input: GetAttributeRequest,
  output: AttributeResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const updateAttributeOp: Operation = {
  input: UpdateAttributeRequest,
  output: AttributeResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listAttributes */
export const listAttributes: (
  input: ListAttributesRequest
) => Effect.Effect<AttributeList, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(listAttributesOp);

/** @example createAttribute */
export const createAttribute: (
  input: CreateAttributeRequest
) => Effect.Effect<AttributeResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(createAttributeOp);

/** @example getAttribute */
export const getAttribute: (
  input: GetAttributeRequest
) => Effect.Effect<AttributeResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getAttributeOp);

/** @example updateAttribute */
export const updateAttribute: (
  input: UpdateAttributeRequest
) => Effect.Effect<AttributeResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(updateAttributeOp);
