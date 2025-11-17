# CONCEPT-002: Task Ordering Dependencies

**Status**: Exploratory 🔮
**Date**: 2025-11-16
**Author**: Aya (with Claude Code)
**Related**: Task System Architecture, Template Composition (CONCEPT-001)

---

## Inspiration

While working on PR workflows, we noticed that the order of operations matters significantly. For example:

- **Problem**: Pushing new commits to an existing PR before updating the PR description and adding reviewer comments
- **Result**: Automated reviewers reference stale context and may incorrectly report that changes haven't been made yet
- **Insight**: Many workflows have inherent ordering dependencies that should be enforced or at least surfaced to users

This pattern appears throughout the system: certain tasks are prerequisites for others, and violating that order creates confusion, errors, or wasted effort.

---

## Vision

A dual-mode task dependency system that can both **enforce** and **guide** proper task sequencing, providing the right level of constraint for different situations.

**User Impact**:
- Prevents common workflow mistakes through intelligent task blocking or warnings
- Reduces cognitive load by surfacing "what needs to happen next" automatically
- Provides flexibility for edge cases where override is necessary

**Developer Impact**:
- Template-driven dependency configuration (no hardcoding)
- Clear mental model: some tasks unlock others, some just warn
- Foundation for future workflow automation

**System Impact**:
- Enables sophisticated multi-step workflows with guaranteed ordering
- Supports both rigid critical paths and flexible best-practice guidance
- Creates framework for "task orchestration" features

---

## Rough Design

High-level approach for a dual-mode dependency system:

**Key Components**:
- **Dependency Graph**: Tasks declare prerequisites via template metadata
- **Enforcement Modes**:
  - **Hard Lock**: Dependent task is disabled/blocked until prerequisites complete
  - **Soft Reminder**: Dependent task shows warning but allows override
- **Template Configuration**: Each task type defines its dependencies and enforcement level
- **UI Indicators**: Visual cues for locked tasks, prerequisite status, and warnings

**Example Workflow**:
```
PR Update Workflow:
1. "Update PR description" (available)
2. "Add reviewer comment" (available)
3. "Push new commits" (HARD LOCK until #1 and #2 complete)
   ↳ Shows: "⚠️ Blocked: Update PR description and add comment first"

Document Review Workflow:
1. "Draft content" (available)
2. "Run spell check" (SOFT REMINDER if #1 incomplete)
   ↳ Shows: "💡 Tip: Usually done after drafting, continue anyway?"
3. "Submit for review" (HARD LOCK until #1 complete)
```

**Template Configuration Example**:
```json5
{
  "id": "push-pr-commits",
  "name": "Push Commits to PR",
  "prerequisites": [
    {
      "taskType": "update-pr-description",
      "mode": "hard-lock",
      "message": "Update PR description before pushing commits"
    },
    {
      "taskType": "add-reviewer-comment",
      "mode": "hard-lock",
      "message": "Add reviewer comment explaining changes"
    }
  ]
}
```

**Visual Sketch**:
```
Task List View:
─────────────────────────────────────
☑ Update PR description          [Complete]
☑ Add reviewer comment           [Complete]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔓 Push new commits               [Available]
   Prerequisites satisfied ✅

vs. when blocked:

─────────────────────────────────────
☐ Update PR description          [Pending]
☐ Add reviewer comment           [Pending]
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🔒 Push new commits               [Blocked]
   ⚠️ Complete prerequisites first
```

---

## Potential Benefits

- ✅ **Prevent Common Mistakes**: Hard locks stop users from violating critical ordering
- ✅ **Encode Best Practices**: Soft reminders guide users toward optimal workflows
- ✅ **Reduce Reviewer Confusion**: Ensures proper PR updates before new commits
- ✅ **Self-Documenting Workflows**: Dependencies make process expectations explicit
- ✅ **Flexible for Edge Cases**: Soft mode allows override when user knows better
- ✅ **Automation Foundation**: Dependency graph enables future auto-sequencing
- ✅ **Template-Driven**: Easy to add new dependency patterns without code changes

---

## Potential Challenges

- ⚠️ **UI Complexity**: Clearly showing locks, warnings, and prerequisites without clutter
- ⚠️ **Configuration Burden**: Templates need well-designed dependency declarations
- ⚠️ **User Education**: Need to teach dual-mode system without overwhelming
- ⚠️ **Override Permissions**: Determining who can override locks (if anyone)
- ⚠️ **Circular Dependencies**: Validation needed to prevent impossible task graphs
- ⚠️ **Dynamic Prerequisites**: Some dependencies may be conditional (based on task state)
- ⚠️ **Performance**: Dependency checking on large task graphs needs to be efficient

---

## Open Questions

1. **Default Mode Strategy**: Should task types default to hard-lock, soft-reminder, or no-dependency?
2. **Override Permissions**: Can users override hard locks? If so, with what audit trail?
3. **Visual Design**: How to show complex dependency graphs in Navigator without clutter?
4. **Conditional Dependencies**: Should dependencies support conditions? (e.g., "only if task has tag X")
5. **Transitive Dependencies**: If A requires B, and B requires C, does UI show full chain?
6. **Dependency Resolution**: What happens if prerequisite is deleted or archived?
7. **Bulk Operations**: How do dependencies affect batch task completion?
8. **Template Inheritance**: Can subtask templates inherit parent's dependency rules?

---

## Related Work

### Similar Concepts
- **CONCEPT-001**: Plan-Question-Task-ADR Workflow - Template composition with implicit ordering
- Task System Architecture (docs/architecture/subsystems/TASK_EXECUTION_ARCHITECTURE.md)

### Existing Implementations
- **GitHub Actions**: `needs` keyword for job dependencies
- **Apache Airflow**: DAG (Directed Acyclic Graph) task dependencies
- **Make/Rake**: Target prerequisites with automatic resolution
- **Notion/ClickUp**: Blocking relationships between tasks

### Relevant ADRs
- ADR-013: Template Composition (established pattern for template-driven features)
- Future ADR: Task Dependency System Design (when/if implementing)

### External References
- Task orchestration patterns in workflow engines
- UI patterns for disabled/locked states (accessibility considerations)
- Dependency graph visualization techniques

---

## Next Steps (If Pursuing)

- [ ] Design template schema for dependency declarations
- [ ] Prototype UI for locked tasks and soft warnings
- [ ] Investigate circular dependency detection algorithms
- [ ] Create example task templates with common dependency patterns
- [ ] User test dual-mode concept (do people understand hard vs. soft?)
- [ ] Evaluate performance impact of dependency checking
- [ ] Design override audit trail (if allowing overrides)
- [ ] Consider integration with automation system (future)

---

## Evolution History

**2025-11-16**: Initial concept captured after PR workflow discussion
- Identified dual-mode system (hard locks + soft reminders)
- Noted PR update workflow as primary use case
- Established template-driven configuration approach

---

*Concept created: 2025-11-16*
*Status: Exploratory*
*Remember: Concepts are explorations, not commitments*
