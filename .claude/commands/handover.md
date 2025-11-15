---
description: Create concise context handover summary for next Claude Code session
---

# Context Handover

You are preparing to hand over context to the next Claude Code session. Create a concise, actionable summary that allows the next session to pick up exactly where you left off.

## 1. Assess Current Work

Identify:
- What task is currently in progress?
- What was just completed?
- What's next in the queue?
- Are there any blocking issues?

## 2. Check Git Status

```bash
git status
git log -1 --stat  # Last commit
git diff --stat     # Uncommitted changes
```

## 3. Review Todo List

Check current todos for incomplete items.

## 4. Create Handover Summary

Generate a concise summary following this structure:

```markdown
# Context Handover: [Current Date/Time]

## 🎯 Current Focus
[One sentence: What are we working on right now?]

## ✅ Just Completed
- [Item 1]
- [Item 2]

## 🚧 In Progress
**Current Task**: [Specific task description]
**Status**: [% complete or status description]
**Next Steps**:
1. [Specific next action]
2. [Following action]

**Files Open/Being Edited**:
- `path/to/file.ts` - [What's being changed]

## ⚠️ Blockers / Issues
[Any problems that need attention, or "None"]

## 📋 Next Up (Priority Order)
1. [Next task after current is done]
2. [Following task]
3. [Lower priority]

## 🧠 Mental Model
[2-3 sentences explaining how to think about what we're doing]

## 📚 Key Files for Context
Read these first to understand current state:
1. [Most relevant file]
2. [Second most relevant]
3. [Phase document if applicable]

## 💡 Quick Wins
[Any easy wins or low-hanging fruit identified]

## ⏰ Time-Sensitive Items
[Anything urgent, or "None"]

---

**To Continue**: [Specific instruction for next session to start]

**Current Phase**: [Phase N - Title]
**Branch**: [Git branch name]
```

## 5. Save Handover

**Option A - In conversation** (if context window not full):
- Output the handover summary
- User can copy/paste into next session

**Option B - As file** (if context nearly full):
- Save to `docs/development/handovers/HANDOVER_[YYYY-MM-DD-HHMM].md`
- Tell user the file path
- Next session reads this file

## 6. Final Checklist

Before ending session:
- [ ] All work committed or documented why not
- [ ] Todo list updated
- [ ] Handover summary created
- [ ] Critical decisions/discoveries documented
- [ ] Next session has clear starting point

---

**Example Usage**:
```
User: /handover
Assistant: I'll create a context handover summary for the next session...

# Context Handover: 2025-10-24 23:45

## 🎯 Current Focus
Implementing project selector UI in Navigator for Phase 16 project-centric refactor

## ✅ Just Completed
- Created ProjectContext service
- Added project dropdown to Navigator header
- Unit tests for ProjectContext

## 🚧 In Progress
**Current Task**: Wire up project selection to filter Codex tree
**Status**: 60% complete - service ready, UI needs connection
**Next Steps**:
1. Add event listener to project dropdown onChange
2. Call ProjectContext.setCurrentProject()
3. Trigger Navigator refresh with filtered Codices

**Files Open/Being Edited**:
- `src/views/NavigatorWebviewProvider.ts` - Adding project filtering

## ⚠️ Blockers / Issues
None - straightforward implementation

## 📋 Next Up (Priority Order)
1. Complete project selection wiring (30 min est.)
2. Add "Create New Project" button to dropdown
3. Implement project creation modal
4. Test multi-project switching

## 🧠 Mental Model
Navigator is becoming project-aware. All Codices belong to projects.
When user selects project, Navigator filters tree to show only
that project's Codices. This is foundation for Phase 16.

## 📚 Key Files for Context
1. docs/development/phases/PHASE_16_PLAN.md
2. docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md
3. src/services/ProjectContext.ts

## 💡 Quick Wins
- Project switcher UI is surprisingly clean
- Existing BinderyService already supports project filtering

## ⏰ Time-Sensitive Items
None

---

**To Continue**: Open NavigatorWebviewProvider.ts and complete the
onChange handler for project dropdown (line 234)

**Current Phase**: Phase 16 - Project-Centric Refactor
**Branch**: feat/codex-ui-framework
```

---

**Tips for Effective Handover**:
- Be specific about file paths and line numbers
- Include "why" not just "what"
- Note any non-obvious discoveries
- Point to exact next action, not vague goals
- Include mental model/context
- Link to relevant docs
