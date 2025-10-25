---
description: Start a new development phase with proper planning and documentation
---

# Start New Phase

You are starting a new development phase for the Vespera Atelier project. Follow this structured process:

## 1. Read Context

First, read these files to understand the current state:

1. **Previous phase completion**: `docs/development/phases/PHASE_[N-1]_COMPLETE.md` (most recent)
2. **Current architecture**: `docs/README.md`
3. **Development guidelines**: `CLAUDE.md`
4. **Recent ADRs**: `docs/development/decisions/README.md`

## 2. Identify Phase Number

Determine the next phase number by checking `docs/development/phases/` directory.

## 3. Gather Requirements

Ask the user:
- What is the primary goal of this phase?
- What features or improvements are in scope?
- What dependencies or prerequisites exist?
- Are there any time constraints or priorities?

## 4. Create Phase Plan

Create a new file: `docs/development/phases/PHASE_[N]_PLAN.md`

Use the template at `docs/development/phases/PHASE_TEMPLATE.md` and fill in:

- **Status**: Proposed
- **Objectives**: Primary goals, secondary goals, non-goals
- **Prerequisites**: What needs to be ready first
- **Open Questions**: Decisions that need to be made

## 5. Create Related ADRs

For any significant architectural decisions:
- Use `/adr` command to create decision records
- Link them in the phase plan

## 6. Initialize Todo List

Use the TodoWrite tool to create a task list for the phase based on objectives.

## 7. Plan Release Notes

Consider if this phase will have a release:
- Check `docs/development/releases/README.md` for versioning scheme
- Note release version in phase plan if applicable
- Release notes will be created during `/phase-complete`

## 8. Confirm with User

Present the phase plan to the user for review and approval before beginning implementation.

---

**Example Usage**:
```
User: /phase-start
Assistant: I'll help you start a new development phase. Let me first check the most recent phase...

[Reads PHASE_15_COMPLETE.md]

I can see Phase 15 was documentation audit and restructure. What would you like to accomplish in Phase 16?

User: Implement the project-centric architecture refactor
Assistant: Excellent. Let me create Phase 16 plan...

[Creates PHASE_16_PLAN.md with objectives, prerequisites, etc.]
```
