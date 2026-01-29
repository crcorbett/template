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
import { TaskId, ActorReference, LinkedRecord, Assignee } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioTask */
export class AttioTask extends S.Class<AttioTask>("AttioTask")({
  id: TaskId,
  content_plaintext: S.optional(S.NullOr(S.String)),
  format: S.optional(S.NullOr(S.String)),
  deadline_at: S.optional(S.NullOr(S.String)),
  is_completed: S.optional(S.Boolean),
  linked_records: S.optional(S.Array(LinkedRecord)),
  assignees: S.optional(S.Array(Assignee)),
  created_by_actor: S.optional(ActorReference),
  created_at: S.String,
}) {}

/** @example TaskList */
export class TaskList extends S.Class<TaskList>("TaskList")({
  data: S.Array(AttioTask),
}) {}

/** @example TaskResponse */
export class TaskResponse extends S.Class<TaskResponse>("TaskResponse")({
  data: AttioTask,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListTasksRequest */
export class ListTasksRequest extends S.Class<ListTasksRequest>("ListTasksRequest")(
  {
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    linked_object: S.optional(S.String).pipe(T.HttpQuery("linked_object")),
    linked_record_id: S.optional(S.String).pipe(T.HttpQuery("linked_record_id")),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/tasks" }), T.RestJsonProtocol())
) {}

/** @example CreateTaskRequest */
export class CreateTaskRequest extends S.Class<CreateTaskRequest>("CreateTaskRequest")(
  {
    content: S.optional(S.String),
    format: S.optional(S.String),
    deadline_at: S.optional(S.NullOr(S.String)),
    is_completed: S.optional(S.Boolean),
    linked_records: S.optional(S.Array(S.Unknown)),
    assignees: S.optional(S.Array(S.Unknown)),
  },
  T.all(T.Http({ method: "POST", uri: "/v2/tasks", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example GetTaskRequest */
export class GetTaskRequest extends S.Class<GetTaskRequest>("GetTaskRequest")(
  { task_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/tasks/{task_id}" }), T.RestJsonProtocol())
) {}

/** @example UpdateTaskRequest */
export class UpdateTaskRequest extends S.Class<UpdateTaskRequest>("UpdateTaskRequest")(
  {
    task_id: S.String.pipe(T.HttpLabel()),
    content: S.optional(S.String),
    format: S.optional(S.String),
    deadline_at: S.optional(S.NullOr(S.String)),
    is_completed: S.optional(S.Boolean),
    linked_records: S.optional(S.Array(S.Unknown)),
    assignees: S.optional(S.Array(S.Unknown)),
  },
  T.all(T.Http({ method: "PATCH", uri: "/v2/tasks/{task_id}", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example DeleteTaskRequest */
export class DeleteTaskRequest extends S.Class<DeleteTaskRequest>("DeleteTaskRequest")(
  { task_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "DELETE", uri: "/v2/tasks/{task_id}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listTasksOp: PaginatedOperation = {
  input: ListTasksRequest,
  output: TaskList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "offset",
    inputToken: "offset",
    items: "data",
    pageSize: "limit",
  },
};

const createTaskOp: Operation = {
  input: CreateTaskRequest,
  output: TaskResponse,
  errors: [...COMMON_ERRORS],
};

const getTaskOp: Operation = {
  input: GetTaskRequest,
  output: TaskResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const updateTaskOp: Operation = {
  input: UpdateTaskRequest,
  output: TaskResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteTaskOp: Operation = {
  input: DeleteTaskRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listTasks */
export const listTasks: ((
  input: ListTasksRequest
) => Effect.Effect<TaskList, AttioErrorType, Deps>) & {
  pages: (input: ListTasksRequest) => Stream.Stream<TaskList, AttioErrorType, Deps>;
  items: (input: ListTasksRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(listTasksOp);

/** @example createTask */
export const createTask = /*@__PURE__*/ /*#__PURE__*/ makeClient(createTaskOp);

/** @example getTask */
export const getTask = /*@__PURE__*/ /*#__PURE__*/ makeClient(getTaskOp);

/** @example updateTask */
export const updateTask = /*@__PURE__*/ /*#__PURE__*/ makeClient(updateTaskOp);

/** @example deleteTask */
export const deleteTask = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteTaskOp);
