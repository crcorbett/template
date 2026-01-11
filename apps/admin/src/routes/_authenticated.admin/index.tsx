/**
 * Admin Index Page
 *
 * Landing page for the admin panel.
 */
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/")({
  component: AdminIndexComponent,
});

function AdminIndexComponent() {
  return (
    <div className="space-y-4">
      <p className="text-muted-foreground text-sm">
        Welcome to the admin panel. Select a section to manage.
      </p>
      <nav className="flex flex-col gap-2">
        <Link
          className="flex items-center gap-2 rounded-md border border-border p-3 transition-colors hover:bg-accent"
          to="/admin/users"
        >
          <span className="font-medium">User Management</span>
          <span className="text-muted-foreground text-xs">
            Manage users, roles, and permissions
          </span>
        </Link>
      </nav>
    </div>
  );
}
