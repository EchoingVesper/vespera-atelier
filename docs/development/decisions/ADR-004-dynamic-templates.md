# ADR-004: Dynamic Template System

**Status**: Accepted
**Date**: 2025-10-23
**Deciders**: Development Team
**Technical Story**: Phase 15 - Template System Refactor

---

## Context and Problem Statement

The existing template system used a hardcoded `CodexType` enum in TypeScript:

```typescript
enum CodexType {
  ARTICLE = 'article',
  INTERVIEW = 'interview',
  SOURCE = 'source',
  // ... 20+ hardcoded types
}
```

This approach had major limitations:
- Adding new content types required code changes
- Users couldn't create custom templates
- No way to share templates between users
- Template availability was global, not project-aware
- Content type logic hardcoded throughout codebase

**Question**: How do we make templates user-extensible while maintaining type safety and UI organization?

## Decision Drivers

* **User Extensibility**: Users must be able to create custom templates
* **No Code Changes**: Adding templates shouldn't require TypeScript modifications
* **Project Context**: Templates should filter by project type
* **Type Safety**: Maintain validation despite dynamic system
* **Template Sharing**: Enable template distribution between users
* **Backward Compatibility**: Support migration from enum-based system

## Considered Options

1. **Keep Enum-Based System**: Continue hardcoding types in TypeScript
2. **Fully Dynamic JSON5 Templates**: Load all templates from JSON5 files
3. **Hybrid System**: Core templates hardcoded, user templates in JSON5
4. **Database-Backed Templates**: Store templates in SQLite/Bindery

## Decision Outcome

Chosen option: **"Fully Dynamic JSON5 Templates"**, because it provides maximum flexibility, enables user extensibility, and allows template sharing without database complexity.

### Positive Consequences

* Users can create custom templates without code knowledge
* Templates are JSON5 files (comments, trailing commas, easier editing)
* Templates can be shared via file export/import
* Template packs can be distributed
* Project-aware template filtering possible through metadata
* No more hardcoded enum maintaining

### Negative Consequences

* Loss of compile-time type checking for template IDs
* Need runtime validation of template schemas
* More complex template loading logic
* Potential for invalid user-created templates

## Implementation Details

### Template File Format

Templates defined in JSON5 files in `.vespera/templates/`:

```json5
// .vespera/templates/content/writing/article.json5
{
  template_id: "article",
  name: "Article",
  description: "News or feature article",
  version: "1.0.0",
  category: "content",
  subcategory: "writing",
  tags: ["journalism", "writing"],
  icon: "📄",

  projectTypes: ["journalism", "documentation"],

  fields: [
    {
      id: "title",
      type: "text",
      label: "Title",
      required: true
    },
    {
      id: "content",
      type: "markdown",
      label: "Content"
    }
  ],

  viewModes: [...],
  workflowStates: [...]
}
```

### Template Loading

```typescript
class TemplateLoader {
  async loadTemplates(): Promise<Template[]> {
    const systemTemplates = await this.loadFromDirectory('.vespera/templates/');
    const userTemplates = await this.loadFromDirectory('.vespera/templates/');

    return this.mergeTemplates(systemTemplates, userTemplates);
  }

  async loadFromDirectory(dir: string): Promise<Template[]> {
    const files = await this.scanDirectory(dir, '**/*.json5');
    const templates = await Promise.all(
      files.map(f => this.parseAndValidateTemplate(f))
    );
    return templates.filter(t => t !== null);
  }
}
```

### Runtime Validation

Use JSON Schema or Zod for template validation:

```typescript
import { z } from 'zod';

const TemplateSchema = z.object({
  template_id: z.string(),
  name: z.string(),
  description: z.string(),
  version: z.string(),
  category: z.enum(['projects', 'content', 'organization', 'agents', 'chat', 'providers']),
  fields: z.array(FieldSchema),
  // ... more fields
});

function validateTemplate(data: unknown): Template | null {
  try {
    return TemplateSchema.parse(data);
  } catch (error) {
    console.error('Invalid template:', error);
    return null;
  }
}
```

### Migration from Enum

1. Generate JSON5 templates for all existing enum values
2. Write templates to `.vespera/templates/` on first launch
3. Update Codex frontmatter to use template IDs
4. Remove `CodexType` enum from codebase
5. Replace hardcoded type checks with template lookups

## Pros and Cons of the Options

### Keep Enum-Based System

* Good, because compile-time type safety
* Good, because no migration needed
* Bad, because users can't create templates
* Bad, because adding types requires code changes
* Bad, because templates not shareable
* Bad, because no project-aware filtering

### Fully Dynamic JSON5 Templates (CHOSEN)

* Good, because users can create templates
* Good, because templates are shareable files
* Good, because no code changes to add types
* Good, because project-aware filtering possible
* Good, because template packs can be distributed
* Bad, because runtime validation required
* Bad, because loss of compile-time safety
* Bad, because more complex loading logic

### Hybrid System

* Good, because core templates remain type-safe
* Good, because user extensibility for custom types
* Bad, because two systems to maintain
* Bad, because unclear when to use which
* Bad, because core templates still hardcoded

### Database-Backed Templates

* Good, because centralized template management
* Good, because versioning and history
* Bad, because requires database setup
* Bad, because harder to share templates (export/import needed)
* Bad, because not file-based (less Git-friendly)

## Template Discovery

Templates discoverable through:
- **Category filtering**: `getByCategory('content', 'writing')`
- **Tag searching**: `searchByTags(['journalism'])`
- **Project filtering**: `getForProject('journalism')`
- **Full-text search**: `search('interview article')`

## Template Sharing

Users can share templates by:
1. Exporting JSON5 file
2. Creating template packs (multiple templates)
3. Publishing to community repository
4. Importing into `.vespera/templates/`

## Related Decisions

* [ADR-001: Projects as Fundamental](./ADR-001-projects-fundamental.md) - Template filtering by project
* [ADR-005: Template Inheritance](./ADR-005-template-inheritance.md) - Template reuse patterns
* [ADR-006: Hierarchical Menus](./ADR-006-hierarchical-menus.md) - Template organization in UI

## Links

* Refines [Hierarchical Template System](../../architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)
* Refines [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)
* Supersedes: Enum-based CodexType system
