// Core
export { Credentials, type AttioCredentials } from "./credentials.js";
export { Endpoint } from "./endpoint.js";

// Client utilities
export { makePaginated } from "./client/api.js";

// Shared schemas
export {
  ActorReference,
  Assignee,
  CallRecordingId,
  EntryId,
  LinkedRecord,
  ListId,
  MeetingId,
  NoteId,
  NoteTag,
  ObjectId,
  RecordId,
  StatusId,
  TaskId,
  ThreadId,
  WebhookId,
  WebhookSubscription,
  WorkspaceMemberId,
} from "./common.js";

// Error types
export {
  AttioError,
  type AttioErrorType,
  AuthenticationError,
  AuthorizationError,
  COMMON_ERRORS,
  COMMON_ERRORS_WITH_CONFLICT,
  COMMON_ERRORS_WITH_NOT_FOUND,
  ConflictError,
  MissingCredentialsError,
  MissingHttpTraitError,
  NotFoundError,
  RateLimitError,
  ServerError,
  UnknownAttioError,
  ValidationError,
} from "./errors.js";

// Error categories
export * as Category from "./category.js";

// Retry policies
export * as Retry from "./retry.js";

// Trait annotations
export * as Traits from "./traits.js";

// Services (each as a namespace)
export * as Objects from "./services/objects.js";
export * as Records from "./services/records.js";
export * as Lists from "./services/lists.js";
export * as Entries from "./services/entries.js";
export * as Attributes from "./services/attributes.js";
export * as SelectOptions from "./services/select-options.js";
export * as Notes from "./services/notes.js";
export * as Tasks from "./services/tasks.js";
export * as Comments from "./services/comments.js";
export * as Webhooks from "./services/webhooks.js";
export * as WorkspaceMembers from "./services/workspace-members.js";
export * as Self from "./services/self.js";
export * as Threads from "./services/threads.js";
export * as Statuses from "./services/statuses.js";
export * as Meetings from "./services/meetings.js";
