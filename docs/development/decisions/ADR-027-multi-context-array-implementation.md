# ADR-027: Multi-Context Array Implementation

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - Multi-Context Organization

---

## Context and Problem Statement

In the Vespera Forge architecture, contexts provide organizational containers for Codices (similar to folders or tags). The original design assumed each Codex belongs to a single context via a `context_id` field.

However, this creates a limitation:

**Use Case Example**:
- **Character "Alice"**: Belongs to both "World Building" context (for reference) and "Current Chapter" context (actively writing about her)
- **Scene "Battle"**: Belongs to "Act 1" context and "Action Scenes" context
- **Code File**: Belongs to "Authentication" context and "Security Review" context

With single-context limitation:
- User must duplicate Codex (wasteful, synchronization issues)
- Or choose one context (loses organizational flexibility)
- Or implement tagging system separately (redundant with contexts)

**Question**: Should Codices support appearing in multiple contexts, and if so, how should this be implemented?

## Decision Drivers

* **Organizational flexibility**: Support multiple categorization schemes
* **No duplication**: Single Codex should appear in multiple contexts
* **Query performance**: Efficiently find all Codices in a given context
* **User experience**: Intuitive UI for managing multi-context membership
* **Migration path**: Smooth transition from single-context to multi-context
* **Simplicity**: Start with minimal solution, expand if needed
* **Template flexibility**: Future possibility of template-level context control

## Considered Options

**Option 1**: **Array Field in Metadata** (Chosen for MVP)
- Add `context_ids: string[]` array to Codex metadata
- Query with `WHERE context_ids CONTAINS active_context_id`
- Simple, fast, sufficient for most use cases

**Option 2**: **Join Table**
- Create `codex_contexts` table with rows for each membership
- Query with JOIN or subquery
- More scalable but more complex

**Option 3**: **Template-Level Configuration**
- Templates define allowed contexts
- Context membership validated against template
- More powerful but premature

## Decision Outcome

Chosen option: **"Option 1: Array Field in Metadata"**, because it provides the needed functionality with minimal implementation complexity. This is an MVP solution that can be promoted to a join table or template-level feature later if needed.

### Positive Consequences

* **Simple implementation**: Just add array field to metadata
* **Efficient queries**: PostgreSQL array operators are fast
* **Flexible**: No limit on number of contexts per Codex
* **Easy to understand**: Clear data structure
* **Migration friendly**: Existing single-context Codices convert to single-element array
* **Future-proof**: Can migrate to join table if scale requires

### Negative Consequences

* **Denormalized**: Context IDs duplicated in each Codex
* **Update overhead**: Renaming context requires updating all Codices
* **Query complexity**: Array queries less familiar than JOIN syntax
* **Index limitations**: Array indexing less efficient than join table at very large scale
* **No metadata per membership**: Can't track "added to context on date X"

## Pros and Cons of the Options

### Option 1: Array Field in Metadata (Chosen)

**Data Structure**:
```typescript
interface CodexMetadata {
  id: string;
  template_id: string;
  context_ids: string[];        // ["ctx-001", "ctx-002"]
  primary_context: string;       // "ctx-001" (default/main context)
  // ... other metadata
}
```

**Example**:
```json5
{
  id: "char-001",
  templateId: "character",
  metadata: {
    title: "Alice",
    context_ids: ["ctx-world-building", "ctx-chapter-1"],  // Appears in both
    primary_context: "ctx-world-building",  // Main context
    tags: ["protagonist", "warrior"]
  }
}
```

**Queries**:
```sql
-- Find all Codices in a context
SELECT * FROM codices
WHERE context_ids @> ARRAY['ctx-chapter-1']::text[]
  AND archived = false
  AND deleted_at IS NULL;

-- Find Codices in multiple contexts (intersection)
SELECT * FROM codices
WHERE context_ids @> ARRAY['ctx-chapter-1', 'ctx-action-scenes']::text[];

-- Find Codices in any of multiple contexts (union)
SELECT * FROM codices
WHERE context_ids && ARRAY['ctx-chapter-1', 'ctx-chapter-2']::text[];

-- Create index for performance
CREATE INDEX idx_codices_context_ids ON codices USING GIN (context_ids);
```

* Good, because **simple implementation** (just add array field)
* Good, because **fast queries** (PostgreSQL GIN index on arrays)
* Good, because **easy to understand** (straightforward data model)
* Good, because **flexible** (no limit on contexts)
* Good, because **minimal migration** (convert `context_id` → `[context_id]`)
* Bad, because **denormalized** (context IDs repeated)
* Bad, because **update overhead** (renaming context touches many Codices)
* Bad, because **no membership metadata** (can't track when added)

### Option 2: Join Table

**Data Structure**:
```typescript
interface CodexContextMembership {
  codex_id: string;
  context_id: string;
  added_at: Date;
  is_primary: boolean;  // Is this the main context?
}
```

**Schema**:
```sql
CREATE TABLE codex_contexts (
  codex_id UUID NOT NULL REFERENCES codices(id) ON DELETE CASCADE,
  context_id TEXT NOT NULL,
  added_at TIMESTAMP DEFAULT NOW(),
  is_primary BOOLEAN DEFAULT false,

  PRIMARY KEY (codex_id, context_id)
);

CREATE INDEX idx_codex_contexts_codex ON codex_contexts(codex_id);
CREATE INDEX idx_codex_contexts_context ON codex_contexts(context_id);
```

**Queries**:
```sql
-- Find all Codices in a context
SELECT c.* FROM codices c
JOIN codex_contexts cc ON cc.codex_id = c.id
WHERE cc.context_id = 'ctx-chapter-1'
  AND c.archived = false
  AND c.deleted_at IS NULL;

-- Find contexts for a Codex
SELECT context_id FROM codex_contexts
WHERE codex_id = 'char-001'
ORDER BY is_primary DESC, added_at ASC;
```

* Good, because **normalized** (no duplication)
* Good, because **efficient updates** (renaming context is single UPDATE)
* Good, because **rich metadata** (track added_at, is_primary, etc.)
* Good, because **scales better** (JOIN tables optimal for large scale)
* Good, because **familiar pattern** (standard relational design)
* Bad, because **more complex** (additional table, JOINs in queries)
* Bad, because **migration effort** (need to populate join table)
* Bad, because **query overhead** (JOINs slightly slower than array contains)

### Option 3: Template-Level Configuration

**Data Structure**:
```json5
// In template definition
{
  templateId: "character",
  name: "Character",
  contextConfig: {
    allowedContexts: ["world-building", "current-chapter"],  // Only these allowed
    defaultContexts: ["world-building"],  // Auto-add to these
    maxContexts: 5,  // Limit to 5 contexts
    requirePrimary: true  // Must have one primary context
  },
  // ... fields
}
```

**Validation**:
```typescript
async function addCodexToContext(
  codexId: string,
  contextId: string
): Promise<ValidationResult> {
  const codex = await loadCodex(codexId);
  const template = await loadTemplate(codex.templateId);

  // Validate against template config
  if (template.contextConfig?.allowedContexts) {
    if (!template.contextConfig.allowedContexts.includes(contextId)) {
      return {
        valid: false,
        error: `Template ${template.name} does not allow context ${contextId}`
      };
    }
  }

  if (template.contextConfig?.maxContexts) {
    if (codex.metadata.context_ids.length >= template.contextConfig.maxContexts) {
      return {
        valid: false,
        error: `Maximum ${template.contextConfig.maxContexts} contexts allowed`
      };
    }
  }

  return { valid: true };
}
```

* Good, because **template-enforced rules** (consistent behavior per type)
* Good, because **powerful** (templates control organization structure)
* Good, because **prevents errors** (can't add to wrong contexts)
* Good, because **auto-organization** (defaultContexts auto-add)
* Bad, because **premature** (not clear if needed yet)
* Bad, because **complex** (more template config to manage)
* Bad, because **less flexible** (users constrained by template)
* Bad, because **migration challenge** (existing Codices may violate rules)

## Implementation Details

### Database Schema

**Codex Metadata with Context Array**:
```sql
-- Add context_ids array to codices table
ALTER TABLE codices
ADD COLUMN context_ids TEXT[] DEFAULT ARRAY[]::TEXT[],
ADD COLUMN primary_context TEXT;

-- Create GIN index for efficient array queries
CREATE INDEX idx_codices_context_ids ON codices USING GIN (context_ids);

-- Create index for primary_context (common filter)
CREATE INDEX idx_codices_primary_context ON codices(primary_context);
```

### Query Functions

**Find Codices in Context**:
```typescript
async function listCodexesInContext(contextId: string): Promise<Codex[]> {
  return db.query(`
    SELECT * FROM codices
    WHERE context_ids @> ARRAY[$1]::text[]
      AND archived = false
      AND deleted_at IS NULL
    ORDER BY updated_at DESC
  `, [contextId]);
}
```

**Find All Contexts for Codex**:
```typescript
async function getCodexContexts(codexId: string): Promise<string[]> {
  const result = await db.query(`
    SELECT context_ids FROM codices WHERE id = $1
  `, [codexId]);

  return result.rows[0]?.context_ids || [];
}
```

**Find Codices in Multiple Contexts (AND)**:
```typescript
async function listCodexesInAllContexts(contextIds: string[]): Promise<Codex[]> {
  // Codices that are in ALL specified contexts (intersection)
  return db.query(`
    SELECT * FROM codices
    WHERE context_ids @> ARRAY[$1]::text[]
      AND archived = false
      AND deleted_at IS NULL
  `, [contextIds]);
}
```

**Find Codices in Any Context (OR)**:
```typescript
async function listCodexesInAnyContext(contextIds: string[]): Promise<Codex[]> {
  // Codices that are in ANY of the specified contexts (union)
  return db.query(`
    SELECT * FROM codices
    WHERE context_ids && ARRAY[$1]::text[]
      AND archived = false
      AND deleted_at IS NULL
  `, [contextIds]);
}
```

### Context Management Operations

**Add Codex to Context**:
```typescript
async function addCodexToContext(
  codexId: string,
  contextId: string,
  isPrimary: boolean = false
): Promise<void> {
  const codex = await loadCodex(codexId);

  // Check if already in context
  if (codex.metadata.context_ids.includes(contextId)) {
    return;  // Already in context
  }

  // Add to array
  const newContextIds = [...codex.metadata.context_ids, contextId];

  // Update Codex
  await db.update('codices', {
    where: { id: codexId },
    data: {
      context_ids: newContextIds,
      primary_context: isPrimary ? contextId : codex.metadata.primary_context
    }
  });

  eventBus.emit('codex:added_to_context', { codexId, contextId });
}
```

**Remove Codex from Context**:
```typescript
async function removeCodexFromContext(
  codexId: string,
  contextId: string
): Promise<void> {
  const codex = await loadCodex(codexId);

  // Remove from array
  const newContextIds = codex.metadata.context_ids.filter(id => id !== contextId);

  // If removing primary context, reassign primary
  let newPrimaryContext = codex.metadata.primary_context;
  if (codex.metadata.primary_context === contextId) {
    newPrimaryContext = newContextIds[0] || null;  // First remaining context or null
  }

  // Update Codex
  await db.update('codices', {
    where: { id: codexId },
    data: {
      context_ids: newContextIds,
      primary_context: newPrimaryContext
    }
  });

  eventBus.emit('codex:removed_from_context', { codexId, contextId });
}
```

**Set Primary Context**:
```typescript
async function setPrimaryContext(
  codexId: string,
  contextId: string
): Promise<void> {
  const codex = await loadCodex(codexId);

  // Ensure Codex is in this context
  if (!codex.metadata.context_ids.includes(contextId)) {
    throw new Error(`Codex ${codexId} is not in context ${contextId}`);
  }

  // Update primary context
  await db.update('codices', {
    where: { id: codexId },
    data: { primary_context: contextId }
  });

  eventBus.emit('codex:primary_context_changed', { codexId, contextId });
}
```

**Bulk Add to Context**:
```typescript
async function bulkAddCodexesToContext(
  codexIds: string[],
  contextId: string
): Promise<void> {
  // Update all Codices to include context
  await db.query(`
    UPDATE codices
    SET context_ids = array_append(context_ids, $1)
    WHERE id = ANY($2)
      AND NOT (context_ids @> ARRAY[$1]::text[])  -- Only if not already in context
  `, [contextId, codexIds]);

  eventBus.emit('codex:bulk_added_to_context', { codexIds, contextId });
}
```

### UI Components

**Context Badge List**:
```typescript
function ContextBadges({ codexId, contextIds, primaryContext }: ContextBadgesProps) {
  return (
    <div className="context-badges">
      {contextIds.map(contextId => (
        <span
          key={contextId}
          className={`context-badge ${contextId === primaryContext ? 'primary' : ''}`}
        >
          {getContextName(contextId)}
          {contextId === primaryContext && ' ⭐'}
        </span>
      ))}
    </div>
  );
}
```

**Context Picker Modal**:
```typescript
function ContextPickerModal({ codexId, onClose }: ContextPickerModalProps) {
  const [codex, setCodex] = useState<Codex | null>(null);
  const [availableContexts, setAvailableContexts] = useState<Context[]>([]);

  useEffect(() => {
    loadCodex(codexId).then(setCodex);
    listContexts().then(setAvailableContexts);
  }, [codexId]);

  const handleToggleContext = async (contextId: string) => {
    if (codex.metadata.context_ids.includes(contextId)) {
      await removeCodexFromContext(codexId, contextId);
    } else {
      await addCodexToContext(codexId, contextId);
    }

    // Reload Codex
    loadCodex(codexId).then(setCodex);
  };

  const handleSetPrimary = async (contextId: string) => {
    await setPrimaryContext(codexId, contextId);
    loadCodex(codexId).then(setCodex);
  };

  return (
    <Modal onClose={onClose}>
      <h2>Manage Contexts for {codex?.metadata.title}</h2>

      <div className="context-list">
        {availableContexts.map(context => {
          const isInContext = codex?.metadata.context_ids.includes(context.id);
          const isPrimary = codex?.metadata.primary_context === context.id;

          return (
            <div key={context.id} className="context-item">
              <input
                type="checkbox"
                checked={isInContext}
                onChange={() => handleToggleContext(context.id)}
              />
              <span>{context.name}</span>

              {isInContext && (
                <button
                  onClick={() => handleSetPrimary(context.id)}
                  disabled={isPrimary}
                >
                  {isPrimary ? '⭐ Primary' : 'Set as Primary'}
                </button>
              )}
            </div>
          );
        })}
      </div>
    </Modal>
  );
}
```

**Navigator Context Filter**:
```typescript
function NavigatorContextFilter() {
  const [activeContexts, setActiveContexts] = useState<string[]>([]);
  const [filterMode, setFilterMode] = useState<'any' | 'all'>('any');

  const handleToggleContext = (contextId: string) => {
    setActiveContexts(prev =>
      prev.includes(contextId)
        ? prev.filter(id => id !== contextId)
        : [...prev, contextId]
    );
  };

  return (
    <div className="context-filter">
      <h3>Filter by Context</h3>

      <select
        value={filterMode}
        onChange={(e) => setFilterMode(e.target.value as 'any' | 'all')}
      >
        <option value="any">Show Codices in ANY selected context</option>
        <option value="all">Show Codices in ALL selected contexts</option>
      </select>

      <div className="context-checkboxes">
        {contexts.map(context => (
          <label key={context.id}>
            <input
              type="checkbox"
              checked={activeContexts.includes(context.id)}
              onChange={() => handleToggleContext(context.id)}
            />
            {context.name}
          </label>
        ))}
      </div>
    </div>
  );
}
```

### Migration from Single Context

**Migration Script**:
```typescript
async function migrateToMultiContext() {
  // Get all Codices with single context_id
  const codices = await db.query(`
    SELECT id, metadata FROM codices
    WHERE metadata->>'context_id' IS NOT NULL
  `);

  for (const codex of codices) {
    const contextId = codex.metadata.context_id;

    // Convert to array
    await db.update('codices', {
      where: { id: codex.id },
      data: {
        context_ids: [contextId],
        primary_context: contextId
      }
    });

    // Remove old context_id field from metadata
    await db.query(`
      UPDATE codices
      SET metadata = metadata - 'context_id'
      WHERE id = $1
    `, [codex.id]);
  }

  console.log(`Migrated ${codices.length} Codices to multi-context`);
}
```

## Future: Promote to Join Table

If scale requires, can migrate to join table:

**Migration Strategy**:
```typescript
async function migrateToJoinTable() {
  // Create join table
  await db.query(`
    CREATE TABLE codex_contexts (
      codex_id UUID NOT NULL REFERENCES codices(id) ON DELETE CASCADE,
      context_id TEXT NOT NULL,
      added_at TIMESTAMP DEFAULT NOW(),
      is_primary BOOLEAN DEFAULT false,
      PRIMARY KEY (codex_id, context_id)
    );
  `);

  // Populate from array
  await db.query(`
    INSERT INTO codex_contexts (codex_id, context_id, is_primary)
    SELECT
      id,
      unnest(context_ids),
      unnest(context_ids) = primary_context
    FROM codices
    WHERE context_ids IS NOT NULL;
  `);

  console.log('Migrated to join table');
}
```

## Future: Template-Level Configuration

Can add template-level context rules in future:

**Template Extension**:
```json5
{
  templateId: "character",
  contextConfig: {
    allowedContexts: ["world-building", "current-chapter"],
    defaultContexts: ["world-building"],
    maxContexts: 5
  }
}
```

## Migration Path

**Phase 19**: Implement `context_ids` array and basic multi-context support
**Phase 20**: Add UI for managing context membership (picker, badges)
**Phase 21**: Add primary context designation and context filtering
**Phase 22**: (Optional) Migrate to join table if scale requires

## User Guidance

**For End Users**:
- Right-click Codex → "Manage Contexts"
- Check contexts to add Codex to them
- Click "Set as Primary" for main context
- Context badges show all contexts, star shows primary

**For Developers**:
- Use `context_ids @> ARRAY['ctx-id']` for queries
- Create GIN index on `context_ids` for performance
- Validate context existence before adding

## Links

* Related to [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [ADR-015: Workspace-Project-Context Hierarchy](./ADR-015-workspace-project-context-hierarchy.md)
* Related to [Codex Architecture](../../architecture/core/CODEX_ARCHITECTURE.md)
