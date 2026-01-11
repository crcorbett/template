/**
 * Permissions Service Layer
 *
 * Provides Effect-based RBAC (Role-Based Access Control) services.
 * Handles role and permission checking for authenticated users.
 */
import type {
  PermissionString,
  RoleName,
  UserId,
  UserWithRoles,
} from "@packages/types";

import {
  DEFAULT_ROLE_PERMISSIONS,
  PermissionString as PermissionStringSchema,
  RoleName as RoleNameSchema,
  UserWithRoles as UserWithRolesSchema,
} from "@packages/types";
import { Context, Data, Effect, Layer, Schema } from "effect";

import { DatabaseQueryError } from "./database";

// =============================================================================
// Error Types
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
// Service Definition
// =============================================================================

/**
 * Permissions service interface
 *
 * All methods return Effects that are self-contained (no external requirements).
 * The database layer is provided internally via the AppLayer.
 */
export interface PermissionsServiceImpl {
  /**
   * Get all roles and permissions for a user
   */
  readonly getUserRoles: (
    userId: UserId
  ) => Effect.Effect<UserWithRoles, DatabaseQueryError>;

  /**
   * Check if a user has a specific role
   */
  readonly hasRole: (
    userId: UserId,
    role: RoleName
  ) => Effect.Effect<boolean, DatabaseQueryError>;

  /**
   * Check if a user has a specific permission
   */
  readonly hasPermission: (
    userId: UserId,
    permission: PermissionString
  ) => Effect.Effect<boolean, DatabaseQueryError>;

  /**
   * Require a user to have a specific role
   * Fails with InsufficientRoleError if user doesn't have the role
   */
  readonly requireRole: (
    userId: UserId,
    role: RoleName
  ) => Effect.Effect<void, InsufficientRoleError | DatabaseQueryError>;

  /**
   * Require a user to have a specific permission
   * Fails with InsufficientPermissionError if user doesn't have the permission
   */
  readonly requirePermission: (
    userId: UserId,
    permission: PermissionString
  ) => Effect.Effect<void, InsufficientPermissionError | DatabaseQueryError>;

  /**
   * Check if a user has any of the specified roles
   */
  readonly hasAnyRole: (
    userId: UserId,
    roles: readonly RoleName[]
  ) => Effect.Effect<boolean, DatabaseQueryError>;

  /**
   * Check if a user has all of the specified permissions
   */
  readonly hasAllPermissions: (
    userId: UserId,
    permissions: readonly PermissionString[]
  ) => Effect.Effect<boolean, DatabaseQueryError>;
}

/**
 * Permissions service tag for dependency injection
 */
export class PermissionsService extends Context.Tag("PermissionsService")<
  PermissionsService,
  PermissionsServiceImpl
>() {}

// =============================================================================
// Internal Implementation
// =============================================================================

/**
 * Get user roles - internal implementation
 *
 * Note: In a production app, this would query the database via the runtime.
 * For now, we return an empty roles array as a placeholder until
 * the database integration is completed in a future task.
 */
const getUserRolesImpl = (
  userId: UserId
): Effect.Effect<UserWithRoles, DatabaseQueryError> =>
  Effect.gen(function* () {
    // TODO: Integrate with database when the API routes task is completed
    // For now, return empty roles (user has no special permissions)
    const roles: RoleName[] = [];

    // Compute permissions from roles using default mapping
    const permissionSet = new Set<PermissionString>();
    for (const role of roles) {
      const roleKey = role as "admin" | "editor" | "viewer";
      const rolePermissions = DEFAULT_ROLE_PERMISSIONS[roleKey];
      if (rolePermissions) {
        for (const perm of rolePermissions) {
          permissionSet.add(
            Schema.decodeUnknownSync(PermissionStringSchema)(perm)
          );
        }
      }
    }

    const permissions = Array.from(permissionSet);

    return Schema.decodeUnknownSync(UserWithRolesSchema)({
      userId,
      roles: roles.map((r) => Schema.decodeUnknownSync(RoleNameSchema)(r)),
      permissions,
    });
  });

/**
 * Check if user has role - internal implementation
 */
const hasRoleImpl = (
  userId: UserId,
  role: RoleName
): Effect.Effect<boolean, DatabaseQueryError> =>
  Effect.gen(function* () {
    const userRoles = yield* getUserRolesImpl(userId);
    return userRoles.roles.includes(role);
  });

/**
 * Check if user has permission - internal implementation
 */
const hasPermissionImpl = (
  userId: UserId,
  permission: PermissionString
): Effect.Effect<boolean, DatabaseQueryError> =>
  Effect.gen(function* () {
    const userRoles = yield* getUserRolesImpl(userId);
    return userRoles.permissions.includes(permission);
  });

/**
 * Require role - internal implementation
 */
const requireRoleImpl = (
  userId: UserId,
  role: RoleName
): Effect.Effect<void, InsufficientRoleError | DatabaseQueryError> =>
  Effect.gen(function* () {
    const userRoles = yield* getUserRolesImpl(userId);

    if (!userRoles.roles.includes(role)) {
      return yield* Effect.fail(
        new InsufficientRoleError({
          userId,
          requiredRole: role,
          userRoles: userRoles.roles,
          message: `User does not have required role: ${role}`,
        })
      );
    }
  });

/**
 * Require permission - internal implementation
 */
const requirePermissionImpl = (
  userId: UserId,
  permission: PermissionString
): Effect.Effect<void, InsufficientPermissionError | DatabaseQueryError> =>
  Effect.gen(function* () {
    const userRoles = yield* getUserRolesImpl(userId);

    if (!userRoles.permissions.includes(permission)) {
      return yield* Effect.fail(
        new InsufficientPermissionError({
          userId,
          requiredPermission: permission,
          userPermissions: userRoles.permissions,
          message: `User does not have required permission: ${permission}`,
        })
      );
    }
  });

/**
 * Check if user has any of the specified roles - internal implementation
 */
const hasAnyRoleImpl = (
  userId: UserId,
  roles: readonly RoleName[]
): Effect.Effect<boolean, DatabaseQueryError> =>
  Effect.gen(function* () {
    const userRoles = yield* getUserRolesImpl(userId);
    return roles.some((role) => userRoles.roles.includes(role));
  });

/**
 * Check if user has all permissions - internal implementation
 */
const hasAllPermissionsImpl = (
  userId: UserId,
  permissions: readonly PermissionString[]
): Effect.Effect<boolean, DatabaseQueryError> =>
  Effect.gen(function* () {
    const userRoles = yield* getUserRolesImpl(userId);
    return permissions.every((perm) => userRoles.permissions.includes(perm));
  });

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the permissions service implementation
 */
const makePermissionsService = (): PermissionsServiceImpl => ({
  getUserRoles: getUserRolesImpl,
  hasRole: hasRoleImpl,
  hasPermission: hasPermissionImpl,
  requireRole: requireRoleImpl,
  requirePermission: requirePermissionImpl,
  hasAnyRole: hasAnyRoleImpl,
  hasAllPermissions: hasAllPermissionsImpl,
});

/**
 * Live layer for the permissions service
 */
export const PermissionsServiceLive = Layer.succeed(
  PermissionsService,
  makePermissionsService()
);

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get user roles and permissions (convenience function)
 */
export const getUserRoles = (userId: UserId) =>
  Effect.flatMap(PermissionsService, (service) => service.getUserRoles(userId));

/**
 * Check if user has role (convenience function)
 */
export const hasRole = (userId: UserId, role: RoleName) =>
  Effect.flatMap(PermissionsService, (service) =>
    service.hasRole(userId, role)
  );

/**
 * Check if user has permission (convenience function)
 */
export const hasPermission = (userId: UserId, permission: PermissionString) =>
  Effect.flatMap(PermissionsService, (service) =>
    service.hasPermission(userId, permission)
  );

/**
 * Require user to have role (convenience function)
 */
export const requireRole = (userId: UserId, role: RoleName) =>
  Effect.flatMap(PermissionsService, (service) =>
    service.requireRole(userId, role)
  );

/**
 * Require user to have permission (convenience function)
 */
export const requirePermission = (
  userId: UserId,
  permission: PermissionString
) =>
  Effect.flatMap(PermissionsService, (service) =>
    service.requirePermission(userId, permission)
  );

// =============================================================================
// Type Exports
// =============================================================================

export type { PermissionString, RoleName, UserWithRoles };
