# ShadCN Registry System Research

## Overview

The ShadCN registry system is a package distribution mechanism that allows developers to share and install UI components, library code, hooks, and configuration files. It works by publishing JSON manifests that describe resources and their dependencies, which the `shadcn` CLI resolves and installs into a project.

## Registry Schema

### Top-level: registry.json

```jsonc
{
  "$schema": "https://ui.shadcn.com/schema/registry.json",
  "name": "my-registry",
  "homepage": "https://example.com",
  "items": [
    // Array of registry items
  ]
}
```

### Registry Item Schema

Each item in the `items[]` array conforms to `registry-item.json`:

```jsonc
{
  "name": "my-component",
  "type": "registry:ui",
  "title": "My Component",
  "description": "A reusable component",
  "dependencies": ["react-icons"],
  "devDependencies": ["@types/react-icons"],
  "registryDependencies": ["button", "card"],
  "files": [
    {
      "path": "ui/my-component.tsx",
      "type": "registry:ui",
      "content": "// file contents..."
    }
  ],
  "tailwind": { "config": {} },
  "cssVars": { "light": {}, "dark": {} }
}
```

## Registry Item Types

| Type | Path Resolution | Description |
|------|----------------|-------------|
| `registry:ui` | `aliases.ui` (e.g., `@/components/ui`) | UI components |
| `registry:lib` | `aliases.lib` (e.g., `@/lib`) | Library/utility code |
| `registry:hook` | `aliases.hooks` (e.g., `@/hooks`) | React hooks |
| `registry:block` | Project-relative | Full page blocks/templates |
| `registry:component` | `aliases.components` | Non-UI components |
| `registry:page` | Explicit `target` required | Page-level files |
| `registry:file` | Explicit `target` required | Arbitrary files |
| `registry:theme` | N/A | Theme configurations |
| `registry:style` | N/A | Style definitions |
| `registry:base` | N/A | Base configurations |
| `registry:font` | N/A | Font configurations |
| `registry:item` | Explicit `target` required | Universal/framework-agnostic |

## CLI Commands

```bash
# Initialize shadcn in a project
npx shadcn init

# Add a component from the default registry
npx shadcn add button

# Add from a custom/namespaced registry
npx shadcn add @plg/posthog-analytics

# View a registry item without installing
npx shadcn view button

# Search available items
npx shadcn search "analytics"

# List all available items
npx shadcn list

# Build registry from registry.json -> public/r/[name].json
npx shadcn build

# Migrate existing components to latest patterns
npx shadcn migrate
```

## Building a Registry

The `shadcn build` command reads `registry.json` and outputs individual JSON files:

```
registry.json
    | shadcn build
public/r/
  button.json
  card.json
  posthog-analytics.json
  ...
```

Each output file is a self-contained registry item with resolved file contents inlined.

## Namespaced Registries

Custom registries are configured in the consumer's `components.json`:

```jsonc
{
  "registries": {
    "plg": {
      "url": "https://plg.example.com/r",
      "style": "default"
    }
  }
}
```

Then consumers install with:

```bash
npx shadcn add @plg/posthog-analytics
```

The CLI resolves this to `https://plg.example.com/r/posthog-analytics.json`.

## URL Templates

Registry URLs support template placeholders:

```jsonc
{
  "registries": {
    "plg": {
      "url": "https://registry.example.com/r/{name}.json"
    }
  }
}
```

The `{name}` placeholder is replaced with the requested item name. An optional `{style}` placeholder is also supported for multi-style registries.

## Authentication

Registries can require authentication via environment variable expansion:

```jsonc
{
  "registries": {
    "plg": {
      "url": "https://registry.example.com/r",
      "auth": {
        "type": "bearer",
        "token": "${PLG_REGISTRY_TOKEN}"
      }
    }
  }
}
```

Supported auth methods:
- **Bearer tokens**: `Authorization: Bearer <token>`
- **API keys**: Custom header with key
- **Query params**: Token appended as query parameter

All use `${ENV_VAR}` syntax for environment variable expansion.

## Dependency Resolution

### Registry Dependencies

The `registryDependencies` field declares dependencies on other registry items:

```jsonc
{
  "name": "posthog-dashboard",
  "registryDependencies": ["posthog-client", "analytics-utils"],
  "files": [...]
}
```

The CLI performs:
1. **Topological sorting** -- resolves install order based on dependency graph
2. **Deduplication** -- each item is installed at most once
3. **Cross-registry resolution** -- dependencies can reference items from other registries via `@namespace/item` syntax

### NPM Dependencies

```jsonc
{
  "dependencies": ["effect", "@effect/platform", "posthog-js"],
  "devDependencies": ["@types/node"]
}
```

These are auto-installed via the project's package manager when the registry item is added.

## File Path Resolution

Different item types resolve to different directories based on the project's `aliases` configuration in `components.json`:

```jsonc
// components.json
{
  "aliases": {
    "components": "@/components",
    "ui": "@/components/ui",
    "lib": "@/lib",
    "hooks": "@/hooks",
    "utils": "@/lib/utils"
  }
}
```

- `registry:ui` files resolve to `@/components/ui/`
- `registry:lib` files resolve to `@/lib/`
- `registry:hook` files resolve to `@/hooks/`
- `registry:file` and `registry:page` files resolve to explicit `target` path in file definition
- `registry:item` (universal) files require explicit `target` path for all files

## Universal Items (registry:item)

The `registry:item` type is framework-agnostic and requires explicit target paths for every file:

```jsonc
{
  "name": "plg-config",
  "type": "registry:item",
  "files": [
    {
      "path": "plg/config.ts",
      "type": "registry:file",
      "target": "src/plg/config.ts",
      "content": "export const PLG_CONFIG = { ... }"
    },
    {
      "path": "plg/events.ts",
      "type": "registry:file",
      "target": "src/plg/events.ts",
      "content": "export const Events = { ... }"
    }
  ]
}
```

## Key Insight for PLG Distribution

The registry system can distribute Effect service code, layer implementations, and stack configurations as `registry:lib` items. This enables a PLG scaffolding workflow:

```bash
# Consumer adds PLG analytics to their project
npx shadcn add @plg/posthog-analytics
```

This would install:
1. **Effect service definitions** -- `Context.Tag` declarations, typed interfaces
2. **Layer implementations** -- Pre-configured `Layer.effect` constructors
3. **Stack configurations** -- Default PLG stack wiring
4. **NPM dependencies** -- `effect`, `@effect/platform`, `posthog-js` auto-installed

### Example Registry Item for PLG

```jsonc
{
  "name": "posthog-analytics",
  "type": "registry:lib",
  "title": "PostHog Analytics Layer",
  "description": "Effect-based PostHog analytics with typed events and feature flags",
  "dependencies": ["effect", "@effect/platform"],
  "registryDependencies": ["plg-constants"],
  "files": [
    {
      "path": "lib/posthog/client.ts",
      "type": "registry:lib",
      "content": "import { Context, Layer, Effect } from 'effect'\n\nexport class PostHogClient extends Context.Tag('PostHogClient')<...>() {}\n..."
    },
    {
      "path": "lib/posthog/events.ts",
      "type": "registry:lib",
      "content": "export const Events = { SIGNED_UP: 'signed_up', ... } as const"
    },
    {
      "path": "lib/posthog/layers.ts",
      "type": "registry:lib",
      "content": "export const PostHogLive = Layer.effect(PostHogClient, ...)"
    }
  ]
}
```

### Distribution Flow

```
Developer builds PLG registry
    | shadcn build
Hosted at registry URL (e.g., npm, Vercel, S3)
    | npx shadcn add @plg/posthog-analytics
Consumer gets typed Effect services in their lib/ directory
    | import { PostHogClient } from "@/lib/posthog/client"
Consumer uses in their application code
```

This approach is superior to traditional npm packages for PLG code because:
1. **Customizable** -- consumers own the source and can modify it
2. **No version lock-in** -- code is scaffolded, not imported from node_modules
3. **Framework-agnostic** -- works with any build system via `registry:item`
4. **Composable** -- registry dependencies enable modular PLG building blocks
