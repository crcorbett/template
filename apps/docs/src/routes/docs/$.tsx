import type * as PageTree from "fumadocs-core/page-tree";

import { createFileRoute, notFound } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import browserCollections from "fumadocs-mdx:collections/browser";
import { DocsLayout } from "fumadocs-ui/layouts/docs";
import {
  DocsBody,
  DocsDescription,
  DocsPage,
  DocsTitle,
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

function PageActions() {
  const pageInfo = useContext(PageInfoContext);
  if (!pageInfo) return null;

  const markdownUrl = `${pageInfo.url}.mdx`;
  const githubUrl = `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/apps/docs/content/docs/${pageInfo.path}`;

  return (
    <div className="flex flex-row flex-wrap gap-2 items-center border-b pb-6 mb-6">
      <LLMCopyButton markdownUrl={markdownUrl} />
      <ViewOptions markdownUrl={markdownUrl} githubUrl={githubUrl} />
    </div>
  );
}

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

export const Route = createFileRoute("/docs/$")({
  component: Page,
  loader: async ({ params }) => {
    const slugs = params._splat?.split("/") ?? [];
    const data = await loader({ data: slugs });
    await clientLoader.preload(data.path);
    return data;
  },
});

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
