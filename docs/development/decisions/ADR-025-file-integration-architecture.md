# ADR-025: File Integration Architecture

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - File System Integration

---

## Context and Problem Statement

Vespera Forge needs to integrate with the workspace file system to support various use cases:

**Use Cases**:
1. **Code files**: Reference source code files (TypeScript, Python, Rust)
2. **Markdown files**: Long-form content in `.md` files
3. **Images**: Reference image files for character portraits, scene illustrations
4. **Documents**: PDFs, Word docs, spreadsheets
5. **Data files**: JSON, CSV, YAML configuration files

VS Code already has excellent editors for these file types. We shouldn't reinvent the wheel. However, we need to:
- Track file metadata in Codex system (tags, relationships, descriptions)
- Link files to Codices (Character → portrait.png)
- Open files in VS Code editor when user clicks "Edit"
- Handle file moves, renames, deletions

**Question**: How should Codices reference workspace files, and how do we integrate with VS Code's native editors?

## Decision Drivers

* **Leverage VS Code**: Use native editors, don't reinvent
* **Portability**: Handle workspace moves without breaking references
* **Metadata richness**: Track file metadata in Codex system
* **File watching**: Detect external file changes
* **User experience**: Seamless "Edit" button to open in VS Code
* **Version control**: Work well with Git
* **Performance**: Don't embed large files in database

## Considered Options

**Option 1**: **Embed File Contents in Codex**
- Store file contents directly in Codex database
- Portable but bloated

**Option 2**: **Absolute File Paths**
- Store full path: `/home/user/projects/vespera/image.png`
- Breaks when workspace moves

**Option 3**: **Workspace-Relative Paths** (Chosen)
- Store path relative to workspace root
- Portable and clean

## Decision Outcome

Chosen option: **"Option 3: Workspace-Relative Paths"**, because it provides portability (workspace can move), integrates cleanly with VS Code's file system, and keeps database size manageable. We'll implement FILE and IMAGE field types that store workspace-relative paths, and FileCodex/ImageCodex templates that wrap files with metadata.

### Positive Consequences

* **Portable**: Workspace can move without breaking references
* **Small database**: Only store paths, not file contents
* **VS Code integration**: Open files natively in VS Code
* **Version control friendly**: Files tracked by Git normally
* **Metadata richness**: Codex wraps file with tags, description, relationships
* **File watching**: Detect external changes and update metadata
* **Familiar editing**: Use VS Code's native editors

### Negative Consequences

* **External dependency**: Files must exist on file system
* **Broken links**: Deleting file outside Vespera breaks reference
* **Path resolution**: Need to resolve relative paths at runtime
* **Platform differences**: Path separators differ (Windows vs Unix)
* **File watching overhead**: Watching large workspaces can be expensive

## Pros and Cons of the Options

### Option 1: Embed File Contents in Codex

**Example**:
```typescript
{
  id: "image-001",
  templateId: "image-codex",
  fields: {
    filename: { value: "alice.png" },
    content: { value: "<base64-encoded-image-data>" },  // Embedded
    mimeType: { value: "image/png" }
  }
}
```

* Good, because **portable** (database contains everything)
* Good, because **no broken links** (file can't be deleted externally)
* Good, because **self-contained** (workspace can be exported as single database)
* Bad, because **bloated database** (images can be large, 1MB+)
* Bad, because **poor version control** (binary blobs in database, not Git)
* Bad, because **editing complexity** (must extract, edit, re-embed)
* Bad, because **synchronization** (external edits don't update database)

### Option 2: Absolute File Paths

**Example**:
```typescript
{
  id: "image-001",
  templateId: "image-codex",
  fields: {
    file_path: { value: "/home/user/projects/vespera/images/alice.png" }  // Absolute
  }
}
```

* Good, because **simple resolution** (path is directly usable)
* Good, because **no workspace dependency** (works anywhere)
* Bad, because **breaks on move** (moving workspace breaks all references)
* Bad, because **platform-specific** (`C:\Users\...` vs `/home/...`)
* Bad, because **not portable** (sharing database requires same paths)
* Bad, because **security risk** (absolute paths leak system structure)

### Option 3: Workspace-Relative Paths (Chosen)

**Example**:
```typescript
{
  id: "image-001",
  templateId: "image-codex",
  fields: {
    file_path: {
      value: "images/alice.png",  // Relative to workspace root
      relativeTo: "workspace"
    }
  }
}
```

**Path Resolution**:
```typescript
const workspaceRoot = vscode.workspace.workspaceFolders[0].uri.fsPath;
const absolutePath = path.join(workspaceRoot, "images/alice.png");
```

* Good, because **portable** (workspace can move, references stay valid)
* Good, because **clean database** (short paths, easy to read)
* Good, because **version control friendly** (relative paths work across machines)
* Good, because **platform-agnostic** (use `path.join` to handle separators)
* Good, because **secure** (doesn't leak system structure)
* Bad, because **requires workspace context** (must know workspace root to resolve)
* Bad, because **broken if file deleted** (external deletion breaks reference)
* Bad, because **path resolution overhead** (must resolve at runtime)

**Mitigation for broken links**:
- File watcher detects deletions and marks Codex as "broken"
- UI shows warning: "Referenced file not found"
- User can update path or delete Codex

## Implementation Details

### Field Type Definitions

**FILE Field**:
```typescript
interface FileFieldDefinition {
  id: string;                      // "source_code"
  type: FieldType.FILE;            // FILE
  label: string;                   // "Source Code File"
  allowedExtensions?: string[];    // [".ts", ".tsx", ".js"]
  maxFileSize?: number;            // Max file size in bytes
  required: boolean;
}
```

**IMAGE Field**:
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

### Template Definitions

**FileCodex Template**:
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

**ImageCodex Template**:
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

**MarkdownCodex Template**:
```json5
{
  templateId: "markdown-codex",
  name: "Markdown Document",
  category: "atomic",
  icon: "📝",
  baseTemplate: "file-codex",
  fields: [
    {
      id: "file_path",
      type: "FILE",
      label: "Markdown File",
      allowedExtensions: [".md", ".mdx"],
      required: true
    },
    {
      id: "word_count",
      type: "COMPUTED",
      label: "Word Count",
      computeFn: "wordCount(readFile(file_path))",
      dependencies: ["file_path"],
      editable: false
    },
    {
      id: "preview",
      type: "COMPUTED",
      label: "Preview",
      computeFn: "previewMarkdown(readFile(file_path), 200)",
      dependencies: ["file_path"],
      editable: false
    }
  ]
}
```

### Path Resolution

**Workspace-Relative Path Handler**:
```typescript
import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

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

  // Check if file exists
  async exists(relativePath: string): Promise<boolean> {
    const absolutePath = this.resolve(relativePath);
    try {
      await fs.access(absolutePath);
      return true;
    } catch {
      return false;
    }
  }

  // Read file contents
  async readFile(relativePath: string): Promise<Buffer> {
    const absolutePath = this.resolve(relativePath);
    return fs.readFile(absolutePath);
  }

  // Get file stats
  async getStats(relativePath: string): Promise<fs.Stats> {
    const absolutePath = this.resolve(relativePath);
    return fs.stat(absolutePath);
  }
}

const pathResolver = new PathResolver();
```

**Platform-Agnostic Path Handling**:
```typescript
// Store paths with forward slashes (Unix-style)
function normalizePath(filePath: string): string {
  return filePath.replace(/\\/g, '/');
}

// Use path.join for resolution (handles platform differences)
const absolutePath = path.join(workspaceRoot, normalizePath(relativePath));
```

### VS Code Integration

**Open File in VS Code**:
```typescript
async function openFileInEditor(relativePath: string) {
  const absolutePath = pathResolver.resolve(relativePath);
  const uri = vscode.Uri.file(absolutePath);

  // Open in VS Code editor
  const doc = await vscode.workspace.openTextDocument(uri);
  await vscode.window.showTextDocument(doc);
}
```

**File Picker UI**:
```typescript
async function pickFile(allowedExtensions?: string[]): Promise<string | null> {
  const options: vscode.OpenDialogOptions = {
    canSelectFiles: true,
    canSelectFolders: false,
    canSelectMany: false,
    filters: allowedExtensions ? {
      'Allowed Files': allowedExtensions.map(ext => ext.slice(1))  // Remove leading dot
    } : undefined
  };

  const result = await vscode.window.showOpenDialog(options);
  if (!result || result.length === 0) {
    return null;
  }

  // Convert to workspace-relative path
  const absolutePath = result[0].fsPath;
  return pathResolver.makeRelative(absolutePath);
}
```

**Image Preview**:
```typescript
function ImagePreview({ relativePath }: ImagePreviewProps) {
  const [imageUrl, setImageUrl] = useState<string | null>(null);

  useEffect(() => {
    // Load image as data URL for preview
    pathResolver.readFile(relativePath).then(buffer => {
      const base64 = buffer.toString('base64');
      const mimeType = getMimeType(relativePath);
      setImageUrl(`data:${mimeType};base64,${base64}`);
    });
  }, [relativePath]);

  return (
    <div className="image-preview">
      {imageUrl ? (
        <img src={imageUrl} alt="Preview" />
      ) : (
        <span>Loading...</span>
      )}
      <button onClick={() => openFileInEditor(relativePath)}>
        📝 Open in Editor
      </button>
    </div>
  );
}
```

### File Watching

**Watch for File Changes**:
```typescript
import chokidar from 'chokidar';

class FileWatcher {
  private watcher: chokidar.FSWatcher;
  private callbacks: Map<string, Array<(event: FileEvent) => void>> = new Map();

  start(workspaceRoot: string) {
    this.watcher = chokidar.watch(workspaceRoot, {
      persistent: true,
      ignoreInitial: false,
      ignored: ['**/node_modules/**', '**/.git/**']  // Ignore common dirs
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

const fileWatcher = new FileWatcher();
fileWatcher.start(workspaceRoot);

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

**Broken Link Detection**:
```typescript
async function validateFileReferences(codexId: string): Promise<ValidationResult> {
  const codex = await loadCodex(codexId);
  const fileFields = findFieldsByType(codex, FieldType.FILE);

  const brokenLinks: string[] = [];

  for (const field of fileFields) {
    const relativePath = field.value;
    const exists = await pathResolver.exists(relativePath);

    if (!exists) {
      brokenLinks.push(field.id);
    }
  }

  if (brokenLinks.length > 0) {
    return {
      valid: false,
      errors: brokenLinks.map(fieldId => ({
        fieldId,
        message: 'Referenced file not found'
      }))
    };
  }

  return { valid: true };
}
```

### File Field UI Components

**File Field Editor**:
```typescript
function FileFieldEditor({ field, value, onChange }: FieldEditorProps) {
  const [relativePath, setRelativePath] = useState(value || '');
  const [fileExists, setFileExists] = useState(true);

  // Check if file exists
  useEffect(() => {
    if (relativePath) {
      pathResolver.exists(relativePath).then(setFileExists);
    }
  }, [relativePath]);

  const handlePickFile = async () => {
    const path = await pickFile(field.allowedExtensions);
    if (path) {
      setRelativePath(path);
      onChange(path);
    }
  };

  const handleOpenFile = () => {
    openFileInEditor(relativePath);
  };

  return (
    <div className="file-field-editor">
      <input
        type="text"
        value={relativePath}
        onChange={(e) => {
          setRelativePath(e.target.value);
          onChange(e.target.value);
        }}
        placeholder="path/to/file.txt"
      />
      <button onClick={handlePickFile}>📁 Browse</button>
      <button onClick={handleOpenFile} disabled={!fileExists}>
        📝 Open in VS Code
      </button>

      {!fileExists && relativePath && (
        <div className="error">⚠ File not found</div>
      )}
    </div>
  );
}
```

**Image Field Editor**:
```typescript
function ImageFieldEditor({ field, value, onChange }: FieldEditorProps) {
  const [relativePath, setRelativePath] = useState(value || '');
  const [preview, setPreview] = useState<string | null>(null);

  // Load image preview
  useEffect(() => {
    if (relativePath) {
      pathResolver.readFile(relativePath).then(buffer => {
        const base64 = buffer.toString('base64');
        const mimeType = getMimeType(relativePath);
        setPreview(`data:${mimeType};base64,${base64}`);
      }).catch(() => setPreview(null));
    }
  }, [relativePath]);

  const handlePickImage = async () => {
    const path = await pickFile(field.allowedExtensions || ['.png', '.jpg', '.jpeg']);
    if (path) {
      setRelativePath(path);
      onChange(path);
    }
  };

  return (
    <div className="image-field-editor">
      {preview && (
        <img src={preview} alt="Preview" className="image-preview" />
      )}

      <button onClick={handlePickImage}>
        🖼 {relativePath ? 'Change Image' : 'Select Image'}
      </button>

      {relativePath && (
        <button onClick={() => openFileInEditor(relativePath)}>
          📝 Open in Editor
        </button>
      )}
    </div>
  );
}
```

## File-Specific Compute Functions

**Image Metadata**:
```typescript
import sharp from 'sharp';

async function getImageDimensions(relativePath: string): Promise<{ width: number; height: number }> {
  const absolutePath = pathResolver.resolve(relativePath);
  const metadata = await sharp(absolutePath).metadata();
  return {
    width: metadata.width || 0,
    height: metadata.height || 0
  };
}
```

**File Size**:
```typescript
async function getFileSize(relativePath: string): Promise<string> {
  const stats = await pathResolver.getStats(relativePath);
  return formatBytes(stats.size);
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const sizes = ['Bytes', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
}
```

**Last Modified Time**:
```typescript
async function getFileModifiedTime(relativePath: string): Promise<Date> {
  const stats = await pathResolver.getStats(relativePath);
  return stats.mtime;
}
```

## Migration Path

**Phase 19**: Implement FILE and IMAGE field types, path resolver
**Phase 20**: Create FileCodex and ImageCodex templates
**Phase 21**: Add file watcher and broken link detection
**Phase 22**: Implement computed fields for file metadata (size, dimensions)

## User Guidance

**For Template Authors**:
```json5
{
  id: "screenshot",
  type: "IMAGE",
  label: "Screenshot",
  allowedExtensions: [".png", ".jpg"],
  maxWidth: 3840,  // 4K max
  maxHeight: 2160
}
```

**For End Users**:
- Click "Browse" to pick file from workspace
- Or type workspace-relative path directly
- Click "Open in VS Code" to edit file natively
- If file is deleted externally, Codex shows warning

## Links

* Refines [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [ADR-024: Formula and Computed Fields](./ADR-024-formula-computed-fields.md)
* Related to [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md)
