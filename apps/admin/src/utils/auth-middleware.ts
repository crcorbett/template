/**
 * Permission-Aware Auth Middleware
 *
 * Provides TanStack Start middlewares for authentication and authorization.
 * Integrates Better Auth session verification with Effect-based RBAC checks.
 */
import { createMiddleware, json } from "@tanstack/react-start";

import { Effect, Exit, Option, Schema } from "effect";

import type {
  AuthContext,
  PermissionString,
  RoleName,
  UserId,
  UserWithRoles,
} from "@packages/types";
import {
  PermissionString as PermissionStringSchema,
  RoleName as RoleNameSchema,
} from "@packages/types";

import { getSession, NoSessionError } from "$/lib/effect/services/auth";
import {
  getUserRoles,
  hasPermission,
  hasRole,
  InsufficientPermissionError,
  InsufficientRoleError,
} from "$/lib/effect/services/permissions";
import { AppRuntime } from "$/lib/effect/runtime";

// =============================================================================
// Types
// =============================================================================

/**
 * Context provided by auth middleware
 */
export interface AuthenticatedContext {
  readonly auth: AuthContext;
  readonly userId: UserId;
}

/**
 * Context provided by role middleware
 */
export interface RoleContext extends AuthenticatedContext {
  readonly userRoles: UserWithRoles;
}

/**
 * Error response format for auth errors
 */
interface AuthErrorResponse {
  readonly error: string;
  readonly code: string;
  readonly details?: unknown;
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Create a JSON error response
 */
const errorResponse = (
  status: number,
  error: string,
  code: string,
  details?: unknown
): Response => {
  const body: AuthErrorResponse = details !== undefined
    ? { error, code, details }
    : { error, code };
  return json(body, { status });
};

/**
 * Decode a role name with Effect Schema
 */
const decodeRoleName = (role: string): RoleName =>
  Schema.decodeUnknownSync(RoleNameSchema)(role);

/**
 * Decode a permission string with Effect Schema
 */
const decodePermissionString = (permission: string): PermissionString =>
  Schema.decodeUnknownSync(PermissionStringSchema)(permission);

// =============================================================================
// Core Auth Middleware
// =============================================================================

/**
 * Middleware that requires authentication.
 *
 * Redirects unauthenticated users to the login page, preserving the original
 * URL for post-login redirect.
 *
 * Provides `auth` and `userId` in the middleware context.
 *
 * @example
 * ```ts
 * export const Route = createFileRoute("/admin/dashboard")({
 *   server: {
 *     middleware: [requireAuthMiddleware],
 *     handlers: {
 *       GET: async ({ context }) => {
 *         const { auth, userId } = context;
 *         // userId is the authenticated user's ID
 *       },
 *     },
 *   },
 * });
 * ```
 */
export const requireAuthMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const effect = Effect.gen(function* () {
      const maybeSession = yield* getSession(request.headers);

      return Option.match(maybeSession, {
        onNone: () =>
          Effect.fail(new NoSessionError({ message: "Authentication required" })),
        onSome: (ctx) => Effect.succeed(ctx),
      });
    }).pipe(Effect.flatten);

    const exit = await AppRuntime.runPromiseExit(effect);

    return Exit.match(exit, {
      onSuccess: (auth) => {
        return next({
          context: {
            auth,
            userId: auth.user.id,
          },
        });
      },
      onFailure: (_cause) => {
        // Build redirect URL with original path for post-login redirect
        const url = new URL(request.url);
        const returnTo = encodeURIComponent(url.pathname + url.search);
        const loginUrl = `/login?returnTo=${returnTo}`;

        throw new Response(null, {
          status: 302,
          headers: { Location: loginUrl },
        });
      },
    });
  }
);

/**
 * Middleware that requires authentication but returns 401 instead of redirecting.
 *
 * Use this for API routes where a redirect doesn't make sense.
 *
 * @example
 * ```ts
 * export const Route = createFileRoute("/api/protected/data")({
 *   server: {
 *     middleware: [requireAuthApiMiddleware],
 *     handlers: {
 *       GET: async ({ context }) => {
 *         const { userId } = context;
 *         return json({ userId });
 *       },
 *     },
 *   },
 * });
 * ```
 */
export const requireAuthApiMiddleware = createMiddleware().server(
  async ({ next, request }) => {
    const effect = Effect.gen(function* () {
      const maybeSession = yield* getSession(request.headers);

      return Option.match(maybeSession, {
        onNone: () =>
          Effect.fail(new NoSessionError({ message: "Authentication required" })),
        onSome: (ctx) => Effect.succeed(ctx),
      });
    }).pipe(Effect.flatten);

    const exit = await AppRuntime.runPromiseExit(effect);

    return Exit.match(exit, {
      onSuccess: (auth) => {
        return next({
          context: {
            auth,
            userId: auth.user.id,
          },
        });
      },
      onFailure: () => {
        throw errorResponse(401, "Authentication required", "NO_SESSION");
      },
    });
  }
);

// =============================================================================
// Role-Based Middleware Factory
// =============================================================================

/**
 * Create a middleware that requires the user to have a specific role.
 *
 * Uses Effect Schemas and branded types from @packages/types for type safety.
 *
 * @param role - The role name to require (admin, editor, viewer)
 * @returns TanStack middleware that checks for the role
 *
 * @example
 * ```ts
 * const requireAdminMiddleware = createRequireRoleMiddleware("admin");
 *
 * export const Route = createFileRoute("/admin/users")({
 *   server: {
 *     middleware: [requireAdminMiddleware],
 *     handlers: {
 *       GET: async ({ context }) => {
 *         // Only admins can access this
 *         const { userRoles } = context;
 *       },
 *     },
 *   },
 * });
 * ```
 */
export const createRequireRoleMiddleware = (role: "admin" | "editor" | "viewer") => {
  const requiredRole = decodeRoleName(role);

  return createMiddleware()
    .middleware([requireAuthApiMiddleware])
    .server(async ({ next, context }) => {
      const { userId } = context as AuthenticatedContext;

      const effect = Effect.gen(function* () {
        const userRolesData = yield* getUserRoles(userId);
        const roleExists = yield* hasRole(userId, requiredRole);

        if (!roleExists) {
          return yield* Effect.fail(
            new InsufficientRoleError({
              userId,
              requiredRole,
              userRoles: userRolesData.roles,
              message: `User does not have required role: ${role}`,
            })
          );
        }

        return userRolesData;
      });

      const exit = await AppRuntime.runPromiseExit(effect);

      return Exit.match(exit, {
        onSuccess: (userRoles) => {
          return next({
            context: {
              userRoles,
            },
          });
        },
        onFailure: (cause) => {
          // Extract the error from the cause
          const error = extractError(cause);

          if (error instanceof InsufficientRoleError) {
            throw errorResponse(403, error.message, "INSUFFICIENT_ROLE", {
              requiredRole: error.requiredRole,
              userRoles: error.userRoles,
            });
          }

          throw errorResponse(500, "Failed to check user role", "INTERNAL_ERROR");
        },
      });
    });
};

/**
 * Pre-built middleware requiring admin role
 */
export const requireAdminMiddleware = createRequireRoleMiddleware("admin");

/**
 * Pre-built middleware requiring editor role
 */
export const requireEditorMiddleware = createRequireRoleMiddleware("editor");

/**
 * Pre-built middleware requiring viewer role
 */
export const requireViewerMiddleware = createRequireRoleMiddleware("viewer");

// =============================================================================
// Permission-Based Middleware Factory
// =============================================================================

/**
 * Create a middleware that requires the user to have a specific permission.
 *
 * Uses Effect Schemas and branded PermissionString type from @packages/types.
 *
 * @param permission - The permission string to require (e.g., "users:read", "posts:write")
 * @returns TanStack middleware that checks for the permission
 *
 * @example
 * ```ts
 * const requireUsersReadMiddleware = createRequirePermissionMiddleware("users:read");
 *
 * export const Route = createFileRoute("/api/users")({
 *   server: {
 *     middleware: [requireUsersReadMiddleware],
 *     handlers: {
 *       GET: async ({ context }) => {
 *         // Only users with "users:read" permission can access this
 *       },
 *     },
 *   },
 * });
 * ```
 */
export const createRequirePermissionMiddleware = (
  permission: "users:read" | "users:write" | "posts:read" | "posts:write" | "posts:delete"
) => {
  const requiredPermission = decodePermissionString(permission);

  return createMiddleware()
    .middleware([requireAuthApiMiddleware])
    .server(async ({ next, context }) => {
      const { userId } = context as AuthenticatedContext;

      const effect = Effect.gen(function* () {
        const userRolesData = yield* getUserRoles(userId);
        const permissionExists = yield* hasPermission(userId, requiredPermission);

        if (!permissionExists) {
          return yield* Effect.fail(
            new InsufficientPermissionError({
              userId,
              requiredPermission,
              userPermissions: userRolesData.permissions,
              message: `User does not have required permission: ${permission}`,
            })
          );
        }

        return userRolesData;
      });

      const exit = await AppRuntime.runPromiseExit(effect);

      return Exit.match(exit, {
        onSuccess: (userRoles) => {
          return next({
            context: {
              userRoles,
            },
          });
        },
        onFailure: (cause) => {
          const error = extractError(cause);

          if (error instanceof InsufficientPermissionError) {
            throw errorResponse(403, error.message, "INSUFFICIENT_PERMISSION", {
              requiredPermission: error.requiredPermission,
              userPermissions: error.userPermissions,
            });
          }

          throw errorResponse(500, "Failed to check user permission", "INTERNAL_ERROR");
        },
      });
    });
};

/**
 * Pre-built permission middlewares for common use cases
 */
export const requireUsersReadMiddleware = createRequirePermissionMiddleware("users:read");
export const requireUsersWriteMiddleware = createRequirePermissionMiddleware("users:write");
export const requirePostsReadMiddleware = createRequirePermissionMiddleware("posts:read");
export const requirePostsWriteMiddleware = createRequirePermissionMiddleware("posts:write");
export const requirePostsDeleteMiddleware = createRequirePermissionMiddleware("posts:delete");

// =============================================================================
// Helper to extract error from Cause
// =============================================================================

import type { Cause } from "effect";

/**
 * Extract the primary error from an Effect Cause
 */
const extractError = <E>(cause: Cause.Cause<E>): E | Error => {
  const queue: Cause.Cause<E>[] = [cause];

  while (queue.length > 0) {
    const current = queue.pop()!;
    const tag = current._tag;

    if (tag === "Fail") {
      return (current as Cause.Fail<E>).error;
    } else if (tag === "Die") {
      const defect = (current as Cause.Die).defect;
      return defect instanceof Error ? defect : new Error(String(defect));
    } else if (tag === "Sequential" || tag === "Parallel") {
      const composite = current as Cause.Sequential<E> | Cause.Parallel<E>;
      queue.push(composite.left, composite.right);
    }
  }

  return new Error("Unknown error");
};

// =============================================================================
// Composable Middleware Exports
// =============================================================================

/**
 * Combine auth middleware with security headers for protected routes
 */
export { securityHeadersMiddleware, corsMiddleware } from "$/middleware/security";
