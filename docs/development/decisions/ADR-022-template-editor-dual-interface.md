# ADR-022: Template Editor Dual Interface

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - Template System Development

---

## Context and Problem Statement

The Vespera Forge template system is the foundation of the entire Codex architecture. Templates define what fields a Codex has, how they're rendered, validation rules, and more. Templates are stored as JSON5 files in the workspace (`.vespera/templates/*.template.json5`).

However, there's a tension in how users want to interact with templates:
- **Casual users**: Want visual form builders with drag-drop fields and property panels
- **Power users**: Want direct JSON5 editing for precision and speed
- **AI agents**: Want machine-readable JSON5 files they can parse and edit programmatically
- **Template authors**: May start with visual builder, then tweak JSON5 for advanced features

**Question**: Should we provide a visual template editor, JSON5 text editor, or both?

## Decision Drivers

* **Accessibility**: Casual users shouldn't need to learn JSON5 syntax
* **Power user efficiency**: Text editing is faster for experienced users
* **AI agent compatibility**: JSON5 files enable programmatic editing
* **Flexibility**: Support both simple and advanced template features
* **Immediate feedback**: Visual editor shows live preview of template
* **No lock-in**: Users shouldn't be trapped in one editing mode
* **Version control**: Templates stored as text files work with Git

## Considered Options

**Option 1**: **JSON5-Only Editor**
- Single text editor with syntax highlighting and validation
- Simple to implement, minimal UI
- Power users love it, casual users struggle

**Option 2**: **Visual-Only Form Builder**
- Drag-drop interface for adding/arranging fields
- Property panels for field configuration
- No direct JSON5 access

**Option 3**: **Dual Interface** (Chosen)
- Visual form builder (primary interface)
- JSON5 text editor (advanced mode)
- Two-way sync: Edit in either view, updates both
- Toggle between modes with hotkey

## Decision Outcome

Chosen option: **"Option 3: Dual Interface"**, because it serves all user types (casual, power users, AI agents) while maintaining the benefits of text-based storage for version control and programmatic editing.

### Positive Consequences

* **Universal accessibility**: Casual users use visual builder, power users use JSON5
* **Progressive learning**: Users can start visual, graduate to JSON5 as they learn
* **Live preview**: Visual mode shows exactly how template will look
* **Fast editing**: Power users can make bulk changes in JSON5 mode
* **AI-friendly**: Agents can edit JSON5 files directly
* **Version control**: Git diffs work on JSON5 files
* **No lock-in**: Switch between modes freely
* **Validation in both modes**: Syntax errors caught immediately

### Negative Consequences

* **Implementation complexity**: Need to build and sync two editors
* **Sync bugs**: Risk of desynchronization between visual and JSON5 views
* **Increased testing**: Must test both modes and transitions
* **Learning curve**: Users must understand which mode is best for their task
* **UI complexity**: More buttons, toggles, and modes in interface

## Pros and Cons of the Options

### Option 1: JSON5-Only Editor

**Example interface**:
```
┌──────────────────────────────────────────────┐
│ Template Editor: character.template.json5    │
├──────────────────────────────────────────────┤
│  1  {                                        │
│  2    "templateId": "character",             │
│  3    "name": "Character",                   │
│  4    "category": "creative-writing",        │
│  5    "fields": [                            │
│  6      {                                    │
│  7        "id": "name",                      │
│  8        "type": "REFERENCE",               │
│  9        "targetTemplate": "string-codex",  │
│ 10        "label": "Character Name",         │
│ 11        "required": true                   │
│ 12      },                                   │
│ 13      // ... more fields                   │
│ 14    ]                                      │
│ 15  }                                        │
└──────────────────────────────────────────────┘
```

* Good, because **simple implementation** (just a text editor)
* Good, because **power user efficiency** (fast for experienced users)
* Good, because **no sync issues** (single source of truth)
* Good, because **AI-friendly** (agents edit files directly)
* Bad, because **steep learning curve** (must learn JSON5 syntax)
* Bad, because **error-prone** (typos break entire template)
* Bad, because **no visual feedback** (can't see how template looks)
* Bad, because **inaccessible to casual users** (intimidating for non-technical users)

### Option 2: Visual-Only Form Builder

**Example interface**:
```
┌──────────────────────────────────────────────┐
│ Template Builder: Character                  │
├──────────────────────────────────────────────┤
│ [Template Name: Character___________]        │
│ [Category: Creative Writing ▼]               │
│                                              │
│ Fields:                                      │
│ ┌────────────────────────────────────┐      │
│ │ ⋮⋮ Name (String)              [×]  │ ← Drag handle + delete
│ │    Label: Character Name            │
│ │    Required: ☑                      │
│ └────────────────────────────────────┘      │
│ ┌────────────────────────────────────┐      │
│ │ ⋮⋮ Age (Number)                [×]  │
│ │    Label: Age                       │
│ │    Required: ☐                      │
│ └────────────────────────────────────┘      │
│                                              │
│ [+ Add Field ▼]                              │
└──────────────────────────────────────────────┘
```

* Good, because **beginner-friendly** (no JSON5 knowledge required)
* Good, because **visual feedback** (see template structure immediately)
* Good, because **drag-drop simplicity** (intuitive field reordering)
* Good, because **less error-prone** (UI enforces valid structure)
* Bad, because **limited flexibility** (can't access advanced features)
* Bad, because **slower for power users** (many clicks to configure fields)
* Bad, because **not AI-friendly** (agents can't easily edit UI state)
* Bad, because **feature lag** (new JSON5 features slow to add to UI)

### Option 3: Dual Interface (Chosen)

**Example interface**:
```
┌──────────────────────────────────────────────┐
│ Template Editor: Character    [Visual|JSON5] │ ← Mode toggle
├──────────────────────────────────────────────┤
│ VISUAL MODE:                                 │
│ ┌────────────────────────────────────┐      │
│ │ Template Name: Character___________│      │
│ │ Category: Creative Writing ▼       │      │
│ │                                    │      │
│ │ Fields:                            │      │
│ │ ┌──────────────────────────┐      │      │
│ │ │ ⋮⋮ Name (String)    [×]  │      │      │
│ │ │    Label: Character Name  │      │      │
│ │ │    Required: ☑            │      │      │
│ │ └──────────────────────────┘      │      │
│ │ [+ Add Field ▼]                    │      │
│ └────────────────────────────────────┘      │
│                                              │
│ [Preview Template]                           │
└──────────────────────────────────────────────┘

┌──────────────────────────────────────────────┐
│ Template Editor: Character    [Visual|JSON5] │ ← Mode toggle
├──────────────────────────────────────────────┤
│ JSON5 MODE:                                  │
│  1  {                                        │
│  2    "templateId": "character",             │
│  3    "name": "Character",                   │
│  4    // ... JSON5 content                   │
│                                              │
│ [Validate] [Format]                          │
└──────────────────────────────────────────────┘
```

* Good, because **serves all user types** (casual, power, AI agents)
* Good, because **progressive learning** (start visual, learn JSON5 gradually)
* Good, because **visual feedback** (visual mode shows live preview)
* Good, because **power user speed** (JSON5 mode for bulk edits)
* Good, because **AI-friendly** (agents edit JSON5 files)
* Good, because **flexibility** (access advanced features in JSON5)
* Good, because **no lock-in** (switch modes anytime)
* Bad, because **complex implementation** (two editors to build and sync)
* Bad, because **sync risk** (potential desynchronization bugs)
* Bad, because **more testing** (both modes + transitions)

**Sync Strategy**:
```typescript
// Visual → JSON5 sync
function onVisualChange(templateState: TemplateBuilderState) {
  const json5 = serializeToJSON5(templateState);
  setJSON5Content(json5);
}

// JSON5 → Visual sync
function onJSON5Change(json5Content: string) {
  try {
    const templateState = parseJSON5(json5Content);
    setVisualState(templateState);
  } catch (err) {
    showValidationError(err);
  }
}

// Debounce to prevent excessive syncing
const debouncedSync = debounce(onVisualChange, 300);
```

## Implementation Details

### Visual Form Builder

**Field Type Palette**:
```typescript
const FIELD_TYPE_PALETTE = [
  { type: 'STRING', icon: '📝', label: 'Text (Short)' },
  { type: 'TEXT', icon: '📄', label: 'Text (Long)' },
  { type: 'NUMBER', icon: '🔢', label: 'Number' },
  { type: 'DATE', icon: '📅', label: 'Date' },
  { type: 'BOOLEAN', icon: '☑', label: 'Checkbox' },
  { type: 'SELECT', icon: '▼', label: 'Dropdown' },
  { type: 'MULTI_SELECT', icon: '☑☑', label: 'Multi-Select' },
  { type: 'REFERENCE', icon: '🔗', label: 'Reference' },
  { type: 'MULTI_REFERENCE', icon: '🔗🔗', label: 'Multi-Reference' },
  { type: 'FILE', icon: '📁', label: 'File' },
  { type: 'IMAGE', icon: '🖼', label: 'Image' },
  { type: 'FORMULA', icon: '∑', label: 'Formula' },
  { type: 'COMPUTED', icon: '⚙', label: 'Computed' }
];
```

**Field Property Panel**:
```typescript
function FieldPropertyPanel({ field, onChange }: FieldPropertyPanelProps) {
  return (
    <div className="field-properties">
      <input
        label="Field ID"
        value={field.id}
        onChange={(e) => onChange({ ...field, id: e.target.value })}
      />
      <input
        label="Label"
        value={field.label}
        onChange={(e) => onChange({ ...field, label: e.target.value })}
      />
      <select
        label="Field Type"
        value={field.type}
        onChange={(e) => onChange({ ...field, type: e.target.value })}
      >
        {FIELD_TYPE_PALETTE.map(type => (
          <option value={type.type}>{type.icon} {type.label}</option>
        ))}
      </select>
      <checkbox
        label="Required"
        checked={field.required}
        onChange={(e) => onChange({ ...field, required: e.target.checked })}
      />

      {/* Type-specific properties */}
      {field.type === 'REFERENCE' && (
        <input
          label="Target Template"
          value={field.targetTemplate}
          onChange={(e) => onChange({ ...field, targetTemplate: e.target.value })}
        />
      )}
      {field.type === 'SELECT' && (
        <textarea
          label="Options (one per line)"
          value={field.options?.join('\n')}
          onChange={(e) => onChange({ ...field, options: e.target.value.split('\n') })}
        />
      )}
    </div>
  );
}
```

**Drag-and-Drop Reordering**:
```typescript
import { DndContext, closestCenter } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

function FieldList({ fields, onReorder }: FieldListProps) {
  const handleDragEnd = (event) => {
    const { active, over } = event;
    if (active.id !== over.id) {
      const oldIndex = fields.findIndex(f => f.id === active.id);
      const newIndex = fields.findIndex(f => f.id === over.id);
      const reordered = arrayMove(fields, oldIndex, newIndex);
      onReorder(reordered);
    }
  };

  return (
    <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
      <SortableContext items={fields.map(f => f.id)} strategy={verticalListSortingStrategy}>
        {fields.map(field => (
          <SortableFieldItem key={field.id} field={field} />
        ))}
      </SortableContext>
    </DndContext>
  );
}
```

### JSON5 Editor

**Syntax Highlighting**:
```typescript
import { EditorView } from '@codemirror/view';
import { json5 } from 'codemirror-lang-json5';
import { linter } from '@codemirror/lint';

function JSON5Editor({ content, onChange }: JSON5EditorProps) {
  const extensions = [
    json5(),  // JSON5 syntax highlighting
    linter(json5Linter),  // Real-time validation
    EditorView.updateListener.of((update) => {
      if (update.docChanged) {
        onChange(update.state.doc.toString());
      }
    })
  ];

  return <CodeMirror value={content} extensions={extensions} />;
}
```

**Validation**:
```typescript
import JSON5 from 'json5';
import Ajv from 'ajv';

const ajv = new Ajv();
const templateSchema = {
  type: 'object',
  required: ['templateId', 'name', 'fields'],
  properties: {
    templateId: { type: 'string' },
    name: { type: 'string' },
    category: { type: 'string' },
    fields: {
      type: 'array',
      items: {
        type: 'object',
        required: ['id', 'type'],
        properties: {
          id: { type: 'string' },
          type: { type: 'string', enum: ['STRING', 'NUMBER', 'REFERENCE', /* ... */] },
          label: { type: 'string' },
          required: { type: 'boolean' }
        }
      }
    }
  }
};

function validateTemplate(json5Content: string): ValidationResult {
  try {
    const template = JSON5.parse(json5Content);
    const valid = ajv.validate(templateSchema, template);
    if (!valid) {
      return { valid: false, errors: ajv.errors };
    }
    return { valid: true };
  } catch (err) {
    return { valid: false, errors: [{ message: err.message }] };
  }
}
```

### Two-Way Sync

**Sync Manager**:
```typescript
class TemplateSyncManager {
  private visualState: TemplateBuilderState;
  private json5Content: string;
  private syncing = false;

  // Visual → JSON5
  onVisualChange(newVisualState: TemplateBuilderState) {
    if (this.syncing) return;  // Prevent circular updates

    this.syncing = true;
    this.visualState = newVisualState;
    this.json5Content = this.serializeToJSON5(newVisualState);
    this.syncing = false;

    this.notifyJSON5Subscribers(this.json5Content);
  }

  // JSON5 → Visual
  onJSON5Change(newJSON5Content: string) {
    if (this.syncing) return;  // Prevent circular updates

    this.syncing = true;
    const validation = validateTemplate(newJSON5Content);

    if (validation.valid) {
      this.json5Content = newJSON5Content;
      this.visualState = this.parseJSON5(newJSON5Content);
      this.notifyVisualSubscribers(this.visualState);
    } else {
      this.notifyValidationError(validation.errors);
    }

    this.syncing = false;
  }

  private serializeToJSON5(state: TemplateBuilderState): string {
    return JSON5.stringify({
      templateId: state.templateId,
      name: state.name,
      category: state.category,
      fields: state.fields.map(f => ({
        id: f.id,
        type: f.type,
        label: f.label,
        required: f.required,
        ...this.getTypeSpecificProps(f)
      }))
    }, null, 2);  // Pretty-print with 2-space indent
  }

  private parseJSON5(content: string): TemplateBuilderState {
    const template = JSON5.parse(content);
    return {
      templateId: template.templateId,
      name: template.name,
      category: template.category,
      fields: template.fields.map(f => ({
        id: f.id,
        type: f.type as FieldType,
        label: f.label || f.id,
        required: f.required || false,
        ...this.parseTypeSpecificProps(f)
      }))
    };
  }
}
```

### Template Storage

**File System Structure**:
```
.vespera/
└── templates/
    ├── atomic/
    │   ├── string-codex.template.json5
    │   ├── number-codex.template.json5
    │   └── markdown-codex.template.json5
    ├── creative-writing/
    │   ├── character.template.json5
    │   ├── scene.template.json5
    │   └── world.template.json5
    └── software-dev/
        ├── feature.template.json5
        ├── bug-report.template.json5
        └── code-file.template.json5
```

**File Watcher**:
```typescript
import chokidar from 'chokidar';

class TemplateFileWatcher {
  private watcher: chokidar.FSWatcher;

  start() {
    this.watcher = chokidar.watch('.vespera/templates/**/*.template.json5', {
      persistent: true,
      ignoreInitial: false
    });

    this.watcher
      .on('add', (path) => this.onTemplateAdded(path))
      .on('change', (path) => this.onTemplateChanged(path))
      .on('unlink', (path) => this.onTemplateDeleted(path));
  }

  private async onTemplateChanged(path: string) {
    const content = await fs.readFile(path, 'utf-8');
    const validation = validateTemplate(content);

    if (validation.valid) {
      await this.reloadTemplate(path);
      this.notifyTemplateUpdated(path);
    } else {
      this.notifyValidationError(path, validation.errors);
    }
  }
}
```

### AI Agent Integration

Agents can edit templates directly:
```typescript
// Agent edits JSON5 file programmatically
const templatePath = '.vespera/templates/creative-writing/character.template.json5';
const template = JSON5.parse(await fs.readFile(templatePath, 'utf-8'));

// Add new field
template.fields.push({
  id: 'motivation',
  type: 'REFERENCE',
  targetTemplate: 'markdown-codex',
  label: 'Character Motivation',
  required: false
});

// Save back
await fs.writeFile(templatePath, JSON5.stringify(template, null, 2));

// System detects change via file watcher, reloads template
```

## Migration Path

**Phase 19**: Implement JSON5 editor with syntax highlighting and validation
**Phase 20**: Build visual form builder with drag-drop
**Phase 21**: Implement two-way sync between visual and JSON5 modes
**Phase 22**: Add live preview panel showing template rendering

## User Guidance

**For Casual Users**:
- Start with Visual mode (default)
- Drag fields from palette to add
- Click field to edit properties in side panel
- Toggle to JSON5 mode to see underlying structure (optional)

**For Power Users**:
- Switch to JSON5 mode (Ctrl+Shift+J)
- Edit directly with syntax highlighting and validation
- Use "Format" button (Ctrl+Shift+F) to pretty-print
- Toggle to Visual mode to verify structure (optional)

**For AI Agents**:
- Edit `.vespera/templates/*.template.json5` files directly
- File watcher detects changes and reloads template
- Use JSON5 format (allows comments, trailing commas)
- Validate against schema before saving

## Links

* Refines [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [ADR-021: Inline Reference Editing Pattern](./ADR-021-inline-reference-editing-pattern.md)
* Related to [Hierarchical Template System](../../architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)
* Related to [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)
