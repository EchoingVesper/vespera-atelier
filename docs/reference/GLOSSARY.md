# Vespera Atelier Glossary

Comprehensive terminology reference for the Vespera Atelier ecosystem.

---

## A

### ADR (Architecture Decision Record)
A document capturing an important architectural decision, its context, alternatives considered, and consequences. Used to track "why" behind design choices.

### Agent
An AI-powered assistant with specific capabilities and roles (e.g., task-orchestrator, code-writer). Agents can be assigned to tasks or triggered by automation rules.

### Automation Rule
A conditional workflow definition that triggers actions when certain conditions are met. Example: "When scene mood changes to #tense, switch music to battle theme."

---

## B

### Bindery
The Rust-based backend service that manages Codex storage, retrieval, and relationships. Provides JSON-RPC API for frontend integration.

### Breadcrumb
UI navigation element showing the path from a nested Codex to its root ancestor. Example: "Book > Part I > Chapter 1 > Scene 2"

---

## C

### Chat Provider
An LLM service integration (Anthropic, OpenAI, Ollama) configured via templates. Enables AI chat within the application.

### Chat Template
JSON5 configuration file defining a chat provider's API, authentication, and capabilities.

### Codex
The fundamental content unit in Vespera Atelier. A Codex is a structured document with:
- Unique ID
- Project association
- Template type
- Metadata (tags, references)
- Content (markdown, fields)
- Optional parent/children (for nesting)

### Codex ID
Unique identifier (UUID) for a Codex, stored in frontmatter.

### Codex Nesting
Hierarchical parent-child relationships between Codices. Enables Scrivener-style organization where folders can contain both content and children.

### Context
The current state of the application affecting what's visible and available:
- **Project Context**: Which project is active
- **Template Context**: Which templates are shown
- **Task Context**: Which tasks are relevant

### CRDT (Conflict-free Replicated Data Type)
Data structure that enables multi-user collaboration without conflicts. Planned for real-time Codex editing.

---

## D

### Dynamic Template System
Architecture where content types are defined in JSON5 files rather than hardcoded enums. Enables user-created custom templates.

---

## E

### Event
A signal that something changed in the system (tag modified, Codex created, task completed). Events can trigger automation rules.

### Event Router
Service that receives events and dispatches them to interested subscribers (automation engine, UI updates, etc.).

### Extension
The VS Code extension package containing the Vespera Forge UI.

---

## F

### FastMCP
Official Python SDK for implementing MCP (Model Context Protocol) servers. Used by Vespera Scriptorium.

### Field
A structured data element in a template (text, date, markdown, references, etc.). Fields define what data a Codex type can contain.

### Field Schema
JSON definition of a field's type, validation rules, and UI rendering.

### Folder-Codex
A regular Codex that has children. Not a special type - any Codex can become a folder by adding children.

### Frontmatter
YAML metadata block at the top of a .codex.md file containing:
- `codex_id`
- `project_id`
- `template_id`
- `parent_id` (if nested)
- `children` (if folder)
- Custom metadata

---

## H

### Hierarchical Template System
Organization of templates into multi-level categories (projects/, content/, organization/, agents/, etc.) with project-aware filtering.

---

## J

### JSON-RPC
Remote procedure call protocol used by Bindery backend for API communication.

### JSON5
Superset of JSON that allows:
- Comments (// and /* */)
- Trailing commas
- Unquoted keys
- More human-friendly syntax

Used for template files.

---

## M

### MCP (Model Context Protocol)
Standard protocol for AI assistants to interact with external tools and data sources. Vespera Scriptorium implements an MCP server.

### Metadata
Structured data attached to Codices:
- Tags
- References to other Codices
- Custom fields defined by template
- Creation/modification timestamps

### Mixin
A reusable template fragment that can be composed into multiple templates. Example: `has-sources` mixin adds source tracking to any template.

---

## N

### Navigator
The left sidebar panel in VS Code showing:
- Project selector
- Codex tree view
- Folder hierarchies
- Search and filters

### Nesting
Parent-child relationship between Codices. See **Codex Nesting**.

---

## P

### Phase
A development milestone in the Vespera Atelier project. Phases track feature implementation and architectural changes.

### Project
The fundamental organizational unit in Vespera Atelier. Everything exists within a project:
- Unique ID and name
- Type (journalism, research, fiction, etc.)
- Settings and metadata
- Contains all associated Codices

### Project Context
The currently active project, which determines:
- Which Codices are visible
- Which templates are available
- Which tasks are shown

### Project Template
A template defining a project type with:
- Available Codex templates
- Default workflows
- UI customizations
- Example: "Journalism Project" template

### Project Type
Category of project (journalism, research, fiction, documentation, general). Determines which content templates are shown.

### Provider Template
JSON5 configuration for an LLM chat provider (Anthropic, OpenAI, Ollama).

---

## R

### Reference
A link from one Codex to another. Can be:
- **Strong**: Parent-child relationship
- **Weak**: Mentioned/related (e.g., scene references character)

### Role
A set of capabilities assigned to agents or tasks. Example roles: architect, implementer, tester. (Note: Advanced role system with restrictions is planned but not implemented.)

---

## S

### Scrivener
Popular writing software that inspired Vespera's folder-with-content design. Scrivener's "binder" allows folders to have both content and children.

### Subcategory
Second-level template organization within a category. Example: `content/writing/article` where "writing" is subcategory.

### System Template
Built-in template shipped with Vespera Atelier (vs. user-created templates).

---

## T

### Tag
A label attached to a Codex for categorization and automation triggers. Tags can be:
- Simple: `#urgent`
- Structured: `#mood:tense`
- Hierarchical: `#project/phase/milestone`

### Task
A work item managed by the Task Manager. Tasks can be:
- Project-specific or universal
- Hierarchical (parent-child)
- Linked to Codices
- Assigned to roles/agents

### Template
JSON5 file defining a content type with:
- Fields (what data it contains)
- View modes (how it's displayed)
- Workflow states (draft, review, published)
- Actions (operations available)
- Metadata (icon, category, tags)

### Template Category
Top-level template organization:
- **projects/**: Project types
- **content/**: Content types (articles, scenes, notes)
- **organization/**: Organizational structures (folders, collections)
- **agents/**: AI agents
- **chat/**: Chat sessions
- **providers/**: LLM providers

### Template ID
Unique identifier for a template (e.g., "article", "chapter", "interview").

### Template Inheritance
A template can extend a base template, inheriting its fields and adding more. Example: "feature-article" extends "base-article".

### Template Loader
Service that scans `.vespera/templates/` directories, parses JSON5 files, validates schemas, and registers templates.

### Template Registry
In-memory store of all loaded templates, providing lookup by ID, category, tags, or project type.

---

## U

### UI Schema
Part of a template defining how fields are rendered:
- Field layout (vertical, horizontal)
- Sections and grouping
- Labels and placeholders
- Validation messages

### Universal Task
A task with `projectId: null` that appears in all project contexts. Used for system-level or cross-project work.

---

## V

### Vespera Atelier
The overall monorepo and ecosystem of tools for creative professionals and knowledge workers.

### Vespera Forge
The VS Code extension providing the UI for Codex management, template editing, and chat integration.

### Vespera Scriptorium
The FastMCP-based Python backend server providing task orchestration, project management, and MCP tool integration.

### View Mode
A layout configuration in a template defining how fields are arranged and displayed. Templates can have multiple view modes (default, compact, detailed).

---

## W

### Webview
VS Code UI component that renders HTML/React interfaces. Navigator and Chat use webviews.

### Workspace
VS Code concept for the root directory of a project. In Vespera, a workspace can contain multiple Projects.

### Workflow State
A stage in a content lifecycle defined by a template. Example states: draft, review, published. Templates define valid transitions between states.

---

## X

### (No entries)

---

## Y

### YAML Frontmatter
See **Frontmatter**.

---

## Z

### (No entries)

---

## Common Acronyms

- **ADR**: Architecture Decision Record
- **API**: Application Programming Interface
- **CRDT**: Conflict-free Replicated Data Type
- **JSON**: JavaScript Object Notation
- **JSON5**: JSON for Humans (superset of JSON)
- **LLM**: Large Language Model
- **MCP**: Model Context Protocol
- **UUID**: Universally Unique Identifier
- **UI**: User Interface
- **UX**: User Experience
- **VS Code**: Visual Studio Code
- **YAML**: YAML Ain't Markup Language

---

## Deprecated Terms

### CodexType (Deprecated in Phase 15)
Previously a hardcoded TypeScript enum defining content types. Replaced by dynamic JSON5 templates.

### Session (Deprecated in V2)
V1's task grouping mechanism. Replaced by hierarchical projects and tasks in V2.

---

## Planned Terms (Not Yet Implemented)

### Automation Chain
Sequence of automation rules that trigger each other in cascade. Example: Scene completion → Character update → Task creation → Music change.

### Automation Engine
Service that processes events, matches rules, and executes actions. Designed but not implemented.

### LLM-Assisted Rule Creation
Feature where users describe automation in natural language, and an LLM converts it to executable rules. Planned.

### Real-Time Reactive Content
System where content changes immediately trigger UI updates and automation. Designed in architecture docs but not implemented.

---

*Last Updated: Phase 15 - October 2025*

*For architecture-specific terms, see individual [architecture documents](../architecture/core/)*
