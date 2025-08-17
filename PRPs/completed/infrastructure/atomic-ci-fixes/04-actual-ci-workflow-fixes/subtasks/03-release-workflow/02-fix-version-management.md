# Fix Release Version Management

**Task ID**: `release-version-fix`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 20 minutes  
**Priority**: 🟡 High  
**Complexity**: simple
**GitHub Issue**: #19

## Objective

Fix version management in `.github/workflows/release.yml` to properly handle version extraction, tagging, and release note generation for monorepo releases.

## Context

**Background**: Release workflow failing because version management doesn't work with monorepo structure and multiple package versions.

**Relationship to Priority**: Important for consistent release versioning.

**Dependencies**:
- Requires: Build process fixes (01-fix-build-process.md)
- Provides to: Complete release automation

## Inputs

**Required Files/Data**:
- File: `.github/workflows/release.yml`
- Package version configurations
- Git tagging requirements

**Context Information**:
- Monorepo version coordination
- Package-specific versioning
- Release note generation
- Git tag creation

## Expected Outputs

**Primary Deliverables**:
- Updated release.yml with version management
- Proper version extraction from packages
- Git tag creation for releases
- Release note generation

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] Version extracted correctly from packages
- [ ] Git tags created for releases
- [ ] Release notes generated properly
- [ ] Version coordination across packages
- [ ] Semantic versioning compliance

**Validation Commands**:
```bash
# Test version extraction
python -c "import vespera_scriptorium; print(vespera_scriptorium.__version__)"
node -p "require('./package.json').version"
git tag --list
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Fix version management in GitHub Actions release workflow for monorepo.

TASK: Update version extraction and tagging for coordinated monorepo releases.

INPUT: 
File: .github/workflows/release.yml
Versioning: Python (__version__), Node.js (package.json)
Output: Git tags, release notes, version coordination

PATTERN TO APPLY:
# Version extraction
PYTHON_VERSION=$(python -c "import vespera_scriptorium; print(vespera_scriptorium.__version__)")
NODE_VERSION=$(node -p "require('./package.json').version")

# Git tagging
git tag "v${PYTHON_VERSION}"
git push origin "v${PYTHON_VERSION}"

# Release notes
gh release create "v${PYTHON_VERSION}" --generate-notes

OUTPUT_FORMAT: Updated release workflow with proper version management.

VALIDATION: Versions must be extracted correctly and releases tagged consistently.
```

## Agent Instructions

**Execution Steps**:
1. Read current release.yml
2. Add version extraction steps
3. Add git tagging process
4. Add release note generation
5. Ensure version coordination
6. Add error handling for versioning
7. Validate workflow syntax
8. Store results in orchestrator

---

**Navigation**:
- ← Previous Task: [01-fix-build-process.md](01-fix-build-process.md)
- → Next Priority: [../../05-python-environment-compatibility/](../../05-python-environment-compatibility/)
- ↑ Priority: [../../index.md](../../index.md)