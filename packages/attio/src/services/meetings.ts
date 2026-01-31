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
import { MeetingId, CallRecordingId } from "../common.js";

// --- Response schemas ---

/** @section Response Schemas */

/** @example AttioMeeting */
export class AttioMeeting extends S.Class<AttioMeeting>("AttioMeeting")({
  id: MeetingId,
  title: S.optional(S.String),
  description: S.optional(S.NullOr(S.String)),
  is_all_day: S.optional(S.Boolean),
  start: S.optional(S.Unknown),
  end: S.optional(S.Unknown),
  participants: S.optional(S.Array(S.Unknown)),
  linked_records: S.optional(S.Array(S.Unknown)),
  created_at: S.optional(S.String),
  created_by_actor: S.optional(S.Unknown),
}) {}

/** @example MeetingList */
export class MeetingList extends S.Class<MeetingList>("MeetingList")({
  data: S.Array(AttioMeeting),
  pagination: S.optional(S.Struct({
    next_cursor: S.NullOr(S.String),
  })),
}) {}

/** @example MeetingResponse */
export class MeetingResponse extends S.Class<MeetingResponse>("MeetingResponse")({
  data: AttioMeeting,
}) {}

/** @example AttioCallRecording */
export class AttioCallRecording extends S.Class<AttioCallRecording>("AttioCallRecording")({
  id: CallRecordingId,
  status: S.optional(S.String),
  web_url: S.optional(S.String),
  created_by_actor: S.optional(S.Unknown),
}) {}

/** @example CallRecordingList */
export class CallRecordingList extends S.Class<CallRecordingList>("CallRecordingList")({
  data: S.Array(AttioCallRecording),
}) {}

/** @example CallRecordingResponse */
export class CallRecordingResponse extends S.Class<CallRecordingResponse>("CallRecordingResponse")({
  data: AttioCallRecording,
}) {}

/** @example TranscriptResponse */
export class TranscriptResponse extends S.Class<TranscriptResponse>("TranscriptResponse")({
  data: S.Struct({
    id: S.optional(S.Unknown),
    transcript: S.optional(S.Array(S.Unknown)),
  }),
}) {}

// --- Request schemas ---

/** @section Request Schemas */

/** @example ListMeetingsRequest */
export class ListMeetingsRequest extends S.Class<ListMeetingsRequest>("ListMeetingsRequest")(
  {
    limit: S.optional(S.Number).pipe(T.HttpQuery("limit")),
    cursor: S.optional(S.String).pipe(T.HttpQuery("cursor")),
    linked_object: S.optional(S.String).pipe(T.HttpQuery("linked_object")),
    linked_record_id: S.optional(S.String).pipe(T.HttpQuery("linked_record_id")),
    participants: S.optional(S.String).pipe(T.HttpQuery("participants")),
    sort: S.optional(S.String).pipe(T.HttpQuery("sort")),
    ends_from: S.optional(S.String).pipe(T.HttpQuery("ends_from")),
    starts_before: S.optional(S.String).pipe(T.HttpQuery("starts_before")),
    timezone: S.optional(S.String).pipe(T.HttpQuery("timezone")),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/meetings" }), T.RestJsonProtocol())
) {}

/** @example CreateMeetingRequest */
export class CreateMeetingRequest extends S.Class<CreateMeetingRequest>("CreateMeetingRequest")(
  {
    title: S.String,
    description: S.optional(S.String),
    start: S.Unknown,
    end: S.Unknown,
    participants: S.optional(S.Array(S.Unknown)),
    linked_records: S.optional(S.Array(S.Unknown)),
    is_all_day: S.optional(S.Boolean),
  },
  T.all(T.Http({ method: "POST", uri: "/v2/meetings", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example GetMeetingRequest */
export class GetMeetingRequest extends S.Class<GetMeetingRequest>("GetMeetingRequest")(
  { meeting_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/meetings/{meeting_id}" }), T.RestJsonProtocol())
) {}

/** @example ListCallRecordingsRequest */
export class ListCallRecordingsRequest extends S.Class<ListCallRecordingsRequest>("ListCallRecordingsRequest")(
  { meeting_id: S.String.pipe(T.HttpLabel()) },
  T.all(T.Http({ method: "GET", uri: "/v2/meetings/{meeting_id}/call_recordings" }), T.RestJsonProtocol())
) {}

/** @example CreateCallRecordingRequest */
export class CreateCallRecordingRequest extends S.Class<CreateCallRecordingRequest>("CreateCallRecordingRequest")(
  {
    meeting_id: S.String.pipe(T.HttpLabel()),
    video_url: S.String,
  },
  T.all(T.Http({ method: "POST", uri: "/v2/meetings/{meeting_id}/call_recordings", dataWrapper: true }), T.RestJsonProtocol())
) {}

/** @example GetCallRecordingRequest */
export class GetCallRecordingRequest extends S.Class<GetCallRecordingRequest>("GetCallRecordingRequest")(
  {
    meeting_id: S.String.pipe(T.HttpLabel()),
    call_recording_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/meetings/{meeting_id}/call_recordings/{call_recording_id}" }), T.RestJsonProtocol())
) {}

/** @example DeleteCallRecordingRequest */
export class DeleteCallRecordingRequest extends S.Class<DeleteCallRecordingRequest>("DeleteCallRecordingRequest")(
  {
    meeting_id: S.String.pipe(T.HttpLabel()),
    call_recording_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(T.Http({ method: "DELETE", uri: "/v2/meetings/{meeting_id}/call_recordings/{call_recording_id}" }), T.RestJsonProtocol())
) {}

/** @example GetTranscriptRequest */
export class GetTranscriptRequest extends S.Class<GetTranscriptRequest>("GetTranscriptRequest")(
  {
    meeting_id: S.String.pipe(T.HttpLabel()),
    call_recording_id: S.String.pipe(T.HttpLabel()),
  },
  T.all(T.Http({ method: "GET", uri: "/v2/meetings/{meeting_id}/call_recordings/{call_recording_id}/transcript" }), T.RestJsonProtocol())
) {}

// --- Operations ---

const listMeetingsOp: PaginatedOperation = {
  input: ListMeetingsRequest,
  output: MeetingList,
  errors: [...COMMON_ERRORS],
  pagination: {
    mode: "cursor",
    inputToken: "cursor",
    outputToken: "pagination.next_cursor",
    items: "data",
    pageSize: "limit",
  },
};

const createMeetingOp: Operation = {
  input: CreateMeetingRequest,
  output: MeetingResponse,
  errors: [...COMMON_ERRORS],
};

const getMeetingOp: Operation = {
  input: GetMeetingRequest,
  output: MeetingResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const listCallRecordingsOp: Operation = {
  input: ListCallRecordingsRequest,
  output: CallRecordingList,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const createCallRecordingOp: Operation = {
  input: CreateCallRecordingRequest,
  output: CallRecordingResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const getCallRecordingOp: Operation = {
  input: GetCallRecordingRequest,
  output: CallRecordingResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const deleteCallRecordingOp: Operation = {
  input: DeleteCallRecordingRequest,
  output: S.Struct({}),
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

const getTranscriptOp: Operation = {
  input: GetTranscriptRequest,
  output: TranscriptResponse,
  errors: [...COMMON_ERRORS_WITH_NOT_FOUND],
};

// --- Exports ---

type Deps = HttpClient.HttpClient | Credentials | Endpoint;

/** @section Client Functions */

/** @example listMeetings */
export const listMeetings: ((
  input: ListMeetingsRequest
) => Effect.Effect<MeetingList, AttioErrorType, Deps>) & {
  pages: (input: ListMeetingsRequest) => Stream.Stream<MeetingList, AttioErrorType, Deps>;
  items: (input: ListMeetingsRequest) => Stream.Stream<unknown, AttioErrorType, Deps>;
} = /*@__PURE__*/ /*#__PURE__*/ makePaginated(listMeetingsOp);

/** @example createMeeting */
export const createMeeting = /*@__PURE__*/ /*#__PURE__*/ makeClient(createMeetingOp);

/** @example getMeeting */
export const getMeeting = /*@__PURE__*/ /*#__PURE__*/ makeClient(getMeetingOp);

/** @example listCallRecordings */
export const listCallRecordings = /*@__PURE__*/ /*#__PURE__*/ makeClient(listCallRecordingsOp);

/** @example createCallRecording */
export const createCallRecording = /*@__PURE__*/ /*#__PURE__*/ makeClient(createCallRecordingOp);

/** @example getCallRecording */
export const getCallRecording = /*@__PURE__*/ /*#__PURE__*/ makeClient(getCallRecordingOp);

/** @example deleteCallRecording */
export const deleteCallRecording = /*@__PURE__*/ /*#__PURE__*/ makeClient(deleteCallRecordingOp);

/** @example getTranscript */
export const getTranscript = /*@__PURE__*/ /*#__PURE__*/ makeClient(getTranscriptOp);
