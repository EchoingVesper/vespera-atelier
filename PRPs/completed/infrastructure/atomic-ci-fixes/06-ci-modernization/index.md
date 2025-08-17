# Priority 6: CI/CD Modernization

**Parent Task ID**: `{parent_task_id}`  
**Priority**: Medium  
**Status**: [TODO]  
**Estimated Duration**: 1.5 hours  
**Specialist Type**: devops  
**Local LLM Ready**: ✅ High

## Problem Statement

**Issue**: CI workflows use npm while project uses pnpm, creating maintenance burden and package lock file conflicts

**Impact**: Maintaining both package-lock.json and pnpm-lock.yaml files, slower CI builds, inconsistent package management

**Context**: Issue #23 identifies CI/package manager inconsistency

## Executive Dysfunction Design Focus

**Lid Weight Impact**: Clear workflow migration patterns with exact replacements
**Momentum Preservation**: Migrate workflows one at a time with testing
**Pressure Delegation**: Each workflow file updated independently
**Damage Prevention**: Test workflows in PR before affecting main branch

## Detailed Requirements

### Functional Requirements

- Convert all GitHub Actions workflows from npm to pnpm
- Remove dependency on package-lock.json files
- Maintain faster CI build times with pnpm
- Ensure workspace support for monorepo

### Technical Requirements

- Replace `npm ci` with `pnpm install --frozen-lockfile`
- Add pnpm setup action to all workflows
- Update all workflow files consistently
- Remove generated package-lock.json files

### Quality Requirements

- All workflows must pass with pnpm
- Build times should improve
- No more dual package manager maintenance
- Consistent package management across project

## Subtasks Overview

### Task Categories

**00-workflow-conversion**: Convert GitHub Actions to pnpm
- Purpose: Update all workflow files to use pnpm instead of npm
- LLM Ready: ✅
- Tasks: 4 atomic tasks (one per workflow file)

**01-cleanup-npm-artifacts**: Remove npm artifacts
- Purpose: Clean up package-lock.json files and npm references
- LLM Ready: ✅
- Tasks: 2 atomic tasks

## Success Criteria

**Completion Requirements**:
- [ ] All GitHub Actions workflows use pnpm
- [ ] No npm ci commands remain in workflows
- [ ] All workflows pass in CI
- [ ] Package-lock.json files removed where not needed
- [ ] All subtasks completed
- [ ] Integration testing successful

**Quality Gates**:
- [ ] CI workflows complete successfully
- [ ] Build times improved
- [ ] No package manager conflicts
- [ ] Monorepo workspace support working

**Deliverables**:
- Updated .github/workflows/*.yml files
- Removed unnecessary package-lock.json files
- Documentation updates for package management
- Orchestrator artifacts with migration details

## Orchestrator Integration

**Create Priority Task**:
```bash
orchestrator_plan_task \
  title="CI/CD Modernization - npm to pnpm Migration" \
  description="Convert all GitHub Actions workflows from npm to pnpm for consistency and performance" \
  complexity="moderate" \
  task_type="enhancement" \
  specialist_type="devops" \
  parent_task_id="{parent_task_id}"
```

## Agent Coordination

**Primary Specialist**: DevOps (CI/CD workflow management)
**Supporting Specialists**: None required (straightforward conversion)
**Coordination Pattern**: Sequential - test each workflow conversion independently

## Local LLM Integration

**Automation Potential**: High
**LLM-Ready Tasks**: 6 of 6 tasks ready for local LLM execution
**Prompt Templates**: Simple find-and-replace patterns for workflow conversion
**Validation Approach**: GitHub Actions test runs with pnpm

## Tracking

**Progress Checklist**: [tracking/checklist.md](tracking/checklist.md)  
**Session Logs**: [tracking/session-logs/](tracking/session-logs/)  
**Artifacts**: Referenced in orchestrator task completion

---

**Navigation**:
- ← Back to [Main Coordination](../00-main-coordination/index.md)
- ← Previous Priority: [05-python-testing-fixes/index.md](../05-python-testing-fixes/index.md)
- 📋 Master Checklist: [../00-main-coordination/tracking/checklist.md](../00-main-coordination/tracking/checklist.md)