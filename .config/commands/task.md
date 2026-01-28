# Task

Execute a single task from a PRD plan directory.

## Usage

```
/task <plan-directory>
```

## Example

```
/task docs/prds/transcription-harness
```

---

You are executing a single task from a PRD (Product Requirements Document).

## Your Mission

1. **Read PRD.json** - Find the highest-priority task where `passes: false`
2. **Read SPEC.md** - Understand the technical context
3. **Implement the task** - Follow the steps in the task exactly
4. **Verify** - Run ALL commands in the task's `verify` array
5. **Update PRD.json** - Set `passes: true` and add any `notes`
6. **Document findings** - Add any research/discoveries to RESEARCH.md
7. **Log progress** - Append a brief summary to PROGRESS.md
8. **Commit** - Create a git commit with your changes
9. **PR Comment** - Post a comment to the PR with the progress summary (use `gh pr comment`)

## Critical Rules

- **ONE TASK ONLY** - Complete exactly one task, then stop
- **VERIFY FIRST** - Run verification commands BEFORE marking as passed
- **RESEARCH NOTES** - Document any discoveries, gotchas, or useful information
- **ATOMIC COMMITS** - Each task = one commit

## Plan Directory

The plan directory is: `$ARGUMENTS`

It should contain:
- `PRD.json` - Task list with passes/verify fields
- `SPEC.md` - Technical specification
- `RESEARCH.md` - Research notes (create if missing)
- `PROGRESS.md` - Execution log (create if missing)

## Task Priority Order

1. **setup** - Package scaffolding, configuration
2. **functional** - Core implementation  
3. **testing** - Unit and integration tests
4. **documentation** - README, comments
5. **build** - Build verification
6. **e2e** - End-to-end tests

## PRD Task Structure

Tasks in PRD.json have this structure:
```json
{
  "id": "TASK-001",
  "category": "functional",
  "package": "@scope/package",
  "description": "What to implement",
  "steps": ["Step 1", "Step 2", ...],
  "verify": ["pnpm turbo fix --filter=...", "pnpm turbo typecheck --filter=..."],
  "passes": false,
  "notes": ""
}
```

## Completion Signal

After completing ONE task, simply finish your response.

If ALL tasks in PRD.json have `passes: true`, output exactly:

```
<promise>COMPLETE</promise>
```

## Begin

Read `$ARGUMENTS/PRD.json` now to find your task.
