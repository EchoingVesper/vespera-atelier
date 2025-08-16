# Priority 1: {PRIORITY_NAME}

**Parent Task ID**: `{parent_task_id}`  
**Priority**: {Critical/High/Medium/Low}  
**Status**: [DRAFT]  
**Estimated Duration**: {Timeline}  
**Specialist Type**: {researcher/architect/coder/tester/reviewer/devops/coordinator}  
**Local LLM Ready**: ✅ High / 🟡 Medium / ❌ Low

## Problem Statement

**Issue**: {Clear description of the problem this priority addresses}

**Impact**: {Why this problem needs to be solved and what happens if it isn't}

**Context**: {Any background information needed to understand the problem}

## Executive Dysfunction Design Focus

**Lid Weight Impact**: {How completing this priority reduces task initiation barriers}

**Momentum Preservation**: {How this priority maintains or builds momentum}  

**Pressure Delegation**: {What aspects can be delegated to specialists/agents}

**Damage Prevention**: {What safeguards prevent overwhelming situations}

## Detailed Requirements

### Functional Requirements

- {Specific functional requirement 1}
- {Specific functional requirement 2}
- {Specific functional requirement 3}

### Technical Requirements

- {Technical constraint or requirement 1}
- {Technical constraint or requirement 2}
- {Technical constraint or requirement 3}

### Quality Requirements

- {Quality standard 1}
- {Quality standard 2}
- {Quality standard 3}

## Subtasks Overview

### Task Categories

**00-{category-1-name}**: {Category description}

- Purpose: {What this category accomplishes}
- LLM Ready: {✅🟡❌}
- Tasks: {Number of tasks in category}

**01-{category-2-name}**: {Category description}  

- Purpose: {What this category accomplishes}
- LLM Ready: {✅🟡❌}
- Tasks: {Number of tasks in category}

### Detailed Subtasks

#### **Category 1: {Category Name}**

- [01-{task-name}.md](subtasks/00-{category-1-slug}/01-{task-slug}.md) - {Brief description}
- [02-{task-name}.md](subtasks/00-{category-1-slug}/02-{task-slug}.md) - {Brief description}
- [More tasks...](subtasks/00-{category-1-slug}/) - {See category README}

#### **Category 2: {Category Name}**

- [01-{task-name}.md](subtasks/01-{category-2-slug}/01-{task-slug}.md) - {Brief description}
- [02-{task-name}.md](subtasks/01-{category-2-slug}/02-{task-slug}.md) - {Brief description}
- [More tasks...](subtasks/01-{category-2-slug}/) - {See category README}

## Success Criteria

**Completion Requirements**:

- [ ] {Specific measurable completion criterion 1}
- [ ] {Specific measurable completion criterion 2}
- [ ] {Specific measurable completion criterion 3}
- [ ] All subtasks completed successfully
- [ ] Quality validation passes
- [ ] Integration testing successful

**Quality Gates**:

- [ ] {Quality validation step 1}
- [ ] {Quality validation step 2}
- [ ] {Quality validation step 3}

**Deliverables**:

- {Expected deliverable 1}
- {Expected deliverable 2}  
- {Expected deliverable 3}
- Orchestrator artifacts with detailed implementation work

## Orchestrator Integration

**Create Priority Task**:

```bash
orchestrator_plan_task \
  title="{PRIORITY_NAME}" \
  description="{Brief description of priority work}" \
  complexity="{trivial/simple/moderate/complex/very_complex}" \
  task_type="{research/implementation/testing/review/etc}" \
  specialist_type="{specialist_type}" \
  parent_task_id="{parent_task_id}"
```

**Spawn Specialist Agent**:

```bash
# Use Task tool to spawn specialist with context:
# "You are a {SPECIALIST_TYPE} executing orchestrator task: {task_id}
#  Working on: {PRIORITY_NAME}
#  Context: {Brief context}
#  Use orchestrator_execute_task to get detailed instructions
#  Complete with orchestrator_complete_task storing all detailed work"
```

**Monitor Progress**:

```bash
orchestrator_query_tasks parent_task_id="{this_priority_task_id}"
```

## Agent Coordination

**Primary Specialist**: {Type of specialist who leads this priority}

**Supporting Specialists**: {Other types that may be needed}

**Coordination Pattern**:
{Sequential/Parallel/Hybrid} - {Explanation of how multiple agents coordinate}

**Dependencies**:

- Requires completion of: {Any prerequisite priorities}
- Provides input to: {Any dependent priorities}
- Parallel work with: {Any concurrent priorities}

## Git Worktree Strategy

**Isolation Needed**: {Yes/No} - {Explanation}

**Branch Strategy**:

```bash
# If using worktree isolation:
git worktree add ../worktrees/agent-{priority-slug} -b feature/{priority-slug}

# Agent works in: ../worktrees/agent-{priority-slug}
# Auto-preserve: git add -A && git commit -m "WIP: $(date)"
# Complete: git add -A && git commit -m "feat({scope}): {description}"
```

## Local LLM Integration

**Automation Potential**: {High/Medium/Low}

**LLM-Ready Tasks**: {Number} of {total} tasks ready for local LLM execution

**Prompt Templates**: Available in each high-readiness subtask file

**Validation Approach**: {How LLM outputs will be validated}

## Tracking

**Progress Checklist**: [tracking/checklist.md](tracking/checklist.md)  
**Session Logs**: [tracking/session-logs/](tracking/session-logs/)  
**Artifacts**: Referenced in orchestrator task completion

**Status Updates**: Update this section as work progresses

---

**Navigation**:

- ← Back to [Main Coordination](../00-main-coordination/index.md)
- → Next Priority: [02-{next-priority}/index.md](../02-{next-priority}/index.md)
- 📋 Master Checklist: [../00-main-coordination/tracking/checklist.md](../00-main-coordination/tracking/checklist.md)
