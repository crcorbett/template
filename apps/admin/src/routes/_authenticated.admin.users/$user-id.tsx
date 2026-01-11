/**
 * Admin User Detail Route
 *
 * Shows user details and allows role assignment for admins.
 */
import type { AdminUser } from "$/routes/_authenticated.admin.users";

import { NotFound } from "$/components/not-found";
import { UserErrorComponent } from "$/components/user-error";
import { ALL_ROLES, DEFAULT_ROLE_PERMISSIONS } from "@packages/types";
import { createFileRoute, useRouter } from "@tanstack/react-router";
import { useCallback, useState, useTransition } from "react";

export const Route = createFileRoute("/_authenticated/admin/users/$user-id")({
  loader: async ({ params }) => {
    try {
      const res = await fetch(`/api/admin/users/${params["user-id"]}`);

      if (!res.ok) {
        if (res.status === 404) {
          throw new Error("User not found");
        }
        if (res.status === 403) {
          throw new Error("Access denied. Admin role required.");
        }
        throw new Error("Failed to fetch user");
      }

      return (await res.json()) as AdminUser;
    } catch (e) {
      throw new Error(
        e instanceof Error ? e.message : "Failed to fetch user details"
      );
    }
  },
  errorComponent: UserErrorComponent,
  component: AdminUserDetailComponent,
  notFoundComponent: () => <NotFound>User not found</NotFound>,
});

function AdminUserDetailComponent() {
  const user = Route.useLoaderData();
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [selectedRoles, setSelectedRoles] = useState<Set<string>>(
    new Set(user.roles)
  );

  const handleRoleToggle = useCallback((role: string) => {
    setSelectedRoles((prev) => {
      const next = new Set(prev);
      if (next.has(role)) {
        next.delete(role);
      } else {
        next.add(role);
      }
      return next;
    });
    setError(null);
  }, []);

  const handleSaveRoles = useCallback(() => {
    startTransition(async () => {
      try {
        const res = await fetch(`/api/admin/users/${user.id}/roles`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ roles: Array.from(selectedRoles) }),
        });

        if (!res.ok) {
          const data = await res.json();
          throw new Error(data.error ?? "Failed to update roles");
        }

        router.invalidate();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to save roles");
      }
    });
  }, [user.id, selectedRoles, router]);

  const hasChanges =
    selectedRoles.size !== user.roles.length ||
    !user.roles.every((r) => selectedRoles.has(r));

  const derivedPermissions = Array.from(selectedRoles).flatMap((role) => {
    const roleKey = role as keyof typeof DEFAULT_ROLE_PERMISSIONS;
    return DEFAULT_ROLE_PERMISSIONS[roleKey] ?? [];
  });
  const uniquePermissions = Array.from(new Set(derivedPermissions));

  return (
    <div className="space-y-4 rounded-md border border-border p-4">
      <div className="flex items-start gap-3">
        {user.image ? (
          <img
            alt={user.name ?? "User avatar"}
            className="size-12 rounded-full"
            src={user.image}
          />
        ) : (
          <div className="flex size-12 items-center justify-center rounded-full bg-muted text-muted-foreground">
            {(user.name ?? user.email)[0]?.toUpperCase() ?? "?"}
          </div>
        )}
        <div className="flex-1 overflow-hidden">
          <h4 className="truncate font-semibold">{user.name ?? "No name"}</h4>
          <p className="truncate text-muted-foreground text-xs">{user.email}</p>
          <div className="mt-1 flex items-center gap-1">
            <span
              className={`h-2 w-2 rounded-full ${user.emailVerified ? "bg-green-500" : "bg-amber-500"}`}
            />
            <span className="text-muted-foreground text-[10px]">
              {user.emailVerified ? "Verified" : "Unverified"}
            </span>
          </div>
        </div>
      </div>

      <div className="border-t border-border pt-4">
        <h5 className="mb-2 font-medium text-sm">Roles</h5>
        <div className="space-y-2">
          {ALL_ROLES.map((role) => (
            <label
              className="flex cursor-pointer items-center gap-2"
              key={role}
            >
              <input
                checked={selectedRoles.has(role)}
                className="size-4 rounded border-border accent-primary"
                disabled={isPending}
                onChange={() => handleRoleToggle(role)}
                type="checkbox"
              />
              <span
                className={`rounded-full px-2 py-0.5 text-xs font-medium ${
                  role === "admin"
                    ? "bg-destructive/10 text-destructive"
                    : role === "editor"
                      ? "bg-primary/10 text-primary"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {role}
              </span>
              <span className="text-muted-foreground text-xs">
                {role === "admin"
                  ? "Full access"
                  : role === "editor"
                    ? "Can edit posts"
                    : "Read-only"}
              </span>
            </label>
          ))}
        </div>

        {hasChanges && (
          <div className="mt-4 flex items-center gap-2">
            <button
              className="rounded-md bg-primary px-3 py-1.5 font-medium text-primary-foreground text-xs transition-colors hover:bg-primary/90 disabled:opacity-50"
              disabled={isPending}
              onClick={handleSaveRoles}
              type="button"
            >
              {isPending ? "Saving..." : "Save Changes"}
            </button>
            <button
              className="rounded-md border border-border px-3 py-1.5 text-xs transition-colors hover:bg-accent disabled:opacity-50"
              disabled={isPending}
              onClick={() => {
                setSelectedRoles(new Set(user.roles));
                setError(null);
              }}
              type="button"
            >
              Cancel
            </button>
          </div>
        )}

        {error && <p className="mt-2 text-destructive text-xs">{error}</p>}
      </div>

      <div className="border-t border-border pt-4">
        <h5 className="mb-2 font-medium text-sm">Derived Permissions</h5>
        <div className="flex flex-wrap gap-1">
          {uniquePermissions.length > 0 ? (
            uniquePermissions.sort().map((perm) => (
              <span
                className="rounded bg-muted px-1.5 py-0.5 font-mono text-[10px] text-muted-foreground"
                key={perm}
              >
                {perm}
              </span>
            ))
          ) : (
            <span className="text-muted-foreground text-xs italic">
              No permissions
            </span>
          )}
        </div>
        <p className="mt-2 text-muted-foreground text-[10px]">
          Permissions are automatically derived from assigned roles
        </p>
      </div>

      <div className="border-t border-border pt-4">
        <h5 className="mb-2 font-medium text-sm">Info</h5>
        <dl className="space-y-1 text-xs">
          <div className="flex justify-between">
            <dt className="text-muted-foreground">User ID</dt>
            <dd className="truncate font-mono text-[10px]">{user.id}</dd>
          </div>
          <div className="flex justify-between">
            <dt className="text-muted-foreground">Created</dt>
            <dd>{new Date(user.createdAt).toLocaleDateString()}</dd>
          </div>
        </dl>
      </div>
    </div>
  );
}
