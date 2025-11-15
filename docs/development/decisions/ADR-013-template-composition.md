# ADR-013: Template Composition and Nesting

**Status**: Accepted
**Date**: 2025-10-25
**Deciders**: Aya (Product Owner), Claude Code
**Technical Story**: [Phase 17: Codex Editor Implementation](../phases/PHASE_17_PLAN.md)

---

## Context and Problem Statement

How should templates support complex, hierarchical content structures? How can templates enable users to create pre-designed nested Codex structures for common workflows?

Currently, templates define individual Codex types but don't support composition or linking to other templates. This limits the ability to create sophisticated, reusable content structures that reflect real-world organizational patterns.

## Decision Drivers

* **Workflow Automation**: Task system needs to create complex Codex structures automatically
* **Reusability**: Common patterns (e.g., "Chapter with Scenes") should be reusable across projects
* **Consistency**: Enforce organizational patterns through template-driven structure
* **User Efficiency**: Reduce repetitive setup work by providing pre-configured structures
* **Flexibility**: Support both simple (single Codex) and complex (nested hierarchy) creation
* **Template Quality**: Need standardized, well-designed template schemas as foundation

## Considered Options

1. **Flat Templates Only** - Each template creates a single Codex, nesting must be done manually
2. **Template Composition** - Templates can reference other templates to create nested structures
3. **Template Inheritance** - Templates extend base templates (object-oriented style)
4. **Hybrid: Composition + Inheritance** - Combine both patterns for maximum flexibility

## Decision Outcome

Chosen option: **"Template Composition"** (with inheritance via `baseTemplate`), because it enables powerful automation while maintaining clarity and avoiding complexity.

**Core Principle**: Templates can contain links to other templates for automatic creation of pre-designed nested Codex structures. This is essential for task automation and workflow optimization.

### Positive Consequences

* **Automation-Friendly**: Task system can create entire content hierarchies with one action
* **Workflow Templates**: Can define "Novel Chapter" template that auto-creates scene templates
* **Consistency**: Users get consistent structure without manual setup
* **Discoverability**: New users can see example structures through templates
* **Modular Design**: Templates become composable building blocks
* **Evolution Support**: Templates can be versioned and improved over time

### Negative Consequences

* **Complexity**: Template schema becomes more complex with composition
* **Circular Reference Risk**: Need validation to prevent template A → template B → template A loops
* **Version Management**: Composed templates need careful version coordination
* **Validation Burden**: Must validate entire composition tree, not just single template

## Pros and Cons of the Options

### Option 1: Flat Templates Only

Templates only create single Codices. Users manually create nested structures.

* Good, because simple to implement and understand
* Good, because no circular reference issues
* Good, because templates remain focused and single-purpose
* Bad, because forces repetitive manual work
* Bad, because difficult to enforce organizational patterns
* Bad, because task automation limited to simple operations
* Bad, because no way to capture "best practice" structures

### Option 2: Template Composition (CHOSEN)

Templates can reference other templates for nested Codex creation.

* Good, because enables powerful workflow automation
* Good, because captures organizational best practices
* Good, because reduces user setup time significantly
* Good, because supports hierarchical content naturally
* Good, because templates remain modular and reusable
* Good, because aligns with task automation requirements
* Bad, because requires circular reference validation
* Bad, because more complex template schema
* Bad, because harder to debug composition issues

### Option 3: Template Inheritance

Templates extend base templates in OOP style (is-a relationship).

* Good, because promotes reuse of common fields
* Good, because familiar pattern for developers
* Bad, because doesn't address composition/nesting need
* Bad, because can lead to deep inheritance chains
* Bad, because doesn't help with multi-Codex creation
* Neutral, useful but solves different problem than composition

### Option 4: Hybrid: Composition + Inheritance

Support both composition (has-a) and inheritance (is-a).

* Good, because maximum flexibility and power
* Good, because inheritance handles field reuse, composition handles nesting
* Bad, because significantly more complex
* Bad, because two systems to maintain and validate
* Bad, because higher learning curve for template authors
* Neutral, may be needed eventually but too complex for MVP

## Implementation Design

### Template Composition Syntax

Templates specify child templates to create automatically:

```json5
{
  template_id: "novel-chapter",
  name: "Chapter",
  description: "A chapter in a novel with scenes",

  // Existing field definitions...
  fields: [
    { id: "title", type: "text", label: "Chapter Title" },
    { id: "number", type: "number", label: "Chapter Number" },
    { id: "summary", type: "textarea", label: "Chapter Summary" }
  ],

  // NEW: Composition - child templates to auto-create
  children: [
    {
      template_id: "scene",      // Template to instantiate
      count: 3,                   // Create 3 scenes by default
      prompt_user: true,          // Ask user for count before creating
      naming_pattern: "Scene {n}" // How to name children
    }
  ],

  // NEW: Suggested parent templates (for UI hints)
  typical_parents: ["novel", "story-collection"]
}
```

### Validation Rules

1. **No Circular References**: Template A cannot eventually reference template A through composition chain
2. **Depth Limit**: Composition nesting limited to 5 levels (configurable)
3. **Count Limits**: Maximum child count per template (prevent runaway creation)
4. **Template Existence**: All referenced template_ids must exist and be valid
5. **Project Type Compatibility**: Child templates must be compatible with parent's project types

### Template Standardization Requirements

Per product owner feedback:

> "Standardize template schemas *first* and then add validation and fallbacks. Templates are the very core of the system and need to be as carefully constructed as possible. Recommend creating defined subcomponents templates are allowed to contain."

**Implementation Priority**:
1. Define standard template schema (extend existing schema with composition)
2. Create validation system for composition structures
3. Implement fallback behavior for missing/invalid references
4. Document template authoring best practices

### Task Automation Integration

Template composition enables sophisticated task automation:

```json5
{
  automation_rule: {
    trigger: "codex.field_change",
    condition: "template_id == 'novel' AND field == 'chapter_count'",
    action: {
      type: "create_nested_codices",
      template_id: "novel-chapter",
      count: "{{chapter_count}}",  // Use field value
      parent_codex_id: "{{trigger.codex_id}}"
    }
  }
}
```

## Usage Examples

### Example 1: Novel Structure

```
Novel Template
├── children: [
│   └── { template_id: "chapter", count: 10, prompt_user: true }
│   ]
│
Chapter Template
├── children: [
│   └── { template_id: "scene", count: 3, prompt_user: true }
│   ]
│
Scene Template
└── (no children - leaf node)
```

Creating a "Novel" Codex could automatically create 10 Chapters, each with 3 Scenes = 31 Codices total.

### Example 2: Software Module

```
Module Template
├── children: [
│   └── { template_id: "code-file", count: 3, naming_pattern: "{module_name}/{file_type}" }
│   ]
│
Code File Template
├── children: [
│   └── { template_id: "unit-test", count: 1 }
│   ]
```

Creating a "Module" could create source files with paired test files automatically.

### Example 3: Research Project

```
Research Study Template
├── children: [
│   ├── { template_id: "hypothesis", count: 1 },
│   ├── { template_id: "methodology", count: 1 },
│   ├── { template_id: "data-collection", count: 5, prompt_user: true },
│   └── { template_id: "analysis", count: 1 }
│   ]
```

## Migration Path

### Phase 1 (Current - Phase 17)
- Implement base template composition schema
- Add validation for circular references
- Support single-level composition only
- Manual child creation (no automatic nesting yet)

### Phase 2 (Phase 18-19)
- Implement automatic child Codex creation
- Add user prompts for variable child counts
- Support naming patterns and parameterization

### Phase 3 (Future)
- Multi-level composition (nested children)
- Template versioning and migration
- Composition preview/dry-run
- Template marketplace/sharing

## Links

* Refines [ADR-004: Dynamic Templates Over Hardcoded Types](./ADR-004-dynamic-templates.md) - Template system architecture
* Refines [ADR-012: Codices as File Containers](./ADR-012-codices-as-file-containers.md) - What Codices are
* Relates to [ADR-007: Codex-Based Folders](./ADR-007-codex-folders.md) - Nesting implementation
* [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md)
* [Hierarchical Template System](../../architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md)
* [Dynamic Automation Architecture](../../architecture/core/DYNAMIC_AUTOMATION_ARCHITECTURE.md) - Task automation

---

## Product Owner Notes

From Phase 17 risk analysis:

> "Templates are the very core of the system and need to be as carefully constructed as possible. Recommend creating defined subcomponents templates are allowed to contain. Just as with Codices themselves, templates should also be able to contain links to *other templates* for creation of pre-designed nested Codices. **This is important to the Task automation system.**"

This ADR makes template composition a first-class feature of the template system, enabling the sophisticated automation workflows envisioned for the platform.

---

*Created: 2025-10-25*
*Updated: 2025-10-25*
*Template version: 1.0.0*
