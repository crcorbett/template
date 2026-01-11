/**
 * Session Service Layer
 *
 * Provides Effect-based session management services.
 * Framework-agnostic - depends on SessionRepository for database operations.
 */
import type {
  Session as SessionType,
  SessionId,
  SessionInsert as SessionInsertType,
  UserId,
} from "@packages/types";

import { Session as SessionSchema } from "@packages/types";
import { Context, Effect, Layer, Option, Schema } from "effect";

import {
  SessionDatabaseError,
  SessionExpiredError,
  SessionNotFoundError,
  SessionValidationError,
} from "../errors.js";

// =============================================================================
// Session Repository Dependency
// =============================================================================

/**
 * Raw session data from database (before validation)
 */
export interface RawSessionData {
  readonly id: string;
  readonly userId: string;
  readonly token: string;
  readonly expiresAt: Date;
  readonly ipAddress: string | null;
  readonly userAgent: string | null;
  readonly createdAt: Date;
  readonly updatedAt: Date;
}

/**
 * Session refresh options
 */
export interface SessionRefreshOptions {
  /** New expiration time */
  readonly expiresAt: Date;
  /** Update IP address */
  readonly ipAddress?: string | null;
  /** Update user agent */
  readonly userAgent?: string | null;
}

/**
 * Interface for session database operations
 * Apps provide their own implementation (Drizzle, Prisma, etc.)
 */
export interface SessionRepositoryImpl {
  /**
   * Create a new session in the database
   */
  readonly create: (
    data: SessionInsertType
  ) => Effect.Effect<RawSessionData, SessionDatabaseError>;

  /**
   * Get a session by ID
   * Returns None if session not found
   */
  readonly getById: (
    sessionId: string
  ) => Effect.Effect<Option.Option<RawSessionData>, SessionDatabaseError>;

  /**
   * Get a session by token
   * Returns None if session not found
   */
  readonly getByToken: (
    token: string
  ) => Effect.Effect<Option.Option<RawSessionData>, SessionDatabaseError>;

  /**
   * Get all sessions for a user
   */
  readonly getByUserId: (
    userId: UserId
  ) => Effect.Effect<readonly RawSessionData[], SessionDatabaseError>;

  /**
   * Update session (for refresh)
   * Returns None if session not found
   */
  readonly update: (
    sessionId: string,
    data: SessionRefreshOptions
  ) => Effect.Effect<Option.Option<RawSessionData>, SessionDatabaseError>;

  /**
   * Delete a session by ID
   * Returns true if deleted, false if not found
   */
  readonly delete: (
    sessionId: string
  ) => Effect.Effect<boolean, SessionDatabaseError>;

  /**
   * Delete all sessions for a user
   * Returns count of deleted sessions
   */
  readonly deleteByUserId: (
    userId: UserId
  ) => Effect.Effect<number, SessionDatabaseError>;

  /**
   * Delete expired sessions
   * Returns count of deleted sessions
   */
  readonly deleteExpired: () => Effect.Effect<number, SessionDatabaseError>;
}

/**
 * Session repository service tag
 */
export class SessionRepository extends Context.Tag("SessionRepository")<
  SessionRepository,
  SessionRepositoryImpl
>() {}

// =============================================================================
// Session Service Definition
// =============================================================================

/**
 * Session service interface
 */
export interface SessionServiceImpl {
  /**
   * Create a new session
   */
  readonly createSession: (
    data: SessionInsertType
  ) => Effect.Effect<
    SessionType,
    SessionDatabaseError | SessionValidationError
  >;

  /**
   * Get a session by ID
   * Returns None if session not found
   */
  readonly getSession: (
    sessionId: SessionId
  ) => Effect.Effect<
    Option.Option<SessionType>,
    SessionDatabaseError | SessionValidationError
  >;

  /**
   * Get a session by token
   * Returns None if session not found
   */
  readonly getSessionByToken: (
    token: string
  ) => Effect.Effect<
    Option.Option<SessionType>,
    SessionDatabaseError | SessionValidationError
  >;

  /**
   * Get all sessions for a user
   */
  readonly getUserSessions: (
    userId: UserId
  ) => Effect.Effect<
    readonly SessionType[],
    SessionDatabaseError | SessionValidationError
  >;

  /**
   * Refresh a session (extend expiration)
   * Fails with SessionNotFoundError if session doesn't exist
   * Fails with SessionExpiredError if session is already expired
   */
  readonly refreshSession: (
    sessionId: SessionId,
    options: SessionRefreshOptions
  ) => Effect.Effect<
    SessionType,
    | SessionNotFoundError
    | SessionExpiredError
    | SessionDatabaseError
    | SessionValidationError
  >;

  /**
   * Revoke (delete) a session
   * Fails with SessionNotFoundError if session doesn't exist
   */
  readonly revokeSession: (
    sessionId: SessionId
  ) => Effect.Effect<void, SessionNotFoundError | SessionDatabaseError>;

  /**
   * Revoke all sessions for a user
   * Returns count of revoked sessions
   */
  readonly revokeUserSessions: (
    userId: UserId
  ) => Effect.Effect<number, SessionDatabaseError>;

  /**
   * Clean up expired sessions
   * Returns count of deleted sessions
   */
  readonly cleanupExpiredSessions: () => Effect.Effect<
    number,
    SessionDatabaseError
  >;

  /**
   * Validate a session (check if exists and not expired)
   * Returns None if session not found
   * Fails with SessionExpiredError if session is expired
   */
  readonly validateSession: (
    sessionId: SessionId
  ) => Effect.Effect<
    Option.Option<SessionType>,
    SessionExpiredError | SessionDatabaseError | SessionValidationError
  >;
}

/**
 * Session service tag for dependency injection
 */
export class SessionService extends Context.Tag("SessionService")<
  SessionService,
  SessionServiceImpl
>() {}

// =============================================================================
// Internal Helpers
// =============================================================================

/**
 * Validate raw session data using Effect Schema
 */
const validateSessionData = (
  raw: RawSessionData
): Effect.Effect<SessionType, SessionValidationError> =>
  Effect.try({
    try: () => Schema.decodeUnknownSync(SessionSchema)(raw),
    catch: (error) =>
      new SessionValidationError({
        message: "Failed to validate session data",
        cause: error,
      }),
  });

/**
 * Check if a session is expired
 */
const isSessionExpired = (session: SessionType): boolean =>
  session.expiresAt < new Date();

// =============================================================================
// Service Implementation
// =============================================================================

/**
 * Create the session service implementation
 */
const makeSessionService = Effect.gen(function* () {
  const repository = yield* SessionRepository;

  const createSession = (
    data: SessionInsertType
  ): Effect.Effect<
    SessionType,
    SessionDatabaseError | SessionValidationError
  > =>
    Effect.gen(function* () {
      const rawSession = yield* repository.create(data);
      return yield* validateSessionData(rawSession);
    });

  const getSession = (
    sessionId: SessionId
  ): Effect.Effect<
    Option.Option<SessionType>,
    SessionDatabaseError | SessionValidationError
  > =>
    Effect.gen(function* () {
      const maybeRaw = yield* repository.getById(sessionId);
      return yield* Option.match(maybeRaw, {
        onNone: () => Effect.succeed(Option.none<SessionType>()),
        onSome: (raw) => Effect.map(validateSessionData(raw), Option.some),
      });
    });

  const getSessionByToken = (
    token: string
  ): Effect.Effect<
    Option.Option<SessionType>,
    SessionDatabaseError | SessionValidationError
  > =>
    Effect.gen(function* () {
      const maybeRaw = yield* repository.getByToken(token);
      return yield* Option.match(maybeRaw, {
        onNone: () => Effect.succeed(Option.none<SessionType>()),
        onSome: (raw) => Effect.map(validateSessionData(raw), Option.some),
      });
    });

  const getUserSessions = (
    userId: UserId
  ): Effect.Effect<
    readonly SessionType[],
    SessionDatabaseError | SessionValidationError
  > =>
    Effect.gen(function* () {
      const rawSessions = yield* repository.getByUserId(userId);
      return yield* Effect.all(rawSessions.map(validateSessionData), {
        concurrency: "unbounded",
      });
    });

  const refreshSession = (
    sessionId: SessionId,
    options: SessionRefreshOptions
  ): Effect.Effect<
    SessionType,
    | SessionNotFoundError
    | SessionExpiredError
    | SessionDatabaseError
    | SessionValidationError
  > =>
    Effect.gen(function* () {
      // First check if session exists and is not expired
      const maybeExisting = yield* repository.getById(sessionId);
      const existing = yield* Option.match(maybeExisting, {
        onNone: () =>
          Effect.fail(
            new SessionNotFoundError({
              sessionId,
              message: `Session not found: ${sessionId}`,
            })
          ),
        onSome: Effect.succeed,
      });

      const validated = yield* validateSessionData(existing);
      if (isSessionExpired(validated)) {
        return yield* Effect.fail(
          new SessionExpiredError({
            sessionId,
            expiredAt: validated.expiresAt,
            message: `Session expired at ${validated.expiresAt.toISOString()}`,
          })
        );
      }

      // Update the session
      const maybeUpdated = yield* repository.update(sessionId, options);
      const updated = yield* Option.match(maybeUpdated, {
        onNone: () =>
          Effect.fail(
            new SessionNotFoundError({
              sessionId,
              message: `Session not found after update: ${sessionId}`,
            })
          ),
        onSome: Effect.succeed,
      });

      return yield* validateSessionData(updated);
    });

  const revokeSession = (
    sessionId: SessionId
  ): Effect.Effect<void, SessionNotFoundError | SessionDatabaseError> =>
    Effect.gen(function* () {
      const deleted = yield* repository.delete(sessionId);
      if (!deleted) {
        return yield* Effect.fail(
          new SessionNotFoundError({
            sessionId,
            message: `Session not found: ${sessionId}`,
          })
        );
      }
    });

  const revokeUserSessions = (
    userId: UserId
  ): Effect.Effect<number, SessionDatabaseError> =>
    repository.deleteByUserId(userId);

  const cleanupExpiredSessions = (): Effect.Effect<
    number,
    SessionDatabaseError
  > => repository.deleteExpired();

  const validateSession = (
    sessionId: SessionId
  ): Effect.Effect<
    Option.Option<SessionType>,
    SessionExpiredError | SessionDatabaseError | SessionValidationError
  > =>
    Effect.gen(function* () {
      const maybeRaw = yield* repository.getById(sessionId);
      return yield* Option.match(maybeRaw, {
        onNone: () => Effect.succeed(Option.none<SessionType>()),
        onSome: (raw) =>
          Effect.gen(function* () {
            const session = yield* validateSessionData(raw);
            if (isSessionExpired(session)) {
              return yield* Effect.fail(
                new SessionExpiredError({
                  sessionId,
                  expiredAt: session.expiresAt,
                  message: `Session expired at ${session.expiresAt.toISOString()}`,
                })
              );
            }
            return Option.some(session);
          }),
      });
    });

  return {
    createSession,
    getSession,
    getSessionByToken,
    getUserSessions,
    refreshSession,
    revokeSession,
    revokeUserSessions,
    cleanupExpiredSessions,
    validateSession,
  } satisfies SessionServiceImpl;
});

/**
 * Live layer for the session service
 * Requires SessionRepository to be provided
 */
export const SessionServiceLive: Layer.Layer<
  SessionService,
  never,
  SessionRepository
> = Layer.effect(SessionService, makeSessionService);

// =============================================================================
// Convenience Functions
// =============================================================================

/**
 * Create a new session (convenience function)
 */
export const createSession = (data: SessionInsertType) =>
  Effect.flatMap(SessionService, (service) => service.createSession(data));

/**
 * Get session by ID (convenience function)
 */
export const getSessionById = (sessionId: SessionId) =>
  Effect.flatMap(SessionService, (service) => service.getSession(sessionId));

/**
 * Get session by token (convenience function)
 */
export const getSessionByToken = (token: string) =>
  Effect.flatMap(SessionService, (service) => service.getSessionByToken(token));

/**
 * Get all sessions for a user (convenience function)
 */
export const getUserSessions = (userId: UserId) =>
  Effect.flatMap(SessionService, (service) => service.getUserSessions(userId));

/**
 * Refresh session (convenience function)
 */
export const refreshSession = (
  sessionId: SessionId,
  options: SessionRefreshOptions
) =>
  Effect.flatMap(SessionService, (service) =>
    service.refreshSession(sessionId, options)
  );

/**
 * Revoke session (convenience function)
 */
export const revokeSession = (sessionId: SessionId) =>
  Effect.flatMap(SessionService, (service) => service.revokeSession(sessionId));

/**
 * Revoke all user sessions (convenience function)
 */
export const revokeUserSessions = (userId: UserId) =>
  Effect.flatMap(SessionService, (service) =>
    service.revokeUserSessions(userId)
  );

/**
 * Cleanup expired sessions (convenience function)
 */
export const cleanupExpiredSessions = () =>
  Effect.flatMap(SessionService, (service) => service.cleanupExpiredSessions());

/**
 * Validate session (convenience function)
 */
export const validateSession = (sessionId: SessionId) =>
  Effect.flatMap(SessionService, (service) =>
    service.validateSession(sessionId)
  );
