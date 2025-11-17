# Phase 19: Template Editor & Atomic Templates

**Status**: Proposed
**Duration**: 5-7 days
**Related ADRs**: [ADR-020](../decisions/ADR-020-extreme-atomic-architecture.md), [ADR-021](../decisions/ADR-021-inline-reference-editing-pattern.md), [ADR-022](../decisions/ADR-022-template-editor-dual-interface.md), [ADR-024](../decisions/ADR-024-formula-computed-fields.md)

---

## Executive Summary

Phase 19 establishes the foundation for extreme atomic architecture by implementing a dual-interface template editor and creating fundamental atomic Codex templates. This phase enables template creation/editing through both visual and JSON5 interfaces, introduces atomic templates (StringCodex, NumberCodex, etc.) as the building blocks of the system, and implements FORMULA/COMPUTED field types for dynamic values. The work transforms Vespera Forge from a static content system into a truly composable, RAG-optimized architecture.

---

## Objectives

### Primary Goals
- [ ] **Dual-Interface Template Editor** - Visual form builder + JSON5 text editor with two-way sync
- [ ] **Atomic Codex Templates** - Create foundational templates: StringCodex, NumberCodex, BooleanCodex, DateCodex, TextCodex, MarkdownCodex
- [ ] **Template Validation System** - JSON5 schema validation with real-time error reporting
- [ ] **FORMULA Field Type** - User-editable expressions using mathjs (Excel-like formulas)
- [ ] **COMPUTED Field Type** - Template-defined computed values with dependency tracking
- [ ] **Template Management UI** - Create, edit, save, browse templates with file watching

### Secondary Goals
- [ ] **Template Live Preview** - Preview panel showing how template will render
- [ ] **Template Categories** - Organize templates by category (atomic, creative-writing, software-dev)
- [ ] **Field Type Palette** - Drag-drop palette of available field types
- [ ] **Template Inheritance** - baseTemplate support for extending templates

### Non-Goals
- **Reference System** - Deferred to Phase 20 (REFERENCE/MULTI_REFERENCE fields)
- **File Integration** - Deferred to Phase 21 (FILE/IMAGE field types)
- **Complex UI Features** - Multi-context, deletion, Navigator improvements deferred to Phase 22
- **Backend CRDT** - CRDT infrastructure exists but multi-user editing deferred

---

## Prerequisites

Before starting Phase 19:

- [x] Phase 18 (Logging Infrastructure) complete
- [x] Phase 17.5 (Provider System Unification) complete
- [x] Phase 17 (AI Assistant) functional
- [x] ADRs 020-027 approved and documented
- [ ] User approval of this phase plan
- [ ] Decision: mathjs configuration (which functions to enable/disable)
- [ ] Decision: Template editor UI layout (modal vs. panel vs. full-screen)
- [ ] Decision: Auto-save vs. manual save for template editor

---

## Technical Approach

### Architecture Patterns

**1. Dual-Interface Template Editor**

Implements visual and JSON5 editing modes with bidirectional sync:

```typescript
class TemplateSyncManager {
  private visualState: TemplateBuilderState;
  private json5Content: string;
  private syncing = false;

  // Visual → JSON5
  onVisualChange(newVisualState: TemplateBuilderState) {
    if (this.syncing) return;
    this.syncing = true;
    this.visualState = newVisualState;
    this.json5Content = this.serializeToJSON5(newVisualState);
    this.syncing = false;
    this.notifyJSON5Subscribers(this.json5Content);
  }

  // JSON5 → Visual
  onJSON5Change(newJSON5Content: string) {
    if (this.syncing) return;
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
}
```

**2. Atomic Codex Templates**

Foundation templates for extreme atomicity:

```json5
// StringCodex Template
{
  templateId: "string-codex",
  name: "String Value",
  category: "atomic",
  fields: [
    {
      id: "value",
      type: "TEXT",
      required: true,
      label: "Text Value"
    }
  ]
}

// NumberCodex Template
{
  templateId: "number-codex",
  name: "Number Value",
  category: "atomic",
  fields: [
    {
      id: "value",
      type: "NUMBER",
      required: true,
      label: "Numeric Value"
    }
  ]
}

// DateCodex Template
{
  templateId: "date-codex",
  name: "Date Value",
  category: "atomic",
  fields: [
    {
      id: "value",
      type: "DATE",
      required: true,
      label: "Date Value"
    }
  ]
}
```

**3. FORMULA Field Type**

User-editable formulas using mathjs:

```typescript
interface FormulaFieldDefinition {
  id: string;                      // "days_alive"
  type: FieldType.FORMULA;         // FORMULA
  label: string;                   // "Days Alive"
  formula: string;                 // "age * 365"
  editable: boolean;               // Allow user to edit formula (default: true)
  dependencies: string[];          // ["age"] (auto-detected or explicit)
  format?: string;                 // Number format: "0,0.00"
}

// mathjs integration
import { create, all } from 'mathjs';

const safeMath = create(all);

// Disable dangerous functions
const blocked = ['import', 'createUnit', 'evaluate', 'parse', 'compile'];
const overrides = Object.fromEntries(
  blocked.map(name => [name, () => { throw new Error(`Function ${name} is disabled`) }])
);
safeMath.import(overrides, { override: true });

// Evaluate formula
async function evaluateFormula(
  formula: string,
  context: Record<string, any>
): Promise<any> {
  try {
    const result = safeMath.evaluate(formula, context);
    return result;
  } catch (error) {
    throw new FormulaError(`Invalid formula: ${error.message}`);
  }
}
```

**4. COMPUTED Field Type**

Template-defined computed values:

```typescript
interface ComputedFieldDefinition {
  id: string;                      // "dimensions"
  type: FieldType.COMPUTED;        // COMPUTED
  label: string;                   // "Image Dimensions"
  computeFn: string;               // "getImageDimensions(file_path)"
  editable: boolean;               // false (computed fields not editable)
  dependencies: string[];          // ["file_path"]
  cacheTTL?: number;               // Cache duration in ms (default: 3600000 = 1 hour)
}

// Built-in compute functions
const computeFunctions = {
  // Age from birthdate
  ageFromBirthdate(birthdate: Date): number {
    const now = new Date();
    const age = now.getFullYear() - birthdate.getFullYear();
    const monthDiff = now.getMonth() - birthdate.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < birthdate.getDate())) {
      return age - 1;
    }
    return age;
  },

  // Word count
  wordCount(markdown: string): number {
    const text = stripMarkdown(markdown);
    return text.split(/\s+/).length;
  }
};
```

---

## Task Breakdown

### Backend Tasks (VS Code Extension - TypeScript)

**Task 1: Template Validation System** (2 hours)
- Implement JSON5 schema validation using Ajv
- Create template schema with required fields (templateId, name, fields)
- Implement real-time validation with error messages
- Add field type validation (STRING, NUMBER, FORMULA, COMPUTED, etc.)
- Tests: Schema validation, error reporting, edge cases

**Task 2: Template File System** (3 hours)
- Create `.vespera/templates/` directory structure
- Implement template loader (scan and parse JSON5 files)
- Add file watcher for template changes (chokidar)
- Implement template cache with invalidation
- Create template categories (atomic, creative-writing, software-dev)
- Tests: File loading, watching, caching, category organization

**Task 3: mathjs Integration** (4 hours)
- Install and configure mathjs library
- Create sandboxed math instance (disable dangerous functions)
- Implement formula evaluation with context
- Add custom domain-specific functions (today(), dateOf(), concat())
- Implement dependency detection (AST traversal)
- Create formula cache with invalidation
- Tests: Formula evaluation, sandboxing, dependency tracking, caching

**Task 4: FORMULA Field Type** (5 hours)
- Create FormulaFieldDefinition interface
- Implement formula evaluation engine
- Add dependency tracking and cache invalidation
- Create formula validation with error messages
- Implement debounced formula updates
- Tests: Formula evaluation, dependencies, caching, validation

**Task 5: COMPUTED Field Type** (4 hours)
- Create ComputedFieldDefinition interface
- Implement built-in compute functions (ageFromBirthdate, wordCount)
- Add compute function registry
- Implement computed field caching with TTL
- Add dependency-based cache invalidation
- Tests: Compute functions, caching, dependencies

### Frontend Tasks (VS Code Extension Webview - React)

**Task 6: Visual Template Editor** (8 hours)
- Create TemplateBuilderState interface
- Implement drag-drop field palette (using @dnd-kit)
- Create field property panel
- Add field reordering (drag-drop)
- Implement field type selector
- Create template metadata editor (name, category, icon)
- Tests: Field addition, reordering, property editing, validation

**Task 7: JSON5 Editor** (4 hours)
- Integrate CodeMirror with json5 syntax highlighting
- Add real-time JSON5 linting
- Implement format button (pretty-print)
- Create syntax error highlighting
- Add autocomplete for field types
- Tests: Syntax highlighting, validation, formatting

**Task 8: Two-Way Sync** (6 hours)
- Implement TemplateSyncManager class
- Add visual → JSON5 serialization
- Add JSON5 → visual parsing
- Implement sync debouncing (prevent circular updates)
- Add conflict detection (simultaneous edits)
- Tests: Bidirectional sync, debouncing, conflict handling

**Task 9: Template Management UI** (5 hours)
- Create template browser/selector
- Implement "New Template" wizard
- Add "Save Template" button
- Create "Delete Template" confirmation
- Implement template search/filter
- Add template categories sidebar
- Tests: CRUD operations, search, filtering

**Task 10: Atomic Template Creation** (3 hours)
- Create StringCodex template JSON5
- Create NumberCodex template JSON5
- Create BooleanCodex template JSON5
- Create DateCodex template JSON5
- Create TextCodex template JSON5
- Create MarkdownCodex template JSON5
- Validate all templates load correctly
- Tests: Template loading, validation, rendering

**Task 11: Formula Field UI** (5 hours)
- Create FormulaFieldEditor component
- Implement inline formula editing
- Add live result preview
- Create error display with user-friendly messages
- Implement formula autocomplete
- Add "Edit in Detail" button
- Tests: Formula editing, validation, error display

**Task 12: Computed Field UI** (3 hours)
- Create ComputedFieldDisplay component
- Implement loading state for async computation
- Add "Refresh" button to recompute
- Display computed value with formatting
- Show computation errors gracefully
- Tests: Display, loading, refresh, error handling

---

## Task Dependencies

```
Backend Foundation (Independent):
  Task 1 (Validation)  → Task 2 (File System) → Task 3 (mathjs)
  Task 3 (mathjs)      → Task 4 (FORMULA)
  Task 4 (FORMULA)     → Task 5 (COMPUTED)

Frontend Implementation (Depends on Backend):
  Task 1 → Task 6 (Visual Editor), Task 7 (JSON5 Editor)
  Task 6 + Task 7 → Task 8 (Two-Way Sync)
  Task 2 → Task 9 (Template Management)
  Task 2 → Task 10 (Atomic Templates)
  Task 4 → Task 11 (Formula UI)
  Task 5 → Task 12 (Computed UI)

Integration:
  All → Final testing and integration
```

**Parallelization Strategy**:
1. **Days 1-2**: Tasks 1-3 (backend validation, file system, mathjs)
2. **Days 3-4**: Tasks 4-5 (FORMULA/COMPUTED) + Tasks 6-7 (editors)
3. **Days 5-6**: Tasks 8-9 (sync, management) + Task 10 (atomic templates)
4. **Day 7**: Tasks 11-12 (field UIs) + integration testing

---

## Open Questions

**Decisions Needed Before Starting**:

1. **mathjs Configuration?**
   - **Options**: Which functions to enable (all math, strings, logic?)
   - **Recommendation**: Enable math, logic, string; disable import, eval, compile
   - **Impact**: Security vs. functionality tradeoff

2. **Template Editor Layout?**
   - **Options**: Full-screen modal, side panel, separate window
   - **Recommendation**: Side panel (maintains three-panel design consistency)
   - **Impact**: UI flow and screen real estate

3. **Auto-Save vs. Manual Save?**
   - **Options**: Auto-save on change, manual save button, both
   - **Recommendation**: Both (auto-save + manual save button like VS Code)
   - **Impact**: User experience and data loss prevention

4. **Template Validation Strictness?**
   - **Options**: Strict (reject invalid), lenient (warn but allow), hybrid
   - **Recommendation**: Hybrid (strict for JSON5 syntax, lenient for template logic with warnings)
   - **Impact**: User experience vs. system robustness

5. **Formula Error Handling?**
   - **Options**: Silent failure, show error inline, block save
   - **Recommendation**: Show error inline, allow save with warning
   - **Impact**: Development workflow and user friction

---

## Risk Assessment

### High Risk

1. **mathjs Security** (Backend)
   - **Risk**: Formula execution could be exploited for code injection
   - **Mitigation**: Sandbox mathjs, disable dangerous functions, validate inputs
   - **Contingency**: Implement formula whitelist if security issues arise

2. **Two-Way Sync Complexity** (Frontend)
   - **Risk**: Circular updates, data loss, desynchronization
   - **Mitigation**: Careful sync manager design, debouncing, conflict detection
   - **Contingency**: Fall back to single-mode editor if sync too buggy

### Medium Risk

3. **Template Validation Performance** (Backend)
   - **Risk**: Real-time validation slows down editor
   - **Mitigation**: Debounced validation, schema caching
   - **Contingency**: Move validation to save-time only

4. **Visual Editor Scope Creep** (Frontend)
   - **Risk**: Visual editor becomes too complex to finish in phase
   - **Mitigation**: Start with basic field types, defer advanced features
   - **Contingency**: Ship with JSON5 editor only, add visual later

### Low Risk

5. **File Watching Overhead** (Backend)
   - **Risk**: Watching large template directories slows down system
   - **Mitigation**: Watch only `.vespera/templates/`, ignore node_modules
   - **Contingency**: Disable file watching, require manual reload

---

## Success Criteria

**Must-Have (MVP)**:
- ✅ Users can create templates using visual editor
- ✅ Users can edit templates using JSON5 editor
- ✅ Visual and JSON5 modes stay synchronized
- ✅ All 6 atomic templates (String, Number, Boolean, Date, Text, Markdown) exist and load
- ✅ FORMULA fields evaluate correctly with mathjs
- ✅ COMPUTED fields calculate values from dependencies
- ✅ Template validation catches errors with helpful messages
- ✅ Templates auto-save or have clear save button

**Should-Have**:
- ✅ Live preview shows template rendering
- ✅ Field type palette with drag-drop
- ✅ Template categories organize templates
- ✅ Formula autocomplete suggests functions
- ✅ Computed fields cache results with invalidation
- ✅ File watcher detects external template changes

**Nice-to-Have**:
- ✅ Template inheritance (baseTemplate support)
- ✅ Template search/filter
- ✅ Formula syntax highlighting in editor
- ✅ Import/export templates to share
- ✅ Template versioning

---

## Timeline Estimate

**Optimistic**: 5 days (aggressive parallel work, no major blockers)
**Realistic**: 7 days (accounting for integration complexity and testing)
**Pessimistic**: 10 days (if mathjs security issues or sync bugs arise)

**Week 1**:
- Days 1-2: Backend foundation (validation, file system, mathjs integration)
- Days 3-4: Field types (FORMULA, COMPUTED) + Editors (visual, JSON5)
- Days 5-6: Sync + Management UI + Atomic templates
- Day 7: Field UIs + Integration testing + Bug fixes

---

## Context for AI Assistant

### Quick Start for Next Session

**If you're picking up Phase 19 work:**

1. **Read these files first** (in order):
   - [ADR-020: Extreme Atomic Codex Architecture](../decisions/ADR-020-extreme-atomic-architecture.md) - Core architecture
   - [ADR-022: Template Editor Dual Interface](../decisions/ADR-022-template-editor-dual-interface.md) - Editor design
   - [ADR-024: Formula and Computed Fields](../decisions/ADR-024-formula-computed-fields.md) - mathjs integration
   - This file (PHASE_19_PLAN.md) - Current plan

2. **Key mental models to understand**:
   - **Extreme Atomicity**: Even simple values like "Alice" are separate Codices (StringCodex)
   - **Dual Interface**: Visual builder and JSON5 editor must stay synchronized
   - **mathjs Sandboxing**: Security is critical - disable dangerous functions
   - **Template-Driven**: Everything in the system comes from templates (no hardcoded types)

3. **Current focus area**: Establishing template creation/editing infrastructure and atomic foundation

### System Architecture Overview

```
Template System:
├── Editor Layer
│   ├── Visual Builder (drag-drop, property panels)
│   ├── JSON5 Editor (CodeMirror, syntax highlighting)
│   └── Sync Manager (bidirectional synchronization)
├── Validation Layer
│   ├── JSON5 Schema Validation (Ajv)
│   ├── Field Type Validation
│   └── Dependency Validation
├── Storage Layer
│   ├── Template Files (.vespera/templates/*.template.json5)
│   ├── File Watcher (chokidar)
│   └── Template Cache
└── Field Type Layer
    ├── Atomic Types (STRING, NUMBER, BOOLEAN, DATE, TEXT)
    ├── FORMULA Type (mathjs evaluation)
    └── COMPUTED Type (function-based calculation)

Atomic Templates (Foundation):
StringCodex  → { value: TEXT }
NumberCodex  → { value: NUMBER }
BooleanCodex → { value: BOOLEAN }
DateCodex    → { value: DATE }
TextCodex    → { value: TEXT, multiline: true }
MarkdownCodex → { value: TEXT, markdown: true }
```

### Common Pitfalls & Gotchas

1. **Sync Manager Circular Updates**
   - **What**: Visual → JSON5 → Visual → ... infinite loop
   - **Why**: Both sides trigger onchange events
   - **How to handle**: Use `syncing` flag to prevent reentrancy

2. **mathjs Security**
   - **What**: Formula execution could run arbitrary code
   - **Why**: mathjs allows imports and evals by default
   - **How to handle**: Disable `import`, `createUnit`, `evaluate`, `parse`, `compile`

3. **Template File Paths**
   - **What**: Templates must be in `.vespera/templates/` with `.template.json5` extension
   - **Why**: File watcher and loader expect this structure
   - **How to handle**: Create directory structure first, validate paths

4. **JSON5 vs JSON**
   - **What**: JSON5 allows comments and trailing commas, JSON doesn't
   - **Why**: We use JSON5 for human-editable templates
   - **How to handle**: Use `json5` library for parsing, not `JSON.parse()`

### Important File Locations

Quick reference for key files:

- **Template Storage**: `.vespera/templates/` (all template JSON5 files)
- **Atomic Templates**: `.vespera/templates/atomic/` (StringCodex, NumberCodex, etc.)
- **Template Validation**: `src/templates/TemplateValidator.ts`
- **mathjs Integration**: `src/formulas/SafeMath.ts`
- **Template Editor**: `src/webview/TemplateEditor.tsx`
- **Sync Manager**: `src/templates/TemplateSyncManager.ts`
- **Tests**: `tests/templates/` (template validation, sync, formulas)

### Commands to Run

```bash
# Install dependencies
npm install mathjs ajv json5 @dnd-kit/core @dnd-kit/sortable chokidar

# Create template directory
mkdir -p .vespera/templates/atomic

# Run extension in development
npm run compile && npm run dev

# Run template tests
npm test -- --grep="Template"

# Validate all templates
npm run validate-templates

# Format template JSON5 files
npm run format-templates
```

---

## References

### Phase Tracking
- **Previous**: [Phase 18: Logging Infrastructure](./PHASE_18_COMPLETE.md)
- **Current**: **Phase 19: Template Editor & Atomic Templates** (this document)
- **Next**: [Phase 20: Reference System & Auto-Creation](./PHASE_20_PLAN.md)

### Architecture Decision Records
- [ADR-020: Extreme Atomic Codex Architecture](../decisions/ADR-020-extreme-atomic-architecture.md) - Core atomicity decision
- [ADR-021: Inline Reference Editing Pattern](../decisions/ADR-021-inline-reference-editing-pattern.md) - Related UX pattern
- [ADR-022: Template Editor Dual Interface](../decisions/ADR-022-template-editor-dual-interface.md) - Editor design
- [ADR-024: Formula and Computed Fields](../decisions/ADR-024-formula-computed-fields.md) - mathjs integration

### Architecture Documentation
- [Hierarchical Template System](../../architecture/core/HIERARCHICAL_TEMPLATE_SYSTEM.md) - Template architecture
- [Template System Architecture](../../architecture/core/TEMPLATE_SYSTEM_ARCHITECTURE.md) - Implementation details
- [Project-Centric Architecture](../../architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md) - Project context

---

*Phase Plan Version: 2.0.0*
*Created: 2025-01-17*
*Updated: 2025-01-17 (Complete rewrite for atomic architecture)*
*Template: PHASE_TEMPLATE.md v1.0.0*
