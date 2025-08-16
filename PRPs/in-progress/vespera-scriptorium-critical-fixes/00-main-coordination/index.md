# Vespera-Scriptorium Critical Fixes Meta-PRP - Main Coordination

**Meta-PRP ID**: `VESPERA_CRITICAL_FIXES_META_PRP_2025`  
**Type**: Multi-Agent Coordination with Full Orchestrator Integration  
**Priority**: Critical  
**Estimated Total Effort**: 8 hours  
**Status**: [IN-PROGRESS]  
**Orchestrator Session**: `session_65574b8d_1755323773`  
**Parent Task ID**: `task_1477b237`

## Foundational Philosophy: Executive Dysfunction as Design Principle

**Core ED Principles for This Meta-PRP**:

- **Momentum Preservation**: Each bug gets dedicated GitHub issue and git worktree so work survives context switches and sleep cycles
- **Lid Weight Reduction**: Pre-created directory structure, detailed bug reproduction steps, and specialized agent contexts eliminate decision paralysis
- **Pressure Delegation**: 9 critical bugs distributed across 4 specialized agents with orchestrator coordination rather than overwhelming single developer
- **Damage Prevention**: Isolated git worktrees prevent merge conflicts, automated testing gates prevent regressions, orchestrator artifacts preserve all work

**Project-Specific ED Considerations**:
The vespera-scriptorium codebase is complex with multiple architecture layers. This meta-PRP provides systematic navigation through handler migration issues, database layer problems, and MCP tool architecture without requiring developers to hold entire system in working memory.

## Executive Summary

This meta-PRP systematically addresses 9 critical bugs identified in the comprehensive vespera-scriptorium MCP tools audit that block core workflows and reduce system reliability to 68%. The audit revealed fundamental issues: handler migration failures, missing dependencies, task lookup system problems, and template resolution bugs that prevent users from trusting the system for production work.

The solution uses multi-agent coordination with GitHub issue tracking and git worktree isolation to fix these bugs in parallel while implementing background automation architecture. Each critical bug gets a dedicated GitHub issue, specialized fix agent, and isolated development environment to prevent conflicts and enable systematic resolution.

Success means achieving 90%+ tool reliability, eliminating workflow-blocking bugs, and establishing background automation for routine tasks like template installation and session cleanup. Users will be able to trust vespera-scriptorium for critical development workflows without encountering fundamental system failures.

## Priority Structure

### Priority 1: Critical System Bugs (4 hours)
**Location**: [01-critical-system-bugs/](../01-critical-system-bugs/index.md)  
**Status**: [IN-PROGRESS]  
**Orchestrator Tasks**: `TBD - will create breakdown tasks`  
**Issue**: 4 system-breaking bugs: missing watchfiles dependency, handler migration data mapping, task/session lookup failures, template instantiation broken  
**Deliverables**: All system-breaking bugs fixed, server restart functional, task lookup working, templates instantiating correctly

### Priority 2: Workflow-Critical Bugs (2 hours)
**Location**: [02-workflow-critical-bugs/](../02-workflow-critical-bugs/index.md)  
**Status**: [DRAFT]  
**Orchestrator Tasks**: `TBD - depends on Priority 1 completion`  
**Issue**: 2 workflow-breaking bugs: orchestrator_query_tasks array parameter failure, missing orchestrator_create_generic_task registration  
**Deliverables**: Task discovery working via query_tasks, all planned MCP tools registered and functional

### Priority 3: Architecture Implementation (3 hours)
**Location**: [03-architecture-implementation/](../03-architecture-implementation/index.md)  
**Status**: [DRAFT]  
**Orchestrator Tasks**: `TBD - architecture design and implementation tasks`  
**Issue**: Missing background automation system: manual template installation, no automatic session cleanup, lack of validation hooks  
**Deliverables**: Background automation system implemented, automatic template installation on session init, validation hooks, production-ready replacements for TODO placeholders

### Priority 4: Integration Testing (1 hour)
**Location**: [04-integration-testing/](../04-integration-testing/index.md)  
**Status**: [DRAFT]  
**Orchestrator Tasks**: `TBD - comprehensive testing and validation tasks`  
**Issue**: Need comprehensive testing of all fixes and verification of 90%+ success rate target  
**Deliverables**: Full system validation, comprehensive test coverage, GitHub issues resolved and closed, meta-PRP completion artifacts

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

**Git Worktree Strategy**: Yes, using 4 isolated worktrees for parallel development with auto-preservation

## Success Metrics

**Completion Criteria**:
- [ ] All 4 priority areas completed successfully
- [ ] All orchestrator artifacts stored and synthesized
- [ ] All deliverables meet quality standards
- [ ] All 9 critical bugs fixed and tested
- [ ] System reliability improved to 90%+ tool success rate

**Quality Targets**:
- Context Engineering Score: 10/10
- Security Integration Score: 9/10  
- Multi-Agent Coordination Score: 10/10
- Executive Dysfunction Support Score: 10/10

**Validation Requirements**:
- Comprehensive testing of all 32 MCP tools after fixes
- Verification that all previously broken tools now work
- Performance testing to ensure no regressions
- GitHub issues resolved and closed with artifacts

## Navigation

**Priority Areas**:
- Priority 1: [01-critical-system-bugs/index.md](../01-critical-system-bugs/index.md)
- Priority 2: [02-workflow-critical-bugs/index.md](../02-workflow-critical-bugs/index.md)
- Priority 3: [03-architecture-implementation/index.md](../03-architecture-implementation/index.md)
- Priority 4: [04-integration-testing/index.md](../04-integration-testing/index.md)

**Coordination Tools**:
- Master Checklist: [tracking/checklist.md](tracking/checklist.md)
- Session Logs: [tracking/session-logs/](tracking/session-logs/)
- Orchestrator Status: Use `orchestrator_get_status` tool

**Reference Materials**:
- Template Documentation: [PRPs/templates/meta_prp_structure.md](../../templates/meta_prp_structure.md)
- ED Philosophy: [executive-dysfunction-philosophy.md](../executive-dysfunction-philosophy.md)
- Git Strategy: [git-worktree-strategy.md](../git-worktree-strategy.md)
- Enhanced Context: [enhanced-context-references.md](../enhanced-context-references.md)
- Testing Strategy: [comprehensive-testing-strategy.md](../comprehensive-testing-strategy.md)
- GitHub Issues: [github-issues/README.md](../github-issues/README.md)

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
  title="Vespera-Scriptorium Critical Fixes Meta-PRP Coordination" \
  description="Multi-agent coordination for vespera-scriptorium critical fixes meta-PRP execution" \
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
1. Start with Priority 1: [01-critical-system-bugs/index.md](../01-critical-system-bugs/index.md)
2. Follow systematic approach through all priorities
3. Use orchestrator coordination throughout
4. Maintain momentum with regular progress updates

---

**Meta-PRP Philosophy**: *Every complex multi-phase project benefits from systematic, orchestrated, executive dysfunction-aware coordination.*