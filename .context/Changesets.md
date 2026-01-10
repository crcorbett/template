# Changesets

Changesets manages versioning and changelogs for all packages and apps in this monorepo.

## What Gets Versioned

```
packages/
├── core/     # @packages/core - versioned, changelog for devs
├── ui/       # @packages/ui - versioned, changelog for devs
└── api/      # @packages/api - versioned, changelog for devs

apps/
├── web/      # versioned, changelog for release notes
├── docs/     # versioned, changelog for release notes
└── admin/    # versioned, changelog for release notes
```

All packages and apps participate in changesets. Apps use changelogs for consumer-facing release notes; packages use them for internal dev tracking.

## Workflow

### 1. Add a Changeset

After making changes:

```bash
bun run changeset:add
```

This prompts you to:

1. Select which packages/apps changed
2. Choose bump type (major/minor/patch)
3. Write a summary

### 2. Changeset File Format

Creates a file like `.changeset/purple-cats-dance.md`:

```markdown
---
"@packages/core": minor
"web": patch
---

Add new utility functions and update web app to use them
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
- Generates/updates `CHANGELOG.md` in each package/app
- Deletes processed changeset files

## CI/CD Workflow

The release process is automated via GitHub Actions (`.github/workflows/release.yml`):

```
Developer:
1. Make changes
2. Run `bun run changeset:add`
3. Write summary, commit with PR

CI (on merge to main):
1. Detects pending changesets
2. Opens "Version Packages" PR with bumped versions + changelogs
3. When that PR merges → creates date-based tags for apps
```

### App Release Tags

Apps are tagged with dates (created automatically by CI):

```
web@2024-01-10
docs@2024-01-10
admin@2024-01-10
```

This links deployments to specific points in history. The CHANGELOG.md in each app tracks what changed.

## Multi-Package Changes

If one change affects multiple packages/apps:

```markdown
---
"@packages/core": minor
"@packages/ui": patch
"web": patch
---

Add theme system to core, update UI components, integrate in web app
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

## Changelog Audiences

| Type     | Changelog For   | Example Entry                               |
| -------- | --------------- | ------------------------------------------- |
| Apps     | Consumers/users | "Added dark mode toggle in settings"        |
| Packages | Internal devs   | "Add `useTheme` hook, deprecate `getTheme`" |
