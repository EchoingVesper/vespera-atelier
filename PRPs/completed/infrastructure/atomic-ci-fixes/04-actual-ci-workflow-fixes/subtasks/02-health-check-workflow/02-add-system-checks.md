# Add System Dependency Checks

**Task ID**: `health-system-checks`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 15 minutes  
**Priority**: 🟡 High  
**Complexity**: simple
**GitHub Issue**: #18

## Objective

Add comprehensive system dependency checks to the health check workflow to verify all required tools and versions are available before running tests.

## Context

**Background**: Health checks need to validate system environment before attempting package operations.

**Relationship to Priority**: Foundation for all other health validations.

**Dependencies**:
- Requires: Validation script fixes (01-fix-validation-scripts.md)
- Provides to: Complete health validation

## Inputs

**Required Files/Data**:
- File: `.github/workflows/health-check.yml`
- System requirements from packages
- Version constraints

**Context Information**:
- Required: python3, node, pnpm, git
- Version constraints from package.json and pyproject.toml
- Environment variable requirements

## Expected Outputs

**Primary Deliverables**:
- System dependency version checks
- Environment variable validation
- Tool availability verification
- Clear error reporting

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] Python 3.8+ version check
- [ ] Node.js 18+ version check  
- [ ] pnpm 8+ version check
- [ ] Git availability check
- [ ] Required environment variables validated
- [ ] Clear error messages for missing dependencies

**Validation Commands**:
```bash
# Test system checks locally
python3 --version
node --version
pnpm --version
git --version
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Add system dependency checks to GitHub Actions health check workflow.

TASK: Add version checks and tool availability validation.

INPUT: 
File: .github/workflows/health-check.yml
Requirements: python3 (3.8+), node (18+), pnpm (8+), git
Error handling: Clear messages for missing tools

PATTERN TO APPLY:
# Add system checks
- name: Check System Dependencies
  run: |
    echo "Checking system dependencies..."
    python3 --version || (echo "ERROR: Python 3 not found" && exit 1)
    node --version || (echo "ERROR: Node.js not found" && exit 1)
    pnpm --version || (echo "ERROR: pnpm not found" && exit 1)
    git --version || (echo "ERROR: git not found" && exit 1)

OUTPUT_FORMAT: Updated health-check workflow with comprehensive system validation.

VALIDATION: All required tools must be verified with version checks.
```

## Agent Instructions

**Execution Steps**:
1. Read current health-check.yml
2. Add system dependency check step
3. Add version validation commands
4. Add clear error reporting
5. Ensure proper step ordering
6. Validate workflow syntax
7. Store results in orchestrator

---

**Navigation**:
- ← Previous Task: [01-fix-validation-scripts.md](01-fix-validation-scripts.md)
- → Next Category: [../03-release-workflow/](../03-release-workflow/)
- ↑ Priority: [../../index.md](../../index.md)