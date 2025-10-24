# Phase 16a: Surgical Cleanup & Foundation

**Status**: Proposed
**Duration**: [TBD - Single session estimated]
**Context Window**: [Current session]
**Related ADRs**: [ADR-011](../decisions/ADR-011-surgical-cleanup-before-architecture.md), [ADR-001](../decisions/ADR-001-projects-fundamental.md), [ADR-004](../decisions/ADR-004-dynamic-templates.md), [ADR-007](../decisions/ADR-007-codex-folders.md)

---

## Executive Summary

Phase 16a performs targeted technical debt cleanup and lays foundation infrastructure for project-centric architecture implementation. Using parallel subagent orchestration, this phase addresses 309 TODOs/FIXMEs, removes legacy UI code, fixes TypeScript compilation errors, and implements core project management services. This clean foundation enables Phase 16b to implement project-centric features without legacy code interference.

---

## Objectives

### Primary Goals

- [ ] **Audit Technical Debt**: Analyze 309 TODOs/FIXMEs, categorize by priority/relevance (obsolete vs. actionable)
- [ ] **Remove Legacy Code**: Identify and delete dead code from old UI implementation
- [ ] **Fix TypeScript Errors**: Achieve clean compilation across the codebase
- [ ] **Implement Project Service**: Core project management functionality (CRUD operations, persistence)
- [ ] **Create Project Data Models**: TypeScript interfaces and types for project entities
- [ ] **Scaffold Project UI**: Basic project selector component structure

### Secondary Goals

- [ ] File GitHub issues for actionable TODOs that can't be resolved immediately
- [ ] Update CLAUDE.md if cleanup reveals outdated development patterns
- [ ] Document API contracts for project service

### Non-Goals

- Implementing full project creation UI flow (deferred to Phase 16b)
- Template filtering by project type (deferred to Phase 16b)
- Codex nesting UI implementation (deferred to Phase 16b)
- Migrating existing Codices to project model (deferred to Phase 16b)
- Addressing all 309 TODOs (only obsolete ones removed, others filed as issues)

---

## Technical Approach

### Parallel Subagent Orchestration Strategy

This phase uses three rounds of parallel subagent execution to maximize context efficiency:

#### Round 1: Assessment Phase (Parallel Execution)

**Subagent 1: Technical Debt Auditor**
- Analyze all 309 TODOs/FIXMEs in codebase
- Categorize: Obsolete | Actionable | Blocked | Documentation
- Identify quick wins (can be fixed in this phase)
- Output: Structured report with categorized TODOs

**Subagent 2: Legacy Code Hunter**
- Search for old UI code (components, utilities, services)
- Identify unused imports and orphaned modules
- Map dependencies to ensure safe deletion
- Output: List of files/modules safe to delete

**Subagent 3: TypeScript Error Analyzer**
- Compile project, collect all TypeScript errors
- Categorize errors: Type mismatches | Missing imports | Configuration | Unused variables
- Identify error clusters (related errors that can be fixed together)
- Output: Prioritized error list with fix strategies

#### Round 2: Surgical Cleanup (Parallel Execution)

**Subagent 4: Dead Code Remover**
- Delete files identified by Legacy Code Hunter
- Remove unused imports and exports
- Clean up orphaned test files
- Verify no broken dependencies introduced
- Output: List of deleted files and imports

**Subagent 5: TypeScript Error Fixer**
- Fix type errors identified in Round 1
- Add missing type annotations
- Resolve import issues
- Configure tsconfig.json if needed
- Output: Clean compilation

**Subagent 6: TODO Cleanup Agent**
- Remove obsolete TODOs identified in Round 1
- Convert actionable TODOs to GitHub issues (or document for manual filing)
- Add clear context to remaining TODOs
- Output: Cleaned TODO list, GitHub issue references

#### Round 3: Foundation Building (Parallel Execution)

**Subagent 7: Project Service Architect**
- Implement `ProjectService` class with CRUD operations
- Design persistence layer (file-based initially)
- Create project validation logic
- Implement project context management
- Output: Working project service with tests

**Subagent 8: Data Model Implementer**
- Create `IProject` interface and related types
- Define project metadata structure
- Implement serialization/deserialization
- Create type guards and validators
- Output: Complete project data model

**Subagent 9: UI Scaffolder**
- Create `ProjectSelector` component shell
- Set up Navigator integration points
- Define component props and state interfaces
- Create placeholder UI (no full implementation yet)
- Output: Component scaffolding ready for Phase 16b

### Orchestration Coordination

**Between Rounds**:
- Orchestrator reviews all subagent outputs
- Identifies conflicts or dependencies between changes
- Approves progression to next round
- Adjusts Round 2/3 plans based on Round 1 findings

**Conflict Resolution**:
- If subagents identify overlapping changes, orchestrator merges strategies
- If deletion conflicts with foundation work, foundation takes precedence
- If error fixes require architectural changes, defer to Phase 16b

---

## Prerequisites

Before starting Phase 16a:

- [x] Phase 15 documentation complete
- [x] ADR-011 created and accepted
- [x] Foundation architecture documents available
- [x] Git working tree clean
- [ ] User approval of Phase 16a plan

---

## Success Criteria

Phase 16a is complete when:

1. **Cleanup Metrics**:
   - All legacy UI code identified and removed
   - TypeScript compilation clean (zero errors)
   - Obsolete TODOs removed (target: 50-100 removed)
   - Actionable TODOs documented with context

2. **Foundation Metrics**:
   - `ProjectService` implemented with CRUD operations
   - Project data models defined and validated
   - Project selector component scaffolded
   - Unit tests written for project service

3. **Quality Metrics**:
   - No new TypeScript errors introduced
   - No broken imports or references
   - Git history clean (atomic commits per round)
   - Documentation updated for new services

---

## Estimated Timeline

- **Round 1 (Assessment)**: 30-45 minutes
- **Review & Planning**: 15 minutes
- **Round 2 (Cleanup)**: 45-60 minutes
- **Round 3 (Foundation)**: 60-90 minutes
- **Testing & Validation**: 30 minutes
- **Total**: ~3-4 hours (single session)

---

## Risk Mitigation

### Risk 1: Subagent Conflicts
- **Risk**: Multiple agents modifying same files causing merge conflicts
- **Mitigation**: Orchestrator reviews outputs between rounds, coordinates file ownership
- **Contingency**: Serialize conflicting work if parallel execution proves problematic

### Risk 2: Legacy Code Dependencies
- **Risk**: Deleting code that's actually still used somewhere
- **Mitigation**: Legacy Code Hunter maps dependencies before deletion
- **Contingency**: Use git to revert specific deletions if needed

### Risk 3: Scope Creep
- **Risk**: Finding additional issues during cleanup, expanding scope beyond time-box
- **Mitigation**: Strict adherence to "surgical cleanup only" - defer non-blocking issues
- **Contingency**: Document deferred work for Phase 17 or later

### Risk 4: TypeScript Error Cascade
- **Risk**: Fixing one error reveals 10 more errors
- **Mitigation**: Error Analyzer identifies clusters, fixes applied systematically
- **Contingency**: If error count grows, defer complex fixes to Phase 16b

---

## Deliverables

### Code Artifacts
- [ ] Deleted legacy UI files (list in completion report)
- [ ] `src/services/ProjectService.ts` - Core project management
- [ ] `src/models/Project.ts` - Project data models
- [ ] `src/components/ProjectSelector.tsx` - UI scaffolding (shell only)
- [ ] `src/models/ProjectTypes.ts` - TypeScript interfaces for projects
- [ ] Unit tests for project service

### Documentation
- [ ] Phase 16a completion report (using phase template)
- [ ] Updated CLAUDE.md if patterns changed
- [ ] API documentation for ProjectService
- [ ] List of GitHub issues filed for deferred TODOs

### Quality Assurance
- [ ] Clean TypeScript compilation
- [ ] All tests passing (no regressions)
- [ ] Git commits organized by round (atomic, descriptive)
- [ ] Code review checklist completed

---

## Open Questions

1. **Project Storage Format**
   - **Question**: Should projects be stored as `.json` files, `.yaml`, or in extension settings?
   - **Impact**: Affects portability, version control, user accessibility
   - **Decision Needed By**: Before Round 3 (Foundation Building)

2. **Project ID Generation**
   - **Question**: Use UUIDs, slugified names, or sequential IDs?
   - **Impact**: Uniqueness guarantees, human readability, URL safety
   - **Decision Needed By**: Before implementing ProjectService

3. **Default Project Handling**
   - **Question**: Should there be a "Default" or "Unsorted" project for orphaned Codices?
   - **Impact**: Migration path, user experience, data model complexity
   - **Decision Needed By**: Before Phase 16b, but inform data model design now

4. **Subagent Coordination Tool**
   - **Question**: Should we use Task tool with specialized agents, or general-purpose agents?
   - **Impact**: Agent capability, coordination overhead, context efficiency
   - **Decision Needed By**: Before Round 1 execution

---

## Context for AI Assistant

### Quick Start for This Phase

**If picking up Phase 16a mid-execution:**

1. **Check current round**: See which subagents have completed (check git log)
2. **Read Round outputs**: Review subagent reports in orchestrator notes
3. **Identify conflicts**: Look for overlapping changes requiring coordination
4. **Continue from checkpoint**: Pick up at next incomplete round

### Key Files to Monitor

- `docs/development/phases/PHASE_16a_COMPLETE.md` - Will be created at phase end
- `src/services/ProjectService.ts` - New file (Round 3)
- `src/models/Project.ts` - New file (Round 3)
- `src/components/ProjectSelector.tsx` - New file (Round 3)
- TypeScript compilation output - Should show decreasing error count

### Commands for This Phase

```bash
# Check TypeScript errors
npm run compile

# Run tests
npm test

# Check TODO count
grep -r "TODO\|FIXME" src/ | wc -l

# See legacy code candidates
grep -r "OldUI\|Legacy\|Deprecated" src/

# Verify clean compilation
npm run build
```

---

## Links

### Related Phases
- **Previous**: [Phase 15: Documentation Audit](./PHASE_15_COMPLETE.md)
- **Current**: **Phase 16a: Surgical Cleanup & Foundation** (this document)
- **Next**: Phase 16b: Project-Centric Implementation (to be planned after 16a)

### Architecture Decision Records
- [ADR-011: Surgical Cleanup Before Architecture](../decisions/ADR-011-surgical-cleanup-before-architecture.md) - Decision for this phase
- [ADR-001: Projects as Fundamental](../decisions/ADR-001-projects-fundamental.md) - What we're implementing
- [ADR-004: Dynamic Templates](../decisions/ADR-004-dynamic-templates.md) - Template system foundation
- [ADR-007: Codex-Based Folders](../decisions/ADR-007-codex-folders.md) - Nesting architecture

### Architecture Documentation
- [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Implementation target
- [Hierarchical Template System](../../architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md) - Template filtering design
- [Codex Nesting](../../architecture/core/CODEX_NESTING.md) - Future UI work (Phase 16b)

---

*Phase plan created: 2025-10-24*
*Template version: 1.0.0*
