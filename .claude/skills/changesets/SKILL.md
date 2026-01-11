---
name: Changesets
description: Create and manage changesets for version control and changelog generation in this monorepo. Use when preparing releases, documenting changes for packages or apps, or when the user wants to version their work. Triggers on requests to add changesets, version packages, or document changes for release.
---

# Changesets Management

## Reference

Read `.context/changesets.md` for full workflow documentation.

## Quick Reference

### Add a Changeset

After making changes, run:

```bash
bun run changeset:add
```

This prompts for:

1. Which packages/apps changed
2. Bump type (major/minor/patch)
3. Change summary

### Changeset File Format

Creates `.changeset/<random-name>.md`:

```markdown
---
"@packages/core": minor
"web": patch
---

Add new utility functions and update web app to use them
```

### Semver Guidelines

- `patch` - Bug fixes, minor changes
- `minor` - New features (backwards compatible)
- `major` - Breaking changes

### Multi-Package Changes

For changes affecting multiple packages:

```markdown
---
"@packages/core": minor
"@packages/ui": patch
"web": patch
---

Add theme system to core, update UI components, integrate in web app
```

## Versioned Packages

```
packages/
├── core/     # @packages/core
├── ui/       # @packages/ui
└── api/      # @packages/api

apps/
├── web/      # Consumer-facing changelog
├── docs/     # Consumer-facing changelog
└── admin/    # Consumer-facing changelog
```

## Commands

| Command                     | Description                        |
| --------------------------- | ---------------------------------- |
| `bun run changeset:add`     | Create new changeset               |
| `bun run changeset:status`  | Show pending changesets            |
| `bun run changeset:version` | Apply changesets and bump versions |

## Changelog Audiences

| Type     | Audience | Example                                     |
| -------- | -------- | ------------------------------------------- |
| Apps     | Users    | "Added dark mode toggle in settings"        |
| Packages | Devs     | "Add `useTheme` hook, deprecate `getTheme`" |
