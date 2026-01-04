# Phantom Dependencies: How Bun Caught a Latent Bug

During our migration from pnpm to Bun (December 2024), we discovered a **phantom dependency** that had been silently lurking in our codebase. This document explains what happened, why it matters, and how different package managers handle this issue.

## Table of Contents

- [What Happened](#what-happened)
- [What Are Phantom Dependencies?](#what-are-phantom-dependencies)
- [Why pnpm Didn't Catch It](#why-pnpm-didnt-catch-it)
- [Why Bun Did Catch It](#why-bun-did-catch-it)
- [The Fix](#the-fix)
- [Lessons Learned](#lessons-learned)
- [Prevention Strategies](#prevention-strategies)

---

## What Happened

After running `bun install` and attempting `bun run check-types`, TypeScript failed in `packages/ui`:

```
packages/ui/src/ui/button.tsx:1:23 - error TS7016: Could not find a declaration file for module 'react'.
```

The `packages/ui` package was importing `react` but had never declared `@types/react` in its `devDependencies`. It had been working for months under pnpm.

**This was a phantom dependency.**

---

## What Are Phantom Dependencies?

A phantom dependency occurs when your code imports a package that isn't explicitly listed in your `package.json`, but still works because:

1. The package is hoisted from another workspace package
2. A transitive dependency happens to install it
3. The package manager's node_modules structure makes it accessible

```
// packages/ui/package.json
{
  "dependencies": {
    "react": "catalog:react"
    // Notice: NO @types/react listed!
  }
}

// packages/ui/src/button.tsx
import type * as React from "react";  // Works anyway... sometimes
```

Phantom dependencies are dangerous because:

- **They work until they don't** — A seemingly unrelated change can break your build
- **They're invisible** — No linter catches them by default
- **They're non-deterministic** — May work on one machine but fail on another
- **They complicate upgrades** — Hard to know what actually depends on what

---

## Why pnpm Didn't Catch It

pnpm is famous for its strict `node_modules` structure that _should_ prevent phantom dependencies. So why didn't it catch this?

### pnpm's Module Resolution

pnpm uses a content-addressable store with symlinks:

```
node_modules/
├── .pnpm/                          # Content-addressable store
│   ├── react@19.0.0/
│   │   └── node_modules/
│   │       └── react/
│   └── @types+react@19.0.0/
│       └── node_modules/
│           └── @types/react/
├── react -> .pnpm/react@19.0.0/... # Symlink for declared deps
└── @types/react -> ...             # Hoisted from apps/web
```

### The Catch: TypeScript Type Resolution

Here's where it gets tricky. TypeScript's type resolution doesn't follow the same rules as Node.js module resolution:

1. **TypeScript searches up the directory tree** for `@types/*` packages
2. **Workspace hoisting** — Even in pnpm, certain packages get hoisted to the root `node_modules` for compatibility
3. **`apps/web` had `@types/react`** — It was hoisted to root, making it visible to `packages/ui`

```
home/
├── node_modules/
│   └── @types/
│       └── react/          # Hoisted from apps/web
├── apps/web/               # Declares @types/react ✓
└── packages/ui/            # Doesn't declare it ✗ (but TypeScript finds it anyway)
```

TypeScript in `packages/ui` looked up the tree, found `@types/react` at the root, and happily resolved types. **The phantom dependency was hidden by hoisting.**

---

## Why Bun Did Catch It

Bun uses a flat `node_modules` structure similar to npm v3+, but with different hoisting heuristics.

### Bun's Approach

When we ran `bun install`:

1. Bun analyzed the dependency graph fresh
2. It made different hoisting decisions than pnpm
3. `@types/react` was **not** hoisted to a location visible to `packages/ui`

```
home/
├── node_modules/
│   ├── react/              # Hoisted (used by multiple packages)
│   └── ...                 # @types/react NOT here
├── apps/web/
│   └── node_modules/
│       └── @types/react/   # Stays local to apps/web
└── packages/ui/            # Can't find @types/react anymore!
```

When `tsc` ran in `packages/ui`, it searched up the tree and found... nothing. TypeScript correctly errored.

### The Key Insight

**Different package managers make different hoisting decisions.** What works under one may fail under another. The only safe approach is explicit dependency declaration.

---

## The Fix

The fix was straightforward — declare what you use:

```diff
// packages/ui/package.json
{
  "dependencies": {
    "react": "catalog:react"
  },
  "devDependencies": {
+   "@types/react": "catalog:react",
+   "@types/react-dom": "catalog:react",
    "typescript": "catalog:typescript"
  }
}
```

After this change, `bun run check-types` passed.

---

## Lessons Learned

### 1. Type Packages Are Dependencies Too

It's easy to think of `@types/*` packages as "IDE helpers" rather than real dependencies. They're not — they're required for TypeScript compilation.

**Rule**: If you import types from a package, you need either:

- The package itself (if it ships types)
- The corresponding `@types/*` package

### 2. "Works on My Machine" Includes Package Managers

Your CI might use a different package manager version, or a colleague might use a different one entirely. Phantom dependencies are a leading cause of "works locally, fails in CI" bugs.

### 3. Strict Mode Isn't Always Strict Enough

Even pnpm's strict mode couldn't catch this because TypeScript's type resolution has its own rules that bypass Node.js module resolution.

### 4. Migrations Expose Hidden Bugs

The Bun migration didn't introduce a bug — it **exposed** one that had been there all along. This is a feature, not a bug. Migration friction often reveals technical debt.

---

## Prevention Strategies

### 1. Use a Dependency Auditor

Tools like `depcheck` analyze your imports against your declared dependencies:

```bash
bunx depcheck packages/ui
```

Output:

```
Missing dependencies
* @types/react
* @types/react-dom
```

Consider adding this to CI:

```yaml
# .github/workflows/ci.yml
- name: Check for phantom dependencies
  run: bunx depcheck --ignore-patterns=dist
```

### 2. Review Dependencies During Code Review

When reviewing PRs that add new imports, verify the corresponding dependency is added to `package.json`.

### 3. Isolate Type-Checking Per Package

Run `tsc --noEmit` in each package independently (as we do with Turborepo). This is more likely to catch missing type dependencies than a single root-level check.

```json
// turbo.json
{
  "tasks": {
    "check-types": {
      "dependsOn": ["^build"]
    }
  }
}
```

### 4. Document the Pattern

When adding a new package, use this checklist:

- [ ] Runtime dependencies in `dependencies`
- [ ] Type packages in `devDependencies`
- [ ] Build tools in `devDependencies`
- [ ] No reliance on hoisted packages from siblings

---

## Summary

| Aspect                 | pnpm                                        | Bun                           |
| ---------------------- | ------------------------------------------- | ----------------------------- |
| Module structure       | Symlinked, semi-isolated                    | Flat, hoisted                 |
| Phantom dep protection | Partial (bypassed by TS type resolution)    | None (flat hoisting)          |
| Our phantom dep        | Hidden by hoisting                          | Exposed by different hoisting |
| Verdict                | Not a pnpm bug — a TS type resolution quirk | Migration revealed latent bug |

**The real lesson**: Explicit is better than implicit. Declare every dependency your code actually uses, including type packages. Don't rely on hoisting behavior — it varies between package managers and versions.

---

## Further Reading

- [pnpm Strictness](https://pnpm.io/npmrc#strict-peer-dependencies)
- [Bun Module Resolution](https://bun.sh/docs/runtime/modules)
- [TypeScript Module Resolution](https://www.typescriptlang.org/docs/handbook/module-resolution.html)
- [depcheck](https://github.com/depcheck/depcheck)
