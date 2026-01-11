/**
 * Environment configuration with Effect Schema validation
 *
 * Uses branded types for OAuth credentials to ensure type safety.
 */
import { Schema } from "effect";

// =============================================================================
// Branded Types for OAuth Credentials
// =============================================================================

/**
 * Branded type for OAuth Client IDs
 */
export const OAuthClientId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("OAuthClientId")
);
export type OAuthClientId = typeof OAuthClientId.Type;

/**
 * Branded type for OAuth Client Secrets
 */
export const OAuthClientSecret = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("OAuthClientSecret")
);
export type OAuthClientSecret = typeof OAuthClientSecret.Type;

/**
 * Branded type for Better Auth Secret
 */
export const BetterAuthSecret = Schema.String.pipe(
  Schema.minLength(32),
  Schema.brand("BetterAuthSecret")
);
export type BetterAuthSecret = typeof BetterAuthSecret.Type;

/**
 * Branded type for Database URLs
 */
export const DatabaseUrl = Schema.String.pipe(
  Schema.pattern(/^postgresql:\/\/.+/),
  Schema.brand("DatabaseUrl")
);
export type DatabaseUrl = typeof DatabaseUrl.Type;

/**
 * Branded type for URLs
 */
export const Url = Schema.String.pipe(
  Schema.pattern(/^https?:\/\/.+/),
  Schema.brand("Url")
);
export type Url = typeof Url.Type;

// =============================================================================
// Environment Schema
// =============================================================================

/**
 * Schema for environment variables used by Better Auth
 */
export const AuthEnv = Schema.Struct({
  /** Database connection URL */
  DATABASE_URL: DatabaseUrl,

  /** Better Auth secret key (minimum 32 characters) */
  BETTER_AUTH_SECRET: BetterAuthSecret,

  /** Better Auth base URL (your app's public URL) */
  BETTER_AUTH_URL: Url,

  /** Google OAuth client ID */
  GOOGLE_CLIENT_ID: OAuthClientId,

  /** Google OAuth client secret */
  GOOGLE_CLIENT_SECRET: OAuthClientSecret,

  /** Microsoft OAuth client ID */
  MICROSOFT_CLIENT_ID: OAuthClientId,

  /** Microsoft OAuth client secret */
  MICROSOFT_CLIENT_SECRET: OAuthClientSecret,
});
export type AuthEnv = typeof AuthEnv.Type;

/**
 * Load and validate auth environment variables
 *
 * @throws ParseError if any required env var is missing or invalid
 */
export const loadAuthEnv = (): AuthEnv => {
  const env = {
    DATABASE_URL: process.env["DATABASE_URL"],
    BETTER_AUTH_SECRET: process.env["BETTER_AUTH_SECRET"],
    BETTER_AUTH_URL: process.env["BETTER_AUTH_URL"],
    GOOGLE_CLIENT_ID: process.env["GOOGLE_CLIENT_ID"],
    GOOGLE_CLIENT_SECRET: process.env["GOOGLE_CLIENT_SECRET"],
    MICROSOFT_CLIENT_ID: process.env["MICROSOFT_CLIENT_ID"],
    MICROSOFT_CLIENT_SECRET: process.env["MICROSOFT_CLIENT_SECRET"],
  };

  const decoded = Schema.decodeUnknownSync(AuthEnv)(env);
  return decoded;
};

/**
 * Get auth environment variables with fallback for development
 *
 * In development, missing credentials will use placeholder values
 * that will fail gracefully when OAuth is attempted.
 */
export const getAuthEnv = (): AuthEnv => {
  const databaseUrl =
    process.env["DATABASE_URL"] ??
    "postgresql://postgres:postgres@localhost:5432/template";
  const betterAuthSecret =
    process.env["BETTER_AUTH_SECRET"] ??
    "development-secret-key-min-32-chars-long";
  const betterAuthUrl =
    process.env["BETTER_AUTH_URL"] ?? "http://localhost:3000";

  // OAuth credentials - use placeholders in development
  const googleClientId =
    process.env["GOOGLE_CLIENT_ID"] ?? "placeholder-google-client-id";
  const googleClientSecret =
    process.env["GOOGLE_CLIENT_SECRET"] ?? "placeholder-google-client-secret";
  const microsoftClientId =
    process.env["MICROSOFT_CLIENT_ID"] ?? "placeholder-microsoft-client-id";
  const microsoftClientSecret =
    process.env["MICROSOFT_CLIENT_SECRET"] ??
    "placeholder-microsoft-client-secret";

  return {
    DATABASE_URL: databaseUrl as DatabaseUrl,
    BETTER_AUTH_SECRET: betterAuthSecret as BetterAuthSecret,
    BETTER_AUTH_URL: betterAuthUrl as Url,
    GOOGLE_CLIENT_ID: googleClientId as OAuthClientId,
    GOOGLE_CLIENT_SECRET: googleClientSecret as OAuthClientSecret,
    MICROSOFT_CLIENT_ID: microsoftClientId as OAuthClientId,
    MICROSOFT_CLIENT_SECRET: microsoftClientSecret as OAuthClientSecret,
  };
};
