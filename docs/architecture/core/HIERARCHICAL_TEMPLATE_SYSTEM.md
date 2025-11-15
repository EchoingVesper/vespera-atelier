# Hierarchical Template System

**Status**: Core Architecture | **Version**: 1.0.0 | **Date**: 2025-10-23

---

## Overview

The Hierarchical Template System organizes templates into a **multi-level category structure** that adapts to project context. Templates are both **file-based** (organized in directories) and **metadata-driven** (searchable by tags and categories).

This architecture replaces the old hardcoded `CodexType` enum with a dynamic, extensible template system where users can create custom templates without modifying code.

---

## Core Principles

1. **No Hardcoded Types**: Everything is template-driven
2. **Hierarchical Organization**: Templates organized in categories and subcategories
3. **Context-Aware**: Available templates depend on project type
4. **User Extensible**: Users can create custom templates via JSON5 files
5. **Metadata Driven**: Templates are discoverable via search, tags, and categories

---

## Template Hierarchy

### Category Structure

```
Templates/
├── projects/                # Project-level templates
│   ├── journalism/
│   ├── research/
│   ├── fiction/
│   └── documentation/
├── content/                 # Content-type templates
│   ├── writing/
│   │   ├── article
│   │   ├── chapter
│   │   └── scene
│   ├── research/
│   │   ├── paper
│   │   ├── experiment
│   │   └── note
│   └── people/
│       ├── character
│       ├── interview
│       └── source
├── organization/            # Organizational templates
│   ├── folder
│   ├── collection
│   ├── timeline
│   └── graph
├── agents/                  # AI agent templates
│   ├── task-orchestrator
│   ├── code-writer
│   ├── research-assistant
│   └── docs-writer
├── chat/                    # Chat session templates
│   └── ai-chat
└── providers/               # LLM provider configs
    ├── anthropic
    ├── openai
    └── ollama
```

### Category Definitions

```typescript
enum TemplateCategory {
  PROJECTS = 'projects',        // Project types
  CONTENT = 'content',          // Content types
  ORGANIZATION = 'organization',// Organizational structures
  AGENTS = 'agents',            // AI agents
  CHAT = 'chat',                // Chat sessions
  PROVIDERS = 'providers',      // LLM providers
  ADVANCED = 'advanced'         // System/advanced templates
}
```

---

## Template Definition Format

Templates are defined in JSON5 files with the following schema:

```typescript
interface Template {
  // Identification
  template_id: string;               // Unique identifier
  name: string;                      // Display name
  description: string;               // Description
  version: string;                   // Template version

  // Classification
  category: TemplateCategory;        // Primary category
  subcategory?: string;              // Optional subcategory
  tags: string[];                    // Searchable tags

  // Inheritance
  baseTemplate?: string;             // Parent template ID
  mixins?: string[];                 // Mixin template IDs

  // UI Schema
  icon?: string;                     // Icon identifier
  color?: string;                    // Theme color
  fields: FieldDefinition[];         // Form fields
  viewModes: ViewMode[];             // Display modes

  // Behavior
  workflowStates?: WorkflowState[];  // State machine
  actions?: ActionDefinition[];      // Available actions
  automationHooks?: AutomationHook[];// Automation integration

  // Styling
  styling?: TemplateStyles;          // Custom styling

  // Context
  projectTypes?: ProjectType[];      // Available for these projects
  contexts?: string[];               // UI contexts where shown
}
```

### Example Template

```json5
// .vespera/templates/content/writing/article.json5
{
  template_id: "article",
  name: "Article",
  description: "News or feature article",
  version: "1.0.0",
  category: "content",
  subcategory: "writing",
  tags: ["journalism", "writing", "publication"],
  icon: "📄",
  color: "#4A90E2",

  projectTypes: ["journalism", "documentation"],

  fields: [
    {
      id: "title",
      type: "text",
      label: "Title",
      required: true,
      placeholder: "Article headline..."
    },
    {
      id: "byline",
      type: "text",
      label: "Byline",
      placeholder: "By Author Name"
    },
    {
      id: "publication_date",
      type: "date",
      label: "Publication Date"
    },
    {
      id: "content",
      type: "markdown",
      label: "Content",
      multiline: true
    },
    {
      id: "sources",
      type: "references",
      label: "Sources",
      accepts: ["source", "interview"]
    }
  ],

  viewModes: [
    {
      id: "default",
      name: "Default",
      layout: "vertical",
      sections: [
        {
          title: "Metadata",
          fields: ["title", "byline", "publication_date"]
        },
        {
          title: "Content",
          fields: ["content"]
        },
        {
          title: "Sources",
          fields: ["sources"]
        }
      ]
    },
    {
      id: "compact",
      name: "Compact",
      layout: "horizontal",
      sections: [
        {
          fields: ["title", "content"]
        }
      ]
    }
  ],

  workflowStates: [
    { id: "draft", name: "Draft", color: "#FFA500" },
    { id: "review", name: "In Review", color: "#4A90E2" },
    { id: "published", name: "Published", color: "#4CAF50" }
  ],

  actions: [
    {
      id: "send_for_review",
      label: "Send for Review",
      icon: "✉️",
      transitions: { from: "draft", to: "review" }
    }
  ]
}
```

---

## Template Loading and Discovery

### File-Based Loading

Templates are loaded from two locations:

1. **System templates**: `.vespera/templates/` (shipped with extension)
2. **User templates**: `.vespera/templates/` (user-created/customized)

```typescript
class TemplateLoader {
  async loadTemplates(): Promise<Template[]> {
    const systemTemplates = await this.loadFromDirectory('.vespera/templates/');
    const userTemplates = await this.loadFromDirectory('.vespera/templates/');

    // User templates override system templates with same ID
    return this.mergeTemplates(systemTemplates, userTemplates);
  }

  async loadFromDirectory(dir: string): Promise<Template[]> {
    const templates: Template[] = [];

    // Recursively scan all subdirectories
    const files = await this.scanDirectory(dir, '**/*.json5');

    for (const file of files) {
      const template = await this.parseTemplate(file);
      if (this.validateTemplate(template)) {
        templates.push(template);
      }
    }

    return templates;
  }
}
```

### Metadata-Based Discovery

Templates can be discovered through:

**Category filtering**:
```typescript
const writingTemplates = templateRegistry.getByCategory('content', 'writing');
```

**Tag searching**:
```typescript
const journalismTemplates = templateRegistry.searchByTags(['journalism']);
```

**Project type filtering**:
```typescript
const projectTemplates = templateRegistry.getForProject('journalism');
```

**Full-text search**:
```typescript
const results = templateRegistry.search('interview source article');
```

---

## Context-Aware Template Display

### Navigator "New" Menu

The Navigator's "New" button shows a **hierarchical menu** filtered by current project:

```
New ▼
├── Article           (content/writing)
├── Interview         (content/people)
├── Source            (content/people)
├── Fact Check        (content/research)
├── Folder            (organization)
├── Collection        (organization)
└── Advanced ▶
    ├── All Templates ▶
    │   ├── Projects ▶
    │   ├── Content ▶
    │   ├── Organization ▶
    │   ├── Agents ▶
    │   ├── Chat ▶
    │   └── Providers ▶
    └── Create Custom Template
```

**Top-level menu** shows:
- Templates where `projectTypes` includes current project type
- Most frequently used templates (personalized)
- Recently used templates

**Advanced submenu** shows:
- **All Templates**: Complete hierarchical tree
- **Create Custom**: Template creation wizard

### Menu Generation Logic

```typescript
class NavigatorMenuBuilder {
  buildNewMenu(project: Project): MenuItem[] {
    const availableTemplates = this.templateRegistry
      .getForProject(project.type)
      .filter(t => t.contexts?.includes('navigator') ?? true);

    const topLevel = availableTemplates
      .slice(0, 8)  // Top 8 templates
      .map(t => ({
        id: t.template_id,
        label: t.name,
        icon: t.icon,
        category: `${t.category}/${t.subcategory}`,
        action: () => this.createCodex(t)
      }));

    const advanced = {
      label: "Advanced",
      submenu: this.buildHierarchicalMenu(this.templateRegistry.getAllTemplates())
    };

    return [...topLevel, advanced];
  }

  buildHierarchicalMenu(templates: Template[]): MenuItem[] {
    const byCategory = this.groupByCategory(templates);

    return Object.entries(byCategory).map(([category, templates]) => ({
      label: this.categoryLabel(category),
      submenu: templates.map(t => ({
        label: t.name,
        icon: t.icon,
        action: () => this.createCodex(t)
      }))
    }));
  }
}
```

---

## Template Inheritance

Templates support **single inheritance** with **multiple mixins**:

### Base Template Inheritance

```json5
// base-article.json5
{
  template_id: "base-article",
  name: "Base Article",
  fields: [
    { id: "title", type: "text", required: true },
    { id: "content", type: "markdown" }
  ]
}

// feature-article.json5 (extends base)
{
  template_id: "feature-article",
  name: "Feature Article",
  baseTemplate: "base-article",
  fields: [
    // Inherits title, content from base
    { id: "featured_image", type: "image" },
    { id: "pull_quote", type: "text" }
  ]
}
```

### Mixin Composition

```json5
// mixins/has-sources.json5
{
  template_id: "has-sources",
  fields: [
    { id: "sources", type: "references", accepts: ["source"] }
  ]
}

// mixins/has-status.json5
{
  template_id: "has-status",
  fields: [
    { id: "status", type: "select", options: ["draft", "review", "published"] }
  ]
}

// article.json5 (uses mixins)
{
  template_id: "article",
  mixins: ["has-sources", "has-status"],
  fields: [
    { id: "title", type: "text" },
    { id: "content", type: "markdown" }
    // Inherits sources from has-sources
    // Inherits status from has-status
  ]
}
```

---

## Template Creation Workflow

### User-Created Templates

Users can create templates through:

1. **Template Wizard**: Guided UI for creating templates
2. **Duplicate & Modify**: Copy existing template and customize
3. **Direct File Creation**: Write JSON5 file in `.vespera/templates/`

### Template Wizard Flow

```
1. Select category (content, organization, etc.)
2. Provide basic info (ID, name, description)
3. Define fields (drag-and-drop field builder)
4. Configure view modes (layout designer)
5. Add workflow states (optional)
6. Set project type availability
7. Save template to `.vespera/templates/`
```

### Template Sharing

Templates can be shared via:
- **Export**: JSON5 file export
- **Template packs**: Bundle of related templates
- **Community templates**: Shared online repository

---

## System Templates

Vespera Atelier ships with these **built-in system templates**:

### Projects
- `journalism` - Journalism project
- `research` - Research project
- `fiction` - Fiction writing project
- `documentation` - Technical documentation
- `general` - General-purpose project

### Content (Journalism)
- `article` - News/feature article
- `interview` - Interview transcript
- `source` - Information source
- `fact-check` - Fact verification

### Content (Research)
- `paper` - Research paper
- `experiment` - Experiment record
- `note` - Research note
- `reference` - Citation/reference

### Content (Fiction)
- `character` - Character profile
- `scene` - Story scene
- `chapter` - Book chapter
- `location` - Setting/location

### Organization
- `folder` - Folder-Codex (Scrivener-style)
- `collection` - Tagged collection
- `timeline` - Chronological timeline
- `graph` - Relationship graph

### Agents
- `task-orchestrator` - Task coordination agent
- `code-writer` - Code writing specialist
- `research-assistant` - Research assistant
- `docs-writer` - Documentation writer

### Chat
- `ai-chat` - AI chat session

### Providers
- `anthropic` - Anthropic Claude
- `openai` - OpenAI GPT
- `ollama` - Local Ollama models

---

## Benefits of Hierarchical System

1. **User Extensibility**: No code changes to add templates
2. **Project Adaptation**: Templates filter by project type
3. **Clean Navigation**: Hierarchical menus reduce clutter
4. **Metadata Search**: Find templates by tags, categories
5. **Template Reuse**: Inheritance and mixins reduce duplication
6. **Community Sharing**: Easy template distribution

---

## Related Documentation

- [Project-Centric Architecture](./PROJECT_CENTRIC_ARCHITECTURE.md) - Project context and filtering
- [Template System Architecture](./TEMPLATE_SYSTEM_ARCHITECTURE.md) - Technical implementation
- [Codex Architecture](./CODEX_ARCHITECTURE.md) - Codex and template relationship

---

## Architecture Decision Records

- [ADR-004: Dynamic Template System](../../development/decisions/ADR-004-dynamic-templates.md)
- [ADR-005: Template Inheritance Model](../../development/decisions/ADR-005-template-inheritance.md)
- [ADR-006: Hierarchical Menu Structure](../../development/decisions/ADR-006-hierarchical-menus.md)
