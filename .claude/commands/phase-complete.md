---
description: Complete the current development phase with comprehensive documentation
---

# Complete Current Phase

You are completing a development phase for the Vespera Atelier project. Follow this structured process to create comprehensive handover documentation:

## 1. Gather Phase Information

Identify the current phase by:
- Checking `docs/development/phases/` for most recent `PHASE_[N]_PLAN.md`
- Reviewing git commits since phase start
- Checking completed todos

## 2. Analyze What Changed

Use git to understand the scope of changes:

```bash
# Get commit history for this phase
git log --oneline --since="[phase-start-date]"

# Get file changes summary
git diff --stat [phase-start-commit]..HEAD

# Check current status
git status
```

## 3. Document Code Changes

Categorize all changes:

**New Files**: List files created with brief descriptions
**Modified Files**: List files changed and why
**Deleted Files**: List files removed and rationale
**Moved Files**: Note any reorganization

## 4. Document Architecture Decisions

For each significant decision made:
- Create ADR if not already done (use `/adr` command)
- Link ADR in phase completion doc
- Summarize impact

## 5. Assess Current State

Categorize all work items:
- ✅ **Completed**: Fully implemented and tested
- 🚧 **Partial**: Started but not finished
- ❌ **Deferred**: Planned but postponed
- 🔮 **Future**: Aspirational

## 6. Identify Technical Debt

Document any:
- TODOs added to code
- Shortcuts taken
- Known issues
- Missing tests or documentation

## 7. Create Phase Completion Document

Create: `docs/development/phases/PHASE_[N]_COMPLETE.md`

Use template at `docs/development/phases/PHASE_TEMPLATE.md` and fill ALL sections:

**Required Sections**:
- Executive Summary (2-3 sentences)
- What Changed (code, docs, architecture)
- Current State (what exists, what's planned, technical debt)
- Context for AI Assistant (critical for next session!)
- References (commits, ADRs, related docs)

**Special Focus on "Context for AI Assistant" section**:
- Quick start instructions for next session
- Key files to read first
- Mental models to understand
- Common pitfalls and gotchas
- Important file locations
- Commands to run

## 8. Update Phase Status

- Change phase plan status from "In Progress" to "Complete"
- Add completion date
- Link to completion document

## 9. Git Commit

Commit the phase completion with comprehensive message:

```bash
git add docs/development/phases/PHASE_[N]_COMPLETE.md
git commit -m "docs: Phase [N] completion - [Title]

[Comprehensive summary of phase accomplishments]
"
```

## 10. Prepare Handover Summary

Use `/handover` command to create a concise summary for the next context window.

---

**Example Usage**:
```
User: /phase-complete
Assistant: I'll help you complete the current phase. Let me check what phase we're in...

[Analyzes git history, todos, recent work]

I can see Phase 15 was documentation audit. Let me create the completion document...

[Generates PHASE_15_COMPLETE.md with all sections filled]

Phase 15 completion document created. Would you like me to commit this?
```

---

**Quality Checklist**:

Before considering phase complete, ensure:

- [ ] All primary objectives achieved or documented as deferred
- [ ] Git commits have clear messages
- [ ] New features have tests
- [ ] Documentation updated for all changes
- [ ] ADRs created for significant decisions
- [ ] Technical debt documented
- [ ] "Context for AI Assistant" section is comprehensive
- [ ] Next phase prerequisites identified
