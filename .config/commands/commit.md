# Commit

Generate well-scoped git commits with gitmoji and conventional commit format.

## Important

- Prepend `GIT_EDITOR=true` to all git commands to avoid interactive prompts
- If git diff is empty or blocked, use your working memory of recent changes
- **NEVER push** - only commit locally
- **Use Australian English spelling** (e.g., initialise, colour, analyse, behaviour)

## Scope Rules

1. **If files are staged** (`git diff --cached` is non-empty): commit ONLY the staged files
2. **If nothing is staged**: review ALL modified/untracked files

## Commit Scoping

Changes should be **well-scoped** - each commit should represent a single logical change. When analysing changes:

1. Group files by their logical relationship:
   - Same feature/component
   - Same type of change (e.g., all dependency updates, all linting fixes)
   - Same area of codebase

2. **If changes are unrelated**, create MULTIPLE separate commits:
   - Stage related files together: `git add <file1> <file2>`
   - Commit that group
   - Repeat for next group
   - Continue until all changes are committed

3. **Signs that changes should be split**:
   - Different features being added
   - Bug fix mixed with refactoring
   - Config changes mixed with code changes
   - Test additions mixed with unrelated implementation

## Commit Message Format

```
<emoji> <type>: <short title>

<bullet points describing changes>
```

### Format Rules

- **Title**: `<emoji> <type>: <description>` (max 72 characters)
- **Body**: 2-4 bullet points, each < 80 characters
- **Type**: Use conventional commit types (see below)
- **Emoji**: Use actual emoji character, not `:code:` format

## Conventional Commit Types

| Type       | Description                             |
| ---------- | --------------------------------------- |
| `feat`     | New feature                             |
| `fix`      | Bug fix                                 |
| `docs`     | Documentation only                      |
| `style`    | Formatting, no code change              |
| `refactor` | Code change that neither fixes nor adds |
| `perf`     | Performance improvement                 |
| `test`     | Adding/updating tests                   |
| `chore`    | Maintenance, deps, configs              |
| `ci`       | CI/CD changes                           |
| `build`    | Build system changes                    |
| `revert`   | Reverting previous commit               |

## Gitmoji Reference

| Emoji | Type     | Use When                                     |
| ----- | -------- | -------------------------------------------- |
| ✨    | feat     | Introduce new features                       |
| 🐛    | fix      | Fix a bug                                    |
| 🚑️    | fix      | Critical hotfix                              |
| 🔥    | chore    | Remove code or files                         |
| 📝    | docs     | Add or update documentation                  |
| 💄    | style    | Add or update UI and style files             |
| 🎨    | refactor | Improve structure/format of code             |
| ♻️    | refactor | Refactor code                                |
| ⚡️    | perf     | Improve performance                          |
| ✅    | test     | Add, update, or pass tests                   |
| 🧪    | test     | Add a failing test                           |
| 🔧    | chore    | Add or update configuration files            |
| 🔨    | chore    | Add or update development scripts            |
| ➕    | chore    | Add a dependency                             |
| ➖    | chore    | Remove a dependency                          |
| ⬆️    | chore    | Upgrade dependencies                         |
| ⬇️    | chore    | Downgrade dependencies                       |
| 📌    | chore    | Pin dependencies to specific versions        |
| 🚀    | chore    | Deploy stuff                                 |
| 👷    | ci       | Add or update CI build system                |
| 💚    | ci       | Fix CI Build                                 |
| 🔒️    | fix      | Fix security issues                          |
| 🚨    | fix      | Fix compiler/linter warnings                 |
| 🏷️    | feat     | Add or update types                          |
| 🗃️    | feat     | Perform database related changes             |
| 🚚    | refactor | Move or rename resources                     |
| 🏗️    | refactor | Make architectural changes                   |
| ✏️    | fix      | Fix typos                                    |
| 💡    | docs     | Add or update comments in source code        |
| 🙈    | chore    | Add or update .gitignore file                |
| 🎉    | feat     | Begin a project                              |
| 🔖    | chore    | Release / Version tags                       |
| 🚧    | chore    | Work in progress                             |
| 💩    | chore    | Write bad code that needs improvement        |
| ⏪️    | revert   | Revert changes                               |
| 🔀    | chore    | Merge branches                               |
| 📦️    | build    | Add or update compiled files or packages     |
| 👽️    | fix      | Update code due to external API changes      |
| 🍱    | chore    | Add or update assets                         |
| ♿️    | feat     | Improve accessibility                        |
| 💬    | feat     | Add or update text and literals              |
| 🔊    | feat     | Add or update logs                           |
| 🔇    | chore    | Remove logs                                  |
| 🩹    | fix      | Simple fix for a non-critical issue          |
| ⚰️    | chore    | Remove dead code                             |
| 🧱    | chore    | Infrastructure related changes               |
| 🧵    | feat     | Add or update code related to multithreading |
| 🦺    | feat     | Add or update code related to validation     |

## Execution Steps

1. Run `git status` to see current state
2. Run `git diff` (or `git diff --cached` if files are staged) to see changes
3. Analyse changes and group by logical scope
4. For each logical group:
   a. Stage the related files: `git add <files>`
   b. Generate commit message following the format above
   c. Execute: `git commit -m "<title>" -m "<body>"`
5. Repeat until all changes are committed
6. Run `git log --oneline -5` to show what was committed

## Example Output

For a commit adding a new feature:

```
✨ feat: add user authentication flow

- Add login and signup pages with form validation
- Implement JWT token handling in auth context
- Add protected route wrapper component
```

For a commit fixing a bug:

```
🐛 fix: resolve race condition in data fetching

- Add loading state check before updating state
- Cancel pending requests on component unmount
```
