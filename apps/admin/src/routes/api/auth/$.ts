/**
 * Better Auth Catch-All Route
 *
 * This route handles all Better Auth API requests at /api/auth/*
 * Including OAuth callbacks, session management, sign in/out, etc.
 */
import { auth } from "$/lib/auth";
import { securityHeadersMiddleware } from "$/middleware/security";
import { createFileRoute } from "@tanstack/react-router";

/**
 * Better Auth catch-all route handler
 *
 * Routes handled by Better Auth:
 * - GET/POST /api/auth/signin/* - OAuth provider sign-in flows
 * - GET /api/auth/callback/* - OAuth callback handlers
 * - POST /api/auth/signout - Sign out
 * - GET /api/auth/session - Get current session
 * - And more depending on Better Auth configuration
 */
export const Route = createFileRoute("/api/auth/$")({
  server: {
    middleware: [securityHeadersMiddleware],
    handlers: {
      GET: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
      POST: async ({ request }: { request: Request }) => {
        return await auth.handler(request);
      },
    },
  },
});
