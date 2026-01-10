# Monorepo Template

A production-ready monorepo template built with **Bun**, **TanStack Start**, **Turborepo**, and **Vercel**. Features live TypeScript types, AI-friendly git submodules for library context, and browser debugging with Playwriter MCP.

## Tech Stack

- **Runtime**: [Bun](https://bun.sh) - Fast JavaScript runtime and package manager
- **Framework**: [TanStack Start](https://tanstack.com/start) - Full-stack React framework with file-based routing
- **Build**: [Turborepo](https://turbo.build) - High-performance monorepo build system
- **Linting**: [Ultracite](https://github.com/harrysolovay/ultracite) (oxlint + oxfmt) - Fast Rust-based tooling
- **Deployment**: [Vercel](https://vercel.com) with Nitro preset and Bun runtime

## Getting Started

### Prerequisites

- [Bun](https://bun.sh/docs/installation) v1.3.5 or later
- Node.js 20+ (for compatibility with some tools)

### Installation

```bash
# Clone with submodules (recommended for AI context)
git clone --recurse-submodules <repo-url>
cd home

# Install dependencies
bun install
```

### Development

```bash
# Start all apps in development mode
bun run dev

# Start a specific app
cd apps/web && bun run dev
```

## Monorepo Structure

```
home/
├── apps/
│   ├── admin/          # TanStack Start admin app (port 3001)
│   ├── docs/           # Documentation site
│   └── web/            # TanStack Start main app
├── packages/
│   ├── api/            # Shared API utilities
│   ├── core/           # Shared business logic
│   └── ui/             # Shared UI components
└── .context/           # Git submodules for AI context
```

## Development Workflow

| Command               | Description                          |
| --------------------- | ------------------------------------ |
| `bun run dev`         | Start all apps in development mode   |
| `bun run build`       | Build all packages and apps          |
| `bun run check-types` | TypeScript type checking             |
| `bun run fix`         | Auto-fix linting issues (Ultracite)  |
| `bun run check`       | Check for linting issues (Ultracite) |

## Git Submodules for AI Context

The `.context/` directory contains git submodules that provide AI coding assistants (Claude, Cursor, Copilot) with library source code for better context and suggestions.

### Current Submodules

- **TanStack Router** - `https://github.com/TanStack/router.git`

### Why This Matters

When AI assistants have access to library source code:

- They understand internal APIs and patterns
- They can reference exact function signatures
- They provide more accurate code suggestions
- They avoid hallucinating non-existent APIs

### Submodule Commands

```bash
# Clone with submodules
git clone --recurse-submodules <repo-url>

# Initialize submodules after a regular clone
git submodule update --init --recursive

# Update submodules to latest
git submodule update --remote

# Add a new submodule
git submodule add <url> .context/<name>
```

## Playwriter MCP for Browser Debugging

This template is designed to work with [Playwriter](https://github.com/remorses/playwriter), an MCP server for controlling Chrome via Playwright. It enables AI assistants to debug and test your running applications directly in the browser.

### What It Does

- Automates browser interactions for debugging
- Takes accessibility snapshots (smaller than screenshots)
- Inspects elements, CSS, and network requests
- Works with Claude Code and other MCP-compatible agents

### Setup

1. Install the [Playwriter Chrome extension](https://chromewebstore.google.com/detail/playwriter)
2. Configure your MCP client with: `npx playwriter@latest`
3. Click the extension icon on any tab you want to control

### Use Cases

- Debug React components in the running app
- Test user flows and interactions
- Inspect network requests and responses
- Capture screenshots and accessibility trees

## TypeScript Configuration

This monorepo uses a "live types" pattern for optimal developer experience. Changes to shared packages are immediately reflected in consuming apps without a build step.

### How It Works

We use a custom export condition `@packages/source` that resolves directly to TypeScript source files during development:

```typescript
// vite.config.ts
export default defineConfig({
  resolve: {
    conditions: ["@packages/source"],
  },
});
```

```jsonc
// packages/core/package.json
{
  "exports": {
    "./*": {
      "import": {
        "@packages/source": "./src/*.ts",    // Development: raw TS
        "types": "./dist/src/*.d.ts",         // Production: declarations
        "default": "./dist/src/*.js"          // Production: compiled JS
      }
    }
  }
}
```

For comprehensive documentation, see [`apps/docs/content/typescript.md`](apps/docs/content/typescript.md).

**Further reading**: [Live types in a TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo) by Colin McDonnell

## Known Issues

### Nitro Disabled in Dev Server

When running with Bun + Nitro + Vite in development, HTTP/2 causes Transfer-Encoding errors. Nitro is only enabled during the build command.

**Impact**: None for deployments—Vercel builds work correctly.

**Reference**: https://github.com/TanStack/router/issues/6050

```typescript
// apps/admin/vite.config.ts
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
```

## Deployment

Apps are configured for Vercel deployment with the Bun runtime.

### Vercel Configuration

- **Runtime**: Bun 1.x
- **Preset**: Nitro `vercel` preset
- **Build Command**: `bun run build`

### Environment Variables

Configure these in your Vercel project settings as needed:

| Variable   | Description                        |
| ---------- | ---------------------------------- |
| `NODE_ENV` | `production` for production builds |

## Additional Documentation

- [`apps/docs/content/typescript.md`](apps/docs/content/typescript.md) - TypeScript monorepo configuration
- [`apps/docs/content/phantom-dependencies.md`](apps/docs/content/phantom-dependencies.md) - How Bun caught a latent dependency bug
