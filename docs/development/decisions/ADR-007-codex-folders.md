# ADR-007: Codex-Based Folders (Scrivener-Style)

**Status**: Accepted
**Date**: 2025-10-23
**Deciders**: Development Team
**Technical Story**: Phase 15 - Codex Nesting Architecture

---

## Context and Problem Statement

Users need to organize Codices hierarchically (e.g., Book > Chapter > Scene). Traditional approaches use either:
1. **File system folders**: Physical directory structure
2. **Special folder entities**: Separate "Folder" type distinct from content

Both approaches have problems:
- **File system folders**: Forces content organization to match file structure, not flexible
- **Special folder type**: Two entity types to maintain, folders can't have content

Writers familiar with Scrivener expect **folders with content** - a Chapter can have both its own text (summary, notes) AND contain Scene children.

**Question**: How do we implement hierarchical organization while maintaining the unified Codex model?

## Decision Drivers

* **Scrivener Familiarity**: Writers expect folders that can have content
* **Unified Model**: Avoid creating multiple entity types (Codex vs Folder)
* **Flexibility**: Any Codex should be able to contain children
* **Virtual Organization**: Nesting via metadata, not file system structure
* **Simplicity**: Minimize architectural complexity

## Considered Options

1. **File System Folders**: Use physical directory structure for organization
2. **Special Folder Entity**: Create separate "Folder" type distinct from Codex
3. **Codex-Based Folders**: Regular Codices that happen to have children
4. **Tag-Based Hierarchy**: Use tags to represent parent-child relationships

## Decision Outcome

Chosen option: **"Codex-Based Folders"**, because it provides Scrivener-style folders with content while maintaining a unified architecture.

### Positive Consequences

* Unified model - no separate folder entity type
* Folders can have content (like Scrivener)
* Any Codex can become a folder by adding children
* Flexible nesting without file system constraints
* Simple mental model: "everything is a Codex"

### Negative Consequences

* Need to handle circular nesting prevention
* Recursive operations (delete, move) more complex
* UI needs expand/collapse and indentation
* Backend must resolve parent-child relationships

## Implementation Details

### Data Model

```typescript
interface Codex {
  id: string;
  projectId: string;
  templateId: string;
  title: string;
  content: string;
  metadata: CodexMetadata;

  // Nesting fields
  parentId?: string;      // Parent Codex ID (if nested)
  children?: string[];    // Array of child Codex IDs
}
```

### Frontmatter Example

```markdown
---
codex_id: "chapter-1"
project_id: "novel"
template_id: "chapter"
parent_id: "book-uuid"
children:
  - "scene-1-uuid"
  - "scene-2-uuid"
---

# Chapter 1: The Beginning

## Chapter Summary
This chapter introduces the protagonist...

## Notes
- Add flashback in Scene 2
- Check continuity with Chapter 2

<!-- Actual scene content is in child Codices -->
```

### Nesting Operations

```typescript
// Nest Codex as child of parent
async nestCodex(childId: string, parentId: string): Promise<void> {
  const child = await this.getCodex(childId);
  const parent = await this.getCodex(parentId);

  // Prevent circular nesting
  if (await this.wouldCreateCycle(childId, parentId)) {
    throw new Error('Cannot create circular nesting');
  }

  child.parentId = parentId;
  parent.children = [...(parent.children || []), childId];

  await this.updateCodex(child);
  await this.updateCodex(parent);
}

// Check for circular dependencies
async wouldCreateCycle(childId: string, parentId: string): Promise<boolean> {
  if (childId === parentId) return true;

  const ancestors = await this.getAncestors(parentId);
  return ancestors.some(a => a.id === childId);
}

// Get all ancestors (path to root)
async getAncestors(codexId: string): Promise<Codex[]> {
  const ancestors: Codex[] = [];
  let current = await this.getCodex(codexId);

  while (current.parentId) {
    const parent = await this.getCodex(current.parentId);
    ancestors.push(parent);
    current = parent;
  }

  return ancestors;
}
```

### File System Storage

Codices remain separate files, relationships in metadata:

```
content/
├── book.codex.md              # Root Codex
├── chapter-1.codex.md         # parent_id: book
├── scene-1.codex.md           # parent_id: chapter-1
├── scene-2.codex.md           # parent_id: chapter-1
└── chapter-2.codex.md         # parent_id: book
```

Benefits:
- Each Codex is a separate file (Git-friendly)
- Easy to move files in file system
- Relationships defined in metadata
- Bindery backend resolves relationships

### UI Implementation

Navigator tree view with expand/collapse:

```typescript
interface NavigatorTreeNode {
  codex: Codex;
  depth: number;              // Nesting level (0 = root)
  expanded: boolean;          // Expand/collapse state
  hasChildren: boolean;       // Whether to show caret
  children?: NavigatorTreeNode[];
}
```

Visual indicators:
- **Caret icon** (▶/▼) for expand/collapse
- **Indentation** based on depth
- **Folder icon** if Codex has children
- **Drag-and-drop** for nesting/unnesting

## Pros and Cons of the Options

### File System Folders

* Good, because familiar file-based organization
* Good, because OS file browser integration
* Bad, because forces content to match file structure
* Bad, because moving files breaks organization
* Bad, because folders can't have content
* Bad, because not flexible for virtual hierarchies

### Special Folder Entity

* Good, because clear distinction between folders and content
* Good, because dedicated folder operations
* Bad, because two entity types to maintain
* Bad, because folders can't have content
* Bad, because more complex data model
* Bad, because code must handle both types

### Codex-Based Folders (CHOSEN)

* Good, because unified model ("everything is a Codex")
* Good, because folders can have content (Scrivener-style)
* Good, because any Codex can become a folder
* Good, because flexible virtual organization
* Bad, because need circular nesting prevention
* Bad, because recursive operations more complex

### Tag-Based Hierarchy

* Good, because no explicit parent-child model
* Good, because flexible multi-parent hierarchies
* Bad, because ambiguous relationships
* Bad, because hard to maintain strict hierarchies
* Bad, because performance issues with tag queries
* Bad, because no clear "folder" concept

## Use Cases

### Book Writing
```
Novel
├── Part I
│   ├── Chapter 1
│   │   ├── Scene 1
│   │   └── Scene 2
│   └── Chapter 2
└── Part II
```

### Research Organization
```
Research Project
├── Literature Review
│   ├── Theory A
│   │   ├── Paper 1
│   │   └── Paper 2
│   └── Theory B
└── Methodology
```

### Documentation
```
API Docs
├── Getting Started
│   ├── Installation
│   └── Quick Start
└── API Reference
    ├── Authentication
    └── Endpoints
```

## Related Decisions

* [ADR-008: Unlimited Nesting Depth](./ADR-008-unlimited-nesting.md)
* [ADR-009: Content in Folder-Codices](./ADR-009-folder-content.md)
* [ADR-001: Projects as Fundamental](./ADR-001-projects-fundamental.md) - Folders must be in same project

## Links

* Refines [Codex Nesting Architecture](../../architecture/core/CODEX_NESTING.md)
* Refines [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md)
* Inspired by: Scrivener's binder structure
