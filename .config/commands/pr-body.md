---
description: Generate a well-structured PR body following best practices for context and reviewability
---

Generate a PR body for the current branch's changes. Follow the three-layer structure from https://sunilpai.dev/posts/context-is-the-work/

## Structure

### Layer 1: Executive Summary (30 seconds)

Start with 1-2 sentences answering:

- What changed?
- What's the user-visible impact?

### Layer 2: Reviewer Guidance (3-7 minutes)

**Root Cause** (if it's a fix)
Explain WHY the bug happened, not just what was wrong.

**Approach**

- What strategy did you take?
- Key implementation details (with code snippets if helpful)

**Key Invariants**
What properties must hold for this to be correct?

**Non-goals**
What did you explicitly choose NOT to do? This helps reviewers understand scope.

**Trade-offs**
What alternatives were considered? Why this approach?

### Layer 3: Verification & Details

**Verification**
How can someone verify this works? Include commands:

```
bash
pnpm test
```

**Files changed**
Brief description of each file's changes.

## Process

1. First, analyze the diff: `git diff main --stat` and `git log main..HEAD --oneline`
2. Read the changed files to understand the changes
3. Draft the PR body following the structure above
4. Use `gh pr edit --body "..."` to update the PR, or output for a new PR

## Style Notes

- Be concise but complete
- Use code blocks for commands and code snippets
- Focus on transmitting engineering judgment, not just implementation details
- Write for three audiences: quick skimmers, reviewers, and future maintainers
