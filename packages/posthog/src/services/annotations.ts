import type { HttpClient } from "@effect/platform";
import type * as Effect from "effect/Effect";
import * as S from "effect/Schema";

import type { Operation } from "../client/operation.js";

import { makeClient } from "../client/api.js";
import { UserBasic } from "../common.js";
import type { Credentials } from "../credentials.js";
import type { Endpoint } from "../endpoint.js";
import {
  COMMON_ERRORS,
  COMMON_ERRORS_WITH_NOT_FOUND,
  type PostHogErrorType,
} from "../errors.js";
import * as T from "../traits.js";

// Annotation scope enum
export const AnnotationScopeEnum = S.Literal(
  "dashboard_item",
  "dashboard",
  "project",
  "organization",
  "recording"
);
export type AnnotationScope = S.Schema.Type<typeof AnnotationScopeEnum>;

// Creation type enum
export const CreationTypeEnum = S.Literal("USR", "GIT");
export type CreationType = S.Schema.Type<typeof CreationTypeEnum>;

export { UserBasic } from "../common.js";

export class Annotation extends S.Class<Annotation>("Annotation")({
  id: S.Number,
  content: S.optional(S.NullOr(S.String)),
  date_marker: S.optional(S.NullOr(S.String)),
  creation_type: S.optional(CreationTypeEnum),
  dashboard_item: S.optional(S.NullOr(S.Number)),
  dashboard_id: S.optional(S.NullOr(S.Number)),
  dashboard_name: S.optional(S.NullOr(S.String)),
  insight_short_id: S.optional(S.NullOr(S.String)),
  insight_name: S.optional(S.NullOr(S.String)),
  insight_derived_name: S.optional(S.NullOr(S.String)),
  created_by: S.optional(S.NullOr(UserBasic)),
  created_at: S.optional(S.NullOr(S.String)),
  updated_at: S.optional(S.String),
  deleted: S.optional(S.Boolean),
  scope: S.optional(AnnotationScopeEnum),
}) {}

export class AnnotationBasic extends S.Class<AnnotationBasic>(
  "AnnotationBasic"
)({
  id: S.Number,
  content: S.optional(S.NullOr(S.String)),
  date_marker: S.optional(S.NullOr(S.String)),
  scope: S.optional(AnnotationScopeEnum),
  created_at: S.optional(S.NullOr(S.String)),
  deleted: S.optional(S.Boolean),
}) {}

export class PaginatedAnnotationList extends S.Class<PaginatedAnnotationList>(
  "PaginatedAnnotationList"
)({
  count: S.optional(S.Number),
  next: S.optional(S.NullOr(S.String)),
  previous: S.optional(S.NullOr(S.String)),
  results: S.Array(Annotation),
}) {}

export class ListAnnotationsRequest extends S.Class<ListAnnotationsRequest>(
  "ListAnnotationsRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    search: S.optional(S.String).pipe(T.HttpQuery("search")),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/annotations/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class GetAnnotationRequest extends S.Class<GetAnnotationRequest>(
  "GetAnnotationRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "GET",
      uri: "/api/projects/{project_id}/annotations/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class CreateAnnotationRequest extends S.Class<CreateAnnotationRequest>(
  "CreateAnnotationRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    content: S.optional(S.NullOr(S.String)),
    date_marker: S.optional(S.NullOr(S.String)),
    creation_type: S.optional(CreationTypeEnum),
    dashboard_item: S.optional(S.NullOr(S.Number)),
    scope: S.optional(AnnotationScopeEnum),
  },
  T.all(
    T.Http({
      method: "POST",
      uri: "/api/projects/{project_id}/annotations/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class UpdateAnnotationRequest extends S.Class<UpdateAnnotationRequest>(
  "UpdateAnnotationRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
    content: S.optional(S.NullOr(S.String)),
    date_marker: S.optional(S.NullOr(S.String)),
    scope: S.optional(AnnotationScopeEnum),
    deleted: S.optional(S.Boolean),
  },
  T.all(
    T.Http({
      method: "PATCH",
      uri: "/api/projects/{project_id}/annotations/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

export class DeleteAnnotationRequest extends S.Class<DeleteAnnotationRequest>(
  "DeleteAnnotationRequest"
)(
  {
    project_id: S.String.pipe(T.HttpLabel()),
    id: S.Number.pipe(T.HttpLabel()),
  },
  T.all(
    T.Http({
      method: "DELETE",
      uri: "/api/projects/{project_id}/annotations/{id}/",
    }),
    T.RestJsonProtocol()
  )
) {}

// Void response for delete
const VoidResponse = S.Struct({});

const listAnnotationsOperation: Operation = {
  input: ListAnnotationsRequest,
  output: PaginatedAnnotationList,
  errors: [...COMMON_ERRORS],
  pagination: { inputToken: "offset", outputToken: "next", items: "results", pageSize: "limit" },
};

const getAnnotationOperation: Operation = {
  input: GetAnnotationRequest,
  output: Annotation,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const createAnnotationOperation: Operation = {
  input: CreateAnnotationRequest,
  output: Annotation,
  errors: [...COMMON_ERRORS],
};

const updateAnnotationOperation: Operation = {
  input: UpdateAnnotationRequest,
  output: Annotation,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteAnnotationOperation: Operation = {
  input: DeleteAnnotationRequest,
  output: VoidResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

/** Dependencies required by all annotation operations. */
type Deps = HttpClient.HttpClient | Credentials | Endpoint;

export const listAnnotations: (
  input: ListAnnotationsRequest
) => Effect.Effect<PaginatedAnnotationList, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(listAnnotationsOperation);

export const getAnnotation: (
  input: GetAnnotationRequest
) => Effect.Effect<Annotation, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(getAnnotationOperation);

export const createAnnotation: (
  input: CreateAnnotationRequest
) => Effect.Effect<Annotation, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(createAnnotationOperation);

export const updateAnnotation: (
  input: UpdateAnnotationRequest
) => Effect.Effect<Annotation, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateAnnotationOperation);

export const deleteAnnotation: (
  input: DeleteAnnotationRequest
) => Effect.Effect<{}, PostHogErrorType, Deps> = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteAnnotationOperation);
