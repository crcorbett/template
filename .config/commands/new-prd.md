# Create New PRD

Create a new PRD for the ralph-loop plugin following the Ralph Wiggum pattern.

**Important: This command only creates the PRD files. It does NOT begin executing the items.**

## Instructions

1. Check `/prds/` for existing PRDs to determine the next number
2. Create two files:
   - `{n}.{name}-prd.json` - PRD with structured items
   - `{n}.{name}-progress.txt` - Progress tracking file
3. **Do NOT begin executing items** - only create the files and stop

## PRD JSON Format

```json
{
  "prd_id": {n},
  "title": "{Title}",
  "completion_promise": "DONE",
  "items": [
    {
      "category": "functional|architectural|testing",
      "description": "Clear description of what needs to be accomplished",
      "steps": [
        "Step 1: Specific action to take",
        "Step 2: How to verify completion",
        "Step 3: Acceptance criteria"
      ],
      "passes": false
    }
  ]
}
```

### Category Types

- `architectural`: System design, types, abstractions, infrastructure
- `functional`: User-facing features and behaviors
- `testing`: Test coverage, test infrastructure

### Item Sizing

**Each item should be completable in one iteration.** If an item is too large, break it down.

Good items are:

- **Focused**: One clear, specific goal
- **Completable**: Can be finished in one iteration
- **Verifiable**: Clear steps to confirm completion

Bad items:

- ❌ "Implement the whole feature" (too large)
- ❌ "Improve the code" (too vague)
- ❌ "Add feature and tests and docs" (multiple concerns)

### Item Ordering

Order items by risk:

1. Architectural decisions and core abstractions first
2. Implementation and features
3. Tests and polish last

## Progress File Format

```text
# Progress Log

Started: {date}
```

Ralph appends to this file after completing each item.


