import { signIn } from "$/lib/auth-client";
import { IconBrandGoogle, IconBrandWindows } from "@tabler/icons-react";
import { useState } from "react";

type OAuthProvider = "google" | "microsoft";

interface LoginButtonProps {
  provider: OAuthProvider;
  callbackURL?: string;
  className?: string;
}

const providerConfig: Record<
  OAuthProvider,
  { label: string; icon: typeof IconBrandGoogle }
> = {
  google: {
    label: "Google",
    icon: IconBrandGoogle,
  },
  microsoft: {
    label: "Microsoft",
    icon: IconBrandWindows,
  },
};

export function LoginButton({
  provider,
  callbackURL = "/",
  className = "",
}: LoginButtonProps) {
  const [isLoading, setIsLoading] = useState(false);
  const config = providerConfig[provider];
  const Icon = config.icon;

  const handleLogin = async () => {
    setIsLoading(true);
    try {
      await signIn.social({
        provider,
        callbackURL,
      });
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`inline-flex h-8 shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-md border border-border bg-transparent px-2.5 text-xs/relaxed font-medium outline-none transition-all hover:bg-input/50 hover:text-foreground focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-4 [&_svg]:pointer-events-none [&_svg]:shrink-0 ${className}`}
      disabled={isLoading}
      onClick={handleLogin}
      type="button"
    >
      <Icon data-icon="inline-start" />
      {isLoading ? "Signing in..." : `Sign in with ${config.label}`}
    </button>
  );
}
