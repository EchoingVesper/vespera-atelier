# ADR-015: Workspace/Project/Context Hierarchy

**Status**: Accepted
**Date**: 2025-10-25
**Deciders**: Aya (Product Owner), Claude Code
**Technical Story**: [Phase 17: Codex Editor Implementation](../phases/PHASE_17_PLAN.md)

---

## Context and Problem Statement

How should Vespera organize the relationship between workspaces, projects, and organizational modes? The initial Phase 16b implementation treated "Projects" as the fundamental unit with a single type (fiction, research, software), but real-world projects are more complex.

**Problem**: A single real-world project (e.g., a mythology-based video game) may require multiple organizational modes or "contexts" - story development, mythology research, code implementation, art direction. The current single-type "Project" model doesn't support this multi-faceted reality.

**Core Issue**: What we implemented as "Projects" in Phase 16b is actually closer to **organizational contexts** or **view modes**, not real-world projects.

## Decision Drivers

* **Real-World Project Complexity**: Projects naturally span multiple disciplines/modes
* **Content Reuse**: Same Codex (e.g., "Zeus mythology notes") appears in different contexts with different organization
* **Template Flexibility**: Need to use fiction templates AND research templates in same project
* **Mental Model Clarity**: Users think "I'm working on my game project" not "I'm switching between game-fiction and game-research projects"
* **Scalability**: Adding new organizational modes shouldn't require creating new "projects"
* **Workspace Organization**: Users may have multiple unrelated projects in same workspace

## Considered Options

1. **Keep Single-Type Projects** (Phase 16b model)
2. **Multi-Type Projects** (Projects can have multiple types)
3. **Workspace → Project → Context** (Three-level hierarchy)
4. **Flat Contexts** (No Projects, just organizational contexts)

## Decision Outcome

Chosen option: **"Workspace → Project → Context"** (Option 3), because it accurately models real-world usage while maintaining clear conceptual boundaries.

**Core Principle**:
- **Workspace**: A folder on disk where user works (VS Code workspace)
- **Project**: A real-world creative/professional endeavor (novel, game, research study)
- **Context**: An organizational lens or mode within a project (story, research, code, art)

### Positive Consequences

* **Matches Mental Model**: "I'm working on my game project in story mode"
* **Multi-Mode Support**: Projects naturally support multiple organizational contexts
* **Content Reuse**: Codices can appear in multiple contexts within same project
* **Template Flexibility**: Each context can use different template types
* **Scalable**: Easy to add new contexts without restructuring
* **Clear Boundaries**: Project = scope of work, Context = organizational lens
* **Future-Ready**: Supports planned features like context-specific views, cross-context relationships

### Negative Consequences

* **Migration Required**: Phase 16b "Projects" must be refactored to "Contexts"
* **Complexity**: Three-level hierarchy vs. two-level
* **UI Complexity**: Need both Project selector AND Context switcher
* **Database Schema**: Must add Project layer above Context

## Pros and Cons of the Options

### Option 1: Keep Single-Type Projects (Phase 16b Model)

Keep current implementation where each "Project" has one template type.

* Good, because no migration or refactoring needed
* Good, because simpler two-level hierarchy
* Good, because already implemented and tested
* Bad, because doesn't match real-world project complexity
* Bad, because forces users to split natural projects artificially
* Bad, because same content duplicated across "projects" (game-story, game-research)
* Bad, because confusing mental model ("Why do I have 3 projects for one game?")

### Option 2: Multi-Type Projects

Projects can have multiple template types, switch between them.

```typescript
interface Project {
  id: string;
  name: string;
  template_types: string[];  // ["fiction", "research", "software"]
  active_type: string;
}
```

* Good, because supports multi-faceted projects
* Good, because minimal migration (add array of types)
* Good, because simpler than three-level hierarchy
* Bad, because doesn't support different organization per type
* Bad, because can't have type-specific views or filters
* Bad, because Codex belongs to project+type, not reusable across types
* Neutral, halfway solution but not fully addressing the problem

### Option 3: Workspace → Project → Context (CHOSEN)

Three-level hierarchy with proper conceptual separation.

```typescript
interface Workspace {
  id: string;
  name: string;
  path: string;
  projects: Project[];
}

interface Project {
  id: string;
  name: string;
  description: string;
  contexts: Context[];
  active_context_id?: string;
}

interface Context {
  id: string;
  name: string;
  template_type: string;
  icon: string;
  color: string;
}

interface Codex {
  id: string;
  project_id: string;      // Which real-world project
  context_ids: string[];   // Which contexts (can be multiple!)
  // ...
}
```

* Good, because matches real-world mental model perfectly
* Good, because Codices can appear in multiple contexts
* Good, because each context can have different organization/views
* Good, because scales easily (add contexts without restructuring)
* Good, because clear conceptual boundaries
* Good, because supports future features (context-specific automation, cross-context links)
* Bad, because requires Phase 16b refactoring
* Bad, because more complex UI (project + context selectors)
* Bad, because three-level hierarchy vs two-level

### Option 4: Flat Contexts (No Projects)

Workspace contains contexts directly, no project grouping.

```typescript
interface Workspace {
  id: string;
  contexts: Context[];
}
```

* Good, because simplest possible model
* Good, because easy to implement
* Bad, because no grouping of related contexts
* Bad, because doesn't match how users think about work
* Bad, because difficult to manage many contexts
* Bad, because can't have project-level metadata or settings

## Implementation Design

### Database Schema

```sql
-- Workspace (mostly metadata, actual DB is per-workspace)
CREATE TABLE workspaces (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Projects (real-world endeavors)
CREATE TABLE projects (
  id TEXT PRIMARY KEY,
  workspace_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  active_context_id TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (workspace_id) REFERENCES workspaces(id)
);

-- Contexts (organizational lenses within projects)
CREATE TABLE contexts (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  name TEXT NOT NULL,
  template_type TEXT NOT NULL,  -- fiction, research, software, etc.
  icon TEXT,
  color TEXT,
  sort_order INTEGER,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Codices (belong to projects, appear in contexts)
CREATE TABLE codices (
  id TEXT PRIMARY KEY,
  project_id TEXT NOT NULL,
  title TEXT NOT NULL,
  template_id TEXT NOT NULL,
  content TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
);

-- Many-to-many: Codices can appear in multiple contexts
CREATE TABLE codex_contexts (
  codex_id TEXT NOT NULL,
  context_id TEXT NOT NULL,
  is_primary BOOLEAN DEFAULT FALSE,  -- Primary context for this codex
  PRIMARY KEY (codex_id, context_id),
  FOREIGN KEY (codex_id) REFERENCES codices(id) ON DELETE CASCADE,
  FOREIGN KEY (context_id) REFERENCES contexts(id) ON DELETE CASCADE
);
```

### UI Hierarchy

```
┌─────────────────────────────────────────────┐
│ Workspace: Aya's Creative Work              │ ← Workspace Selector
├─────────────────────────────────────────────┤
│ Project: Mythological RPG Game              │ ← Project Selector
│   Context: Story & Narrative ▼             │ ← Context Switcher
│     ├─ Story & Narrative ✓                 │
│     ├─ Mythology Research                   │
│     ├─ Game Mechanics                       │
│     └─ Art & Assets                         │
├─────────────────────────────────────────────┤
│ Navigator (filtered by Context)             │
│   ├─ Characters                             │
│   │   ├─ Zeus                               │ ← Appears in Story + Research
│   │   └─ Athena                             │
│   ├─ Scenes                                 │
│   │   └─ Opening Scene                      │
│   └─ Plotlines                              │
│       └─ Main Quest                         │
└─────────────────────────────────────────────┘
```

### Example Real-World Usage

**User: Game Developer + Writer**

```
Workspace: "Game Development Projects"
│
└── Project: "Mythological RPG"
    ├── Context: "Story & Narrative" (fiction templates)
    │   └── Codices: Characters, Scenes, Plotlines, Dialogue
    │       └── Zeus (also in Mythology Research context)
    │
    ├── Context: "Mythology Research" (research templates)
    │   └── Codices: Gods, Myths, Historical Notes, References
    │       └── Zeus (also in Story & Narrative context)
    │
    ├── Context: "Game Mechanics" (software templates)
    │   └── Codices: Features, Bugs, Code Files, Design Docs
    │
    └── Context: "Art & Assets" (creative templates)
        └── Codices: Concept Art, Character Models, Textures
```

**Workflow**:
1. Morning: Switch to "Story & Narrative" context, write dialogue scene
2. Afternoon: Switch to "Mythology Research" context, research Zeus myths
3. Evening: Switch to "Game Mechanics" context, implement dialogue system

**Same Codex, Different Views**:
- "Zeus" Codex appears in both "Story" and "Research" contexts
- In Story context: Organized by narrative role, shows character arc
- In Research context: Organized by mythological category, shows source citations

## Migration from Phase 16b

Current Phase 16b model has "Projects" which are actually "Contexts" in the new model.

### Migration Strategy

```typescript
async function migratePhase16bToPhase17(workspace: Workspace): Promise<void> {
  // 1. Create default Project for workspace
  const defaultProject = await createProject({
    name: `${workspace.name} Project`,  // or prompt user for name
    description: "Migrated from Phase 16b"
  });

  // 2. Convert each old "Project" to Context
  const oldProjects = await loadOldProjects();

  for (const oldProject of oldProjects) {
    // Create Context from old Project
    const context = await createContext({
      project_id: defaultProject.id,
      name: oldProject.name,
      template_type: oldProject.type,
      icon: oldProject.icon || getDefaultIcon(oldProject.type)
    });

    // Update all Codices
    await db.run(`
      UPDATE codices
      SET project_id = ?
      WHERE old_project_id = ?
    `, [defaultProject.id, oldProject.id]);

    // Link Codices to Context
    await db.run(`
      INSERT INTO codex_contexts (codex_id, context_id, is_primary)
      SELECT id, ?, TRUE
      FROM codices
      WHERE old_project_id = ?
    `, [context.id, oldProject.id]);
  }

  // 3. Update workspace metadata
  await updateWorkspaceSchema();
}
```

### User Experience During Migration

1. User opens Vespera after Phase 17 update
2. System detects Phase 16b schema
3. Shows migration dialog:
   ```
   ┌──────────────────────────────────────────┐
   │ Vespera Update: Improved Organization    │
   │                                          │
   │ Projects now support multiple modes!    │
   │                                          │
   │ Your current "projects" will become     │
   │ organizational contexts within a         │
   │ default project.                         │
   │                                          │
   │ You can:                                 │
   │ • Keep them in one project (recommended) │
   │ • Split into separate projects          │
   │                                          │
   │ [Migrate Automatically] [Custom Setup]   │
   └──────────────────────────────────────────┘
   ```
4. Migration runs, preserves all data
5. User can then reorganize contexts into proper projects

## Future Enhancements

### Phase 18+: Multi-Context Codices
- Codices can belong to multiple contexts simultaneously
- Context-specific views (same Codex, different presentation)
- Cross-context relationships

### Phase 19+: Context Templates
- Pre-defined context sets for project types
- "Game Dev" project → auto-creates Story, Code, Art, Design contexts
- Context-specific automation rules

### Phase 20+: Workspace Collections
- Group related workspaces (e.g., all game dev workspaces)
- Cross-workspace project relationships
- Workspace-level templates and settings

## Links

* Supersedes conceptual model from [ADR-001: Projects as Fundamental](./ADR-001-projects-fundamental.md)
* Refined by [ADR-016: Global Registry + Workspace Storage](./ADR-016-global-registry-storage.md) - Storage implementation
* Relates to [ADR-004: Dynamic Templates](./ADR-004-dynamic-templates.md) - Template types per context
* Relates to [ADR-012: Codices as File Containers](./ADR-012-codices-as-file-containers.md) - What Codices are
* Relates to [ADR-013: Template Composition](./ADR-013-template-composition.md) - Template nesting
* [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Needs update
* [Phase 16b Completion](../phases/PHASE_16b_COMPLETE.md) - What we're refactoring
* [Phase 17 Plan](../phases/PHASE_17_PLAN.md) - Where refactoring happens

---

## Product Owner Notes

From Phase 17 planning discussion:

> "I'm working on a video game project with a co-writer. We're creating a video game based heavily on certain mythology, so we sometimes want to do deep dives into mythology for ideas. This would be the forte of a research mode, which would still come from a template. Some files would cross over between modes, but might be handled differently depending on the template. If we had a story mode and a research mode and a coding mode (for the later coding we'll need to do since it's a video game project) the project really would contain multiple 'project types' within itself."

This ADR formalizes this insight: **Projects are real-world endeavors that naturally span multiple organizational contexts**.

---

*Created: 2025-10-25*
*Updated: 2025-10-25*
*Template version: 1.0.0*
