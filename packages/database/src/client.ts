/**
 * Database client using Effect for PostgreSQL
 *
 * This module provides two database access patterns:
 * 1. Effect-based client via @effect/sql-pg for app-specific queries
 * 2. Direct pg Pool for Better Auth (needs synchronous access at config time)
 *
 * Both use the same DATABASE_URL environment variable.
import { PgDrizzle } from "@effect/sql-drizzle/Pg";
 */
import { PgClient } from "@effect/sql-pg";
import { Config, Context, Effect, Layer, Redacted } from "effect";
import { Pool } from "pg";

/**
 * Database configuration derived from environment
 */
const DatabaseConfig = Config.redacted("DATABASE_URL").pipe(
  Config.withDefault(
    Redacted.make("postgresql://postgres:postgres@localhost:5432/template")
  )
);

/**
 * Effect SQL layer for PostgreSQL
 * Use this for Effect-based database operations with automatic resource management
 */
export const SqlLive = PgClient.layerConfig(
  Config.map(DatabaseConfig, (url) => ({
    url,
    transformResultNames: (name) =>
      name.replace(/_([a-z])/g, (_, char: string) => char.toUpperCase()),
  }))
);

/**
 * Drizzle layer for PostgreSQL with Effect integration
 * Patches Drizzle queries to return Effects with proper error handling
 *
 * Note: Schema is imported at query time by the consuming app. This layer
 * provides the raw Drizzle connection that works with @effect/sql.
 */
export const DrizzleLive = Layer.effect(
  PgDrizzle,
  Effect.gen(function* () {
    // Import here to ensure Drizzle patching happens
    const { make } = yield* Effect.promise(
      () => import("@effect/sql-drizzle/Pg")
    );
    return yield* make;
  })
);

/**
 * Combined database layer providing both SqlClient and Drizzle
 */
export const DatabaseLive = DrizzleLive.pipe(Layer.provideMerge(SqlLive));

/**
 * Service tag for direct pg Pool access
 * Used by Better Auth which needs synchronous database access
 */
export class PgPool extends Context.Tag("PgPool")<PgPool, Pool>() {}

/**
 * Layer providing direct pg Pool for Better Auth
 * This creates a separate connection pool that Better Auth manages
 */
export const PgPoolLive = Layer.scoped(
  PgPool,
  Effect.gen(function* () {
    const url = yield* DatabaseConfig;
    const pool = new Pool({
      connectionString: Redacted.value(url),
    });

    // Test connection
    yield* Effect.tryPromise({
      try: () => pool.query("SELECT 1"),
      catch: (error) =>
        new Error(
          `Failed to connect to database: ${error instanceof Error ? error.message : String(error)}`
        ),
    });

    // Register cleanup on scope finalization
    yield* Effect.addFinalizer(() =>
      Effect.promise(() => pool.end()).pipe(
        Effect.catchAll(() => Effect.void),
        Effect.timeout("5 seconds"),
        Effect.catchAll(() => Effect.void)
      )
    );

    return pool;
  })
);

/**
 * Get database URL from environment (for drizzle-kit and other tools)
 */
export const getDatabaseUrl = (): string =>
  process.env["DATABASE_URL"] ??
  "postgresql://postgres:postgres@localhost:5432/template";
