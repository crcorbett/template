import { createFileRoute, Link } from "@tanstack/react-router";
import { PostErrorComponent } from "$/components/PostError";
import { fetchPost } from "../utils/posts";

export const Route = createFileRoute("/posts_/$postId/deep")({
  loader: async ({ params: { postId } }) =>
    fetchPost({
      data: postId,
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
