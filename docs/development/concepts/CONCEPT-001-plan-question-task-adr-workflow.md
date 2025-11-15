# CONCEPT-001: Plan-Question-Task-ADR Workflow Automation

**Status**: Exploratory 🔮
**Date**: 2025-11-15
**Author**: Echoing Vesper
**Related**:
- [ADR-013: Template Composition and Nesting](../decisions/ADR-013-template-composition.md)
- [Phase 17.5 Plan](../phases/PHASE_17.5_PLAN.md)
- [Dynamic Automation Architecture](../../architecture/core/DYNAMIC_AUTOMATION_ARCHITECTURE.md)

---

## Inspiration

During Phase 17.5 planning, we went through a workflow:
1. Created a **Plan** with open questions
2. Answered **Questions** through discussion
3. Questions spawned **ADRs** (documenting decisions) and **Tasks** (implementing decisions)
4. Plan was then condensed to focus on execution

This felt like it could be a templated, partially automated workflow for future phases.

**Triggering Moment**: While streamlining PHASE_17.5_PLAN.md, realized the exploratory content (Options A/B/C) became ADRs, and the decisions became executable tasks. This pattern could repeat.

---

## Vision

What if Plans, Questions, Tasks, and ADRs were all Codex templates that automatically reference each other?

**User Impact**:
- **Phase planning becomes structured**: No more ad-hoc planning docs
- **Decisions are captured**: Questions automatically create ADRs when answered
- **Work is trackable**: Tasks spawn from decisions with clear lineage
- **Knowledge is preserved**: Future phases can see "why" decisions were made

**Developer Impact**:
- **Less manual bookkeeping**: Templates handle cross-referencing
- **Clear workflow**: Plan → Question → Decision → Implementation
- **Searchable history**: "What questions led to this ADR?"

**System Impact**:
- **Template composition showcase**: Demonstrates nested Codex power
- **Automation hooks**: Questions answered → trigger ADR/Task creation
- **RAG-friendly**: Clear semantic relationships for AI assistance

---

## Rough Design

**Key Components**:
- **Plan Codex**: Phase-level planning document with embedded Questions
- **Question Codex**: Individual questions needing answers (can be nested in Plan)
- **ADR Codex**: Architecture Decision Records (already exists, now auto-created from Questions)
- **Task Codex**: Work items (already exists, now auto-created from answered Questions)

**Example Workflow**:
```
1. User creates: Plan Codex "Phase 18: Feature X"
   - Plan template includes Question slots

2. User adds: Question Codices nested in Plan
   - "Should we use approach A or B?"
   - Status: "Unanswered"

3. User answers Question (via UI or automation):
   - Answer: "Approach B, because..."
   - Automation trigger:
     → Creates ADR Codex documenting decision
     → Creates Task Codex(es) for implementation
     → Updates Question status to "Answered"
     → Links all Codices together

4. Plan auto-condenses:
   - Unanswered questions → visible
   - Answered questions → collapsed (link to ADR)
   - Tasks → visible checklist
```

**Visual Sketch**:
```
Plan: "Phase 18 - Feature X"
├── Question 1: "Architecture approach?" [Answered → ADR-019]
│   └── Spawned:
│       ├── ADR-019: Decision documented
│       └── Task 1: "Implement approach B"
├── Question 2: "Security model?" [Unanswered]
└── Task 2: "Write tests" [Manual task]
```

---

## Potential Benefits

- ✅ **Structured planning**: No more freestyle markdown, templates guide the process
- ✅ **Automatic documentation**: Answers become ADRs without manual file creation
- ✅ **Clear lineage**: "This task exists because Question X was answered with Y"
- ✅ **Reduced cognitive load**: System tracks what needs deciding vs. what needs doing
- ✅ **AI-friendly**: Templates make it easy for LLM to suggest answers or create tasks
- ✅ **Searchable**: "Show me all Questions about security" → instant RAG results

---

## Potential Challenges

- ⚠️ **Template complexity**: Need well-designed schemas for all Codex types
- ⚠️ **Automation hooks**: Requires Dynamic Automation system (not yet built)
- ⚠️ **UI support**: Answering Questions needs good UX (not just editing markdown)
- ⚠️ **Over-engineering risk**: Could be too heavyweight for simple decisions
- ⚠️ **Migration effort**: Existing ADRs/Tasks need backward compatibility

---

## Open Questions

1. **Should Questions be first-class Codices or just fields in Plans?**
   - Pros of Codices: Reusable, searchable, can have discussions
   - Pros of fields: Simpler, less overhead

2. **How do we handle Questions with multiple viable answers?**
   - Create multiple ADRs? Branch Plans? Defer to future?

3. **What triggers ADR/Task creation?**
   - Manual "Mark as Answered" action?
   - Automation rule detecting answer text?
   - Explicit "Create Decision" button?

4. **How do we avoid proliferating tiny ADRs for trivial Questions?**
   - Threshold for "decision-worthy"?
   - Allow Questions to be answered without ADR?

---

## Related Work

### Similar Concepts
- (None yet - this is the first concept!)

### Existing Implementations
- **Issue tracking systems**: Linear, Jira (questions → decisions → tasks)
- **RFC processes**: Rust RFCs, Python PEPs (structured decision-making)
- **Decision journals**: Architecture decision logs with parent/child relationships

### Relevant ADRs
- [ADR-013: Template Composition](../decisions/ADR-013-template-composition.md) - Foundation for nested Codices
- [ADR-001: Projects as Fundamental Entities](../decisions/ADR-001-projects-fundamental.md) - Plans would be project-scoped

### External References
- [Documenting Architecture Decisions](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions) - Original ADR concept
- [Y-Statements for ADRs](https://medium.com/olzzio/y-statements-10eb07b5a177) - "In the context of X, facing Y, we decided Z"

---

## Next Steps (If Pursuing)

- [ ] **Phase 18+**: Use this concept to plan a future phase
- [ ] **Prototype**: Create Plan/Question/Task templates manually
- [ ] **Validate**: Does the workflow actually save time?
- [ ] **Automation**: Implement hooks when Dynamic Automation system exists
- [ ] **UI Design**: Sketch interfaces for answering Questions

**Prerequisites**:
- ADR-013 implementation (template composition)
- Dynamic Automation Architecture (for auto-creation)
- Task system integration

**Timeline**: Post-Phase 17.5 (need core template system first)

---

## Evolution History

**2025-11-15**: Initial concept captured during Phase 17.5 planning discussion

---

*Concept created: 2025-11-15*
*Status: Exploratory*
*Remember: This is an exploration of what's possible, not a commitment to implement*
