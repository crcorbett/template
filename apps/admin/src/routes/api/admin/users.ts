/**
 * Admin Users API Route
 *
 * GET /api/admin/users - List all users with their roles
 *
 * Requires admin role to access.
 */
import type { PermissionString, RoleName } from "@packages/types";

import {
  requireAdminMiddleware,
  securityHeadersMiddleware,
} from "$/utils/auth-middleware";
import { DEFAULT_ROLE_PERMISSIONS } from "@packages/types";
import { createFileRoute } from "@tanstack/react-router";
import { json } from "@tanstack/react-start";

/**
 * Admin user response schema (for type safety)
 */
export interface AdminUserResponse {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  roles: readonly RoleName[];
  permissions: readonly PermissionString[];
}

/**
 * Mock user data store (in production, this would be from database)
 * This simulates a database of users with their assigned roles
 */
const mockUserRoles = new Map<string, Set<RoleName>>();

/**
 * Get permissions for a set of roles
 */
export const getPermissionsForRoles = (
  roles: readonly RoleName[]
): PermissionString[] => {
  const permissionSet = new Set<PermissionString>();
  for (const role of roles) {
    const roleKey = role as "admin" | "editor" | "viewer";
    const rolePermissions = DEFAULT_ROLE_PERMISSIONS[roleKey];
    if (rolePermissions) {
      for (const perm of rolePermissions) {
        permissionSet.add(perm as PermissionString);
      }
    }
  }
  return Array.from(permissionSet);
};

/**
 * Get user roles from mock store
 */
export const getUserRolesFromStore = (userId: string): RoleName[] => {
  const roles = mockUserRoles.get(userId);
  return roles ? Array.from(roles) : [];
};

/**
 * Set user roles in mock store
 */
export const setUserRolesInStore = (
  userId: string,
  roles: RoleName[]
): void => {
  mockUserRoles.set(userId, new Set(roles));
};

export const Route = createFileRoute("/api/admin/users")({
  server: {
    middleware: [securityHeadersMiddleware, requireAdminMiddleware],
    handlers: {
      GET: async () => {
        // In production, this would query the database
        // For now, fetch from jsonplaceholder and add mock roles
        const res = await fetch("https://jsonplaceholder.typicode.com/users");
        if (!res.ok) {
          return json({ error: "Failed to fetch users" }, { status: 500 });
        }

        const rawUsers = (await res.json()) as Array<{
          id: number;
          name: string;
          email: string;
        }>;

        // Transform to admin user format with roles
        const users: AdminUserResponse[] = rawUsers.slice(0, 10).map((u) => {
          // Generate a UUID-like ID for consistency with branded types
          const id = `00000000-0000-0000-0000-${String(u.id).padStart(12, "0")}`;
          const roles = getUserRolesFromStore(id);
          const permissions = getPermissionsForRoles(roles);

          return {
            id,
            email: u.email.toLowerCase(),
            name: u.name,
            image: null,
            emailVerified: true,
            createdAt: new Date().toISOString(),
            roles,
            permissions,
          };
        });

        return json(users);
      },
    },
  },
});
