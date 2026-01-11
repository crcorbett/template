/**
 * Effect Services for Auth Package
 *
 * Re-exports all auth-related Effect services and their layers.
 */

// =============================================================================
// Auth Service
// =============================================================================

export {
  // Service tags
  AuthService,
  BetterAuthClient,
  // Layers
  AuthServiceLive,
  // Convenience functions
  getSession,
  requireSession,
  validateToken,
} from "./auth.js";

export type {
  // Service interfaces
  AuthServiceImpl,
  BetterAuthClientImpl,
  // Better Auth types
  BetterAuthSessionResult,
} from "./auth.js";

// =============================================================================
// Permissions Service
// =============================================================================

export {
  // Service tags
  PermissionsService,
  UserRolesProvider,
  // Layers
  PermissionsServiceLive,
  // Error types
  UserRolesLookupError,
  // Convenience functions
  getUserRoles,
  hasRole,
  hasPermission,
  requireRole,
  requirePermission,
  hasAnyRole,
  hasAllPermissions,
} from "./permissions.js";

export type {
  // Service interfaces
  PermissionsServiceImpl,
  UserRolesProviderImpl,
} from "./permissions.js";
