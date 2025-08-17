# 00-ci-pipeline: Main CI/CD Pipeline Fixes

**Category Purpose**: Fix the main CI workflow that runs tests and builds
**Priority**: 🔴 Critical
**GitHub Issue**: #16 - CI/CD Pipeline Workflow Failing
**Local LLM Ready**: ✅ High

## Category Overview

Fix core CI/CD pipeline workflow to ensure proper Python environment setup, path resolution, and successful test execution in GitHub Actions.

## Task List

| Task | File | Status | Duration | LLM Ready |
|------|------|--------|----------|-----------|
| **01** | [01-fix-python-commands.md](01-fix-python-commands.md) | ⏳ TODO | 15 min | ✅ |
| **02** | [02-fix-workflow-paths.md](02-fix-workflow-paths.md) | ⏳ TODO | 10 min | ✅ |

## Dependencies

**This Category Requires**:
- Access to workflow files
- Understanding of monorepo structure

**This Category Provides**:
- Working CI/CD pipeline
- Proper test execution environment
- Foundation for other workflows

## Success Criteria

**Category Completion Requirements**:
- [ ] All Python commands use `python3` with fallback
- [ ] Paths resolve correctly for monorepo structure
- [ ] Virtual environments create successfully
- [ ] Test execution completes without environment errors

**Integration Points**:
- Fixes enable other workflows to function
- Provides template for other workflow fixes

## Local LLM Execution

**Automation Potential**: Very High
**Context Requirements**: Minimal (workflow file + pattern examples)
**Validation Approach**: GitHub Actions test runs

---

**Navigation**:
- ← Back to [Priority Overview](../../index.md)
- → Next Category: [../01-quality-workflow/](../01-quality-workflow/)
- 📋 Master Checklist: [../../tracking/checklist.md](../../tracking/checklist.md)