# Phase 21: File Integration & Media Codices

**Status**: Proposed
**Duration**: 5-7 days
**Related ADRs**: [ADR-020](../decisions/ADR-020-extreme-atomic-architecture.md), [ADR-024](../decisions/ADR-024-formula-computed-fields.md), [ADR-025](../decisions/ADR-025-file-integration-architecture.md)

---

## Executive Summary

Phase 21 integrates workspace files into the Codex system through FILE and IMAGE field types with VS Code editor integration. This phase enables Codices to reference files (code, markdown, images, documents) using workspace-relative paths, implements atomic file templates (FileCodex, ImageCodex) that wrap files with metadata, integrates with VS Code's native editors for seamless editing, and adds file watching to detect external changes. The work bridges Vespera Forge's knowledge management with VS Code's powerful file editing capabilities.

---

## Objectives

### Primary Goals
- [ ] **FILE Field Type** - Reference workspace files with path validation
- [ ] **IMAGE Field Type** - Reference images with preview and metadata
- [ ] **FileCodex Template** - Atomic template wrapping file with metadata
- [ ] **ImageCodex Template** - Atomic template for images with dimensions/size
- [ ] **VS Code Editor Integration** - Open files in native VS Code editors
- [ ] **Workspace-Relative Paths** - Portable file references
- [ ] **File Watching** - Detect external file changes and update metadata

### Secondary Goals
- [ ] **File Picker UI** - Browse workspace files with filtering
- [ ] **Image Preview** - Show thumbnail previews in editor
- [ ] **Computed File Metadata** - Auto-calculate size, dimensions, modified date
- [ ] **Broken Link Detection** - Warn when referenced file deleted
- [ ] **File Path Autocomplete** - Suggest workspace files as you type

### Non-Goals
- **File Content Storage** - Files remain on filesystem, not embedded in database
- **File Versioning** - Git handles versioning, not Vespera
- **Media Editing** - VS Code editors handle editing, not custom editors
- **File Sync** - No file synchronization between machines (use Git)

---

## Prerequisites

Before starting Phase 21:

- [ ] Phase 20 complete (reference system, inline editing)
- [ ] User approval of this phase plan
- [ ] Decision: File path storage format (forward slash vs. platform-native)
- [ ] Decision: Broken link handling (warn, auto-fix, delete Codex)
- [ ] Decision: File picker scope (workspace root vs. project-specific)
- [ ] Decision: Image preview size limits (max dimensions for performance)

---

## Technical Approach

### Architecture Patterns

**1. FILE Field Type**

References workspace files with validation:

```typescript
interface FileFieldDefinition {
  id: string;                      // "source_code"
  type: FieldType.FILE;            // FILE
  label: string;                   // "Source Code File"
  allowedExtensions?: string[];    // [".ts", ".tsx", ".js"]
  maxFileSize?: number;            // Max file size in bytes
  required: boolean;
}

// Usage in template
{
  templateId: "code-file",
  fields: [
    {
      id: "file_path",
      type: "FILE",
      label: "Source File",
      allowedExtensions: [".ts", ".tsx", ".js", ".jsx"],
      required: true
    }
  ]
}
```

**2. IMAGE Field Type**

Extends FILE with image-specific features:

```typescript
interface ImageFieldDefinition {
  id: string;                      // "portrait"
  type: FieldType.IMAGE;           // IMAGE (extends FILE)
  label: string;                   // "Character Portrait"
  allowedExtensions?: string[];    // [".png", ".jpg", ".webp"]
  maxWidth?: number;               // Max image width in pixels
  maxHeight?: number;              // Max image height in pixels
  required: boolean;
}
```

**3. Workspace-Relative Path Resolution**

Portable paths that work across machines:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

class PathResolver {
  private workspaceRoot: string;

  constructor() {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders || workspaceFolders.length === 0) {
      throw new Error('No workspace folder open');
    }
    this.workspaceRoot = workspaceFolders[0].uri.fsPath;
  }

  // Convert workspace-relative path to absolute path
  resolve(relativePath: string): string {
    return path.join(this.workspaceRoot, relativePath);
  }

  // Convert absolute path to workspace-relative path
  makeRelative(absolutePath: string): string {
    return path.relative(this.workspaceRoot, absolutePath);
  }

  // Platform-agnostic path normalization
  normalize(filePath: string): string {
    return filePath.replace(/\\/g, '/');  // Use forward slashes
  }
}
```

**4. FileCodex Template**

Atomic template for file references:

```json5
{
  templateId: "file-codex",
  name: "File",
  category: "atomic",
  icon: "📁",
  fields: [
    {
      id: "file_path",
      type: "FILE",
      label: "File Path",
      required: true
    },
    {
      id: "file_type",
      type: "SELECT",
      label: "File Type",
      options: ["code", "markdown", "data", "document", "other"],
      required: true
    },
    {
      id: "description",
      type: "TEXT",
      label: "Description",
      multiline: true
    },
    {
      id: "file_size",
      type: "COMPUTED",
      label: "File Size",
      computeFn: "getFileSize(file_path)",
      dependencies: ["file_path"],
      editable: false
    },
    {
      id: "last_modified",
      type: "COMPUTED",
      label: "Last Modified",
      computeFn: "getFileModifiedTime(file_path)",
      dependencies: ["file_path"],
      editable: false
    }
  ]
}
```

**5. ImageCodex Template**

Extends FileCodex with image metadata:

```json5
{
  templateId: "image-codex",
  name: "Image",
  category: "atomic",
  icon: "🖼",
  baseTemplate: "file-codex",  // Extends FileCodex
  fields: [
    {
      id: "file_path",
      type: "IMAGE",  // Override FILE with IMAGE
      label: "Image File",
      allowedExtensions: [".png", ".jpg", ".jpeg", ".webp", ".gif"],
      required: true
    },
    {
      id: "dimensions",
      type: "COMPUTED",
      label: "Dimensions",
      computeFn: "getImageDimensions(file_path)",
      dependencies: ["file_path"],
      editable: false
    },
    {
      id: "alt_text",
      type: "TEXT",
      label: "Alt Text",
      multiline: false
    }
  ]
}
```

**6. VS Code Editor Integration**

Open files natively in VS Code:

```typescript
async function openFileInEditor(relativePath: string) {
  const absolutePath = pathResolver.resolve(relativePath);
  const uri = vscode.Uri.file(absolutePath);

  // Open in VS Code editor
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
}

// For images, open in image viewer
async function openImageInViewer(relativePath: string) {
  const absolutePath = pathResolver.resolve(relativePath);
  const uri = vscode.Uri.file(absolutePath);

  // VS Code handles image preview automatically
  await vscode.commands.executeCommand('vscode.open', uri);
}
```

**7. File Watching**

Detect external changes to referenced files:

```typescript
import chokidar from 'chokidar';

class FileWatcher {
  private watcher: chokidar.FSWatcher;
  private callbacks: Map<string, Array<(event: FileEvent) => void>> = new Map();

  start(workspaceRoot: string) {
    this.watcher = chokidar.watch(workspaceRoot, {
      persistent: true,
      ignoreInitial: false,
      ignored: ['**/node_modules/**', '**/.git/**']
    });

    this.watcher
      .on('add', (path) => this.emit('add', path))
      .on('change', (path) => this.emit('change', path))
      .on('unlink', (path) => this.emit('delete', path));
  }

  // Register callback for specific file
  watch(relativePath: string, callback: (event: FileEvent) => void) {
    const callbacks = this.callbacks.get(relativePath) || [];
    callbacks.push(callback);
    this.callbacks.set(relativePath, callbacks);
  }

  private emit(event: 'add' | 'change' | 'delete', absolutePath: string) {
    const relativePath = pathResolver.makeRelative(absolutePath);
    const callbacks = this.callbacks.get(relativePath) || [];

    for (const callback of callbacks) {
      callback({ type: event, path: relativePath });
    }
  }
}

// Update Codex when file changes
fileWatcher.watch('images/alice.png', async (event) => {
  if (event.type === 'change') {
    // Invalidate computed fields (dimensions, file_size)
    await invalidateComputedFields('image-001', ['dimensions', 'file_size']);
  } else if (event.type === 'delete') {
    // Mark Codex as broken
    await markCodexAsBroken('image-001', 'Referenced file deleted');
  }
});
```

---

## Task Breakdown

### Backend Tasks (Path Resolution & File Operations)

**Task 1: Path Resolver Implementation** (3 hours)
- Create PathResolver class with workspace root detection
- Implement resolve() (relative → absolute)
- Implement makeRelative() (absolute → relative)
- Add platform-agnostic normalization (forward slashes)
- Implement existence checks and validation
- Tests: Path resolution, normalization, cross-platform

**Task 2: FILE Field Type** (4 hours)
- Create FileFieldDefinition interface
- Implement file path storage in Codex metadata
- Add file extension validation
- Implement file size validation
- Add existence checks before save
- Tests: Storage, validation, existence checks

**Task 3: IMAGE Field Type** (3 hours)
- Create ImageFieldDefinition interface (extends FILE)
- Add image-specific validation (width, height, type)
- Implement image dimension constraints
- Tests: Image validation, dimension checks

**Task 4: File Compute Functions** (5 hours)
- Implement getFileSize() with formatting (KB, MB, GB)
- Implement getFileModifiedTime()
- Implement getImageDimensions() using sharp library
- Add compute function caching with file watch invalidation
- Tests: All compute functions, caching, invalidation

**Task 5: File Watching System** (4 hours)
- Set up chokidar file watcher
- Implement watch registration for referenced files
- Add event handling (add, change, delete)
- Implement broken link detection and marking
- Tests: File watching, event handling, broken links

**Task 6: Broken Link Management** (3 hours)
- Add broken_link flag to Codex metadata
- Implement broken link detection on file delete
- Create "fix broken link" workflow
- Add bulk broken link checker (scan all Codices)
- Tests: Detection, flagging, fixing, bulk scan

### Frontend Tasks (UI Components & Integration)

**Task 7: File Field Editor** (5 hours)
- Create FileFieldEditor component
- Implement file path text input with validation
- Add "Browse" button to open file picker
- Add "Open in VS Code" button
- Show file existence status (exists/not found)
- Tests: Input, browsing, opening, validation

**Task 8: File Picker Dialog** (6 hours)
- Create workspace file picker using VS Code API
- Implement file filtering by extension
- Add recent files list
- Implement search/filter within picker
- Support multi-file selection (for MULTI_REFERENCE fields)
- Tests: Picker display, filtering, selection

**Task 9: Image Field Editor** (6 hours)
- Create ImageFieldEditor component (extends FileFieldEditor)
- Implement image preview with thumbnail
- Add "Change Image" button
- Display image dimensions below preview
- Show loading state while loading preview
- Tests: Preview, loading, change button

**Task 10: Image Preview Component** (4 hours)
- Create reusable ImagePreview component
- Load image as data URL for webview display
- Implement lazy loading (only load when visible)
- Add error handling for broken images
- Support zoom/lightbox view (optional)
- Tests: Loading, lazy loading, error handling

**Task 11: FileCodex & ImageCodex Templates** (3 hours)
- Create FileCodex template JSON5
- Create ImageCodex template JSON5
- Add MarkdownCodex template (extends FileCodex for .md files)
- Validate all templates load correctly
- Tests: Template loading, inheritance, validation

**Task 12: Broken Link UI** (4 hours)
- Show warning icon when file not found
- Create "Fix Broken Link" button (opens file picker)
- Implement "Ignore Broken Link" option
- Add bulk "Find Broken Links" command
- Tests: Warning display, fix workflow, bulk scan UI

---

## Task Dependencies

```
Backend Foundation:
  Task 1 (Path Resolver) → Task 2 (FILE Type) → Task 3 (IMAGE Type)
  Task 1 → Task 4 (Compute Functions)
  Task 2 → Task 5 (File Watching)
  Task 2 + Task 5 → Task 6 (Broken Link Management)

Frontend Implementation:
  Task 2 → Task 7 (File Editor)
  Task 1 → Task 8 (File Picker)
  Task 3 → Task 9 (Image Editor)
  Task 9 → Task 10 (Image Preview)
  Task 2 + Task 3 → Task 11 (Templates)
  Task 6 → Task 12 (Broken Link UI)

Integration:
  All → Final testing and integration
```

**Parallelization Strategy**:
1. **Days 1-2**: Tasks 1-3 (path resolver, FILE/IMAGE types)
2. **Days 3-4**: Tasks 4-5 (compute functions, file watching) + Task 7-8 (editors, picker)
3. **Days 5-6**: Tasks 6, 9-10 (broken links, image components)
4. **Day 7**: Tasks 11-12 (templates, broken link UI) + integration

---

## Open Questions

**Decisions Needed Before Starting**:

1. **File Path Storage Format?**
   - **Options**: Forward slashes, platform-native, both supported
   - **Recommendation**: Always store with forward slashes (portable)
   - **Impact**: Cross-platform compatibility

2. **Broken Link Handling?**
   - **Options**: Warn only, auto-fix (search for file), delete Codex
   - **Recommendation**: Warn only, manual fix (safety first)
   - **Impact**: User experience vs. data safety

3. **File Picker Scope?**
   - **Options**: Entire workspace, current project only, configurable
   - **Recommendation**: Current project with "Browse All" option
   - **Impact**: UI clutter vs. discoverability

4. **Image Preview Size?**
   - **Options**: Full size, 200px, 400px, configurable
   - **Recommendation**: 400px max width (performance vs. quality)
   - **Impact**: Loading time and memory

5. **File Extension Filtering?**
   - **Options**: Strict (reject others), lenient (warn), user choice
   - **Recommendation**: Strict (prevent mistakes)
   - **Impact**: User flexibility vs. error prevention

---

## Risk Assessment

### High Risk

1. **Path Resolution Cross-Platform** (Backend)
   - **Risk**: Paths work on Linux but break on Windows (or vice versa)
   - **Mitigation**: Use path.join, normalize to forward slashes, extensive testing
   - **Contingency**: Platform-specific path storage (separate fields)

2. **File Watching Performance** (Backend)
   - **Risk**: Watching entire workspace slow with 10k+ files
   - **Mitigation**: Watch only referenced files, ignore node_modules/.git
   - **Contingency**: Disable auto-watching, manual refresh only

### Medium Risk

3. **Image Preview Memory** (Frontend)
   - **Risk**: Loading large images (10MB+) crashes webview
   - **Mitigation**: Resize images before display, lazy loading
   - **Contingency**: Show placeholder for large images, "Open in VS Code" only

4. **Broken Link Cascade** (UX)
   - **Risk**: Deleting folder breaks hundreds of Codices
   - **Mitigation**: Bulk fix tool, "ignore all" option
   - **Contingency**: Auto-repair by searching workspace for moved files

### Low Risk

5. **VS Code Integration** (Frontend)
   - **Risk**: VS Code API changes break file opening
   - **Mitigation**: Use stable vscode API, follow deprecation warnings
   - **Contingency**: Fall back to opening file in system default app

---

## Success Criteria

**Must-Have (MVP)**:
- ✅ FileCodex template exists and works
- ✅ ImageCodex template exists with preview
- ✅ FILE/IMAGE fields store workspace-relative paths
- ✅ "Open in VS Code" button works for all file types
- ✅ File picker browses workspace files
- ✅ Broken links detected and flagged
- ✅ Image dimensions and file size auto-computed

**Should-Have**:
- ✅ Image preview shows thumbnails
- ✅ File watching detects external changes
- ✅ File extension validation prevents wrong types
- ✅ Path autocomplete suggests files
- ✅ Broken link fix workflow functional
- ✅ MarkdownCodex template for .md files

**Nice-to-Have**:
- ✅ Image zoom/lightbox view
- ✅ Bulk broken link scanner
- ✅ Auto-repair moved files
- ✅ File type icons in UI
- ✅ Recent files quick picker

---

## Timeline Estimate

**Optimistic**: 5 days (smooth path resolution, no cross-platform issues)
**Realistic**: 7 days (accounting for file watching complexity and image preview tuning)
**Pessimistic**: 10 days (if cross-platform path issues or file watching performance problems)

**Week 1**:
- Days 1-2: Path resolution and FILE/IMAGE types
- Days 3-4: Compute functions, watching, editors
- Days 5-6: Broken links, image components
- Day 7: Templates, broken link UI, integration

---

## Context for AI Assistant

### Quick Start for Next Session

**If you're picking up Phase 21 work:**

1. **Read these files first** (in order):
   - [ADR-020: Extreme Atomic Codex Architecture](../decisions/ADR-020-extreme-atomic-architecture.md) - Atomicity foundation
   - [ADR-025: File Integration Architecture](../decisions/ADR-025-file-integration-architecture.md) - File system design
   - [ADR-024: Formula and Computed Fields](../decisions/ADR-024-formula-computed-fields.md) - Compute functions
   - This file (PHASE_21_PLAN.md) - Current plan

2. **Key mental models to understand**:
   - **Workspace-Relative Paths**: Files referenced portably, not absolute paths
   - **VS Code Native Editing**: Don't reinvent editors, use VS Code's
   - **File as Codex**: Files wrapped in Codices for metadata/relationships
   - **Computed Metadata**: Dimensions, size, modified time auto-calculated

3. **Current focus area**: Bridging file system with Codex knowledge graph

### System Architecture Overview

```
File Integration:
├── Path Resolution Layer
│   ├── Workspace Root Detection
│   ├── Relative ↔ Absolute Conversion
│   └── Platform Normalization
├── Field Types
│   ├── FILE (generic file reference)
│   └── IMAGE (image-specific with preview)
├── Atomic Templates
│   ├── FileCodex (file + metadata)
│   ├── ImageCodex (image + dimensions)
│   └── MarkdownCodex (markdown + word count)
├── VS Code Integration
│   ├── File Picker (vscode.window.showOpenDialog)
│   ├── Editor Opening (vscode.workspace.openTextDocument)
│   └── Image Preview (data URL in webview)
├── File Watching
│   ├── Chokidar Watcher
│   ├── Event Handling (add, change, delete)
│   └── Broken Link Detection
└── Compute Functions
    ├── getFileSize() → "1.5 MB"
    ├── getImageDimensions() → { width: 1920, height: 1080 }
    └── getFileModifiedTime() → Date

Example:
CharacterCodex → portrait (REFERENCE) → ImageCodex
                                          └── file_path: "images/alice.png"
                                          └── dimensions: { width: 800, height: 600 }
                                          └── file_size: "245 KB"
```

### Common Pitfalls & Gotchas

1. **Path Separator Platform Differences**
   - **What**: Windows uses backslashes, Unix uses forward slashes
   - **Why**: OS file system conventions differ
   - **How to handle**: Always normalize to forward slashes for storage

2. **Large Image Memory Usage**
   - **What**: Loading 10MB PNG as data URL crashes webview
   - **Why**: Webview has memory limits
   - **How to handle**: Resize before displaying, lazy load, show placeholder

3. **File Watcher Overwhelming Events**
   - **What**: File save triggers multiple change events
   - **Why**: Editors may write files in chunks
   - **How to handle**: Debounce file change events (500ms)

4. **Broken Links After Git Checkout**
   - **What**: Switching branches breaks file references
   - **Why**: Files may not exist in other branches
   - **How to handle**: Re-validate paths on workspace change, show warnings

### Important File Locations

Quick reference for key files:

- **Path Resolver**: `src/files/PathResolver.ts`
- **FILE Field**: `src/fields/FileField.ts`
- **IMAGE Field**: `src/fields/ImageField.ts`
- **File Watcher**: `src/files/FileWatcher.ts`
- **Compute Functions**: `src/compute/FileComputeFunctions.ts`
- **File Picker**: `src/components/FilePicker.tsx`
- **Image Preview**: `src/components/ImagePreview.tsx`
- **FileCodex Template**: `.vespera/templates/atomic/file-codex.template.json5`
- **ImageCodex Template**: `.vespera/templates/atomic/image-codex.template.json5`
- **Tests**: `tests/files/` (path resolution, file watching, broken links)

### Commands to Run

```bash
# Install dependencies
npm install sharp chokidar

# Create atomic template directory
mkdir -p .vespera/templates/atomic

# Run file integration tests
npm test -- --grep="File"

# Check for broken links in workspace
npm run check-broken-links

# Validate all file paths
npm run validate-file-paths

# Test cross-platform path resolution
npm run test:paths
```

---

## References

### Phase Tracking
- **Previous**: [Phase 20: Reference System & Auto-Creation](./PHASE_20_PLAN.md)
- **Current**: **Phase 21: File Integration & Media Codices** (this document)
- **Next**: [Phase 22: Backend/Navigator & Deletion](./PHASE_22_PLAN.md)

### Architecture Decision Records
- [ADR-020: Extreme Atomic Codex Architecture](../decisions/ADR-020-extreme-atomic-architecture.md) - Atomicity foundation
- [ADR-024: Formula and Computed Fields](../decisions/ADR-024-formula-computed-fields.md) - Compute functions
- [ADR-025: File Integration Architecture](../decisions/ADR-025-file-integration-architecture.md) - File system design

### Architecture Documentation
- [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md) - Universal content system
- [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md) - Template design

---

*Phase Plan Version: 1.0.0*
*Created: 2025-01-17*
*Template: PHASE_TEMPLATE.md v1.0.0*
