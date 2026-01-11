import type { User } from "@packages/core/user";

import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/users")({
  loader: async () => {
    const res = await fetch("/api/users");

    if (!res.ok) {
      throw new Error("Unexpected status code");
    }

    const data = await res.json();

    return data as User[];
  },
  component: UsersComponent,
});

function UsersComponent() {
  const users = Route.useLoaderData();

  return (
    <div className="flex gap-2 p-2">
      <ul className="list-disc pl-4">
        {[
          ...users,
          { id: "i-do-not-exist", name: "Non-existent User", email: "" },
        ].map((user) => (
          <li className="whitespace-nowrap" key={user.id}>
            <Link
              activeProps={{ className: "text-black font-bold" }}
              className="block py-1 text-blue-800 hover:text-blue-600"
              params={{
                "user-id": String(user.id),
              }}
              to="/users/$user-id"
            >
              <div>{user.name}</div>
            </Link>
          </li>
        ))}
      </ul>
      <hr />
      <Outlet />
    </div>
  );
}
