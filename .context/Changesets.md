# Changesets

Changesets manages versioning and changelogs for packages in this monorepo.

## What Gets Versioned

```
packages/
├── core/     # @packages/core - versioned
├── ui/       # @packages/ui - versioned
└── api/      # @packages/api - versioned

apps/
├── web/      # private, not versioned
├── docs/     # private, not versioned
└── admin/    # private, not versioned
```

Apps are `private: true` so changesets ignores them. Only publishable packages participate.

## Workflow

### 1. Add a Changeset

After making changes to a package:

```bash
bun run changeset:add
```

This prompts you to:

1. Select which packages changed
2. Choose bump type (major/minor/patch)
3. Write a summary

### 2. Changeset File Format

Creates a file like `.changeset/purple-cats-dance.md`:

```markdown
---
"@packages/core": minor
---

Add new utility functions for date handling
```

### 3. Commit with PR

Commit the changeset file with your PR. Reviewers see what version bump you're proposing.

### 4. Version Packages

When ready to release:

```bash
bun run changeset:version
```

This:

- Consumes all pending changesets
- Bumps versions in `package.json`
- Generates/updates `CHANGELOG.md` in each package
- Deletes processed changeset files

## Multi-Package Changes

If one change affects multiple packages:

```markdown
---
"@packages/core": minor
"@packages/ui": patch
---

Add theme system to core and update UI components to use it
```

## Internal Dependencies

Config has `updateInternalDependencies: "patch"` - if `@packages/ui` depends on `@packages/core`, it automatically gets a patch bump when core changes.

## Commands

| Command                     | Description                        |
| --------------------------- | ---------------------------------- |
| `bun run changeset:add`     | Create a new changeset             |
| `bun run changeset:status`  | Show pending changesets            |
| `bun run changeset:version` | Apply changesets and bump versions |

## Semver Guidelines

- `patch` - Bug fixes, minor changes
- `minor` - New features (backwards compatible)
- `major` - Breaking changes
