# Fix Python Commands in CI Pipeline

**Task ID**: `ci-python-commands`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 15 minutes  
**Priority**: 🔴 Critical  
**Complexity**: trivial
**GitHub Issue**: #16

## Objective

Update all Python commands in `.github/workflows/ci.yml` to use `python3` for Ubuntu runner compatibility, with fallback to `python` if needed.

## Context

**Background**: CI pipeline failing because Ubuntu runners use `python3` command, not `python`.

**Relationship to Priority**: Core fix for CI/CD pipeline functionality.

**Dependencies**:
- Requires: Access to workflow files
- Provides to: All subsequent CI runs

## Inputs

**Required Files/Data**:
- File: `.github/workflows/ci.yml`
- Current failing commands using `python`

**Context Information**:
- Ubuntu runners require `python3` command
- Need fallback for environments with `python` command

## Expected Outputs

**Primary Deliverables**:
- Updated ci.yml with `python3` commands
- Fallback logic for compatibility

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] All `python` commands updated to `python3 || python`
- [ ] Virtual environment creation uses `python3 -m venv`
- [ ] Package installation uses correct Python version
- [ ] Workflow syntax remains valid

**Validation Commands**:
```bash
# Validate YAML syntax
yamllint .github/workflows/ci.yml

# Test locally if possible
act -j ci-cd
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Fix Python commands in GitHub Actions CI workflow for Ubuntu compatibility.

TASK: Replace all Python commands with python3 and add fallback.

INPUT: 
File: .github/workflows/ci.yml
Current commands use: python
Need to use: python3 with fallback to python

PATTERN TO APPLY:
# Before
python -m venv venv
python -m pip install

# After
python3 -m venv venv || python -m venv venv
python3 -m pip install || python -m pip install

OUTPUT_FORMAT: Updated workflow YAML with all Python commands fixed.

VALIDATION: YAML must remain valid, all python commands must have python3 primary.
```

## Agent Instructions

**Execution Steps**:
1. Read `.github/workflows/ci.yml`
2. Identify all `python` command instances
3. Replace with `python3 || python` pattern
4. Ensure virtual environment commands updated
5. Validate YAML syntax
6. Store results in orchestrator

---

**Navigation**:
- ← Back to [Category Overview](README.md)
- → Next Task: [02-fix-workflow-paths.md](02-fix-workflow-paths.md)
- ↑ Priority: [../../index.md](../../index.md)