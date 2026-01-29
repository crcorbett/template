import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";
import type { Operation } from "../client/operation.js";
import { makeClient } from "../client/api.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import { COMMON_ERRORS, COMMON_ERRORS_WITH_NOT_FOUND, type AttioErrorType } from "../errors.js";
import * as T from "../traits.js";
import { WorkspaceMemberId } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example WorkspaceMember */
export class WorkspaceMember extends S.Class<WorkspaceMember>("WorkspaceMember")({
  id: WorkspaceMemberId,
  first_name: S.optional(S.NullOr(S.String)),
  last_name: S.optional(S.NullOr(S.String)),
  avatar_url: S.optional(S.NullOr(S.String)),
  email_address: S.optional(S.NullOr(S.String)),
  created_at: S.optional(S.String),
  access_level: S.optional(S.NullOr(S.String)),
}) {}

/** @example WorkspaceMemberList */
export class WorkspaceMemberList extends S.Class<WorkspaceMemberList>("WorkspaceMemberList")({
  data: S.Array(WorkspaceMember),
}) {}

/** @example WorkspaceMemberResponse */
export class WorkspaceMemberResponse extends S.Class<WorkspaceMemberResponse>("WorkspaceMemberResponse")({
  data: WorkspaceMember,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListWorkspaceMembersRequest */
export class ListWorkspaceMembersRequest extends S.Class<ListWorkspaceMembersRequest>("ListWorkspaceMembersRequest")(
  {},
  T.all(T.Http({ method: "GET", uri: "/v2/workspace_members" }), T.RestJsonProtocol())
) {}

/** @example GetWorkspaceMemberRequest */
export class GetWorkspaceMemberRequest extends S.Class<GetWorkspaceMemberRequest>("GetWorkspaceMemberRequest")(
  { workspace_member_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/workspace_members/{workspace_member_id}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listWorkspaceMembersOp: Operation = {
  input: ListWorkspaceMembersRequest,
  output: WorkspaceMemberList,
  errors: [...COMMON_ERRORS],
};

const getWorkspaceMemberOp: Operation = {
  input: GetWorkspaceMemberRequest,
  output: WorkspaceMemberResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listWorkspaceMembers */
export const listWorkspaceMembers: (
  input: ListWorkspaceMembersRequest
) => Effect.Effect<WorkspaceMemberList, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(listWorkspaceMembersOp);

/** @example getWorkspaceMember */
export const getWorkspaceMember: (
  input: GetWorkspaceMemberRequest
) => Effect.Effect<WorkspaceMemberResponse, AttioErrorType, Deps> =
  /*@__PURE__*/ /*#__PURE__*/ makeClient(getWorkspaceMemberOp);
