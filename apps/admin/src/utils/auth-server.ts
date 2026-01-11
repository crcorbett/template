/**
 * Server-side authentication utilities
 *
 * Provides server functions for checking auth state in route loaders/beforeLoad.
 * Uses Better Auth session validation through Effect services.
 */
import { auth } from "$/lib/auth";
import { AuthContext as AuthContextSchema } from "@packages/types";
import { createServerFn } from "@tanstack/react-start";
import { getRequestHeaders } from "@tanstack/react-start/server";
import { Schema } from "effect";

/**
 * Decoded AuthContext type from Effect Schema
 */
export type ServerAuthContext = typeof AuthContextSchema.Type;

/**
 * Server function to get the current auth session
 *
 * Uses Better Auth's getSession API with cookies from the request.
 * Returns null if no valid session exists.
 *
 * @example
 * ```ts
 * const session = await getServerSession();
 * if (!session) {
 *   throw redirect({ to: "/login" });
 * }
 * ```
 */
export const getServerSession = createServerFn().handler(async () => {
  const headers = new Headers(getRequestHeaders());

  const session = await auth.api.getSession({
    headers,
  });

  if (!session) {
    return null;
  }

  // Decode through Effect Schema to ensure branded types
  // Better Auth returns Date objects which match our Schema.Date
  const authContext = Schema.decodeUnknownSync(AuthContextSchema)({
    user: {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name ?? null,
      emailVerified: session.user.emailVerified,
      image: session.user.image ?? null,
      createdAt: session.user.createdAt,
      updatedAt: session.user.updatedAt,
    },
    session: {
      id: session.session.id,
      userId: session.session.userId,
      token: session.session.token,
      expiresAt: session.session.expiresAt,
      ipAddress: session.session.ipAddress ?? null,
      userAgent: session.session.userAgent ?? null,
      createdAt: session.session.createdAt,
      updatedAt: session.session.updatedAt,
    },
  });

  return authContext;
});

/**
 * Server function to check if user is authenticated
 *
 * Lightweight check that just validates session exists.
 *
 * @example
 * ```ts
 * const isAuth = await isAuthenticated();
 * ```
 */
export const isAuthenticated = createServerFn().handler(async () => {
  const headers = new Headers(getRequestHeaders());

  const session = await auth.api.getSession({
    headers,
  });

  return session !== null;
});
