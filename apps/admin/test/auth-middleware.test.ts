/**
 * Tests for auth middleware functionality
 *
 * Tests:
 * 1. requireAuth middleware behavior
 * 2. requireRole middleware with branded RoleName types
 * 3. requirePermission middleware with branded PermissionString types
 * 4. Error handling and response codes
 * 5. Middleware composition patterns
 */
import {
  InsufficientRoleError,
  InsufficientPermissionError,
  getUserRoles,
  hasRole,
  hasPermission,
  requireRole,
  requirePermission,
} from "$/lib/effect/services/permissions";
import {
  RoleName as RoleNameSchema,
  PermissionString as PermissionStringSchema,
  DEFAULT_ROLE_PERMISSIONS,
} from "@packages/types";
import { Effect, Exit, Layer, Schema } from "effect";
import { describe, expect, it } from "vitest";

import {
  createMockAuthContext,
  createMockAuthLayer,
  createMockPermissionsLayer,
  createMockUserId,
  TEST_USER_ID,
} from "./setup";

// =============================================================================
// Branded Type Schema Tests
// =============================================================================

describe("Middleware Branded Type Validation", () => {
  describe("RoleName Schema", () => {
    it.each(["admin", "editor", "viewer"] as const)(
      'should accept "%s" role',
      (role) => {
        const result = Schema.decodeUnknownSync(RoleNameSchema)(role);
        expect(result).toBe(role);
      }
    );

    it("should reject invalid role names", () => {
      expect(() =>
        Schema.decodeUnknownSync(RoleNameSchema)("superuser")
      ).toThrow();
    });

    it("should reject empty string", () => {
      expect(() => Schema.decodeUnknownSync(RoleNameSchema)("")).toThrow();
    });
  });

  describe("PermissionString Schema", () => {
    it.each([
      "users:read",
      "users:write",
      "posts:read",
      "posts:write",
      "posts:delete",
    ] as const)('should accept "%s" permission', (permission) => {
      const result = Schema.decodeUnknownSync(PermissionStringSchema)(
        permission
      );
      expect(result).toBe(permission);
    });

    it("should reject invalid permission format", () => {
      expect(() =>
        Schema.decodeUnknownSync(PermissionStringSchema)("invalid:permission")
      ).toThrow();
    });

    it("should reject non-existent resource", () => {
      expect(() =>
        Schema.decodeUnknownSync(PermissionStringSchema)("comments:read")
      ).toThrow();
    });
  });
});

// =============================================================================
// Permission Error Type Tests
// =============================================================================

describe("Permission Error Types", () => {
  describe("InsufficientRoleError", () => {
    it("should create error with all required fields", () => {
      const userId = createMockUserId();
      const requiredRole = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      const userRoles = [Schema.decodeUnknownSync(RoleNameSchema)("viewer")];

      const error = new InsufficientRoleError({
        userId,
        requiredRole,
        userRoles,
        message: "User does not have admin role",
      });

      expect(error._tag).toBe("InsufficientRoleError");
      expect(error.userId).toBe(userId);
      expect(error.requiredRole).toBe("admin");
      expect(error.userRoles).toEqual(["viewer"]);
      expect(error.message).toBe("User does not have admin role");
    });
  });

  describe("InsufficientPermissionError", () => {
    it("should create error with all required fields", () => {
      const userId = createMockUserId();
      const requiredPermission = Schema.decodeUnknownSync(
        PermissionStringSchema
      )("users:write");
      const userPermissions = [
        Schema.decodeUnknownSync(PermissionStringSchema)("posts:read"),
      ];

      const error = new InsufficientPermissionError({
        userId,
        requiredPermission,
        userPermissions,
        message: "User does not have users:write permission",
      });

      expect(error._tag).toBe("InsufficientPermissionError");
      expect(error.userId).toBe(userId);
      expect(error.requiredPermission).toBe("users:write");
      expect(error.userPermissions).toEqual(["posts:read"]);
    });
  });
});

// =============================================================================
// PermissionsService Tests
// =============================================================================

describe("PermissionsService", () => {
  describe("getUserRoles", () => {
    it("should return user roles and computed permissions for admin", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map([[TEST_USER_ID, ["admin" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.userId).toBe(TEST_USER_ID);
      expect(result.roles).toContain("admin");
      // Admin should have all permissions
      expect(result.permissions).toContain("users:read");
      expect(result.permissions).toContain("users:write");
      expect(result.permissions).toContain("posts:read");
      expect(result.permissions).toContain("posts:write");
      expect(result.permissions).toContain("posts:delete");
    });

    it("should return editor permissions for editor role", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map([[TEST_USER_ID, ["editor" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.roles).toContain("editor");
      // Editor should not have user permissions
      expect(result.permissions).not.toContain("users:read");
      expect(result.permissions).not.toContain("users:write");
      // Editor should have post permissions
      expect(result.permissions).toContain("posts:read");
      expect(result.permissions).toContain("posts:write");
      expect(result.permissions).toContain("posts:delete");
    });

    it("should return viewer permissions for viewer role", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.roles).toContain("viewer");
      // Viewer should only have posts:read
      expect(result.permissions).toContain("posts:read");
      expect(result.permissions).not.toContain("posts:write");
      expect(result.permissions).not.toContain("posts:delete");
      expect(result.permissions).not.toContain("users:read");
    });

    it("should return empty roles for user with no roles", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map<string, ("admin" | "editor" | "viewer")[]>();
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.roles).toHaveLength(0);
      expect(result.permissions).toHaveLength(0);
    });

    it("should combine permissions from multiple roles", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map([
        [TEST_USER_ID, ["editor" as const, "viewer" as const]],
      ]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.roles).toContain("editor");
      expect(result.roles).toContain("viewer");
      // Should have combined permissions (editor + viewer)
      expect(result.permissions).toContain("posts:read");
      expect(result.permissions).toContain("posts:write");
      expect(result.permissions).toContain("posts:delete");
    });
  });

  describe("hasRole", () => {
    it("should return true when user has the role", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const role = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      const userRolesMap = new Map([[TEST_USER_ID, ["admin" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = hasRole(userId, role);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toBe(true);
    });

    it("should return false when user does not have the role", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const role = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = hasRole(userId, role);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toBe(false);
    });
  });

  describe("hasPermission", () => {
    it("should return true when user has the permission via role", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const permission = Schema.decodeUnknownSync(PermissionStringSchema)(
        "users:read"
      );
      const userRolesMap = new Map([[TEST_USER_ID, ["admin" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = hasPermission(userId, permission);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toBe(true);
    });

    it("should return false when user lacks the permission", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const permission = Schema.decodeUnknownSync(PermissionStringSchema)(
        "users:read"
      );
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = hasPermission(userId, permission);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toBe(false);
    });
  });

  describe("requireRole", () => {
    it("should succeed when user has required role", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const role = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      const userRolesMap = new Map([[TEST_USER_ID, ["admin" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = requireRole(userId, role);
      const exit = await Effect.runPromiseExit(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail with InsufficientRoleError when user lacks role", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const role = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = requireRole(userId, role);
      const exit = await Effect.runPromiseExit(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should allow catching InsufficientRoleError", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const role = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = requireRole(userId, role).pipe(
        Effect.catchTag("InsufficientRoleError", (error) =>
          Effect.succeed({
            caught: true,
            requiredRole: error.requiredRole,
            userRoles: error.userRoles,
          })
        )
      );

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toEqual({
        caught: true,
        requiredRole: "admin",
        userRoles: ["viewer"],
      });
    });
  });

  describe("requirePermission", () => {
    it("should succeed when user has required permission", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const permission = Schema.decodeUnknownSync(PermissionStringSchema)(
        "posts:read"
      );
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = requirePermission(userId, permission);
      const exit = await Effect.runPromiseExit(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Exit.isSuccess(exit)).toBe(true);
    });

    it("should fail with InsufficientPermissionError when user lacks permission", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const permission = Schema.decodeUnknownSync(PermissionStringSchema)(
        "users:write"
      );
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = requirePermission(userId, permission);
      const exit = await Effect.runPromiseExit(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(Exit.isFailure(exit)).toBe(true);
    });

    it("should allow catching InsufficientPermissionError", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const permission = Schema.decodeUnknownSync(PermissionStringSchema)(
        "users:write"
      );
      const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = requirePermission(userId, permission).pipe(
        Effect.catchTag("InsufficientPermissionError", (error) =>
          Effect.succeed({
            caught: true,
            requiredPermission: error.requiredPermission,
          })
        )
      );

      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toEqual({
        caught: true,
        requiredPermission: "users:write",
      });
    });
  });
});

// =============================================================================
// DEFAULT_ROLE_PERMISSIONS Tests
// =============================================================================

describe("DEFAULT_ROLE_PERMISSIONS", () => {
  it("admin should have all permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("users:read");
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("users:write");
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("posts:read");
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("posts:write");
    expect(DEFAULT_ROLE_PERMISSIONS.admin).toContain("posts:delete");
  });

  it("editor should have posts permissions but not users permissions", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.editor).not.toContain("users:read");
    expect(DEFAULT_ROLE_PERMISSIONS.editor).not.toContain("users:write");
    expect(DEFAULT_ROLE_PERMISSIONS.editor).toContain("posts:read");
    expect(DEFAULT_ROLE_PERMISSIONS.editor).toContain("posts:write");
    expect(DEFAULT_ROLE_PERMISSIONS.editor).toContain("posts:delete");
  });

  it("viewer should only have posts:read permission", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.viewer).toContain("posts:read");
    expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("posts:write");
    expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("posts:delete");
    expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("users:read");
    expect(DEFAULT_ROLE_PERMISSIONS.viewer).not.toContain("users:write");
  });
});

// =============================================================================
// Middleware Service Layer Pattern Tests
// =============================================================================

describe("Middleware Service Layer Pattern", () => {
  it("should allow composing auth and permissions services", async () => {
    const authContext = createMockAuthContext({ userId: TEST_USER_ID });
    const authLayer = createMockAuthLayer({ session: authContext });
    const userRolesMap = new Map([[TEST_USER_ID, ["admin" as const]]]);
    const permissionsLayer = createMockPermissionsLayer({
      userRoles: userRolesMap,
    });
    const combinedLayer = Layer.mergeAll(authLayer, permissionsLayer);

    const effect = Effect.gen(function* () {
      const userId = createMockUserId(TEST_USER_ID);
      const role = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      yield* requireRole(userId, role);
      return { authorized: true };
    });

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(combinedLayer))
    );

    expect(result).toEqual({ authorized: true });
  });

  it("should fail when auth passes but permissions fail", async () => {
    const authContext = createMockAuthContext({ userId: TEST_USER_ID });
    const authLayer = createMockAuthLayer({ session: authContext });
    const userRolesMap = new Map([[TEST_USER_ID, ["viewer" as const]]]);
    const permissionsLayer = createMockPermissionsLayer({
      userRoles: userRolesMap,
    });
    const combinedLayer = Layer.mergeAll(authLayer, permissionsLayer);

    const effect = Effect.gen(function* () {
      const userId = createMockUserId(TEST_USER_ID);
      const role = Schema.decodeUnknownSync(RoleNameSchema)("admin");
      yield* requireRole(userId, role);
      return { authorized: true };
    });

    const exit = await Effect.runPromiseExit(
      effect.pipe(Effect.provide(combinedLayer))
    );

    expect(Exit.isFailure(exit)).toBe(true);
  });
});
