# Git Worktree Strategy - Vespera-Scriptorium Critical Fixes

**Application**: Vespera-Scriptorium Critical Fixes Meta-PRP  
**Strategy**: Isolation with Sequential Integration  
**Last Updated**: 2025-08-16

## Overview

This meta-PRP uses git worktrees to enable **isolated parallel development** execution of priority areas.

**Benefits for This Project**:
- **Parallel bug fixing**: 4 critical system bugs can be fixed simultaneously without conflicts
- **Safe experimentation**: Handler migration fixes can be tested in isolation without breaking working tools
- **Executive dysfunction support**: Each agent has isolated context reducing cognitive overwhelm

## Worktree Architecture

### Directory Structure

```directory
/home/aya/dev/monorepo/vespera-atelier/  # Main repository
├── PRPs/in-progress/vespera-scriptorium-critical-fixes/  # This meta-PRP
│
../worktrees/                     # Worktree container (outside main repo)
├── agent-priority-1/             # Priority 1 isolated workspace
│   └── [complete repo copy]      # Full repo on feature/priority-1 branch
├── agent-priority-2/             # Priority 2 isolated workspace  
│   └── [complete repo copy]      # Full repo on feature/priority-2 branch
├── agent-priority-3/             # Priority 3 isolated workspace
│   └── [complete repo copy]      # Full repo on feature/priority-3 branch
└── agent-priority-4/             # Priority 4 isolated workspace
    └── [complete repo copy]      # Full repo on feature/priority-4 branch
```

### Branch Strategy

**Main Branch**: `main` - remains stable throughout execution
**Feature Branches**: 
- `feature/vespera-critical-fixes-priority-1` - Critical system bugs (watchfiles, handler migration, lookup failures, template instantiation)
- `feature/vespera-critical-fixes-priority-2` - Workflow-critical bugs (query arrays, missing tool registration)
- `feature/vespera-critical-fixes-priority-3` - Architecture implementation (background automation, validation hooks, production readiness)
- `feature/vespera-critical-fixes-priority-4` - Integration testing and validation

## Implementation Commands

### Initial Setup

```bash
# From main repository root
cd /home/aya/dev/monorepo/vespera-atelier

# Verify clean working directory
git status
# Should show clean working directory before creating worktrees
```

### Worktree Creation

**Priority 1 Worktree (Critical System Bugs)**:
```bash
git worktree add ../worktrees/agent-critical-bugs -b feature/vespera-critical-fixes-priority-1
echo "✅ Created Priority 1 worktree: ../worktrees/agent-critical-bugs"
```

**Priority 2 Worktree (Workflow-Critical Bugs)**:
```bash
git worktree add ../worktrees/agent-workflow-bugs -b feature/vespera-critical-fixes-priority-2
echo "✅ Created Priority 2 worktree: ../worktrees/agent-workflow-bugs"
```

**Priority 3 Worktree (Architecture Implementation)**:
```bash
git worktree add ../worktrees/agent-architecture -b feature/vespera-critical-fixes-priority-3
echo "✅ Created Priority 3 worktree: ../worktrees/agent-architecture"
```

**Priority 4 Worktree (Integration Testing)**:
```bash
git worktree add ../worktrees/agent-integration -b feature/vespera-critical-fixes-priority-4  
echo "✅ Created Priority 4 worktree: ../worktrees/agent-integration"
```

### Verification

```bash
# List all worktrees
git worktree list

# Should show:
# /home/aya/dev/monorepo/vespera-atelier  {commit-hash} [main]
# ../worktrees/agent-critical-bugs        {commit-hash} [feature/vespera-critical-fixes-priority-1]
# ../worktrees/agent-workflow-bugs        {commit-hash} [feature/vespera-critical-fixes-priority-2] 
# ../worktrees/agent-architecture         {commit-hash} [feature/vespera-critical-fixes-priority-3]
# ../worktrees/agent-integration          {commit-hash} [feature/vespera-critical-fixes-priority-4]
```

## Agent Execution Patterns

### Priority 1 Agent (Critical System Bugs)

**Working Directory**: `../worktrees/agent-critical-bugs`  
**Focus**: Fix 4 critical system bugs - watchfiles dependency, handler migration data mapping, task/session lookup failures, template instantiation

**Agent Instructions**:
```bash
# Navigate to isolated worktree
cd ../worktrees/agent-critical-bugs

# Verify correct branch and isolation
git branch
# Should show: * feature/vespera-critical-fixes-priority-1

# Work in complete isolation - no conflicts with other agents
# All critical system bug fixes happen here

# Auto-preserve work frequently (executive dysfunction support)
git add -A && git commit -m "WIP: Critical bugs progress $(date +%Y%m%d-%H%M%S)"

# When major milestone reached
git add -A && git commit -m "fix(critical): resolve watchfiles dependency issue"
git add -A && git commit -m "fix(handlers): resolve data mapping in migration system"
git add -A && git commit -m "fix(lookup): resolve task/session lookup failures"
git add -A && git commit -m "fix(templates): resolve template instantiation system"

# Final commit when priority complete
git add -A && git commit -m "fix(vespera-scriptorium): complete Priority 1 - all critical system bugs resolved"
```

### Priority 2 Agent (Workflow-Critical Bugs)

**Working Directory**: `../worktrees/agent-workflow-bugs`  
**Focus**: Fix 2 workflow-critical bugs - query tasks array parameters, missing tool registration

**Agent Instructions**:
```bash
# Navigate to isolated worktree  
cd ../worktrees/agent-workflow-bugs

# Verify correct branch
git branch
# Should show: * feature/vespera-critical-fixes-priority-2

# Focus on workflow-critical fixes in isolation
git add -A && git commit -m "fix(query): resolve array parameter conversion in orchestrator_query_tasks"
git add -A && git commit -m "feat(tools): add missing orchestrator_create_generic_task registration"

# Final commit when priority complete
git add -A && git commit -m "fix(vespera-scriptorium): complete Priority 2 - workflow-critical bugs resolved"
```

### Priority 3 Agent (Architecture Implementation)

**Working Directory**: `../worktrees/agent-architecture`  
**Focus**: Implement background automation system, validation hooks, replace TODO placeholders

**Agent Instructions**:
```bash
cd ../worktrees/agent-architecture
git branch  # Should show: * feature/vespera-critical-fixes-priority-3

# Architecture implementation commits
git add -A && git commit -m "feat(automation): implement background automation system"
git add -A && git commit -m "feat(validation): implement validation hooks system"
git add -A && git commit -m "refactor(production): replace TODO placeholders with real implementations"

# Final commit
git add -A && git commit -m "feat(vespera-scriptorium): complete Priority 3 - architecture improvements implemented"
```

### Priority 4 Agent (Integration Testing)

**Working Directory**: `../worktrees/agent-integration`  
**Focus**: Comprehensive testing, validation of 90%+ success rate, GitHub issue resolution

**Agent Instructions**:
```bash
cd ../worktrees/agent-integration
git branch  # Should show: * feature/vespera-critical-fixes-priority-4

# Integration and testing commits
git add -A && git commit -m "test(comprehensive): validate all 32 MCP tools after fixes"
git add -A && git commit -m "test(integration): verify 90%+ tool success rate achieved"
git add -A && git commit -m "docs(completion): close GitHub issues with validation artifacts"

# Final commit
git add -A && git commit -m "test(vespera-scriptorium): complete Priority 4 - comprehensive validation successful"
```

## Executive Dysfunction Support

### Auto-Preservation Pattern

**Problem**: Work loss due to interruptions or overwhelm  
**Solution**: Frequent automatic commits

```bash
# Agent script for auto-preservation (run every 30 minutes)
cd ../worktrees/agent-{priority}
git add -A && git commit -m "WIP: Auto-save $(date +%Y%m%d-%H%M%S)" || echo "Nothing to commit"
```

### Context Isolation Benefits

**Problem**: Overwhelming complexity from seeing all concurrent work  
**Solution**: Each agent sees only their priority context

```bash
# Agent only sees their specific priority work
cd ../worktrees/agent-priority-1
ls
# Shows only the state relevant to Priority 1, not other priorities
```

### Safe Experimentation

**Problem**: Fear of breaking things prevents progress  
**Solution**: Isolated worktrees can be discarded safely

```bash
# If Priority 2 work goes wrong, safely discard
git worktree remove ../worktrees/agent-priority-2
git branch -D feature/{project}-priority-2

# Start over without affecting other work
git worktree add ../worktrees/agent-priority-2 -b feature/{project}-priority-2
```

## Integration Strategy

### Sequential Integration (Recommended)

**Priority 1 Integration (Critical System Bugs)**:
```bash
# From main repository
cd /home/aya/dev/monorepo/vespera-atelier

# Review Priority 1 work before integration
git log feature/vespera-critical-fixes-priority-1 --oneline

# Merge when ready (all 4 critical system bugs fixed)
git merge feature/vespera-critical-fixes-priority-1
git tag "vespera-critical-bugs-fixed"
```

**Priority 2 Integration** (after Priority 1):
```bash
# Integrate Priority 2 work (workflow-critical bugs)
git merge feature/vespera-critical-fixes-priority-2
git tag "vespera-workflow-bugs-fixed"
```

**Priority 3 Integration** (after Priority 2):
```bash
# Integrate Priority 3 work (architecture implementation)
git merge feature/vespera-critical-fixes-priority-3
git tag "vespera-architecture-implemented"
```

**Priority 4 Integration** (final):
```bash
# Integrate Priority 4 work (comprehensive testing)
git merge feature/vespera-critical-fixes-priority-4
git tag "vespera-critical-fixes-complete"
```

### Parallel Integration (Advanced)

{Only if priorities are truly independent}

```bash
# Integration order based on completion, not priority number
# Merge any completed priority when ready
git merge feature/vespera-critical-fixes-priority-{completed}
```

## Conflict Resolution

### Prevention Strategy

**Isolation**: Worktrees prevent most conflicts by keeping work separate

**Communication**: Agents coordinate through orchestrator artifacts, not shared files

**Staged Integration**: Merge one priority at a time to identify conflicts early

### Resolution Process

**If Conflicts Occur During Integration**:
```bash
# Standard git conflict resolution
git merge feature/{project}-priority-{N}
# Resolve conflicts in files
git add {resolved-files}
git commit -m "merge: integrate Priority {N} with conflict resolution"
```

## Cleanup and Finalization

### Successful Completion

```bash
# After all priorities integrated successfully
cd /home/aya/dev/monorepo/vespera-atelier

# Clean up worktrees  
git worktree remove ../worktrees/agent-critical-bugs
git worktree remove ../worktrees/agent-workflow-bugs
git worktree remove ../worktrees/agent-architecture
git worktree remove ../worktrees/agent-integration

# Optional: Clean up feature branches
git branch -d feature/vespera-critical-fixes-priority-1
git branch -d feature/vespera-critical-fixes-priority-2
git branch -d feature/vespera-critical-fixes-priority-3
git branch -d feature/vespera-critical-fixes-priority-4

# Create final tag
git tag "vespera-scriptorium-critical-fixes-complete"
```

### Emergency Cleanup

```bash
# If meta-PRP needs to be abandoned
git worktree remove ../worktrees/agent-critical-bugs --force
git worktree remove ../worktrees/agent-workflow-bugs --force  
git worktree remove ../worktrees/agent-architecture --force
git worktree remove ../worktrees/agent-integration --force

# Force delete branches if needed
git branch -D feature/vespera-critical-fixes-priority-1
git branch -D feature/vespera-critical-fixes-priority-2
git branch -D feature/vespera-critical-fixes-priority-3
git branch -D feature/vespera-critical-fixes-priority-4
```

## Monitoring and Status

### Worktree Health Check

```bash
# Verify all worktrees healthy
git worktree list
# Check each worktree status
for worktree in agent-critical-bugs agent-workflow-bugs agent-architecture agent-integration; do
    echo "=== $worktree ==="
    cd ../worktrees/$worktree 2>/dev/null && git status || echo "Worktree not found"
    cd - >/dev/null
done
```

### Progress Tracking

```bash
# Check progress across all worktrees
worktrees=("agent-critical-bugs:Critical System Bugs" "agent-workflow-bugs:Workflow-Critical Bugs" "agent-architecture:Architecture Implementation" "agent-integration:Integration Testing")
for worktree_info in "${worktrees[@]}"; do
    worktree=${worktree_info%%:*}
    description=${worktree_info##*:}
    echo "=== $description Progress ==="
    cd ../worktrees/$worktree 2>/dev/null && git log --oneline -5 || echo "No worktree"
    cd - >/dev/null
done
```

## Troubleshooting

### Common Issues

**Issue**: Worktree creation fails  
**Cause**: Dirty working directory or existing branch  
**Solution**: 
```bash
git status  # Check for uncommitted changes
git stash   # If needed
git branch -D feature/vespera-critical-fixes-priority-{N}  # If branch exists
```

**Issue**: Agent can't find worktree  
**Cause**: Path confusion or worktree removed  
**Solution**:
```bash
git worktree list  # Verify worktree exists
cd ../worktrees/agent-{critical-bugs|workflow-bugs|architecture|integration} || echo "Worktree missing"
```

**Issue**: Integration conflicts  
**Cause**: Overlapping changes between priorities  
**Solution**: Sequential integration with careful conflict resolution

## Benefits Achieved

### For Executive Dysfunction
- **Isolation**: Reduces cognitive overwhelm from multiple contexts
- **Safety**: Enables experimentation without fear of breaking things
- **Momentum**: Auto-preservation prevents work loss
- **Recovery**: Easy rollback if priorities go wrong

### For Multi-Agent Coordination  
- **Parallelism**: Multiple agents work simultaneously without conflicts
- **Independence**: Each agent has complete autonomy in their workspace
- **Integration**: Controlled merge process maintains code quality
- **Tracking**: Clear visibility into each agent's progress

---

**Remember**: Worktrees are a safety mechanism that enables confident parallel development while maintaining the ability to integrate or discard work as needed.