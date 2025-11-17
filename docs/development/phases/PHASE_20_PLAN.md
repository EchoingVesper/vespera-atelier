# Phase 20: Reference System & Auto-Creation

**Status**: Proposed
**Duration**: 6-8 days
**Related ADRs**: [ADR-020](../decisions/ADR-020-extreme-atomic-architecture.md), [ADR-021](../decisions/ADR-021-inline-reference-editing-pattern.md), [ADR-023](../decisions/ADR-023-reference-field-implementation.md), [ADR-027](../decisions/ADR-027-multi-context-array-implementation.md)

---

## Executive Summary

Phase 20 implements the composition mechanism that makes extreme atomicity usable through REFERENCE and MULTI_REFERENCE field types with inline editing patterns. This phase enables users to compose complex Codices from atomic building blocks transparently, introduces automatic Codex creation on field edit (the "inline reference" pattern), implements bidirectional relationship tracking for the knowledge graph, and creates the backlinks panel as the foundation for graph visualization. The work completes the core user-facing atomicity architecture, making composed Codices feel as natural to edit as traditional forms.

---

## Objectives

### Primary Goals
- [ ] **REFERENCE Field Type** - Single reference to another Codex with type filtering
- [ ] **MULTI_REFERENCE Field Type** - Array of references with reordering and management
- [ ] **Inline Reference Editing** - Auto-create/update atomic Codices transparently
- [ ] **Type-Filtered Codex Picker** - UI for selecting compatible Codices
- [ ] **Relationship Tracking** - Bidirectional graph edges in database
- [ ] **Backlinks Panel** - Show all Codices referencing current Codex
- [ ] **Circular Reference Detection** - Prevent infinite loops in graph

### Secondary Goals
- [ ] **Reference Caching** - Cache loaded references for performance
- [ ] **Batch Loading** - Load multiple references in single query
- [ ] **Quick Create from Picker** - Create new Codex inline from picker
- [ ] **Reference Validation** - Ensure target template matches field requirements
- [ ] **Relationship Metadata** - Track relationship strength, types, creation dates

### Non-Goals
- **File/Image Integration** - Deferred to Phase 21 (FILE/IMAGE field types)
- **Multi-User Editing** - Real-time sync deferred to post-MVP
- **Advanced Graph Queries** - Complex graph traversal deferred
- **Automated Relationship Suggestions** - AI-suggested relationships deferred

---

## Prerequisites

Before starting Phase 20:

- [ ] Phase 19 complete (atomic templates, template editor, FORMULA/COMPUTED)
- [ ] User approval of this phase plan
- [ ] Decision: Relationship storage schema (array field vs. join table - ADR-027 recommends array)
- [ ] Decision: Reference picker UI style (modal, dropdown, side panel)
- [ ] Decision: Auto-creation behavior (always create, ask first, user preference)
- [ ] Decision: Circular reference max depth (default: 10 levels)

---

## Technical Approach

### Architecture Patterns

**1. REFERENCE Field Type**

Single reference to another Codex with type filtering:

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

// Usage in Character template
{
  templateId: "character",
  fields: [
    {
      id: "name",
      type: "REFERENCE",
      targetTemplate: "string-codex",  // Only StringCodex allowed
      label: "Character Name",
      required: true
    }
  ]
}
```

**2. MULTI_REFERENCE Field Type**

Array of references with reordering:

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

// Usage in Scene template
{
  templateId: "scene",
  fields: [
    {
      id: "characters",
      type: "MULTI_REFERENCE",
      targetTemplate: "character",
      label: "Characters in Scene",
      minItems: 1,  // At least one character required
      allowReorder: true
    }
  ]
}
```

**3. Inline Reference Editing**

Transparent auto-creation of atomic Codices:

```typescript
// User types "Alice" in name field
// System automatically:
async function handleInlineEdit(characterCodexId: string, fieldId: string, newValue: string) {
  // 1. Check if reference already exists
  const existingRef = await getFieldReference(characterCodexId, fieldId);

  if (existingRef) {
    // Update existing StringCodex
    await updateStringCodex(existingRef.targetId, { value: newValue });
  } else {
    // Create new StringCodex
    const stringCodex = await createCodex({
      templateId: 'string-codex',
      fields: { value: { type: 'TEXT', value: newValue } }
    });

    // Link to character
    await createReference(characterCodexId, stringCodex.id, fieldId);
  }

  // User never sees this complexity - it just works
}
```

**4. Type-Filtered Codex Picker**

UI for selecting compatible Codices:

```typescript
function CodexPicker({
  targetTemplate,    // "string-codex"
  selectedId,        // Currently selected Codex ID
  onSelect,          // Callback when selection changes
  allowCreate = true
}: CodexPickerProps) {
  const [search, setSearch] = useState('');
  const [candidates, setCandidates] = useState<CodexSummary[]>([]);

  // Load only compatible Codices
  useEffect(() => {
    loadCodexesByTemplate(targetTemplate, search).then(setCandidates);
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
            <input type="radio" checked={selectedId === codex.id} readOnly />
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
```

**5. Relationship Storage & Tracking**

Bidirectional graph edges:

```sql
CREATE TABLE relationships (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_id UUID NOT NULL REFERENCES codices(id) ON DELETE CASCADE,
  target_id UUID NOT NULL REFERENCES codices(id) ON DELETE CASCADE,
  type TEXT NOT NULL,           -- 'REFERENCE', 'PARENT_CHILD', 'TAG'
  field_id TEXT,                -- Which field created this (e.g., "name")
  strength REAL DEFAULT 1.0,    -- Relationship weight (future use)
  metadata JSONB,               -- Additional relationship data
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

**6. Circular Reference Prevention**

Depth-limited BFS to detect cycles:

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
```

---

## Task Breakdown

### Backend Tasks (Database & API)

**Task 1: Relationship Schema** (3 hours)
- Create `relationships` table with source/target/type/field
- Add indexes for graph traversal (source, target, type)
- Implement relationship CRUD operations
- Add cascade deletion (delete relationships when Codex deleted)
- Tests: CRUD, indexing, cascade, uniqueness constraints

**Task 2: Reference Field Storage** (4 hours)
- Extend Codex metadata to store reference IDs
- Implement reference linking/unlinking
- Add batch reference loading (performance optimization)
- Implement reference cache with invalidation
- Tests: Storage, linking, batch loading, caching

**Task 3: Circular Reference Detection** (5 hours)
- Implement BFS-based cycle detection algorithm
- Add configurable max depth parameter
- Create validation before creating references
- Implement error messages for circular references
- Tests: Cycle detection, max depth, various graph structures

**Task 4: Backlinks Query** (3 hours)
- Implement query to find all Codices referencing a target
- Add grouping by relationship type
- Optimize with proper indexing
- Add pagination for large backlink lists
- Tests: Query correctness, performance, pagination

**Task 5: Reference Validation** (2 hours)
- Validate target Codex template matches field requirement
- Check target Codex exists and not deleted
- Validate circular references before creation
- Tests: Type validation, existence checks, circular detection

### Frontend Tasks (UI Components)

**Task 6: Inline Reference Editor** (8 hours)
- Create InlineStringEditor component (auto-create StringCodex)
- Create InlineNumberEditor component (auto-create NumberCodex)
- Implement debounced updates (avoid excessive API calls)
- Add "Edit in Detail" button to navigate to atomic Codex
- Handle loading states and errors gracefully
- Tests: Auto-creation, updates, debouncing, navigation

**Task 7: Codex Picker Component** (6 hours)
- Create CodexPicker with search and filtering
- Implement radio button selection for single reference
- Add type filtering (only show compatible templates)
- Create "Quick Create" button for inline creation
- Display Codex badges (tags, creation date)
- Tests: Search, selection, filtering, quick create

**Task 8: Multi-Reference Manager** (7 hours)
- Create MultiCodexPicker component
- Implement drag-to-reorder references (using @dnd-kit)
- Add "Add Reference" button to show picker
- Create "Remove Reference" button for each item
- Display reference list with Codex titles
- Tests: Addition, removal, reordering, display

**Task 9: Backlinks Panel** (5 hours)
- Create BacklinksPanel component
- Display all Codices referencing current Codex
- Group backlinks by relationship type
- Add "Navigate to Backlink" button
- Implement loading state for async query
- Tests: Display, grouping, navigation, loading

**Task 10: Reference Field Validation UI** (3 hours)
- Show error when circular reference detected
- Display "incompatible type" errors
- Highlight broken references (target deleted)
- Add retry/fix buttons for broken references
- Tests: Error display, retry logic, broken link handling

**Task 11: Reference Context Menu** (4 hours)
- Add right-click menu to references
- Options: "View Referenced Codex", "Edit", "Remove Reference"
- Implement "Replace Reference" option
- Add "View in Graph" option (placeholder for future)
- Tests: Menu display, option actions

---

## Task Dependencies

```
Backend Foundation (Sequential):
  Task 1 (Relationship Schema) → Task 2 (Reference Storage)
  Task 2 → Task 3 (Circular Detection)
  Task 1 → Task 4 (Backlinks Query)
  All Backend → Task 5 (Validation)

Frontend Implementation (Depends on Backend):
  Task 2 → Task 6 (Inline Editor)
  Task 2 + Task 5 → Task 7 (Codex Picker)
  Task 7 → Task 8 (Multi-Reference)
  Task 4 → Task 9 (Backlinks Panel)
  Task 3 + Task 5 → Task 10 (Validation UI)
  All Frontend → Task 11 (Context Menu)

Integration:
  All → Final testing and integration
```

**Parallelization Strategy**:
1. **Days 1-2**: Task 1-2 (schema, storage)
2. **Days 3-4**: Task 3-4 (circular detection, backlinks) + Task 6 (inline editor)
3. **Days 5-6**: Task 5 (validation) + Task 7-8 (pickers)
4. **Days 7-8**: Task 9-11 (backlinks panel, validation UI, context menu) + integration

---

## Open Questions

**Decisions Needed Before Starting**:

1. **Auto-Creation Behavior?**
   - **Options**: Always auto-create, ask first, user preference setting
   - **Recommendation**: Always auto-create (matches user mental model)
   - **Impact**: UX simplicity vs. user control

2. **Reference Picker Style?**
   - **Options**: Modal dialog, dropdown, side panel
   - **Recommendation**: Modal (focused selection, no distraction)
   - **Impact**: UI flow and screen space

3. **Circular Reference Max Depth?**
   - **Options**: 5, 10, 20, configurable
   - **Recommendation**: 10 (reasonable for most use cases)
   - **Impact**: Performance vs. graph depth support

4. **Backlinks Grouping?**
   - **Options**: By type, by template, by date, flat list
   - **Recommendation**: By relationship type (clearer semantics)
   - **Impact**: UI organization and understandability

5. **Reference Deletion Cascade?**
   - **Options**: Cascade delete, orphan references, ask user
   - **Recommendation**: Orphan references (show as broken, allow fix)
   - **Impact**: Data safety vs. cleanup complexity

---

## Risk Assessment

### High Risk

1. **Circular Reference Performance** (Backend)
   - **Risk**: BFS traversal slow on large graphs (10k+ Codices)
   - **Mitigation**: Limit max depth, implement caching, optimize queries
   - **Contingency**: Add user toggle to disable circular checks

2. **Auto-Creation Confusion** (UX)
   - **Risk**: Users don't understand why extra Codices appear
   - **Mitigation**: Clear documentation, "Edit in Detail" button, onboarding
   - **Contingency**: Add user preference to disable auto-creation

### Medium Risk

3. **Reference Picker Performance** (Frontend)
   - **Risk**: Loading thousands of Codices for picker slows UI
   - **Mitigation**: Pagination, lazy loading, search filtering
   - **Contingency**: Limit picker to 100 most recent Codices

4. **Relationship Database Growth** (Storage)
   - **Risk**: Millions of relationships slow down queries
   - **Mitigation**: Proper indexing, query optimization, archival
   - **Contingency**: Implement relationship pruning for old/unused links

### Low Risk

5. **Drag-Drop Browser Compatibility** (Frontend)
   - **Risk**: Drag-drop may not work in all browsers/VS Code versions
   - **Mitigation**: Use @dnd-kit library (well-tested)
   - **Contingency**: Fall back to up/down arrow buttons for reordering

---

## Success Criteria

**Must-Have (MVP)**:
- ✅ Users can reference atomic Codices from composed Codices
- ✅ Inline editing auto-creates/updates atomic Codices transparently
- ✅ Codex picker shows only compatible templates
- ✅ Multi-reference fields support adding/removing/reordering
- ✅ Circular references prevented with clear error messages
- ✅ Backlinks panel shows all referencing Codices
- ✅ Relationships stored bidirectionally in database

**Should-Have**:
- ✅ Reference caching for performance
- ✅ Batch loading of references (single query)
- ✅ Quick create from picker (inline creation)
- ✅ Reference validation (type, existence, circular)
- ✅ Context menu for reference actions
- ✅ Broken reference detection and display

**Nice-to-Have**:
- ✅ Relationship metadata (strength, custom types)
- ✅ Reference count badges
- ✅ "View in Graph" button (placeholder)
- ✅ Reference search/filter
- ✅ Reference templates (predefined relationship types)

---

## Timeline Estimate

**Optimistic**: 6 days (smooth implementation, minimal integration issues)
**Realistic**: 8 days (accounting for circular detection complexity and UX tuning)
**Pessimistic**: 11 days (if performance issues or auto-creation UX needs rework)

**Week 1**:
- Days 1-2: Backend schema and storage
- Days 3-4: Circular detection, backlinks, inline editor
- Days 5-6: Validation and pickers

**Week 2**:
- Days 7-8: Backlinks panel, validation UI, context menu, integration

---

## Context for AI Assistant

### Quick Start for Next Session

**If you're picking up Phase 20 work:**

1. **Read these files first** (in order):
   - [ADR-020: Extreme Atomic Codex Architecture](../decisions/ADR-020-extreme-atomic-architecture.md) - Atomicity foundation
   - [ADR-021: Inline Reference Editing Pattern](../decisions/ADR-021-inline-reference-editing-pattern.md) - UX pattern
   - [ADR-023: Reference Field Implementation](../decisions/ADR-023-reference-field-implementation.md) - Technical details
   - This file (PHASE_20_PLAN.md) - Current plan

2. **Key mental models to understand**:
   - **Inline Reference Editing**: User never sees atomic Codices, system auto-creates them
   - **Type Filtering**: Codex picker only shows compatible templates
   - **Bidirectional Relationships**: Every reference creates graph edge in both directions
   - **Circular Prevention**: BFS traversal detects cycles before creation

3. **Current focus area**: Enabling composition while hiding atomicity complexity

### System Architecture Overview

```
Reference System:
├── Storage Layer
│   ├── Relationships Table (source, target, type, field)
│   ├── Bidirectional Indexes (fast traversal)
│   └── Cascade Deletion (maintain integrity)
├── Reference Field Types
│   ├── REFERENCE (single reference)
│   └── MULTI_REFERENCE (array of references)
├── Inline Editing Layer
│   ├── Auto-Create Atomic Codices
│   ├── Transparent Updates
│   └── Debounced Saves
├── Picker Layer
│   ├── Type-Filtered Search
│   ├── Quick Create
│   └── Compatibility Validation
├── Validation Layer
│   ├── Circular Reference Detection (BFS)
│   ├── Type Validation
│   └── Existence Checks
└── Backlinks Layer
    ├── Reverse Reference Query
    ├── Grouping by Type
    └── Navigation

Knowledge Graph:
CharacterCodex
  ├──[name]──> StringCodex:string-001
  ├──[age]──> NumberCodex:number-001
  └──[portrait]──> ImageCodex:image-001

Each arrow is a relationship row in database
```

### Common Pitfalls & Gotchas

1. **Auto-Creation Timing**
   - **What**: Race condition when user types fast in inline editor
   - **Why**: Multiple debounced updates trigger multiple creates
   - **How to handle**: Use atomic check-and-create transaction

2. **Circular Reference False Positives**
   - **What**: BFS detects "false" circular references in deep graphs
   - **Why**: Max depth limit hit before actual cycle found
   - **How to handle**: Configurable max depth, clear error messages

3. **Relationship Deletion Cascade**
   - **What**: Deleting Codex orphans all its references
   - **Why**: CASCADE DELETE on relationships table
   - **How to handle**: Show broken reference UI, allow re-linking

4. **Picker Performance**
   - **What**: Picker loads slowly with thousands of Codices
   - **Why**: Loading full Codex data instead of summaries
   - **How to handle**: Load minimal data (id, title, tags only)

### Important File Locations

Quick reference for key files:

- **Relationship Schema**: `src/database/schema/relationships.sql`
- **Reference Fields**: `src/fields/ReferenceField.ts`, `src/fields/MultiReferenceField.ts`
- **Inline Editors**: `src/components/InlineStringEditor.tsx`, `src/components/InlineNumberEditor.tsx`
- **Codex Picker**: `src/components/CodexPicker.tsx`
- **Multi-Reference**: `src/components/MultiCodexPicker.tsx`
- **Backlinks Panel**: `src/components/BacklinksPanel.tsx`
- **Circular Detection**: `src/validation/CircularReferenceValidator.ts`
- **Tests**: `tests/references/` (reference CRUD, circular detection, inline editing)

### Commands to Run

```bash
# Create relationships table
npm run migrate:create relationships

# Install drag-drop library
npm install @dnd-kit/core @dnd-kit/sortable

# Run reference tests
npm test -- --grep="Reference"

# Seed test data with references
npm run seed:references

# Check for circular references in DB
npm run check-circular-refs

# Validate all references
npm run validate-refs
```

---

## References

### Phase Tracking
- **Previous**: [Phase 19: Template Editor & Atomic Templates](./PHASE_19_PLAN.md)
- **Current**: **Phase 20: Reference System & Auto-Creation** (this document)
- **Next**: [Phase 21: File Integration & Media Codices](./PHASE_21_PLAN.md)

### Architecture Decision Records
- [ADR-020: Extreme Atomic Codex Architecture](../decisions/ADR-020-extreme-atomic-architecture.md) - Core atomicity
- [ADR-021: Inline Reference Editing Pattern](../decisions/ADR-021-inline-reference-editing-pattern.md) - UX approach
- [ADR-023: Reference Field Implementation](../decisions/ADR-023-reference-field-implementation.md) - Technical design
- [ADR-027: Multi-Context Array Implementation](../decisions/ADR-027-multi-context-array-implementation.md) - Related context handling

### Architecture Documentation
- [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md) - Universal content system
- [Hierarchical Template System](../../architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md) - Template structure
- [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Project boundaries

---

*Phase Plan Version: 1.0.0*
*Created: 2025-01-17*
*Template: PHASE_TEMPLATE.md v1.0.0*
