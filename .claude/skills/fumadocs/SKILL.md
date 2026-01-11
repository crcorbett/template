---
name: Fumadocs
description: Build and modify documentation websites using Fumadocs framework. Use when creating docs pages, configuring navigation, customizing MDX components, working with content sources, or setting up documentation structure. Triggers on documentation site development, MDX content management, or Fumadocs-specific configuration.
---

# Fumadocs Documentation Development

## Research Resources

### Local Reference (Primary)

Read from the Fumadocs submodule:

- **Core package**: `.context/fumadocs/packages/core/` - Source loading, page tree
- **UI package**: `.context/fumadocs/packages/ui/` - Components and layouts
- **MDX package**: `.context/fumadocs/packages/mdx/` - MDX processing
- **Docs app**: `.context/fumadocs/apps/docs/` - Reference implementation
- **Content structure**: `.context/fumadocs/apps/docs/content/docs/`

Search patterns:

```bash
# Source configuration
grep -r "loader" .context/fumadocs/packages/core/

# UI components
grep -r "DocsLayout" .context/fumadocs/packages/ui/

# MDX components
grep -r "mdx-components" .context/fumadocs/apps/docs/
```

### DeepWiki (Secondary)

Use `mcp__deepwiki__ask_question` with `repoName: "fuma-nama/fumadocs"` for:

- Configuration patterns
- Advanced customization
- Integration with different frameworks
- Content source setup

## Core Structure

### Directory Layout

```
app/
├── docs/
│   └── [[...slug]]/
│       └── page.tsx      # Docs page renderer
├── layout.tsx
└── page.tsx

content/
└── docs/
    ├── index.mdx         # /docs
    ├── getting-started.mdx
    └── guides/
        └── setup.mdx

source.config.ts           # Content source config
```

### Source Configuration

```ts
// source.config.ts
import { defineDocs, defineConfig } from 'fumadocs-mdx/config'

export const docs = defineDocs({
  dir: 'content/docs',
})

export default defineConfig()
```

### Page Component

```tsx
// app/docs/[[...slug]]/page.tsx
import { source } from '@/lib/source'
import { DocsPage, DocsBody } from 'fumadocs-ui/page'

export default async function Page({ params }: { params: { slug?: string[] } }) {
  const page = source.getPage(params.slug)
  if (!page) notFound()

  const MDX = page.data.body

  return (
    <DocsPage toc={page.data.toc}>
      <DocsBody>
        <MDX />
      </DocsBody>
    </DocsPage>
  )
}
```

### Layout with Navigation

```tsx
// app/docs/layout.tsx
import { DocsLayout } from 'fumadocs-ui/layouts/docs'
import { source } from '@/lib/source'

export default function Layout({ children }) {
  return (
    <DocsLayout tree={source.pageTree}>
      {children}
    </DocsLayout>
  )
}
```

### MDX Components

```tsx
// mdx-components.tsx
import { defaultMdxComponents } from 'fumadocs-ui/mdx'

export function useMDXComponents(components) {
  return {
    ...defaultMdxComponents,
    ...components,
  }
}
```

## Workflow

1. **Check existing structure** - Review `content/` directory organization
2. **Research locally** - Read fumadocs submodule for patterns
3. **Use DeepWiki** - For framework-specific questions
4. **Implement** - Follow Fumadocs conventions
5. **Verify** - Run dev server to check rendering
