# ADR-029: Navigator Filtering Levels for Atomic Architecture

**Status**: Accepted
**Date**: 2025-11-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 20 Planning - Handling Navigator Flooding from Extreme Atomicity

---

## Context and Problem Statement

With extreme atomic architecture (ADR-020), every field value becomes a separate Codex. A CharacterCodex with name/age/portrait fields creates StringCodex("Alice"), NumberCodex(25), and ImageCodex references. While this architecture provides maximum RAG efficiency and metadata richness, it creates a UX problem: the Navigator will be flooded with hundreds or thousands of atomic Codices (StringCodex, NumberCodex, etc.), drowning out the important composed Codices that users actually care about.

**Question**: How should the Navigator handle visibility and filtering of atomic Codices while maintaining discoverability and flexibility?

## Decision Drivers

* **UX Clarity**: Users should see important Codices (Character, Scene, Project) by default
* **Discoverability**: Atomic Codices should still be findable when needed (debugging, reference inspection)
* **Flexibility**: Different users may want different visibility levels
* **Performance**: Rendering thousands of Codices in Navigator should be efficient
* **Template-Driven**: Visibility should be determined by template metadata, not hardcoded logic
* **Progressive Disclosure**: Show simple by default, reveal complexity on demand

## Considered Options

**Option 1**: **Hide All Atomic Codices Permanently**
- Never show StringCodex, NumberCodex, etc. in Navigator
- Simplest UX, cleanest Navigator
- Users can't discover or inspect atomic Codices

**Option 2**: **Show All Codices Always**
- Display every Codex including atomic ones
- No filtering, users see "true" database state
- Navigator becomes unusable with thousands of entries

**Option 3**: **Navigator Filtering Levels** (Chosen)
- **Template metadata flag**: `navigatorVisibility: 'normal' | 'hidden' | 'always-show'`
- **User toggle**: "Show All Codices" button in Navigator toolbar
- **Default behavior**: Hide atomic Codices, show composed Codices
- **Progressive disclosure**: Click toggle to reveal hidden Codices

## Decision Outcome

Chosen option: **"Option 3: Navigator Filtering Levels"**, because it balances UX clarity with discoverability, allows template authors to control visibility, and provides users with progressive disclosure when they need to inspect atomic Codices for debugging or reference management.

### Positive Consequences

* **Clean Default View**: Navigator shows only important Codices (Character, Scene, Project) by default
* **Discoverability**: Atomic Codices accessible via "Show All" toggle when needed
* **Template Control**: Template authors set visibility level via metadata
* **Performance**: Navigator renders fewer items by default, improves performance
* **Debugging Support**: Users can inspect atomic Codices when troubleshooting references
* **Flexible**: Users can customize default visibility level in settings (future enhancement)
* **Non-Destructive**: All Codices exist in database, filtering is view-only

### Negative Consequences

* **Hidden Complexity**: Users may not understand atomic Codices exist unless they toggle visibility
* **Learning Curve**: New users must learn about visibility levels and toggle behavior
* **Inconsistency**: Some Codices visible, others hidden (may confuse users)
* **Metadata Maintenance**: Template authors must set visibility flag correctly

## Pros and Cons of the Options

### Option 1: Hide All Atomic Codices Permanently

**Example**: StringCodex, NumberCodex never appear in Navigator, no toggle available

* Good, because **simplest UX** (users never see atomic Codices)
* Good, because **cleanest Navigator** (only important Codices shown)
* Good, because **no user configuration** needed
* Bad, because **no discoverability** (users can't find atomic Codices)
* Bad, because **debugging difficulty** (can't inspect broken references)
* Bad, because **reduced transparency** (system behavior feels "magical")
* Bad, because **inflexible** (power users can't access atomic layer)

### Option 2: Show All Codices Always

**Example**: Navigator shows StringCodex("Alice"), StringCodex("Bob"), NumberCodex(25), NumberCodex(30), etc.

* Good, because **maximum transparency** (users see all data)
* Good, because **no hidden behavior** (WYSIWYG database view)
* Good, because **simplest implementation** (no filtering logic)
* Bad, because **unusable Navigator** (thousands of entries)
* Bad, because **performance issues** (rendering all Codices at once)
* Bad, because **drowns important Codices** (can't find Character among StringCodex flood)
* Bad, because **confusing for users** (why are there hundreds of String entries?)

### Option 3: Navigator Filtering Levels (Chosen)

**Example**:

```typescript
// Template metadata controls visibility
{
  templateId: "string-codex",
  name: "String Value",
  category: "atomic",
  metadata: {
    navigatorVisibility: "hidden"  // Don't show in Navigator by default
  }
}

{
  templateId: "character",
  name: "Character",
  category: "creative-writing",
  metadata: {
    navigatorVisibility: "normal"  // Show in Navigator by default
  }
}

{
  templateId: "project",
  name: "Project",
  category: "organization",
  metadata: {
    navigatorVisibility: "always-show"  // Show even when "Hide Non-Important" is enabled
  }
}
```

* Good, because **clean default view** (only important Codices shown)
* Good, because **discoverability** (toggle reveals hidden Codices)
* Good, because **template-driven** (visibility controlled by template metadata)
* Good, because **flexible** (users can toggle when needed)
* Good, because **performance** (fewer items rendered by default)
* Good, because **debugging support** (can inspect atomic Codices when needed)
* Bad, because **additional UI complexity** (toggle button, visibility states)
* Bad, because **learning curve** (users must understand visibility levels)
* Bad, because **metadata maintenance** (template authors must set flag)

**Mitigations for negatives**:
- **UI Complexity**: Simple toggle button with tooltip ("Show All Codices including atomic values")
- **Learning Curve**: Onboarding tooltip, documentation, sensible defaults
- **Metadata Maintenance**: Template generator sets default values automatically

## Implementation Details

### navigatorVisibility Metadata Flag

Add to template metadata schema:

```typescript
interface TemplateMetadata {
  navigatorVisibility?: 'normal' | 'hidden' | 'always-show';
  // 'normal': Show in Navigator by default (default for composed Codices)
  // 'hidden': Hide in Navigator by default (default for atomic Codices)
  // 'always-show': Always show, even when "Hide Non-Important" enabled (for Projects, etc.)
}
```

### Template Examples

**Atomic Templates** (hidden by default):

```json5
// StringCodex
{
  templateId: "string-codex",
  name: "String Value",
  category: "atomic",
  metadata: {
    navigatorVisibility: "hidden"
  },
  fields: [{ id: "value", type: "TEXT" }]
}

// NumberCodex, BooleanCodex, DateCodex, TextCodex - all "hidden"
```

**Composed Templates** (normal visibility):

```json5
// CharacterCodex
{
  templateId: "character",
  name: "Character",
  category: "creative-writing",
  metadata: {
    navigatorVisibility: "normal"  // Show by default
  },
  fields: [
    { id: "name", type: "REFERENCE", targetTemplate: "string-codex" },
    { id: "age", type: "REFERENCE", targetTemplate: "number-codex" }
  ]
}
```

**Important Templates** (always show):

```json5
// ProjectCodex
{
  templateId: "project",
  name: "Project",
  category: "organization",
  metadata: {
    navigatorVisibility: "always-show"  // Never hide, even in "Minimal" mode
  },
  fields: [...]
}
```

### Navigator UI Implementation

**Navigator Toolbar**:

```tsx
function Navigator() {
  const [showAllCodeices, setShowAllCodeices] = useState(false);

  return (
    <div className="navigator">
      <div className="toolbar">
        <button
          onClick={() => setShowAllCodeices(!showAllCodeices)}
          title="Show all Codices including atomic values (StringCodex, NumberCodex, etc.)"
        >
          {showAllCodeices ? 'Hide Atomic Codices' : 'Show All Codices'}
        </button>
      </div>

      <CodexList
        codices={filterCodexes(allCodexes, showAllCodeices)}
      />
    </div>
  );
}

function filterCodexes(codices: Codex[], showAll: boolean): Codex[] {
  if (showAll) {
    // Show everything
    return codices;
  }

  // Filter by navigatorVisibility
  return codices.filter(codex => {
    const template = getTemplate(codex.templateId);
    const visibility = template.metadata?.navigatorVisibility ?? 'normal';

    return visibility === 'normal' || visibility === 'always-show';
    // Hide 'hidden' Codices by default
  });
}
```

### Filtering Levels (Future Enhancement)

**Level 1: Minimal** (show only `always-show` Codices)
- Projects, important top-level Codices
- Hides most content

**Level 2: Normal** (default) (show `normal` and `always-show`)
- Character, Scene, Location, etc.
- Hides atomic Codices

**Level 3: All** (show everything)
- StringCodex, NumberCodex, etc.
- Full database transparency

## Use Cases

**1. Default User Experience**:
```
User opens Navigator
→ Sees: CharacterCodex("Alice"), SceneCodex("Chapter 1"), ProjectCodex("Novel")
→ Doesn't see: StringCodex("Alice"), StringCodex("Bob"), NumberCodex(25), ...
→ Navigator is clean and usable
```

**2. Debugging Broken Reference**:
```
User's CharacterCodex shows "[Missing Reference]" for name field
→ User clicks "Show All Codices" toggle
→ Navigator reveals StringCodex entries
→ User finds StringCodex("Alice") was accidentally deleted
→ User can restore or re-link
```

**3. Reference Inspection**:
```
User wonders "Which Codices reference this StringCodex?"
→ User clicks "Show All Codices"
→ Navigates to StringCodex("Alice")
→ Backlinks panel shows Character A, Character B using this StringCodex
→ User understands data reuse pattern
```

**4. Template Author Control**:
```
Template author creates "TagCodex" template
→ Sets navigatorVisibility: "hidden" (tags are utility, not content)
→ Users never see hundreds of TagCodex entries cluttering Navigator
→ Tags still searchable, just not in main list
```

## Migration Path

**Phase 20**: Basic implementation
- Add `navigatorVisibility` to template metadata schema
- Set flag in atomic templates (StringCodex, NumberCodex, etc.) to `"hidden"`
- Set flag in composed templates (Character, Scene, etc.) to `"normal"`
- Implement Navigator toggle and filtering logic

**Phase 23+**: Enhanced filtering
- Add "Filtering Level" dropdown (Minimal, Normal, All)
- Save user preference in settings
- Add per-project visibility overrides
- Implement search that ignores visibility filter

**Future**: Advanced features
- Custom visibility rules ("Hide all Codices in 'archive' tag")
- Saved filter presets
- Keyboard shortcuts to toggle visibility
- Visual indicators for hidden Codices (grayed out icons)

## Performance Considerations

**Default Behavior (filtered view)**:
- 1000 total Codices in database
- 800 atomic Codices (StringCodex, NumberCodex, etc.)
- 200 composed Codices (Character, Scene, etc.)
- **Navigator renders**: 200 items (20% of total)
- **Result**: Fast, usable

**Show All (unfiltered view)**:
- **Navigator renders**: 1000 items
- **Mitigation**: Virtual scrolling (already planned for Navigator)
- **Result**: Acceptable with virtualization

**Filtering Performance**:
- Filter operation: O(n) where n = total Codices
- With 10k Codices: ~10ms to filter (negligible)
- **Optimization**: Cache filtered list, invalidate on Codex create/delete

## Alternatives Considered

**Tag-Based Filtering**:
- Use tags instead of metadata flag: `tags: ['atomic', 'hidden-by-default']`
- Pro: More flexible (users can customize tag visibility)
- Con: Overloads tag system with structural metadata
- **Decision**: Metadata flag is clearer separation

**Codex Category Filtering**:
- Filter by `category: 'atomic'` instead of visibility flag
- Pro: Reuses existing category field
- Con: Category is semantic (purpose), visibility is presentational (UI)
- **Decision**: Separate concerns with dedicated flag

**Smart Auto-Detection**:
- Automatically hide Codices with no forward references (terminal nodes)
- Pro: No metadata needed
- Con: Fragile (depends on graph structure), non-obvious behavior
- **Decision**: Explicit metadata more predictable

## Links

* Motivated by [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Complements [ADR-028: UI Codex Presentation Layer](./ADR-028-ui-codex-presentation-layer.md)
* Related to [ADR-021: Inline Reference Editing Pattern](./ADR-021-inline-reference-editing-pattern.md)
