import { createFileRoute, Link, Outlet } from "@tanstack/react-router";

import { fetchPosts } from "../utils/posts";

export const Route = createFileRoute("/_authenticated/posts")({
  loader: async () => fetchPosts(),
  component: PostsComponent,
});

function PostsComponent() {
  const posts = Route.useLoaderData();

  return (
    <div className="flex gap-2 p-2">
      <ul className="list-disc pl-4">
        {[...posts, { id: "i-do-not-exist", title: "Non-existent Post" }].map(
          (post) => (
            <li className="whitespace-nowrap" key={post.id}>
              <Link
                activeProps={{ className: "text-black font-bold" }}
                className="block py-1 text-blue-800 hover:text-blue-600"
                params={{
                  "post-id": String(post.id),
                }}
                to="/posts/$post-id"
              >
                <div>{post.title.substring(0, 20)}</div>
              </Link>
            </li>
          )
        )}
      </ul>
      <hr />
      <Outlet />
    </div>
  );
}
