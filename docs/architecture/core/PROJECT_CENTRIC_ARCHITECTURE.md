# Project-Centric Architecture

**Status**: Core Architecture | **Version**: 1.0.0 | **Date**: 2025-10-23

---

## Overview

Vespera Atelier's architecture places **Projects** at the foundational center of all operations. Everything in the system exists within a Project context, from Codices and templates to tasks and workflows. This design decision reflects real-world creative and research workflows where work is naturally organized around distinct projects.

## Core Principle

> **Projects are not optional—they are fundamental.**

Every Codex, template, task, and workflow exists within a Project. The system requires users to create or select a project before they can begin working. This project-first approach ensures:

1. **Clear context boundaries** - Content belongs to specific projects
2. **Reduced cognitive load** - Users always know what project they're in
3. **Better organization** - Multi-project vaults stay organized
4. **Context-aware features** - Templates, tasks, and automation adapt to project type

---

## Architectural Components

### 1. Project Entity

```typescript
interface Project {
  id: string;                    // Unique project identifier
  name: string;                  // Display name
  type: ProjectType;             // journalism, research, fiction, etc.
  description?: string;          // Optional project description
  created: Date;                 // Creation timestamp
  updated: Date;                 // Last modification timestamp
  metadata: ProjectMetadata;     // Extended metadata
  settings: ProjectSettings;     // Project-specific settings
}

interface ProjectMetadata {
  template: string;              // Project template ID
  tags: string[];                // Project-level tags
  icon?: string;                 // Optional icon
  color?: string;                // Optional color theme
}

interface ProjectSettings {
  defaultCodexTemplate?: string; // Default template for new Codices
  enabledAutomation: boolean;    // Automation on/off
  chatProvider?: string;         // Default LLM provider
}
```

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

### 3. Project Context Switching

The system maintains a **current project context** that determines:
- Which templates appear in creation menus
- Which Codices are visible in Navigator
- Which tasks are shown in Task Manager
- Which automation rules are active

**Context switching happens through**:
- Navigator project selector (dropdown/sidebar)
- Quick-switch command palette action
- Automatic detection when opening Codex files

```typescript
interface ProjectContext {
  currentProject: Project;
  availableTemplates: Template[];      // Filtered by project type
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

## Multi-Project Workspace

Vespera Atelier supports **multiple projects within a single workspace** (vault):

### Directory Structure
```
workspace/
├── .vespera/
│   ├── projects/
│   │   ├── project-1/              # Project-specific data
│   │   │   ├── config.json         # Project settings
│   │   │   ├── templates/          # Custom templates
│   │   │   └── automation/         # Automation rules
│   │   └── project-2/
│   │       ├── config.json
│   │       └── ...
│   ├── templates/                  # Shared/system templates
│   ├── prompts/                    # LLM prompts
│   └── chat-templates/             # Chat provider configs
├── content/                        # All Codex files
│   ├── project-1-codex.codex.md
│   ├── project-2-codex.codex.md
│   └── ...
└── ...
```

### Project Association

Codex files are associated with projects through YAML frontmatter:

```markdown
---
codex_id: "uuid-here"
project_id: "project-1"
template_id: "interview"
---

# Interview with Source A
...
```

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
