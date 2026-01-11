IMPORTANT: ONLY WORK ON A SINGLE TASK. If, while implementing the task, you notice that all work is complete for the task, stop and wait for further details. DO NOT PROCEED WITH ANY OTHER TASKS. If you notice that all work in the tasks list has now been completed, output <promise>COMPLETE</promise>.

1. **Read context**: Review the PRD and progress file to understand what's done and what's next
2. **Select next item**: Decide which task to work on next. This should be the one YOU decide has the highest priority, not necessarily the first in the list. You MUST only work on a single task, before stopping.
3. **Implement**: Complete all steps in the task's `steps` array
4. **Verify**: Run ALL feedback loops before committing
5. **Commit**: Only commit when all feedback loops pass
6. **Update**: Mark task `passes: true` and append to progress file
7. **Stop**: If all work is complete for the single task, stop and wait for further details. DO NOT PROCEED WITH ANY OTHER TASKS. If you notice that all work in the tasks list has now been completed, output <promise>COMPLETE</promise>.

When choosing your task, prioritize in this order:

1. Architectural decisions and core abstractions
2. Integration points between modules
3. Unknown unknowns and spike work
4. Standard features and implementation
5. Polish, cleanup, and quick wins

Fail fast on risky work. Save easy wins for later.

## Feedback Loops (ALL must pass before commit)

**CRITICAL: No commits can be made until ALL feedback loops pass.**

Before committing any work, verify:

- ✅ `turbo check-types` - All types pass (including test files)
- ✅ `turbo build` - All packages and apps build successfully
- ✅ `turbo test` - All tests pass
- ✅ Coverage thresholds met (check vitest.config.ts for required %)
- ✅ `turbo fix` - All lint/format errors handled
- ✅ UI changes verified with playwriter (if applicable)

YOU MUST ALWAYS USE THE TURBO COMMANDS (add --filter if necessary) TO TYPE CHECK, TEST, LINT, AND BUILD.

**If any feedback loop fails, fix the issues before committing. Do not commit broken code.**

## Commit Format

Use conventional commits and follow the guidance in the /claude/commands/commit.md file:

## Progress File Updates

After completing each task, append to progress.txt:

- Task completed and PRD item reference
- Key decisions made and reasoning
- Files changed
- Any blockers or notes for next iteration

Keep entries concise. Sacrifice grammar for the sake of concision. This file helps future iterations skip exploration.

```text
## Iteration {n}
- Completed: {item description}
- Changes: {brief summary of what was added/modified}
- Updated: prd.json item {n} (category: {category}) → passes: true
```

## Quality Expectations

- **Production code**: Must be maintainable, follow existing patterns
- **Tests**: Required for new functionality
- **Types**: Full type safety, no `any`.
