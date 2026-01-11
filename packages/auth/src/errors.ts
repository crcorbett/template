/**
 * Typed Effect errors for auth domain
 *
 * All errors use Data.TaggedError for type-safe error handling.
 * Errors are matchable with Effect.match/Match module for exhaustive handling.
 */
import type {
  AuthProvider,
  PermissionString,
  RoleName,
  UserId,
} from "@packages/types";

import { Data } from "effect";

// =============================================================================
// Authentication Errors
// =============================================================================

/**
 * Error thrown when session validation fails
 * Used for malformed session data or validation failures
 */
export class SessionValidationError extends Data.TaggedError(
  "SessionValidationError"
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when no active session exists
 */
export class NoSessionError extends Data.TaggedError("NoSessionError")<{
  readonly message: string;
}> {}

/**
 * Error thrown when session has expired
 */
export class SessionExpiredError extends Data.TaggedError(
  "SessionExpiredError"
)<{
  readonly sessionId: string;
  readonly expiredAt: Date;
  readonly message: string;
}> {}

/**
 * Error thrown when token validation fails
 */
export class InvalidTokenError extends Data.TaggedError("InvalidTokenError")<{
  readonly message: string;
  readonly tokenType: "session" | "access" | "refresh";
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when user lookup fails
 */
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly userId: UserId;
  readonly message: string;
}> {}

/**
 * Error thrown when session not found in database
 */
export class SessionNotFoundError extends Data.TaggedError(
  "SessionNotFoundError"
)<{
  readonly sessionId: string;
  readonly message: string;
}> {}

/**
 * Error thrown when session database operations fail
 */
export class SessionDatabaseError extends Data.TaggedError(
  "SessionDatabaseError"
)<{
  readonly operation: "create" | "read" | "update" | "delete" | "refresh";
  readonly message: string;
  readonly cause?: unknown;
}> {}

// =============================================================================
// Authorization Errors
// =============================================================================

/**
 * Error thrown when user lacks required role
 */
export class InsufficientRoleError extends Data.TaggedError(
  "InsufficientRoleError"
)<{
  readonly userId: UserId;
  readonly requiredRole: RoleName;
  readonly userRoles: readonly RoleName[];
  readonly message: string;
}> {}

/**
 * Error thrown when user lacks required permission
 */
export class InsufficientPermissionError extends Data.TaggedError(
  "InsufficientPermissionError"
)<{
  readonly userId: UserId;
  readonly requiredPermission: PermissionString;
  readonly userPermissions: readonly PermissionString[];
  readonly message: string;
}> {}

// =============================================================================
// OAuth Errors
// =============================================================================

/**
 * Error thrown when OAuth authorization fails
 */
export class OAuthAuthorizationError extends Data.TaggedError(
  "OAuthAuthorizationError"
)<{
  readonly provider: AuthProvider;
  readonly errorCode: string;
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when OAuth callback handling fails
 */
export class OAuthCallbackError extends Data.TaggedError("OAuthCallbackError")<{
  readonly provider: AuthProvider;
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when OAuth token exchange fails
 */
export class OAuthTokenError extends Data.TaggedError("OAuthTokenError")<{
  readonly provider: AuthProvider;
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when OAuth account linking fails
 */
export class OAuthAccountLinkError extends Data.TaggedError(
  "OAuthAccountLinkError"
)<{
  readonly provider: AuthProvider;
  readonly userId: UserId;
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when OAuth provider is not configured or unsupported
 */
export class OAuthProviderError extends Data.TaggedError("OAuthProviderError")<{
  readonly provider: string;
  readonly message: string;
}> {}

// =============================================================================
// Error Type Unions for Exhaustive Matching
// =============================================================================

/**
 * All authentication-related errors
 */
export type AuthenticationError =
  | SessionValidationError
  | NoSessionError
  | SessionExpiredError
  | InvalidTokenError
  | UserNotFoundError
  | SessionNotFoundError
  | SessionDatabaseError;

/**
 * All authorization-related errors
 */
export type AuthorizationError =
  | InsufficientRoleError
  | InsufficientPermissionError;

/**
 * All OAuth-related errors
 */
export type OAuthError =
  | OAuthAuthorizationError
  | OAuthCallbackError
  | OAuthTokenError
  | OAuthAccountLinkError
  | OAuthProviderError;

/**
 * Union of all auth package errors
 * Use with Match.exhaustive for complete error handling
 */
export type AuthError = AuthenticationError | AuthorizationError | OAuthError;

// =============================================================================
// Error Tag Constants (for Match patterns)
// =============================================================================

/**
 * All error tags for use in Match patterns
 */
export const AuthErrorTags = {
  // Authentication
  SessionValidationError: "SessionValidationError",
  NoSessionError: "NoSessionError",
  SessionExpiredError: "SessionExpiredError",
  InvalidTokenError: "InvalidTokenError",
  UserNotFoundError: "UserNotFoundError",
  SessionNotFoundError: "SessionNotFoundError",
  SessionDatabaseError: "SessionDatabaseError",
  // Authorization
  InsufficientRoleError: "InsufficientRoleError",
  InsufficientPermissionError: "InsufficientPermissionError",
  // OAuth
  OAuthAuthorizationError: "OAuthAuthorizationError",
  OAuthCallbackError: "OAuthCallbackError",
  OAuthTokenError: "OAuthTokenError",
  OAuthAccountLinkError: "OAuthAccountLinkError",
  OAuthProviderError: "OAuthProviderError",
} as const;

export type AuthErrorTag = (typeof AuthErrorTags)[keyof typeof AuthErrorTags];

// =============================================================================
// HTTP Status Code Mapping
// =============================================================================

/**
 * Maps auth error tags to HTTP status codes
 * Use this with Match for error-to-response mapping
 */
export const AuthErrorHttpStatus: Record<AuthErrorTag, number> = {
  // 401 Unauthorized - authentication required
  SessionValidationError: 401,
  NoSessionError: 401,
  SessionExpiredError: 401,
  InvalidTokenError: 401,
  // 403 Forbidden - authenticated but not authorized
  InsufficientRoleError: 403,
  InsufficientPermissionError: 403,
  // 404 Not Found
  UserNotFoundError: 404,
  SessionNotFoundError: 404,
  // 500 Internal Server Error - database errors
  SessionDatabaseError: 500,
  // 400 Bad Request - OAuth client errors
  OAuthAuthorizationError: 400,
  OAuthCallbackError: 400,
  OAuthProviderError: 400,
  // 502 Bad Gateway - OAuth upstream errors
  OAuthTokenError: 502,
  // 409 Conflict - account already linked
  OAuthAccountLinkError: 409,
} as const;
