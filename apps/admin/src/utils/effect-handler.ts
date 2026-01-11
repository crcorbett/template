/**
 * Effect Handler Utilities for TanStack Start
 *
 * Provides utilities for integrating Effect programs with TanStack Start
 * API routes and server functions.
 */
import { json } from "@tanstack/react-start";

import type { Cause } from "effect";
import { Effect, Exit, Match } from "effect";

import {
  NoSessionError,
  SessionValidationError,
} from "$/lib/effect/services/auth";
import {
  ConstraintViolationError,
  DatabaseQueryError,
  RecordNotFoundError,
} from "$/lib/effect/services/database";
import {
  InsufficientPermissionError,
  InsufficientRoleError,
} from "$/lib/effect/services/permissions";
import { AppRuntime, type AppServices } from "$/lib/effect/runtime";

// =============================================================================
// Error Response Types
// =============================================================================

/**
 * Standard error response format
 */
export interface ErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly details?: unknown;
}

// =============================================================================
// Error Mapping
// =============================================================================

/**
 * Map known error types to HTTP status codes and response bodies
 */
const mapErrorToResponse = (
  error: unknown
): { status: number; body: ErrorResponse } =>
  Match.value(error).pipe(
    Match.when(
      (e: unknown): e is NoSessionError => e instanceof NoSessionError,
      (e: NoSessionError) => ({
        status: 401,
        body: {
          error: e.message,
          code: "NO_SESSION",
        },
      })
    ),
    Match.when(
      (e: unknown): e is SessionValidationError =>
        e instanceof SessionValidationError,
      (e: SessionValidationError) => ({
        status: 401,
        body: {
          error: e.message,
          code: "SESSION_VALIDATION_ERROR",
          details: e.cause,
        },
      })
    ),
    Match.when(
      (e: unknown): e is InsufficientRoleError =>
        e instanceof InsufficientRoleError,
      (e: InsufficientRoleError) => ({
        status: 403,
        body: {
          error: e.message,
          code: "INSUFFICIENT_ROLE",
          details: {
            requiredRole: e.requiredRole,
            userRoles: e.userRoles,
          },
        },
      })
    ),
    Match.when(
      (e: unknown): e is InsufficientPermissionError =>
        e instanceof InsufficientPermissionError,
      (e: InsufficientPermissionError) => ({
        status: 403,
        body: {
          error: e.message,
          code: "INSUFFICIENT_PERMISSION",
          details: {
            requiredPermission: e.requiredPermission,
            userPermissions: e.userPermissions,
          },
        },
      })
    ),
    Match.when(
      (e: unknown): e is RecordNotFoundError => e instanceof RecordNotFoundError,
      (e: RecordNotFoundError) => ({
        status: 404,
        body: {
          error: e.message,
          code: "RECORD_NOT_FOUND",
          details: {
            table: e.table,
            id: e.id,
          },
        },
      })
    ),
    Match.when(
      (e: unknown): e is ConstraintViolationError =>
        e instanceof ConstraintViolationError,
      (e: ConstraintViolationError) => ({
        status: 409,
        body: {
          error: e.message,
          code: "CONSTRAINT_VIOLATION",
          details: {
            constraint: e.constraint,
          },
        },
      })
    ),
    Match.when(
      (e: unknown): e is DatabaseQueryError => e instanceof DatabaseQueryError,
      (e: DatabaseQueryError) => ({
        status: 500,
        body: {
          error: e.message,
          code: "DATABASE_ERROR",
        },
      })
    ),
    Match.orElse(() => ({
      status: 500,
      body: {
        error: "Internal server error",
        code: "INTERNAL_ERROR",
      },
    }))
  );

// =============================================================================
// Effect Handler
// =============================================================================

/**
 * Run an Effect and return a TanStack Start JSON response
 *
 * @param effect - The Effect to run
 * @returns A Response object with JSON body
 *
 * @example
 * ```ts
 * export const Route = createFileRoute("/api/users")({
 *   server: {
 *     handlers: {
 *       GET: async ({ request }) => {
 *         return runEffect(
 *           Effect.gen(function* () {
 *             const authContext = yield* requireSession(request.headers);
 *             const users = yield* getUsers();
 *             return users;
 *           })
 *         );
 *       },
 *     },
 *   },
 * });
 * ```
 */
export const runEffect = async <A, E>(
  effect: Effect.Effect<A, E, AppServices>
): Promise<Response> => {
  const exit = await AppRuntime.runPromiseExit(effect);

  return Exit.match(exit, {
    onSuccess: (value) => json(value),
    onFailure: (cause) => {
      const error = getErrorFromCause(cause);
      const { status, body } = mapErrorToResponse(error);
      return json(body, { status });
    },
  });
};

/**
 * Run an Effect that requires app services and return a TanStack Start JSON response
 *
 * @param effect - The Effect to run (can require AppServices)
 * @returns A Response object with JSON body
 */
export const runEffectWithServices = async <A, E>(
  effect: Effect.Effect<A, E, AppServices>
): Promise<Response> => {
  return runEffect(effect);
};

/**
 * Extract the primary error from an Effect Cause
 */
const getErrorFromCause = <E>(cause: Cause.Cause<E>): E | Error => {
  // Try to find a fail error first
  const failures = [...iterateCauseFailures(cause)];
  if (failures.length > 0) {
    return failures[0] as E;
  }

  // Fall back to defects (unexpected errors)
  const defects = [...iterateCauseDefects(cause)];
  if (defects.length > 0) {
    const defect = defects[0];
    return defect instanceof Error ? defect : new Error(String(defect));
  }

  return new Error("Unknown error");
};

/**
 * Iterate over failures in a Cause
 */
function* iterateCauseFailures<E>(
  cause: Cause.Cause<E>
): Generator<E, void, unknown> {
  const queue: Cause.Cause<E>[] = [cause];
  while (queue.length > 0) {
    const current = queue.pop()!;
    const tag = current._tag;

    if (tag === "Fail") {
      yield (current as Cause.Fail<E>).error;
    } else if (tag === "Sequential" || tag === "Parallel") {
      const composite = current as Cause.Sequential<E> | Cause.Parallel<E>;
      queue.push(composite.left, composite.right);
    }
  }
}

/**
 * Iterate over defects in a Cause
 */
function* iterateCauseDefects<E>(
  cause: Cause.Cause<E>
): Generator<unknown, void, unknown> {
  const queue: Cause.Cause<E>[] = [cause];
  while (queue.length > 0) {
    const current = queue.pop()!;
    const tag = current._tag;

    if (tag === "Die") {
      yield (current as Cause.Die).defect;
    } else if (tag === "Sequential" || tag === "Parallel") {
      const composite = current as Cause.Sequential<E> | Cause.Parallel<E>;
      queue.push(composite.left, composite.right);
    }
  }
}

// =============================================================================
// Utility Types
// =============================================================================

/**
 * Type helper for Effect handlers
 */
export type EffectHandler<A, E> = Effect.Effect<A, E, AppServices>;
