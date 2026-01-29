import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { Operation } from "../client/operation.js";
import { makeClient } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example SelectOption */
export class SelectOption extends S.Class<SelectOption>("SelectOption")({
  id: S.Unknown,
  title: S.NullOr(S.String),
  is_archived: S.optional(S.Boolean),
}) {}

/** @example SelectOptionList */
export class SelectOptionList extends S.Class<SelectOptionList>("SelectOptionList")({
  data: S.Array(SelectOption),
}) {}

/** @example SelectOptionResponse */
export class SelectOptionResponse extends S.Class<SelectOptionResponse>("SelectOptionResponse")({
  data: SelectOption,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListSelectOptionsRequest */
export class ListSelectOptionsRequest extends S.Class<ListSelectOptionsRequest>("ListSelectOptionsRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({ method: "GET", uri: "/v2/{target}/{identifier}/attributes/{attribute}/options" }),
    T.RestJsonProtocol()
  )
) {}

/** @example CreateSelectOptionRequest */
export class CreateSelectOptionRequest extends S.Class<CreateSelectOptionRequest>("CreateSelectOptionRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
    title: S.String,
  },
  T.all(
    T.Http({ method: "POST", uri: "/v2/{target}/{identifier}/attributes/{attribute}/options", dataWrapper: true }),
    T.RestJsonProtocol()
  )
) {}

/** @example UpdateSelectOptionRequest */
export class UpdateSelectOptionRequest extends S.Class<UpdateSelectOptionRequest>("UpdateSelectOptionRequest")(
  {
    target: S.String.pipe(T.HttpLabel()),
    identifier: S.String.pipe(T.HttpLabel()),
    attribute: S.String.pipe(T.HttpLabel()),
    option: S.String.pipe(T.HttpLabel()),
    title: S.optional(S.String),
    is_archived: S.optional(S.Boolean),
  },
  T.all(
    T.Http({ method: "PATCH", uri: "/v2/{target}/{identifier}/attributes/{attribute}/options/{option}", dataWrapper: true }),
    T.RestJsonProtocol()
  )
) {}

// --- Operations ---

const listSelectOptionsOp: Operation = {
  input: ListSelectOptionsRequest,
  output: SelectOptionList,
  errors: [...COMMON_ERRORS],
};

const createSelectOptionOp: Operation = {
  input: CreateSelectOptionRequest,
  output: SelectOptionResponse,
  errors: [...COMMON_ERRORS],
};

const updateSelectOptionOp: Operation = {
  input: UpdateSelectOptionRequest,
  output: SelectOptionResponse,
  errors: [...COMMON_ERRORS],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listSelectOptions */
export const listSelectOptions: (
  input: ListSelectOptionsRequest
) => Effect.Effect<SelectOptionList, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(listSelectOptionsOp);

/** @example createSelectOption */
export const createSelectOption: (
  input: CreateSelectOptionRequest
) => Effect.Effect<SelectOptionResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(createSelectOptionOp);

/** @example updateSelectOption */
export const updateSelectOption: (
  input: UpdateSelectOptionRequest
) => Effect.Effect<SelectOptionResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(updateSelectOptionOp);
