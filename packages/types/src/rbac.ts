/**
 * Role-Based Access Control Effect Schemas and types
 *
 * All types are derived from Effect Schemas. Never use raw TypeScript interfaces.
 */
import { Schema } from "effect";

import { UserId } from "./auth.js";

// =============================================================================
// Branded Types for RBAC IDs
// =============================================================================

/**
 * Branded type for Role IDs (UUID format)
 */
export const RoleId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ),
  Schema.brand("RoleId")
);
export type RoleId = typeof RoleId.Type;

/**
 * Branded type for Permission IDs (UUID format)
 */
export const PermissionId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ),
  Schema.brand("PermissionId")
);
export type PermissionId = typeof PermissionId.Type;

/**
 * Branded type for UserRole junction IDs (UUID format)
 */
export const UserRoleId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ),
  Schema.brand("UserRoleId")
);
export type UserRoleId = typeof UserRoleId.Type;

/**
 * Branded type for RolePermission junction IDs (UUID format)
 */
export const RolePermissionId = Schema.String.pipe(
  Schema.pattern(
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
  ),
  Schema.brand("RolePermissionId")
);
export type RolePermissionId = typeof RolePermissionId.Type;

// =============================================================================
// Domain Value Schemas
// =============================================================================

/**
 * Available role names - branded for type safety
 */
export const RoleName = Schema.Literal("admin", "editor", "viewer").pipe(
  Schema.brand("RoleName")
);
export type RoleName = typeof RoleName.Type;

/**
 * Resource types that can be accessed
 */
export const Resource = Schema.Literal("users", "posts");
export type Resource = typeof Resource.Type;

/**
 * Actions that can be performed on resources
 */
export const Action = Schema.Literal("read", "write", "delete");
export type Action = typeof Action.Type;

/**
 * Permission string format: "resource:action" - branded for type safety
 */
export const PermissionString = Schema.Literal(
  "users:read",
  "users:write",
  "posts:read",
  "posts:write",
  "posts:delete"
).pipe(Schema.brand("PermissionString"));
export type PermissionString = typeof PermissionString.Type;

// =============================================================================
// Entity Schemas
// =============================================================================

/**
 * Role schema
 */
export const Role = Schema.Struct({
  id: RoleId,
  name: RoleName,
  description: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
export type Role = typeof Role.Type;

/**
 * Permission schema
 */
export const Permission = Schema.Struct({
  id: PermissionId,
  name: PermissionString,
  description: Schema.NullOr(Schema.String),
  createdAt: Schema.Date,
  updatedAt: Schema.Date,
});
export type Permission = typeof Permission.Type;

/**
 * UserRole junction schema
 */
export const UserRole = Schema.Struct({
  id: UserRoleId,
  userId: UserId,
  roleId: RoleId,
  createdAt: Schema.Date,
});
export type UserRole = typeof UserRole.Type;

/**
 * RolePermission junction schema
 */
export const RolePermission = Schema.Struct({
  id: RolePermissionId,
  roleId: RoleId,
  permissionId: PermissionId,
  createdAt: Schema.Date,
});
export type RolePermission = typeof RolePermission.Type;

/**
 * User with their roles and permissions resolved
 */
export const UserWithRoles = Schema.Struct({
  userId: UserId,
  roles: Schema.Array(RoleName),
  permissions: Schema.Array(PermissionString),
});
export type UserWithRoles = typeof UserWithRoles.Type;

// =============================================================================
// Insert Schemas (for creating new records)
// =============================================================================

/**
 * Schema for creating a new role
 */
export const RoleInsert = Schema.Struct({
  name: RoleName,
  description: Schema.NullOr(Schema.String),
});
export type RoleInsert = typeof RoleInsert.Type;

/**
 * Schema for creating a new permission
 */
export const PermissionInsert = Schema.Struct({
  name: PermissionString,
  description: Schema.NullOr(Schema.String),
});
export type PermissionInsert = typeof PermissionInsert.Type;

/**
 * Schema for assigning a role to a user
 */
export const UserRoleInsert = Schema.Struct({
  userId: UserId,
  roleId: RoleId,
});
export type UserRoleInsert = typeof UserRoleInsert.Type;

/**
 * Schema for assigning a permission to a role
 */
export const RolePermissionInsert = Schema.Struct({
  roleId: RoleId,
  permissionId: PermissionId,
});
export type RolePermissionInsert = typeof RolePermissionInsert.Type;

// =============================================================================
// Constants
// =============================================================================

/**
 * Default role-permission mapping
 */
export const DEFAULT_ROLE_PERMISSIONS: Record<
  "admin" | "editor" | "viewer",
  readonly (
    | "users:read"
    | "users:write"
    | "posts:read"
    | "posts:write"
    | "posts:delete"
  )[]
> = {
  admin: [
    "users:read",
    "users:write",
    "posts:read",
    "posts:write",
    "posts:delete",
  ],
  editor: ["posts:read", "posts:write", "posts:delete"],
  viewer: ["posts:read"],
} as const;

/**
 * All available permissions
 */
export const ALL_PERMISSIONS = [
  "users:read",
  "users:write",
  "posts:read",
  "posts:write",
  "posts:delete",
] as const;

/**
 * All available roles
 */
export const ALL_ROLES = ["admin", "editor", "viewer"] as const;
