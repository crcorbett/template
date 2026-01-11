import { PostErrorComponent } from "$/components/post-error";
import { fetchPost } from "$/utils/posts";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/posts_/$post-id/deep")({
  loader: async ({ params }) =>
    fetchPost({
      data: params["post-id"],
    }),
  errorComponent: PostErrorComponent,
  component: PostDeepComponent,
});

function PostDeepComponent() {
  const post = Route.useLoaderData();

  return (
    <div className="space-y-2 p-2">
      <Link
        className="block py-1 text-blue-800 hover:text-blue-600"
        to="/posts"
      >
        ← All Posts
      </Link>
      <h4 className="font-bold text-xl underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
    </div>
  );
}
