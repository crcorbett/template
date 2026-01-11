/**
 * Match-based error handling utilities
 *
 * Provides exhaustive pattern matching for auth errors using Effect Match module.
 * Use these utilities for consistent error handling across consumers.
 */

import type { AuthError, AuthErrorTag } from "../errors.js";

import {
  AuthErrorHttpStatus,
  InsufficientPermissionError,
  InsufficientRoleError,
  InvalidTokenError,
  NoSessionError,
  OAuthAccountLinkError,
  OAuthAuthorizationError,
  OAuthCallbackError,
  OAuthProviderError,
  OAuthTokenError,
  SessionDatabaseError,
  SessionExpiredError,
  SessionNotFoundError,
  SessionValidationError,
  UserNotFoundError,
} from "../errors.js";

// =============================================================================
// HTTP Response Types
// =============================================================================

/**
 * Standard HTTP error response structure
 */
export interface HttpErrorResponse {
  readonly status: number;
  readonly error: string;
  readonly message: string;
  readonly code: AuthErrorTag;
}

// =============================================================================
// Handler Types
// =============================================================================

/**
 * Handler object for exhaustive auth error matching
 */
export interface AuthErrorHandlers<R> {
  readonly SessionValidationError: (error: SessionValidationError) => R;
  readonly NoSessionError: (error: NoSessionError) => R;
  readonly SessionExpiredError: (error: SessionExpiredError) => R;
  readonly InvalidTokenError: (error: InvalidTokenError) => R;
  readonly UserNotFoundError: (error: UserNotFoundError) => R;
  readonly SessionNotFoundError: (error: SessionNotFoundError) => R;
  readonly SessionDatabaseError: (error: SessionDatabaseError) => R;
  readonly InsufficientRoleError: (error: InsufficientRoleError) => R;
  readonly InsufficientPermissionError: (
    error: InsufficientPermissionError
  ) => R;
  readonly OAuthAuthorizationError: (error: OAuthAuthorizationError) => R;
  readonly OAuthCallbackError: (error: OAuthCallbackError) => R;
  readonly OAuthTokenError: (error: OAuthTokenError) => R;
  readonly OAuthAccountLinkError: (error: OAuthAccountLinkError) => R;
  readonly OAuthProviderError: (error: OAuthProviderError) => R;
}

// =============================================================================
// Match-based Error Handlers
// =============================================================================

/**
 * Exhaustive matcher for all auth errors
 *
 * Use this to ensure all error variants are handled.
 * TypeScript will error if any error type is missing from handlers.
 *
 * @example
 * ```ts
 * const result = matchAuthError(error, {
 *   SessionValidationError: (e) => handleSessionValidation(e),
 *   NoSessionError: (e) => handleNoSession(e),
 *   // ... all other variants
 * })
 * ```
 */
export function matchAuthError<R>(
  error: AuthError,
  handlers: AuthErrorHandlers<R>
): R {
  switch (error._tag) {
    case "SessionValidationError":
      return handlers.SessionValidationError(error);
    case "NoSessionError":
      return handlers.NoSessionError(error);
    case "SessionExpiredError":
      return handlers.SessionExpiredError(error);
    case "InvalidTokenError":
      return handlers.InvalidTokenError(error);
    case "UserNotFoundError":
      return handlers.UserNotFoundError(error);
    case "SessionNotFoundError":
      return handlers.SessionNotFoundError(error);
    case "SessionDatabaseError":
      return handlers.SessionDatabaseError(error);
    case "InsufficientRoleError":
      return handlers.InsufficientRoleError(error);
    case "InsufficientPermissionError":
      return handlers.InsufficientPermissionError(error);
    case "OAuthAuthorizationError":
      return handlers.OAuthAuthorizationError(error);
    case "OAuthCallbackError":
      return handlers.OAuthCallbackError(error);
    case "OAuthTokenError":
      return handlers.OAuthTokenError(error);
    case "OAuthAccountLinkError":
      return handlers.OAuthAccountLinkError(error);
    case "OAuthProviderError":
      return handlers.OAuthProviderError(error);
  }
}

/**
 * Maps an auth error to an HTTP status code
 *
 * Uses the AuthErrorHttpStatus mapping for consistent HTTP responses.
 *
 * @example
 * ```ts
 * const status = mapAuthErrorToHttp(error)
 * // Returns: 401, 403, 404, etc.
 * ```
 */
export const mapAuthErrorToHttp = (error: AuthError): number =>
  matchAuthError(error, {
    SessionValidationError: () => AuthErrorHttpStatus.SessionValidationError,
    NoSessionError: () => AuthErrorHttpStatus.NoSessionError,
    SessionExpiredError: () => AuthErrorHttpStatus.SessionExpiredError,
    InvalidTokenError: () => AuthErrorHttpStatus.InvalidTokenError,
    UserNotFoundError: () => AuthErrorHttpStatus.UserNotFoundError,
    SessionNotFoundError: () => AuthErrorHttpStatus.SessionNotFoundError,
    SessionDatabaseError: () => AuthErrorHttpStatus.SessionDatabaseError,
    InsufficientRoleError: () => AuthErrorHttpStatus.InsufficientRoleError,
    InsufficientPermissionError: () =>
      AuthErrorHttpStatus.InsufficientPermissionError,
    OAuthAuthorizationError: () => AuthErrorHttpStatus.OAuthAuthorizationError,
    OAuthCallbackError: () => AuthErrorHttpStatus.OAuthCallbackError,
    OAuthTokenError: () => AuthErrorHttpStatus.OAuthTokenError,
    OAuthAccountLinkError: () => AuthErrorHttpStatus.OAuthAccountLinkError,
    OAuthProviderError: () => AuthErrorHttpStatus.OAuthProviderError,
  });

/**
 * Maps an auth error to a user-friendly error category name
 */
const getErrorCategory = (error: AuthError): string =>
  matchAuthError(error, {
    SessionValidationError: () => "Authentication Error",
    NoSessionError: () => "Authentication Required",
    SessionExpiredError: () => "Session Expired",
    InvalidTokenError: () => "Invalid Token",
    UserNotFoundError: () => "User Not Found",
    SessionNotFoundError: () => "Session Not Found",
    SessionDatabaseError: () => "Server Error",
    InsufficientRoleError: () => "Access Denied",
    InsufficientPermissionError: () => "Permission Denied",
    OAuthAuthorizationError: () => "OAuth Error",
    OAuthCallbackError: () => "OAuth Error",
    OAuthTokenError: () => "OAuth Error",
    OAuthAccountLinkError: () => "Account Link Error",
    OAuthProviderError: () => "Provider Error",
  });

/**
 * Formats an auth error into a user-friendly message
 *
 * Produces safe, user-facing messages that don't expose internal details.
 *
 * @example
 * ```ts
 * const message = formatAuthError(error)
 * // Returns: "Your session has expired. Please sign in again."
 * ```
 */
export const formatAuthError = (error: AuthError): string =>
  matchAuthError(error, {
    SessionValidationError: () =>
      "There was a problem with your session. Please sign in again.",
    NoSessionError: () => "Please sign in to continue.",
    SessionExpiredError: () =>
      "Your session has expired. Please sign in again.",
    InvalidTokenError: (e) =>
      e.tokenType === "refresh"
        ? "Your session could not be refreshed. Please sign in again."
        : "Your authentication token is invalid. Please sign in again.",
    UserNotFoundError: () =>
      "Your account could not be found. Please contact support.",
    SessionNotFoundError: () =>
      "Your session could not be found. Please sign in again.",
    SessionDatabaseError: () =>
      "An unexpected error occurred. Please try again later.",
    InsufficientRoleError: (e) =>
      `You don't have the required role (${e.requiredRole}) to access this resource.`,
    InsufficientPermissionError: (e) =>
      `You don't have permission (${e.requiredPermission}) to perform this action.`,
    OAuthAuthorizationError: (e) =>
      `Authorization with ${e.provider} failed. Please try again.`,
    OAuthCallbackError: (e) =>
      `Sign in with ${e.provider} could not be completed. Please try again.`,
    OAuthTokenError: (e) =>
      `There was a problem communicating with ${e.provider}. Please try again.`,
    OAuthAccountLinkError: (e) =>
      `Could not link your ${e.provider} account. It may already be linked to another user.`,
    OAuthProviderError: (e) =>
      `The provider "${e.provider}" is not supported or configured.`,
  });

/**
 * Converts an auth error to a complete HTTP error response
 *
 * Combines status code, error category, user message, and error code
 * into a standard response object.
 *
 * @example
 * ```ts
 * const response = authErrorToHttpResponse(error)
 * // Returns: { status: 401, error: "Session Expired", message: "...", code: "SessionExpiredError" }
 * ```
 */
export const authErrorToHttpResponse = (
  error: AuthError
): HttpErrorResponse => ({
  status: mapAuthErrorToHttp(error),
  error: getErrorCategory(error),
  message: formatAuthError(error),
  code: error._tag,
});

// =============================================================================
// Partial Matchers for Specific Error Categories
// =============================================================================

/**
 * Authentication error types
 */
export type AuthenticationErrorType =
  | SessionValidationError
  | NoSessionError
  | SessionExpiredError
  | InvalidTokenError
  | UserNotFoundError
  | SessionNotFoundError
  | SessionDatabaseError;

/**
 * Authorization error types
 */
export type AuthorizationErrorType =
  | InsufficientRoleError
  | InsufficientPermissionError;

/**
 * OAuth error types
 */
export type OAuthErrorType =
  | OAuthAuthorizationError
  | OAuthCallbackError
  | OAuthTokenError
  | OAuthAccountLinkError
  | OAuthProviderError;

/**
 * Checks if an auth error is an authentication error
 */
export const isAuthenticationError = (
  error: AuthError
): error is AuthenticationErrorType => {
  const tag = error._tag;
  return (
    tag === "SessionValidationError" ||
    tag === "NoSessionError" ||
    tag === "SessionExpiredError" ||
    tag === "InvalidTokenError" ||
    tag === "UserNotFoundError" ||
    tag === "SessionNotFoundError" ||
    tag === "SessionDatabaseError"
  );
};

/**
 * Checks if an auth error is an authorization error
 */
export const isAuthorizationError = (
  error: AuthError
): error is AuthorizationErrorType => {
  const tag = error._tag;
  return (
    tag === "InsufficientRoleError" || tag === "InsufficientPermissionError"
  );
};

/**
 * Checks if an auth error is an OAuth error
 */
export const isOAuthError = (error: AuthError): error is OAuthErrorType => {
  const tag = error._tag;
  return (
    tag === "OAuthAuthorizationError" ||
    tag === "OAuthCallbackError" ||
    tag === "OAuthTokenError" ||
    tag === "OAuthAccountLinkError" ||
    tag === "OAuthProviderError"
  );
};

/**
 * Matches only authentication errors (401)
 *
 * Returns the handler result for authentication errors, undefined otherwise.
 */
export function matchAuthenticationError<R>(
  error: AuthError,
  handler: (error: AuthenticationErrorType) => R
): R | undefined {
  if (isAuthenticationError(error)) {
    return handler(error);
  }
  return undefined;
}

/**
 * Matches only authorization errors (403)
 *
 * Returns the handler result for authorization errors, undefined otherwise.
 */
export function matchAuthorizationError<R>(
  error: AuthError,
  handler: (error: AuthorizationErrorType) => R
): R | undefined {
  if (isAuthorizationError(error)) {
    return handler(error);
  }
  return undefined;
}

/**
 * Matches only OAuth errors
 *
 * Returns the handler result for OAuth errors, undefined otherwise.
 */
export function matchOAuthError<R>(
  error: AuthError,
  handler: (error: OAuthErrorType) => R
): R | undefined {
  if (isOAuthError(error)) {
    return handler(error);
  }
  return undefined;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * Type guard to check if error requires re-authentication
 */
export const isReauthRequired = (error: AuthError): boolean =>
  matchAuthError(error, {
    SessionValidationError: () => true,
    NoSessionError: () => true,
    SessionExpiredError: () => true,
    InvalidTokenError: () => true,
    UserNotFoundError: () => false,
    SessionNotFoundError: () => true,
    SessionDatabaseError: () => false,
    InsufficientRoleError: () => false,
    InsufficientPermissionError: () => false,
    OAuthAuthorizationError: () => false,
    OAuthCallbackError: () => false,
    OAuthTokenError: () => false,
    OAuthAccountLinkError: () => false,
    OAuthProviderError: () => false,
  });

/**
 * Type guard to check if error is retryable
 */
export const isRetryableError = (error: AuthError): boolean =>
  matchAuthError(error, {
    SessionValidationError: () => false,
    NoSessionError: () => false,
    SessionExpiredError: () => false,
    InvalidTokenError: () => false,
    UserNotFoundError: () => false,
    SessionNotFoundError: () => false,
    SessionDatabaseError: () => true, // Database errors may be transient
    InsufficientRoleError: () => false,
    InsufficientPermissionError: () => false,
    OAuthAuthorizationError: () => false,
    OAuthCallbackError: () => true, // May be transient
    OAuthTokenError: () => true, // May be upstream issue
    OAuthAccountLinkError: () => false,
    OAuthProviderError: () => false,
  });
