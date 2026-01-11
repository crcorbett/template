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
