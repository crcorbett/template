"use client";

import type { ComponentProps, HTMLAttributes } from "react";

import { CodeBlock, Pre } from "fumadocs-ui/components/codeblock";
import { ExternalLink } from "lucide-react";

import { cn } from "@/lib/cn";

// GitHub configuration
const GITHUB_OWNER = "crcorbett";
const GITHUB_REPO = "template";
const GITHUB_BRANCH = "main";

/**
 * Check if a title looks like a file path that exists in the repo
 */
function isFilePath(title: string): boolean {
  // Common file extensions and path patterns
  const filePathPattern =
    /^[\w@.-]+\/.*\.\w+$|^[\w@.-]+\/[\w@.-]+$|^\.[\w.-]+$|^\w+\.\w+$/;
  const hasExtension = /\.\w{1,10}$/.test(title);

  return filePathPattern.test(title) || (hasExtension && !title.includes(" "));
}

/**
 * Generate a GitHub permalink for a file path
 */
function getGitHubUrl(filePath: string): string {
  // Remove leading ./ if present
  const cleanPath = filePath.replace(/^\.\//, "");
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${cleanPath}`;
}

type PreProps = HTMLAttributes<HTMLPreElement> & {
  title?: string;
  icon?: ComponentProps<typeof CodeBlock>["icon"];
  allowCopy?: boolean;
  keepBackground?: boolean;
};

/**
 * Custom pre component that wraps fumadocs CodeBlock with GitHub permalink support
 */
export function CustomPre({
  title,
  icon,
  allowCopy = true,
  keepBackground = false,
  ...props
}: PreProps) {
  const isLink = title ? isFilePath(title) : false;

  // If there's a title that looks like a file path, render with custom title
  if (title && isLink) {
    return (
      <CodeBlock
        title={title}
        icon={icon}
        allowCopy={allowCopy}
        keepBackground={keepBackground}
        Actions={({ children, className }) => (
          <div
            className={cn("flex items-center gap-2 empty:hidden", className)}
          >
            <a
              href={getGitHubUrl(title)}
              target="_blank"
              rel="noopener noreferrer"
              className="text-fd-muted-foreground hover:text-fd-foreground transition-colors"
              title="Open in GitHub"
            >
              <ExternalLink className="size-3.5" />
            </a>
            {children}
          </div>
        )}
      >
        <Pre {...props} />
      </CodeBlock>
    );
  }

  // Standard rendering
  return (
    <CodeBlock
      title={title}
      icon={icon}
      allowCopy={allowCopy}
      keepBackground={keepBackground}
    >
      <Pre {...props} />
    </CodeBlock>
  );
}
