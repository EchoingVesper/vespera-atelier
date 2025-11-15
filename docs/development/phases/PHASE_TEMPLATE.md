# Phase [N]: [Title]

**Status**: [Proposed | In Progress | Complete | Superseded]
**Duration**: [Start Date] - [End Date]
**Context Window**: [Link to Claude Code conversation or session notes]
**Related ADRs**: [ADR-XXX, ADR-YYY]

---

## Executive Summary

[2-3 sentence overview of what was/will be accomplished in this phase. Focus on the "why" and "what changed" at a high level.]

---

## Objectives

### Primary Goals
- [ ] [Goal 1]
- [ ] [Goal 2]
- [ ] [Goal 3]

### Secondary Goals
- [ ] [Nice-to-have 1]
- [ ] [Nice-to-have 2]

### Non-Goals
- [Explicitly out of scope for this phase]
- [Deferred to future phases]

---

## What Changed

### Code Changes

**New Files**:
- `path/to/file.ts` - [Brief description]
- `path/to/another.ts` - [Brief description]

**Modified Files**:
- `path/to/existing.ts` - [What changed and why]
- `path/to/config.json` - [What changed and why]

**Deleted Files**:
- `path/to/old-file.ts` - [Why removed]

### Documentation Changes

**Created**:
- [docs/path/to/new-doc.md](../../path/to/new-doc.md) - [Purpose]
- [ADR-XXX](../decisions/ADR-XXX-title.md) - [Decision captured]

**Updated**:
- [CLAUDE.md](../../../CLAUDE.md) - [What sections changed]
- [docs/README.md](../../README.md) - [Updates made]

**Moved/Reorganized**:
- `old/path/` → `new/path/` - [Rationale]

### Architecture Decisions

Key decisions made during this phase (see ADRs for full context):

1. **[Decision Title]** ([ADR-XXX](../decisions/ADR-XXX-title.md))
   - **Problem**: [Brief problem statement]
   - **Solution**: [Chosen approach]
   - **Impact**: [How it affects the system]

2. **[Another Decision]** ([ADR-YYY](../decisions/ADR-YYY-title.md))
   - **Problem**: [Brief problem statement]
   - **Solution**: [Chosen approach]
   - **Impact**: [How it affects the system]

---

## Implementation Details

### Technical Approach

[Describe the overall technical approach taken. How did the implementation align with or deviate from the original plan?]

### Key Implementation Patterns

```typescript
// Example of important pattern or approach
interface KeyPattern {
  // Show a representative example
}
```

### Challenges Encountered

1. **[Challenge Title]**
   - **Problem**: [What went wrong or was harder than expected]
   - **Resolution**: [How it was solved]
   - **Learning**: [What we learned for next time]

---

## Current State

### What Exists Now

Feature implementation status:

- ✅ **[Feature 1]** - Fully implemented, tested, documented
- ✅ **[Feature 2]** - Implemented, needs additional documentation
- 🚧 **[Feature 3]** - Partially implemented (see Technical Debt section)
- ⚠️ **[Feature 4]** - Implemented but has known issues (see Known Issues section)

### What's Still Planned

Features deferred to future phases:

- ❌ **[Feature A]** - Planned for Phase [N+1], documented in [link]
- ❌ **[Feature B]** - Blocked by [dependency], see [ADR-XXX]
- 🔮 **[Feature C]** - Aspirational, timeline TBD

### Technical Debt Created

Shortcuts taken or TODOs added during this phase:

1. **[Debt Item 1]**
   - **Location**: `path/to/file.ts:123`
   - **Description**: [What's the shortcut or TODO]
   - **Impact**: [Low | Medium | High]
   - **Remediation Plan**: [How/when to fix]

2. **[Debt Item 2]**
   - **Location**: `path/to/file.ts:456`
   - **Description**: [What's the shortcut or TODO]
   - **Impact**: [Low | Medium | High]
   - **Remediation Plan**: [How/when to fix]

### Known Issues

Issues discovered but not yet resolved:

1. **[Issue Title]**
   - **Severity**: [Critical | High | Medium | Low]
   - **Description**: [What's broken or wrong]
   - **Workaround**: [Temporary solution if any]
   - **Tracking**: [GitHub issue link or ADR reference]

---

## Testing & Validation

### Tests Added
- [ ] Unit tests for [component]
- [ ] Integration tests for [feature]
- [ ] E2E tests for [workflow]

### Manual Testing Performed
- [ ] [Test scenario 1]
- [ ] [Test scenario 2]
- [ ] [Test scenario 3]

### Validation Results
[Summary of test results, performance benchmarks, or validation outcomes]

---

## Next Phase Planning

### Phase [N+1] Goals

**Proposed Title**: [Next Phase Title]

**Primary Objectives**:
1. [Build on this phase's work]
2. [Address deferred items]
3. [New features or improvements]

### Prerequisites

Before starting Phase [N+1], these items should be addressed:

- [ ] [Prerequisite 1]
- [ ] [Prerequisite 2]
- [ ] [Decision needed on [topic]]

### Open Questions

Decisions that need to be made before/during next phase:

1. **[Question 1]?**
   - **Context**: [Why this needs to be decided]
   - **Options**: [Possible approaches]
   - **Impact**: [How it affects the roadmap]

2. **[Question 2]?**
   - **Context**: [Why this needs to be decided]
   - **Options**: [Possible approaches]
   - **Impact**: [How it affects the roadmap]

---

## Context for AI Assistant

### Quick Start for Next Session

**If you're picking up this phase in a new Claude Code window, start here:**

1. **Read these files first** (in order):
   - [docs/README.md](../../README.md) - Documentation hub
   - [CLAUDE.md](../../../CLAUDE.md) - Development instructions
   - **This file** - Phase context
   - [ADR-XXX](../decisions/ADR-XXX-title.md) - Key decision made in this phase

2. **Key mental models to understand**:
   - [Brief explanation of core concept 1]
   - [Brief explanation of core concept 2]
   - [Brief explanation of how system fits together]

3. **Current focus area**: [Where work is currently concentrated]

### System Architecture Overview

```
[Simple ASCII diagram or bullet structure showing main components]

Component A
├── Subcomponent A1 (implemented this phase)
├── Subcomponent A2 (planned)
└── Subcomponent A3 (deferred)

Component B (not touched this phase)
```

### Common Pitfalls & Gotchas

Things that might confuse or trip up the next session:

1. **[Pitfall 1]**
   - **What**: [Description of the confusing thing]
   - **Why**: [Why it's this way]
   - **How to handle**: [Best practice or workaround]

2. **[Pitfall 2]**
   - **What**: [Description of the confusing thing]
   - **Why**: [Why it's this way]
   - **How to handle**: [Best practice or workaround]

### Important File Locations

Quick reference for key files:

- **Main implementation**: `path/to/main/file.ts`
- **Configuration**: `.vespera/config.json`
- **Tests**: `tests/integration/`
- **Documentation**: `docs/architecture/core/`
- **Examples**: `docs/examples/`

### Commands to Run

```bash
# Build the project
npm run compile

# Run tests
npm test

# Start development
npm run dev

# Check for issues
npm run lint
```

---

## References

### Phase Tracking
- **Previous**: [Phase [N-1]: [Title]](./PHASE_[N-1]_COMPLETE.md)
- **Current**: **Phase [N]: [Title]** (this document)
- **Next**: [Phase [N+1]: [Proposed Title]](./PHASE_[N+1]_PLAN.md)

### Architecture Decision Records
- [ADR-XXX: [Title]](../decisions/ADR-XXX-title.md) - [Brief description]
- [ADR-YYY: [Title]](../decisions/ADR-YYY-title.md) - [Brief description]

### Architecture Documentation
- [Core Architecture Doc](../../architecture/core/RELEVANT_DOC.md)
- [Subsystem Doc](../../architecture/subsystems/RELEVANT_DOC.md)

### Git Commits
- `abc1234` - [Commit message summary]
- `def5678` - [Commit message summary]
- `ghi9012` - [Commit message summary]

### External References
- [GitHub Issue #123](https://github.com/org/repo/issues/123)
- [Related Discussion](link-to-discussion)
- [Inspiration/Reference](external-link)

---

## Appendix

### Metrics

**Lines of Code**:
- Added: [number]
- Deleted: [number]
- Modified: [number]

**Documentation**:
- New documents: [number]
- Updated documents: [number]
- Total documentation pages: [number]

**Time Investment**:
- Estimated: [hours/days]
- Actual: [hours/days]
- Context windows used: [number]

### Team Notes

[Any notes for team members, future maintainers, or context about external factors that influenced decisions]

---

*Template Version: 1.0.0*
*Last Updated: Phase 15 - October 2025*
