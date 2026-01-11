/**
 * Authenticated Layout Route
 *
 * This pathless layout route protects all child routes, requiring authentication.
 * Unauthenticated users are redirected to /login with the original URL preserved.
 *
 * Child routes:
 * - /posts/* (posts:read permission)
 * - /users/* (users:read permission)
 */
import { getServerSession } from "$/utils/auth-server";
import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated")({
  beforeLoad: async ({ location }) => {
    const session = await getServerSession();

    if (!session) {
      // Preserve the original URL for post-login redirect
      const returnTo = location.pathname + location.search;
      throw redirect({
        to: "/login",
        search: {
          returnTo,
        },
      });
    }

    // Provide auth context to child routes
    return {
      auth: session,
      userId: session.user.id,
    };
  },
  component: AuthenticatedLayout,
});

function AuthenticatedLayout() {
  return <Outlet />;
}
