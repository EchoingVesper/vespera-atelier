# Git Worktree Strategy - {PROJECT_NAME}

**Application**: {PROJECT_NAME} Meta-PRP  
**Strategy**: {Isolation/Sequential/Hybrid}  
**Last Updated**: {DATE}

## Overview

This meta-PRP uses git worktrees to enable **{strategy description}** execution of priority areas.

**Benefits for This Project**:

- {Specific benefit 1 for this project}
- {Specific benefit 2 for this project}  
- {Specific benefit 3 for this project}

## Worktree Architecture

### Directory Structure

```directory
{project-root}/                    # Main repository
├── PRPs/{project-name}/          # This meta-PRP
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

- `feature/{project}-priority-1` - Priority 1 work
- `feature/{project}-priority-2` - Priority 2 work
- `feature/{project}-priority-3` - Priority 3 work
- `feature/{project}-priority-4` - Priority 4 work

## Implementation Commands

### Initial Setup

```bash
# From main repository root
cd {project-root}

# Verify clean working directory
git status
# Should show clean working directory before creating worktrees
```

### Worktree Creation

**Priority 1 Worktree**:

```bash
git worktree add ../worktrees/agent-priority-1 -b feature/{project}-priority-1
echo "✅ Created Priority 1 worktree: ../worktrees/agent-priority-1"
```

**Priority 2 Worktree**:

```bash
git worktree add ../worktrees/agent-priority-2 -b feature/{project}-priority-2
echo "✅ Created Priority 2 worktree: ../worktrees/agent-priority-2"
```

**Priority 3 Worktree**:

```bash
git worktree add ../worktrees/agent-priority-3 -b feature/{project}-priority-3
echo "✅ Created Priority 3 worktree: ../worktrees/agent-priority-3"
```

**Priority 4 Worktree**:

```bash
git worktree add ../worktrees/agent-priority-4 -b feature/{project}-priority-4  
echo "✅ Created Priority 4 worktree: ../worktrees/agent-priority-4"
```

### Verification

```bash
# List all worktrees
git worktree list

# Should show:
# {project-root}                          {commit-hash} [main]
# ../worktrees/agent-priority-1           {commit-hash} [feature/{project}-priority-1]
# ../worktrees/agent-priority-2           {commit-hash} [feature/{project}-priority-2] 
# ../worktrees/agent-priority-3           {commit-hash} [feature/{project}-priority-3]
# ../worktrees/agent-priority-4           {commit-hash} [feature/{project}-priority-4]
```

## Agent Execution Patterns

### Priority 1 Agent

**Working Directory**: `../worktrees/agent-priority-1`

**Agent Instructions**:

```bash
# Navigate to isolated worktree
cd ../worktrees/agent-priority-1

# Verify correct branch and isolation
git branch
# Should show: * feature/{project}-priority-1

# Work in complete isolation - no conflicts with other agents
# All Priority 1 work happens here

# Auto-preserve work frequently (executive dysfunction support)
git add -A && git commit -m "WIP: Priority 1 progress $(date +%Y%m%d-%H%M%S)"

# When major milestone reached
git add -A && git commit -m "feat(priority-1): {milestone description}"

# Final commit when priority complete
git add -A && git commit -m "feat({project}): complete Priority 1 - {summary}"
```

### Priority 2 Agent

**Working Directory**: `../worktrees/agent-priority-2`

**Agent Instructions**:

```bash
# Navigate to isolated worktree  
cd ../worktrees/agent-priority-2

# Same patterns as Priority 1, but in complete isolation
# No conflicts possible with Priority 1 agent work
```

### Priority 3 Agent

**Working Directory**: `../worktrees/agent-priority-3`

**Agent Instructions**: {Similar pattern, isolated workspace}

### Priority 4 Agent

**Working Directory**: `../worktrees/agent-priority-4`

**Agent Instructions**: {Similar pattern, isolated workspace}

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

**Priority 1 Integration**:

```bash
# From main repository
cd {project-root}

# Review Priority 1 work before integration
git log feature/{project}-priority-1 --oneline

# Merge when ready
git merge feature/{project}-priority-1
git tag "milestone-priority-1-complete"
```

**Priority 2 Integration** (after Priority 1):

```bash
# Integrate Priority 2 work
git merge feature/{project}-priority-2
git tag "milestone-priority-2-complete"
```

### Parallel Integration (Advanced)

{Only if priorities are truly independent}

```bash
# Integration order based on completion, not priority number
# Merge any completed priority when ready
git merge feature/{project}-priority-{completed}
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
cd {project-root}

# Clean up worktrees  
git worktree remove ../worktrees/agent-priority-1
git worktree remove ../worktrees/agent-priority-2
git worktree remove ../worktrees/agent-priority-3
git worktree remove ../worktrees/agent-priority-4

# Optional: Clean up feature branches
git branch -d feature/{project}-priority-1
git branch -d feature/{project}-priority-2
git branch -d feature/{project}-priority-3
git branch -d feature/{project}-priority-4

# Create final tag
git tag "{project}-meta-prp-complete"
```

### Emergency Cleanup

```bash
# If meta-PRP needs to be abandoned
git worktree remove ../worktrees/agent-priority-1 --force
git worktree remove ../worktrees/agent-priority-2 --force  
git worktree remove ../worktrees/agent-priority-3 --force
git worktree remove ../worktrees/agent-priority-4 --force

# Force delete branches if needed
git branch -D feature/{project}-priority-1
git branch -D feature/{project}-priority-2
git branch -D feature/{project}-priority-3
git branch -D feature/{project}-priority-4
```

## Monitoring and Status

### Worktree Health Check

```bash
# Verify all worktrees healthy
git worktree list
# Check each worktree status
for worktree in agent-priority-1 agent-priority-2 agent-priority-3 agent-priority-4; do
    echo "=== $worktree ==="
    cd ../worktrees/$worktree 2>/dev/null && git status || echo "Worktree not found"
    cd - >/dev/null
done
```

### Progress Tracking

```bash
# Check progress across all worktrees
for priority in 1 2 3 4; do
    echo "=== Priority $priority Progress ==="
    cd ../worktrees/agent-priority-$priority 2>/dev/null && git log --oneline -5 || echo "No worktree"
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
git branch -D feature/{project}-priority-{N}  # If branch exists
```

**Issue**: Agent can't find worktree  
**Cause**: Path confusion or worktree removed  
**Solution**:

```bash
git worktree list  # Verify worktree exists
cd ../worktrees/agent-priority-{N} || echo "Worktree missing"
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
