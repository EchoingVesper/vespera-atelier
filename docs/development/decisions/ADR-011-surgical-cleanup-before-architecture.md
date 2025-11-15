# ADR-011: Surgical Cleanup Before Architecture Implementation

**Status**: Accepted
**Date**: 2025-10-24
**Deciders**: Aya Partridge, Claude (orchestrator)
**Technical Story**: Phase 16 planning - Project-centric architecture implementation requires addressing 309 TODOs/FIXMEs and legacy code

---

## Context and Problem Statement

Phase 16 aims to implement the project-centric architecture (mandatory projects, template filtering, Codex nesting UI). However, the codebase currently has 309 TODOs/FIXMEs and legacy code from the old UI implementation, creating significant technical debt. This noise makes it harder to implement new architecture correctly and increases mental overhead during development.

Should we clean up technical debt before implementing new architecture, or proceed with new features despite the clutter?

## Decision Drivers

* **Mental overhead**: Legacy code and unresolved TODOs create cognitive burden during development
* **Risk of errors**: Implementing new architecture in cluttered codebase increases chance of bugs
* **Development velocity**: Need to balance cleanup time against forward progress on critical features
* **Context window constraints**: Working with subagents to conserve context caps per instance
* **Foundation quality**: Project-centric architecture is fundamental - implementation quality matters
* **Technical debt compounding**: Adding new code to messy codebase accelerates debt accumulation

## Considered Options

1. **Full Technical Debt Cleanup First** - Comprehensive cleanup pass before any new architecture work
2. **Architecture First, Defer Cleanup** - Implement project-centric architecture immediately, clean up later
3. **Hybrid Approach: Surgical Cleanup + Foundation** - Targeted cleanup of blocking issues, then architecture implementation

## Decision Outcome

Chosen option: **"Hybrid Approach: Surgical Cleanup + Foundation"**, because it provides a clean foundation for critical architecture work without spending excessive time on comprehensive cleanup. The two-phase approach (16a: surgical cleanup + foundation, 16b: architecture implementation) balances velocity with code quality.

### Positive Consequences

* **Reduced mental overhead**: Clean codebase makes new architecture implementation clearer
* **Lower error risk**: Removing legacy code prevents accidental dependencies or conflicts
* **Manageable scope**: Surgical cleanup is time-boxed, not open-ended
* **Forward progress**: Foundation work in Phase 16a provides immediate value
* **Efficient context use**: Parallel subagent orchestration maximizes context window efficiency
* **Quality foundation**: Project-centric architecture built on clean base, not technical debt

### Negative Consequences

* **Partial cleanup**: Not all 309 TODOs will be addressed immediately (deferred to future phases)
* **Potential rework**: Some cleanup work may need revisiting after architecture changes
* **Coordination overhead**: Managing parallel subagents requires orchestration effort
* **Two-phase complexity**: Breaking Phase 16 into 16a/16b adds planning overhead

## Pros and Cons of the Options

### Option 1: Full Technical Debt Cleanup First

Comprehensive cleanup pass addressing all 309 TODOs/FIXMEs and legacy code before any new architecture work.

* Good, because codebase would be completely clean for new work
* Good, because all technical debt addressed in one pass
* Good, because no risk of legacy code interfering with new architecture
* Bad, because could take 2-3 sessions before any architecture progress
* Bad, because delays critical project-centric foundation work
* Bad, because some cleanup work may become obsolete during architecture implementation
* Bad, because loses momentum on high-priority architectural changes

### Option 2: Architecture First, Defer Cleanup

Implement project-centric architecture immediately, clean up technical debt in a later phase.

* Good, because immediate forward progress on critical architecture
* Good, because no time spent on cleanup before seeing value
* Good, because architecture changes may make some cleanup unnecessary
* Bad, because legacy code creates mental overhead during implementation
* Bad, because increased risk of bugs from code clutter
* Bad, because technical debt compounds as new code added
* Bad, because cleanup becomes harder after architecture changes
* Bad, because may accidentally depend on or conflict with legacy code

### Option 3: Hybrid Approach - Surgical Cleanup + Foundation

Two-phase implementation:
- **Phase 16a**: Surgical cleanup (legacy UI, TypeScript errors, obsolete TODOs) + foundation (core models, services, UI scaffolding)
- **Phase 16b**: Full architecture implementation (project creation, template filtering, Codex nesting UI)

Using parallel subagent orchestration:
- Round 1: Assessment (technical debt audit, legacy code hunt, TypeScript error analysis)
- Round 2: Surgical cleanup (dead code removal, error fixes, TODO cleanup)
- Round 3: Foundation building (project service, data models, UI scaffolding)

* Good, because targets cleanup where it provides most value (blocking issues only)
* Good, because foundation work in 16a provides immediate progress
* Good, because time-boxed cleanup prevents scope creep
* Good, because parallel subagents maximize context efficiency
* Good, because clean foundation for critical architecture implementation
* Good, because manageable phases (1 session for 16a, 1-2 sessions for 16b)
* Neutral, because requires orchestration overhead for subagent coordination
* Neutral, because not all technical debt addressed (remaining TODOs deferred)
* Bad, because two-phase approach adds planning complexity
* Bad, because some cleanup work may need revisiting after architecture changes

## Implementation Strategy

### Phase 16a: Surgical Cleanup + Foundation (1 session)

**Round 1: Assessment (Parallel subagents)**
- Technical Debt Auditor: Analyze 309 TODOs/FIXMEs, categorize by priority/relevance
- Legacy Code Hunter: Identify dead code from old UI implementation
- TypeScript Error Analyzer: Catalog all TypeScript errors, identify quick wins

**Round 2: Surgical Cleanup (Parallel subagents)**
- Dead Code Remover: Delete identified legacy code
- Error Fixer: Fix TypeScript compilation issues
- TODO Cleanup: Remove obsolete TODOs, file issues for real ones

**Round 3: Foundation Building (Parallel subagents)**
- Project Service Architect: Design and implement core project management
- Data Model Implementer: Create project data structures
- UI Scaffolder: Set up project selector UI components

### Phase 16b: Project-Centric Implementation (1-2 sessions)

After Phase 16a cleanup and foundation:
- Implement project creation flow (first-time user experience)
- Add project selector to Navigator
- Implement template filtering by project type
- Add Codex nesting UI (expand/collapse, tree view)
- Create migration path for existing Codices

## Links

* [Related to] [ADR-001: Projects as Fundamental](./ADR-001-projects-fundamental.md) - Architecture we're implementing
* [Related to] [ADR-010: Phase Handover Methodology](./ADR-010-phase-handover-methodology.md) - Process for managing phases
* [Implements] [Phase 15 Completion](../phases/PHASE_15_COMPLETE.md) - Suggestions for Phase 16
* [Documented in] [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Architecture specification
