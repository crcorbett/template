/**
 * Tests for Drizzle schema validation and Effect Schema mapping
 *
 * These tests verify that:
 * 1. Effect Schemas correctly validate data shapes
 * 2. Drizzle schemas have the expected columns and constraints
 * 3. Branded types enforce UUID patterns
 */
import { describe, expect, it } from "vitest";
import { Either, Schema } from "effect";

// Import Effect Schemas from @packages/types
import {
  UserId,
  SessionId,
  AccountId,
  RoleId,
  PermissionId,
  UserRoleId,
  RolePermissionId,
  Email,
  SessionToken,
  RoleName,
  PermissionString,
  User,
  Session,
  Account,
  Role,
  Permission,
  UserRole,
  RolePermission,
  UserInsert,
  SessionInsert,
  RoleInsert,
  PermissionInsert,
  UserRoleInsert,
  RolePermissionInsert,
  ALL_ROLES,
  ALL_PERMISSIONS,
  DEFAULT_ROLE_PERMISSIONS,
} from "@packages/types";

// Import Drizzle schemas
import {
  users,
  sessions,
  accounts,
  roles,
  permissions,
  userRoles,
  rolePermissions,
} from "@packages/types";

// =============================================================================
// Test Helpers
// =============================================================================

const validUuid = "550e8400-e29b-41d4-a716-446655440000";
const invalidUuid = "not-a-uuid";
const validEmail = "test@example.com";
const invalidEmail = "not-an-email";
// Effect Schema.Date expects ISO string when decoding from unknown (like JSON)
const nowIso = new Date().toISOString();

// =============================================================================
// Branded ID Type Tests
// =============================================================================

describe("Branded ID Types", () => {
  describe("UserId", () => {
    it("should accept valid UUID", () => {
      const result = Schema.decodeUnknownEither(UserId)(validUuid);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = Schema.decodeUnknownEither(UserId)(invalidUuid);
      expect(Either.isLeft(result)).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Schema.decodeUnknownEither(UserId)("");
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("SessionId", () => {
    it("should accept valid UUID", () => {
      const result = Schema.decodeUnknownEither(SessionId)(validUuid);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = Schema.decodeUnknownEither(SessionId)(invalidUuid);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("AccountId", () => {
    it("should accept valid UUID", () => {
      const result = Schema.decodeUnknownEither(AccountId)(validUuid);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = Schema.decodeUnknownEither(AccountId)(invalidUuid);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("RoleId", () => {
    it("should accept valid UUID", () => {
      const result = Schema.decodeUnknownEither(RoleId)(validUuid);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = Schema.decodeUnknownEither(RoleId)(invalidUuid);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("PermissionId", () => {
    it("should accept valid UUID", () => {
      const result = Schema.decodeUnknownEither(PermissionId)(validUuid);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = Schema.decodeUnknownEither(PermissionId)(invalidUuid);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("UserRoleId", () => {
    it("should accept valid UUID", () => {
      const result = Schema.decodeUnknownEither(UserRoleId)(validUuid);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = Schema.decodeUnknownEither(UserRoleId)(invalidUuid);
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("RolePermissionId", () => {
    it("should accept valid UUID", () => {
      const result = Schema.decodeUnknownEither(RolePermissionId)(validUuid);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid UUID", () => {
      const result = Schema.decodeUnknownEither(RolePermissionId)(invalidUuid);
      expect(Either.isLeft(result)).toBe(true);
    });
  });
});

// =============================================================================
// Domain Value Type Tests
// =============================================================================

describe("Domain Value Types", () => {
  describe("Email", () => {
    it("should accept valid email", () => {
      const result = Schema.decodeUnknownEither(Email)(validEmail);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid email", () => {
      const result = Schema.decodeUnknownEither(Email)(invalidEmail);
      expect(Either.isLeft(result)).toBe(true);
    });

    it("should reject email without @", () => {
      const result = Schema.decodeUnknownEither(Email)("testexample.com");
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("SessionToken", () => {
    it("should accept non-empty string", () => {
      const result = Schema.decodeUnknownEither(SessionToken)("some-token-123");
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject empty string", () => {
      const result = Schema.decodeUnknownEither(SessionToken)("");
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("RoleName", () => {
    it.each(ALL_ROLES)('should accept "%s" role', (role) => {
      const result = Schema.decodeUnknownEither(RoleName)(role);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid role", () => {
      const result = Schema.decodeUnknownEither(RoleName)("superuser");
      expect(Either.isLeft(result)).toBe(true);
    });
  });

  describe("PermissionString", () => {
    it.each(ALL_PERMISSIONS)('should accept "%s" permission', (permission) => {
      const result = Schema.decodeUnknownEither(PermissionString)(permission);
      expect(Either.isRight(result)).toBe(true);
    });

    it("should reject invalid permission", () => {
      const result =
        Schema.decodeUnknownEither(PermissionString)("invalid:permission");
      expect(Either.isLeft(result)).toBe(true);
    });
  });
});

// =============================================================================
// Entity Schema Tests
// =============================================================================

/**
 * Helper to decode and validate schema, logging errors on failure
 */
const decodeAndCheck = <A, I>(schema: Schema.Schema<A, I>, input: unknown) => {
  const result = Schema.decodeUnknownEither(schema)(input);
  return Either.isRight(result);
};

describe("Entity Schemas", () => {
  describe("User", () => {
    // For Entity schemas with branded types, we need to test that:
    // 1. decodeUnknown properly validates the underlying data
    // 2. The branded types are applied correctly
    // Note: Schema.Date expects ISO strings when decoding from unknown (JSON format)

    it("should validate user data structure", () => {
      // User schema expects branded UserId and Email
      // decodeUnknown should work with raw strings that match the pattern
      const validUser = {
        id: validUuid,
        email: validEmail,
        emailVerified: true,
        name: "Test User",
        image: "https://example.com/image.png",
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      expect(decodeAndCheck(User, validUser)).toBe(true);
    });

    it("should accept user with null name", () => {
      const userWithNullName = {
        id: validUuid,
        email: validEmail,
        emailVerified: false,
        name: null,
        image: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      expect(decodeAndCheck(User, userWithNullName)).toBe(true);
    });

    it("should accept user with null image", () => {
      const userWithNullImage = {
        id: validUuid,
        email: validEmail,
        emailVerified: true,
        name: "Test",
        image: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      expect(decodeAndCheck(User, userWithNullImage)).toBe(true);
    });

    it("should reject user with invalid email", () => {
      const userBadEmail = {
        id: validUuid,
        email: invalidEmail,
        emailVerified: true,
        name: null,
        image: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      expect(decodeAndCheck(User, userBadEmail)).toBe(false);
    });

    it("should reject user with invalid id", () => {
      const userBadId = {
        id: invalidUuid,
        email: validEmail,
        emailVerified: true,
        name: null,
        image: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      expect(decodeAndCheck(User, userBadId)).toBe(false);
    });
  });

  describe("Session", () => {
    const futureIso = new Date(Date.now() + 86400000).toISOString();
    const makeSession = (overrides: Record<string, unknown> = {}) => ({
      id: validUuid,
      userId: validUuid,
      token: "session-token-123",
      expiresAt: futureIso,
      ipAddress: "192.168.1.1",
      userAgent: "Mozilla/5.0",
      createdAt: nowIso,
      updatedAt: nowIso,
      ...overrides,
    });

    it("should accept valid session", () => {
      expect(decodeAndCheck(Session, makeSession())).toBe(true);
    });

    it("should accept session with null ipAddress", () => {
      expect(decodeAndCheck(Session, makeSession({ ipAddress: null }))).toBe(
        true
      );
    });

    it("should accept session with null userAgent", () => {
      expect(decodeAndCheck(Session, makeSession({ userAgent: null }))).toBe(
        true
      );
    });

    it("should reject session with invalid userId", () => {
      expect(
        decodeAndCheck(Session, makeSession({ userId: invalidUuid }))
      ).toBe(false);
    });

    it("should reject session with empty token", () => {
      expect(decodeAndCheck(Session, makeSession({ token: "" }))).toBe(false);
    });
  });

  describe("Account", () => {
    const futureHourIso = new Date(Date.now() + 3600000).toISOString();
    const futureDayIso = new Date(Date.now() + 86400000).toISOString();
    const makeAccount = (overrides: Record<string, unknown> = {}) => ({
      id: validUuid,
      userId: validUuid,
      accountId: "provider-account-123",
      providerId: "google" as const,
      accessToken: "access-token",
      refreshToken: "refresh-token",
      accessTokenExpiresAt: futureHourIso,
      refreshTokenExpiresAt: futureDayIso,
      scope: "openid profile email",
      idToken: "id-token",
      createdAt: nowIso,
      updatedAt: nowIso,
      ...overrides,
    });

    it("should accept valid account", () => {
      expect(decodeAndCheck(Account, makeAccount())).toBe(true);
    });

    it("should accept account with null tokens", () => {
      expect(
        decodeAndCheck(
          Account,
          makeAccount({
            accessToken: null,
            refreshToken: null,
            accessTokenExpiresAt: null,
            refreshTokenExpiresAt: null,
            scope: null,
            idToken: null,
          })
        )
      ).toBe(true);
    });

    it("should accept microsoft provider", () => {
      expect(
        decodeAndCheck(Account, makeAccount({ providerId: "microsoft" }))
      ).toBe(true);
    });

    it("should reject invalid provider", () => {
      expect(
        decodeAndCheck(Account, makeAccount({ providerId: "github" }))
      ).toBe(false);
    });

    it("should reject invalid userId", () => {
      expect(
        decodeAndCheck(Account, makeAccount({ userId: invalidUuid }))
      ).toBe(false);
    });
  });

  describe("Role", () => {
    const makeRole = (overrides: Record<string, unknown> = {}) => ({
      id: validUuid,
      name: "admin",
      description: "Administrator role",
      createdAt: nowIso,
      updatedAt: nowIso,
      ...overrides,
    });

    it("should accept admin role", () => {
      expect(decodeAndCheck(Role, makeRole({ name: "admin" }))).toBe(true);
    });

    it("should accept editor role", () => {
      expect(decodeAndCheck(Role, makeRole({ name: "editor" }))).toBe(true);
    });

    it("should accept viewer role", () => {
      expect(decodeAndCheck(Role, makeRole({ name: "viewer" }))).toBe(true);
    });

    it("should accept role with null description", () => {
      expect(decodeAndCheck(Role, makeRole({ description: null }))).toBe(true);
    });

    it("should reject invalid role name", () => {
      expect(decodeAndCheck(Role, makeRole({ name: "superadmin" }))).toBe(
        false
      );
    });

    it("should reject invalid id", () => {
      expect(decodeAndCheck(Role, makeRole({ id: invalidUuid }))).toBe(false);
    });
  });

  describe("Permission", () => {
    const makePermission = (overrides: Record<string, unknown> = {}) => ({
      id: validUuid,
      name: "users:read",
      description: "Read users",
      createdAt: nowIso,
      updatedAt: nowIso,
      ...overrides,
    });

    it("should accept users:read permission", () => {
      expect(
        decodeAndCheck(Permission, makePermission({ name: "users:read" }))
      ).toBe(true);
    });

    it("should accept users:write permission", () => {
      expect(
        decodeAndCheck(Permission, makePermission({ name: "users:write" }))
      ).toBe(true);
    });

    it("should accept posts:read permission", () => {
      expect(
        decodeAndCheck(Permission, makePermission({ name: "posts:read" }))
      ).toBe(true);
    });

    it("should accept posts:write permission", () => {
      expect(
        decodeAndCheck(Permission, makePermission({ name: "posts:write" }))
      ).toBe(true);
    });

    it("should accept posts:delete permission", () => {
      expect(
        decodeAndCheck(Permission, makePermission({ name: "posts:delete" }))
      ).toBe(true);
    });

    it("should accept permission with null description", () => {
      expect(
        decodeAndCheck(Permission, makePermission({ description: null }))
      ).toBe(true);
    });

    it("should reject invalid permission name", () => {
      expect(
        decodeAndCheck(Permission, makePermission({ name: "invalid:perm" }))
      ).toBe(false);
    });
  });

  describe("UserRole", () => {
    const makeUserRole = (overrides: Record<string, unknown> = {}) => ({
      id: validUuid,
      userId: validUuid,
      roleId: validUuid,
      createdAt: nowIso,
      ...overrides,
    });

    it("should accept valid user role", () => {
      expect(decodeAndCheck(UserRole, makeUserRole())).toBe(true);
    });

    it("should reject invalid userId", () => {
      expect(
        decodeAndCheck(UserRole, makeUserRole({ userId: invalidUuid }))
      ).toBe(false);
    });

    it("should reject invalid roleId", () => {
      expect(
        decodeAndCheck(UserRole, makeUserRole({ roleId: invalidUuid }))
      ).toBe(false);
    });

    it("should reject invalid id", () => {
      expect(decodeAndCheck(UserRole, makeUserRole({ id: invalidUuid }))).toBe(
        false
      );
    });
  });

  describe("RolePermission", () => {
    const makeRolePermission = (overrides: Record<string, unknown> = {}) => ({
      id: validUuid,
      roleId: validUuid,
      permissionId: validUuid,
      createdAt: nowIso,
      ...overrides,
    });

    it("should accept valid role permission", () => {
      expect(decodeAndCheck(RolePermission, makeRolePermission())).toBe(true);
    });

    it("should reject invalid roleId", () => {
      expect(
        decodeAndCheck(
          RolePermission,
          makeRolePermission({ roleId: invalidUuid })
        )
      ).toBe(false);
    });

    it("should reject invalid permissionId", () => {
      expect(
        decodeAndCheck(
          RolePermission,
          makeRolePermission({ permissionId: invalidUuid })
        )
      ).toBe(false);
    });

    it("should reject invalid id", () => {
      expect(
        decodeAndCheck(RolePermission, makeRolePermission({ id: invalidUuid }))
      ).toBe(false);
    });
  });
});

// =============================================================================
// Insert Schema Tests
// =============================================================================

describe("Insert Schemas", () => {
  describe("UserInsert", () => {
    it("should accept valid user insert", () => {
      expect(
        decodeAndCheck(UserInsert, {
          email: validEmail,
          name: "Test User",
          image: null,
        })
      ).toBe(true);
    });

    it("should accept user insert with optional emailVerified", () => {
      expect(
        decodeAndCheck(UserInsert, {
          email: validEmail,
          emailVerified: true,
          name: null,
          image: null,
        })
      ).toBe(true);
    });

    it("should reject user insert with invalid email", () => {
      expect(
        decodeAndCheck(UserInsert, {
          email: invalidEmail,
          name: null,
          image: null,
        })
      ).toBe(false);
    });
  });

  describe("SessionInsert", () => {
    const futureIso = new Date(Date.now() + 86400000).toISOString();

    it("should accept valid session insert", () => {
      expect(
        decodeAndCheck(SessionInsert, {
          userId: validUuid,
          token: "session-token",
          expiresAt: futureIso,
          ipAddress: null,
          userAgent: null,
        })
      ).toBe(true);
    });

    it("should reject session insert with invalid userId", () => {
      expect(
        decodeAndCheck(SessionInsert, {
          userId: invalidUuid,
          token: "session-token",
          expiresAt: futureIso,
          ipAddress: null,
          userAgent: null,
        })
      ).toBe(false);
    });

    it("should reject session insert with empty token", () => {
      expect(
        decodeAndCheck(SessionInsert, {
          userId: validUuid,
          token: "",
          expiresAt: futureIso,
          ipAddress: null,
          userAgent: null,
        })
      ).toBe(false);
    });
  });

  describe("RoleInsert", () => {
    it("should accept valid role insert", () => {
      expect(
        decodeAndCheck(RoleInsert, {
          name: "admin",
          description: null,
        })
      ).toBe(true);
    });

    it("should reject role insert with invalid name", () => {
      expect(
        decodeAndCheck(RoleInsert, {
          name: "superadmin",
          description: null,
        })
      ).toBe(false);
    });
  });

  describe("PermissionInsert", () => {
    it("should accept valid permission insert", () => {
      expect(
        decodeAndCheck(PermissionInsert, {
          name: "users:read",
          description: null,
        })
      ).toBe(true);
    });

    it("should reject permission insert with invalid name", () => {
      expect(
        decodeAndCheck(PermissionInsert, {
          name: "invalid:permission",
          description: null,
        })
      ).toBe(false);
    });
  });

  describe("UserRoleInsert", () => {
    it("should accept valid user role insert", () => {
      expect(
        decodeAndCheck(UserRoleInsert, {
          userId: validUuid,
          roleId: validUuid,
        })
      ).toBe(true);
    });

    it("should reject user role insert with invalid userId", () => {
      expect(
        decodeAndCheck(UserRoleInsert, {
          userId: invalidUuid,
          roleId: validUuid,
        })
      ).toBe(false);
    });
  });

  describe("RolePermissionInsert", () => {
    it("should accept valid role permission insert", () => {
      expect(
        decodeAndCheck(RolePermissionInsert, {
          roleId: validUuid,
          permissionId: validUuid,
        })
      ).toBe(true);
    });

    it("should reject role permission insert with invalid permissionId", () => {
      expect(
        decodeAndCheck(RolePermissionInsert, {
          roleId: validUuid,
          permissionId: invalidUuid,
        })
      ).toBe(false);
    });
  });
});

// =============================================================================
// Drizzle Schema Structure Tests
// =============================================================================

describe("Drizzle Schema Structure", () => {
  describe("users table", () => {
    it("should have required columns", () => {
      expect(users.id).toBeDefined();
      expect(users.email).toBeDefined();
      expect(users.emailVerified).toBeDefined();
      expect(users.name).toBeDefined();
      expect(users.image).toBeDefined();
      expect(users.createdAt).toBeDefined();
      expect(users.updatedAt).toBeDefined();
    });
  });

  describe("sessions table", () => {
    it("should have required columns", () => {
      expect(sessions.id).toBeDefined();
      expect(sessions.userId).toBeDefined();
      expect(sessions.token).toBeDefined();
      expect(sessions.expiresAt).toBeDefined();
      expect(sessions.createdAt).toBeDefined();
      expect(sessions.updatedAt).toBeDefined();
    });
  });

  describe("accounts table", () => {
    it("should have required columns", () => {
      expect(accounts.id).toBeDefined();
      expect(accounts.userId).toBeDefined();
      expect(accounts.accountId).toBeDefined();
      expect(accounts.providerId).toBeDefined();
      expect(accounts.createdAt).toBeDefined();
      expect(accounts.updatedAt).toBeDefined();
    });
  });

  describe("roles table", () => {
    it("should have required columns", () => {
      expect(roles.id).toBeDefined();
      expect(roles.name).toBeDefined();
      expect(roles.description).toBeDefined();
      expect(roles.createdAt).toBeDefined();
      expect(roles.updatedAt).toBeDefined();
    });
  });

  describe("permissions table", () => {
    it("should have required columns", () => {
      expect(permissions.id).toBeDefined();
      expect(permissions.name).toBeDefined();
      expect(permissions.description).toBeDefined();
      expect(permissions.createdAt).toBeDefined();
      expect(permissions.updatedAt).toBeDefined();
    });
  });

  describe("userRoles table", () => {
    it("should have required columns", () => {
      expect(userRoles.id).toBeDefined();
      expect(userRoles.userId).toBeDefined();
      expect(userRoles.roleId).toBeDefined();
      expect(userRoles.createdAt).toBeDefined();
    });
  });

  describe("rolePermissions table", () => {
    it("should have required columns", () => {
      expect(rolePermissions.id).toBeDefined();
      expect(rolePermissions.roleId).toBeDefined();
      expect(rolePermissions.permissionId).toBeDefined();
      expect(rolePermissions.createdAt).toBeDefined();
    });
  });
});

// =============================================================================
// Constants Tests
// =============================================================================

describe("RBAC Constants", () => {
  describe("DEFAULT_ROLE_PERMISSIONS", () => {
    it("admin should have all permissions", () => {
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("users:read");
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("users:write");
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("posts:read");
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("posts:write");
      expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("posts:delete");
    });

    it("editor should have posts permissions only", () => {
      expect(DEFAULT_ROLE_PERMISSIONS.editor).not.toContain("users:read");
      expect(DEFAULT_ROLE_PERMISSIONS.editor).not.toContain("users:write");
      expect(DEFAULT_ROLE_PERMISSIONS.editor).toContain("posts:read");
      expect(DEFAULT_ROLE_PERMISSIONS.editor).toContain("posts:write");
      expect(DEFAULT_ROLE_PERMISSIONS.editor).toContain("posts:delete");
    });

    it("viewer should have read-only permissions", () => {
      expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("users:read");
      expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("users:write");
      expect(DEFAULT_ROLE_PERMISSIONS.viewer).toContain("posts:read");
      expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("posts:write");
      expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("posts:delete");
    });
  });

  describe("ALL_ROLES", () => {
    it("should contain all expected roles", () => {
      expect(ALL_ROLES).toContain("admin");
      expect(ALL_ROLES).toContain("editor");
      expect(ALL_ROLES).toContain("viewer");
      expect(ALL_ROLES).toHaveLength(3);
    });
  });

  describe("ALL_PERMISSIONS", () => {
    it("should contain all expected permissions", () => {
      expect(ALL_PERMISSIONS).toContain("users:read");
      expect(ALL_PERMISSIONS).toContain("users:write");
      expect(ALL_PERMISSIONS).toContain("posts:read");
      expect(ALL_PERMISSIONS).toContain("posts:write");
      expect(ALL_PERMISSIONS).toContain("posts:delete");
      expect(ALL_PERMISSIONS).toHaveLength(5);
    });
  });
});
