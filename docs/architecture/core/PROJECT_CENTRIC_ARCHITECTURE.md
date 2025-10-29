# Project-Centric Architecture

**Status**: Core Architecture | **Version**: 2.0.0 (Phase 17) | **Date**: 2025-10-29
**Previous Version**: [1.0.0 (Phase 15)](#legacy-two-level-model-phase-15)

---

## ⚠️ Phase 17 Update: Three-Level Hierarchy

**Breaking Change**: Phase 17 (October 2025) refactored the architecture from a **two-level** to a **three-level hierarchy**:

**Before (Phase 15-16)**: `Workspace → Project → Codex`
**After (Phase 17)**: `Workspace → Project → Context → Codex`

### Key Changes

1. **New "Project" Definition**: Real-world creative endeavors (e.g., "My Novel", "Research Paper", "D&D Campaign")
2. **New "Context" Concept**: Organizational lenses within a project (e.g., "Story", "Research", "Mechanics", "Art")
3. **Phase 16b Migration**: Old "Projects" renamed to "Contexts"
4. **Global Registry**: Cross-workspace project tracking in `~/.vespera/`
5. **Workspace Discovery**: Flexible `.vespera/` detection algorithm

**Related ADRs**:
- [ADR-015: Workspace/Project/Context Hierarchy](../../development/decisions/ADR-015-workspace-project-context-hierarchy.md)
- [ADR-016: Global Registry + Workspace Storage](../../development/decisions/ADR-016-global-registry-storage.md)

**Migration Status**: Phase 16b data verified compatible, migrations tested. See [PHASE_17_STAGE_0_COMPLETE.md](../../development/phases/PHASE_17_STAGE_0_COMPLETE.md)

---

## Overview

Vespera Atelier's architecture places **Projects** at the foundational center of all operations. Everything in the system exists within a Project context, organized through multiple **Contexts** (organizational lenses), from Codices and templates to tasks and workflows. This design decision reflects real-world creative and research workflows where work is naturally organized around distinct projects with multiple organizational perspectives.

## Core Principle (Updated Phase 17)

> **Projects are not optional—they are fundamental.
> Contexts provide flexible organizational lenses within projects.**

Every Codex, template, task, and workflow exists within a **Project** and is organized through one or more **Contexts**. The system requires users to create or select a project before they can begin working. This project-first, context-aware approach ensures:

1. **Clear context boundaries** - Content belongs to specific projects and appears in relevant contexts
2. **Reduced cognitive load** - Users always know what project and context they're in
3. **Better organization** - Multi-project workspaces stay organized with flexible context-based views
4. **Context-aware features** - Templates, tasks, and automation adapt to project type and active context
5. **Multi-perspective content** - Same codex can appear in multiple organizational contexts

---

## Architectural Components (Phase 17)

### 1. Three-Level Hierarchy

```
Workspace (VS Code folder)
  └─ Project (real-world endeavor)
      └─ Context (organizational lens)
          └─ Codex (content entry)
```

### 2. Project Entity (NEW in Phase 17)

Projects represent **real-world creative endeavors** spanning multiple organizational contexts.

```typescript
interface IProject {
  // Identity
  id: ProjectId;                   // UUID
  workspace_id: WorkspaceId;       // Owning workspace
  name: string;                    // "My Novel", "Research Paper"
  description?: string;            // Optional project description

  // Project Classification
  project_type: string;            // journalism, research, fiction, game-dev, etc.

  // Context Management
  active_context_id?: string;      // Currently active context

  // Metadata
  settings?: Record<string, any>;  // JSON settings blob
  created_at: string;              // ISO 8601 timestamp
  updated_at: string;              // ISO 8601 timestamp
}
```

**Storage**:
- **Database**: SQLite via Bindery backend (`projects` table)
- **Global Registry**: `~/.vespera/projects-registry.json` (cross-workspace tracking)

### 3. Context Entity (RENAMED from "Project" in Phase 16b)

Contexts are **organizational lenses** within a project (e.g., "Story", "Research", "Mechanics").

```typescript
interface IContext {
  // Identity
  id: string;                      // UUID
  project_id: string;              // Parent project (FK)
  name: string;                    // "Story & Narrative", "Mythology Research"
  description?: string;            // Optional description

  // Organization
  context_type: string;            // Matches template projectTypes filter
  icon?: string;                   // Optional icon
  color?: string;                  // Optional color theme
  sort_order?: number;             // Display order

  // Metadata
  settings?: Record<string, any>;  // JSON settings blob
  created_at: string;              // ISO 8601 timestamp
  updated_at: string;              // ISO 8601 timestamp
  metadata: ContextMetadata;       // Extended metadata
}

interface ContextMetadata {
  createdAt: Date;
  updatedAt: Date;
  tags?: string[];
  customFields?: Record<string, any>;
}
```

**Storage**:
- **File-based**: `.vespera/contexts/<context-id>.json`
- **Database**: SQLite via Bindery backend (`contexts` table, FK to `projects`)

### 4. Codex-Context Relationships

Codices can appear in **multiple contexts** within the same project (many-to-many):

```typescript
interface CodexContextLink {
  codex_id: string;       // FK to codices
  context_id: string;     // FK to contexts
  is_primary: boolean;    // One context is "primary" (where created)
  added_at: string;       // ISO 8601 timestamp
  sort_order?: number;    // Sort within context
}
```

**Example**: A "Zeus" character codex appears in:
- "Story & Narrative" context (primary)
- "Mythology Research" context (reference)
- "Art & Assets" context (for visual design)

### 2. Project Types

Projects are created from **Project Templates** that define:
- Available Codex templates (content types)
- Default workflows and automation rules
- UI customizations and themes
- Integration configurations

**Built-in Project Templates**:
- **Journalism** - Interviews, sources, articles, fact-checking
- **Research** - Papers, notes, references, experiments
- **Fiction** - Characters, scenes, chapters, worldbuilding
- **Documentation** - Technical docs, guides, API references
- **General** - Flexible catch-all for custom workflows

### 5. Global Registry (NEW in Phase 17)

Projects are tracked in a **global registry** outside the workspace for cross-workspace awareness:

**Location** (platform-specific):
- **Windows**: `%APPDATA%\Vespera\projects-registry.json`
- **macOS**: `~/Library/Application Support/Vespera/projects-registry.json`
- **Linux**: `~/.local/share/vespera/projects-registry.json`

```typescript
interface ProjectsRegistry {
  version: string;
  last_updated: string;  // ISO 8601
  projects: Record<string, ProjectRegistryEntry>;
}

interface ProjectRegistryEntry {
  id: string;
  name: string;
  workspace_path: string;      // Absolute path to workspace
  project_type: string;
  last_opened: string;         // ISO 8601
  active_context_id?: string;
  created_at: string;
  updated_at: string;
}
```

**Use Cases**:
- Quick project switching across workspaces
- Recent projects list
- Project discovery without filesystem scanning
- Cross-workspace project relationships

### 6. Workspace Discovery (NEW in Phase 17)

The system finds Vespera workspaces using a three-strategy algorithm:

1. **Workspace Root**: Check current VS Code workspace for `.vespera/`
2. **Tree Traversal**: Search up directory tree (max 5 levels)
3. **Registry Lookup**: Check global registry for projects at current path

```typescript
interface WorkspaceDiscoveryResult {
  found: boolean;
  vesperaPath?: string;           // Path to .vespera/
  metadata?: WorkspaceMetadata;
  discoveryMethod?: 'workspace-root' | 'tree-traversal' | 'registry' | 'none';
}
```

**Workspace Metadata** (`.vespera/workspace.json`):
```typescript
interface WorkspaceMetadata {
  id: string;                   // Workspace UUID
  name: string;                 // Display name
  version: string;              // Schema version
  created_at: string;
  settings: {
    default_project_id?: string;
    auto_sync: boolean;
    template_path?: string;
    enable_rag?: boolean;
    enable_graph?: boolean;
  };
}
```

### 7. Project & Context Switching

The system maintains a **current project and context** that determines:
- Which templates appear in creation menus
- Which Codices are visible in Navigator
- Which tasks are shown in Task Manager
- Which automation rules are active

**Switching happens through**:
- Navigator project selector (top dropdown)
- Navigator context selector (second dropdown)
- Quick-switch command palette action
- Automatic detection when opening Codex files

```typescript
interface ActiveProjectContext {
  currentProject: IProject;
  currentContext: IContext;
  availableTemplates: Template[];      // Filtered by context type
  activeTasks: Task[];                 // Project-specific tasks
  automationRules: AutomationRule[];   // Project automation
}
```

---

## First-Time User Experience

When a user first launches Vespera Atelier with no existing projects:

1. **Welcome Screen** appears with project type selection
2. User chooses project template (journalism, research, etc.)
3. User provides project name and optional description
4. System creates `.vespera/projects/<project-id>/` structure
5. Navigator opens with new project selected
6. User can now create Codices using project-appropriate templates

**No bypass**: Users cannot skip project creation. The system will not allow creating Codices without an active project.

---

## Multi-Project Workspace (Updated Phase 17)

Vespera Atelier supports **multiple projects within a single workspace**, each with multiple contexts:

### Directory Structure (Phase 17)
```
workspace/
├── .vespera/
│   ├── workspace.json              # Workspace metadata
│   ├── contexts/                   # Context definitions (NEW)
│   │   ├── context-1.json          # Story & Narrative context
│   │   ├── context-2.json          # Research context
│   │   └── context-3.json          # Mechanics context
│   ├── templates/                  # Shared/system templates
│   ├── prompts/                    # LLM prompts
│   └── chat-templates/             # Chat provider configs
├── content/                        # All Codex files
│   ├── character-zeus.codex.md     # Can appear in multiple contexts
│   ├── research-note.codex.md
│   └── ...
└── ...

# Global Registry (outside workspace)
~/.vespera/                          # Or platform equivalent
├── projects-registry.json           # Cross-workspace project index
├── templates/                       # Global templates
├── cache/                           # Cached data
└── logs/                            # Extension logs
```

### Project & Context Association

Codex files are associated with projects through YAML frontmatter:

```markdown
---
codex_id: "uuid-here"
project_id: "proj-mythological-rpg"
template_id: "character"
---

# Zeus - King of the Gods
...
```

**Codex-Context links** are stored in the database (`codex_contexts` join table), not in the Codex file itself. This allows a single Codex to appear in multiple contexts without file duplication.

### Cross-Project Features

- **Codex linking**: Codices can reference Codices from other projects
- **Template sharing**: Templates can be copied between projects
- **Task inheritance**: Universal tasks appear in all projects
- **Search scope**: Global search or project-specific filtering

---

## Template Availability by Project

Templates are **context-aware** based on the current project type:

```typescript
interface TemplateAvailability {
  projectType: ProjectType;
  availableCategories: TemplateCategory[];
  recommendedTemplates: string[];
}
```

**Example - Journalism Project**:
- **Content**: interview, article, source, fact-check
- **Organization**: folder, collection, timeline
- **Agents**: task-orchestrator, code-writer
- **Chat**: ai-chat
- **Providers**: anthropic, openai

**Example - Research Project**:
- **Content**: paper, experiment, note, reference
- **Organization**: folder, collection, graph
- **Agents**: task-orchestrator, research-assistant
- **Chat**: ai-chat

Users can still access **Advanced > All Templates** to create any template type, but the default menu is filtered by project type.

---

## Task Management Within Projects

### Project-Specific Tasks

Tasks belong to projects and appear in the Task Manager when that project is active:

```typescript
interface Task {
  id: string;
  projectId: string | null;  // null = universal task
  title: string;
  status: TaskStatus;
  dueDate?: Date;
  assignedTo?: string;
  linkedCodex?: string;      // Optional Codex association
}
```

### Universal Tasks

Tasks with `projectId: null` are **universal** and appear in all project contexts:
- System maintenance tasks
- Cross-project coordination
- Personal reminders

### Task Context Filtering

The Task Manager shows:
- **Current Project**: All tasks for the active project
- **Universal**: Universal tasks (always visible)
- **All Projects**: Optional view showing all tasks across all projects

---

## Automation and Project Context

Automation rules are **project-scoped** by default:

```typescript
interface AutomationRule {
  id: string;
  projectId: string | null;  // null = global rule
  trigger: AutomationTrigger;
  conditions: Condition[];
  actions: Action[];
  enabled: boolean;
}
```

### Project-Specific Automation

- Rules only activate when their project is current
- Tag changes in Codices trigger project-specific workflows
- Example: `scene-mood` tag change in fiction project triggers music update

### Global Automation

Rules with `projectId: null` run regardless of current project:
- System-level workflows
- Cross-project synchronization
- Global tag processing

---

## Folder-Codices and Nesting

Folder-Codices are **regular Codices that can contain children**:

```typescript
interface FolderCodex extends Codex {
  children: string[];  // Array of child Codex IDs
  expanded: boolean;   // UI state
}
```

**Key characteristics**:
- Folder-Codices have both content AND children (like Scrivener)
- Not a special template type—any Codex can become a folder
- Nesting is unlimited depth
- Children can be any Codex type (including other folder-Codices)

**Use cases**:
- Chapter containing scenes
- Research topic containing notes
- Article containing interview transcripts
- Documentation section containing pages

See [CODEX_NESTING.md](./CODEX_NESTING.md) for implementation details.

---

## Migration Path

### From V1 (Pre-Project-Centric)

For users upgrading from V1:

1. **Auto-migration**: System detects legacy Codices without `project_id`
2. **Default project creation**: Creates "Imported Project" if none exist
3. **Frontmatter update**: Adds `project_id` to all legacy Codices
4. **User prompt**: Offers to reorganize Codices into new projects

### Clean Slate Approach

For new installations:
- No migration needed
- Project creation required on first launch
- Clean, organized structure from day one

---

## Benefits of Project-Centric Design

1. **Cognitive clarity**: Always know what project you're in
2. **Reduced clutter**: Only see relevant content and templates
3. **Better organization**: Natural boundaries for content
4. **Context-aware features**: System adapts to project type
5. **Multi-project support**: Clean separation when working on multiple projects
6. **Scalability**: Architecture scales to hundreds of projects

---

## Related Documentation

- [Hierarchical Template System](./HIERARCHICAL_TEMPLATE_SYSTEM.md) - Template organization by project type
- [Codex Nesting](./CODEX_NESTING.md) - Folder-Codices implementation
- [Multi-Project Vault Organization](./MULTI_PROJECT_VAULT_ORGANIZATION.md) - Managing multiple projects
- [Template System Architecture](./TEMPLATE_SYSTEM_ARCHITECTURE.md) - Template loading and filtering

---

## Architecture Decision Records

- [ADR-001: Projects as Fundamental Entities](../../development/decisions/ADR-001-projects-fundamental.md)
- [ADR-002: Project Context Switching](../../development/decisions/ADR-002-project-context-switching.md)
- [ADR-003: Template Filtering by Project](../../development/decisions/ADR-003-template-filtering.md)
