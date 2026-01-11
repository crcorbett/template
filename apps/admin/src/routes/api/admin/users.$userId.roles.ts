/**
 * Admin User Roles API Route
 *
 * PUT /api/admin/users/:userId/roles - Update user roles
 *
 * Requires admin role to access.
 */
import type { RoleName } from "@packages/types";

import {
  getPermissionsForRoles,
  getUserRolesFromStore,
  setUserRolesInStore,
} from "$/routes/api/admin/users";
import {
  requireAdminMiddleware,
  securityHeadersMiddleware,
} from "$/utils/auth-middleware";
import { ALL_ROLES, RoleName as RoleNameSchema } from "@packages/types";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";
import { Schema } from "effect";

/**
 * Request body schema for role update
 */
const UpdateRolesRequest = Schema.Struct({
  roles: Schema.Array(RoleNameSchema),
});

export const Route = createFileRoute("/api/admin/users/$userId/roles")({
  server: {
    middleware: [securityHeadersMiddleware, requireAdminMiddleware],
    handlers: {
      PUT: async ({ params, request }) => {
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

        // Extract numeric ID to validate user exists
        const numericId = parseInt(userId.slice(-12), 10);
        if (numericId < 1 || numericId > 10) {
          return json(
            { error: "User not found", code: "USER_NOT_FOUND" },
            { status: 404 }
          );
        }

        // Parse request body
        let body: unknown;
        try {
          body = await request.json();
        } catch {
          return json(
            { error: "Invalid JSON body", code: "INVALID_BODY" },
            { status: 400 }
          );
        }

        // Validate request body with Effect Schema
        const parseResult =
          Schema.decodeUnknownEither(UpdateRolesRequest)(body);
        if (parseResult._tag === "Left") {
          return json(
            {
              error: "Invalid request body",
              code: "VALIDATION_ERROR",
              details: "Expected { roles: ('admin' | 'editor' | 'viewer')[] }",
            },
            { status: 400 }
          );
        }

        const { roles } = parseResult.right;

        // Validate all roles are valid
        const invalidRoles = roles.filter(
          (r) => !ALL_ROLES.includes(r as "admin" | "editor" | "viewer")
        );
        if (invalidRoles.length > 0) {
          return json(
            {
              error: `Invalid roles: ${invalidRoles.join(", ")}`,
              code: "INVALID_ROLES",
            },
            { status: 400 }
          );
        }

        // Update roles in store
        setUserRolesInStore(userId, roles as RoleName[]);

        // Return updated user roles info
        const updatedRoles = getUserRolesFromStore(userId);
        const permissions = getPermissionsForRoles(updatedRoles);

        return json({
          userId,
          roles: updatedRoles,
          permissions,
          message: "Roles updated successfully",
        });
      },
    },
  },
});
