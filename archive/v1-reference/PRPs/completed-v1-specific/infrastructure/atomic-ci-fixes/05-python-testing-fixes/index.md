# Priority 5: Python Testing & Configuration Fixes

**Parent Task ID**: `{parent_task_id}`  
**Priority**: Critical  
**Status**: [TODO]  
**Estimated Duration**: 2 hours  
**Specialist Type**: python_developer  
**Local LLM Ready**: ✅ High

## Problem Statement

**Issue**: Multiple Python-related failures including 104 failing unit tests, pyproject.toml configuration warnings, and orchestrator status bugs

**Impact**: Core vespera-scriptorium functionality is broken, affecting development and CI reliability

**Context**: Issues #20, #21, #22 identify critical Python environment and testing problems

## Executive Dysfunction Design Focus

**Lid Weight Impact**: Pre-structured fixes with specific test commands
**Momentum Preservation**: Fix tests incrementally to maintain progress visibility  
**Pressure Delegation**: Each test module fixed independently
**Damage Prevention**: Test fixes validated before merge

## Detailed Requirements

### Functional Requirements

- All unit tests must pass (currently 104 failures)
- pyproject.toml configuration warnings resolved
- orchestrator_get_status must return correct data
- Python package builds cleanly without warnings

### Technical Requirements

- Fix import issues (GenericTaskRepository)
- Update constructor signatures (StaleTaskDetector)
- Resolve pyproject.toml metadata conflicts
- Ensure test isolation and repeatability

### Quality Requirements

- Zero test failures in CI
- Clean package build process
- Proper error handling in orchestrator tools
- No configuration warnings

## Subtasks Overview

### Task Categories

**00-unit-test-fixes**: Critical Unit Test Failures
- Purpose: Fix 104 failing unit tests 
- LLM Ready: ✅
- Tasks: 4 atomic tasks (by test module category)

**01-orchestrator-bug-fixes**: Orchestrator Status Bug
- Purpose: Fix orchestrator_get_status returning incorrect data
- LLM Ready: ✅
- Tasks: 2 atomic tasks

**02-package-configuration**: Python Package Configuration
- Purpose: Fix pyproject.toml warnings and build issues
- LLM Ready: ✅
- Tasks: 2 atomic tasks

## Success Criteria

**Completion Requirements**:
- [ ] All unit tests pass (0 failures)
- [ ] orchestrator_get_status returns correct data
- [ ] pyproject.toml builds without warnings
- [ ] Package installs cleanly in CI
- [ ] All subtasks completed
- [ ] Integration testing successful

**Quality Gates**:
- [ ] pytest tests/unit/ -q shows 0 failures
- [ ] python -m build produces no warnings
- [ ] orchestrator health check passes
- [ ] CI Python workflows green

**Deliverables**:
- Fixed test files with corrected imports
- Updated constructor calls throughout codebase
- Clean pyproject.toml configuration
- Working orchestrator status functionality
- Orchestrator artifacts with fix details

## Orchestrator Integration

**Create Priority Task**:
```bash
orchestrator_plan_task \
  title="Python Testing & Configuration Fixes" \
  description="Fix critical unit test failures, orchestrator bugs, and package configuration" \
  complexity="complex" \
  task_type="debugging" \
  specialist_type="python_developer" \
  parent_task_id="{parent_task_id}"
```

## Agent Coordination

**Primary Specialist**: Python Developer (testing and package management)
**Supporting Specialists**: Tester (test validation)
**Coordination Pattern**: Sequential - fix critical tests first, then configuration

## Local LLM Integration

**Automation Potential**: High
**LLM-Ready Tasks**: 8 of 8 tasks ready for local LLM execution
**Prompt Templates**: Specific error patterns with known fixes
**Validation Approach**: Automated test execution with clear pass/fail

## Tracking

**Progress Checklist**: [tracking/checklist.md](tracking/checklist.md)  
**Session Logs**: [tracking/session-logs/](tracking/session-logs/)  
**Artifacts**: Referenced in orchestrator task completion

---

**Navigation**:
- ← Back to [Main Coordination](../00-main-coordination/index.md)
- → Next Priority: [06-ci-modernization/index.md](../06-ci-modernization/index.md)
- 📋 Master Checklist: [../00-main-coordination/tracking/checklist.md](../00-main-coordination/tracking/checklist.md)