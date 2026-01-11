/**
 * Auth Service Layer
 *
 * Provides Effect-based authentication services.
 * Framework-agnostic - depends on BetterAuthClient for Better Auth integration.
 */
import type { AuthContext as AuthContextType } from "@packages/types";

import {
  AuthContext as AuthContextSchema,
  Session as SessionSchema,
  User as UserSchema,
} from "@packages/types";
import { Context, Effect, Layer, Option, Schema } from "effect";

import {
  InvalidTokenError,
  NoSessionError,
  SessionValidationError,
} from "../errors.js";

// =============================================================================
// Better Auth Client Dependency
// =============================================================================

/**
 * Raw session result from Better Auth API
 * This is the shape returned by auth.api.getSession()
 */
export interface BetterAuthSessionResult {
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly emailVerified: boolean;
    readonly name: string | null;
    readonly image: string | null;
    readonly createdAt: Date | string;
    readonly updatedAt: Date | string;
  };
  readonly session: {
    readonly id: string;
    readonly userId: string;
    readonly token: string;
    readonly expiresAt: Date | string;
    readonly ipAddress: string | null;
    readonly userAgent: string | null;
    readonly createdAt: Date | string;
    readonly updatedAt: Date | string;
  };
}

/**
 * Better Auth client interface
 * Apps provide their own implementation with configured Better Auth instance
 */
export interface BetterAuthClientImpl {
  /**
   * Get session from Better Auth API
   */
  readonly getSession: (
    headers: Headers
  ) => Promise<BetterAuthSessionResult | null>;
}

/**
 * Better Auth client service tag
 */
export class BetterAuthClient extends Context.Tag("BetterAuthClient")<
  BetterAuthClient,
  BetterAuthClientImpl
>() {}

// =============================================================================
// Auth Service Definition
// =============================================================================

/**
 * Auth service interface
 */
export interface AuthServiceImpl {
  /**
   * Get the current session from request headers
   * Returns None if no session exists
   */
  readonly getSession: (
    headers: Headers
  ) => Effect.Effect<Option.Option<AuthContextType>, SessionValidationError>;

  /**
   * Require an authenticated session
   * Fails with NoSessionError if not authenticated
   */
  readonly requireSession: (
    headers: Headers
  ) => Effect.Effect<AuthContextType, NoSessionError | SessionValidationError>;

  /**
   * Validate a session token directly
   */
  readonly validateToken: (
    token: string
  ) => Effect.Effect<
    Option.Option<AuthContextType>,
    SessionValidationError | InvalidTokenError
  >;
}

/**
 * Auth service tag for dependency injection
 */
export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  AuthServiceImpl
>() {}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Normalize date value - Better Auth may return Date or string
 */
const normalizeDate = (value: Date | string): Date =>
  value instanceof Date ? value : new Date(value);

/**
 * Decode session result using Effect Schemas
 */
const decodeSessionResult = (
  result: BetterAuthSessionResult
): Effect.Effect<AuthContextType, SessionValidationError> =>
  Effect.gen(function* () {
    const user = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(UserSchema)({
          ...result.user,
          createdAt: normalizeDate(result.user.createdAt),
          updatedAt: normalizeDate(result.user.updatedAt),
        }),
      catch: (error) =>
        new SessionValidationError({
          message: "Failed to decode user from session",
          cause: error,
        }),
    });

    const session = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(SessionSchema)({
          ...result.session,
          expiresAt: normalizeDate(result.session.expiresAt),
          createdAt: normalizeDate(result.session.createdAt),
          updatedAt: normalizeDate(result.session.updatedAt),
        }),
      catch: (error) =>
        new SessionValidationError({
          message: "Failed to decode session",
          cause: error,
        }),
    });

    const authContext = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(AuthContextSchema)({
          user,
          session,
        }),
      catch: (error) =>
        new SessionValidationError({
          message: "Failed to create auth context",
          cause: error,
        }),
    });

    return authContext;
  });

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the auth service implementation
 */
const makeAuthService = Effect.gen(function* () {
  const betterAuth = yield* BetterAuthClient;

  const getSession = (
    headers: Headers
  ): Effect.Effect<Option.Option<AuthContextType>, SessionValidationError> =>
    Effect.gen(function* () {
      const sessionResult = yield* Effect.tryPromise({
        try: () => betterAuth.getSession(headers),
        catch: (error) =>
          new SessionValidationError({
            message: "Failed to validate session",
            cause: error,
          }),
      });

      if (sessionResult === null) {
        return Option.none<AuthContextType>();
      }

      const authContext = yield* decodeSessionResult(sessionResult);
      return Option.some(authContext);
    });

  const requireSession = (
    headers: Headers
  ): Effect.Effect<
    AuthContextType,
    NoSessionError | SessionValidationError
  > =>
    Effect.gen(function* () {
      const maybeSession = yield* getSession(headers);

      return yield* Option.match(maybeSession, {
        onNone: () =>
          Effect.fail(
            new NoSessionError({ message: "Authentication required" })
          ),
        onSome: (ctx) => Effect.succeed(ctx),
      });
    });

  const validateToken = (
    token: string
  ): Effect.Effect<
    Option.Option<AuthContextType>,
    SessionValidationError | InvalidTokenError
  > => {
    if (token.length === 0) {
      return Effect.fail(
        new InvalidTokenError({
          message: "Token cannot be empty",
          tokenType: "session",
        })
      );
    }

    const headers = new Headers({
      cookie: `better-auth.session_token=${token}`,
    });
    return getSession(headers);
  };

  return {
    getSession,
    requireSession,
    validateToken,
  } satisfies AuthServiceImpl;
});

/**
 * Live layer for the auth service
 * Requires BetterAuthClient to be provided
 */
export const AuthServiceLive: Layer.Layer<
  AuthService,
  never,
  BetterAuthClient
> = Layer.effect(AuthService, makeAuthService);

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Get current session from headers (convenience function)
 */
export const getSession = (headers: Headers) =>
  Effect.flatMap(AuthService, (service) => service.getSession(headers));

/**
 * Require authenticated session (convenience function)
 */
export const requireSession = (headers: Headers) =>
  Effect.flatMap(AuthService, (service) => service.requireSession(headers));

/**
 * Validate session token (convenience function)
 */
export const validateToken = (token: string) =>
  Effect.flatMap(AuthService, (service) => service.validateToken(token));
