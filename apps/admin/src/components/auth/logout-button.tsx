import { signOut } from "$/lib/auth-client";
import { IconLogout } from "@tabler/icons-react";
import { useState } from "react";

interface LogoutButtonProps {
  className?: string;
  showIcon?: boolean;
  redirectTo?: string;
}

export function LogoutButton({
  className = "",
  showIcon = true,
  redirectTo = "/login",
}: LogoutButtonProps) {
  const [isLoading, setIsLoading] = useState(false);

  const handleLogout = async () => {
    setIsLoading(true);
    try {
      await signOut();
      window.location.href = redirectTo;
    } catch {
      setIsLoading(false);
    }
  };

  return (
    <button
      className={`inline-flex h-7 shrink-0 select-none items-center justify-center gap-1 whitespace-nowrap rounded-md border border-transparent bg-transparent px-2 text-xs/relaxed font-medium outline-none transition-all hover:bg-muted hover:text-foreground focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30 disabled:pointer-events-none disabled:opacity-50 [&_svg:not([class*='size-'])]:size-3.5 [&_svg]:pointer-events-none [&_svg]:shrink-0 ${className}`}
      disabled={isLoading}
      onClick={handleLogout}
      type="button"
    >
      {showIcon && <IconLogout data-icon="inline-start" />}
      {isLoading ? "Signing out..." : "Sign out"}
    </button>
  );
}
