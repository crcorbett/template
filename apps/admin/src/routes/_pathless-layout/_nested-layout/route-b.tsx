import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute(
  "/_pathless-layout/_nested-layout/route-b"
)({
  component: LayoutBComponent,
});

function LayoutBComponent() {
  return <div>I'm B!</div>;
}
