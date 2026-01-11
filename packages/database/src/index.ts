/**
 * @packages/database - Database client and connection management
 *
 * This package provides:
 * - Effect-based PostgreSQL client via @effect/sql-pg
 * - Drizzle integration with Effect via @effect/sql-drizzle
 * - Direct pg Pool for Better Auth
 * - Re-exports Drizzle schemas from @packages/types
 */

// =============================================================================
// Database Client and Layers
// =============================================================================

export {
  SqlLive,
  DrizzleLive,
  DatabaseLive,
  PgPool,
  PgPoolLive,
  getDatabaseUrl,
} from "./client.js";

// =============================================================================
// Re-export Drizzle Schemas from @packages/types
// =============================================================================

export {
  // Tables
  users,
  sessions,
  accounts,
  roles,
  permissions,
  userRoles,
  rolePermissions,
  // Relations
  usersRelations,
  sessionsRelations,
  accountsRelations,
  rolesRelations,
  permissionsRelations,
  userRolesRelations,
  rolePermissionsRelations,
  // Combined schema object
  schema,
} from "@packages/types";

export type {
  UsersTable,
  SessionsTable,
  AccountsTable,
  RolesTable,
  PermissionsTable,
  UserRolesTable,
  RolePermissionsTable,
} from "@packages/types";

// =============================================================================
// Re-export Effect SQL utilities
// =============================================================================

export { PgClient } from "@effect/sql-pg";
export { PgDrizzle } from "@effect/sql-drizzle/Pg";
export { SqlClient } from "@effect/sql";
