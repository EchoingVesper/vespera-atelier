# ADR-014: Content Chunking via Template Size Limits

**Status**: Accepted
**Date**: 2025-10-25
**Deciders**: Aya (Product Owner), Claude Code
**Technical Story**: [Phase 17: Codex Editor Implementation](../phases/PHASE_17_PLAN.md)

---

## Context and Problem Statement

How should the system encourage good organizational practices and optimize content for RAG (Retrieval-Augmented Generation) systems? How can templates help users break large content into manageable, semantically meaningful chunks?

Large, monolithic content files (>10k characters) create problems:
- Difficult for RAG systems to index and retrieve relevant sections
- Poor editor performance with very large documents
- Lack of structure makes navigation difficult
- Hard to create focused embeddings for vector search
- Encourages poor organizational practices

## Decision Drivers

* **RAG Optimization**: Vector embeddings work best on focused, semantic chunks (typically 200-1000 tokens)
* **Graph Traversal**: Smaller, well-defined Codices create more meaningful relationship graphs
* **Performance**: Large files slow down editor rendering and search operations
* **Code Quality**: In code projects, large files indicate poor modularization
* **Writing Quality**: In creative projects, large chapters/scenes benefit from subdivision
* **User Guidance**: System should guide users toward best practices
* **Flexibility**: Some content types legitimately need to be large (data files, logs, etc.)

## Considered Options

1. **No Size Limits** - Allow unlimited content size, rely on user discipline
2. **Hard Size Limits** - Enforce maximum sizes, prevent exceeding limits
3. **Template-Defined Optional Limits** - Templates suggest max sizes, users can override
4. **Dynamic Chunking** - System automatically splits large content into linked chunks
5. **Hybrid: Soft Limits + Warnings** - Templates define soft limits with prominent warnings

## Decision Outcome

Chosen option: **"Template-Defined Optional Limits"** with prominent warnings and guidance, because it balances user freedom with intelligent guidance while optimizing for RAG systems.

**Core Principle**: Templates define recommended maximum content sizes that encourage good organization and optimize RAG chunking, but users can override when necessary. The system provides clear warnings and suggestions for restructuring.

### Positive Consequences

* **RAG-Optimized Content**: Users naturally create content in RAG-friendly chunk sizes
* **Better Organization**: Encourages breaking large content into logical sub-units
* **Performance Benefits**: Smaller Codices render and search faster
* **Code Quality**: Forces modular code (e.g., max 500 lines per file)
* **Meaningful Graphs**: More granular Codices = more precise relationship graphs
* **Flexible**: Users can override when limits don't make sense for their content
* **Educational**: Warnings teach users about organizational best practices

### Negative Consequences

* **Friction**: Adds interruptions to user workflow when limits reached
* **Complexity**: Need UI for warnings, overrides, and suggestions
* **False Positives**: Some legitimate content will trigger warnings inappropriately
* **Migration Pain**: Existing large content needs to be restructured

## Pros and Cons of the Options

### Option 1: No Size Limits

Trust users to manage content size appropriately.

* Good, because zero friction - users can work however they want
* Good, because simpler implementation (no limit checking)
* Bad, because no guidance toward best practices
* Bad, because RAG system gets poorly-chunked content
* Bad, because performance degrades with large files
* Bad, because graph relationships less meaningful

### Option 2: Hard Size Limits

Enforce strict maximum sizes, block saves exceeding limit.

* Good, because guarantees RAG-optimized content sizes
* Good, because forces good organizational practices
* Good, because prevents performance issues proactively
* Bad, because frustrating for users with legitimate large content
* Bad, because hard to choose "right" limits for all content types
* Bad, because requires complex override mechanism

### Option 3: Template-Defined Optional Limits (CHOSEN)

Templates specify recommended max sizes with warnings and suggestions.

* Good, because guides users toward best practices
* Good, because optimizes for RAG without being dictatorial
* Good, because educational - explains WHY limits exist
* Good, because flexible per template type
* Good, because users can override when needed
* Bad, because requires thoughtful warning UI
* Bad, because some users will ignore warnings
* Bad, because need fallback behavior for content exceeding limits

### Option 4: Dynamic Chunking

System automatically splits large content into linked sub-Codices.

* Good, because zero user effort for chunking
* Good, because guarantees RAG-optimized sizes
* Bad, because automatic splits may not respect semantic boundaries
* Bad, because destroys user's chosen organizational structure
* Bad, because complex to implement correctly
* Bad, because confusing for users ("where did my content go?")
* Neutral, might be useful as assisted tool, not automatic behavior

### Option 5: Hybrid: Soft Limits + Warnings

Combine soft limits with prominent warnings and restructuring tools.

* Good, because combines guidance with flexibility
* Good, because provides tools to help users restructure
* Bad, because most complex to implement
* Neutral, this is essentially Option 3 with better UX

## Implementation Design

### Template Schema Extension

Add optional size limit fields to template schema:

```json5
{
  template_id: "scene",
  name: "Scene",

  fields: [
    {
      id: "content",
      type: "textarea",
      label: "Scene Content",

      // NEW: Size limit configuration
      size_limit: {
        recommended_max_chars: 5000,      // ~1000 words
        recommended_max_tokens: 1200,     // For LLM context

        warning_threshold: 0.8,           // Warn at 80% of max
        warning_message: "Scenes work best when focused on a single event or conversation. Consider splitting into multiple scenes.",

        allow_override: true,             // User can exceed limit
        override_requires_reason: false   // Optional: ask why exceeding

        // Optional: Suggest restructuring actions
        suggestions: [
          { action: "split", label: "Split into 2 scenes" },
          { action: "nested", label: "Create nested sub-scenes" }
        ]
      }
    }
  ]
}
```

### Template-Specific Limits

Different templates have different appropriate sizes:

| Template Type | Recommended Max | Rationale |
|--------------|-----------------|-----------|
| **Note** | 500 chars | Quick captures, single thought |
| **Task** | 1000 chars | Actionable item with context |
| **Scene** | 5000 chars | Single event/conversation |
| **Chapter** | 10000 chars | Major narrative unit (or use nested scenes) |
| **Article** | 8000 chars | Focused piece on single topic |
| **Code File** | 500 lines | Modular code unit |
| **Character** | 3000 chars | Character bio and traits |
| **Worldbuilding** | 15000 chars | Larger, but encourage sub-topics |

### Warning UI Design

When approaching size limit:

```
┌─────────────────────────────────────────────────┐
│ ⚠️  Content Size Recommendation                 │
│                                                  │
│ This scene is approaching the recommended       │
│ maximum size (4,200 / 5,000 characters).       │
│                                                  │
│ Scenes work best when focused on a single       │
│ event or conversation. Consider:                │
│                                                  │
│ • [Split into 2 scenes]                         │
│ • [Create nested sub-scenes]                    │
│ • [Continue anyway]                             │
│                                                  │
│ Why size matters:                               │
│ - Better search results                         │
│ - Faster AI context loading                     │
│ - Easier navigation                             │
└─────────────────────────────────────────────────┘
```

### RAG Chunking Integration

Size limits align with RAG chunking strategy:

1. **Primary Chunk**: Entire Codex content (if within limits)
2. **Nested Chunks**: Child Codices (if using composition)
3. **Field-Level Chunks**: Individual fields for precise retrieval

Example RAG chunks for a Scene:

```
Chunk 1 (Primary):
- Codex: scene-123
- Content: Full scene text (4,200 chars)
- Metadata: {template: "scene", chapter: "chapter-45", characters: [...]}
- Embedding: Vector of full scene

Chunk 2 (Metadata):
- Codex: scene-123
- Content: Scene summary + character list + location
- Purpose: Quick context for graph traversal

Chunk 3+ (Children):
- Any nested Codices (dialogue exchanges, action beats, etc.)
```

### Override Mechanism

Users can exceed limits when needed:

1. **Soft Warning**: Show recommendation at 80% of limit
2. **Stronger Warning**: Show at 100% with "Are you sure?" options
3. **Allow Continue**: User clicks "I understand, continue anyway"
4. **Log Override**: Track which Codices exceed limits for analytics
5. **Revisit Prompt**: Suggest restructuring when editing oversized content

### Virtualization for Large Content

Even with size limits, some content will be large. Implement virtualization from the start:

**Editor Virtualization**:
- Render only visible portion of content (windowing)
- Load additional content as user scrolls
- Cache rendered content for performance
- Target: Handle up to 100k chars smoothly

**List Virtualization**:
- Navigator tree renders only visible items
- Lazy-load children when expanding folders
- Target: Handle 10k+ Codices per project

## RAG System Benefits

### Vector Search Optimization

Smaller, focused chunks create better embeddings:

```python
# Poor: Large monolithic scene (10k+ chars)
embedding_large = embed("Entire 10k char scene with multiple events...")
# Problem: Embedding represents average of many concepts
# Search for "betrayal" might not surface this even if betrayal is key scene element

# Better: Split into focused scenes (3k-5k chars each)
embedding_1 = embed("Hero discovers friend's betrayal...")
embedding_2 = embed("Confrontation and explanation...")
embedding_3 = embed("Aftermath and new alliance...")
# Benefit: Each embedding represents focused concept
# Search for "betrayal" surfaces scene-1 with high confidence
```

### Graph Traversal Optimization

More granular Codices = more precise relationship graphs:

```
Before (Large Scenes):
Chapter → Scene1 (10k chars, multiple events)

After (Chunked):
Chapter → Scene1a (Betrayal Discovery)
       → Scene1b (Confrontation)
       → Scene1c (Aftermath)

Graph Query: "Find all betrayal events"
Before: Returns Chapter > Scene1 (user must read entire 10k chars)
After: Returns Chapter > Scene1a (direct hit, 3k chars)
```

## Migration and Adoption

### Phase 1: Implement Limits (Phase 17-18)
- Add size_limit fields to template schema
- Implement warning UI (soft guidance only)
- No enforcement, just recommendations
- Gather data on content sizes

### Phase 2: Optimize Templates (Phase 19)
- Analyze which templates commonly exceed limits
- Adjust recommended limits based on usage data
- Create restructuring tools/wizards
- Add split/merge operations

### Phase 3: Advanced Features (Future)
- AI-assisted content splitting (suggest semantic boundaries)
- Automatic chunk optimization for RAG
- Content density analysis (chars vs semantic complexity)
- Template-specific chunking strategies

## Links

* Refines [ADR-012: Codices as File Containers](./ADR-012-codices-as-file-containers.md) - Codex architecture
* Refines [ADR-013: Template Composition](./ADR-013-template-composition.md) - Nesting for organization
* Relates to [ADR-004: Dynamic Templates](./ADR-004-dynamic-templates.md) - Template system
* [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)
* Future: RAG System Architecture (to be written)
* Future: Graph Database Architecture (to be written)

---

## Product Owner Notes

From Phase 17 risk analysis:

> "Add virtualization from the start. That said, I want templates to have optional(?) fields like 'max size of content' for users to create templates to force themselves to break up their ideas into better organization. (Or for forcing modular code creation, by preventing files from growing too big.) **These will also be helpful for the RAG system, by breaking content into defined chunks.**"

This ADR formalizes content size limits as a core template feature that serves dual purposes:
1. Encouraging good organizational practices
2. Optimizing content for RAG vector search and graph traversal

---

*Created: 2025-10-25*
*Updated: 2025-10-25*
*Template version: 1.0.0*
