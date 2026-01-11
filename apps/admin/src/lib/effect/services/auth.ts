/**
 * Auth Service Layer
 *
 * Provides Effect-based authentication services wrapping Better Auth.
 * Handles session validation, user context, and auth state management.
 */
import { Context, Data, Effect, Layer, Option, Schema } from "effect";

import type {
  AuthContext as AuthContextType,
  Session,
  User,
  UserId,
} from "@packages/types";
import {
  AuthContext as AuthContextSchema,
  Session as SessionSchema,
  User as UserSchema,
} from "@packages/types";

import { auth } from "$/lib/auth";

// =============================================================================
// Error Types
// =============================================================================

/**
 * Error thrown when no active session exists
 */
export class NoSessionError extends Data.TaggedError("NoSessionError")<{
  readonly message: string;
}> {}

/**
 * Error thrown when session validation fails
 */
export class SessionValidationError extends Data.TaggedError(
  "SessionValidationError"
)<{
  readonly message: string;
  readonly cause?: unknown;
}> {}

/**
 * Error thrown when user lookup fails
 */
export class UserNotFoundError extends Data.TaggedError("UserNotFoundError")<{
  readonly userId: UserId;
  readonly message: string;
}> {}

// =============================================================================
// Service Definition
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
  ) => Effect.Effect<Option.Option<AuthContextType>, SessionValidationError>;
}

/**
 * Auth service tag for dependency injection
 */
export class AuthService extends Context.Tag("AuthService")<
  AuthService,
  AuthServiceImpl
>() {}

// =============================================================================
// Internal Implementation
// =============================================================================

/**
 * Get session from headers - internal implementation
 */
const getSessionImpl = (
  headers: Headers
): Effect.Effect<Option.Option<AuthContextType>, SessionValidationError> =>
  Effect.gen(function* () {
    const sessionResult = yield* Effect.tryPromise({
      try: () => auth.api.getSession({ headers }),
      catch: (error) =>
        new SessionValidationError({
          message: "Failed to validate session",
          cause: error,
        }),
    });

    if (!sessionResult) {
      return Option.none<AuthContextType>();
    }

    // Decode the session and user using Effect Schemas
    const user = yield* Effect.try({
      try: () =>
        Schema.decodeUnknownSync(UserSchema)({
          ...sessionResult.user,
          createdAt: new Date(sessionResult.user.createdAt),
          updatedAt: new Date(sessionResult.user.updatedAt),
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
          ...sessionResult.session,
          expiresAt: new Date(sessionResult.session.expiresAt),
          createdAt: new Date(sessionResult.session.createdAt),
          updatedAt: new Date(sessionResult.session.updatedAt),
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

    return Option.some(authContext);
  });

/**
 * Require session - internal implementation
 */
const requireSessionImpl = (
  headers: Headers
): Effect.Effect<
  AuthContextType,
  NoSessionError | SessionValidationError
> =>
  Effect.gen(function* () {
    const maybeSession = yield* getSessionImpl(headers);

    return yield* Option.match(maybeSession, {
      onNone: () =>
        Effect.fail(
          new NoSessionError({ message: "Authentication required" })
        ),
      onSome: (ctx) => Effect.succeed(ctx),
    });
  });

/**
 * Validate token - internal implementation
 */
const validateTokenImpl = (
  token: string
): Effect.Effect<Option.Option<AuthContextType>, SessionValidationError> => {
  const headers = new Headers({
    cookie: `better-auth.session_token=${token}`,
  });
  return getSessionImpl(headers);
};

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the auth service implementation
 */
const makeAuthService = (): AuthServiceImpl => ({
  getSession: getSessionImpl,
  requireSession: requireSessionImpl,
  validateToken: validateTokenImpl,
});

/**
 * Live layer for the auth service
 */
export const AuthServiceLive = Layer.succeed(AuthService, makeAuthService());

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

// =============================================================================
// Type Exports
// =============================================================================

export type { AuthContextType as AuthContext, Session, User };
