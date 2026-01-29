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
import { NoteId, ActorReference } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioNote */
export class AttioNote extends S.Class<AttioNote>("AttioNote")({
  id: NoteId,
  parent_object: S.optional(S.NullOr(S.String)),
  parent_record_id: S.optional(S.NullOr(S.String)),
  title: S.NullOr(S.String),
  content_plaintext: S.optional(S.NullOr(S.String)),
  format: S.optional(S.NullOr(S.String)),
  created_by_actor: S.optional(ActorReference),
  created_at: S.String,
}) {}

/** @example NoteList */
export class NoteList extends S.Class<NoteList>("NoteList")({
  data: S.Array(AttioNote),
}) {}

/** @example NoteResponse */
export class NoteResponse extends S.Class<NoteResponse>("NoteResponse")({
  data: AttioNote,
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListNotesRequest */
export class ListNotesRequest extends S.Class<ListNotesRequest>("ListNotesRequest")(
  {
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    offset: S.optional(S.Number).pipe(T.HttpQuery("offset")),
    parent_object: S.optional(S.String).pipe(T.HttpQuery("parent_object")),
    parent_record_id: S.optional(S.String).pipe(T.HttpQuery("parent_record_id")),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/notes" }), T.RestJsonProtocol())
) {}

/** @example CreateNoteRequest */
export class CreateNoteRequest extends S.Class<CreateNoteRequest>("CreateNoteRequest")(
  {
    parent_object: S.String,
    parent_record_id: S.String,
    title: S.String,
    format: S.optional(S.String),
    content: S.optional(S.String),
  },
  T.all(T.Http({ method: "POST", uri: "/v2/notes", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example GetNoteRequest */
export class GetNoteRequest extends S.Class<GetNoteRequest>("GetNoteRequest")(
  { note_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/notes/{note_id}" }), T.RestJsonProtocol())
) {}

/** @example DeleteNoteRequest */
export class DeleteNoteRequest extends S.Class<DeleteNoteRequest>("DeleteNoteRequest")(
  { note_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "DELETE", uri: "/v2/notes/{note_id}" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listNotesOp: PaginatedOperation = {
  input: ListNotesRequest,
  output: NoteList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "offset",
    inputToken: "offset",
    items: "data",
    pageSize: "limit",
  },
};

const createNoteOp: Operation = {
  input: CreateNoteRequest,
  output: NoteResponse,
  errors: [...COMMON_ERRORS],
};

const getNoteOp: Operation = {
  input: GetNoteRequest,
  output: NoteResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteNoteOp: Operation = {
  input: DeleteNoteRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listNotes */
export const listNotes: ((
  input: ListNotesRequest
) => Effect.Effect<NoteList, AttioErrorType, Deps>) & {
  pages: (input: ListNotesRequest) => Stream.Stream<NoteList, AttioErrorType, Deps>;
  items: (input: ListNotesRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(listNotesOp);

/** @example createNote */
export const createNote = /*@__PURE__*/ /*#__PURE__*/ makeClient(createNoteOp);

/** @example getNote */
export const getNote = /*@__PURE__*/ /*#__PURE__*/ makeClient(getNoteOp);

/** @example deleteNote */
export const deleteNote = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteNoteOp);
