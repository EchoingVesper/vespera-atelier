# Fix Health Check Validation Scripts

**Task ID**: `health-validation-fix`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 25 minutes  
**Priority**: 🟡 High  
**Complexity**: moderate
**GitHub Issue**: #18

## Objective

Fix health check validation scripts in `.github/workflows/health-check.yml` to properly validate system dependencies, package installations, and service readiness.

## Context

**Background**: Health check workflow failing because validation scripts don't account for monorepo structure or missing system dependencies.

**Relationship to Priority**: Important for deployment and system validation.

**Dependencies**:
- Requires: CI pipeline and quality fixes
- Provides to: System readiness validation

## Inputs

**Required Files/Data**:
- File: `.github/workflows/health-check.yml`
- Health validation scripts (if any)
- System dependency requirements

**Context Information**:
- Required system dependencies
- Package installation verification
- Service readiness checks

## Expected Outputs

**Primary Deliverables**:
- Updated health-check.yml with working validation
- Proper system dependency checks
- Package installation verification
- Service health validation

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] System dependencies are validated correctly
- [ ] Package installations are verified
- [ ] Service health checks pass
- [ ] Monorepo packages are validated properly
- [ ] Virtual environments are checked

**Validation Commands**:
```bash
# Test health checks locally
make health-check
pnpm run health-check
python -c "import vespera_scriptorium; print('OK')"
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Fix health check validation in GitHub Actions for monorepo system validation.

TASK: Update health validation to check system dependencies and package readiness.

INPUT: 
File: .github/workflows/health-check.yml
Packages: Python (vespera-scriptorium), Node.js (workspace packages)
Checks: Dependencies, installations, service readiness

PATTERN TO APPLY:
# Before
npm run health-check

# After
# System dependency checks
python3 --version
node --version
pnpm --version

# Package validation
cd packages/vespera-scriptorium && source venv/bin/activate && python -c "import vespera_scriptorium"
pnpm run health-check

OUTPUT_FORMAT: Updated health-check workflow YAML with comprehensive validation.

VALIDATION: All system components must be verified before deployment readiness.
```

## Agent Instructions

**Execution Steps**:
1. Read `.github/workflows/health-check.yml`
2. Identify current validation steps
3. Add system dependency checks
4. Add package installation verification
5. Add service readiness validation
6. Ensure monorepo compatibility
7. Validate workflow syntax
8. Store results in orchestrator

---

**Navigation**:
- ← Back to [Category Overview](README.md)
- → Next Task: [02-add-system-checks.md](02-add-system-checks.md)
- ↑ Priority: [../../index.md](../../index.md)