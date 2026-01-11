import { NotFound } from "$/components/not-found";
import { PostErrorComponent } from "$/components/post-error";
import { fetchPost } from "$/utils/posts";
import { createFileRoute, Link } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/posts/$post-id")({
  loader: ({ params }) => fetchPost({ data: params["post-id"] }),
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
          "post-id": String(post.id),
        }}
        to="/posts/$post-id/deep"
      >
        Deep View
      </Link>
    </div>
  );
}
