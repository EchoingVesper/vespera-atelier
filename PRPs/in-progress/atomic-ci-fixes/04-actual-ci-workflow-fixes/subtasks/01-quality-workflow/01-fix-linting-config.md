# Fix Linting Configuration in Quality Workflow

**Task ID**: `quality-linting-fix`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 20 minutes  
**Priority**: 🔴 Critical  
**Complexity**: simple
**GitHub Issue**: #17

## Objective

Fix linting configuration in `.github/workflows/quality.yml` to ensure Python linting tools (flake8, mypy, black, isort) work correctly with the monorepo structure and virtual environments.

## Context

**Background**: Quality checks workflow failing because linting tools can't find modules or configurations are incorrect for the monorepo structure.

**Relationship to Priority**: Essential for code quality gates.

**Dependencies**:
- Requires: Python environment setup from CI pipeline fixes
- Provides to: Quality gate validation

## Inputs

**Required Files/Data**:
- File: `.github/workflows/quality.yml`
- Linting configuration files (if any)
- Package structure in `packages/vespera-scriptorium`

**Context Information**:
- Python package structure
- Virtual environment paths
- Linting tool configuration requirements

## Expected Outputs

**Primary Deliverables**:
- Updated quality.yml with correct linting setup
- Proper virtual environment usage for linting
- Working directory configuration for monorepo

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] flake8 linting passes without module resolution errors
- [ ] mypy type checking finds all modules correctly
- [ ] black formatting check works from correct directory
- [ ] isort import sorting validation passes
- [ ] All tools use virtual environment Python

**Validation Commands**:
```bash
# Test linting locally
cd packages/vespera-scriptorium
source venv/bin/activate
flake8 vespera_scriptorium/
mypy vespera_scriptorium/
black --check vespera_scriptorium/
isort --check-only vespera_scriptorium/
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Fix Python linting configuration in GitHub Actions quality workflow.

TASK: Update linting commands to work with monorepo structure and virtual environments.

INPUT: 
File: .github/workflows/quality.yml
Package: packages/vespera-scriptorium with venv/
Tools: flake8, mypy, black, isort

PATTERN TO APPLY:
# Before
python -m flake8 .
python -m mypy .

# After
cd packages/vespera-scriptorium
./venv/bin/python -m flake8 vespera_scriptorium/
./venv/bin/python -m mypy vespera_scriptorium/

OUTPUT_FORMAT: Updated quality workflow YAML with working linting configuration.

VALIDATION: All linting tools must run from correct directory with proper module paths.
```

## Agent Instructions

**Execution Steps**:
1. Read `.github/workflows/quality.yml`
2. Identify linting tool invocations
3. Add proper working-directory settings
4. Update tool commands to use virtual environment
5. Fix module path references for monorepo
6. Validate workflow syntax
7. Store results in orchestrator

---

**Navigation**:
- ← Back to [Category Overview](README.md)
- → Next Task: [02-fix-typescript-checks.md](02-fix-typescript-checks.md)
- ↑ Priority: [../../index.md](../../index.md)