/**
 * Admin Users Index
 *
 * Default view when no user is selected.
 */
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin/users/")({
  component: AdminUsersIndexComponent,
});

function AdminUsersIndexComponent() {
  return (
    <div className="flex h-40 items-center justify-center rounded-md border border-dashed border-border">
      <p className="text-muted-foreground text-sm">
        Select a user to view details
      </p>
    </div>
  );
}
