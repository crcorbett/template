# Create New PRD

Create a new PRD (spec + tasks) for the ralph-loop plugin.

## Instructions

1. Check `/prds/` for existing PRDs to determine the next number
2. Create two files:
   - `{n}.{name}-spec.md` - Specification (ralph-loop reads this)
   - `{n}.{name}-tasks.json` - Task list for tracking

## Spec File Format

The spec file starts with the task instruction and completion promise that ralph-loop uses:

```markdown
{Task description} then write DONE into the record

--completion-promise=DONE

---

## Overview
{Details...}
```

## Tasks JSON Format

```json
{
  "prd_id": {n},
  "title": "{Title}",
  "completion_promise": "DONE",
  "status": "in_progress",
  "tasks": [
    {
      "id": "{n}.1",
      "task": "Task name",
      "description": "What to do",
      "status": "pending",
      "phase": "setup|implementation|testing|completion",
      "notes": ""
    }
  ]
}
```

## Commit Policy

**Commit after each completed task.** Group related changes logically:

- Use conventional commit format: `feat:`, `fix:`, `refactor:`, `chore:`, `test:`
- Each commit should be atomic and buildable

Example workflow:

1. Complete task 2.1 → commit: `feat: add theme token types`
2. Complete task 2.2 → commit: `feat: implement dark theme`
3. Complete task 2.3 → commit: `refactor: use theme tokens in components`

## User Request

$ARGUMENTS
