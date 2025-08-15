# Priority 5: Codex Protocol & Unified View System

## Overview
Implement the shared Codex system in `vespera-utilities/` to provide virtual file organization capabilities for both Vespera Scriptorium and the Obsidian plugin. This system keeps files in their actual locations while providing multiple viewing perspectives.

## Problem Statement
- Current PRP system needs evolution to a more flexible "Codex Protocol"
- Vespera Scriptorium artifacts lack visual organization options
- Obsidian plugin's planned Codex system isn't implemented
- No shared infrastructure between tools for file virtualization
- Files get scattered across projects without coherent organization views

## Solution Architecture

### Core Components (vespera-utilities)

```typescript
packages/vespera-utilities/
├── codex-core/
│   ├── CodexEntry.ts          // Content-agnostic metadata wrapper (docs, images, audio, video, data)
│   ├── ViewEngine.ts          // Multiple view perspectives for any content type
│   ├── SchemaManager.ts       // Template/schema definitions for all media types
│   └── CodexRegistry.ts       // Central registry of all entries regardless of type
├── view-adapters/
│   ├── TimelineView.ts        // Chronological organization
│   ├── KanbanView.ts          // Status-based columns
│   ├── GraphView.ts           // Relationship mapping
│   ├── CardView.ts            // Visual card layout
│   └── LibraryView.ts         // Folder-tree style "grimoire" organization
└── template-system/
    ├── CodexProtocol.ts       // Evolved PRP → Codex system
    ├── ProjectSchema.ts       // Project-type templates
    └── WorkflowTemplates.ts   // Orchestration patterns
```

### View System Philosophy
- **Files stay in place**: Never move actual files
- **Content-agnostic**: Works with documents, images, audio, video, data files, code
- **Virtual organization**: Multiple concurrent view perspectives for any content type
- **Library metaphor**: Organize Codex entries into "books"/"grimoires" regardless of media
- **Cross-tool compatibility**: Same views work in CLI and GUI
- **Media-aware displays**: Views adapt to content type (gallery for images, playlist for audio)

## Implementation Tasks

### Phase 1: Core Infrastructure
1. Create `vespera-utilities` package structure
2. Implement CodexEntry abstraction layer
3. Build ViewEngine with plugin architecture
4. Design SchemaManager for template definitions

### Phase 2: View Adapters
1. Implement LibraryView (folder-tree organization for all content types)
2. Create TimelineView for chronological display (with media previews)
3. Build KanbanView for status tracking (works with any file type)
4. Develop GraphView for relationship visualization (links between any content)
5. Add CardView for visual browsing (adapts to images, docs, audio covers)
6. Create GalleryView for image collections
7. Build PlaylistView for audio/video content

### Phase 3: Template System
1. Evolve PRP system to Codex Protocol
2. Create content-type schemas:
   - Document schemas (markdown, PDFs, notes)
   - Media schemas (images, audio, video metadata)
   - Project schemas (code, documentation, assets)
   - Data schemas (CSV, JSON, databases)
3. Create project schema templates:
   - Web application projects
   - API development projects
   - Data analysis workflows
   - Documentation projects
   - Creative projects (art, music, writing)
4. Build workflow templates for common patterns

### Phase 4: Integration
1. Integrate with Vespera Scriptorium orchestrator
2. Add Codex views to `.task_orchestrator/` artifacts
3. Prepare Obsidian plugin integration points
4. Create CLI visualization tools

## Success Criteria
- [ ] Virtual view system works without moving files
- [ ] At least 7 view types implemented (including media-specific views)
- [ ] Content-agnostic system handles docs, images, audio, video, data
- [ ] Codex Protocol replaces basic PRP system
- [ ] Both Scriptorium and Obsidian plugin can use same library
- [ ] Library/grimoire view provides intuitive folder-like organization
- [ ] Media files display appropriately in their respective views

## Technical Requirements
- TypeScript with full type safety
- Zero file movement - all views are virtual
- Plugin architecture for extensible views
- JSON/YAML schema definitions
- Cross-platform compatibility

## Benefits
1. **Unified infrastructure**: Single system for both tools
2. **Better organization**: Multiple ways to view same content
3. **Evolution of PRP**: More flexible Codex Protocol
4. **User-friendly**: Leverage Obsidian's existing GUI capabilities
5. **Future-proof**: Extensible for graph database integration

## Dependencies
- Priority 1 (Package.json) must be complete
- Basic monorepo structure established
- TypeScript build configuration ready

## Estimated Complexity
**High** - New shared infrastructure with multiple integration points

## Agent Assignments
1. **Architect**: Design view system architecture
2. **Frontend Specialist**: Create view adapters
3. **Backend Specialist**: Build core Codex system
4. **Integration Specialist**: Connect to existing tools