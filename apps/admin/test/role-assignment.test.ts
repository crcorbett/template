/**
 * Tests for role assignment logic with branded types
 *
 * Tests:
 * 1. Role assignment with branded UserId, RoleId, RoleName types
 * 2. Permission derivation from roles
 * 3. Multiple role handling
 * 4. Role hierarchy behavior
 */
import { describe, expect, it } from "vitest";
import { Effect, Schema } from "effect";

import {
  UserId,
  RoleId,
  RoleName as RoleNameSchema,
  PermissionString as PermissionStringSchema,
  UserRole,
  UserRoleInsert,
  Role,
  RoleInsert,
  UserWithRoles,
  DEFAULT_ROLE_PERMISSIONS,
  ALL_ROLES,
  ALL_PERMISSIONS,
} from "@packages/types";

import {
  getUserRoles,
  hasPermission,
  PermissionsService,
} from "$/lib/effect/services/permissions";

import {
  createMockPermissionsLayer,
  createMockUserId,
  TEST_USER_ID,
} from "./setup";

// =============================================================================
// Branded Type Validation Tests
// =============================================================================

describe("Role Assignment Branded Types", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";
  const validUuid2 = "550e8400-e29b-41d4-a716-446655440001";
  const nowIso = new Date().toISOString();

  describe("UserId", () => {
    it("should validate UUID format", () => {
      const result = Schema.decodeUnknownSync(UserId)(validUuid);
      expect(result).toBe(validUuid);
    });

    it("should reject invalid UUID", () => {
      expect(() => Schema.decodeUnknownSync(UserId)("not-a-uuid")).toThrow();
    });
  });

  describe("RoleId", () => {
    it("should validate UUID format", () => {
      const result = Schema.decodeUnknownSync(RoleId)(validUuid);
      expect(result).toBe(validUuid);
    });

    it("should reject invalid UUID", () => {
      expect(() => Schema.decodeUnknownSync(RoleId)("invalid")).toThrow();
    });
  });

  describe("RoleName", () => {
    it.each(ALL_ROLES)('should accept "%s" as valid role name', (role) => {
      const result = Schema.decodeUnknownSync(RoleNameSchema)(role);
      expect(result).toBe(role);
    });

    it("should reject invalid role name", () => {
      expect(() =>
        Schema.decodeUnknownSync(RoleNameSchema)("superadmin")
      ).toThrow();
    });
  });

  describe("UserRole junction", () => {
    it("should validate user-role assignment", () => {
      const result = Schema.decodeUnknownSync(UserRole)({
        id: validUuid,
        userId: validUuid,
        roleId: validUuid2,
        createdAt: nowIso,
      });

      expect(result.userId).toBe(validUuid);
      expect(result.roleId).toBe(validUuid2);
    });

    it("should reject invalid userId in assignment", () => {
      expect(() =>
        Schema.decodeUnknownSync(UserRole)({
          id: validUuid,
          userId: "invalid",
          roleId: validUuid2,
          createdAt: nowIso,
        })
      ).toThrow();
    });
  });

  describe("UserRoleInsert", () => {
    it("should validate role assignment insert", () => {
      const result = Schema.decodeUnknownSync(UserRoleInsert)({
        userId: validUuid,
        roleId: validUuid2,
      });

      expect(result.userId).toBe(validUuid);
      expect(result.roleId).toBe(validUuid2);
    });
  });

  describe("Role entity", () => {
    it("should validate role with admin name", () => {
      const result = Schema.decodeUnknownSync(Role)({
        id: validUuid,
        name: "admin",
        description: "Administrator role with full access",
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      expect(result.name).toBe("admin");
      expect(result.description).toBe("Administrator role with full access");
    });

    it("should validate role with null description", () => {
      const result = Schema.decodeUnknownSync(Role)({
        id: validUuid,
        name: "viewer",
        description: null,
        createdAt: nowIso,
        updatedAt: nowIso,
      });

      expect(result.description).toBeNull();
    });
  });

  describe("RoleInsert", () => {
    it("should validate role creation", () => {
      const result = Schema.decodeUnknownSync(RoleInsert)({
        name: "editor",
        description: "Can edit posts",
      });

      expect(result.name).toBe("editor");
    });

    it("should reject invalid role name in insert", () => {
      expect(() =>
        Schema.decodeUnknownSync(RoleInsert)({
          name: "moderator",
          description: null,
        })
      ).toThrow();
    });
  });
});

// =============================================================================
// UserWithRoles Schema Tests
// =============================================================================

describe("UserWithRoles Schema", () => {
  const validUuid = "550e8400-e29b-41d4-a716-446655440000";

  it("should validate user with single role", () => {
    const result = Schema.decodeUnknownSync(UserWithRoles)({
      userId: validUuid,
      roles: ["admin"],
      permissions: ["users:read", "users:write"],
    });

    expect(result.roles).toContain("admin");
    expect(result.permissions).toContain("users:read");
  });

  it("should validate user with multiple roles", () => {
    const result = Schema.decodeUnknownSync(UserWithRoles)({
      userId: validUuid,
      roles: ["editor", "viewer"],
      permissions: ["posts:read", "posts:write", "posts:delete"],
    });

    expect(result.roles).toHaveLength(2);
    expect(result.roles).toContain("editor");
    expect(result.roles).toContain("viewer");
  });

  it("should validate user with no roles", () => {
    const result = Schema.decodeUnknownSync(UserWithRoles)({
      userId: validUuid,
      roles: [],
      permissions: [],
    });

    expect(result.roles).toHaveLength(0);
    expect(result.permissions).toHaveLength(0);
  });

  it("should reject invalid role in roles array", () => {
    expect(() =>
      Schema.decodeUnknownSync(UserWithRoles)({
        userId: validUuid,
        roles: ["admin", "invalid_role"],
        permissions: [],
      })
    ).toThrow();
  });

  it("should reject invalid permission in permissions array", () => {
    expect(() =>
      Schema.decodeUnknownSync(UserWithRoles)({
        userId: validUuid,
        roles: ["admin"],
        permissions: ["users:read", "invalid:permission"],
      })
    ).toThrow();
  });
});

// =============================================================================
// Permission Derivation Tests
// =============================================================================

describe("Permission Derivation from Roles", () => {
  describe("Admin role permissions", () => {
    it("should have all permissions", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map([
        [TEST_USER_ID, ["admin" as const]],
      ]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      // Admin should have exactly the permissions defined in DEFAULT_ROLE_PERMISSIONS
      for (const perm of DEFAULT_ROLE_PERMISSIONS.admin) {
        expect(result.permissions).toContain(perm);
      }
    });

    it("should have users:read and users:write", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const permission = Schema.decodeUnknownSync(PermissionStringSchema)(
        "users:write"
      );
      const userRolesMap = new Map([
        [TEST_USER_ID, ["admin" as const]],
      ]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = hasPermission(userId, permission);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result).toBe(true);
    });
  });

  describe("Editor role permissions", () => {
    it("should have posts permissions but not users permissions", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map([
        [TEST_USER_ID, ["editor" as const]],
      ]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      // Editor should have posts permissions
      expect(result.permissions).toContain("posts:read");
      expect(result.permissions).toContain("posts:write");
      expect(result.permissions).toContain("posts:delete");

      // Editor should NOT have users permissions
      expect(result.permissions).not.toContain("users:read");
      expect(result.permissions).not.toContain("users:write");
    });
  });

  describe("Viewer role permissions", () => {
    it("should only have posts:read", async () => {
      const userId = createMockUserId(TEST_USER_ID);
      const userRolesMap = new Map([
        [TEST_USER_ID, ["viewer" as const]],
      ]);
      const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

      const effect = getUserRoles(userId);
      const result = await Effect.runPromise(
        effect.pipe(Effect.provide(testLayer))
      );

      expect(result.permissions).toHaveLength(1);
      expect(result.permissions).toContain("posts:read");
    });
  });
});

// =============================================================================
// Multiple Role Handling Tests
// =============================================================================

describe("Multiple Role Assignment", () => {
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

    // Should have both editor and viewer in roles
    expect(result.roles).toContain("editor");
    expect(result.roles).toContain("viewer");

    // Permissions should be combined (union of both)
    expect(result.permissions).toContain("posts:read");
    expect(result.permissions).toContain("posts:write");
    expect(result.permissions).toContain("posts:delete");
  });

  it("should deduplicate permissions from overlapping roles", async () => {
    const userId = createMockUserId(TEST_USER_ID);
    // Admin includes all permissions, viewer adds posts:read which is already included
    const userRolesMap = new Map([
      [TEST_USER_ID, ["admin" as const, "viewer" as const]],
    ]);
    const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

    const effect = getUserRoles(userId);
    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    // Should have both roles
    expect(result.roles).toHaveLength(2);

    // posts:read should appear only once (deduplicated)
    const postsReadCount = result.permissions.filter(
      (p: string) => p === "posts:read"
    ).length;
    expect(postsReadCount).toBe(1);
  });
});

// =============================================================================
// hasAnyRole Tests
// =============================================================================

describe("hasAnyRole", () => {
  it("should return true when user has at least one required role", async () => {
    const userId = createMockUserId(TEST_USER_ID);
    const userRolesMap = new Map([
      [TEST_USER_ID, ["editor" as const]],
    ]);
    const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

    const effect = Effect.flatMap(PermissionsService, (service) =>
      service.hasAnyRole(userId, [
        Schema.decodeUnknownSync(RoleNameSchema)("admin"),
        Schema.decodeUnknownSync(RoleNameSchema)("editor"),
      ])
    );

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toBe(true);
  });

  it("should return false when user has none of the required roles", async () => {
    const userId = createMockUserId(TEST_USER_ID);
    const userRolesMap = new Map([
      [TEST_USER_ID, ["viewer" as const]],
    ]);
    const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

    const effect = Effect.flatMap(PermissionsService, (service) =>
      service.hasAnyRole(userId, [
        Schema.decodeUnknownSync(RoleNameSchema)("admin"),
        Schema.decodeUnknownSync(RoleNameSchema)("editor"),
      ])
    );

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toBe(false);
  });
});

// =============================================================================
// hasAllPermissions Tests
// =============================================================================

describe("hasAllPermissions", () => {
  it("should return true when user has all required permissions", async () => {
    const userId = createMockUserId(TEST_USER_ID);
    const userRolesMap = new Map([
      [TEST_USER_ID, ["admin" as const]],
    ]);
    const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

    const effect = Effect.flatMap(PermissionsService, (service) =>
      service.hasAllPermissions(userId, [
        Schema.decodeUnknownSync(PermissionStringSchema)("users:read"),
        Schema.decodeUnknownSync(PermissionStringSchema)("users:write"),
      ])
    );

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toBe(true);
  });

  it("should return false when user is missing some permissions", async () => {
    const userId = createMockUserId(TEST_USER_ID);
    const userRolesMap = new Map([
      [TEST_USER_ID, ["editor" as const]],
    ]);
    const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

    const effect = Effect.flatMap(PermissionsService, (service) =>
      service.hasAllPermissions(userId, [
        Schema.decodeUnknownSync(PermissionStringSchema)("posts:read"),
        Schema.decodeUnknownSync(PermissionStringSchema)("users:read"), // editor doesn't have this
      ])
    );

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toBe(false);
  });

  it("should return true for empty permissions array", async () => {
    const userId = createMockUserId(TEST_USER_ID);
    const userRolesMap = new Map([
      [TEST_USER_ID, ["viewer" as const]],
    ]);
    const testLayer = createMockPermissionsLayer({ userRoles: userRolesMap });

    const effect = Effect.flatMap(PermissionsService, (service) =>
      service.hasAllPermissions(userId, [])
    );

    const result = await Effect.runPromise(
      effect.pipe(Effect.provide(testLayer))
    );

    expect(result).toBe(true);
  });
});

// =============================================================================
// Role Hierarchy Tests
// =============================================================================

describe("Role Hierarchy Behavior", () => {
  it("admin should have superset of editor permissions", () => {
    const adminPerms = new Set(DEFAULT_ROLE_PERMISSIONS.admin);
    const editorPerms = DEFAULT_ROLE_PERMISSIONS.editor;

    for (const perm of editorPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it("admin should have superset of viewer permissions", () => {
    const adminPerms = new Set(DEFAULT_ROLE_PERMISSIONS.admin);
    const viewerPerms = DEFAULT_ROLE_PERMISSIONS.viewer;

    for (const perm of viewerPerms) {
      expect(adminPerms.has(perm)).toBe(true);
    }
  });

  it("editor should have superset of viewer permissions", () => {
    const editorPerms = new Set(DEFAULT_ROLE_PERMISSIONS.editor);
    const viewerPerms = DEFAULT_ROLE_PERMISSIONS.viewer;

    for (const perm of viewerPerms) {
      expect(editorPerms.has(perm)).toBe(true);
    }
  });

  it("admin should have more permissions than editor", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.admin.length).toBeGreaterThan(
      DEFAULT_ROLE_PERMISSIONS.editor.length
    );
  });

  it("editor should have more permissions than viewer", () => {
    expect(DEFAULT_ROLE_PERMISSIONS.editor.length).toBeGreaterThan(
      DEFAULT_ROLE_PERMISSIONS.viewer.length
    );
  });
});

// =============================================================================
// ALL_ROLES and ALL_PERMISSIONS Tests
// =============================================================================

describe("Role and Permission Constants", () => {
  describe("ALL_ROLES", () => {
    it("should contain exactly admin, editor, viewer", () => {
      expect(ALL_ROLES).toHaveLength(3);
      expect(ALL_ROLES).toContain("admin");
      expect(ALL_ROLES).toContain("editor");
      expect(ALL_ROLES).toContain("viewer");
    });

    it("should match DEFAULT_ROLE_PERMISSIONS keys", () => {
      const rolePermKeys = Object.keys(DEFAULT_ROLE_PERMISSIONS);
      expect(rolePermKeys).toHaveLength(ALL_ROLES.length);
      for (const role of ALL_ROLES) {
        expect(rolePermKeys).toContain(role);
      }
    });
  });

  describe("ALL_PERMISSIONS", () => {
    it("should contain all defined permissions", () => {
      expect(ALL_PERMISSIONS).toHaveLength(5);
      expect(ALL_PERMISSIONS).toContain("users:read");
      expect(ALL_PERMISSIONS).toContain("users:write");
      expect(ALL_PERMISSIONS).toContain("posts:read");
      expect(ALL_PERMISSIONS).toContain("posts:write");
      expect(ALL_PERMISSIONS).toContain("posts:delete");
    });

    it("all permissions should be assignable to some role", () => {
      const allAssignedPerms = new Set<string>();
      for (const role of Object.values(DEFAULT_ROLE_PERMISSIONS)) {
        for (const perm of role) {
          allAssignedPerms.add(perm);
        }
      }

      for (const perm of ALL_PERMISSIONS) {
        expect(allAssignedPerms.has(perm)).toBe(true);
      }
    });
  });
});
