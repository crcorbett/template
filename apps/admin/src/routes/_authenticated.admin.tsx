/**
 * Admin Layout Route
 *
 * Parent layout for all /admin/* routes.
 * Requires authentication (inherited from _authenticated).
 */
import { createFileRoute, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/admin")({
  component: AdminLayout,
});

function AdminLayout() {
  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex items-center gap-2 border-b border-border pb-2">
        <h2 className="font-semibold text-lg">Admin Panel</h2>
      </div>
      <Outlet />
    </div>
  );
}
