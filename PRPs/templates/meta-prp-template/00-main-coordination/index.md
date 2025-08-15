# {PROJECT_NAME} Meta-PRP - Main Coordination

**Meta-PRP ID**: `{PROJECT}_META_PRP_{YEAR}`  
**Type**: Multi-Agent Coordination with Full Orchestrator Integration  
**Priority**: {Critical/High/Medium/Low}  
**Estimated Total Effort**: {Timeline}  
**Status**: [DRAFT]  
**Orchestrator Session**: `{session_id}`  
**Parent Task ID**: `{task_id}`

## Foundational Philosophy: Executive Dysfunction as Design Principle

**Core ED Principles for This Meta-PRP**:

- **Momentum Preservation**: {How this meta-PRP maintains momentum across sessions}
- **Lid Weight Reduction**: {What pre-work eliminates decision paralysis}
- **Pressure Delegation**: {How work is distributed to specialists/agents}
- **Damage Prevention**: {What safeguards prevent overwhelming situations}

**Project-Specific ED Considerations**:
{Add any specific executive dysfunction considerations for this project}

## Executive Summary

{2-3 paragraph high-level overview of what this meta-PRP accomplishes, why it's needed, and what success looks like}

## Priority Structure

### Priority 1: {Priority 1 Name} ({Estimated Timeline})
**Location**: [01-{priority-1-slug}/](../01-{priority-1-slug}/index.md)  
**Status**: [DRAFT]  
**Orchestrator Tasks**: `{task_range}`  
**Issue**: {What problem this priority solves}  
**Deliverables**: {Key outputs expected}

### Priority 2: {Priority 2 Name} ({Estimated Timeline})
**Location**: [02-{priority-2-slug}/](../02-{priority-2-slug}/index.md)  
**Status**: [DRAFT]  
**Orchestrator Tasks**: `{task_range}`  
**Issue**: {What problem this priority solves}  
**Deliverables**: {Key outputs expected}

### Priority 3: {Priority 3 Name} ({Estimated Timeline})
**Location**: [03-{priority-3-slug}/](../03-{priority-3-slug}/index.md)  
**Status**: [DRAFT]  
**Orchestrator Tasks**: `{task_range}`  
**Issue**: {What problem this priority solves}  
**Deliverables**: {Key outputs expected}

### Priority 4: {Priority 4 Name} ({Estimated Timeline})
**Location**: [04-{priority-4-slug}/](../04-{priority-4-slug}/index.md)  
**Status**: [DRAFT]  
**Orchestrator Tasks**: `{task_range}`  
**Issue**: {What problem this priority solves}  
**Deliverables**: {Key outputs expected}

## Multi-Agent Coordination Structure

**Orchestrator Role**: Primary coordination hub for all specialist agents

**Agent Hierarchy**:
1. **Main Coordinator** (This agent): Orchestrates entire meta-PRP
2. **Priority Specialists**: One per priority area with domain expertise
3. **Implementation Agents**: Task-specific execution agents spawned as needed

**Coordination Workflow**:
1. Initialize orchestrator session from this directory
2. Create parent task for meta-PRP coordination
3. Break down into priority-specific subtasks
4. Spawn specialist agents for each priority area
5. Monitor progress and synthesize results
6. Complete meta-PRP with comprehensive artifacts

**Git Worktree Strategy**: {Yes, using isolation for parallel work / No, sequential approach}

## Success Metrics

**Completion Criteria**:
- [ ] All 4 priority areas completed successfully
- [ ] All orchestrator artifacts stored and synthesized
- [ ] All deliverables meet quality standards
- [ ] {Project-specific success criterion}
- [ ] {Project-specific success criterion}

**Quality Targets**:
- Context Engineering Score: {Target}/10
- Security Integration Score: {Target}/10  
- Multi-Agent Coordination Score: {Target}/10
- Executive Dysfunction Support Score: {Target}/10

**Validation Requirements**:
- {Specific validation steps}
- {Quality gates to pass}
- {Testing or verification needed}

## Navigation

**Priority Areas**:
- Priority 1: [01-{priority-1-slug}/index.md](../01-{priority-1-slug}/index.md)
- Priority 2: [02-{priority-2-slug}/index.md](../02-{priority-2-slug}/index.md)
- Priority 3: [03-{priority-3-slug}/index.md](../03-{priority-3-slug}/index.md)
- Priority 4: [04-{priority-4-slug}/index.md](../04-{priority-4-slug}/index.md)

**Coordination Tools**:
- Master Checklist: [tracking/checklist.md](tracking/checklist.md)
- Session Logs: [tracking/session-logs/](tracking/session-logs/)
- Orchestrator Status: Use `orchestrator_get_status` tool

**Reference Materials**:
- Template Documentation: [PRPs/templates/meta_prp_structure.md](../../templates/meta_prp_structure.md)
- ED Philosophy: [executive-dysfunction-philosophy.md](../executive-dysfunction-philosophy.md)
- Git Strategy: [git-worktree-strategy.md](../git-worktree-strategy.md)

## Orchestrator Integration Commands

**Initialize Session**:
```bash
# From this directory, initialize orchestrator session
orchestrator_initialize_session working_directory="$(pwd)"
```

**Create Parent Task**:
```bash
# Create the main coordination task
orchestrator_plan_task \
  title="{PROJECT_NAME} Meta-PRP Coordination" \
  description="Multi-agent coordination for {project} meta-PRP execution" \
  complexity="very_complex" \
  task_type="breakdown" \
  specialist_type="coordinator"
```

**Monitor Progress**:
```bash
# Check overall status
orchestrator_get_status

# Query specific tasks
orchestrator_query_tasks parent_task_id="{parent_task_id}"
```

## Ready to Execute

**Pre-flight Checklist**:
- [ ] All placeholder values filled in throughout structure
- [ ] Priority areas customized for specific project needs  
- [ ] Orchestrator session initialized successfully
- [ ] Working directory confirmed correct
- [ ] Related documents reviewed and understood

**Begin Execution**:
1. Start with Priority 1: [01-{priority-1-slug}/index.md](../01-{priority-1-slug}/index.md)
2. Follow systematic approach through all priorities
3. Use orchestrator coordination throughout
4. Maintain momentum with regular progress updates

---

**Meta-PRP Philosophy**: *Every complex multi-phase project benefits from systematic, orchestrated, executive dysfunction-aware coordination.*