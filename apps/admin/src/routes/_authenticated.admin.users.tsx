/**
 * Admin User Management List Route
 *
 * Displays a list of all users with their roles for admin management.
 * Requires admin role to access.
 */
import { NotFound } from "$/components/not-found";
import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

/**
 * User with profile info and roles for admin display
 */
export interface AdminUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  emailVerified: boolean;
  createdAt: string;
  roles: readonly ("admin" | "editor" | "viewer")[];
  permissions: readonly (
    | "users:read"
    | "users:write"
    | "posts:read"
    | "posts:write"
    | "posts:delete"
  )[];
}

export const Route = createFileRoute("/_authenticated/admin/users")({
  loader: async () => {
    const res = await fetch("/api/admin/users");

    if (!res.ok) {
      if (res.status === 403) {
        throw new Error("Access denied. Admin role required.");
      }
      throw new Error("Failed to fetch users");
    }

    const data = await res.json();

    return data as AdminUser[];
  },
  component: AdminUsersComponent,
  errorComponent: ({ error }) => (
    <div className="rounded-md border border-destructive bg-destructive/10 p-4">
      <h3 className="font-medium text-destructive">Error</h3>
      <p className="text-muted-foreground text-sm">{error.message}</p>
    </div>
  ),
  notFoundComponent: () => <NotFound>No users found</NotFound>,
});

function AdminUsersComponent() {
  const users = Route.useLoaderData();

  return (
    <div className="flex gap-4">
      <div className="flex-1">
        <div className="mb-4 flex items-center justify-between">
          <h3 className="font-medium">Users ({users.length})</h3>
        </div>
        <div className="space-y-2">
          {users.map((user) => (
            <Link
              activeProps={{
                className: "ring-2 ring-primary/50",
              }}
              className="flex items-center gap-3 rounded-md border border-border p-3 transition-colors hover:bg-accent"
              key={user.id}
              params={{ "user-id": user.id }}
              to="/admin/users/$user-id"
            >
              {user.image ? (
                <img
                  alt={user.name ?? "User avatar"}
                  className="size-8 rounded-full"
                  src={user.image}
                />
              ) : (
                <div className="flex size-8 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs">
                  {(user.name ?? user.email)[0]?.toUpperCase() ?? "?"}
                </div>
              )}
              <div className="flex-1 overflow-hidden">
                <div className="truncate font-medium">
                  {user.name ?? "No name"}
                </div>
                <div className="truncate text-muted-foreground text-xs">
                  {user.email}
                </div>
              </div>
              <div className="flex flex-wrap gap-1">
                {user.roles.length > 0 ? (
                  user.roles.map((role) => (
                    <span
                      className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
                        role === "admin"
                          ? "bg-destructive/10 text-destructive"
                          : role === "editor"
                            ? "bg-primary/10 text-primary"
                            : "bg-muted text-muted-foreground"
                      }`}
                      key={role}
                    >
                      {role}
                    </span>
                  ))
                ) : (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] text-muted-foreground">
                    no roles
                  </span>
                )}
              </div>
            </Link>
          ))}
        </div>
      </div>
      <div className="w-80 shrink-0">
        <Outlet />
      </div>
    </div>
  );
}
