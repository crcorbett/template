---
name: TanStack Start
description: Build and modify TanStack Start/Router web applications with type-safe routing, SSR, and server functions. Use when creating new routes, loaders, actions, server functions, route configuration, or working with TanStack Router patterns. Triggers on requests involving routing, navigation, data loading, or full-stack React app development using TanStack.
---

# TanStack Start/Router Development

## Research Resources

Before implementing, gather context from these sources:

### Local Reference (Primary)

Read documentation from the TanStack Router submodule:

- **Router guide**: `.context/tanstack-router/docs/router/framework/react/guide/`
- **Start framework**: `.context/tanstack-router/docs/start/framework/`
- **API reference**: `.context/tanstack-router/docs/router/api/`
- **Examples**: `.context/tanstack-router/examples/`

Search patterns for common needs:

```bash
# Route configuration
grep -r "createFileRoute" .context/tanstack-router/examples/

# Loaders and data fetching
grep -r "loader" .context/tanstack-router/docs/

# Server functions
grep -r "createServerFn" .context/tanstack-router/docs/
```

### DeepWiki (Secondary)

Use `mcp__deepwiki__ask_question` with `repoName: "TanStack/router"` for:

- Clarifying routing patterns
- Understanding SSR/streaming behavior
- Server function implementation details
- Migration guidance

## Core Patterns

### File-Based Routing

Routes live in `app/routes/`:

```
app/routes/
├── __root.tsx          # Root layout
├── index.tsx           # / route
├── about.tsx           # /about route
├── posts/
│   ├── index.tsx       # /posts route
│   └── $postId.tsx     # /posts/:postId route
```

### Route Definition

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/posts/$postId')({
  loader: async ({ params }) => fetchPost(params.postId),
  component: PostComponent,
})

function PostComponent() {
  const post = Route.useLoaderData()
  return <div>{post.title}</div>
}
```

### Server Functions

```tsx
import { createServerFn } from '@tanstack/start'

const getUser = createServerFn({ method: 'GET' })
  .validator((userId: string) => userId)
  .handler(async ({ data: userId }) => {
    return await db.user.findUnique({ where: { id: userId } })
  })
```

### Search Params with Validation

```tsx
import { z } from 'zod'

export const Route = createFileRoute('/search')({
  validateSearch: z.object({
    query: z.string().optional(),
    page: z.number().default(1),
  }),
})
```

## Workflow

1. **Understand requirements** - What routes/features are needed?
2. **Research patterns** - Check local docs and examples first
3. **Use DeepWiki** - For specific questions not covered locally
4. **Implement** - Follow TanStack conventions for type safety
5. **Verify types** - Run `tsc --noEmit` to check type safety
