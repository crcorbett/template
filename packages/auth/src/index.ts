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
  SessionNotFoundError,
  SessionDatabaseError,
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

// Session service
export {
  SessionService,
  SessionRepository,
  SessionServiceLive,
  createSession,
  getSessionById,
  getSessionByToken,
  getUserSessions,
  refreshSession,
  revokeSession,
  revokeUserSessions,
  cleanupExpiredSessions,
  validateSession,
} from "./services/index.js";

export type {
  SessionServiceImpl,
  SessionRepositoryImpl,
  RawSessionData,
  SessionRefreshOptions,
} from "./services/index.js";

// OAuth service
export {
  OAuthService,
  OAuthProvider,
  AccountRepository,
  OAuthServiceLive,
  getAuthUrl,
  handleOAuthCallback,
  linkAccount,
  getLinkedAccount,
  getLinkedAccounts,
  findAccountByProvider,
  unlinkAccount,
  refreshOAuthTokens,
  isProviderSupported,
} from "./services/index.js";

export type {
  OAuthServiceImpl,
  OAuthProviderImpl,
  AccountRepositoryImpl,
  RawAccountData,
  OAuthAuthorizationUrl,
  OAuthCallbackResult,
  OAuthProviderConfig as OAuthProviderServiceConfig,
} from "./services/index.js";

// =============================================================================
// Runtime and Layer Composition
// =============================================================================

// Layer compositions
export {
  // Individual service layers
  AuthOnlyLayer,
  PermissionsOnlyLayer,
  SessionOnlyLayer,
  OAuthOnlyLayer,
  // Composite layers
  AuthWithPermissionsLayer,
  AuthWithSessionsLayer,
  FullAuthLayer,
  // Layer builder functions
  makeBetterAuthClientLayer,
  makeUserRolesProviderLayer,
  makeSessionRepositoryLayer,
  makeOAuthProviderLayer,
  makeAccountRepositoryLayer,
  // ManagedRuntime factory
  makeAuthRuntime,
} from "./runtime.js";

// Dependency types for layer composition
export type {
  AuthDependencies,
  AuthMinimalDependencies,
  AuthWithPermissionsDependencies,
  AuthWithSessionsDependencies,
  // Service type unions
  FullAuthServices,
  AuthWithPermissionsServices,
  AuthWithSessionsServices,
} from "./runtime.js";

// =============================================================================
// Configuration
// =============================================================================

// Branded types for sensitive values
export { ClientSecret, ClientId, DatabaseUrl, JwtSecret } from "./config.js";
export type {
  ClientSecret as ClientSecretType,
  ClientId as ClientIdType,
  DatabaseUrl as DatabaseUrlType,
  JwtSecret as JwtSecretType,
} from "./config.js";

// Configuration schemas
export {
  OAuthProviderConfigSchema,
  OAuthProvidersConfigSchema,
  DatabaseConfigSchema,
  SessionConfigSchema,
  AuthConfigSchema,
} from "./config.js";
export type {
  OAuthProviderConfigSchema as OAuthProviderConfig,
  OAuthProvidersConfigSchema as OAuthProvidersConfig,
  DatabaseConfigSchema as DatabaseConfig,
  SessionConfigSchema as SessionConfig,
  AuthConfigSchema as AuthConfigType,
} from "./config.js";

// Configuration loading
export {
  AuthConfigError,
  loadAuthConfig,
  AuthConfig,
  AuthConfigLive,
  makeAuthConfigLayer,
} from "./config.js";
