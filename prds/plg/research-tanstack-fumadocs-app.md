# Research: TanStack Start + Fumadocs Patterns in apps/docs

**Date:** 2026-01-31
**Purpose:** Document the exact architecture of `apps/docs` as the reference implementation for building the PLG builder application. Every pattern here has been verified from source.

---

## 1. Existing apps/docs Architecture

### 1.1 File-by-File Analysis

#### `vite.config.ts` -- Vite Plugin Stack

```ts
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import mdx from "fumadocs-mdx/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import mkcert from "vite-plugin-mkcert";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig(async ({ command }) => ({
  server: {
    port: 3001,
  },
  resolve: {
    conditions: ["@packages/source"],
  },
  plugins: [
    mdx(await import("./source.config")),
    tailwindcss(),
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    mkcert(),
    tanstackStart({
      srcDirectory: "src",
    }),
    viteReact(),
    command === "build"
      ? nitro({
          preset: "vercel",
          vercel: {
            functions: {
              runtime: "bun1.x",
            },
          },
        })
      : null,
  ],
}));
```

**Key observations:**

- **Plugin order matters.** `fumadocs-mdx/vite` is first because it must process MDX files before other plugins see them. It generates `.source/server.ts` and `.source/browser.ts` which are virtual module entry points.
- **`resolve.conditions: ["@packages/source"]`** enables monorepo live types -- packages export a `@packages/source` condition pointing to raw TypeScript source files rather than compiled `dist/`.
- **The config function is `async`** because `source.config` must be dynamically imported as a module (`await import("./source.config")`).
- **Nitro is conditionally loaded** -- only during `build` command due to an HTTP/2 + Transfer-Encoding bug with Bun in dev mode (TanStack Router issue #6050). In dev, TanStack Start handles server functions internally via Vite's dev server.
- **`mkcert()`** provides automatic HTTPS certificates for local development.
- **Port 3001** -- the docs app runs on 3001 while the web app runs on 3000.

#### `source.config.ts` -- Fumadocs Collection Definition

```ts
import { defineDocs } from "fumadocs-mdx/config";

export const { docs, meta } = defineDocs({
  dir: "content/docs",
  docs: {
    postprocess: {
      includeProcessedMarkdown: true,
    },
  },
});
```

**Key observations:**

- `defineDocs` returns two collection definitions: `docs` (MDX content pages) and `meta` (JSON navigation metadata).
- `dir: "content/docs"` sets the content root relative to the project root.
- `includeProcessedMarkdown: true` enables the `page.data.getText("processed")` API used for LLM text extraction -- it stores a plain-text representation of each page alongside the rendered MDX.

#### `package.json` -- Dependencies

```json
{
  "name": "docs",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "bun --bun vite dev --host",
    "build": "bun --bun vite build",
    "check-types": "tsc --noEmit",
    "test": "vitest run",
    "preview": "bun --bun vite preview"
  },
  "dependencies": {
    "@tanstack/react-router": "catalog:tanstack",
    "@tanstack/react-start": "catalog:tanstack",
    "class-variance-authority": "^0.7.1",
    "fumadocs-core": "latest",
    "fumadocs-mdx": "latest",
    "fumadocs-ui": "latest",
    "lucide-react": "^0.468.0",
    "mermaid": "^11.12.2",
    "next-themes": "^0.4.6",
    "react": "catalog:react",
    "react-dom": "catalog:react",
    "tailwind-merge": "^2.6.0"
  },
  "devDependencies": {
    "@tailwindcss/vite": "catalog:build",
    "@types/mdx": "^2.0.13",
    "@types/react": "catalog:react",
    "@types/react-dom": "catalog:react",
    "@vitejs/plugin-react": "catalog:build",
    "nitro": "catalog:utils",
    "tailwindcss": "catalog:build",
    "typescript": "catalog:typescript",
    "vite": "catalog:build",
    "vite-plugin-mkcert": "catalog:build",
    "vite-tsconfig-paths": "catalog:build",
    "zod": "catalog:utils"
  }
}
```

**Key observations:**

- Uses `catalog:*` resolution for shared dependency versions (defined in root `package.json` catalogs).
- The three fumadocs packages (`fumadocs-core`, `fumadocs-mdx`, `fumadocs-ui`) are pinned to `latest` rather than catalog versions -- they are independent of the monorepo version management.
- `next-themes` is required by `fumadocs-ui` for dark mode support.
- `mermaid` is a runtime dependency for the diagram rendering component.
- `bun --bun` forces Bun's native runtime rather than falling back to Node.js.
- No `@packages/*` workspace dependencies -- the docs app is standalone. The PLG app will need `workspace:*` dependencies on `@packages/plg-builder-core`.

#### `tsconfig.json` -- TypeScript Configuration

```json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,
    "composite": false,
    "declaration": false,
    "declarationMap": false,
    "skipLibCheck": true,
    "paths": {
      "$/*": ["./src/*"],
      "@/*": ["./src/*"],
      "fumadocs-mdx:collections/*": ["./.source/*"]
    }
  },
  "include": ["**/*.ts", "**/*.tsx", ".source/**/*.ts"]
}
```

**Key observations:**

- Two path aliases: `$/*` and `@/*` both map to `./src/*`. The `$` alias is used in CSS imports (`$/styles/app.css`), while `@` is used in component imports (`@/components/...`, `@/lib/...`).
- **`fumadocs-mdx:collections/*`** maps to `.source/*` -- this is the critical path alias that resolves the virtual module imports `fumadocs-mdx:collections/server` and `fumadocs-mdx:collections/browser` to the generated files in `.source/`.
- `.source/**/*.ts` is explicitly included so TypeScript recognizes the generated files.
- `noEmit: true`, `composite: false` -- the docs app is not a library; it does not produce type declarations.

#### `src/styles/app.css` -- Styles Entry Point

```css
@import "tailwindcss";
@import "fumadocs-ui/css/neutral.css";
@import "fumadocs-ui/css/preset.css";
```

Fumadocs provides its own CSS theme (`neutral.css` for the color scheme, `preset.css` for component styles) layered on top of Tailwind CSS v4.

---

### 1.2 Route Files

#### `src/routes/__root.tsx` -- Root Layout

```tsx
import type * as React from "react";
import {
  createRootRoute,
  HeadContent,
  Outlet,
  Scripts,
} from "@tanstack/react-router";
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import "$/styles/app.css";

export const Route = createRootRoute({
  component: RootComponent,
});

function RootComponent() {
  return (
    <RootDocument>
      <Outlet />
    </RootDocument>
  );
}

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider>{children}</RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
```

**Key observations:**

- **`RootProvider` from `fumadocs-ui/provider/tanstack`** is the bridge between Fumadocs UI and TanStack Router. It wraps the entire app and provides Fumadocs' theming, search, and navigation context. This is distinct from the Next.js provider -- fumadocs ships a dedicated TanStack Router adapter.
- `suppressHydrationWarning` on `<html>` is required for `next-themes` dark mode (it modifies the HTML element during hydration).
- The root imports `$/styles/app.css` (the Tailwind + Fumadocs CSS).
- `<HeadContent />` and `<Scripts />` are TanStack Start's SSR primitives for injecting head tags and hydration scripts.
- **No `head()` function** is defined on the root route -- this means no default meta tags. The PLG app should add proper meta tags.

#### `src/routes/index.tsx` -- Home Page (Redirect)

```tsx
import { createFileRoute, redirect } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  beforeLoad: () => {
    throw redirect({ to: "/docs/$", params: { _splat: "" } });
  },
});
```

The root `/` route immediately redirects to `/docs/$` with an empty splat param (which resolves to the docs index page). In the PLG app, this route will instead render the builder UI.

#### `src/routes/docs/$.tsx` -- Docs Catch-All (Core Pattern)

This is the most important file -- it demonstrates the complete serverFn + clientLoader pattern:

```tsx
import type * as PageTree from "fumadocs-core/page-tree";
import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import browserCollections from "fumadocs-mdx:collections/browser";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody, DocsDescription, DocsPage, DocsTitle,
} from "fumadocs-ui/layouts/docs/page";
import defaultMdxComponents from "fumadocs-ui/mdx";
import { createContext, useContext, useMemo } from "react";

import { LLMCopyButton, ViewOptions } from "@/components/ai/page-actions";
import { CustomPre } from "@/components/mdx/code-block";
import { Mermaid } from "@/components/mdx/mermaid";
import { baseOptions } from "@/lib/layout.shared";
import { source } from "@/lib/source";

// GitHub configuration for source links
const GITHUB_OWNER = "crcorbett";
const GITHUB_REPO = "template";
const GITHUB_BRANCH = "main";

// Context for page info (allows clientLoader component to access page URL/path)
interface PageInfo {
  url: string;
  path: string;
}
const PageInfoContext = createContext<PageInfo | null>(null);
```

**Server function (runs on server only):**

```tsx
const loader = createServerFn({
  method: "GET",
})
  .inputValidator((slugs: string[]) => slugs)
  .handler(async ({ data: slugs }) => {
    const page = source.getPage(slugs);
    if (!page) throw notFound();

    return {
      tree: source.pageTree as object,
      path: page.path,
      url: page.url,
    };
  });
```

**Client loader (creates lazy MDX component loader):**

```tsx
const clientLoader = browserCollections.docs.createClientLoader({
  component({ toc, frontmatter, default: MDX }) {
    return (
      <DocsPage toc={toc}>
        <DocsTitle>{frontmatter.title}</DocsTitle>
        <DocsDescription>{frontmatter.description}</DocsDescription>
        <PageActions />
        <DocsBody>
          <MDX
            components={{
              ...defaultMdxComponents,
              pre: CustomPre,
              Mermaid,
            }}
          />
        </DocsBody>
      </DocsPage>
    );
  },
});
```

**Route definition (binds server + client loaders):**

```tsx
export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await loader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});
```

**Page component (renders layout + content):**

```tsx
function Page() {
  const data = Route.useLoaderData();
  const Content = clientLoader.getComponent(data.path);
  const tree = useMemo(
    () => transformPageTree(data.tree as PageTree.Root),
    [data.tree]
  );

  return (
    <DocsLayout {...baseOptions()} tree={tree}>
      <PageInfoContext.Provider value={{ url: data.url, path: data.path }}>
        <Content />
      </PageInfoContext.Provider>
    </DocsLayout>
  );
}
```

**Page tree transformation (icon hydration):**

```tsx
function transformPageTree(root: PageTree.Root): PageTree.Root {
  function mapNode<T extends PageTree.Node>(item: T): T {
    if (typeof item.icon === "string") {
      return {
        ...item,
        icon: (
          <span
            dangerouslySetInnerHTML={{
              __html: item.icon,
            }}
          />
        ),
      };
    }

    if (item.type === "folder") {
      return {
        ...item,
        index: item.index ? mapNode(item.index) : undefined,
        children: item.children.map(mapNode),
      };
    }

    return item;
  }

  const result: PageTree.Root = {
    ...root,
    children: root.children.map(mapNode),
  };

  if (root.fallback) {
    result.fallback = transformPageTree(root.fallback);
  }

  return result;
}
```

**Pattern summary:** The page tree is serialized from the server as plain JSON. Icon SVGs arrive as strings (not React elements), so `transformPageTree` converts them to `<span dangerouslySetInnerHTML>` on the client. This is necessary because React elements are not serializable across the server/client boundary.

#### `src/routes/api/search.ts` -- Search API

```ts
import { createFileRoute } from "@tanstack/react-router";
import { createFromSource } from "fumadocs-core/search/server";
import { source } from "@/lib/source";

const searchServer = createFromSource(source, {
  language: "english",
});

export const Route = createFileRoute("/api/search")({
  server: {
    handlers: {
      GET: async ({ request }) => searchServer.GET(request),
    },
  },
});
```

This uses TanStack Start's `server.handlers` to expose a REST endpoint. Fumadocs' built-in search server (`createFromSource`) indexes all pages and provides full-text search. The search UI in `DocsLayout` automatically hits this endpoint.

#### `src/routes/llms-full[.]txt.ts` -- Full LLM Text Dump

```ts
import { createFileRoute } from "@tanstack/react-router";
import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

export const Route = createFileRoute("/llms-full.txt")({
  server: {
    handlers: {
      GET: async () => {
        const scan = source.getPages().map(getLLMText);
        const scanned = await Promise.all(scan);
        return new Response(scanned.join("\n\n"), {
          headers: {
            "Content-Type": "text/plain; charset=utf-8",
          },
        });
      },
    },
  },
});
```

Note the TanStack Router file naming convention: `llms-full[.]txt.ts` -- square brackets escape the dot so the file-based router treats it as a literal `.` in the URL path (`/llms-full.txt`), not as a route parameter separator.

#### `src/routes/llms[.]mdx.docs.$.ts` -- Per-Page LLM Markdown

```ts
import { createFileRoute, notFound } from "@tanstack/react-router";
import { getLLMText } from "@/lib/get-llm-text";
import { source } from "@/lib/source";

export const Route = createFileRoute("/llms.mdx/docs/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slugs = params._splat?.split("/") ?? [];
        const page = source.getPage(slugs);
        if (!page) throw notFound();

        return new Response(await getLLMText(page), {
          headers: {
            "Content-Type": "text/markdown; charset=utf-8",
          },
        });
      },
    },
  },
});
```

Combined with the middleware in `start.ts`, this enables `/docs/getting-started/installation.mdx` to serve the processed markdown for that page (the middleware rewrites `.mdx` suffix requests to `/llms.mdx/docs/...`).

---

### 1.3 Library Files

#### `src/lib/source.ts` -- Fumadocs Source Loader

```ts
import type { InferMetaType, InferPageType } from "fumadocs-core/source";
import { loader } from "fumadocs-core/source";
import { toFumadocsSource } from "fumadocs-mdx/runtime/server";
import { docs, meta } from "fumadocs-mdx:collections/server";

export const source = loader({
  baseUrl: "/docs",
  source: toFumadocsSource(docs, meta),
});

export type Page = InferPageType<typeof source>;
export type Meta = InferMetaType<typeof source>;
```

**Pipeline:** `source.config.ts` defines collections -> `fumadocs-mdx/vite` plugin generates `.source/server.ts` and `.source/browser.ts` -> `toFumadocsSource(docs, meta)` converts them to Fumadocs format -> `loader()` creates the queryable source object with `getPage()`, `getPages()`, `pageTree`, etc.

#### `src/lib/layout.shared.tsx` -- Shared Layout Options

```ts
import type { BaseLayoutProps } from "fumadocs-ui/layouts/shared";

export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "Monorepo Template",
    },
    githubUrl: "https://github.com/your-org/template",
    links: [
      {
        text: "Documentation",
        url: "/docs",
        active: "nested-url",
      },
    ],
  };
}
```

This is a function (not a constant) so it can be called in the render path. It provides the navigation bar title, GitHub link, and navigation links.

#### `src/lib/get-llm-text.ts` -- LLM Text Extraction

```ts
import type { InferPageType } from "fumadocs-core/source";
import type { source } from "./source";

export async function getLLMText(
  page: InferPageType<typeof source>
): Promise<string> {
  const processed = await page.data.getText("processed");

  return `# ${page.data.title} (${page.url})

${processed}`;
}
```

Uses the `includeProcessedMarkdown` feature from `source.config.ts`. Each page's processed text is a cleaned-up markdown representation suitable for LLM consumption.

#### `src/lib/cn.ts` -- Utility

```ts
export { twMerge as cn } from "tailwind-merge";
```

Simple re-export of tailwind-merge as `cn` for className merging.

#### `src/start.ts` -- TanStack Start Entry with LLM Middleware

```ts
import { redirect } from "@tanstack/react-router";
import { createMiddleware, createStart } from "@tanstack/react-start";
import { rewritePath } from "fumadocs-core/negotiation";

const { rewrite: rewriteLLM } = rewritePath(
  "/docs{/*path}.mdx",
  "/llms.mdx/docs{/*path}"
);

const llmMiddleware = createMiddleware().server(({ next, request }) => {
  const url = new URL(request.url);
  const path = rewriteLLM(url.pathname);

  if (path) {
    throw redirect({ href: new URL(path, url).toString() });
  }

  return next();
});

export const startInstance = createStart(() => {
  return {
    requestMiddleware: [llmMiddleware],
  };
});
```

**Key pattern:** TanStack Start's `createMiddleware` + `createStart` allows request-level middleware. The LLM middleware uses Fumadocs' `rewritePath` to intercept requests like `/docs/foo/bar.mdx` and redirect them to `/llms.mdx/docs/foo/bar`, where the actual handler lives.

#### `src/router.tsx` -- Router Configuration

```ts
import { createRouter } from "@tanstack/react-router";
import { routeTree } from "./routeTree.gen";

export function getRouter() {
  const router = createRouter({
    routeTree,
    defaultPreload: "intent",
    scrollRestoration: true,
  });
  return router;
}

declare module "@tanstack/react-router" {
  interface Register {
    router: ReturnType<typeof getRouter>;
  }
}
```

Standard TanStack Router setup. `defaultPreload: "intent"` prefetches route data on hover/focus. The `Register` module augmentation provides type-safe route references across the app.

#### `src/routeTree.gen.ts` -- Generated Route Tree

This file is auto-generated by TanStack Router's file-based routing. It registers all routes:

| Route ID | Path | File |
|---|---|---|
| `/` | `/` | `routes/index.tsx` |
| `/docs/$` | `/docs/$` | `routes/docs/$.tsx` |
| `/api/search` | `/api/search` | `routes/api/search.ts` |
| `/llms-full.txt` | `/llms-full.txt` | `routes/llms-full[.]txt.ts` |
| `/llms.mdx/docs/$` | `/llms.mdx/docs/$` | `routes/llms[.]mdx.docs.$.ts` |

The file also registers the Start instance and SSR mode:

```ts
declare module '@tanstack/react-start' {
  interface Register {
    ssr: true
    router: Awaited<ReturnType<typeof getRouter>>
    config: Awaited<ReturnType<typeof startInstance.getOptions>>
  }
}
```

---

### 1.4 Generated Files (`.source/`)

#### `.source/server.ts` -- Server-Side Collections

```ts
import { server } from 'fumadocs-mdx/runtime/server';
import type * as Config from '../source.config';

const create = server<typeof Config, ...>({
  "doc": { "passthroughs": ["extractedReferences"] }
});

export const docs = await create.doc("docs", "content/docs", import.meta.glob(["./**/*.{mdx,md}"], {
  "base": "./../content/docs",
  "query": { "collection": "docs" },
  "eager": true
}));

export const meta = await create.meta("meta", "content/docs", import.meta.glob(["./**/*.{json,yaml}"], {
  "base": "./../content/docs",
  "query": { "collection": "meta" },
  "import": "default",
  "eager": true
}));
```

Uses Vite's `import.meta.glob` to eagerly load all MDX and JSON files at build time on the server. The `eager: true` flag means all content is statically resolved.

#### `.source/browser.ts` -- Client-Side Collections

```ts
import { browser } from 'fumadocs-mdx/runtime/browser';
import type * as Config from '../source.config';

const create = browser<typeof Config, ...>();
const browserCollections = {
  docs: create.doc("docs", import.meta.glob(["./**/*.{mdx,md}"], {
    "base": "./../content/docs",
    "query": { "collection": "docs" },
    "eager": false
  })),
};
export default browserCollections;
```

Client-side uses `eager: false` -- MDX pages are lazily loaded on demand. The `createClientLoader` method on `browserCollections.docs` creates a component loader that preloads content during route transitions and provides `getComponent(path)` for rendering.

---

### 1.5 MDX Component Customization

#### `src/components/mdx/code-block.tsx` -- Custom Pre/Code Block

The `CustomPre` component wraps Fumadocs' `CodeBlock` + `Pre` components with GitHub permalink support:

- Detects if a code block's `title` prop looks like a file path (e.g., `packages/core/src/index.ts`)
- If so, adds an external link icon that opens the file on GitHub
- Uses `GITHUB_OWNER`, `GITHUB_REPO`, `GITHUB_BRANCH` constants for URL construction
- Falls back to standard Fumadocs rendering for non-file-path titles

#### `src/components/mdx/mermaid.tsx` -- Mermaid Diagram Renderer

A client-only Mermaid diagram renderer that:

- Uses `useState` + `useEffect` for mount detection (Mermaid requires DOM access)
- Lazily imports `mermaid` library via `import()` with a custom `cachePromise` helper
- Respects dark/light theme via `next-themes`' `useTheme()`
- Renders SVG via `dangerouslySetInnerHTML`
- Caches rendered SVGs by `chart + theme` key

#### `src/components/ai/page-actions.tsx` -- LLM Integration Actions

Provides two components:

1. **`LLMCopyButton`** -- Fetches raw markdown from `{pageUrl}.mdx` and copies to clipboard. Uses `ClipboardItem` API for async clipboard writes with a fetch-in-flight promise. Caches fetched content.

2. **`ViewOptions`** -- Popover with "Open in..." links:
   - Open in GitHub (source file link)
   - Open in ChatGPT (with search hint + markdown URL)
   - Open in Claude (with markdown URL prompt)
   - Open in Cursor (via `cursor://` deep link protocol)

---

### 1.6 Content Structure

#### Root `content/docs/meta.json`

```json
{
  "title": "Documentation",
  "pages": [
    "index",
    "---Getting Started---",
    "...getting-started",
    "---Architecture---",
    "...architecture",
    "---TypeScript---",
    "...typescript",
    "---Tooling---",
    "...tooling",
    "---AI Integrations---",
    "...ai-integrations",
    "---CI/CD---",
    "...ci-cd",
    "---UI Components---",
    "...ui-components",
    "---Guides---",
    "...guides",
    "---Reference---",
    "...reference"
  ]
}
```

**Conventions:**
- `"index"` -- references `index.mdx` in the current directory
- `"---Title---"` -- separator/heading in the sidebar navigation
- `"...folder-name"` -- spread operator that pulls in the folder's own `meta.json` pages

#### Sub-category `content/docs/getting-started/meta.json`

```json
{
  "title": "Getting Started",
  "description": "Get up and running with the monorepo template",
  "pages": ["index", "installation", "project-structure", "first-steps"]
}
```

Each sub-category has its own `meta.json` with explicit page ordering.

#### MDX Frontmatter Format

```yaml
---
title: Installation
description: Complete setup instructions for your development environment
---
```

Minimal frontmatter: `title` (required) and `description` (optional). Fumadocs uses these for `<DocsTitle>` and `<DocsDescription>` rendering, as well as page tree navigation labels.

#### MDX Component Usage

MDX files can import and use Fumadocs UI components directly:

```mdx
import { Cards, Card } from "fumadocs-ui/components/card";

<Cards>
  <Card title="Bun Runtime" href="/docs/tooling/bun">
    Fast JavaScript runtime
  </Card>
</Cards>
```

Custom components registered in `$.tsx` (like `Mermaid`) are available without import:

```mdx
<Mermaid chart="graph TD; A-->B;" />
```

---

## 2. Key Integration Patterns

### 2.1 Fumadocs + TanStack Router Bridge

The integration is established by three things:

1. **`RootProvider` from `fumadocs-ui/provider/tanstack`** -- wraps the entire app in `__root.tsx`. This provider adapts Fumadocs' internal routing hooks to use TanStack Router instead of Next.js router.

2. **`DocsLayout` component** -- accepts `tree` (page tree) and `baseOptions()` (nav config). It renders the sidebar navigation, search bar, breadcrumbs, and theme toggle.

3. **`DocsPage` / `DocsBody` / `DocsTitle` / `DocsDescription`** -- the content area components rendered inside `DocsLayout`.

### 2.2 Server Function + Client Loader Pattern

This is the core rendering pattern that splits concerns:

```
Route Loader (runs on server + client)
  |
  v
createServerFn (runs on server only)
  - Resolves page from source
  - Returns serializable data (tree, path, url)
  |
  v
clientLoader.preload (runs on client)
  - Lazily imports the MDX module for the resolved page
  |
  v
Page Component (runs on client)
  - Gets serializable data from useLoaderData()
  - Gets MDX component from clientLoader.getComponent(path)
  - Renders DocsLayout > Content
```

**Why this split?** The `source` object (which processes MDX collections) is server-only code. The MDX component itself must be client-rendered (it contains React components). The serverFn resolves which page to show, and the clientLoader handles the actual MDX module loading.

### 2.3 Page Tree Serialization

The page tree is generated by Fumadocs from the `meta.json` hierarchy. It contains `PageTree.Root` with nested `PageTree.Folder` and `PageTree.Page` nodes. When sent from server to client via `loader()`, icons (which may be SVG strings) cannot be React elements. The `transformPageTree` function on the client converts string icons to `<span dangerouslySetInnerHTML>` elements.

### 2.4 PageInfoContext Pattern

The `PageInfoContext` provides page metadata (URL, path) to deeply nested components without prop drilling. It is used by `PageActions` to construct GitHub source links and LLM markdown URLs.

### 2.5 Catch-All Splat Route

The `createFileRoute("/docs/$")` pattern uses TanStack Router's splat parameter (`$`). The `_splat` param contains everything after `/docs/`, split by `/` to create the slug array for `source.getPage()`. This single route handles all documentation pages regardless of nesting depth.

---

## 3. Vite Plugin Stack

### 3.1 Exact Plugin Order

| Order | Plugin | Purpose |
|-------|--------|---------|
| 1 | `fumadocs-mdx/vite` | Processes MDX files, generates `.source/` files, registers virtual modules |
| 2 | `@tailwindcss/vite` | Tailwind CSS v4 JIT compilation |
| 3 | `vite-tsconfig-paths` | Resolves TypeScript path aliases (`@/*`, `$/*`, `fumadocs-mdx:collections/*`) |
| 4 | `vite-plugin-mkcert` | Auto-generates HTTPS certificates for localhost |
| 5 | `@tanstack/react-start/plugin/vite` | File-based routing, server functions, SSR |
| 6 | `@vitejs/plugin-react` | React JSX transform, fast refresh |
| 7 | `nitro/vite` (build only) | Production server deployment (Vercel preset) |

### 3.2 The `@packages/source` Condition

In `resolve.conditions`, `"@packages/source"` tells Vite to resolve package exports using the `@packages/source` condition. This allows monorepo packages to export their raw TypeScript source:

```json
// packages/core/package.json (example)
{
  "exports": {
    ".": {
      "@packages/source": "./src/index.ts",
      "types": "./dist/index.d.ts",
      "default": "./dist/index.js"
    }
  }
}
```

In combination with `customConditions: ["@packages/source"]` in `tsconfig.base.json`, both Vite and TypeScript resolve to the source `.ts` files, enabling:
- Hot module replacement across package boundaries
- No build step needed for local development
- Instant type feedback without `tsc -b` watching

### 3.3 Nitro Configuration

Nitro is only used for production builds (`command === "build"`):

```ts
nitro({
  preset: "vercel",
  vercel: {
    functions: {
      runtime: "bun1.x",
    },
  },
})
```

This generates Vercel-compatible output in `.vercel/output/` with Bun as the serverless runtime. Disabled in dev due to HTTP/2 compatibility issues.

---

## 4. Monorepo Integration Patterns

### 4.1 Workspace Dependencies

```json
// apps/web/package.json
{
  "dependencies": {
    "@packages/core": "workspace:*",
    "@packages/ui": "workspace:*"
  }
}
```

`workspace:*` links to the local package in the monorepo. Bun resolves these to the actual package directories. The docs app currently has no `workspace:*` dependencies, but the PLG app will need:

```json
{
  "dependencies": {
    "@packages/plg-builder-core": "workspace:*"
  }
}
```

### 4.2 Catalog Version Resolution

The root `package.json` defines version catalogs:

```json
{
  "workspaces": {
    "catalogs": {
      "react": {
        "react": "^19.2.3",
        "react-dom": "^19.2.3",
        "@types/react": "^19.2.7",
        "@types/react-dom": "^19.2.3"
      },
      "tanstack": {
        "@tanstack/react-router": "^1.142.7",
        "@tanstack/react-router-devtools": "^1.142.7",
        "@tanstack/react-start": "^1.142.7"
      },
      "build": {
        "vite": "^7.1.7",
        "@vitejs/plugin-react": "^4.6.0",
        "tailwindcss": "^4.1.18",
        "@tailwindcss/vite": "^4.1.18",
        "vite-tsconfig-paths": "^5.1.4",
        "vite-plugin-mkcert": "^1.17.9"
      },
      "utils": {
        "zod": "^4.3.5",
        "nitro": "^3.0.1-alpha.1",
        "tailwind-merge": "^2.6.0"
      }
    }
  }
}
```

Apps reference these via `"catalog:react"`, `"catalog:tanstack"`, `"catalog:build"`, `"catalog:utils"`.

### 4.3 TypeScript Custom Conditions

`tsconfig.base.json`:

```json
{
  "compilerOptions": {
    "customConditions": ["@packages/source"]
  }
}
```

This tells the TypeScript compiler to resolve package exports using the `@packages/source` condition, matching Vite's `resolve.conditions`. This is what enables "live types" -- both bundler and type checker see the same source files.

### 4.4 Turborepo Orchestration

`turbo.json`:

```json
{
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", ".env*"],
      "outputs": [".output/**", ".vercel/output/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "check-types": {
      "dependsOn": ["^check-types"]
    },
    "test": {
      "dependsOn": ["^build"],
      "inputs": ["$TURBO_DEFAULT$", "test/**", "**/*.test.ts", "**/*.test.tsx"]
    }
  }
}
```

- `build` depends on upstream package builds (`^build`) and caches `.output/`, `.vercel/output/`, `dist/`.
- `dev` is persistent (long-running) and never cached.
- The PLG app will be automatically included in `turbo dev` and `turbo build` by virtue of being in `apps/`.

---

## 5. Application to PLG Builder

### 5.1 What Can Be Reused Directly

The following patterns from `apps/docs` can be adopted without modification:

| Pattern | Source | Notes |
|---------|--------|-------|
| Vite plugin stack | `vite.config.ts` | Same 7-plugin setup; add `fumadocs-mdx/vite` for PLG docs |
| Root layout with `RootProvider` | `__root.tsx` | Add `AtomProvider` from effect-atom alongside `RootProvider` |
| Fumadocs source config | `source.config.ts` | Change `dir` to `content/docs` within the PLG app |
| Source loader | `lib/source.ts` | Same pattern, different `baseUrl` |
| Search API | `routes/api/search.ts` | Same pattern |
| Docs catch-all route | `routes/docs/$.tsx` | Same pattern for PLG documentation pages |
| CSS imports | `styles/app.css` | Same three imports |
| tsconfig structure | `tsconfig.json` | Same path aliases |
| Package.json scripts | `package.json` | Same `dev`, `build`, `check-types` scripts |

### 5.2 What Needs to Change

#### Root Route (`/`) -- Builder Page Instead of Redirect

The docs app redirects `/` to `/docs/$`. The PLG app needs `/` to render the interactive builder:

```tsx
// apps/plg/src/routes/index.tsx
import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/")({
  component: BuilderPage,
});

function BuilderPage() {
  // Render the PLG builder UI
  // Uses effect-atom for state management
  // Uses XState for constraint enforcement
}
```

#### Root Layout -- Add AtomProvider

```tsx
// apps/plg/src/routes/__root.tsx
import { RootProvider } from "fumadocs-ui/provider/tanstack";
import { AtomProvider } from "@effect-rx/rx-react"; // or effect-atom equivalent

function RootDocument({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <HeadContent />
      </head>
      <body className="flex min-h-screen flex-col">
        <RootProvider>
          <AtomProvider>
            {children}
          </AtomProvider>
        </RootProvider>
        <Scripts />
      </body>
    </html>
  );
}
```

#### Navigation -- Add Builder Link

```tsx
// apps/plg/src/lib/layout.shared.tsx
export function baseOptions(): BaseLayoutProps {
  return {
    nav: {
      title: "PLG Stack Builder",
    },
    githubUrl: "https://github.com/crcorbett/template",
    links: [
      {
        text: "Builder",
        url: "/",
      },
      {
        text: "Documentation",
        url: "/docs",
        active: "nested-url",
      },
    ],
  };
}
```

### 5.3 New Routes Needed

| Route | File | Purpose |
|-------|------|---------|
| `/` | `routes/index.tsx` | PLG builder UI (interactive stack composer) |
| `/docs/$` | `routes/docs/$.tsx` | PLG documentation (same pattern as apps/docs) |
| `/api/search` | `routes/api/search.ts` | Fumadocs search for PLG docs |
| `/api/generate` | `routes/api/generate.ts` | Server function to run code generation from builder config |
| `/r/$` | `routes/r/$.ts` | Registry item endpoint (serves shadcn registry JSON) |

#### Registry Endpoint Pattern

```tsx
// apps/plg/src/routes/r/$.ts
import { createFileRoute, notFound } from "@tanstack/react-router";

export const Route = createFileRoute("/r/$")({
  server: {
    handlers: {
      GET: async ({ params }) => {
        const slug = params._splat ?? "";
        // Resolve registry item from static files or dynamic generation
        // Return shadcn-compatible registry JSON
        return new Response(JSON.stringify(registryItem), {
          headers: {
            "Content-Type": "application/json",
          },
        });
      },
    },
  },
});
```

#### Code Generation Server Function

```tsx
// apps/plg/src/routes/api/generate.ts
import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

const generate = createServerFn({ method: "POST" })
  .inputValidator(PlgConfigSchema)
  .handler(async ({ data: config }) => {
    // Run Effect-based code generation
    // Return generated files + shadcn CLI command
  });
```

### 5.4 Non-Docs Pages Alongside Fumadocs

The key insight is that `DocsLayout` is only rendered inside the `/docs/$` route. Other routes (like `/` for the builder) render completely independently. The `RootProvider` from fumadocs-ui wraps everything, but it only provides theming and search context -- it does not force a docs layout.

```
__root.tsx (RootProvider + AtomProvider)
  |
  +-- /              -> BuilderPage (custom layout, no DocsLayout)
  +-- /docs/$        -> DocsLayout > DocsPage (full Fumadocs UI)
  +-- /api/search    -> Server handler (no UI)
  +-- /api/generate  -> Server handler (no UI)
  +-- /r/$           -> Server handler (no UI)
```

The builder page uses its own layout and components. Fumadocs UI components like `<Card>` and search can still be used outside `DocsLayout` if desired, since they are standalone React components.

### 5.5 Static vs Dynamic Registry Hosting

Two approaches for the `/r/` registry endpoint:

1. **Static files in `public/r/`** -- Pre-generated JSON files for all registry items. Served as static assets by Vite/Nitro. Best for known, fixed registry items. No server function needed.

2. **Dynamic server handler** -- A route with `server.handlers.GET` that generates registry items on the fly based on user config. Required for customized/composed registry items where the output depends on builder selections.

The recommended approach is hybrid: static files for base provider registry items, dynamic generation for composed stacks.

---

## 6. Content Structure for PLG Docs

### 6.1 Directory Layout

```
apps/plg/content/docs/
  meta.json                     # Root navigation
  index.mdx                     # PLG Stack overview
  getting-started/
    meta.json
    index.mdx                   # Quick start
    installation.mdx            # CLI + registry setup
    your-first-stack.mdx        # Guided builder walkthrough
  concepts/
    meta.json
    index.mdx                   # Core concepts overview
    abstract-services.mdx       # Effect services pattern
    layers-composition.mdx      # Layer merging
    branded-types.mdx           # Type safety primitives
    constraint-graph.mdx        # Provider compatibility
  providers/
    meta.json
    index.mdx                   # Provider catalog
    posthog.mdx                 # PostHog integration
    attio.mdx                   # Attio CRM integration
    launchdarkly.mdx            # LaunchDarkly integration
    amplitude.mdx               # Amplitude integration
    segment.mdx                 # Segment integration
  api-reference/
    meta.json
    index.mdx                   # API overview
    analytics.mdx               # PLG.Analytics service
    feature-flags.mdx           # PLG.FeatureFlags service
    experiments.mdx             # PLG.Experiments service
    customers.mdx               # PLG.Customers service
    surveys.mdx                 # PLG.Surveys service
```

### 6.2 Root `meta.json`

```json
{
  "title": "PLG Stack",
  "pages": [
    "index",
    "---Getting Started---",
    "...getting-started",
    "---Concepts---",
    "...concepts",
    "---Providers---",
    "...providers",
    "---API Reference---",
    "...api-reference"
  ]
}
```

### 6.3 Sub-Category `meta.json` (Example: Getting Started)

```json
{
  "title": "Getting Started",
  "description": "Set up your PLG stack in minutes",
  "pages": ["index", "installation", "your-first-stack"]
}
```

### 6.4 MDX Frontmatter Convention

Following the same minimal convention as `apps/docs`:

```yaml
---
title: PostHog Provider
description: Analytics, feature flags, and experiments powered by PostHog
---
```

### 6.5 Fumadocs UI Components in Content

PLG docs should use the same Fumadocs UI components:

```mdx
import { Cards, Card } from "fumadocs-ui/components/card";
import { Tabs, Tab } from "fumadocs-ui/components/tabs";
import { Callout } from "fumadocs-ui/components/callout";

<Callout type="info">
  All PLG services are abstract Effect Context.Tags.
</Callout>

<Cards>
  <Card title="PostHog" href="/docs/providers/posthog">
    Analytics + Feature Flags + Experiments
  </Card>
</Cards>
```

---

## 7. Summary: apps/plg Bootstrap Checklist

Based on the patterns documented above, the PLG app (`apps/plg`) needs:

1. **Copy structural files from `apps/docs`:**
   - `vite.config.ts` (change port to 3002)
   - `source.config.ts` (same config)
   - `tsconfig.json` (same config)
   - `src/styles/app.css` (same imports)
   - `src/lib/source.ts` (change baseUrl if needed)
   - `src/lib/cn.ts` (same)
   - `src/lib/layout.shared.tsx` (update nav title + links)
   - `src/router.tsx` (same)
   - `src/start.ts` (keep LLM middleware or simplify)

2. **Create new route files:**
   - `src/routes/__root.tsx` -- add `AtomProvider`
   - `src/routes/index.tsx` -- builder page
   - `src/routes/docs/$.tsx` -- docs catch-all (mostly same as apps/docs)
   - `src/routes/api/search.ts` -- same pattern
   - `src/routes/api/generate.ts` -- code generation endpoint
   - `src/routes/r/$.ts` -- registry endpoint

3. **Create content directory:**
   - `content/docs/` with `meta.json` hierarchy
   - Initial MDX pages for getting-started, concepts, providers

4. **Add dependencies:**
   - All deps from `apps/docs/package.json`
   - `@packages/plg-builder-core: "workspace:*"`
   - `effect`, `@effect/schema` (for builder logic)
   - `@effect-rx/rx-react` or equivalent (for AtomProvider)
   - `xstate` (for constraint machine)

5. **Register in monorepo:**
   - Package is automatically discovered via `"workspaces": { "packages": ["apps/*"] }`
   - Turbo will include it in `dev`, `build`, `check-types`, `test` tasks
   - No manual registration needed
