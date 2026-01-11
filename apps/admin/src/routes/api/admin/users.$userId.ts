/**
 * Admin User Detail API Route
 *
 * GET /api/admin/users/:userId - Get user details with roles
 *
 * Requires admin role to access.
 */
import type { AdminUserResponse } from "$/routes/api/admin/users";

import {
  getPermissionsForRoles,
  getUserRolesFromStore,
} from "$/routes/api/admin/users";
import {
  requireAdminMiddleware,
  securityHeadersMiddleware,
} from "$/utils/auth-middleware";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

export const Route = createFileRoute("/api/admin/users/$userId")({
  server: {
    middleware: [securityHeadersMiddleware, requireAdminMiddleware],
    handlers: {
      GET: async ({ params }) => {
        const userId = params.userId;

        // Validate UUID format
        const uuidRegex =
          /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
        if (!uuidRegex.test(userId)) {
          return json(
            { error: "Invalid user ID format", code: "INVALID_USER_ID" },
            { status: 400 }
          );
        }

        // Extract the numeric ID from our mock UUID format
        const numericId = parseInt(userId.slice(-12), 10);
        if (numericId < 1 || numericId > 10) {
          return json(
            { error: "User not found", code: "USER_NOT_FOUND" },
            { status: 404 }
          );
        }

        // Fetch user from jsonplaceholder
        const res = await fetch(
          `https://jsonplaceholder.typicode.com/users/${numericId}`
        );
        if (!res.ok) {
          if (res.status === 404) {
            return json(
              { error: "User not found", code: "USER_NOT_FOUND" },
              { status: 404 }
            );
          }
          return json(
            { error: "Failed to fetch user", code: "FETCH_ERROR" },
            { status: 500 }
          );
        }

        const rawUser = (await res.json()) as {
          id: number;
          name: string;
          email: string;
        };

        const roles = getUserRolesFromStore(userId);
        const permissions = getPermissionsForRoles(roles);

        const user: AdminUserResponse = {
          id: userId,
          email: rawUser.email.toLowerCase(),
          name: rawUser.name,
          image: null,
          emailVerified: true,
          createdAt: new Date().toISOString(),
          roles,
          permissions,
        };

        return json(user);
      },
    },
  },
});

/**
 * Get permissions for a set of roles
 * Re-export for use by child routes
 */
export { getPermissionsForRoles, getUserRolesFromStore };
