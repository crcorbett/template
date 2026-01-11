/**
 * Session Info API Route
 *
 * Returns the current user's session information using Effect for error handling.
 * This provides a type-safe, Effect-wrapped endpoint for session retrieval.
 */
import { createFileRoute } from "@tanstack/react-router";

import { Effect, Option } from "effect";

import { getSession } from "$/lib/effect/services/auth";
import { securityHeadersMiddleware } from "$/middleware/security";
import { runEffect } from "$/utils/effect-handler";

/**
 * Session response type
 */
interface SessionResponse {
  readonly authenticated: boolean;
  readonly user: {
    readonly id: string;
    readonly email: string;
    readonly name: string | null;
    readonly image: string | null;
    readonly emailVerified: boolean;
  } | null;
  readonly session: {
    readonly id: string;
    readonly expiresAt: string;
  } | null;
}

export const Route = createFileRoute("/api/auth/session")({
  server: {
    middleware: [securityHeadersMiddleware],
    handlers: {
      /**
       * GET /api/auth/session
       *
       * Returns the current session information.
       * - If authenticated: returns user and session details
       * - If not authenticated: returns { authenticated: false }
       */
      GET: async ({ request }: { request: Request }) => {
        return runEffect(
          Effect.gen(function* () {
            const maybeSession = yield* getSession(request.headers);

            return Option.match(maybeSession, {
              onNone: (): SessionResponse => ({
                authenticated: false,
                user: null,
                session: null,
              }),
              onSome: (ctx): SessionResponse => ({
                authenticated: true,
                user: {
                  id: ctx.user.id,
                  email: ctx.user.email,
                  name: ctx.user.name,
                  image: ctx.user.image,
                  emailVerified: ctx.user.emailVerified,
                },
                session: {
                  id: ctx.session.id,
                  expiresAt: ctx.session.expiresAt.toISOString(),
                },
              }),
            });
          })
        );
      },
    },
  },
});
