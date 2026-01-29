import * as S from "effect/Schema";

import {
  withAuthError,
  withNotFoundError,
  withServerError,
  withThrottlingError,
  withValidationError,
} from "./category.js";

/** Base error for unknown Attio API errors */
export class UnknownAttioError extends S.TaggedError<UnknownAttioError>()(
  "UnknownAttioError",
  {
    errorTag: S.String,
    errorData: S.optional(S.Unknown),
    message: S.optional(S.String),
  }
) {}

/** Authentication error — Invalid or missing API key (401) */
export class AuthenticationError extends S.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withAuthError) {}

/** Authorization error — Valid key but insufficient scopes (403) */
export class AuthorizationError extends S.TaggedError<AuthorizationError>()(
  "AuthorizationError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withAuthError) {}

/** Not found error — Resource does not exist (404) */
export class NotFoundError extends S.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withNotFoundError) {}

/** Validation error — Invalid request data (400) */
export class ValidationError extends S.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withValidationError) {}

/** Conflict error — Unique attribute violation (409). Attio-specific. */
export class ConflictError extends S.TaggedError<ConflictError>()(
  "ConflictError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withValidationError) {}

/** Rate limit error — Too many requests (429) */
export class RateLimitError extends S.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
    retryAfter: S.optional(S.Number),
  }
).pipe(withThrottlingError) {}

/** Server error — Internal Attio server error (500) */
export class ServerError extends S.TaggedError<ServerError>()(
  "ServerError",
  {
    message: S.optional(S.String),
    type: S.optional(S.String),
    code: S.optional(S.String),
  }
).pipe(withServerError) {}

/** Missing HTTP trait error — Schema programming mistake */
export class MissingHttpTraitError extends S.TaggedError<MissingHttpTraitError>()(
  "MissingHttpTraitError",
  { message: S.String }
) {}

/** Missing credentials error — Env var not set */
export class MissingCredentialsError extends S.TaggedError<MissingCredentialsError>()(
  "MissingCredentialsError",
  { message: S.String }
) {}

/** Common errors for list/create operations */
export const COMMON_ERRORS = [
  AuthenticationError,
  AuthorizationError,
  ValidationError,
  RateLimitError,
  ServerError,
] as const;

/** Common errors for get/update/delete (adds NotFoundError) */
export const COMMON_ERRORS_WITH_NOT_FOUND = [
  ...COMMON_ERRORS,
  NotFoundError,
] as const;

/** Common errors for assert/upsert operations (adds ConflictError) */
export const COMMON_ERRORS_WITH_CONFLICT = [
  ...COMMON_ERRORS,
  ConflictError,
] as const;

/** Generic Attio API error with code, message, and optional details */
export class AttioError extends S.TaggedError<AttioError>()(
  "AttioError",
  {
    code: S.String,
    message: S.String,
    details: S.optional(S.Unknown),
  }
) {}

/** Union of all error types */
export type AttioErrorType =
  | AttioError
  | UnknownAttioError
  | AuthenticationError
  | AuthorizationError
  | NotFoundError
  | ValidationError
  | ConflictError
  | RateLimitError
  | ServerError
  | MissingHttpTraitError
  | MissingCredentialsError;
