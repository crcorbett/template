/**
 * Test setup and utilities for admin app tests
 *
 * Provides:
 * - Mock layers for testing without real database
 * - Test helpers for creating mock data
 * - Test fixtures for Effect-based testing
 */
import type { AuthServiceImpl } from "$/lib/effect/services/auth";
import type { PermissionsServiceImpl } from "$/lib/effect/services/permissions";
import type { AuthContext } from "@packages/types";

import {
  AuthService,
  NoSessionError,
  SessionValidationError,
} from "$/lib/effect/services/auth";
import { DatabaseQueryError } from "$/lib/effect/services/database";
import {
  InsufficientPermissionError,
  InsufficientRoleError,
  PermissionsService,
} from "$/lib/effect/services/permissions";
import {
  DEFAULT_ROLE_PERMISSIONS,
  PermissionString as PermissionStringSchema,
  RoleName as RoleNameSchema,
  Session as SessionSchema,
  User as UserSchema,
  UserId,
  UserWithRoles as UserWithRolesSchema,
} from "@packages/types";
import { Effect, Layer, Option, Schema } from "effect";

// =============================================================================
// Test Data Factories
// =============================================================================

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const validUuid2 = "550e8400-e29b-41d4-a716-446655440001";
const validEmail = "test@example.com";
// Effect Schema.Date expects ISO strings when decoding from unknown (JSON format)
const nowIso = new Date().toISOString();
const futureIso = new Date(Date.now() + 86400000).toISOString();

/**
 * Create a mock user for testing
 */
export const createMockUser = (
  overrides: Partial<{
    id: string;
    email: string;
    emailVerified: boolean;
    name: string | null;
    image: string | null;
  }> = {}
) =>
  Schema.decodeUnknownSync(UserSchema)({
    id: overrides.id ?? validUuid,
    email: overrides.email ?? validEmail,
    emailVerified: overrides.emailVerified ?? true,
    name: "name" in overrides ? overrides.name : "Test User",
    image: "image" in overrides ? overrides.image : null,
    createdAt: nowIso,
    updatedAt: nowIso,
  });

/**
 * Create a mock session for testing
 */
export const createMockSession = (
  overrides: Partial<{
    id: string;
    userId: string;
    token: string;
  }> = {}
) =>
  Schema.decodeUnknownSync(SessionSchema)({
    id: overrides.id ?? validUuid2,
    userId: overrides.userId ?? validUuid,
    token: overrides.token ?? "test-session-token",
    expiresAt: futureIso,
    ipAddress: "127.0.0.1",
    userAgent: "Test/1.0",
    createdAt: nowIso,
    updatedAt: nowIso,
  });

/**
 * Create a mock auth context for testing
 *
 * Note: createMockUser and createMockSession already decode/validate the data,
 * so we can simply combine them into an AuthContext without re-decoding.
 */
export const createMockAuthContext = (
  overrides: {
    userId?: string;
    email?: string;
    sessionId?: string;
  } = {}
): AuthContext => {
  const userOverrides: Partial<{
    id: string;
    email: string;
    emailVerified: boolean;
    name: string | null;
    image: string | null;
  }> = {};
  if (overrides.userId !== undefined) userOverrides.id = overrides.userId;
  if (overrides.email !== undefined) userOverrides.email = overrides.email;

  const sessionOverrides: Partial<{
    id: string;
    userId: string;
    token: string;
  }> = {
    userId: overrides.userId ?? validUuid,
  };
  if (overrides.sessionId !== undefined)
    sessionOverrides.id = overrides.sessionId;

  const user = createMockUser(userOverrides);
  const session = createMockSession(sessionOverrides);
  // User and Session are already decoded, so we cast directly to AuthContext
  return { user, session } as AuthContext;
};

/**
 * Create a mock UserId for testing
 */
export const createMockUserId = (id = validUuid) =>
  Schema.decodeUnknownSync(UserId)(id);

/**
 * Create mock user with roles for testing
 */
export const createMockUserWithRoles = (
  userId: string,
  roles: ("admin" | "editor" | "viewer")[]
) => {
  // Compute permissions from roles
  const permissionSet = new Set<string>();
  for (const role of roles) {
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[role];
    for (const perm of rolePermissions) {
      permissionSet.add(perm);
    }
  }

  return Schema.decodeUnknownSync(UserWithRolesSchema)({
    userId: Schema.decodeUnknownSync(UserId)(userId),
    roles: roles.map((r) => Schema.decodeUnknownSync(RoleNameSchema)(r)),
    permissions: Array.from(permissionSet).map((p) =>
      Schema.decodeUnknownSync(PermissionStringSchema)(p)
    ),
  });
};

// =============================================================================
// Mock Auth Service
// =============================================================================

/**
 * Configuration for mock auth service
 */
export interface MockAuthConfig {
  /** Session to return, or null for unauthenticated */
  session: AuthContext | null;
  /** Error to throw for getSession */
  getSessionError?: SessionValidationError;
}

/**
 * Create a mock auth service for testing
 */
export const createMockAuthService = (
  config: MockAuthConfig
): AuthServiceImpl => ({
  getSession: (_headers: Headers) => {
    if (config.getSessionError) {
      return Effect.fail(config.getSessionError);
    }
    return Effect.succeed(
      config.session ? Option.some(config.session) : Option.none()
    );
  },

  requireSession: (_headers: Headers) => {
    if (config.getSessionError) {
      return Effect.fail(config.getSessionError);
    }
    if (!config.session) {
      return Effect.fail(
        new NoSessionError({ message: "Authentication required" })
      );
    }
    return Effect.succeed(config.session);
  },

  validateToken: (_token: string) => {
    if (config.getSessionError) {
      return Effect.fail(config.getSessionError);
    }
    return Effect.succeed(
      config.session ? Option.some(config.session) : Option.none()
    );
  },
});

/**
 * Create a mock auth service layer
 */
export const createMockAuthLayer = (config: MockAuthConfig) =>
  Layer.succeed(AuthService, createMockAuthService(config));

// =============================================================================
// Mock Permissions Service
// =============================================================================

/**
 * Configuration for mock permissions service
 */
export interface MockPermissionsConfig {
  /** User roles configuration: userId -> roles */
  userRoles: Map<string, ("admin" | "editor" | "viewer")[]>;
  /** Error to throw for queries */
  queryError?: DatabaseQueryError;
}

/**
 * Create a mock permissions service for testing
 */
export const createMockPermissionsService = (
  config: MockPermissionsConfig
): PermissionsServiceImpl => {
  const getUserRolesData = (userId: UserId) => {
    const roles = config.userRoles.get(userId as string) ?? [];
    return createMockUserWithRoles(userId as string, roles);
  };

  return {
    getUserRoles: (userId: UserId) => {
      if (config.queryError) {
        return Effect.fail(config.queryError);
      }
      return Effect.succeed(getUserRolesData(userId));
    },

    hasRole: (userId: UserId, role) => {
      if (config.queryError) {
        return Effect.fail(config.queryError);
      }
      const userRoles = getUserRolesData(userId);
      return Effect.succeed(userRoles.roles.includes(role));
    },

    hasPermission: (userId: UserId, permission) => {
      if (config.queryError) {
        return Effect.fail(config.queryError);
      }
      const userRoles = getUserRolesData(userId);
      return Effect.succeed(userRoles.permissions.includes(permission));
    },

    requireRole: (userId: UserId, role) => {
      if (config.queryError) {
        return Effect.fail(config.queryError);
      }
      const userRoles = getUserRolesData(userId);
      if (!userRoles.roles.includes(role)) {
        return Effect.fail(
          new InsufficientRoleError({
            userId,
            requiredRole: role,
            userRoles: userRoles.roles,
            message: `User does not have required role: ${role}`,
          })
        );
      }
      return Effect.void;
    },

    requirePermission: (userId: UserId, permission) => {
      if (config.queryError) {
        return Effect.fail(config.queryError);
      }
      const userRoles = getUserRolesData(userId);
      if (!userRoles.permissions.includes(permission)) {
        return Effect.fail(
          new InsufficientPermissionError({
            userId,
            requiredPermission: permission,
            userPermissions: userRoles.permissions,
            message: `User does not have required permission: ${permission}`,
          })
        );
      }
      return Effect.void;
    },

    hasAnyRole: (userId: UserId, roles) => {
      if (config.queryError) {
        return Effect.fail(config.queryError);
      }
      const userRoles = getUserRolesData(userId);
      return Effect.succeed(roles.some((r) => userRoles.roles.includes(r)));
    },

    hasAllPermissions: (userId: UserId, permissions) => {
      if (config.queryError) {
        return Effect.fail(config.queryError);
      }
      const userRoles = getUserRolesData(userId);
      return Effect.succeed(
        permissions.every((p) => userRoles.permissions.includes(p))
      );
    },
  };
};

/**
 * Create a mock permissions service layer
 */
export const createMockPermissionsLayer = (config: MockPermissionsConfig) =>
  Layer.succeed(PermissionsService, createMockPermissionsService(config));

// =============================================================================
// Combined Test Layers
// =============================================================================

/**
 * Create a combined test layer with all mock services
 */
export const createTestLayer = (
  authConfig: MockAuthConfig,
  permissionsConfig: MockPermissionsConfig
) =>
  Layer.mergeAll(
    createMockAuthLayer(authConfig),
    createMockPermissionsLayer(permissionsConfig)
  );

// =============================================================================
// Test Constants
// =============================================================================

export const TEST_USER_ID = validUuid;
export const TEST_SESSION_ID = validUuid2;
export const TEST_EMAIL = validEmail;
