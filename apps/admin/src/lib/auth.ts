/**
 * Better Auth configuration with Drizzle adapter and OAuth providers
 *
 * This module configures:
 * - Better Auth core with PostgreSQL via Drizzle adapter
 * - Google OAuth provider
 * - Microsoft OAuth provider
 * - TanStack Start cookie integration
 */
import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { tanstackStartCookies } from "better-auth/tanstack-start";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

import { schema } from "@packages/types";

import { getAuthEnv } from "./env";

// Load environment configuration
const env = getAuthEnv();

/**
 * PostgreSQL connection pool for Better Auth
 *
 * Better Auth needs synchronous database access at initialization time,
 * so we create a dedicated connection pool separate from the Effect-based client.
 */
const pool = new Pool({
  connectionString: env.DATABASE_URL,
});

/**
 * Drizzle ORM instance for Better Auth
 *
 * Configured with our schema from @packages/types which is based on Effect Schemas.
 */
const db = drizzle(pool, { schema });

/**
 * Better Auth instance
 *
 * Configured with:
 * - Drizzle adapter for PostgreSQL
 * - Google OAuth provider
 * - Microsoft OAuth provider
 * - TanStack Start cookie handling
 */
export const auth = betterAuth({
  database: drizzleAdapter(db, {
    provider: "pg",
    usePlural: true,
    schema,
  }),

  secret: env.BETTER_AUTH_SECRET,
  baseURL: env.BETTER_AUTH_URL,

  trustedOrigins: [env.BETTER_AUTH_URL],

  socialProviders: {
    google: {
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      // Request offline access to get refresh tokens
      accessType: "offline",
    },
    microsoft: {
      clientId: env.MICROSOFT_CLIENT_ID,
      clientSecret: env.MICROSOFT_CLIENT_SECRET,
      // Use common tenant to allow both personal and work accounts
      tenantId: "common",
    },
  },

  plugins: [
    // Handle cookies properly in TanStack Start
    tanstackStartCookies(),
  ],

  session: {
    // Session expires after 7 days of inactivity
    expiresIn: 60 * 60 * 24 * 7, // 7 days in seconds
    // Update session expiry when user is active
    updateAge: 60 * 60 * 24, // 1 day in seconds
  },
});

/**
 * Auth session type inferred from Better Auth
 */
export type Session = typeof auth.$Infer.Session;

/**
 * Auth user type inferred from Better Auth
 */
export type AuthUser = typeof auth.$Infer.Session.user;
