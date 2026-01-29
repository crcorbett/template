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
import { WebhookId, WebhookSubscription } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioWebhook */
export class AttioWebhook extends S.Class<AttioWebhook>("AttioWebhook")({
  id: WebhookId,
  target_url: S.String,
  subscriptions: S.optional(S.Array(WebhookSubscription)),
  status: S.optional(S.NullOr(S.String)),
  created_at: S.optional(S.String),
}) {}

/** @example WebhookList */
export class WebhookList extends S.Class<WebhookList>("WebhookList")({
  data: S.Array(AttioWebhook),
}) {}

/** @example WebhookResponse */
export class WebhookResponse extends S.Class<WebhookResponse>("WebhookResponse")({
  data: AttioWebhook,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListWebhooksRequest */
export class ListWebhooksRequest extends S.Class<ListWebhooksRequest>("ListWebhooksRequest")(
  {
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/webhooks" }), T.RestJsonProtocol())
) {}

/** @example CreateWebhookRequest */
export class CreateWebhookRequest extends S.Class<CreateWebhookRequest>("CreateWebhookRequest")(
  {
    target_url: S.String,
    subscriptions: S.Array(S.Unknown),
  },
  T.all(T.Http({ method: "POST", uri: "/v2/webhooks" }), T.RestJsonProtocol())
) {}

/** @example GetWebhookRequest */
export class GetWebhookRequest extends S.Class<GetWebhookRequest>("GetWebhookRequest")(
  { webhook_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/webhooks/{webhook_id}" }), T.RestJsonProtocol())
) {}

/** @example UpdateWebhookRequest */
export class UpdateWebhookRequest extends S.Class<UpdateWebhookRequest>("UpdateWebhookRequest")(
  {
    webhook_id: S.String.pipe(T.HttpLabel()),
    target_url: S.optional(S.String),
    subscriptions: S.optional(S.Array(S.Unknown)),
  },
  T.all(T.Http({ method: "PATCH", uri: "/v2/webhooks/{webhook_id}" }), T.RestJsonProtocol())
) {}

/** @example DeleteWebhookRequest */
export class DeleteWebhookRequest extends S.Class<DeleteWebhookRequest>("DeleteWebhookRequest")(
  { webhook_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "DELETE", uri: "/v2/webhooks/{webhook_id}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listWebhooksOp: PaginatedOperation = {
  input: ListWebhooksRequest,
  output: WebhookList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "offset",
    inputToken: "offset",
    items: "data",
    pageSize: "limit",
  },
};

const createWebhookOp: Operation = {
  input: CreateWebhookRequest,
  output: WebhookResponse,
  errors: [...COMMON_ERRORS],
};

const getWebhookOp: Operation = {
  input: GetWebhookRequest,
  output: WebhookResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const updateWebhookOp: Operation = {
  input: UpdateWebhookRequest,
  output: WebhookResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteWebhookOp: Operation = {
  input: DeleteWebhookRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listWebhooks */
export const listWebhooks: ((
  input: ListWebhooksRequest
) => Effect.Effect<WebhookList, AttioErrorType, Deps>) & {
  pages: (input: ListWebhooksRequest) => Stream.Stream<WebhookList, AttioErrorType, Deps>;
  items: (input: ListWebhooksRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(listWebhooksOp);

/** @example createWebhook */
export const createWebhook = /*@__PURE__*/ /*#__PURE__*/ makeClient(createWebhookOp);

/** @example getWebhook */
export const getWebhook = /*@__PURE__*/ /*#__PURE__*/ makeClient(getWebhookOp);

/** @example updateWebhook */
export const updateWebhook = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateWebhookOp);

/** @example deleteWebhook */
export const deleteWebhook = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteWebhookOp);
