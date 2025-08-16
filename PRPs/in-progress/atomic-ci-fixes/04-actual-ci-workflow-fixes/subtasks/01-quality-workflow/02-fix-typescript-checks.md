# Fix TypeScript Checks in Quality Workflow

**Task ID**: `quality-typescript-fix`  
**Type**: Implementation  
**Local LLM Ready**: ✅ High  
**Estimated Duration**: 15 minutes  
**Priority**: 🟡 High  
**Complexity**: simple
**GitHub Issue**: #17

## Objective

Fix TypeScript type checking configuration in `.github/workflows/quality.yml` to properly validate TypeScript files in the monorepo workspace packages.

## Context

**Background**: Quality workflow failing on TypeScript validation because paths and workspace configuration are incorrect for Node.js packages.

**Relationship to Priority**: Important for Node.js package quality validation.

**Dependencies**:
- Requires: Linting fixes (01-fix-linting-config.md)
- Provides to: Complete quality gate validation

## Inputs

**Required Files/Data**:
- File: `.github/workflows/quality.yml`
- TypeScript configuration files (tsconfig.json)
- Node.js package locations

**Context Information**:
- Workspace packages with TypeScript
- pnpm workspace configuration
- TypeScript compilation requirements

## Expected Outputs

**Primary Deliverables**:
- Updated quality.yml with TypeScript checking
- Proper workspace package discovery
- Working TypeScript validation

**Artifact Storage**: Via orchestrator_complete_task

## Success Criteria

**Completion Requirements**:
- [ ] TypeScript type checking runs without path errors
- [ ] Workspace packages are discovered correctly
- [ ] Type checking uses correct tsconfig.json files
- [ ] pnpm workspace commands work properly

**Validation Commands**:
```bash
# Test TypeScript checking locally
pnpm run typecheck
pnpm --filter="*" run type-check
```

## Local LLM Prompt Template

**Structured Prompt**:
```text
CONTEXT: Fix TypeScript checking in GitHub Actions quality workflow for pnpm workspaces.

TASK: Update TypeScript validation to work with monorepo workspace structure.

INPUT: 
File: .github/workflows/quality.yml
Workspace: pnpm workspaces with packages/*, vespera-utilities, plugins/*
Tools: pnpm, TypeScript, workspace commands

PATTERN TO APPLY:
# Before
npm run typecheck

# After
pnpm install
pnpm run typecheck
# Or: pnpm --filter="*" run type-check

OUTPUT_FORMAT: Updated quality workflow YAML with working TypeScript validation.

VALIDATION: TypeScript checking must validate all workspace packages with types.
```

## Agent Instructions

**Execution Steps**:
1. Read `.github/workflows/quality.yml`
2. Identify TypeScript checking commands
3. Update to use pnpm workspace commands
4. Ensure workspace dependency installation
5. Add proper TypeScript validation steps
6. Validate workflow syntax
7. Store results in orchestrator

---

**Navigation**:
- ← Previous Task: [01-fix-linting-config.md](01-fix-linting-config.md)
- → Next Category: [../02-health-check-workflow/](../02-health-check-workflow/)
- ↑ Priority: [../../index.md](../../index.md)