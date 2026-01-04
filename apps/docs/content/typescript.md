# TypeScript Monorepo Configuration

This document describes our TypeScript monorepo setup, which implements the "live types" pattern for an optimal developer experience. The approach is heavily inspired by [Colin McDonnell's essay on live types in TypeScript monorepos](https://colinhacks.com/essays/live-types-typescript-monorepo).

## Table of Contents

- [Overview](#overview)
- [The Problem: Dead Types](#the-problem-dead-types)
- [Our Solution: Custom Export Conditions](#our-solution-custom-export-conditions)
- [Configuration Deep Dive](#configuration-deep-dive)
  - [Base tsconfig](#base-tsconfig)
  - [Root tsconfig](#root-tsconfig)
  - [Package tsconfigs](#package-tsconfigs)
  - [App tsconfigs](#app-tsconfigs)
  - [Package Exports](#package-exports)
  - [Vite Configuration](#vite-configuration)
- [Trade-offs and Decisions](#trade-offs-and-decisions)
- [Working with AI Agents](#working-with-ai-agents)
- [Common Patterns](#common-patterns)
- [Troubleshooting](#troubleshooting)

---

## Overview

Our monorepo uses Bun workspaces with the following structure:

```
home/
├── apps/
│   ├── docs/
│   └── web/              # TanStack Start application
├── packages/
│   ├── core/             # Shared business logic
│   └── ui/               # Shared UI components
├── tsconfig.base.json    # Shared TypeScript configuration
├── tsconfig.json         # Root project references
├── package.json          # Workspace definition
└── turbo.json            # Turborepo configuration
```

**Key principle**: During development, TypeScript should resolve imports from workspace packages directly to their `.ts` source files—not compiled `.d.ts` declaration files. This is what we call "live types."

---

## The Problem: Dead Types

In a traditional TypeScript monorepo, when `@apps/web` imports from `@packages/core`:

```typescript
import { seo } from "@packages/core/seo";
```

TypeScript would resolve this to compiled declaration files:

```
@packages/core/dist/src/seo.d.ts
```

This creates friction:

1. **Build step required**: You must run `tsc` in each package before types are visible
2. **Stale types**: If you change `seo.ts` but forget to rebuild, your editor shows outdated types
3. **Slow iteration**: Every change requires a rebuild to propagate type information
4. **AI agent friction**: Code assistants struggle when types don't reflect actual source code

---

## Our Solution: Custom Export Conditions

We use Node.js conditional exports with a custom condition `@packages/source` to resolve directly to TypeScript source files during development.

### How It Works

1. **Package exports** define a custom condition pointing to `.ts` files:

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

2. **TypeScript** is configured to recognize this condition:

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "customConditions": ["@packages/source"]
  }
}
```

3. **Vite** is configured to resolve using the same condition:

```typescript
// apps/web/vite.config.ts
export default defineConfig({
  resolve: {
    conditions: ["@packages/source"],
  },
});
```

When TypeScript or Vite resolves `@packages/core/seo`:

- It finds the `@packages/source` condition
- Resolves directly to `./src/seo.ts`
- Types are always current—no build step needed

---

## Configuration Deep Dive

### Base tsconfig

`tsconfig.base.json` is the foundation that all packages and apps extend.

```jsonc
{
  "compilerOptions": {
    // Target and module settings
    "target": "ES2022",
    "module": "ESNext",
    "moduleResolution": "Bundler",
    "lib": ["ES2022", "DOM", "DOM.Iterable"],

    // Strict type checking (all enabled)
    "strict": true,
    "strictNullChecks": true,
    "noUncheckedIndexedAccess": true,
    "exactOptionalPropertyTypes": true,
    "useUnknownInCatchVariables": true,

    // Code quality enforcement
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "noImplicitOverride": true,
    "noPropertyAccessFromIndexSignature": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,

    // Module handling
    "skipLibCheck": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "jsx": "react-jsx",

    // Build output (for packages)
    "declaration": true,
    "declarationMap": true,
    "composite": true,
    "outDir": "${configDir}/dist",

    // LIVE TYPES: Custom condition for development
    "customConditions": ["@packages/source"]
  },
  "exclude": ["${configDir}/dist", "${configDir}/node_modules"]
}
```

#### Key Settings Explained

| Setting                    | Value                  | Purpose                                              |
| -------------------------- | ---------------------- | ---------------------------------------------------- |
| `moduleResolution`         | `"Bundler"`            | Modern resolution for bundler-based workflows (Vite) |
| `composite`                | `true`                 | Enables project references and incremental builds    |
| `declaration`              | `true`                 | Generates `.d.ts` files for packages                 |
| `declarationMap`           | `true`                 | Enables "Go to Definition" to jump to source         |
| `customConditions`         | `["@packages/source"]` | **The live types magic**                             |
| `verbatimModuleSyntax`     | `true`                 | Enforces explicit `type` imports/exports             |
| `noUncheckedIndexedAccess` | `true`                 | Safer array/object access                            |

The `${configDir}` placeholder resolves to the directory containing the extending tsconfig, keeping `outDir` relative to each package.

### Root tsconfig

`tsconfig.json` at the repository root serves two purposes:

1. Defines project references for IDE support
2. Provides a target for root-level type checking

```jsonc
{
  "extends": "./tsconfig.base.json",
  "compilerOptions": {
    "noEmit": true,      // Root never emits
    "composite": false   // Disable for root
  },
  "include": [],
  "references": [
    { "path": "./apps/web" },
    { "path": "./packages/core" },
    { "path": "./packages/api" },
    { "path": "./packages/ui" }
  ]
}
```

**Why `noEmit` and `composite: false`?** The root config doesn't compile anything—it just orchestrates the project structure for TypeScript's language server.

### Package tsconfigs

Package configurations are intentionally minimal:

```jsonc
// packages/core/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["./src/**/*.ts"]
}
```

They inherit everything from base, only specifying what files to include. This keeps configuration DRY and prevents drift.

### App tsconfigs

Application configs have slightly different needs:

```jsonc
// apps/web/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "include": ["**/*.ts", "**/*.tsx"],
  "compilerOptions": {
    "noEmit": true,       // Apps are bundled, not compiled
    "composite": false,   // Not a project reference target
    "baseUrl": ".",
    "paths": {
      "$/*": ["./src/*"]  // Local path alias
    }
  }
}
```

**Key differences from packages:**

- `noEmit: true` — Apps are bundled by Vite, TypeScript only type-checks
- `composite: false` — Apps consume packages but aren't consumed themselves
- `paths` — Optional local aliases for cleaner imports

---

### Package Exports

Each package's `package.json` uses conditional exports to support both development (live types) and production (compiled output).

#### Pattern 1: Wildcard Exports (Multiple Entry Points)

```jsonc
// packages/core/package.json
{
  "name": "@packages/core",
  "type": "module",
  "exports": {
    "./*": {
      "import": {
        "@packages/source": "./src/*.ts",
        "types": "./dist/src/*.d.ts",
        "default": "./dist/src/*.js"
      }
    }
  }
}
```

This allows imports like:

```typescript
import { seo } from "@packages/core/seo";
import { User } from "@packages/core/user";
```

#### Pattern 2: Single + Wildcard Exports

```jsonc
// packages/ui/package.json
{
  "name": "@packages/ui",
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "@packages/source": "./src/index.ts",
        "types": "./dist/src/index.d.ts",
        "default": "./dist/src/index.js"
      }
    },
    "./*": {
      "import": {
        "@packages/source": "./src/*.ts",
        "types": "./dist/src/*.d.ts",
        "default": "./dist/src/*.js"
      }
    }
  }
}
```

This allows both:

```typescript
import { Button } from "@packages/ui";         // Root export
import { Dialog } from "@packages/ui/dialog";  // Subpath export
```

#### Condition Order Matters

The `@packages/source` condition **must come first**:

```jsonc
{
  "@packages/source": "./src/*.ts",  // First!
  "types": "./dist/src/*.d.ts",
  "default": "./dist/src/*.js"
}
```

Node.js and TypeScript evaluate conditions in order. Placing the custom condition first ensures it's used when present, with fallbacks for production.

### Vite Configuration

The bundler must also understand our custom condition:

```typescript
// apps/web/vite.config.ts
import { defineConfig } from "vite";
import tsConfigPaths from "vite-tsconfig-paths";

export default defineConfig({
  resolve: {
    conditions: ["@packages/source"],
  },
  plugins: [
    tsConfigPaths({
      projects: ["./tsconfig.json"],
    }),
    // ... other plugins
  ],
});
```

**Why both `conditions` and `tsConfigPaths`?**

- `conditions` — Tells Vite's resolver to prefer `@packages/source` exports
- `tsConfigPaths` — Resolves TypeScript path aliases like `$/*`

---

## Trade-offs and Decisions

### Why Custom Conditions Over Alternatives?

We evaluated several approaches from Colin's article:

| Approach               | Pros                                        | Cons                                      | Our Decision                |
| ---------------------- | ------------------------------------------- | ----------------------------------------- | --------------------------- |
| **Project References** | Native TS feature, good for large codebases | Must mirror `dependencies`, complex setup | Used for IDE support only   |
| **tsconfig paths**     | Simple to set up                            | Fragile, must sync with package.json      | Used for local aliases only |
| **publishConfig**      | Clean separation                            | pnpm-only, risky if `npm publish` used    | Rejected                    |
| **Custom Conditions**  | Works everywhere, explicit, production-safe | Requires tooling setup                    | **Chosen**                  |

### Why `@packages/source` as the Condition Name?

The condition name should be:

1. **Unique** — Won't collide with third-party packages
2. **Scoped** — Only applies to our workspace packages
3. **Descriptive** — Clear intent

`@packages/source` meets all criteria. If we used something generic like `"source"`, we might accidentally resolve third-party packages to their source files (if they defined the same condition), degrading performance.

### Why Strict TypeScript Settings?

Our base config enables every strict option. This catches more bugs at compile time:

| Setting                      | Catches                                    |
| ---------------------------- | ------------------------------------------ |
| `strictNullChecks`           | Null/undefined reference errors            |
| `noUncheckedIndexedAccess`   | Array out-of-bounds access                 |
| `exactOptionalPropertyTypes` | Difference between `undefined` and missing |
| `noImplicitReturns`          | Missing return statements                  |
| `noUnusedLocals`             | Dead code                                  |

The short-term cost of satisfying these rules pays off in fewer runtime errors.

---

## Working with AI Agents

Live types are particularly valuable when working with AI coding assistants (Cursor, Claude, GitHub Copilot, etc.). Here's why:

### The AI Sees What You See

With live types, when an AI agent reads your code:

```typescript
import { seo } from "@packages/core/seo";
```

It resolves directly to the source file `packages/core/src/seo.ts`, seeing:

- Actual implementation
- JSDoc comments
- Full type definitions in context

Without live types, the AI might see stale or incomplete type information from cached `.d.ts` files.

### Faster Iteration Cycles

When an AI suggests changes to a shared package, you see the effects immediately:

1. AI modifies `packages/core/src/seo.ts`
2. Type errors/updates propagate instantly to `apps/web`
3. No rebuild step required

This tight feedback loop is crucial for effective AI-assisted development.

### Recommended AI Agent Setup

For AI agents working in this codebase:

1. **Trust Go to Definition** — It will jump to actual source, not declarations
2. **Don't run build during development** — Types are always live
3. **Use LSP diagnostics** — Real-time error checking without compilation

---

## Common Patterns

### Adding a New Package

1. Create the package structure:

```
packages/my-package/
├── src/
│   └── index.ts
├── package.json
└── tsconfig.json
```

2. Minimal `tsconfig.json`:

```jsonc
{
  "extends": "../../tsconfig.base.json",
  "include": ["./src/**/*.ts"]
}
```

3. Configure `package.json` exports:

```jsonc
{
  "name": "@packages/my-package",
  "type": "module",
  "exports": {
    ".": {
      "import": {
        "@packages/source": "./src/index.ts",
        "types": "./dist/src/index.d.ts",
        "default": "./dist/src/index.js"
      }
    }
  },
  "scripts": {
    "build": "tsc",
    "check-types": "tsc --noEmit"
  },
  "devDependencies": {
    "typescript": "catalog:typescript"
  }
}
```

4. Add to root `tsconfig.json` references:

```jsonc
{
  "references": [
    // ... existing references
    { "path": "./packages/my-package" }
  ]
}
```

### Cross-Package Dependencies

When one package depends on another:

1. Add workspace dependency:

```jsonc
// packages/ui/package.json
{
  "dependencies": {
    "@packages/core": "workspace:*"
  }
}
```

2. Import normally:

```typescript
// packages/ui/src/button.tsx
import { User } from "@packages/core/user";
```

Live types work across package boundaries—no additional configuration needed.

### Building for Production

When deploying:

```bash
bun run build
```

This runs Turborepo, which:

1. Builds packages in dependency order (`dependsOn: ["^build"]`)
2. Compiles TypeScript to `dist/` in each package
3. Bundles apps with Vite

Production builds use the `default` export condition, resolving to compiled `.js` files.

---

## Troubleshooting

### Types Not Updating

**Symptom**: Changes to a package don't reflect in consuming code.

**Solutions**:

1. Check that the consuming app's `vite.config.ts` includes `conditions: ["@packages/source"]`
2. Restart the TypeScript server (VS Code: `TypeScript: Restart TS Server`)
3. Verify the package's `exports` has `@packages/source` first

### "Cannot find module" Errors

**Symptom**: Import shows red squiggles despite file existing.

**Solutions**:

1. Check the export pattern matches your import path
2. Ensure `moduleResolution` is set to `"Bundler"`
3. Verify `tsconfig.json` extends the base config

### Slow TypeScript Performance

**Symptom**: IDE becomes sluggish in large workspaces.

**Solutions**:

1. Ensure `skipLibCheck: true` is set
2. Check that `exclude` includes `dist/` and `node_modules/`
3. Consider using project references for very large codebases

### Build Fails but Dev Works

**Symptom**: Types resolve in development but `tsc` fails.

**Solutions**:

1. Check that `dist/` directories exist for all packages (run `bun run build` once)
2. Verify `declaration` and `composite` are enabled in packages
3. Ensure export conditions have valid `types` and `default` paths

---

## Further Reading

- [Live types in a TypeScript monorepo](https://colinhacks.com/essays/live-types-typescript-monorepo) — The essay that inspired this setup
- [TypeScript Project References](https://www.typescriptlang.org/docs/handbook/project-references.html)
- [Node.js Conditional Exports](https://nodejs.org/api/packages.html#conditional-exports)
- [Bun Workspaces](https://bun.sh/docs/pm/workspaces)
- [Turborepo Caching](https://turbo.build/repo/docs/crafting-your-repository/caching)
