import { LoginButton } from "$/components/auth/login-button";
import { useSession } from "$/lib/auth-client";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@packages/ui/ui/card";
import { Separator } from "@packages/ui/ui/separator";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";

export const Route = createFileRoute("/login")({
  validateSearch: (search: Record<string, unknown>): { returnTo: string } => ({
    returnTo: typeof search["returnTo"] === "string" ? search["returnTo"] : "/",
  }),
  component: LoginPage,
});

function LoginPage() {
  const { data: session, isPending } = useSession();
  const search = Route.useSearch();
  const navigate = useNavigate();

  // Redirect if already authenticated
  useEffect(() => {
    if (!isPending && session?.user) {
      navigate({ to: search.returnTo as "/" });
    }
  }, [isPending, session, search.returnTo, navigate]);

  // Don't render the login page if already authenticated
  if (!isPending && session?.user) {
    return (
      <div className="flex min-h-[80vh] items-center justify-center p-4">
        <div className="text-muted-foreground">Redirecting...</div>
      </div>
    );
  }

  return (
    <div className="flex min-h-[80vh] items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle className="text-xl">Welcome back</CardTitle>
          <CardDescription>Sign in to access the admin panel</CardDescription>
        </CardHeader>
        <CardContent className="flex flex-col gap-4">
          {isPending ? (
            <div className="flex flex-col gap-3">
              <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
              <div className="h-8 w-full animate-pulse rounded-md bg-muted" />
            </div>
          ) : (
            <>
              <LoginButton
                callbackURL={search.returnTo}
                className="w-full"
                provider="google"
              />
              <div className="flex items-center gap-3">
                <Separator className="flex-1" />
                <span className="text-muted-foreground text-xs">or</span>
                <Separator className="flex-1" />
              </div>
              <LoginButton
                callbackURL={search.returnTo}
                className="w-full"
                provider="microsoft"
              />
            </>
          )}
          <p className="mt-2 text-center text-muted-foreground text-xs">
            By signing in, you agree to our Terms of Service and Privacy Policy.
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
