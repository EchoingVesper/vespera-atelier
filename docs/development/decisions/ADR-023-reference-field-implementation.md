# ADR-023: Reference Field Implementation

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - Component-Composition Architecture

---

## Context and Problem Statement

The REFERENCE field type is the cornerstone of the extreme atomicity architecture (ADR-020). Every field in a Codex can reference another Codex, creating a deep knowledge graph. For example, a Character's "name" field references a StringCodex, and its "portrait" field references an ImageCodex.

However, implementing REFERENCE fields raises several technical questions:
1. **Creation**: How does the system create and link referenced Codices?
2. **Selection**: How does the user choose which Codex to reference?
3. **Type filtering**: How do we ensure "name" field only references StringCodex, not ImageCodex?
4. **Relationship tracking**: How are references stored in the database?
5. **Circular references**: What if Codex A references B, which references A?
6. **Multi-references**: How to handle arrays of references (e.g., "cast" field with multiple Characters)?

**Question**: What is the complete implementation strategy for REFERENCE fields?

## Decision Drivers

* **Type safety**: Field should only accept references to compatible Codex types
* **User experience**: Selecting references should be intuitive (not typing IDs)
* **Relationship integrity**: Links should be bidirectional for knowledge graph traversal
* **Circular prevention**: Avoid infinite loops in graph traversal
* **Performance**: Efficient queries for loading referenced Codices
* **Flexibility**: Support both single and multi-reference fields
* **Atomicity**: Preserve benefits of extreme atomicity architecture

## Considered Options

**Option 1**: **Freeform Text Entry**
- User types Codex ID manually: `"string-001"`
- Flexible but error-prone

**Option 2**: **Type-Filtered Codex Selector** (Chosen)
- UI shows picker with only compatible Codex types
- Specify `targetTemplate` in field definition
- Autocomplete search within compatible types

**Option 3**: **Autocomplete Search Only**
- Search bar with fuzzy matching
- No visual picker, just search results
- Fast but lacks discoverability

## Decision Outcome

Chosen option: **"Option 2: Type-Filtered Codex Selector"**, because it provides type safety, good UX, and prevents common errors. The picker shows only Codices matching the `targetTemplate`, making selection intuitive while maintaining type constraints.

### Positive Consequences

* **Type safety**: Field only accepts compatible Codex types
* **Intuitive UX**: Visual picker shows available Codices
* **Autocomplete**: Fast search within picker
* **Prevents errors**: Can't accidentally link wrong type
* **Relationship tracking**: Automatic bidirectional link creation
* **Circular detection**: Prevent infinite loops
* **Multi-reference support**: Arrays of references with reordering

### Negative Consequences

* **Implementation complexity**: Need type-aware picker UI
* **Query overhead**: Must load candidate Codices for picker
* **Cache invalidation**: Picker must update when new Codices created
* **Circular detection cost**: Graph traversal to check cycles
* **Relationship storage**: More database rows for bidirectional links

## Pros and Cons of the Options

### Option 1: Freeform Text Entry

**Example**:
```typescript
// User types ID manually
<input
  type="text"
  placeholder="Enter Codex ID (e.g., string-001)"
  value={referenceId}
  onChange={(e) => setReferenceId(e.target.value)}
/>
```

* Good, because **simple implementation** (just a text input)
* Good, because **flexible** (can reference any Codex)
* Good, because **no query overhead** (no need to load candidate list)
* Bad, because **error-prone** (typos break references)
* Bad, because **no type safety** (can link incompatible types)
* Bad, because **poor UX** (user must know/remember IDs)
* Bad, because **not discoverable** (can't browse available Codices)

### Option 2: Type-Filtered Codex Selector (Chosen)

**Example**:
```typescript
// Field definition
{
  id: "name",
  type: REFERENCE,
  targetTemplate: "string-codex",  // Only StringCodex allowed
  label: "Character Name"
}

// UI component
<CodexPicker
  targetTemplate="string-codex"
  selectedId={referenceId}
  onSelect={(codexId) => setReferenceId(codexId)}
/>
```

**Picker UI**:
```
┌──────────────────────────────────────┐
│ Select String Codex                  │
├──────────────────────────────────────┤
│ [Search: alice______________] 🔍     │
├──────────────────────────────────────┤
│ ○ Alice              #protagonist    │ ← Radio button + tags
│ ○ Alice (Full Name)  #character-name │
│ ○ Alice Smith        #formal-name    │
│                                      │
│ [+ Create New StringCodex]           │ ← Quick create
└──────────────────────────────────────┘
```

* Good, because **type safe** (only shows compatible Codices)
* Good, because **intuitive UX** (visual selection, not typing IDs)
* Good, because **autocomplete search** (fast filtering)
* Good, because **prevents errors** (can't select wrong type)
* Good, because **discoverable** (browse existing Codices)
* Good, because **quick create** (create new Codex inline)
* Bad, because **query overhead** (must load candidate Codices)
* Bad, because **cache complexity** (picker must stay updated)
* Bad, because **implementation effort** (type-aware picker UI)

**Query Optimization**:
```typescript
// Load only minimal data for picker (not full Codices)
const candidates = await db.query(`
  SELECT id, metadata->>'title' AS title, metadata->>'tags' AS tags
  FROM codices
  WHERE template_id = $1
  ORDER BY updated_at DESC
  LIMIT 50
`, [targetTemplate]);
```

### Option 3: Autocomplete Search Only

**Example**:
```typescript
<Autocomplete
  placeholder="Search for String Codex..."
  onSearch={(query) => searchCodexes(query, { templateId: 'string-codex' })}
  onSelect={(codex) => setReferenceId(codex.id)}
  renderItem={(codex) => `${codex.title} (${codex.id})`}
/>
```

* Good, because **fast keyboard workflow** (no mouse needed)
* Good, because **minimal UI** (just search input)
* Good, because **type safe** (search filtered by template)
* Good, because **performant** (load results on-demand)
* Bad, because **poor discoverability** (must know what to search for)
* Bad, because **no browsing** (can't see all available Codices)
* Bad, because **empty state problem** (what if no search results?)

## Implementation Details

### Field Definition

**REFERENCE Field Schema**:
```typescript
interface ReferenceFieldDefinition {
  id: string;                    // "name"
  type: FieldType.REFERENCE;     // REFERENCE
  targetTemplate: string;        // "string-codex"
  label: string;                 // "Character Name"
  required: boolean;             // true
  allowCreate: boolean;          // Allow inline creation (default: true)
  circularCheck: boolean;        // Prevent circular refs (default: true)
  maxDepth?: number;             // Max reference chain depth (default: 10)
}
```

**MULTI_REFERENCE Field Schema**:
```typescript
interface MultiReferenceFieldDefinition {
  id: string;                    // "cast"
  type: FieldType.MULTI_REFERENCE;
  targetTemplate: string;        // "character"
  label: string;                 // "Cast Members"
  required: boolean;             // false
  minItems?: number;             // Minimum references (default: 0)
  maxItems?: number;             // Maximum references (default: unlimited)
  allowReorder: boolean;         // Drag-to-reorder (default: true)
}
```

### Codex Picker Component

**Single Reference Picker**:
```typescript
interface CodexPickerProps {
  targetTemplate: string;          // Filter by template
  selectedId: string | null;       // Currently selected Codex ID
  onSelect: (codexId: string) => void;
  allowCreate?: boolean;           // Show "Create New" button
  projectId?: string;              // Filter by project (optional)
  contextId?: string;              // Filter by context (optional)
}

function CodexPicker({
  targetTemplate,
  selectedId,
  onSelect,
  allowCreate = true
}: CodexPickerProps) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<CodexSummary[]>([]);

  // Load candidates on mount and when search changes
  useEffect(() => {
    loadCandidates(targetTemplate, search).then(setCandidates);
  }, [targetTemplate, search]);

  return (
    <div className="codex-picker">
      <input
        type="text"
        placeholder={`Search ${targetTemplate}...`}
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

      <div className="candidate-list">
        {candidates.map(codex => (
          <div
            key={codex.id}
            className={`candidate ${selectedId === codex.id ? 'selected' : ''}`}
            onClick={() => onSelect(codex.id)}
          >
            <input
              type="radio"
              checked={selectedId === codex.id}
              readOnly
            />
            <span className="title">{codex.title}</span>
            <span className="tags">{codex.tags.join(', ')}</span>
          </div>
        ))}
      </div>

      {allowCreate && (
        <button onClick={() => createAndSelect(targetTemplate, search)}>
          + Create New {targetTemplate}
        </button>
      )}
    </div>
  );
}

// Quick create from picker
async function createAndSelect(targetTemplate: string, initialValue: string) {
  // For StringCodex, use search query as initial value
  const newCodex = await createCodex({
    templateId: targetTemplate,
    fields: {
      value: { type: 'TEXT', value: initialValue }
    }
  });

  onSelect(newCodex.id);
}
```

**Multi-Reference Picker**:
```typescript
function MultiCodexPicker({
  targetTemplate,
  selectedIds,
  onUpdate
}: MultiCodexPickerProps) {
  const [showPicker, setShowPicker] = useState(false);

  const handleAdd = (codexId: string) => {
    onUpdate([...selectedIds, codexId]);
    setShowPicker(false);
  };

  const handleRemove = (codexId: string) => {
    onUpdate(selectedIds.filter(id => id !== codexId));
  };

  const handleReorder = (startIndex: number, endIndex: number) => {
    const reordered = arrayMove(selectedIds, startIndex, endIndex);
    onUpdate(reordered);
  };

  return (
    <div className="multi-codex-picker">
      {/* Selected items with drag-to-reorder */}
      <DndContext onDragEnd={(e) => handleReorder(e.active.index, e.over.index)}>
        <SortableContext items={selectedIds}>
          {selectedIds.map((id, index) => (
            <SortableCodexItem
              key={id}
              codexId={id}
              index={index}
              onRemove={() => handleRemove(id)}
            />
          ))}
        </SortableContext>
      </DndContext>

      {/* Add button */}
      <button onClick={() => setShowPicker(true)}>
        + Add {targetTemplate}
      </button>

      {/* Picker modal */}
      {showPicker && (
        <Modal onClose={() => setShowPicker(false)}>
          <CodexPicker
            targetTemplate={targetTemplate}
            selectedId={null}
            onSelect={handleAdd}
          />
        </Modal>
      )}
    </div>
  );
}
```

### Relationship Storage

**Database Schema**:
```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES codices(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES codices(id) ON DELETE CASCADE,
  type TEXT NOT NULL,  -- 'REFERENCE', 'PARENT_CHILD', 'TAG', etc.
  field_id TEXT,       -- Which field created this relationship (e.g., "name")
  strength REAL DEFAULT 1.0,
  metadata JSONB,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),

  -- Prevent duplicate relationships
  UNIQUE(source_id, target_id, type, field_id)
);

-- Indexes for graph traversal
CREATE INDEX idx_relationships_source ON relationships(source_id);
CREATE INDEX idx_relationships_target ON relationships(target_id);
CREATE INDEX idx_relationships_type ON relationships(type);
```

**Creating Relationship**:
```typescript
async function createReference(
  sourceId: string,
  targetId: string,
  fieldId: string
): Promise<Relationship> {
  // Create bidirectional relationship
  const relationship = await db.insert('relationships', {
    source_id: sourceId,
    target_id: targetId,
    type: RelationshipType.REFERENCE,
    field_id: fieldId,
    strength: 1.0
  });

  // Emit event for knowledge graph update
  eventBus.emit('relationship:created', relationship);

  return relationship;
}
```

**Loading References**:
```typescript
// Load all references for a Codex
async function loadReferences(codexId: string): Promise<CodexReference[]> {
  const relationships = await db.query(`
    SELECT r.*, c.id, c.template_id, c.metadata
    FROM relationships r
    JOIN codices c ON c.id = r.target_id
    WHERE r.source_id = $1 AND r.type = 'REFERENCE'
    ORDER BY r.field_id
  `, [codexId]);

  return relationships.map(row => ({
    fieldId: row.field_id,
    codex: {
      id: row.id,
      templateId: row.template_id,
      metadata: row.metadata
    }
  }));
}

// Batch load multiple references (for performance)
async function batchLoadReferences(codexIds: string[]): Promise<Map<string, CodexReference[]>> {
  const relationships = await db.query(`
    SELECT r.*, c.id, c.template_id, c.metadata
    FROM relationships r
    JOIN codices c ON c.id = r.target_id
    WHERE r.source_id = ANY($1) AND r.type = 'REFERENCE'
  `, [codexIds]);

  // Group by source Codex
  const map = new Map<string, CodexReference[]>();
  for (const row of relationships) {
    const refs = map.get(row.source_id) || [];
    refs.push({
      fieldId: row.field_id,
      codex: { id: row.id, templateId: row.template_id, metadata: row.metadata }
    });
    map.set(row.source_id, refs);
  }

  return map;
}
```

### Circular Reference Prevention

**Depth-Limited Traversal**:
```typescript
async function checkCircularReference(
  sourceId: string,
  targetId: string,
  maxDepth: number = 10
): Promise<boolean> {
  // Use BFS to detect cycles
  const visited = new Set<string>();
  const queue: Array<{ id: string; depth: number }> = [{ id: targetId, depth: 0 }];

  while (queue.length > 0) {
    const { id, depth } = queue.shift()!;

    // Reached source = circular reference detected
    if (id === sourceId) {
      return true;
    }

    // Exceeded max depth = assume no cycle (prevent infinite loop)
    if (depth >= maxDepth) {
      continue;
    }

    // Already visited = skip
    if (visited.has(id)) {
      continue;
    }
    visited.add(id);

    // Add outgoing references to queue
    const outgoing = await getOutgoingReferences(id);
    queue.push(...outgoing.map(ref => ({ id: ref.targetId, depth: depth + 1 })));
  }

  return false;
}

// Validate before creating reference
async function createReferenceWithValidation(
  sourceId: string,
  targetId: string,
  fieldId: string
): Promise<Relationship | Error> {
  // Check for circular reference
  const isCircular = await checkCircularReference(sourceId, targetId);
  if (isCircular) {
    throw new Error(`Cannot create reference: would create circular dependency`);
  }

  return createReference(sourceId, targetId, fieldId);
}
```

**Cycle Detection UI**:
```typescript
function ReferenceFieldEditor({ field, sourceCodexId, value, onChange }: FieldEditorProps) {
  const [circularError, setCircularError] = useState<string | null>(null);

  const handleSelect = async (targetId: string) => {
    // Check for circular reference
    const isCircular = await checkCircularReference(sourceCodexId, targetId);
    if (isCircular) {
      setCircularError('This would create a circular reference');
      return;
    }

    setCircularError(null);
    onChange(targetId);
  };

  return (
    <div className="reference-field-editor">
      <CodexPicker
        targetTemplate={field.targetTemplate}
        selectedId={value}
        onSelect={handleSelect}
      />
      {circularError && (
        <div className="error">{circularError}</div>
      )}
    </div>
  );
}
```

### Type Safety Validation

**Template Validation**:
```typescript
async function validateReferenceTarget(
  fieldDef: ReferenceFieldDefinition,
  targetCodexId: string
): Promise<ValidationResult> {
  const targetCodex = await loadCodex(targetCodexId);

  // Check template matches
  if (targetCodex.templateId !== fieldDef.targetTemplate) {
    return {
      valid: false,
      error: `Expected ${fieldDef.targetTemplate}, got ${targetCodex.templateId}`
    };
  }

  return { valid: true };
}
```

### Performance Optimization

**Reference Caching**:
```typescript
class ReferenceCache {
  private cache = new Map<string, CodexReference[]>();
  private ttl = 60_000;  // 1 minute TTL

  async get(codexId: string): Promise<CodexReference[] | null> {
    const entry = this.cache.get(codexId);
    if (!entry) return null;

    // Check TTL
    if (Date.now() - entry.timestamp > this.ttl) {
      this.cache.delete(codexId);
      return null;
    }

    return entry.references;
  }

  set(codexId: string, references: CodexReference[]) {
    this.cache.set(codexId, {
      references,
      timestamp: Date.now()
    });
  }

  invalidate(codexId: string) {
    this.cache.delete(codexId);
  }
}

// Use cache in reference loading
async function loadReferencesWithCache(codexId: string): Promise<CodexReference[]> {
  const cached = await referenceCache.get(codexId);
  if (cached) return cached;

  const references = await loadReferences(codexId);
  referenceCache.set(codexId, references);
  return references;
}
```

## Migration Path

**Phase 19**: Implement REFERENCE field type and basic picker
**Phase 20**: Add circular reference detection and multi-reference support
**Phase 21**: Implement relationship caching and batch loading
**Phase 22**: Add real-time updates for picker (WebSocket)

## User Guidance

**For Template Authors**:
```json5
{
  id: "portrait",
  type: "REFERENCE",
  targetTemplate: "image-codex",  // Only ImageCodex allowed
  label: "Character Portrait",
  required: false,
  allowCreate: true,  // Show "Create New Image" button
  circularCheck: true  // Prevent circular references
}
```

**For End Users**:
- Click field to open picker
- Search or browse available Codices
- Click "Create New" to create inline
- Drag to reorder multi-references

## Links

* Refines [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [ADR-021: Inline Reference Editing Pattern](./ADR-021-inline-reference-editing-pattern.md)
* Related to [ADR-027: Multi-Context Array Implementation](./ADR-027-multi-context-array-implementation.md)
