/**
 * Effect Integration Module
 *
 * Re-exports all Effect services and utilities for the admin app.
 */

// Runtime
export { AppLayer, AppRuntime } from "./runtime";
export type { AppServices } from "./runtime";

// Auth Service
export {
  AuthService,
  AuthServiceLive,
  getSession,
  NoSessionError,
  requireSession,
  SessionValidationError,
  UserNotFoundError,
  validateToken,
} from "./services/auth";
export type { AuthContext, Session, User } from "./services/auth";

// Database Service
export {
  ConstraintViolationError,
  DatabaseLive,
  DatabaseQueryError,
  RecordNotFoundError,
  schema,
  SqlLive,
} from "./services/database";

// Permissions Service
export {
  getUserRoles,
  hasPermission,
  hasRole,
  InsufficientPermissionError,
  InsufficientRoleError,
  PermissionsService,
  PermissionsServiceLive,
  requirePermission,
  requireRole,
} from "./services/permissions";
export type {
  PermissionString,
  RoleName,
  UserWithRoles,
} from "./services/permissions";
