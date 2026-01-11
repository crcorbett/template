/**
 * @packages/auth
 *
 * Reusable authentication package with Effect best practices.
 * Provides framework-agnostic auth services for the monorepo.
 *
 * This package contains:
 * - Effect services for auth, permissions, sessions, and OAuth
 * - Typed errors using Data.TaggedError
 * - Match-based error handling utilities
 * - Option-based nullable handling
 * - Framework-agnostic middleware factories
 */

// Re-export auth-related types from @packages/types
export type {
  AuthContext,
  PermissionString,
  RoleName,
  Session,
  User,
  UserId,
  UserWithRoles,
} from "@packages/types";

// =============================================================================
// Errors
// =============================================================================

// Authentication errors
export {
  SessionValidationError,
  NoSessionError,
  SessionExpiredError,
  InvalidTokenError,
  UserNotFoundError,
} from "./errors.js";

// Authorization errors
export {
  InsufficientRoleError,
  InsufficientPermissionError,
} from "./errors.js";

// OAuth errors
export {
  OAuthAuthorizationError,
  OAuthCallbackError,
  OAuthTokenError,
  OAuthAccountLinkError,
  OAuthProviderError,
} from "./errors.js";

// Error type unions for exhaustive matching
export type {
  AuthenticationError,
  AuthorizationError,
  OAuthError,
  AuthError,
  AuthErrorTag,
} from "./errors.js";

// Error constants for Match patterns
export { AuthErrorTags, AuthErrorHttpStatus } from "./errors.js";

// =============================================================================
// Services
// =============================================================================

// Auth service
export {
  AuthService,
  BetterAuthClient,
  AuthServiceLive,
  getSession,
  requireSession,
  validateToken,
} from "./services/index.js";

export type {
  AuthServiceImpl,
  BetterAuthClientImpl,
  BetterAuthSessionResult,
} from "./services/index.js";

// Permissions service
export {
  PermissionsService,
  UserRolesProvider,
  PermissionsServiceLive,
  UserRolesLookupError,
  getUserRoles,
  hasRole,
  hasPermission,
  requireRole,
  requirePermission,
  hasAnyRole,
  hasAllPermissions,
} from "./services/index.js";

export type {
  PermissionsServiceImpl,
  UserRolesProviderImpl,
} from "./services/index.js";
