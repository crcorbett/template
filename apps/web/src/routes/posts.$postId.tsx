import { createFileRoute, Link } from "@tanstack/react-router";
import { NotFound } from "$/components/NotFound";
import { PostErrorComponent } from "$/components/PostError";
import { fetchPost } from "../utils/posts";

export const Route = createFileRoute("/posts/$postId")({
  loader: ({ params: { postId } }) => fetchPost({ data: postId }),
  errorComponent: PostErrorComponent,
  component: PostComponent,
  notFoundComponent: () => <NotFound>Post not found</NotFound>,
});

function PostComponent() {
  const post = Route.useLoaderData();

  return (
    <div className="space-y-2">
      <h4 className="font-bold text-xl underline">{post.title}</h4>
      <div className="text-sm">{post.body}</div>
      <Link
        activeProps={{ className: "text-black font-bold" }}
        className="inline-block py-1 text-blue-800 hover:text-blue-600"
        params={{
          postId: String(post.id),
        }}
        to="/posts/$postId/deep"
      >
        Deep View
      </Link>
    </div>
  );
}
