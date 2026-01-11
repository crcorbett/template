/**
 * Integration tests for database operations with PostgreSQL
 *
 * These tests verify:
 * 1. Database client can connect to PostgreSQL
 * 2. Effect-wrapped database operations work correctly
 * 3. RBAC queries work with branded types
 * 4. Migration creates expected schema structure
 *
 * IMPORTANT: These tests require a running PostgreSQL instance.
 * Run `docker compose up -d` before running these tests.
 *
 * These tests are skipped by default in CI and when DB is unavailable.
import { SqlClient } from "@effect/sql";
import { SqlLive, PgPool, PgPoolLive } from "@packages/database";
import { UserId, RoleId } from "@packages/types";
import { Effect, Exit, Schema } from "effect";
 */
import { describe, expect, test } from "vitest";

// =============================================================================
// Test Setup
// =============================================================================

/**
 * Check if database is available for integration tests
 * Returns true if PostgreSQL is running and accessible
 */
const isDatabaseAvailable = async (): Promise<boolean> => {
  try {
    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;
      yield* sql`SELECT 1 as check`;
      return true;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(SqlLive), Effect.timeout("2 seconds"))
    );
    return result;
  } catch {
    return false;
  }
};

// Cache the database availability check
let dbAvailablePromise: Promise<boolean> | null = null;
const checkDbAvailable = () => {
  if (!dbAvailablePromise) {
    dbAvailablePromise = isDatabaseAvailable();
  }
  return dbAvailablePromise;
};

/**
 * Clean up test data before each test
 */
const cleanupTestData = Effect.gen(function* () {
  const sql = yield* SqlClient.SqlClient;
  // Delete in reverse order of dependencies
  yield* sql`DELETE FROM role_permissions`;
  yield* sql`DELETE FROM user_roles`;
  yield* sql`DELETE FROM permissions`;
  yield* sql`DELETE FROM roles`;
  yield* sql`DELETE FROM accounts`;
  yield* sql`DELETE FROM sessions`;
  yield* sql`DELETE FROM users`;
});

/**
 * Helper to skip test if DB is not available
 */
const skipIfNoDb = async () => {
  const available = await checkDbAvailable();
  if (!available) {
    console.log("Skipping: PostgreSQL not available");
    return true;
  }
  return false;
};

// =============================================================================
// Database Connection Tests
// =============================================================================

// Skip all integration tests in CI - they require a running PostgreSQL
describe.skipIf(process.env["CI"] === "true")(
  "Database Connection Integration",
  () => {
    test("should connect to PostgreSQL via SqlClient", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const result = yield* sql`SELECT 1 + 1 as sum`;
        return result;
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );
      expect(result).toHaveLength(1);
      expect(result[0]?.sum).toBe(2);
    });

    test("should have correct database version", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const result = yield* sql`SELECT version()`;
        return result[0]?.version as string;
      });

      const version = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );
      expect(version).toContain("PostgreSQL");
    });

    test("should connect to PostgreSQL via pg Pool", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const pool = yield* PgPool;
        const result = yield* Effect.tryPromise(() =>
          pool.query("SELECT 1 + 1 as sum")
        );
        return result.rows[0]?.sum;
      });

      const result = await Effect.runPromise(
        Effect.scoped(program.pipe(Effect.provide(PgPoolLive)))
      );
      expect(result).toBe(2);
    });
  }
);

// =============================================================================
// Schema Migration Tests
// =============================================================================

describe.skipIf(process.env["CI"] === "true")(
  "Schema Migration Integration",
  () => {
    test("should have users table with correct columns", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const result = yield* sql`
          SELECT column_name, data_type, is_nullable
          FROM information_schema.columns
          WHERE table_name = 'users'
          ORDER BY ordinal_position
        `;
        return result;
      });

      const columns = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );
      const columnNames = columns.map((c) => c.columnName);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("email");
      expect(columnNames).toContain("emailVerified");
      expect(columnNames).toContain("name");
      expect(columnNames).toContain("image");
      expect(columnNames).toContain("createdAt");
      expect(columnNames).toContain("updatedAt");
    });

    test("should have sessions table with correct columns", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const result = yield* sql`
          SELECT column_name
          FROM information_schema.columns
          WHERE table_name = 'sessions'
        `;
        return result;
      });

      const columns = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );
      const columnNames = columns.map((c) => c.columnName);

      expect(columnNames).toContain("id");
      expect(columnNames).toContain("userId");
      expect(columnNames).toContain("token");
      expect(columnNames).toContain("expiresAt");
    });

    test("should have roles and permissions tables", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        const rolesCols = yield* sql`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'roles'
        `;
        const permsCols = yield* sql`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'permissions'
        `;

        return { roles: rolesCols, permissions: permsCols };
      });

      const { roles, permissions } = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );

      expect(roles.map((c) => c.columnName)).toContain("name");
      expect(permissions.map((c) => c.columnName)).toContain("name");
    });

    test("should have junction tables for RBAC", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        const userRolesCols = yield* sql`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'user_roles'
        `;
        const rolePermsCols = yield* sql`
          SELECT column_name FROM information_schema.columns WHERE table_name = 'role_permissions'
        `;

        return { userRoles: userRolesCols, rolePerms: rolePermsCols };
      });

      const { userRoles, rolePerms } = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );

      expect(userRoles.map((c) => c.columnName)).toContain("userId");
      expect(userRoles.map((c) => c.columnName)).toContain("roleId");
      expect(rolePerms.map((c) => c.columnName)).toContain("roleId");
      expect(rolePerms.map((c) => c.columnName)).toContain("permissionId");
    });

    test("should have unique constraints on users.email", async () => {
      if (await skipIfNoDb()) return;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;
        const result = yield* sql`
          SELECT tc.constraint_name, kcu.column_name
          FROM information_schema.table_constraints AS tc
          JOIN information_schema.key_column_usage AS kcu
            ON tc.constraint_name = kcu.constraint_name
          WHERE tc.constraint_type = 'UNIQUE'
            AND tc.table_name = 'users'
            AND kcu.column_name = 'email'
        `;
        return result;
      });

      const constraints = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );
      expect(constraints.length).toBeGreaterThan(0);
    });
  }
);

// =============================================================================
// CRUD Operations Tests
// =============================================================================

describe.skipIf(process.env["CI"] === "true")(
  "CRUD Operations Integration",
  () => {
    const cleanup = async () => {
      if (!(await checkDbAvailable())) return;
      await Effect.runPromise(cleanupTestData.pipe(Effect.provide(SqlLive)));
    };

    test("should insert and retrieve a user", async () => {
      if (await skipIfNoDb()) return;
      await cleanup();

      const testEmail = `test-${Date.now()}@example.com`;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        // Insert user
        const inserted = yield* sql`
          INSERT INTO users (email, email_verified, name)
          VALUES (${testEmail}, true, 'Test User')
          RETURNING *
        `;

        // Retrieve user
        const retrieved = yield* sql`
          SELECT * FROM users WHERE email = ${testEmail}
        `;

        return { inserted: inserted[0], retrieved: retrieved[0] };
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );

      expect(result.inserted).toBeDefined();
      expect(result.inserted.email).toBe(testEmail);
      expect(result.inserted.emailVerified).toBe(true);
      expect(result.inserted.name).toBe("Test User");
      expect(result.retrieved.id).toBe(result.inserted.id);

      // Validate ID is a valid UUID (matches UserId schema)
      const userIdResult = Schema.decodeUnknownEither(UserId)(
        result.inserted.id
      );
      expect(userIdResult._tag).toBe("Right");
    });

    test("should enforce unique email constraint", async () => {
      if (await skipIfNoDb()) return;
      await cleanup();

      const testEmail = `unique-${Date.now()}@example.com`;

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        yield* sql`INSERT INTO users (email, email_verified) VALUES (${testEmail}, false)`;
        yield* sql`INSERT INTO users (email, email_verified) VALUES (${testEmail}, false)`;
      });

      const result = await Effect.runPromiseExit(
        program.pipe(Effect.provide(SqlLive))
      );
      expect(Exit.isFailure(result)).toBe(true);
    });

    test("should insert and retrieve a role", async () => {
      if (await skipIfNoDb()) return;
      await cleanup();

      const program = Effect.gen(function* () {
        const sql = yield* SqlClient.SqlClient;

        const inserted = yield* sql`
          INSERT INTO roles (name, description)
          VALUES ('admin', 'Administrator role')
          RETURNING *
        `;

        return inserted[0];
      });

      const result = await Effect.runPromise(
        program.pipe(Effect.provide(SqlLive))
      );

      expect(result).toBeDefined();
      expect(result.name).toBe("admin");
      expect(result.description).toBe("Administrator role");

      // Validate ID is a valid UUID
      const roleIdResult = Schema.decodeUnknownEither(RoleId)(result.id);
      expect(roleIdResult._tag).toBe("Right");
    });
  }
);

// =============================================================================
// RBAC Query Tests
// =============================================================================

describe.skipIf(process.env["CI"] === "true")("RBAC Query Integration", () => {
  const cleanup = async () => {
    if (!(await checkDbAvailable())) return;
    await Effect.runPromise(cleanupTestData.pipe(Effect.provide(SqlLive)));
  };

  test("should assign a role to a user", async () => {
    if (await skipIfNoDb()) return;
    await cleanup();

    const testEmail = `rbac-${Date.now()}@example.com`;

    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const [user] = yield* sql`
        INSERT INTO users (email, email_verified) VALUES (${testEmail}, true) RETURNING id
      `;

      const [role] = yield* sql`
        INSERT INTO roles (name, description) VALUES ('admin', 'Administrator') RETURNING id
      `;

      yield* sql`INSERT INTO user_roles (user_id, role_id) VALUES (${user.id}, ${role.id})`;

      const userRoles = yield* sql`
        SELECT r.name FROM roles r JOIN user_roles ur ON ur.role_id = r.id WHERE ur.user_id = ${user.id}
      `;

      return { userId: user.id, roles: userRoles };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(SqlLive))
    );

    expect(result.roles).toHaveLength(1);
    expect(result.roles[0].name).toBe("admin");
  });

  test("should query user permissions through roles", async () => {
    if (await skipIfNoDb()) return;
    await cleanup();

    const testEmail = `perm-${Date.now()}@example.com`;

    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const [user] =
        yield* sql`INSERT INTO users (email, email_verified) VALUES (${testEmail}, true) RETURNING id`;
      const [role] =
        yield* sql`INSERT INTO roles (name) VALUES ('editor') RETURNING id`;
      const [perm1] =
        yield* sql`INSERT INTO permissions (name) VALUES ('posts:read') RETURNING id`;
      const [perm2] =
        yield* sql`INSERT INTO permissions (name) VALUES ('posts:write') RETURNING id`;

      yield* sql`INSERT INTO role_permissions (role_id, permission_id) VALUES (${role.id}, ${perm1.id}), (${role.id}, ${perm2.id})`;
      yield* sql`INSERT INTO user_roles (user_id, role_id) VALUES (${user.id}, ${role.id})`;

      const permissions = yield* sql`
        SELECT DISTINCT p.name FROM permissions p
        JOIN role_permissions rp ON rp.permission_id = p.id
        JOIN user_roles ur ON ur.role_id = rp.role_id
        WHERE ur.user_id = ${user.id} ORDER BY p.name
      `;

      return permissions;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(SqlLive))
    );

    expect(result).toHaveLength(2);
    expect(result[0].name).toBe("posts:read");
    expect(result[1].name).toBe("posts:write");
  });

  test("should check if user has specific permission", async () => {
    if (await skipIfNoDb()) return;
    await cleanup();

    const testEmail = `check-${Date.now()}@example.com`;

    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const [user] =
        yield* sql`INSERT INTO users (email, email_verified) VALUES (${testEmail}, true) RETURNING id`;
      const [role] =
        yield* sql`INSERT INTO roles (name) VALUES ('viewer') RETURNING id`;
      const [perm] =
        yield* sql`INSERT INTO permissions (name) VALUES ('posts:read') RETURNING id`;

      yield* sql`INSERT INTO role_permissions (role_id, permission_id) VALUES (${role.id}, ${perm.id})`;
      yield* sql`INSERT INTO user_roles (user_id, role_id) VALUES (${user.id}, ${role.id})`;

      const hasPermission = yield* sql`
        SELECT EXISTS (
          SELECT 1 FROM permissions p
          JOIN role_permissions rp ON rp.permission_id = p.id
          JOIN user_roles ur ON ur.role_id = rp.role_id
          WHERE ur.user_id = ${user.id} AND p.name = 'posts:read'
        ) as has_permission
      `;

      const noPermission = yield* sql`
        SELECT EXISTS (
          SELECT 1 FROM permissions p
          JOIN role_permissions rp ON rp.permission_id = p.id
          JOIN user_roles ur ON ur.role_id = rp.role_id
          WHERE ur.user_id = ${user.id} AND p.name = 'posts:delete'
        ) as has_permission
      `;

      return {
        hasPostsRead: hasPermission[0].hasPermission,
        hasPostsDelete: noPermission[0].hasPermission,
      };
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(SqlLive))
    );

    expect(result.hasPostsRead).toBe(true);
    expect(result.hasPostsDelete).toBe(false);
  });

  test("should cascade delete user roles when user is deleted", async () => {
    if (await skipIfNoDb()) return;
    await cleanup();

    const testEmail = `cascade-${Date.now()}@example.com`;

    const program = Effect.gen(function* () {
      const sql = yield* SqlClient.SqlClient;

      const [user] =
        yield* sql`INSERT INTO users (email, email_verified) VALUES (${testEmail}, true) RETURNING id`;
      const [role] =
        yield* sql`INSERT INTO roles (name) VALUES ('admin') RETURNING id`;

      yield* sql`INSERT INTO user_roles (user_id, role_id) VALUES (${user.id}, ${role.id})`;
      yield* sql`DELETE FROM users WHERE id = ${user.id}`;

      const remainingRoles =
        yield* sql`SELECT * FROM user_roles WHERE user_id = ${user.id}`;

      return remainingRoles;
    });

    const result = await Effect.runPromise(
      program.pipe(Effect.provide(SqlLive))
    );

    expect(result).toHaveLength(0);
  });
});
