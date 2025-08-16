# {CATEGORY_NAME} Subtasks

**Purpose**: {High-level purpose of this task category}  
**Local LLM Ready**: ✅ High / 🟡 Medium / ❌ Low  
**Executive Dysfunction Support**: {How this category reduces cognitive load}  
**Estimated Total Duration**: {Timeline for all tasks in category}

## Category Overview

**What This Category Accomplishes**:
{Detailed explanation of the category's role in the overall priority}

**Why This Organization**:
{Explanation of why these tasks are grouped together}

**Specialist Alignment**:
{How this category aligns with specific specialist types or capabilities}

## Task Structure

**Numbering Convention**: Tasks numbered 01-99 within category

**Naming Pattern**: `{number}-{descriptive-task-name}.md`

**Template Compliance**: All tasks follow the standard subtask template

## Task List

### Analysis Phase (If Applicable)

- [01-{task-name}.md](01-{task-slug}.md) - {Brief description}
- [02-{task-name}.md](02-{task-slug}.md) - {Brief description}

### Implementation Phase (If Applicable)  

- [03-{task-name}.md](03-{task-slug}.md) - {Brief description}
- [04-{task-name}.md](04-{task-slug}.md) - {Brief description}

### Validation Phase (If Applicable)

- [05-{task-name}.md](05-{task-slug}.md) - {Brief description}
- [06-{task-name}.md](06-{task-slug}.md) - {Brief description}

## Benefits

- **{Primary Benefit}**: {Detailed explanation}
- **{Secondary Benefit}**: {Detailed explanation}  
- **Local LLM Integration**: {How tasks support automation}
- **Executive Dysfunction Support**: {How structure reduces overwhelm}

## Execution Strategy

**Sequential vs. Parallel**: {How tasks should be approached}

**Dependencies**:

- Within category: {Any task dependencies within this category}
- External: {Dependencies on other categories or priorities}

**Specialist Requirements**:

- Primary: {Main specialist type for this category}
- Supporting: {Any additional specialist types needed}

## Local LLM Integration Details

**High-Readiness Tasks**: {List tasks with ✅ rating}

- Structured inputs/outputs
- Clear validation criteria  
- Minimal ambiguity

**Medium-Readiness Tasks**: {List tasks with 🟡 rating}

- Some human verification needed
- Moderate complexity

**Low-Readiness Tasks**: {List tasks with ❌ rating}  

- Complex reasoning required
- Creative or strategic decisions
- Multi-step coordination

## Quality Standards

**Completion Criteria**: Each task must meet:

- [ ] Objective clearly accomplished
- [ ] Success criteria validated
- [ ] Expected outputs generated
- [ ] Integration tested (if applicable)

**Review Requirements**:

- {Specific review or approval needed}
- {Quality gates that must be passed}

## Orchestrator Coordination

**Task Creation Pattern**:

```bash
# Create subtasks in this category
orchestrator_plan_task \
  title="{Category}: {Task Name}" \
  description="{Task description}" \
  parent_task_id="{priority_task_id}" \
  complexity="{complexity_level}" \
  specialist_type="{specialist_type}"
```

**Execution Pattern**:  

```bash
# Execute task with specialist context
orchestrator_execute_task task_id="{subtask_id}"

# Complete with detailed artifacts
orchestrator_complete_task \
  task_id="{subtask_id}" \
  summary="{Brief summary}" \
  detailed_work="{All detailed work}" \
  next_action="continue"
```

---

**Navigation**:

- ← Back to [Priority Overview](../index.md)
- 📋 Category Tasks: {List individual task links}
- 📊 Progress: [../../tracking/checklist.md](../../tracking/checklist.md)
