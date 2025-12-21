import { createFileRoute, Link, Outlet } from "@tanstack/react-router";
import { fetchPosts } from "../utils/posts";

export const Route = createFileRoute("/posts")({
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
                  postId: String(post.id),
                }}
                to="/posts/$postId"
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
