# Architecture Decision Records (ADRs)

This directory contains Architecture Decision Records (ADRs) documenting significant architectural decisions made during the development of Vespera Atelier.

## What is an ADR?

An Architecture Decision Record captures an important architectural decision along with its context and consequences. ADRs help teams:
- Understand why decisions were made
- Avoid revisiting settled decisions
- Onboard new team members
- Track decision evolution over time

## ADR Format

We use a lightweight ADR format adapted from Michael Nygard's proposal. See [ADR-TEMPLATE.md](./ADR-TEMPLATE.md) for the template.

## Status Definitions

- **Proposed**: Decision under consideration
- **Accepted**: Decision approved and being implemented
- **Deprecated**: Decision no longer recommended
- **Superseded**: Decision replaced by another ADR

---

## ADR Index

### Phase 15: Project-Centric Architecture (October 2025)

#### Core Architecture

- **[ADR-001: Projects as Fundamental Entities](./ADR-001-projects-fundamental.md)** ✅
  - Status: Accepted
  - Summary: Make projects mandatory foundational entities rather than optional metadata
  - Impact: Breaking change, requires migration, provides clear context boundaries

- **[ADR-002: Project Context Switching](./ADR-002-project-context-switching.md)** 🚧
  - Status: Proposed
  - Summary: How users switch between projects and how context affects UI
  - Impact: Navigator filtering, template availability, task visibility

- **[ADR-003: Template Filtering by Project Type](./ADR-003-template-filtering.md)** 🚧
  - Status: Proposed
  - Summary: Templates shown in UI based on current project type
  - Impact: Cleaner template menus, project-specific workflows

#### Template System

- **[ADR-004: Dynamic Template System](./ADR-004-dynamic-templates.md)** ✅
  - Status: Accepted
  - Summary: Replace hardcoded CodexType enum with JSON5-based dynamic templates
  - Impact: User extensibility, template sharing, loss of compile-time safety

- **[ADR-005: Template Inheritance Model](./ADR-005-template-inheritance.md)** 🚧
  - Status: Proposed
  - Summary: Single inheritance with multiple mixins for template reuse
  - Impact: DRY template definitions, easier maintenance

- **[ADR-006: Hierarchical Menu Structure](./ADR-006-hierarchical-menus.md)** 🚧
  - Status: Proposed
  - Summary: Multi-level category organization for template menus
  - Impact: Reduced menu clutter, better template organization

#### Codex Nesting

- **[ADR-007: Codex-Based Folders](./ADR-007-codex-folders.md)** ✅
  - Status: Accepted
  - Summary: Implement Scrivener-style folders where any Codex can have children
  - Impact: Unified model, folders with content, flexible hierarchies

- **[ADR-008: Unlimited Nesting Depth](./ADR-008-unlimited-nesting.md)** 🚧
  - Status: Proposed
  - Summary: Allow unlimited parent-child nesting with virtualized rendering
  - Impact: Flexible organization, performance considerations

- **[ADR-009: Content in Folder-Codices](./ADR-009-folder-content.md)** 🚧
  - Status: Proposed
  - Summary: Folder-Codices can contain their own content in addition to children
  - Impact: Chapter summaries, folder notes, enhanced organization

---

## How to Create an ADR

1. Copy `ADR-TEMPLATE.md` to new file with format `ADR-XXX-short-title.md`
2. Assign next available ADR number
3. Fill in all sections:
   - Context and problem statement
   - Decision drivers
   - Considered options with pros/cons
   - Decision outcome with consequences
4. Update this index with ADR summary
5. Link ADR from relevant architecture documents
6. Create PR for review and discussion
7. Update status to "Accepted" when approved

## ADR Lifecycle

```
Proposed → [Discussion] → Accepted → [Time passes] → Deprecated/Superseded
                ↓
            Rejected
```

## Related Documentation

- [Architecture Documentation](../../architecture/) - Core system architecture
- [Phase Tracking](../phases/) - Development progress reports
- [Development Reports](../reports/) - Technical investigations and summaries

---

**Legend**:
- ✅ Documented
- 🚧 Needs documentation
- ❌ Rejected/Superseded
