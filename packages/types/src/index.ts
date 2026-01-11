/**
 * @packages/types - Auth and RBAC type definitions with Effect Schemas
 *
 * This package contains all auth-related types, RBAC types, and Drizzle schemas
 * used across the monorepo. All types are derived from Effect Schemas.
 */

// =============================================================================
// Auth Effect Schemas and Types
// =============================================================================

// Branded ID types
export { UserId, SessionId, AccountId, SessionToken, Email } from "./auth.js";
export type {
  UserId as UserIdType,
  SessionId as SessionIdType,
  AccountId as AccountIdType,
  SessionToken as SessionTokenType,
  Email as EmailType,
} from "./auth.js";

// Entity schemas and types
export { AuthProvider, User, Session, Account, AuthContext } from "./auth.js";
export type {
  AuthProvider as AuthProviderType,
  User as UserType,
  Session as SessionType,
  Account as AccountType,
  AuthContext as AuthContextType,
} from "./auth.js";

// Insert schemas and types
export { UserInsert, SessionInsert, AccountInsert } from "./auth.js";
export type {
  UserInsert as UserInsertType,
  SessionInsert as SessionInsertType,
  AccountInsert as AccountInsertType,
} from "./auth.js";

// =============================================================================
// RBAC Effect Schemas and Types
// =============================================================================

// Branded ID types
export { RoleId, PermissionId, UserRoleId, RolePermissionId } from "./rbac.js";
export type {
  RoleId as RoleIdType,
  PermissionId as PermissionIdType,
  UserRoleId as UserRoleIdType,
  RolePermissionId as RolePermissionIdType,
} from "./rbac.js";

// Domain value schemas
export { RoleName, Resource, Action, PermissionString } from "./rbac.js";
export type {
  RoleName as RoleNameType,
  Resource as ResourceType,
  Action as ActionType,
  PermissionString as PermissionStringType,
} from "./rbac.js";

// Entity schemas and types
export {
  Role,
  Permission,
  UserRole,
  RolePermission,
  UserWithRoles,
} from "./rbac.js";
export type {
  Role as RoleType,
  Permission as PermissionType,
  UserRole as UserRoleType,
  RolePermission as RolePermissionType,
  UserWithRoles as UserWithRolesType,
} from "./rbac.js";

// Insert schemas and types
export {
  RoleInsert,
  PermissionInsert,
  UserRoleInsert,
  RolePermissionInsert,
} from "./rbac.js";
export type {
  RoleInsert as RoleInsertType,
  PermissionInsert as PermissionInsertType,
  UserRoleInsert as UserRoleInsertType,
  RolePermissionInsert as RolePermissionInsertType,
} from "./rbac.js";

// Constants
export {
  DEFAULT_ROLE_PERMISSIONS,
  ALL_PERMISSIONS,
  ALL_ROLES,
} from "./rbac.js";

// =============================================================================
// Drizzle Schema (Database Tables)
// =============================================================================

export {
  users,
  sessions,
  accounts,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  usersRelations,
  sessionsRelations,
  accountsRelations,
  rolesRelations,
  permissionsRelations,
  userRolesRelations,
  rolePermissionsRelations,
  schema,
} from "./schema.js";

export type {
  UsersTable,
  SessionsTable,
  AccountsTable,
  RolesTable,
  PermissionsTable,
  UserRolesTable,
  RolePermissionsTable,
} from "./schema.js";
