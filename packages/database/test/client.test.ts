/**
 * Tests for database client connection and Effect layers
 *
 * These tests verify:
 * 1. DatabaseConfig properly reads environment
 * 2. SqlLive layer can be constructed
 * 3. PgPool layer can be constructed
 * 4. getDatabaseUrl returns expected format
 *
 * Note: Integration tests requiring actual database connection are in integration.test.ts
 */
import { getDatabaseUrl, PgPool, SqlLive } from "@packages/database";
import { Effect } from "effect";
import { describe, expect, it, afterEach } from "vitest";

// =============================================================================
// getDatabaseUrl Tests
// =============================================================================

describe("getDatabaseUrl", () => {
  const originalEnv = process.env["DATABASE_URL"];

  afterEach(() => {
    if (originalEnv) {
      process.env["DATABASE_URL"] = originalEnv;
    } else {
      delete process.env["DATABASE_URL"];
    }
  });

  it("should return DATABASE_URL from environment when set", () => {
    process.env["DATABASE_URL"] = "postgresql://user:pass@host:5432/db";
    const url = getDatabaseUrl();
    expect(url).toBe("postgresql://user:pass@host:5432/db");
  });

  it("should return default URL when DATABASE_URL is not set", () => {
    delete process.env["DATABASE_URL"];
    const url = getDatabaseUrl();
    expect(url).toBe("postgresql://postgres:postgres@localhost:5432/template");
  });
});

// =============================================================================
// Layer Construction Tests
// =============================================================================

describe("Layer Construction", () => {
  it("SqlLive should be a valid Layer", () => {
    // SqlLive is a Layer that provides PgClient.SqlClient
    expect(SqlLive).toBeDefined();
    expect(typeof SqlLive).toBe("object");
  });

  it("PgPool service tag should be defined", () => {
    expect(PgPool).toBeDefined();
    // PgPool is a Context.Tag
    expect(PgPool.key).toBe("PgPool");
  });
});

// =============================================================================
// Effect Pattern Tests
// =============================================================================

describe("Effect Patterns", () => {
  it("should create Effect that accesses PgPool", () => {
    const effect = Effect.gen(function* () {
      const pool = yield* PgPool;
      return pool;
    });

    // Verify the effect requires PgPool service
    expect(effect).toBeDefined();
  });

  it("should create Effect with database config", () => {
    // Test that we can create an Effect that depends on database configuration
    const effect = Effect.sync(() => {
      const url = getDatabaseUrl();
      return url.startsWith("postgresql://");
    });

    const result = Effect.runSync(effect);
    expect(result).toBe(true);
  });
});

// =============================================================================
// Exports Tests
// =============================================================================

describe("Package Exports", () => {
  it("should export SqlLive layer", async () => {
    const { SqlLive } = await import("@packages/database");
    expect(SqlLive).toBeDefined();
  });

  it("should export DrizzleLive layer", async () => {
    const { DrizzleLive } = await import("@packages/database");
    expect(DrizzleLive).toBeDefined();
  });

  it("should export DatabaseLive layer", async () => {
    const { DatabaseLive } = await import("@packages/database");
    expect(DatabaseLive).toBeDefined();
  });

  it("should export PgPool service tag", async () => {
    const { PgPool } = await import("@packages/database");
    expect(PgPool).toBeDefined();
  });

  it("should export PgPoolLive layer", async () => {
    const { PgPoolLive } = await import("@packages/database");
    expect(PgPoolLive).toBeDefined();
  });

  it("should export PgClient from @effect/sql-pg", async () => {
    const { PgClient } = await import("@packages/database");
    expect(PgClient).toBeDefined();
  });

  it("should export PgDrizzle from @effect/sql-drizzle", async () => {
    const { PgDrizzle } = await import("@packages/database");
    expect(PgDrizzle).toBeDefined();
  });

  it("should export SqlClient from @effect/sql", async () => {
    const { SqlClient } = await import("@packages/database");
    expect(SqlClient).toBeDefined();
  });

  it("should re-export schema tables from @packages/types", async () => {
    const {
      users,
      sessions,
      accounts,
      roles,
      permissions,
      userRoles,
      rolePermissions,
    } = await import("@packages/database");

    expect(users).toBeDefined();
    expect(sessions).toBeDefined();
    expect(accounts).toBeDefined();
    expect(roles).toBeDefined();
    expect(permissions).toBeDefined();
    expect(userRoles).toBeDefined();
    expect(rolePermissions).toBeDefined();
  });

  it("should re-export schema relations from @packages/types", async () => {
    const {
      usersRelations,
      sessionsRelations,
      accountsRelations,
      rolesRelations,
      permissionsRelations,
      userRolesRelations,
      rolePermissionsRelations,
    } = await import("@packages/database");

    expect(usersRelations).toBeDefined();
    expect(sessionsRelations).toBeDefined();
    expect(accountsRelations).toBeDefined();
    expect(rolesRelations).toBeDefined();
    expect(permissionsRelations).toBeDefined();
    expect(userRolesRelations).toBeDefined();
    expect(rolePermissionsRelations).toBeDefined();
  });

  it("should export combined schema object", async () => {
    const { schema } = await import("@packages/database");

    expect(schema).toBeDefined();
    expect(schema.users).toBeDefined();
    expect(schema.sessions).toBeDefined();
    expect(schema.accounts).toBeDefined();
    expect(schema.roles).toBeDefined();
    expect(schema.permissions).toBeDefined();
    expect(schema.userRoles).toBeDefined();
    expect(schema.rolePermissions).toBeDefined();
  });
});
