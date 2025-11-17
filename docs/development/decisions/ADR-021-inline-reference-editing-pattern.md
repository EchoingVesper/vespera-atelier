# ADR-021: Inline Reference Editing Pattern

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - Component-Composition Architecture UX

---

## Context and Problem Statement

With the extreme atomicity architecture (ADR-020), every field value is a Codex reference. Even simple text like a character's name is stored as a StringCodex that the Character Codex references. However, this creates a significant UX challenge:

**Without inline editing**: User would need to:
1. Create a StringCodex manually
2. Enter "Alice" as the value
3. Navigate back to Character editor
4. Select the newly created StringCodex from a dropdown
5. Link it to the name field

This workflow would be unacceptably tedious for every field in every Codex.

**Question**: How do we maintain the benefits of extreme atomicity while providing a seamless, intuitive editing experience?

## Decision Drivers

* **User experience**: Editing should feel natural, not bureaucratic
* **Hidden complexity**: User shouldn't need to understand atomicity to use the system
* **Performance**: Inline editing should be fast and responsive
* **Flexibility**: Power users should be able to access underlying Codices when needed
* **Consistency**: Pattern should work for both simple (StringCodex) and complex (ImageCodex) atomic types
* **Mobile-friendly**: Touch-friendly editing for tablet/phone use

## Considered Options

**Option 1**: **Explicit Navigation**
- User manually creates atomic Codices first
- Then links them via dropdown selectors
- Full control, fully transparent

**Option 2**: **Inline Reference Editing** (Chosen)
- User types directly in field as if it's a simple text input
- Backend automatically creates/updates atomic Codices transparently
- UI shows "Edit in Detail" button for complex Codices

**Option 3**: **Hybrid Approach**
- Simple fields (text, number) use direct values (revert to non-atomic)
- Complex fields (image, markdown) use explicit references
- Inconsistent but pragmatic

## Decision Outcome

Chosen option: **"Option 2: Inline Reference Editing"**, because it provides the best user experience while maintaining the benefits of extreme atomicity. Users can edit naturally without understanding the underlying architecture, while power users can "dive deep" into atomic Codices when needed.

### Positive Consequences

* **Natural editing flow**: User types "Alice" in name field → StringCodex created automatically
* **No training required**: Works like any traditional form interface
* **Hidden complexity**: User doesn't need to understand references or atomicity
* **Progressive disclosure**: "Edit in Detail" button reveals atomic Codex when needed
* **Fast workflow**: No extra clicks for simple edits
* **Consistent pattern**: Works for all field types (text, number, date, etc.)
* **Preserves atomicity benefits**: Backend still creates atomic Codices for RAG efficiency

### Negative Consequences

* **Implementation complexity**: Need bidirectional sync (UI ↔ atomic Codex)
* **Magic behavior**: Some users may be confused when they discover underlying Codices
* **Conflict resolution**: What if atomic Codex is edited independently while also being edited inline?
* **Performance overhead**: Each keystroke could trigger Codex updates (needs debouncing)
* **Testing complexity**: More UI logic to test (inline editing + underlying CRUD)

## Pros and Cons of the Options

### Option 1: Explicit Navigation

**Example workflow**:
```
User: Create Character
  → Field: Name → [Create StringCodex] button
    → Navigate to StringCodex creator
      → Enter "Alice"
      → Save
    → Navigate back to Character editor
      → Select StringCodex from dropdown
      → Link to name field
  → Repeat for every field...
```

* Good, because **fully transparent** (user sees all Codices being created)
* Good, because **no magic** (explicit control over every step)
* Good, because **simple implementation** (no inline editing logic needed)
* Bad, because **terrible UX** (5-6 clicks per field, constant navigation)
* Bad, because **high cognitive load** (user must understand atomicity upfront)
* Bad, because **slow workflow** (unacceptable for rapid content creation)
* Bad, because **mobile-hostile** (too many navigation steps on small screen)

### Option 2: Inline Reference Editing (Chosen)

**Example workflow**:
```typescript
// User sees simple text input
<input
  type="text"
  value="Alice"  // Appears to be direct value
  onChange={(e) => handleInlineEdit(e.target.value)}
/>

// Backend handles atomic Codex transparently
async function handleInlineEdit(newValue: string) {
  // 1. Find or create StringCodex
  let stringCodex = await findStringCodex(characterCodex.fields.name.target);
  if (!stringCodex) {
    stringCodex = await createStringCodex({ value: newValue });
    await linkToCharacter(characterCodex, 'name', stringCodex.id);
  } else {
    await updateStringCodex(stringCodex.id, { value: newValue });
  }
  // 2. User never sees this complexity
}
```

**UI Pattern**:
```
┌─────────────────────────────────────┐
│ Character Editor                    │
├─────────────────────────────────────┤
│ Name: [Alice____________] [📝 Detail]│  ← Inline edit + detail button
│ Age:  [25_______________] [📝 Detail]│
│ Bio:  [Brave adventurer...         ]│
│       [                            ]│  ← Multi-line inline edit
│       [📝 Edit Markdown in Detail] │  ← Complex type needs detail view
└─────────────────────────────────────┘
```

* Good, because **natural UX** (works like traditional form fields)
* Good, because **fast workflow** (type directly, no extra navigation)
* Good, because **low cognitive load** (user doesn't need to understand atomicity)
* Good, because **progressive disclosure** ("Edit in Detail" for power users)
* Good, because **mobile-friendly** (simple text input, no navigation)
* Good, because **preserves atomicity** (backend still creates atomic Codices)
* Bad, because **implementation complexity** (bidirectional sync, debouncing)
* Bad, because **"magic" behavior** (may surprise users when discovered)
* Bad, because **conflict potential** (if atomic Codex edited elsewhere)

**Conflict Resolution Strategy**:
- **Optimistic locking**: Track version number on atomic Codex
- **Conflict detection**: If version mismatch, show "Field was edited elsewhere"
- **Merge UI**: Let user choose: Keep inline edit | Keep external edit | Merge both
- **Real-time sync**: Use WebSocket to show live updates from other editors (future)

### Option 3: Hybrid Approach

**Example**:
```typescript
{
  // Simple fields use direct values (no atomicity)
  name: "Alice",
  age: 25,

  // Complex fields use references
  portrait: { type: REFERENCE, target: "image-001" }
}
```

* Good, because **simpler** (no inline editing logic for simple fields)
* Good, because **performant** (fewer Codices to create/load)
* Good, because **familiar** (traditional data model for simple fields)
* Bad, because **inconsistent architecture** (sometimes atomic, sometimes not)
* Bad, because **loses RAG benefits** (can't load just "name" field)
* Bad, because **loses metadata** (can't tag/timestamp simple values)
* Bad, because **betrays core vision** (not truly atomic composition)

## Implementation Details

### Inline Editing Component

**StringCodex Inline Editor**:
```typescript
interface InlineStringEditorProps {
  fieldId: string;           // "name"
  referenceId: string;       // "string-001"
  onUpdate: (value: string) => void;
}

function InlineStringEditor({ fieldId, referenceId, onUpdate }: InlineStringEditorProps) {
  const [value, setValue] = useState('');
  const [loading, setLoading] = useState(false);

  // Load atomic Codex value on mount
  useEffect(() => {
    loadStringCodex(referenceId).then(codex => setValue(codex.value));
  }, [referenceId]);

  // Debounced save to prevent excessive updates
  const debouncedSave = useMemo(
    () => debounce((newValue: string) => {
      updateStringCodex(referenceId, { value: newValue });
      onUpdate(newValue);
    }, 500),
    [referenceId]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setValue(e.target.value);
    debouncedSave(e.target.value);
  };

  return (
    <div className="inline-editor">
      <input
        type="text"
        value={value}
        onChange={handleChange}
        disabled={loading}
      />
      <button onClick={() => navigateToCodex(referenceId)}>
        📝 Edit in Detail
      </button>
    </div>
  );
}
```

### Auto-Creation Pattern

**Creating new Character with inline editing**:
```typescript
async function createCharacter(formData: CharacterFormData) {
  // 1. Create atomic Codices for each field
  const nameCodex = await createStringCodex({ value: formData.name });
  const ageCodex = await createNumberCodex({ value: formData.age });
  const bioCodex = await createMarkdownCodex({ value: formData.bio });

  // 2. Create Character Codex with references
  const characterCodex = await createCodex({
    templateId: 'character',
    fields: {
      name: { type: REFERENCE, target: nameCodex.id },
      age: { type: REFERENCE, target: ageCodex.id },
      bio: { type: REFERENCE, target: bioCodex.id }
    }
  });

  // 3. User never saw steps 1-2 happen
  return characterCodex;
}
```

### Complex Codex Editing

For complex atomic types (MarkdownCodex, ImageCodex), inline editing has limitations:

**MarkdownCodex**:
- **Inline**: Show preview with "Edit Markdown" button
- **Detail**: Full markdown editor with live preview, syntax highlighting
- **Pattern**: Click "Edit Markdown" → Modal/side panel with full editor

**ImageCodex**:
- **Inline**: Show thumbnail with "Change Image" button
- **Detail**: Full image editor with crop, filters, metadata
- **Pattern**: Click "Change Image" → File picker + image editor modal

**FileCodex**:
- **Inline**: Show filename with "Open File" button
- **Detail**: VS Code editor integration (for code files)
- **Pattern**: Click "Open File" → Launch in VS Code

### Debouncing Strategy

To prevent excessive updates:
```typescript
// Debounce delay based on field type
const DEBOUNCE_DELAYS = {
  STRING: 500,   // Short text
  TEXT: 1000,    // Long text (multi-line)
  NUMBER: 300,   // Numbers (less typing)
  DATE: 0        // Date picker (immediate)
};

function useDebouncedFieldUpdate(fieldType: FieldType, onUpdate: Function) {
  const delay = DEBOUNCE_DELAYS[fieldType] || 500;
  return useMemo(
    () => debounce(onUpdate, delay),
    [onUpdate, delay]
  );
}
```

### Offline Support

For mobile use cases:
```typescript
// Queue updates when offline
const updateQueue: Update[] = [];

async function saveFieldUpdate(codexId: string, value: any) {
  if (navigator.onLine) {
    await api.updateCodex(codexId, { value });
  } else {
    updateQueue.push({ codexId, value, timestamp: Date.now() });
    // Save to local storage
    await saveToIndexedDB('update-queue', updateQueue);
  }
}

// Sync when back online
window.addEventListener('online', async () => {
  const queued = await loadFromIndexedDB('update-queue');
  for (const update of queued) {
    await api.updateCodex(update.codexId, { value: update.value });
  }
  await clearIndexedDB('update-queue');
});
```

## Migration Path

**Phase 19**: Implement inline editing for StringCodex and NumberCodex
**Phase 20**: Extend to DateCodex, BooleanCodex
**Phase 21**: Complex types (MarkdownCodex, ImageCodex) with detail modals
**Phase 22**: Real-time sync for multi-user editing

## User Guidance

**For End Users**:
- Edit fields naturally - no need to understand atomicity
- Use "Edit in Detail" button to access atomic Codex metadata
- Tag atomic Codices to organize values (e.g., tag "Alice" with "#protagonist")

**For Template Authors**:
- Use REFERENCE field type for all fields (automatic inline editing)
- Specify `targetTemplate` to control atomic Codex type
- Set `inlineEditable: false` to force detail view (for complex types)

**For Developers**:
- Implement `InlineEditor` component for each atomic template
- Handle debouncing to prevent excessive API calls
- Implement conflict resolution for concurrent edits

## Links

* Refines [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [ADR-023: Reference Field Implementation](./ADR-023-reference-field-implementation.md)
* Related to [ADR-022: Template Editor Dual Interface](./ADR-022-template-editor-dual-interface.md)
