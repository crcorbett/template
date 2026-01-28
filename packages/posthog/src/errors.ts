/**
 * PostHog API Error Types
 *
 * Common error types for PostHog API operations.
 */

import * as S from "effect/Schema";

/**
 * Base error for unknown PostHog API errors.
 * Returned when the API returns an error code not in the operation's error list.
 */
export class UnknownPostHogError extends S.TaggedError<UnknownPostHogError>()(
  "UnknownPostHogError",
  {
    errorTag: S.String,
    errorData: S.optional(S.Unknown),
    message: S.optional(S.String),
  }
) {}

/**
 * Authentication error - Invalid or missing API key
 */
export class AuthenticationError extends S.TaggedError<AuthenticationError>()(
  "AuthenticationError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.String),
  }
) {}

/**
 * Authorization error - Valid API key but insufficient permissions
 */
export class AuthorizationError extends S.TaggedError<AuthorizationError>()(
  "AuthorizationError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.String),
  }
) {}

/**
 * Not found error - Resource does not exist
 */
export class NotFoundError extends S.TaggedError<NotFoundError>()(
  "NotFoundError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.String),
  }
) {}

/**
 * Validation error - Invalid request data
 */
export class ValidationError extends S.TaggedError<ValidationError>()(
  "ValidationError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.Unknown),
    errors: S.optional(S.Record({ key: S.String, value: S.Unknown })),
  }
) {}

/**
 * Rate limit error - Too many requests
 */
export class RateLimitError extends S.TaggedError<RateLimitError>()(
  "RateLimitError",
  {
    message: S.optional(S.String),
    detail: S.optional(S.String),
    retryAfter: S.optional(S.Number),
  }
) {}

/**
 * Server error - Internal PostHog server error
 */
export class ServerError extends S.TaggedError<ServerError>()("ServerError", {
  message: S.optional(S.String),
  detail: S.optional(S.String),
}) {}

/**
 * Missing HTTP trait error - Schema is missing required HTTP annotation
 * This is an internal error indicating a programming mistake.
 */
export class MissingHttpTraitError extends S.TaggedError<MissingHttpTraitError>()(
  "MissingHttpTraitError",
  {
    message: S.String,
  }
) {}

/**
 * Common errors that can occur on any operation
 */
export const COMMON_ERRORS = [
  AuthenticationError,
  AuthorizationError,
  NotFoundError,
  ValidationError,
  RateLimitError,
  ServerError,
] as const;

/**
 * Generic PostHog API error with code, message, and optional details
 */
export class PostHogError extends S.TaggedError<PostHogError>()(
  "PostHogError",
  {
    code: S.String,
    message: S.String,
    details: S.optional(S.Unknown),
  }
) {}

/**
 * Type alias for PostHogError instances
 */
export type PostHogErrorType =
  | PostHogError
  | UnknownPostHogError
  | AuthenticationError
  | AuthorizationError
  | NotFoundError
  | ValidationError
  | RateLimitError
  | ServerError
  | MissingHttpTraitError;
