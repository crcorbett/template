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

/** @example SelfData */
export class SelfData extends S.Class<SelfData>("SelfData")({
  active_scopes: S.optional(S.Array(S.String)),
}) {}

/** @example SelfResponse */
export class SelfResponse extends S.Class<SelfResponse>("SelfResponse")({
  data: SelfData,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example GetSelfRequest */
export class GetSelfRequest extends S.Class<GetSelfRequest>("GetSelfRequest")(
  {},
  T.all(T.Http({ method: "GET", uri: "/v2/self" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const getSelfOp: Operation = {
  input: GetSelfRequest,
  output: SelfResponse,
  errors: [...COMMON_ERRORS],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example getSelf */
export const getSelf: (
  input: GetSelfRequest
) => Effect.Effect<SelfResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getSelfOp);
