---
description: Continue work from a previous session's handover document
---

# Continue from Handover

You are starting a new Claude Code session and need to pick up where the previous session left off. This command helps you quickly get oriented and continue work.

## 1. Find Most Recent Handover

Look for handover documents in `docs/development/handovers/` directory:

```bash
ls -lt docs/development/handovers/ | head -5
```

## 2. Read the Handover

Read the most recent handover file to understand:
- What was just completed
- What's currently in progress
- What the next steps are
- Any blockers or issues
- The mental model/context

## 3. Verify Git State

Check that git state matches what's described in handover:

```bash
git status
git log -3 --oneline
git branch
```

## 4. Set Up Todo List

Extract the "Next Up" tasks from the handover and create a TodoWrite with:
- Current in-progress task (if applicable)
- Priority-ordered next tasks
- Any quick wins identified

## 5. Confirm Understanding

After reading the handover, provide a brief confirmation to the user:

```markdown
## Resuming from [Handover Date/Time]

**Current Phase**: [Phase N - Title]
**Last Completed**: [Brief summary]
**Resuming**: [Current task description]

**Immediate Next Steps**:
1. [First action]
2. [Second action]
3. [Third action]

**Key Files to Work With**:
- [file1.ts](path/to/file1.ts)
- [file2.ts](path/to/file2.ts)

Ready to continue. Starting with [first action]...
```

## 6. Begin Work

Immediately start with the first action item from the handover's "Next Steps" or "To Continue" section. Don't wait for additional user input unless there's a blocker or ambiguity.

## 7. If No Handover Found

If no handover document exists:
1. Check for most recent Phase plan in `docs/development/phases/`
2. Check git log for recent commits to understand context
3. Ask user for context on what they want to resume

---

## Example Usage

```
User: /continue
Assistant: I'll find and load the most recent handover...

Found: docs/development/handovers/HANDOVER_2025-10-24-2345.md

## Resuming from October 24, 2025 23:45

**Current Phase**: Phase 17 - Codex Editor Implementation
**Last Completed**: Created ADR-015 and ADR-016, updated Phase 17 plan
**Resuming**: Stage 0 - Architectural Refactoring (database schema changes)

**Immediate Next Steps**:
1. Refactor database schema (projects/contexts split)
2. Implement global registry in ~/.vespera/
3. Build discovery algorithm

**Key Files to Work With**:
- [src/services/bindery/BinderyService.ts](src/services/bindery/BinderyService.ts)
- [docs/development/decisions/ADR-015-workspace-project-context-hierarchy.md](docs/development/decisions/ADR-015-workspace-project-context-hierarchy.md)

Ready to continue. Starting with database schema refactoring...

Let me read the current BinderyService to understand the existing schema...
```

---

**Tips**:
- Trust the handover - previous session did the thinking
- Don't re-plan unless handover indicates issues
- Jump directly into implementation
- Use subagents for discrete tasks to conserve context
- Update handover if you discover new information
