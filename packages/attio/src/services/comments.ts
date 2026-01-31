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

/** @example AttioComment */
export class AttioComment extends S.Class<AttioComment>("AttioComment")({
  id: S.Unknown,
  author: S.optional(S.Unknown),
  content_plaintext: S.optional(S.NullOr(S.String)),
  format: S.optional(S.NullOr(S.String)),
  created_at: S.optional(S.String),
}) {}

/** @example CommentList */
export class CommentList extends S.Class<CommentList>("CommentList")({
  data: S.Array(AttioComment),
}) {}

/** @example CommentResponse */
export class CommentResponse extends S.Class<CommentResponse>("CommentResponse")({
  data: AttioComment,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example CreateCommentRequest */
export class CreateCommentRequest extends S.Class<CreateCommentRequest>("CreateCommentRequest")(
  {
    data: S.Unknown,
  },
  T.all(T.Http({ method: "POST", uri: "/v2/comments" }), T.RestJsonProtocol())
) {}

/** @example GetCommentRequest */
export class GetCommentRequest extends S.Class<GetCommentRequest>("GetCommentRequest")(
  { comment_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/comments/{comment_id}" }), T.RestJsonProtocol())
) {}

/** @example DeleteCommentRequest */
export class DeleteCommentRequest extends S.Class<DeleteCommentRequest>("DeleteCommentRequest")(
  { comment_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "DELETE", uri: "/v2/comments/{comment_id}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const createCommentOp: Operation = {
  input: CreateCommentRequest,
  output: CommentResponse,
  errors: [...COMMON_ERRORS],
};

const getCommentOp: Operation = {
  input: GetCommentRequest,
  output: CommentResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteCommentOp: Operation = {
  input: DeleteCommentRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example createComment */
export const createComment: (
  input: CreateCommentRequest
) => Effect.Effect<CommentResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(createCommentOp);

/** @example getComment */
export const getComment: (
  input: GetCommentRequest
) => Effect.Effect<CommentResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getCommentOp);

/** @example deleteComment */
export const deleteComment: (
  input: DeleteCommentRequest
) => Effect.Effect<{}, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteCommentOp);
