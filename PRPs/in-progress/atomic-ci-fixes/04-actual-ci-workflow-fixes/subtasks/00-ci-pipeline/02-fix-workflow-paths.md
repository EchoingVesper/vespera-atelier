# Fix Workflow Paths in CI Pipeline

**Task ID**: `ci-workflow-paths`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 10 minutes  
**Priority**: 🔴 Critical  
**Complexity**: trivial
**GitHub Issue**: #16

## Objective

Fix path resolution issues in `.github/workflows/ci.yml` to ensure workflows can find and execute monorepo package scripts correctly.

## Context

**Background**: CI pipeline failing because workflows reference incorrect paths or don't account for monorepo structure.

**Relationship to Priority**: Essential for CI/CD pipeline functionality.

**Dependencies**:
- Requires: Python commands fix (01-fix-python-commands.md)
- Provides to: All CI workflow steps

## Inputs

**Required Files/Data**:
- File: `.github/workflows/ci.yml`
- Current failing path references

**Context Information**:
- Monorepo structure with packages/* subdirectories
- pnpm workspace configuration
- Virtual environment paths

## Expected Outputs

**Primary Deliverables**:
- Updated ci.yml with correct paths
- Working directory changes for monorepo
- Proper package script execution

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] All paths resolve correctly in CI environment
- [ ] Package scripts execute from correct directories
- [ ] Virtual environment paths are correct
- [ ] Workflow steps complete successfully

**Validation Commands**:
```bash
# Validate workflow paths locally
cd packages/vespera-scriptorium && pwd
ls -la venv/bin/

# Test package script execution
cd packages/vespera-scriptorium && npm run test:scriptorium
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Fix path resolution in GitHub Actions CI workflow for monorepo structure.

TASK: Update paths in workflow to work with packages/ subdirectories and virtual environments.

INPUT: 
File: .github/workflows/ci.yml
Current structure: packages/vespera-scriptorium with venv/
Need to ensure: Correct working-directory and path references

PATTERN TO APPLY:
# Before
working-directory: ./
./venv/bin/python

# After  
working-directory: ./packages/vespera-scriptorium
./venv/bin/python (same, but from correct directory)

OUTPUT_FORMAT: Updated workflow YAML with corrected paths and working directories.

VALIDATION: All paths must be relative to monorepo root or use correct working-directory.
```

## Agent Instructions

**Execution Steps**:
1. Read `.github/workflows/ci.yml`
2. Identify path resolution issues
3. Add working-directory specifications where needed
4. Update relative paths for monorepo structure
5. Validate workflow syntax
6. Store results in orchestrator

---

**Navigation**:
- ← Previous Task: [01-fix-python-commands.md](01-fix-python-commands.md)
- → Next Category: [../01-quality-workflow/](../01-quality-workflow/)
- ↑ Priority: [../../index.md](../../index.md)