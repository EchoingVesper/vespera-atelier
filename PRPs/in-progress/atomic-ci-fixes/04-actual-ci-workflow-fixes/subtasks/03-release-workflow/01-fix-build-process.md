# Fix Release Build Process

**Task ID**: `release-build-fix`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 30 minutes  
**Priority**: 🟡 High  
**Complexity**: moderate
**GitHub Issue**: #19

## Objective

Fix the build process in `.github/workflows/release.yml` to properly build and package all monorepo components for release distribution.

## Context

**Background**: Release workflow failing because build process doesn't handle monorepo structure, Python packaging, and Node.js workspace building correctly.

**Relationship to Priority**: Essential for automated releases and distribution.

**Dependencies**:
- Requires: All previous workflow fixes
- Provides to: Release automation and distribution

## Inputs

**Required Files/Data**:
- File: `.github/workflows/release.yml`
- Package build configurations
- Distribution requirements

**Context Information**:
- Python package building (wheel, sdist)
- Node.js package building and bundling
- Asset generation requirements
- Release artifact specifications

## Expected Outputs

**Primary Deliverables**:
- Updated release.yml with working build process
- Python package building (vespera-scriptorium)
- Node.js package building (workspace packages)
- Proper artifact collection and upload

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] Python packages build successfully (wheel + sdist)
- [ ] Node.js packages build and bundle correctly
- [ ] All build artifacts are collected
- [ ] Release assets are uploaded properly
- [ ] Build process works with monorepo structure

**Validation Commands**:
```bash
# Test builds locally
cd packages/vespera-scriptorium && python -m build
pnpm run build
ls dist/ build/
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Fix release build process in GitHub Actions for monorepo package distribution.

TASK: Update build commands to create distributable packages for all components.

INPUT: 
File: .github/workflows/release.yml
Components: Python (vespera-scriptorium), Node.js (workspace packages)
Outputs: Wheels, tarballs, bundled assets

PATTERN TO APPLY:
# Python building
cd packages/vespera-scriptorium
python -m build --wheel --sdist

# Node.js building  
pnpm install
pnpm run build
pnpm pack --pack-destination=dist/

# Artifact collection
mkdir -p artifacts/
cp packages/vespera-scriptorium/dist/* artifacts/
cp dist/*.tgz artifacts/

OUTPUT_FORMAT: Updated release workflow with complete build and packaging.

VALIDATION: All packages must build successfully and create distributable artifacts.
```

## Agent Instructions

**Execution Steps**:
1. Read `.github/workflows/release.yml`
2. Identify current build process issues
3. Add Python package building steps
4. Add Node.js workspace building steps
5. Add artifact collection and organization
6. Add proper upload configuration
7. Validate workflow syntax
8. Store results in orchestrator

---

**Navigation**:
- ← Back to [Category Overview](README.md)
- → Next Task: [02-fix-version-management.md](02-fix-version-management.md)
- ↑ Priority: [../../index.md](../../index.md)