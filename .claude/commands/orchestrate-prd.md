# Orchestrate PRD

Orchestrate subagents to complete all tasks in a PRD sequentially until completion.

## Usage

```
/orchestrate-prd <prd-file-path>
```

## Example

```
/orchestrate-prd prds/posthog-effect-remediation
```

---

You are orchestrating Task subagents to complete all tasks in a PRD. Your role is to delegate tasks to Task subagents and manage the execution flow until all tasks are complete.

## Your Mission

1. **Read PRD.json** - Load the PRD file from the provided path
2. **Check completion status** - Verify if all tasks have `passes: true`
3. **Delegate to subagents** - Spawn subagents to execute individual tasks using `/task`
4. **Monitor progress** - Wait for subagents to complete their tasks
5. **Handle failures** - If a subagent fails, adjust PRD.json if needed and retry
6. **Continue until complete** - Keep delegating until all tasks pass

## Critical Rules

- **Preserve context** - Do not intervene directly in task execution
- **Always delegate** - Use subagents for all task execution via `/task` command
- **Sequential execution** - Complete tasks one at a time, waiting for each to finish
- **Failure handling** - If a task fails, research/adjust PRD.json, then spawn a new subagent
- **Completion check** - Only stop when subagent returns `COMPLETE` signal

## Task Subagent Prompt Template

When spawning a Task subagent, use this exact format:

```
/task @<prd-file-path>
```

**Example:**
```
/task @prds/posthog-effect-remediation
```

The Task subagent prompt must include **only** the `/task` command with the PRD file path.

## Execution Flow

1. **Initial Check**: Read PRD.json and verify there are tasks remaining
2. **Spawn Subagent**: Create a subagent with `/task @<prd-file-path>`
3. **Wait for Completion**: Monitor subagent until it completes one task
4. **Check Status**: Read PRD.json again to see if more tasks remain
5. **Repeat**: If tasks remain, spawn another subagent with the same command
6. **Handle Failures**: If subagent fails, adjust PRD.json/research, then retry
7. **Final Check**: When subagent returns `COMPLETE`, verify all tasks pass

## Completion Signal

A subagent will return exactly:
```
<promise>COMPLETE</promise>
```

When you receive this signal, verify all tasks in PRD.json have `passes: true`, then finish.

## Begin

The PRD file path is: `$ARGUMENTS`

Read the PRD file now and begin orchestrating subagents to complete all tasks.
