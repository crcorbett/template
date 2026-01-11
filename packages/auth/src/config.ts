/**
 * Auth Configuration with Effect validation
 *
 * Provides typed configuration schemas and loading via Effect Config module.
 * Uses branded types for sensitive values (secrets, tokens).
 */
import {
  Config,
  ConfigError,
  Context,
  Data,
  Effect,
  Layer,
  Redacted,
  Schema,
} from "effect";

// =============================================================================
// Branded Types for Sensitive Values
// =============================================================================

/**
 * Branded type for OAuth client secrets
 * This is a sensitive value that should never be logged
 */
export const ClientSecret = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("ClientSecret")
);
export type ClientSecret = typeof ClientSecret.Type;

/**
 * Branded type for OAuth client IDs
 */
export const ClientId = Schema.String.pipe(
  Schema.minLength(1),
  Schema.brand("ClientId")
);
export type ClientId = typeof ClientId.Type;

/**
 * Branded type for database connection URLs
 * This is a sensitive value containing credentials
 */
export const DatabaseUrl = Schema.String.pipe(
  Schema.pattern(/^postgres(ql)?:\/\/.+/),
  Schema.brand("DatabaseUrl")
);
export type DatabaseUrl = typeof DatabaseUrl.Type;

/**
 * Branded type for JWT secrets
 */
export const JwtSecret = Schema.String.pipe(
  Schema.minLength(32),
  Schema.brand("JwtSecret")
);
export type JwtSecret = typeof JwtSecret.Type;

// =============================================================================
// OAuth Provider Configuration Schema
// =============================================================================

/**
 * Configuration for a single OAuth provider
 */
export const OAuthProviderConfigSchema = Schema.Struct({
  /** OAuth client ID */
  clientId: ClientId,
  /** OAuth client secret (sensitive) */
  clientSecret: ClientSecret,
  /** OAuth redirect URI after authorization */
  redirectUri: Schema.String.pipe(Schema.pattern(/^https?:\/\/.+/)),
  /** OAuth scopes to request */
  scopes: Schema.optional(Schema.Array(Schema.String)),
});
export type OAuthProviderConfigSchema = typeof OAuthProviderConfigSchema.Type;

/**
 * Configuration for all OAuth providers
 */
export const OAuthProvidersConfigSchema = Schema.Struct({
  /** Google OAuth configuration (optional) */
  google: Schema.optional(OAuthProviderConfigSchema),
  /** Microsoft OAuth configuration (optional) */
  microsoft: Schema.optional(OAuthProviderConfigSchema),
});
export type OAuthProvidersConfigSchema = typeof OAuthProvidersConfigSchema.Type;

// =============================================================================
// Database Configuration Schema
// =============================================================================

/**
 * Database connection configuration
 */
export const DatabaseConfigSchema = Schema.Struct({
  /** PostgreSQL connection URL (sensitive) */
  url: DatabaseUrl,
  /** Maximum connections in pool */
  maxConnections: Schema.optional(Schema.Number.pipe(Schema.positive())),
  /** Connection timeout in milliseconds */
  connectionTimeoutMs: Schema.optional(Schema.Number.pipe(Schema.positive())),
  /** Idle timeout in milliseconds */
  idleTimeoutMs: Schema.optional(Schema.Number.pipe(Schema.positive())),
});
export type DatabaseConfigSchema = typeof DatabaseConfigSchema.Type;

// =============================================================================
// Session Configuration Schema
// =============================================================================

/**
 * Session management configuration
 */
export const SessionConfigSchema = Schema.Struct({
  /** Session duration in seconds (default: 7 days = 604800) */
  durationSeconds: Schema.optional(
    Schema.Number.pipe(Schema.positive(), Schema.int())
  ),
  /** Whether sessions should auto-refresh on activity */
  autoRefresh: Schema.optional(Schema.Boolean),
  /** Refresh threshold as percentage of duration (0-100) */
  refreshThresholdPercent: Schema.optional(
    Schema.Number.pipe(
      Schema.greaterThanOrEqualTo(0),
      Schema.lessThanOrEqualTo(100)
    )
  ),
  /** Cookie settings */
  cookie: Schema.optional(
    Schema.Struct({
      /** Cookie name */
      name: Schema.optional(Schema.String),
      /** Cookie domain */
      domain: Schema.optional(Schema.String),
      /** Whether cookie is secure (HTTPS only) */
      secure: Schema.optional(Schema.Boolean),
      /** SameSite attribute */
      sameSite: Schema.optional(Schema.Literal("strict", "lax", "none")),
    })
  ),
});
export type SessionConfigSchema = typeof SessionConfigSchema.Type;

// =============================================================================
// Combined Auth Configuration Schema
// =============================================================================

/**
 * Complete auth package configuration
 */
export const AuthConfigSchema = Schema.Struct({
  /** Database configuration */
  database: DatabaseConfigSchema,
  /** OAuth providers configuration */
  oauth: Schema.optional(OAuthProvidersConfigSchema),
  /** Session management configuration */
  session: Schema.optional(SessionConfigSchema),
  /** JWT secret for token signing (sensitive) */
  jwtSecret: Schema.optional(JwtSecret),
  /** Base URL of the application (for redirects) */
  baseUrl: Schema.optional(
    Schema.String.pipe(Schema.pattern(/^https?:\/\/.+/))
  ),
});
export type AuthConfigSchema = typeof AuthConfigSchema.Type;

// =============================================================================
// Effect Config Loading
// =============================================================================

/**
 * Configuration loading error
 */
export class AuthConfigError extends Data.TaggedError("AuthConfigError")<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Load database URL from environment
 */
const loadDatabaseUrl = Config.redacted("DATABASE_URL").pipe(
  Config.withDefault(
    Redacted.make("postgresql://postgres:postgres@localhost:5432/template")
  )
);

/**
 * Load optional string config with prefix
 */
const optionalString = (name: string) =>
  Config.string(name).pipe(Config.option);

/**
 * Load optional number config
 */
const optionalNumber = (name: string) =>
  Config.number(name).pipe(Config.option);

/**
 * Load optional boolean config
 */
const optionalBoolean = (name: string) =>
  Config.boolean(name).pipe(Config.option);

/**
 * Load OAuth provider config from environment
 * Expects: {PREFIX}_CLIENT_ID, {PREFIX}_CLIENT_SECRET, {PREFIX}_REDIRECT_URI
 */
const loadOAuthProvider = (prefix: string) =>
  Effect.gen(function* () {
    const clientId = yield* optionalString(`${prefix}_CLIENT_ID`);
    const clientSecret = yield* optionalString(`${prefix}_CLIENT_SECRET`);
    const redirectUri = yield* optionalString(`${prefix}_REDIRECT_URI`);
    const scopesStr = yield* optionalString(`${prefix}_SCOPES`);

    // All required fields must be present to return a config
    if (
      clientId._tag === "None" ||
      clientSecret._tag === "None" ||
      redirectUri._tag === "None"
    ) {
      return undefined;
    }

    const scopes =
      scopesStr._tag === "Some"
        ? scopesStr.value.split(",").map((s) => s.trim())
        : undefined;

    return {
      clientId: clientId.value,
      clientSecret: clientSecret.value,
      redirectUri: redirectUri.value,
      scopes,
    };
  });

/**
 * Load session config from environment
 */
const loadSessionConfig = Effect.gen(function* () {
  const durationSeconds = yield* optionalNumber(
    "AUTH_SESSION_DURATION_SECONDS"
  );
  const autoRefresh = yield* optionalBoolean("AUTH_SESSION_AUTO_REFRESH");
  const refreshThresholdPercent = yield* optionalNumber(
    "AUTH_SESSION_REFRESH_THRESHOLD_PERCENT"
  );
  const cookieName = yield* optionalString("AUTH_SESSION_COOKIE_NAME");
  const cookieDomain = yield* optionalString("AUTH_SESSION_COOKIE_DOMAIN");
  const cookieSecure = yield* optionalBoolean("AUTH_SESSION_COOKIE_SECURE");
  const cookieSameSite = yield* optionalString("AUTH_SESSION_COOKIE_SAMESITE");

  const hasCookieConfig =
    cookieName._tag === "Some" ||
    cookieDomain._tag === "Some" ||
    cookieSecure._tag === "Some" ||
    cookieSameSite._tag === "Some";

  const cookie = hasCookieConfig
    ? {
        ...(cookieName._tag === "Some" ? { name: cookieName.value } : {}),
        ...(cookieDomain._tag === "Some" ? { domain: cookieDomain.value } : {}),
        ...(cookieSecure._tag === "Some" ? { secure: cookieSecure.value } : {}),
        ...(cookieSameSite._tag === "Some" &&
        (cookieSameSite.value === "strict" ||
          cookieSameSite.value === "lax" ||
          cookieSameSite.value === "none")
          ? { sameSite: cookieSameSite.value }
          : {}),
      }
    : undefined;

  const hasSessionConfig =
    durationSeconds._tag === "Some" ||
    autoRefresh._tag === "Some" ||
    refreshThresholdPercent._tag === "Some" ||
    hasCookieConfig;

  if (!hasSessionConfig) {
    return undefined;
  }

  return {
    ...(durationSeconds._tag === "Some"
      ? { durationSeconds: durationSeconds.value }
      : {}),
    ...(autoRefresh._tag === "Some" ? { autoRefresh: autoRefresh.value } : {}),
    ...(refreshThresholdPercent._tag === "Some"
      ? { refreshThresholdPercent: refreshThresholdPercent.value }
      : {}),
    ...(cookie !== undefined ? { cookie } : {}),
  };
});

/**
 * Load complete auth configuration from environment
 *
 * Environment variables:
 * - DATABASE_URL: PostgreSQL connection URL (required)
 * - AUTH_JWT_SECRET: JWT signing secret
 * - AUTH_BASE_URL: Application base URL
 * - GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REDIRECT_URI: Google OAuth
 * - MICROSOFT_CLIENT_ID, MICROSOFT_CLIENT_SECRET, MICROSOFT_REDIRECT_URI: Microsoft OAuth
 * - AUTH_SESSION_DURATION_SECONDS: Session lifetime
 * - AUTH_SESSION_AUTO_REFRESH: Enable session auto-refresh
 * - AUTH_SESSION_REFRESH_THRESHOLD_PERCENT: Refresh threshold
 * - AUTH_SESSION_COOKIE_NAME, AUTH_SESSION_COOKIE_DOMAIN, etc.: Cookie settings
 */
/**
 * Map ConfigError to AuthConfigError
 */
const mapConfigError = (error: ConfigError.ConfigError): AuthConfigError =>
  new AuthConfigError({
    message: `Configuration error: ${error._tag}`,
    cause: error,
  });

/**
 * Internal config loader that may fail with ConfigError
 */
const loadAuthConfigInternal = Effect.gen(function* () {
  // Load database config
  const databaseUrl = yield* loadDatabaseUrl;
  const maxConnections = yield* optionalNumber("DATABASE_MAX_CONNECTIONS");
  const connectionTimeoutMs = yield* optionalNumber(
    "DATABASE_CONNECTION_TIMEOUT_MS"
  );
  const idleTimeoutMs = yield* optionalNumber("DATABASE_IDLE_TIMEOUT_MS");

  // Load OAuth providers
  const google = yield* loadOAuthProvider("GOOGLE");
  const microsoft = yield* loadOAuthProvider("MICROSOFT");

  // Load session config
  const session = yield* loadSessionConfig;

  // Load JWT secret
  const jwtSecret = yield* optionalString("AUTH_JWT_SECRET");

  // Load base URL
  const baseUrl = yield* optionalString("AUTH_BASE_URL");

  // Build config object
  const rawConfig = {
    database: {
      url: Redacted.value(databaseUrl),
      ...(maxConnections._tag === "Some"
        ? { maxConnections: maxConnections.value }
        : {}),
      ...(connectionTimeoutMs._tag === "Some"
        ? { connectionTimeoutMs: connectionTimeoutMs.value }
        : {}),
      ...(idleTimeoutMs._tag === "Some"
        ? { idleTimeoutMs: idleTimeoutMs.value }
        : {}),
    },
    ...(google !== undefined || microsoft !== undefined
      ? {
          oauth: {
            ...(google !== undefined ? { google } : {}),
            ...(microsoft !== undefined ? { microsoft } : {}),
          },
        }
      : {}),
    ...(session !== undefined ? { session } : {}),
    ...(jwtSecret._tag === "Some" ? { jwtSecret: jwtSecret.value } : {}),
    ...(baseUrl._tag === "Some" ? { baseUrl: baseUrl.value } : {}),
  };

  return rawConfig;
});

export const loadAuthConfig: Effect.Effect<
  AuthConfigSchema,
  AuthConfigError,
  never
> = loadAuthConfigInternal.pipe(
  Effect.mapError(mapConfigError),
  Effect.flatMap((rawConfig) =>
    Schema.decodeUnknown(AuthConfigSchema)(rawConfig).pipe(
      Effect.mapError(
        (parseError) =>
          new AuthConfigError({
            message: `Invalid auth configuration: ${parseError.message}`,
            cause: parseError,
          })
      )
    )
  )
);

// =============================================================================
// AuthConfig Service
// =============================================================================

/**
 * AuthConfig service tag for dependency injection
 */
export class AuthConfig extends Context.Tag("AuthConfig")<
  AuthConfig,
  AuthConfigSchema
>() {}

/**
 * AuthConfig Layer - loads configuration from environment
 */
export const AuthConfigLive: Layer.Layer<AuthConfig, AuthConfigError, never> =
  Layer.effect(AuthConfig, loadAuthConfig);

/**
 * Create AuthConfig layer from a config object (for testing)
 */
export const makeAuthConfigLayer = (
  config: AuthConfigSchema
): Layer.Layer<AuthConfig, never, never> => Layer.succeed(AuthConfig, config);
