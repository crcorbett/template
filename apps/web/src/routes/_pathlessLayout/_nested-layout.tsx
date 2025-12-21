import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_pathlessLayout/_nested-layout")({
  component: LayoutComponent,
});

function LayoutComponent() {
  return (
    <div>
      <div>I'm a nested layout</div>
      <div className="flex gap-2 border-b">
        <Link
          activeProps={{
            className: "font-bold",
          }}
          to="/route-a"
        >
          Go to route A
        </Link>
        <Link
          activeProps={{
            className: "font-bold",
          }}
          to="/route-b"
        >
          Go to route B
        </Link>
      </div>
      <div>
        <Outlet />
      </div>
    </div>
  );
}
