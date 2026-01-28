import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import type { PostHogErrorType } from "../errors.js";
import * as T from "../traits.js";

// URL matching type for action steps
export const UrlMatchingEnum = S.Literal("contains", "regex", "exact");
export type UrlMatching = S.Schema.Type<typeof UrlMatchingEnum>;

export class ActionStepProperty extends S.Class<ActionStepProperty>(
  "ActionStepProperty"
)({
  key: S.optional(S.String),
  value: S.optional(S.Unknown),
  operator: S.optional(S.String),
  type: S.optional(S.String),
}) {}

export class ActionStep extends S.Class<ActionStep>("ActionStep")({
  event: S.optional(S.NullOr(S.String)),
  properties: S.optional(S.NullOr(S.Array(ActionStepProperty))),
  selector: S.optional(S.NullOr(S.String)),
  tag_name: S.optional(S.NullOr(S.String)),
  text: S.optional(S.NullOr(S.String)),
  text_matching: S.optional(S.NullOr(UrlMatchingEnum)),
  href: S.optional(S.NullOr(S.String)),
  href_matching: S.optional(S.NullOr(UrlMatchingEnum)),
  url: S.optional(S.NullOr(S.String)),
  url_matching: S.optional(S.NullOr(UrlMatchingEnum)),
}) {}

export { UserBasic } from "../common.js";

export class Action extends S.Class<Action>("Action")({
  id: S.Number,
  name: S.NullOr(S.String),
  description: S.optional(S.String),
  tags: S.optional(S.Array(S.String)),
  post_to_slack: S.optional(S.Boolean),
  slack_message_format: S.optional(S.String),
  steps: S.optional(S.Array(ActionStep)),
  created_at: S.optional(S.String),
  created_by: S.optional(S.NullOr(UserBasic)),
  deleted: S.optional(S.Boolean),
  is_calculating: S.optional(S.Boolean),
  last_calculated_at: S.optional(S.NullOr(S.String)),
  team_id: S.optional(S.Number),
  is_action: S.optional(S.Boolean),
  pinned_at: S.optional(S.NullOr(S.String)),
}) {}

export class ActionBasic extends S.Class<ActionBasic>("ActionBasic")({
  id: S.Number,
  name: S.NullOr(S.String),
  description: S.optional(S.String),
  tags: S.optional(S.Array(S.String)),
  deleted: S.optional(S.Boolean),
  created_at: S.optional(S.String),
}) {}

export class PaginatedActionList extends S.Class<PaginatedActionList>(
  "PaginatedActionList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Action),
}) {}

export class ListActionsRequest extends S.Class<ListActionsRequest>(
  "ListActionsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/actions/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class GetActionRequest extends S.Class<GetActionRequest>(
  "GetActionRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/actions/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateActionRequest extends S.Class<CreateActionRequest>(
  "CreateActionRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    name: S.NullOr(S.String),
    description: S.optional(S.String),
    tags: S.optional(S.Array(S.String)),
    post_to_slack: S.optional(S.Boolean),
    slack_message_format: S.optional(S.String),
    steps: S.optional(S.Array(ActionStep)),
  },
  T.all(
    T.Http({
      method: "POST",
      uri: "/api/projects/{project_id}/actions/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateActionRequest extends S.Class<UpdateActionRequest>(
  "UpdateActionRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    name: S.optional(S.NullOr(S.String)),
    description: S.optional(S.String),
    tags: S.optional(S.Array(S.String)),
    post_to_slack: S.optional(S.Boolean),
    slack_message_format: S.optional(S.String),
    steps: S.optional(S.Array(ActionStep)),
    deleted: S.optional(S.Boolean),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/projects/{project_id}/actions/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteActionRequest extends S.Class<DeleteActionRequest>(
  "DeleteActionRequest"
)({
  project_id: S.String,
  id: S.Number,
}) {}

const listActionsOperation: Operation = {
  input: ListActionsRequest,
  output: PaginatedActionList,
  errors: [],
};

const getActionOperation: Operation = {
  input: GetActionRequest,
  output: Action,
  errors: [],
};

const createActionOperation: Operation = {
  input: CreateActionRequest,
  output: Action,
  errors: [],
};

const updateActionOperation: Operation = {
  input: UpdateActionRequest,
  output: Action,
  errors: [],
};

/** Dependencies required by all action operations. */
type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listActions: (
  input: ListActionsRequest
) => Effect.Effect<PaginatedActionList, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(listActionsOperation);

export const getAction: (
  input: GetActionRequest
) => Effect.Effect<Action, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(getActionOperation);

export const createAction: (
  input: CreateActionRequest
) => Effect.Effect<Action, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(createActionOperation);

export const updateAction: (
  input: UpdateActionRequest
) => Effect.Effect<Action, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateActionOperation);

// Delete via soft-delete (marking as deleted: true)
export const deleteAction: (
  input: DeleteActionRequest
) => Effect.Effect<Action, PostHogErrorType, Deps> = (input) =>
  updateAction({
    project_id: input.project_id,
    id: input.id,
    deleted: true,
  });
