import type { ReactNode } from "react";

import { Link } from "@tanstack/react-router";

export function Forbidden({
  children,
  requiredRole,
  requiredPermission,
}: {
  children?: ReactNode;
  requiredRole?: string;
  requiredPermission?: string;
}) {
  return (
    <div className="space-y-2 p-2">
      <h2 className="font-bold text-xl text-red-600">Access Denied</h2>
      <div className="text-gray-600 dark:text-gray-400">
        {children || (
          <p>
            You do not have permission to access this resource.
            {requiredRole && (
              <span className="block text-sm">
                Required role: <code className="font-mono">{requiredRole}</code>
              </span>
            )}
            {requiredPermission && (
              <span className="block text-sm">
                Required permission:{" "}
                <code className="font-mono">{requiredPermission}</code>
              </span>
            )}
          </p>
        )}
      </div>
      <p className="flex flex-wrap items-center gap-2">
        <button
          className="rounded-sm bg-emerald-500 px-2 py-1 font-black text-sm text-white uppercase"
          onClick={() => window.history.back()}
          type="button"
        >
          Go back
        </button>
        <Link
          className="rounded-sm bg-cyan-600 px-2 py-1 font-black text-sm text-white uppercase"
          to="/"
        >
          Start Over
        </Link>
      </p>
    </div>
  );
}
