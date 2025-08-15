# {TASK_TITLE}

**Task ID**: `{category-slug}-{task-type}-{number}`  
**Type**: Analysis / Implementation / Testing / Review / Design  
**Local LLM Ready**: ✅ High | 🟡 Medium | ❌ Low  
**Estimated Duration**: {Timeline}  
**Priority**: 🔴 Critical | 🟡 Medium | 🟢 Low  
**Complexity**: {trivial/simple/moderate/complex/very_complex}

## Objective

{Single, clear, measurable objective for this task}

## Context

**Background**: {Why this task is needed}

**Relationship to Priority**: {How this task contributes to the overall priority goal}

**Dependencies**: 
- Requires: {Any prerequisite tasks or conditions}
- Provides to: {What other tasks depend on this}

## Inputs

**Required Files/Data**:
- {Specific file path or data source 1}
- {Specific file path or data source 2}
- {Specific file path or data source 3}

**Commands/Tools Needed**:
- {Specific command or tool 1}
- {Specific command or tool 2}
- {Specific command or tool 3}

**Context Information**:
- {Relevant context item 1}
- {Relevant context item 2}
- {Relevant context item 3}

## Expected Outputs

**Primary Deliverables**:
- {Specific deliverable 1 with format/location}
- {Specific deliverable 2 with format/location}
- {Specific deliverable 3 with format/location}

**Artifact Storage**: All detailed work stored via `orchestrator_complete_task`

**Documentation Updates**: {Any documentation that should be updated}

## Success Criteria

**Completion Requirements**:
- [ ] {Specific measurable completion criterion 1}
- [ ] {Specific measurable completion criterion 2}  
- [ ] {Specific measurable completion criterion 3}
- [ ] All expected outputs generated
- [ ] Validation commands pass
- [ ] Quality standards met

**Validation Commands**:
```bash
# Commands to verify task completion
{validation command 1}
{validation command 2}
{validation command 3}
```

**Quality Gates**:
- [ ] {Quality check 1}
- [ ] {Quality check 2}
- [ ] {Quality check 3}

## Implementation Details

### Approach

{Detailed explanation of how to approach this task}

### Key Steps

1. **{Step 1 Name}**: {Detailed description}
2. **{Step 2 Name}**: {Detailed description}  
3. **{Step 3 Name}**: {Detailed description}
4. **{Step 4 Name}**: {Detailed description}

### Potential Challenges

**Challenge 1**: {Description}  
- **Mitigation**: {How to address}

**Challenge 2**: {Description}
- **Mitigation**: {How to address}

## Local LLM Prompt Template

{Only include this section if Local LLM Ready is ✅ High}

**Structured Prompt**:
```text
CONTEXT: {Background information for LLM}

TASK: {Specific objective}

INPUT: {Structured input data}

REQUIREMENTS: 
- {Specific requirement 1}
- {Specific requirement 2}
- {Specific requirement 3}

OUTPUT_FORMAT: {Expected output structure}

VALIDATION: {How to verify success}

CONSTRAINTS:
- {Any limitations or constraints}
```

## Agent Instructions

**Primary Specialist**: {Type of specialist best suited for this task}

**Execution Context**:
```bash
# Get task context from orchestrator
orchestrator_execute_task task_id="{task_id}"

# Execute the task following the implementation details above
# Store all detailed work in orchestrator artifacts

# Complete task with comprehensive results
orchestrator_complete_task \
  task_id="{task_id}" \
  summary="{Brief summary of what was accomplished}" \
  detailed_work="{All detailed implementation work, code, analysis, etc.}" \
  artifact_type="{code/documentation/analysis/design/test}" \
  next_action="continue"
```

**Special Instructions**:
- {Any specific guidance for the executing agent}
- {Important considerations or warnings}
- {References to related documentation or examples}

## Validation

**Pre-Execution Checklist**:
- [ ] All inputs available and accessible
- [ ] Required tools installed and working
- [ ] Dependencies satisfied
- [ ] Clear understanding of objectives

**Post-Execution Validation**:
```bash
# Run these commands to verify completion
{command to check output 1}
{command to check output 2}
{command to check quality}
```

**Integration Testing**:
- {How this task integrates with other work}
- {Any integration points to verify}

## Git Worktree Strategy

**Isolation Needed**: Yes / No  
**Reason**: {Why isolation is or isn't needed}

**If Using Worktree**:
```bash
# Work in isolated environment
cd ../worktrees/agent-{priority-slug}

# Auto-preserve work frequently
git add -A && git commit -m "WIP: {task-name} progress $(date)"

# Final commit when complete
git add -A && git commit -m "feat({scope}): {task description}"
```

## References

**Related Documents**:
- {Link to related documentation 1}
- {Link to related documentation 2}
- {Link to related examples or templates}

**External Resources**:
- {Link to external documentation or tutorials}
- {Link to relevant APIs or tools}

---

**Navigation**:
- ← Back to [Category Overview](README.md)
- → Next Task: [02-{next-task}.md](02-{next-task-slug}.md)
- ↑ Priority: [../../index.md](../../index.md)
- 📋 Progress: [../../../00-main-coordination/tracking/checklist.md](../../../00-main-coordination/tracking/checklist.md)