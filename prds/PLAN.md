# Bun Migration Plan

> Implementation checklist for [PRD: Monorepo Migration to Bun](./bun-migration.md)

## Quick Reference: Automatic vs Manual

Bun **automatically** handles these when running `bun install`:

- ✅ Lockfile conversion (`pnpm-lock.yaml` → `bun.lock`)
- ✅ Workspace configuration (`pnpm-workspace.yaml` → `package.json`)
- ✅ Catalog migration (preserves `catalog:` protocol)

You **manually** need to:

- ❌ Update `packageManager` field
- ❌ Add `@types/bun`
- ❌ Update turbo version
- ❌ Add nitro preset to vite.config.ts
- ❌ Update apps/web scripts
- ❌ Update CI/CD workflows

> **Reference**: [Bun pnpm Migration Docs](https://bun.com/docs/pm/cli/install#pnpm-migration)

---

## Pre-Migration

- [ ] Install latest Bun: `curl -fsSL https://bun.sh/install | bash`
- [ ] Verify Bun version: `bun --version` (should be 1.3.5+)
- [ ] Create feature branch: `git checkout -b feat/bun-migration`
- [ ] Review current configs:
  - [`package.json`](../package.json)
  - [`pnpm-workspace.yaml`](../pnpm-workspace.yaml)
  - [`turbo.json`](../turbo.json)

---

## Phase 1: Automatic Migration

> Bun automatically migrates pnpm lockfile, workspaces, and catalogs

- [ ] Run `bun install` (automatic migration happens)
- [ ] Verify `bun.lock` was created
- [ ] Verify `package.json` now contains `workspaces` config:
  ```bash
  cat package.json | grep -A 10 '"workspaces"'
  ```
- [ ] Verify workspace symlinks: `ls -la node_modules/@packages`

---

## Phase 2: Manual Updates

### Root package.json

- [ ] Update `packageManager` field:
  ```json
  "packageManager": "bun@1.3.5"
  ```
- [ ] Add `@types/bun` to devDependencies:
  ```bash
  bun add -D @types/bun
  ```
- [ ] Update `turbo` to `^2.7.2`:
  ```bash
  bun add -D turbo@^2.7.2
  ```

### TanStack Start Configuration

> See [TanStack Start Bun Hosting](https://tanstack.com/start/latest/docs/framework/react/guide/hosting#bun)

- [ ] Add nitro dependency:
  ```bash
  bun add nitro --cwd apps/web
  ```
- [ ] Update [`apps/web/vite.config.ts`](../apps/web/vite.config.ts):
  - [ ] Add import: `import { nitro } from "nitro/vite"`
  - [ ] Add to plugins array: `nitro({ preset: "bun" })`

  Final plugins should look like:

  ```typescript
  plugins: [
    tailwindcss(),
    tsConfigPaths({ projects: ["./tsconfig.json"] }),
    tanstackStart({ srcDirectory: "src" }),
    nitro({ preset: "bun" }),
    viteReact(),
    mkcert(),
  ],
  ```

- [ ] Update [`apps/web/package.json`](../apps/web/package.json) scripts:
  ```json
  {
    "scripts": {
      "dev": "bun --bun vite dev",
      "build": "bun --bun vite build && tsc --noEmit",
      "preview": "bun --bun vite preview",
      "start": "bun run .output/server/index.mjs"
    }
  }
  ```

---

## Phase 3: Verification

> Run these BEFORE cleanup to ensure migration was successful

- [ ] `bun install` completes without errors
- [ ] `bun run dev` starts web app successfully (check HMR works)
- [ ] `bun run build` generates `.output` directory
- [ ] `bun run start` serves production build
- [ ] Type checking passes: `bun run check-types`
- [ ] Linting passes: `bun run check`
- [ ] Verify live types work (modify a package file → check immediate reflection in apps/web)

---

## Phase 4: Cleanup

> Only after Phase 3 passes completely

- [ ] Remove old pnpm files:
  ```bash
  rm pnpm-lock.yaml pnpm-workspace.yaml
  ```

---

## Phase 5: CI/CD Updates

> See [PRD GitHub Actions Workflow](./bun-migration.md#github-actions-workflow-githubworkflowsciyml)

- [ ] Update/create `.github/workflows/ci.yml`:
  - [ ] Replace pnpm setup with `oven-sh/setup-bun@v2`
  - [ ] Update install command to `bun install --frozen-lockfile`
  - [ ] Update script commands to use `bun run`

Example workflow:

```yaml
- name: Setup Bun
  uses: oven-sh/setup-bun@v2
  with:
    bun-version: latest

- name: Install dependencies
  run: bun install --frozen-lockfile
```

---

## Phase 6: Documentation

- [ ] Update [`README.md`](../README.md) with bun commands
- [ ] Update [`apps/docs/content/typescript.md`](../apps/docs/content/typescript.md)
- [ ] Add migration notes to CHANGELOG if exists

---

## Rollback

> See [PRD Section 9: Rollback Procedure](./bun-migration.md#9-rollback-procedure)

If critical issues occur:

```bash
# Restore pnpm files from git
git checkout main -- package.json pnpm-workspace.yaml pnpm-lock.yaml

# Remove Bun artifacts
rm -rf node_modules bun.lock bun.lockb

# Reinstall with pnpm
pnpm install

# Verify
pnpm run dev
pnpm run build
```

---

## External Resources

- [Bun Documentation](https://bun.com/docs)
- [Bun pnpm Migration](https://bun.com/docs/pm/cli/install#pnpm-migration)
- [Bun Workspaces Guide](https://bun.com/docs/pm/workspaces)
- [Bun Catalogs](https://bun.com/docs/pm/catalogs)
- [TanStack Start + Bun](https://bun.com/docs/guides/ecosystem/tanstack-start)
- [TanStack Start Hosting (Bun)](https://tanstack.com/start/latest/docs/framework/react/guide/hosting#bun)
- [Turborepo + Bun](https://turborepo.com/blog/turbo-2-6#bun-package-manager-to-stable)
