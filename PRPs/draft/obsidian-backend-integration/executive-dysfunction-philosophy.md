# Executive Dysfunction Philosophy - {PROJECT_NAME}

**Application**: {PROJECT_NAME} Meta-PRP  
**Template Version**: 2.1  
**Last Updated**: {DATE}

## Core Executive Dysfunction Design Principles

This meta-PRP is designed with executive dysfunction as a **first-class design constraint**, not an afterthought.

### The Pressure Lid Metaphor

**Problem**: Starting complex projects feels like lifting a heavy lid off a pressure cooker - the harder the task initiation, the heavier the lid feels.

**Solution**: Reduce lid weight through systematic preparation and clear structure.

### The Four Pillars

#### 1. **Momentum Preservation**
**Principle**: Structure survives sleep resets and interruptions  
**Implementation in This Meta-PRP**:
- {How this meta-PRP maintains momentum}
- {Specific mechanisms for resuming work}
- {State preservation strategies}

#### 2. **Lid Weight Reduction**  
**Principle**: Pre-created directories and templates eliminate decision paralysis  
**Implementation in This Meta-PRP**:
- {Pre-created structure elements}
- {Decision-free aspects}
- {Templates that reduce cognitive load}

#### 3. **Pressure Delegation**
**Principle**: Clear structure for distributing work to specialists/agents  
**Implementation in This Meta-PRP**:
- {How work is delegated to agents}
- {Clear handoff mechanisms}
- {Specialist assignment patterns}

#### 4. **Damage Prevention**
**Principle**: Graceful degradation when overwhelm occurs  
**Implementation in This Meta-PRP**:
- {Recovery mechanisms}
- {Rollback strategies}
- {Overwhelm mitigation}

## Project-Specific ED Considerations

### Challenge Areas for This Project

**Challenge 1: {Specific Challenge}**
- **ED Impact**: {How this affects executive function}
- **Mitigation**: {Specific strategies in this meta-PRP}
- **Structure Support**: {How the meta-PRP structure helps}

**Challenge 2: {Specific Challenge}**
- **ED Impact**: {How this affects executive function}
- **Mitigation**: {Specific strategies in this meta-PRP}
- **Structure Support**: {How the meta-PRP structure helps}

**Challenge 3: {Specific Challenge}**
- **ED Impact**: {How this affects executive function}
- **Mitigation**: {Specific strategies in this meta-PRP}
- **Structure Support**: {How the meta-PRP structure helps}

### Success Patterns

**Pattern 1: Incremental Progress Visibility**
- {How progress is made visible at multiple granularities}
- {Frequent wins and milestone recognition}
- {Progress preservation mechanisms}

**Pattern 2: Choice Architecture**  
- {How decisions are pre-made or simplified}
- {Default options that reduce cognitive load}
- {Clear paths forward at each step}

**Pattern 3: External Structure**
- {How the meta-PRP provides external scaffolding}
- {Orchestrator integration for external coordination}
- {Agent delegation for external expertise}

## Orchestrator Integration and ED

### Why Orchestrator Helps with ED

**External Memory**: Orchestrator maintains state and context across sessions
**Task Breakdown**: Converts overwhelming projects into manageable subtasks  
**Progress Tracking**: Provides objective progress measurement
**Context Switching**: Handles complex multi-agent coordination
**State Preservation**: Maintains momentum across interruptions

### ED-Aware Orchestrator Patterns

**Pattern 1: Gentle Task Transition**
```bash
# Instead of overwhelming with all subtasks at once:
orchestrator_execute_task task_id="{current_task}" 
# Only reveals current task context, not entire project complexity
```

**Pattern 2: Momentum Recovery**
```bash
# When resuming after interruption:
orchestrator_get_status
# Provides clear picture of where things stand
orchestrator_query_tasks status="in_progress" 
# Shows exactly what needs attention
```

**Pattern 3: Overwhelm Prevention**
```bash
# When feeling overwhelmed:
orchestrator_maintenance_coordinator action="scan_cleanup"
# Reduces cognitive load by cleaning up completed work
```

## Git Worktree Strategy and ED

### Why Worktrees Help

**Parallel Safety**: Multiple agents work without conflicts
**Context Isolation**: Each worktree contains only relevant context
**Recovery Points**: Each worktree can be discarded if work goes wrong
**Momentum Preservation**: Main branch stays stable during experimentation

### ED-Aware Worktree Management

**Creation Pattern**:
```bash
# Create isolated workspace for specific work
git worktree add ../worktrees/agent-{task} -b feature/{task}
# Agent has complete isolation from overwhelming main repo state
```

**Auto-Preservation Pattern**:
```bash
# Frequent auto-saves prevent work loss
git add -A && git commit -m "WIP: Auto-save $(date +%Y%m%d-%H%M%S)"
# No decisions needed, just automatic progress preservation
```

**Safe Integration Pattern**:
```bash
# When ready, integrate without risk
cd ../../main-repo
git merge feature/{task}  # Only when ready
# OR: git worktree remove ../worktrees/agent-{task}  # If work didn't pan out
```

## Common ED Pitfalls and Mitigations

### Pitfall 1: Analysis Paralysis
**Symptom**: Spending too much time planning without starting
**Mitigation in This Meta-PRP**: {Specific strategy}
**Structure Support**: {How the template reduces this}

### Pitfall 2: Context Switching Overload  
**Symptom**: Getting overwhelmed by too many simultaneous concerns
**Mitigation in This Meta-PRP**: {Specific strategy}
**Structure Support**: {How worktrees and orchestrator help}

### Pitfall 3: Progress Invisibility
**Symptom**: Feeling like no progress is being made
**Mitigation in This Meta-PRP**: {Specific strategy}
**Structure Support**: {How tracking systems help}

### Pitfall 4: Abandonment Tendency
**Symptom**: Starting strong but losing momentum mid-project
**Mitigation in This Meta-PRP**: {Specific strategy}  
**Structure Support**: {How momentum preservation works}

## Success Metrics

### ED-Specific Success Criteria

**Momentum Maintenance**: 
- [ ] Project resumed successfully after {X} interruptions
- [ ] No work lost due to context switching
- [ ] Clear next steps always available

**Cognitive Load Reduction**:
- [ ] Decision points minimized through pre-structure
- [ ] Overwhelm incidents: {Target number or fewer}
- [ ] Recovery time from overwhelm: {Target time or less}

**Structure Effectiveness**:
- [ ] Template structure provided adequate scaffolding
- [ ] Orchestrator integration reduced coordination burden
- [ ] Worktree strategy prevented conflicts and confusion

## Lessons for Future Meta-PRPs

### What Worked Well
{Document successful ED strategies as work progresses}

### What Could Improve  
{Document areas for improvement in ED support}

### Recommendations
{Specific recommendations for future meta-PRPs based on ED experience}

---

**Remember**: Executive dysfunction is not a personal failing - it's a common neurological pattern that benefits from systematic external structure. This meta-PRP is designed to provide that structure.