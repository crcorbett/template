import { signOut, useSession } from "$/lib/auth-client";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@packages/ui/ui/dropdown-menu";
import { IconLogout, IconSettings, IconUser } from "@tabler/icons-react";
import { useRouter } from "@tanstack/react-router";
import { useState } from "react";

interface UserMenuProps {
  className?: string;
}

function UserAvatar({
  name,
  image,
  size = "default",
}: {
  name: string | null | undefined;
  image: string | null | undefined;
  size?: "default" | "sm";
}) {
  const initials = name
    ? name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .toUpperCase()
        .slice(0, 2)
    : "?";

  const sizeClasses = size === "sm" ? "size-6 text-[10px]" : "size-8 text-xs";

  if (image) {
    return (
      <img
        alt={name ?? "User avatar"}
        className={`${sizeClasses} rounded-full object-cover`}
        src={image}
      />
    );
  }

  return (
    <div
      className={`${sizeClasses} flex items-center justify-center rounded-full bg-muted font-medium text-muted-foreground`}
    >
      {initials}
    </div>
  );
}

export function UserMenu({ className }: UserMenuProps) {
  const { data: session, isPending } = useSession();
  const [isSigningOut, setIsSigningOut] = useState(false);
  const router = useRouter();

  const handleSignOut = async () => {
    setIsSigningOut(true);
    try {
      await signOut();
      window.location.href = "/login";
    } catch {
      setIsSigningOut(false);
    }
  };

  if (isPending) {
    return (
      <div className={className}>
        <div className="size-8 animate-pulse rounded-full bg-muted" />
      </div>
    );
  }

  if (!session?.user) {
    return (
      <div className={className}>
        <a
          className="inline-flex h-6 items-center justify-center gap-1 rounded-md border border-border bg-transparent px-2 text-xs/relaxed font-medium outline-none transition-all hover:bg-input/50 hover:text-foreground focus-visible:border-ring focus-visible:ring-[2px] focus-visible:ring-ring/30"
          href="/login"
        >
          Sign in
        </a>
      </div>
    );
  }

  const { user } = session;

  return (
    <div className={className}>
      <DropdownMenu>
        <DropdownMenuTrigger className="flex items-center gap-2 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2">
          <UserAvatar image={user.image} name={user.name} />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" sideOffset={8}>
          <DropdownMenuLabel className="flex flex-col gap-0.5">
            <span className="font-medium text-foreground">
              {user.name ?? "User"}
            </span>
            <span className="text-muted-foreground">{user.email}</span>
          </DropdownMenuLabel>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => router.navigate({ to: "/" })}>
            <IconUser />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => router.navigate({ to: "/" })}>
            <IconSettings />
            Settings
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            disabled={isSigningOut}
            onClick={handleSignOut}
            variant="destructive"
          >
            <IconLogout />
            {isSigningOut ? "Signing out..." : "Sign out"}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
