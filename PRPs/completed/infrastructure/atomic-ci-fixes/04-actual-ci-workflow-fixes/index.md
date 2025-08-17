# Priority 4: Actual CI Workflow Fixes

**Parent Task ID**: `{parent_task_id}`  
**Priority**: Critical  
**Status**: [TODO]  
**Estimated Duration**: 1 hour  
**Specialist Type**: devops  
**Local LLM Ready**: ✅ High

## Problem Statement

**Issue**: CI/CD workflows are failing in GitHub Actions due to incorrect Python commands, missing dependencies, and path resolution issues

**Impact**: All CI checks fail on PRs, preventing merge even when fixes are correct. Development workflow blocked.

**Context**: Test runs show failures in ci.yml, quality.yml, health-check.yml, and release.yml workflows

## Executive Dysfunction Design Focus

**Lid Weight Impact**: Pre-structured workflow fixes with exact command replacements
**Momentum Preservation**: Atomic fixes that can be tested individually  
**Pressure Delegation**: Each workflow fixed independently
**Damage Prevention**: All changes testable in PR before merge

## Detailed Requirements

### Functional Requirements

- CI/CD workflows must pass on GitHub Actions
- Python commands must work in Ubuntu runners
- All paths must resolve correctly
- Dependencies must be installed properly

### Technical Requirements

- Use `python3` command for Ubuntu compatibility
- Fix all workflow file paths
- Ensure virtual environment creation works
- Add proper error handling

### Quality Requirements

- All workflows must have green checks
- Error messages must be clear
- Workflows must be idempotent

## Subtasks Overview

### Task Categories

**00-ci-workflow**: Main CI/CD Pipeline Fix
- Purpose: Fix the main CI workflow that runs tests
- LLM Ready: ✅
- Tasks: 1 atomic task

**01-quality-workflow**: Quality Checks Workflow Fix  
- Purpose: Fix linting and quality checks
- LLM Ready: ✅
- Tasks: 1 atomic task

**02-health-check-workflow**: Health Check Workflow Fix
- Purpose: Fix health check validations
- LLM Ready: ✅
- Tasks: 1 atomic task

**03-release-workflow**: Release Build Workflow Fix
- Purpose: Fix release build process
- LLM Ready: ✅
- Tasks: 1 atomic task

## Success Criteria

**Completion Requirements**:
- [ ] All GitHub Actions workflows pass
- [ ] Python environment properly configured
- [ ] Paths resolve correctly
- [ ] Dependencies install successfully
- [ ] All subtasks completed
- [ ] Integration testing successful

**Quality Gates**:
- [ ] CI/CD Pipeline shows green check
- [ ] Quality Checks pass without errors
- [ ] Health Check validates successfully
- [ ] Release workflow builds correctly

**Deliverables**:
- Fixed .github/workflows/ci.yml
- Fixed .github/workflows/quality.yml
- Fixed .github/workflows/health-check.yml
- Fixed .github/workflows/release.yml
- Orchestrator artifacts with implementation details

## Orchestrator Integration

**Create Priority Task**:
```bash
orchestrator_plan_task \
  title="Actual CI Workflow Fixes" \
  description="Fix failing GitHub Actions workflows with Python compatibility and path fixes" \
  complexity="moderate" \
  task_type="implementation" \
  specialist_type="devops" \
  parent_task_id="{parent_task_id}"
```

## Agent Coordination

**Primary Specialist**: DevOps (CI/CD workflow configuration)
**Supporting Specialists**: None required (atomic fixes)
**Coordination Pattern**: Sequential - test each workflow fix independently

## Local LLM Integration

**Automation Potential**: High
**LLM-Ready Tasks**: 4 of 4 tasks ready for local LLM execution
**Prompt Templates**: Simple find-and-replace patterns
**Validation Approach**: GitHub Actions test runs

## Tracking

**Progress Checklist**: [tracking/checklist.md](tracking/checklist.md)  
**Session Logs**: [tracking/session-logs/](tracking/session-logs/)  
**Artifacts**: Referenced in orchestrator task completion

---

**Navigation**:
- ← Back to [Main Coordination](../00-main-coordination/index.md)
- → Next Priority: [05-python-environment-compatibility/index.md](../05-python-environment-compatibility/index.md)
- 📋 Master Checklist: [../00-main-coordination/tracking/checklist.md](../00-main-coordination/tracking/checklist.md)