# Codex Nesting Architecture

**Status**: Core Architecture | **Version**: 1.0.0 | **Date**: 2025-10-23

---

## Overview

Codex Nesting implements **Scrivener-style folder-documents** where Codices can contain both **content AND children**. Unlike traditional folders that are purely organizational, Folder-Codices are full Codex entries with metadata, content, and the ability to contain other Codices.

This architecture enables flexible hierarchical organization without sacrificing the richness of the Codex model.

---

## Core Concept

> **A Folder-Codex is just a regular Codex that happens to have children.**

There is no special "folder" type or separate entity. Any Codex can become a folder by adding children. This design keeps the architecture simple while enabling powerful nesting capabilities.

---

## Folder-Codex Definition

### Data Model

```typescript
interface Codex {
  // Standard Codex fields
  id: string;
  projectId: string;
  templateId: string;
  title: string;
  content: string;
  metadata: CodexMetadata;
  created: Date;
  updated: Date;

  // Nesting fields
  parentId?: string;           // Parent Codex ID (if nested)
  children?: string[];         // Array of child Codex IDs
  childOrder?: number[];       // Optional explicit ordering
  expanded?: boolean;          // UI state (not persisted)
}

interface CodexMetadata {
  tags: string[];
  references: CodexReference[];
  customFields: Record<string, any>;

  // Folder-specific metadata (optional)
  folderIcon?: string;         // Custom icon when displayed as folder
  folderColor?: string;        // Custom color theme
  folderViewMode?: string;     // How to display children
}
```

### Frontmatter Representation

```markdown
---
codex_id: "chapter-1-uuid"
project_id: "novel-project"
template_id: "chapter"
parent_id: "book-uuid"         # This Codex is nested under another
children:                       # This Codex contains children
  - "scene-1-uuid"
  - "scene-2-uuid"
  - "scene-3-uuid"
title: "Chapter 1: The Beginning"
---

# Chapter 1: The Beginning

This chapter introduces the protagonist...

<!-- Child scenes are separate .codex.md files -->
```

---

## Nesting Mechanics

### Creating Nested Structures

**Method 1: Drag and drop in Navigator**
1. User drags Scene Codex onto Chapter Codex
2. Navigator updates both Codices:
   - Scene's `parent_id` set to Chapter ID
   - Chapter's `children` array includes Scene ID
3. UI updates to show Scene indented under Chapter

**Method 2: Create child directly**
1. User right-clicks Chapter in Navigator → "New Child"
2. Template selector appears
3. New Codex created with `parent_id` set to Chapter ID

**Method 3: Programmatic nesting**
```typescript
await codexService.nestCodex(childId, parentId);
// Sets child.parent_id = parentId
// Adds childId to parent.children array
```

### Unnesting (Promoting to Top-Level)

```typescript
await codexService.unnestCodex(codexId);
// Removes codex.parent_id
// Removes codexId from parent.children array
```

### Moving Between Parents

```typescript
await codexService.moveCodex(codexId, newParentId);
// Updates codex.parent_id to newParentId
// Removes from old parent's children
// Adds to new parent's children
```

---

## Unlimited Nesting Depth

The system supports **unlimited nesting depth**:

```
Book (Folder-Codex)
├── Part I (Folder-Codex)
│   ├── Chapter 1 (Folder-Codex)
│   │   ├── Scene 1 (Codex)
│   │   ├── Scene 2 (Codex)
│   │   └── Scene 3 (Folder-Codex)
│   │       ├── Beat 1 (Codex)
│   │       └── Beat 2 (Codex)
│   └── Chapter 2 (Folder-Codex)
│       ├── Scene 4 (Codex)
│       └── Scene 5 (Codex)
└── Part II (Folder-Codex)
    └── Chapter 3 (Folder-Codex)
        └── ...
```

**Performance considerations**:
- Navigator uses virtualized rendering for large trees
- Children loaded on-demand when parent expanded
- Recursive operations (e.g., delete) handle deep nesting efficiently

---

## Navigator Display

### Tree View Rendering

```typescript
interface NavigatorTreeNode {
  codex: Codex;
  depth: number;              // Nesting level (0 = root)
  expanded: boolean;          // Expand/collapse state
  hasChildren: boolean;       // Whether to show expand icon
  children?: NavigatorTreeNode[];
}

class NavigatorTreeView {
  renderNode(node: NavigatorTreeNode): React.ReactNode {
    return (
      <div style={{ paddingLeft: `${node.depth * 20}px` }}>
        {node.hasChildren && (
          <button onClick={() => this.toggleExpand(node.codex.id)}>
            {node.expanded ? '▼' : '▶'}
          </button>
        )}

        <CodexIcon codex={node.codex} />
        <span>{node.codex.title}</span>

        {node.expanded && node.children && (
          <div>
            {node.children.map(child => this.renderNode(child))}
          </div>
        )}
      </div>
    );
  }
}
```

### Visual Indicators

- **Icon**: Folder-Codices show folder icon if they have children
- **Indentation**: Child Codices indented under parents
- **Expand/Collapse**: Caret icon to toggle children visibility
- **Drag Handle**: Reorder children via drag-and-drop
- **Count Badge**: Show number of children (e.g., "Chapter 1 (3)")

---

## Use Cases

### 1. Book Writing (Fiction)

```
Novel
├── Front Matter
│   ├── Dedication
│   ├── Acknowledgments
│   └── Prologue
├── Part I
│   ├── Chapter 1
│   │   ├── Scene 1
│   │   └── Scene 2
│   └── Chapter 2
│       └── ...
├── Part II
│   └── ...
└── Back Matter
    ├── Epilogue
    └── Author's Note
```

### 2. Research Organization

```
Research Project
├── Literature Review
│   ├── Theory A
│   │   ├── Paper 1
│   │   └── Paper 2
│   └── Theory B
│       └── Paper 3
├── Methodology
│   ├── Experiment 1
│   └── Experiment 2
└── Results
    ├── Analysis 1
    └── Analysis 2
```

### 3. Journalism Workflow

```
Investigation
├── Sources
│   ├── Source A
│   │   ├── Interview 1
│   │   └── Interview 2
│   └── Source B
│       └── Interview 3
├── Documents
│   ├── Public Records
│   └── Internal Memos
└── Draft Articles
    ├── Main Article
    └── Sidebar
```

### 4. Documentation Structure

```
API Documentation
├── Getting Started
│   ├── Installation
│   ├── Quick Start
│   └── Configuration
├── API Reference
│   ├── Authentication
│   ├── Endpoints
│   │   ├── Users API
│   │   ├── Projects API
│   │   └── Tasks API
│   └── Webhooks
└── Examples
    ├── Basic Usage
    └── Advanced Patterns
```

---

## Content in Folder-Codices

Folder-Codices can contain **their own content** in addition to children:

### Example: Chapter with Summary

```markdown
---
codex_id: "chapter-1"
template_id: "chapter"
children:
  - "scene-1"
  - "scene-2"
---

# Chapter 1: The Beginning

## Chapter Summary

This chapter introduces the protagonist and establishes the
central conflict. Key events:
- Protagonist wakes up in unfamiliar place
- Discovers mysterious letter
- Meets the antagonist

## Scenes

<!-- The actual scene content is in separate child Codices -->
<!-- See scene-1.codex.md and scene-2.codex.md -->

## Notes

- Consider adding flashback in Scene 2
- Double-check continuity with Chapter 2
```

**Key benefit**: Chapter overview/notes live in the Chapter Codex itself, while scene content is in child Codices. Best of both worlds.

---

## Querying and Navigation

### Get All Children (Direct)

```typescript
const children = await codexService.getChildren(parentId);
// Returns: Codex[]
```

### Get All Descendants (Recursive)

```typescript
const descendants = await codexService.getDescendants(parentId);
// Returns: Codex[] (all children, grandchildren, etc.)
```

### Get Ancestors (Path to Root)

```typescript
const ancestors = await codexService.getAncestors(codexId);
// Returns: Codex[] (parent, grandparent, ..., root)
```

### Get Siblings

```typescript
const siblings = await codexService.getSiblings(codexId);
// Returns: Codex[] (other children of same parent)
```

### Get Tree Structure

```typescript
const tree = await codexService.getTree(rootId);
// Returns: CodexTree with nested children
```

---

## Operations on Folder-Codices

### Move Entire Subtree

When moving a Folder-Codex, all descendants move with it:

```typescript
await codexService.moveCodex(folderId, newParentId);
// Moves folder AND all children recursively
```

### Delete Entire Subtree

User can choose to delete just folder or folder + children:

```typescript
await codexService.deleteCodex(folderId, {
  deleteChildren: true  // Delete all descendants
});

// Or promote children to parent level
await codexService.deleteCodex(folderId, {
  promoteChildren: true  // Children become siblings of folder
});
```

### Duplicate with Children

```typescript
await codexService.duplicateCodex(folderId, {
  includeChildren: true  // Clone entire subtree
});
```

---

## Breadcrumbs and Context

When viewing a nested Codex, show **breadcrumb navigation**:

```
Book > Part I > Chapter 1 > Scene 2
```

Clicking any breadcrumb navigates to that ancestor.

---

## Folder-Specific Templates

While any Codex can become a folder, certain templates are **designed for folder use**:

```json5
// folder.json5
{
  template_id: "folder",
  name: "Folder",
  description: "Generic folder for organizing Codices",
  category: "organization",
  icon: "📁",

  fields: [
    {
      id: "title",
      type: "text",
      label: "Folder Name"
    },
    {
      id: "description",
      type: "text",
      label: "Description",
      multiline: true
    }
  ],

  metadata: {
    intendedForNesting: true,   // Hint to UI
    defaultChildTemplate: null   // Allow any child type
  }
}
```

---

## Backend Storage

Folder-Codices are stored as **individual .codex.md files** with parent/child relationships in frontmatter:

### File System Structure

```
content/
├── book.codex.md              # Root Codex
├── part-1.codex.md            # parent_id: book
├── chapter-1.codex.md         # parent_id: part-1
├── scene-1.codex.md           # parent_id: chapter-1
├── scene-2.codex.md           # parent_id: chapter-1
└── ...
```

**Benefits**:
- Each Codex is a separate file (Git-friendly)
- Easy to move files around in file system
- Relationships defined in metadata, not file structure
- Bindery backend handles relationship resolution

### Bindery Service Queries

```rust
// Get children
pub fn get_children(parent_id: &str) -> Vec<Codex> {
    codex_store
        .iter()
        .filter(|c| c.parent_id == Some(parent_id))
        .collect()
}

// Get tree
pub fn get_tree(root_id: &str) -> CodexTree {
    let root = get_codex(root_id);
    let children = get_children(root_id)
        .into_iter()
        .map(|child| get_tree(&child.id))  // Recursive
        .collect();

    CodexTree { root, children }
}
```

---

## UI Interactions

### Expand/Collapse

- **Click caret icon**: Expand/collapse children
- **Double-click Codex**: Open in editor AND expand if collapsed
- **Keyboard**: `→` to expand, `←` to collapse
- **Persist state**: Expansion state saved in UI preferences

### Drag and Drop

- **Drag Codex onto Folder-Codex**: Nest as child
- **Drag Codex between siblings**: Reorder
- **Drag Codex out of folder**: Unnest to parent level
- **Visual feedback**: Show drop zone highlight

### Context Menu

```
Right-click Folder-Codex:
├── Open
├── New Child ▶
│   ├── Scene
│   ├── Chapter
│   └── [More templates...]
├── Expand All Children
├── Collapse All Children
├── Rename
├── Delete ▶
│   ├── Delete (Keep Children)
│   └── Delete (With Children)
└── Properties
```

---

## Benefits of Codex Nesting

1. **Scrivener-Like Organization**: Writers feel at home
2. **Flexible Hierarchy**: Any depth, any structure
3. **Unified Model**: No special folder type to maintain
4. **Content + Structure**: Folders can have their own content
5. **Easy Reorganization**: Drag-and-drop, promote, move
6. **Git-Friendly**: Separate files, not nested file structure

---

## Limitations and Considerations

### Circular References

The system must prevent:
- Codex nesting itself
- Codex nesting its ancestor (creating a cycle)

```typescript
async function canNest(childId: string, parentId: string): Promise<boolean> {
  if (childId === parentId) return false;

  const ancestors = await getAncestors(parentId);
  return !ancestors.some(a => a.id === childId);
}
```

### Performance

- **Deep nesting**: Limit practical depth to ~10 levels
- **Large folders**: Virtualize children list for 100+ children
- **Recursive operations**: Use breadth-first traversal with limits

### Cross-Project Nesting

**Decision**: Children must be in same project as parent.

**Rationale**: Prevents organizational confusion and simplifies project context switching.

---

## Related Documentation

- [Codex Architecture](./CODEX_ARCHITECTURE.md) - Core Codex model
- [Project-Centric Architecture](./PROJECT_CENTRIC_ARCHITECTURE.md) - Project boundaries
- [Hierarchical Template System](./HIERARCHICAL_TEMPLATE_SYSTEM.md) - Template organization

---

## Architecture Decision Records

- [ADR-007: Codex-Based Folders](../../development/decisions/ADR-007-codex-folders.md)
- [ADR-008: Unlimited Nesting Depth](../../development/decisions/ADR-008-unlimited-nesting.md)
- [ADR-009: Content in Folder-Codices](../../development/decisions/ADR-009-folder-content.md)
