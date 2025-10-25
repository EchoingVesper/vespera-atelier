# ADR-012: Codices as Universal File Containers with Metadata

**Status**: Accepted
**Date**: 2025-10-25
**Deciders**: Aya (Product Owner), Claude Code
**Technical Story**: [Phase 17: Codex Editor Implementation](../phases/PHASE_17_PLAN.md)

---

## Context and Problem Statement

What is the fundamental purpose and architecture of Codices in the Vespera system? How should Codices relate to the various file types users need to manage in creative and professional projects (documents, media, code, etc.)?

Early implementation focused on Codices as standalone content objects, but this doesn't capture the full vision of Codices as a **universal metadata and organization layer** for any type of file or content.

## Decision Drivers

* **Universal Project Management**: Need to support diverse project types (novels, games, journalism, RPGs, art books, etc.)
* **File Diversity**: Users work with many file types: Markdown, code, images, audio, video, documents
* **RAG System Requirements**: Vector and graph RAG systems need structured metadata for context management
* **Task Automation**: Automated workflows need to operate on any content type with consistent metadata
* **Database Integration**: All files should be queryable and manageable through the Bindery backend
* **LLM Context Management**: AI assistants need unified access to all project content regardless of format

## Considered Options

1. **Codices as Standalone Content** - Codices contain content directly in their structure
2. **Codices as File Containers with Metadata** - Codices are wrappers that add metadata to external files
3. **Hybrid Approach** - Codices can either contain content directly OR reference external files

## Decision Outcome

Chosen option: **"Codices as File Containers with Metadata"** (with hybrid capability), because it provides the most flexibility and aligns with the vision of Vespera as a universal project management system.

**Core Principle**: Codices are essentially a way to add specialized metadata to any file for use in managing them. They link files into the database for management by both the task system and the RAG (vector and graph) system for automated context management.

### Positive Consequences

* **Universal Support**: Any file type can be managed through the Codex system
* **Consistent Metadata**: All content has the same metadata structure (tags, relationships, project context)
* **RAG Integration**: Vector embeddings and graph relationships work across all content types
* **Task Automation**: Workflows can operate uniformly on any content type
* **Import/Index External Data**: Users can automatically import and organize existing files
* **Future-Proof**: New file types and editors can be added without changing core architecture
* **Specialized Tooling**: Each file type can use its optimal editor (VS Code for code/Markdown, specialized tools for media)

### Negative Consequences

* **Complexity**: Need to handle file references, external editors, and sync between files and database
* **Editor Diversity**: Must support multiple editing paradigms (embedded editors, external editors, hybrid)
* **File System Integration**: Need robust file watching and synchronization mechanisms
* **Storage Strategy**: Must decide when to embed content vs reference external files

## Pros and Cons of the Options

### Option 1: Codices as Standalone Content

Pure database-centric approach where Codices contain all content in their structure.

* Good, because simpler data model (everything in database)
* Good, because no file synchronization issues
* Good, because easier to implement RAG indexing
* Bad, because limited to text-based content
* Bad, because can't leverage specialized external editors
* Bad, because difficult to import existing projects
* Bad, because doesn't support binary files (audio, video, images) well
* Bad, because forces users into unfamiliar editing workflows

### Option 2: Codices as File Containers with Metadata (CHOSEN)

Codices are primarily metadata wrappers around files, with the database managing organization and relationships.

* Good, because supports ANY file type (text, binary, code, media)
* Good, because users can use their preferred editors (VS Code, audio editors, image tools)
* Good, because easy to import existing projects (just add metadata)
* Good, because file-system-first approach feels familiar
* Good, because enables "chameleon" behavior - system adapts to project needs
* Good, because aligns with VS Code extension architecture
* Good, because metadata can be versioned independently of content
* Bad, because requires file watching and synchronization
* Bad, because need to handle external file moves/deletes
* Bad, because more complex state management (file + database)
* Bad, because potential for file/database inconsistency

### Option 3: Hybrid Approach

Codices can contain content directly OR reference external files depending on use case.

* Good, because maximum flexibility
* Good, because can optimize per content type
* Bad, because two different architectures to maintain
* Bad, because confusing mental model for users
* Bad, because RAG system must handle both approaches
* Neutral, eventually needed but adds complexity for MVP

## Implementation Notes

### MVP Scope (Phase 17-18)

For MVP, focus on two file type categories:

1. **Markdown Files** (`.md`)
   - Can use VS Code's built-in Markdown editor
   - View mode provides "rich text experience"
   - Well-suited for embedded editing

2. **Code Files** (`.ts`, `.js`, `.py`, etc.)
   - Use VS Code's native editor
   - Syntax highlighting and tooling already available
   - Familiar workflow for developers

### Future Expansion

Additional file type support to add in later phases:

* **Images** (`.png`, `.jpg`, `.svg`) - Display inline, open in external editor
* **Audio** (`.mp3`, `.wav`, `.ogg`) - Audio player widget, waveform visualization
* **Video** (`.mp4`, `.webm`) - Video player widget, thumbnail generation
* **Documents** (`.pdf`, `.docx`) - Viewer integration, metadata extraction
* **Rich Text** - TipTap or similar WYSIWYG editor integration
* **Data Files** (`.json`, `.csv`, `.xml`) - Structured data editors

### Template-Driven Editor Selection

Templates should specify which editor type to use:

```json5
{
  template_id: "screenplay-scene",
  editor_type: "markdown",  // or "code", "rich-text", "external", etc.
  file_extension: ".md",
  // ...
}
```

### Metadata Structure

Core metadata attached to all Codices regardless of file type:

* `id` - Unique identifier
* `title` - Display name
* `template_id` - Template defining structure
* `project_id` - Project context
* `file_path` - Path to actual file (if external)
* `tags` - User-defined tags
* `references` - Links to other Codices
* `created_at` - Creation timestamp
* `updated_at` - Last modification timestamp
* `content_hash` - Hash for change detection

## Links

* Relates to [ADR-001: Projects as Fundamental](./ADR-001-projects-fundamental.md) - Projects contain Codices
* Relates to [ADR-004: Dynamic Templates Over Hardcoded Types](./ADR-004-dynamic-templates.md) - Templates define Codex structure
* Relates to [ADR-007: Codex-Based Folders](./ADR-007-codex-folders.md) - Nesting structure
* Refined by [ADR-013: Template Composition and Nesting](./ADR-013-template-composition.md) - Template linking
* Refined by [ADR-014: Content Chunking via Template Size Limits](./ADR-014-content-chunking.md) - RAG optimization
* [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)
* [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md)

---

## Architectural Vision

From product owner notes (Phase 17 planning):

> "Many Codex types are intended to be containers for other file types, including documents of many sorts (.md most important), but also sound and video files, images, and even code files. Codices are, in essence, a way for me to attempt to link all files into the database such that they can be managed by both the task system and the RAG (vector and graph) system for automated context management for LLMs and users alike.
>
> The user will need to be able to import and index outside data into Codices automatically, to aid with organization. Codices are in many ways effectively a way for me to add specialized metadata to any file for use in managing them.
>
> These files will eventually need editors of their own, because the ultimate goal here is to make a single, comprehensive, management system for any sort of project, whether a novel, a video game, a journalistic magazine, a tabletop RPG, an art book, and so on and on. **This is why there's such a huge emphasis on templates; because this thing is intended to be a chameleon that transforms based on an individual user and project's needs and desires.**"

This ADR formalizes this vision as the core architectural principle of the Vespera system.

---

*Created: 2025-10-25*
*Updated: 2025-10-25*
*Template version: 1.0.0*
