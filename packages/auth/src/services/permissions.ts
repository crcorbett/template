/**
 * Permissions Service Layer
 *
 * Provides Effect-based RBAC (Role-Based Access Control) services.
 * Framework-agnostic - depends on UserRolesProvider for role data.
 */
import type {
  PermissionString,
  RoleName,
  UserId,
  UserWithRoles,
} from "@packages/types";

import { Context, Effect, Layer, Match, Option } from "effect";

import {
  InsufficientPermissionError,
  InsufficientRoleError,
} from "../errors.js";

// =============================================================================
// Role Data Provider Dependency
// =============================================================================

/**
 * Error thrown when user roles lookup fails
 */
export class UserRolesLookupError extends Error {
  readonly _tag = "UserRolesLookupError" as const;
  readonly userId: UserId;

  constructor(userId: UserId, cause?: unknown) {
    super(`Failed to lookup roles for user: ${userId}`, { cause });
    this.name = "UserRolesLookupError";
    this.userId = userId;
  }
}

/**
 * Interface for retrieving user roles data
 * Apps provide their own implementation (database, cache, etc.)
 */
export interface UserRolesProviderImpl {
  /**
   * Get user with their roles and computed permissions
   * Returns None if user not found
   */
  readonly getUserRoles: (
    userId: UserId
  ) => Effect.Effect<Option.Option<UserWithRoles>, UserRolesLookupError>;
}

/**
 * User roles provider service tag
 */
export class UserRolesProvider extends Context.Tag("UserRolesProvider")<
  UserRolesProvider,
  UserRolesProviderImpl
>() {}

// =============================================================================
// Permissions Service Definition
// =============================================================================

/**
 * Permissions service interface
 */
export interface PermissionsServiceImpl {
  /**
   * Get all roles and permissions for a user
   * Returns None if user not found
   */
  readonly getUserRoles: (
    userId: UserId
  ) => Effect.Effect<Option.Option<UserWithRoles>, UserRolesLookupError>;

  /**
   * Check if a user has a specific role
   * Returns false if user not found
   */
  readonly hasRole: (
    userId: UserId,
    role: RoleName
  ) => Effect.Effect<boolean, UserRolesLookupError>;

  /**
   * Check if a user has a specific permission
   * Returns false if user not found
   */
  readonly hasPermission: (
    userId: UserId,
    permission: PermissionString
  ) => Effect.Effect<boolean, UserRolesLookupError>;

  /**
   * Require a user to have a specific role
   * Fails with InsufficientRoleError if user doesn't have the role
   */
  readonly requireRole: (
    userId: UserId,
    role: RoleName
  ) => Effect.Effect<void, InsufficientRoleError | UserRolesLookupError>;

  /**
   * Require a user to have a specific permission
   * Fails with InsufficientPermissionError if user doesn't have the permission
   */
  readonly requirePermission: (
    userId: UserId,
    permission: PermissionString
  ) => Effect.Effect<void, InsufficientPermissionError | UserRolesLookupError>;

  /**
   * Check if a user has any of the specified roles
   * Returns false if user not found
   */
  readonly hasAnyRole: (
    userId: UserId,
    roles: readonly RoleName[]
  ) => Effect.Effect<boolean, UserRolesLookupError>;

  /**
   * Check if a user has all of the specified permissions
   * Returns false if user not found
   */
  readonly hasAllPermissions: (
    userId: UserId,
    permissions: readonly PermissionString[]
  ) => Effect.Effect<boolean, UserRolesLookupError>;
}

/**
 * Permissions service tag for dependency injection
 */
export class PermissionsService extends Context.Tag("PermissionsService")<
  PermissionsService,
  PermissionsServiceImpl
>() {}

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the permissions service implementation
 */
const makePermissionsService = Effect.gen(function* () {
  const rolesProvider = yield* UserRolesProvider;

  const getUserRoles = (
    userId: UserId
  ): Effect.Effect<Option.Option<UserWithRoles>, UserRolesLookupError> =>
    rolesProvider.getUserRoles(userId);

  const hasRole = (
    userId: UserId,
    role: RoleName
  ): Effect.Effect<boolean, UserRolesLookupError> =>
    Effect.gen(function* () {
      const maybeUserRoles = yield* rolesProvider.getUserRoles(userId);
      return Option.match(maybeUserRoles, {
        onNone: () => false,
        onSome: (userRoles) => userRoles.roles.includes(role),
      });
    });

  const hasPermission = (
    userId: UserId,
    permission: PermissionString
  ): Effect.Effect<boolean, UserRolesLookupError> =>
    Effect.gen(function* () {
      const maybeUserRoles = yield* rolesProvider.getUserRoles(userId);
      return Option.match(maybeUserRoles, {
        onNone: () => false,
        onSome: (userRoles) => userRoles.permissions.includes(permission),
      });
    });

  const requireRole = (
    userId: UserId,
    role: RoleName
  ): Effect.Effect<void, InsufficientRoleError | UserRolesLookupError> =>
    Effect.gen(function* () {
      const maybeUserRoles = yield* rolesProvider.getUserRoles(userId);

      yield* Option.match(maybeUserRoles, {
        onNone: () =>
          Effect.fail(
            new InsufficientRoleError({
              userId,
              requiredRole: role,
              userRoles: [],
              message: `User ${userId} not found or has no roles`,
            })
          ),
        onSome: (userRoles) =>
          Match.value(userRoles.roles.includes(role)).pipe(
            Match.when(true, () => Effect.void),
            Match.when(false, () =>
              Effect.fail(
                new InsufficientRoleError({
                  userId,
                  requiredRole: role,
                  userRoles: userRoles.roles,
                  message: `User does not have required role: ${role}`,
                })
              )
            ),
            Match.exhaustive
          ),
      });
    });

  const requirePermission = (
    userId: UserId,
    permission: PermissionString
  ): Effect.Effect<void, InsufficientPermissionError | UserRolesLookupError> =>
    Effect.gen(function* () {
      const maybeUserRoles = yield* rolesProvider.getUserRoles(userId);

      yield* Option.match(maybeUserRoles, {
        onNone: () =>
          Effect.fail(
            new InsufficientPermissionError({
              userId,
              requiredPermission: permission,
              userPermissions: [],
              message: `User ${userId} not found or has no permissions`,
            })
          ),
        onSome: (userRoles) =>
          Match.value(userRoles.permissions.includes(permission)).pipe(
            Match.when(true, () => Effect.void),
            Match.when(false, () =>
              Effect.fail(
                new InsufficientPermissionError({
                  userId,
                  requiredPermission: permission,
                  userPermissions: userRoles.permissions,
                  message: `User does not have required permission: ${permission}`,
                })
              )
            ),
            Match.exhaustive
          ),
      });
    });

  const hasAnyRole = (
    userId: UserId,
    roles: readonly RoleName[]
  ): Effect.Effect<boolean, UserRolesLookupError> =>
    Effect.gen(function* () {
      const maybeUserRoles = yield* rolesProvider.getUserRoles(userId);
      return Option.match(maybeUserRoles, {
        onNone: () => false,
        onSome: (userRoles) =>
          roles.some((role) => userRoles.roles.includes(role)),
      });
    });

  const hasAllPermissions = (
    userId: UserId,
    permissions: readonly PermissionString[]
  ): Effect.Effect<boolean, UserRolesLookupError> =>
    Effect.gen(function* () {
      const maybeUserRoles = yield* rolesProvider.getUserRoles(userId);
      return Option.match(maybeUserRoles, {
        onNone: () => false,
        onSome: (userRoles) =>
          permissions.every((perm) => userRoles.permissions.includes(perm)),
      });
    });

  return {
    getUserRoles,
    hasRole,
    hasPermission,
    requireRole,
    requirePermission,
    hasAnyRole,
    hasAllPermissions,
  } satisfies PermissionsServiceImpl;
});

/**
 * Live layer for the permissions service
 * Requires UserRolesProvider to be provided
 */
export const PermissionsServiceLive: Layer.Layer<
  PermissionsService,
  never,
  UserRolesProvider
> = Layer.effect(PermissionsService, makePermissionsService);

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

/**
 * Check if user has any of the specified roles (convenience function)
 */
export const hasAnyRole = (userId: UserId, roles: readonly RoleName[]) =>
  Effect.flatMap(PermissionsService, (service) =>
    service.hasAnyRole(userId, roles)
  );

/**
 * Check if user has all of the specified permissions (convenience function)
 */
export const hasAllPermissions = (
  userId: UserId,
  permissions: readonly PermissionString[]
) =>
  Effect.flatMap(PermissionsService, (service) =>
    service.hasAllPermissions(userId, permissions)
  );
