/**
 * Utility exports for auth package
 */

// Error handling utilities
export {
  matchAuthError,
  mapAuthErrorToHttp,
  formatAuthError,
  authErrorToHttpResponse,
  matchAuthenticationError,
  matchAuthorizationError,
  matchOAuthError,
  isAuthenticationError,
  isAuthorizationError,
  isOAuthError,
  isReauthRequired,
  isRetryableError,
} from "./error-handling.js";

export type {
  HttpErrorResponse,
  AuthErrorHandlers,
  AuthenticationErrorType,
  AuthorizationErrorType,
  OAuthErrorType,
} from "./error-handling.js";

// Option-based utilities for nullable handling
export {
  // Generic Option utilities
  fromNullable,
  toNullable,
  getOrDefault,
  mapOption,
  flatMapOption,
  filterOption,
  matchOption,
  isSome,
  isNone,
  // Finder factory
  createFinder,
  // Auth domain finders
  findUser,
  findSession,
  findRole,
  findAccount,
  // Auth domain combinators
  getUserId,
  getSessionId,
  getUserEmail,
  filterActiveSession,
  chainUserSession,
  // Batch operations
  zipOptions,
  zip3Options,
  firstSome,
  collectSome,
  // Error recovery
  orElse,
  orElseSome,
} from "./option.js";
