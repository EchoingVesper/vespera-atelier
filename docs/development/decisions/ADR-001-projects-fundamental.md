# ADR-001: Projects as Fundamental Entities

**Status**: Accepted
**Date**: 2025-10-23
**Deciders**: Development Team
**Technical Story**: Phase 15 - Project-Centric Architecture Refactor

---

## Context and Problem Statement

The existing Vespera Atelier architecture treated projects as optional organizational units. Codices could exist without project association, templates were globally available, and there was no clear project context. This led to:
- Cluttered Navigator showing all Codices regardless of relevance
- Template menus with irrelevant options (e.g., journalism templates in fiction projects)
- Unclear context boundaries when working with multiple projects
- Difficult organization in multi-project vaults

**Question**: Should projects be optional organizational units or fundamental entities that everything else depends on?

## Decision Drivers

* **User Mental Model**: Real-world creative work is naturally organized around projects
* **Context Clarity**: Users need to know what project they're working in
* **Reduced Cognitive Load**: Filtering content by project reduces overwhelm
* **Multi-Project Support**: Enable users to manage multiple projects cleanly
* **Template Relevance**: Show only templates relevant to current project type
* **Scalability**: Architecture must scale to dozens of projects

## Considered Options

1. **Keep Projects Optional**: Projects remain organizational metadata, Codices can exist without projects
2. **Make Projects Fundamental**: Everything must exist within a project, project required on first launch
3. **Hybrid Approach**: Projects optional but encouraged with UI prompts

## Decision Outcome

Chosen option: **"Make Projects Fundamental"**, because it provides the clearest mental model, reduces cognitive load, and aligns with real-world workflows.

### Positive Consequences

* Clear context boundaries - users always know what project they're in
* Reduced Navigator clutter - only relevant Codices visible
* Context-aware features - templates, tasks, automation filter by project
* Better multi-project organization - clean separation between projects
* Simplified architecture - no "null project" edge cases to handle

### Negative Consequences

* Breaking change - requires migration of existing Codices
* First-time users must create project before doing anything
* Additional complexity for single-project users (though minimal)

## Implementation Details

### Project Entity Model

```typescript
interface Project {
  id: string;
  name: string;
  type: ProjectType;  // journalism, research, fiction, etc.
  created: Date;
  updated: Date;
  metadata: ProjectMetadata;
  settings: ProjectSettings;
}
```

### Codex Association

All Codices get `project_id` in frontmatter:

```yaml
---
codex_id: "uuid"
project_id: "project-uuid"
template_id: "article"
---
```

### First-Time User Experience

1. User launches Vespera Atelier with no projects
2. Welcome screen appears with project type selection
3. User chooses template (journalism, research, fiction, etc.)
4. System creates project and opens Navigator
5. User can now create Codices

### Migration Path

For existing users upgrading:
1. System detects Codices without `project_id`
2. Creates "Imported Project" if no projects exist
3. Adds `project_id` to all legacy Codices
4. Offers to reorganize into new projects

## Pros and Cons of the Options

### Keep Projects Optional

* Good, because no breaking changes required
* Good, because simpler for single-project users
* Bad, because ambiguous context in multi-project vaults
* Bad, because Navigator shows all Codices (cluttered)
* Bad, because templates not filtered by project type

### Make Projects Fundamental (CHOSEN)

* Good, because clear mental model aligning with real-world work
* Good, because reduced cognitive load through filtering
* Good, because context-aware features possible
* Good, because clean multi-project separation
* Bad, because breaking change requires migration
* Bad, because mandatory project creation on first launch

### Hybrid Approach

* Good, because backwards compatible
* Good, because progressive enhancement
* Bad, because architectural complexity (handling null projects)
* Bad, because unclear mental model (when is project needed?)
* Bad, because "null project" edge cases throughout codebase

## Related Decisions

* [ADR-002: Project Context Switching](./ADR-002-project-context-switching.md)
* [ADR-003: Template Filtering by Project](./ADR-003-template-filtering.md)

## Links

* Refines [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md)
* Supersedes: Legacy flat organization model
