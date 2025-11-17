# ADR-020: Extreme Atomic Cod

ex Architecture

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 19 Planning - Component-Composition Architecture

---

## Context and Problem Statement

The Vespera Forge Codex system needs to support efficient knowledge graph construction and RAG (Retrieval-Augmented Generation) optimization for AI assistants. The current architecture treats Codices as content containers with typed fields (TEXT, NUMBER, etc.) containing direct values. However, this approach has limitations:

1. **Context inefficiency**: Loading a "Character" Codex loads ALL fields, wasting LLM context
2. **Limited metadata**: Simple values like "Alice" (a string) cannot have their own metadata, tags, or creation dates
3. **Shallow knowledge graph**: Graph only connects top-level Codices, not field-level data
4. **Poor mobile LLM support**: Local LLMs on smartphones have tiny context windows (2K-8K tokens)

**Question**: Should field values themselves be first-class Codices, creating an extremely atomic, composable architecture?

## Decision Drivers

* **RAG efficiency**: Load only the minimal Codices needed for a query (e.g., just "name" field for character identification)
* **Mobile-first design**: Support local LLMs on smartphones with limited context windows
* **Knowledge graph depth**: Every piece of data should be a knowledge graph node with relationships
* **Metadata richness**: Even simple values should support tagging, timestamps, provenance
* **Composition pattern**: Complex entities built from atomic, reusable components
* **User vision**: "Codices are like Blender nodes or ComfyUI nodes - small atomic pieces that compose"

## Considered Options

**Option 1**: **Direct Field Values** (Current)
- Codex contains field values directly: `{ name: "Alice", age: 25 }`
- Simple, straightforward data model
- Fields are primitive types (string, number, boolean, etc.)

**Option 2**: **Hybrid Approach**
- Simple fields use direct values (TEXT, NUMBER)
- Complex fields use references (FILE, IMAGE, nested Codices)
- Template author chooses which pattern per field

**Option 3**: **Extreme Atomicity** (Chosen)
- **Every field value is a Codex reference**
- Even "Alice" becomes `StringCodex(value: "Alice")`
- All fields use REFERENCE type, pointing to atomic Codices
- Maximum composition and RAG efficiency

## Decision Outcome

Chosen option: **"Option 3: Extreme Atomicity"**, because it fully realizes the component-composition vision, maximizes RAG efficiency for resource-constrained environments, and creates the deepest possible knowledge graph.

### Positive Consequences

* **Maximum RAG Efficiency**: AI assistant queries can load only specific field Codices
  - Example: "What's the character's name?" → Load only StringCodex, not entire Character
  - Critical for mobile LLMs with 2K-4K context limits
* **Rich Metadata on All Values**: Every value (even "Alice") can have:
  - Creation/modification timestamps
  - Tags and categories
  - Provenance (who created it, when, why)
  - Version history
* **Deep Knowledge Graph**: Graph has fine-grained nodes
  - Traditional: Character → Portrait (1 edge)
  - Atomic: Character → NameCodex → StringCodex → "Alice" (multiple edges)
  - Better for graph traversal queries
* **Reusable Atomic Components**: StringCodex "Alice" can be referenced by multiple Characters
  - Deduplication of common values
  - Shared canonical data
* **Non-Destructive Editing**: Changing Character template doesn't lose field data
  - Old field Codices remain in database
  - Can be restored if template reverted
* **Future-Proof**: Enables advanced features
  - Automatic provenance tracking
  - Cross-Codex value search ("Find all Codices with name 'Alice'")
  - Atomic-level permissions (lock specific fields)

### Negative Consequences

* **Increased Database Complexity**: More rows in database
  - Every field value = separate Codex entry
  - More relationships to track
  - More queries per operation
* **Performance Concerns**: Additional query overhead
  - Loading Character requires loading all referenced Codices
  - Mitigation: Aggressive caching, batch loading
* **UX Complexity**: How to edit "name" field without navigating away?
  - Mitigation: "Inline reference" editing pattern (see ADR-021)
* **Storage Overhead**: More metadata per atomic value
  - StringCodex for "Alice" has id, created_at, updated_at, etc.
  - Increased storage footprint
  - Mitigation: Benefits outweigh costs for target use cases

## Pros and Cons of the Options

### Option 1: Direct Field Values

**Example**:
```typescript
{
  id: "char-001",
  name: "Alice",
  age: 25,
  bio: "Brave adventurer..."
}
```

* Good, because **simple data model** (easy to understand, easy to implement)
* Good, because **performant** (single database read gets all fields)
* Good, because **small storage footprint** (no extra metadata overhead)
* Bad, because **inefficient for RAG** (must load entire Codex for any field query)
* Bad, because **no field-level metadata** (can't tag just the "name" field)
* Bad, because **shallow knowledge graph** (only top-level Codices are nodes)
* Bad, because **poor mobile LLM support** (cannot load selective fields)

### Option 2: Hybrid Approach

**Example**:
```typescript
{
  id: "char-001",
  name: "Alice",  // Direct value
  age: 25,        // Direct value
  portrait: { type: REFERENCE, target: "image-001" }  // Reference
}
```

* Good, because **balances simplicity and composition** (simple for simple, complex for complex)
* Good, because **better performance than full atomicity** (fewer queries)
* Good, because **flexible** (template author chooses pattern per field)
* Bad, because **inconsistent data model** (sometimes value, sometimes reference)
* Bad, because **partial RAG efficiency** (can't load just "name" without whole Codex)
* Bad, because **developer confusion** (when to use direct vs reference?)
* Bad, because **doesn't achieve user's vision** (not truly "atomic components")

### Option 3: Extreme Atomicity (Chosen)

**Example**:
```typescript
// CharacterCodex
{
  id: "char-001",
  fields: {
    name: { type: REFERENCE, target: "string-001" },
    age: { type: REFERENCE, target: "number-001" },
    portrait: { type: REFERENCE, target: "image-001" }
  }
}

// StringCodex (referenced by name field)
{
  id: "string-001",
  templateId: "string-codex",
  value: "Alice",
  metadata: { tags: ["character-name"], created_at: "2025-01-17" }
}
```

* Good, because **maximum RAG efficiency** (load only needed Codices)
* Good, because **rich metadata everywhere** (even "Alice" has tags, timestamps)
* Good, because **deep knowledge graph** (fine-grained nodes and edges)
* Good, because **mobile-friendly** (critical for local LLMs on smartphones)
* Good, because **fully composable** (achieves user's vision)
* Good, because **reusable components** (same StringCodex can be shared)
* Good, because **non-destructive** (changing template preserves all field Codices)
* Bad, because **more database queries** (loading Character → 5 queries instead of 1)
* Bad, because **storage overhead** (every value has full Codex metadata)
* Bad, because **UX complexity** (inline editing needed to hide indirection)

**Mitigations for negatives**:
- **Query Performance**: Batch loading, aggressive caching (see Phase 20 plan)
- **Storage**: Benefits outweigh costs (metadata richness worth the bytes)
- **UX**: "Inline reference" editing pattern (see ADR-021) hides atomicity from user

## Implementation Details

### Atomic Codex Templates

Create foundational templates in Phase 19:

**StringCodex Template**:
```json5
{
  templateId: "string-codex",
  name: "String Value",
  category: "atomic",
  fields: [
    { id: "value", type: TEXT, required: true }
  ]
}
```

**NumberCodex Template**:
```json5
{
  templateId: "number-codex",
  name: "Number Value",
  category: "atomic",
  fields: [
    { id: "value", type: NUMBER, required: true }
  ]
}
```

**Additional Atomic Templates**:
- `BooleanCodex` - Single boolean value
- `DateCodex` - Single date value
- `TextCodex` - Longer text (multi-line)
- `MarkdownCodex` - Markdown content (with FILE reference to .md file)

### Composed Codex Example

**Character Template** (uses REFERENCE fields):
```json5
{
  templateId: "character",
  name: "Character",
  category: "creative-writing",
  fields: [
    {
      id: "name",
      type: REFERENCE,
      targetTemplate: "string-codex",
      label: "Character Name",
      required: true
    },
    {
      id: "age",
      type: REFERENCE,
      targetTemplate: "number-codex",
      label: "Age"
    },
    {
      id: "backstory",
      type: REFERENCE,
      targetTemplate: "markdown-codex",
      label: "Backstory"
    },
    {
      id: "portrait",
      type: REFERENCE,
      targetTemplate: "image-codex",
      label: "Portrait Image"
    }
  ]
}
```

### Knowledge Graph Structure

With extreme atomicity, the knowledge graph becomes:

```
CharacterCodex:char-001
  ├──[name]──> StringCodex:string-001 (value: "Alice")
  ├──[age]──> NumberCodex:number-001 (value: 25)
  ├──[backstory]──> MarkdownCodex:md-001
  │                   └──[file]──> FileCodex:file-001 (backstory.md)
  └──[portrait]──> ImageCodex:image-001
                     └──[file]──> FileCodex:file-002 (alice.png)
```

Each arrow is a graph edge, each box is a node. RAG queries can traverse graph selectively:
- "What's the character's name?" → Traverse `char-001 → string-001`, load only 2 Codices
- "Show the portrait" → Traverse `char-001 → image-001 → file-002`, load 3 Codices
- "Full character details" → Traverse all edges, load all 7 Codices

### Auto-Creation Pattern

When user creates a new Character:
1. User fills form: name="Alice", age=25
2. System auto-creates:
   - `StringCodex:string-001` with value="Alice"
   - `NumberCodex:number-001` with value=25
3. System creates `CharacterCodex:char-001` with references:
   - `name: { type: REFERENCE, target: "string-001" }`
   - `age: { type: REFERENCE, target: "number-001" }`

User never sees the indirection (handled by "inline reference" editing - see ADR-021).

### Performance Optimization Strategies

**Batch Loading**:
```typescript
// Instead of: 5 sequential queries
const name = await loadCodex(char.fields.name.target);
const age = await loadCodex(char.fields.age.target);
// ...

// Do: 1 batch query
const references = Object.values(char.fields).map(f => f.target);
const codices = await batchLoadCodexes(references);
```

**Caching**:
- Cache atomic Codices aggressively (StringCodex rarely changes)
- Cache character field sets together (likely accessed together)
- Invalidate cache on Codex update

**Lazy Loading**:
- Load only visible fields in UI
- Load additional fields on-demand
- Use virtualization for long field lists

## Migration Path

**Phase 19**: Create atomic templates
**Phase 20**: Implement REFERENCE fields and auto-creation
**Phase 21**: Extend to FILE/IMAGE Codices
**Phase 22**: Full knowledge graph operational

**Backward Compatibility**:
- Old Codices with direct field values remain functional
- Gradual migration: new Codices use atomic pattern
- Tool to convert old → atomic (future)

## Alignment with User Vision

User description: "Codices are like Blender geometry nodes or ComfyUI nodes - small atomic pieces that compose into complex workflows."

Extreme atomicity achieves this:
- **Blender nodes**: Each node does one thing (Subdivide, Bevel, Extrude)
- **StringCodex**: Does one thing (stores a string)
- **ComfyUI nodes**: Compose nodes into image generation pipelines
- **Codices**: Compose atomic Codices into Character, Scene, Project

User goal: "Break information into small chunks for RAG so AI only loads pertinent info."

Extreme atomicity achieves this:
- Character query → Load only relevant atomic Codices
- Context conservation critical for mobile local LLMs (2K tokens)
- Fine-grained knowledge graph enables precise retrieval

## Links

* Refined by [ADR-021: Inline Reference Editing Pattern](./ADR-021-inline-reference-editing-pattern.md)
* Refined by [ADR-023: Reference Field Implementation](./ADR-023-reference-field-implementation.md)
* Related to [ADR-013: Template Composition](./ADR-013-template-composition.md)
* Supersedes aspects of [ADR-012: Codices as File Containers](./ADR-012-codices-as-file-containers.md)
