# ADR-028: UI Codex Presentation Layer

**Status**: Accepted
**Date**: 2025-01-17
**Deciders**: User (Aya), Claude Code AI Assistant
**Technical Story**: Phase 20 Planning - UI Codex for Layout and Rendering

---

## Context and Problem Statement

With extreme atomic architecture (ADR-020), Codices contain data but no presentation information. A CharacterCodex has name, age, portrait fields, but doesn't specify how they should be rendered. Users need the ability to:

1. **Customize layouts**: Arrange fields in flexbox/grid layouts
2. **Create multiple views**: Same data, different presentations (card view, table view, detail view)
3. **Build dashboards**: Compose widgets from different Codices
4. **Design forms**: Drag-drop field arrangement for data entry
5. **Support responsive design**: Different layouts for mobile vs. desktop

**Question**: How should presentation/layout information be stored and managed separately from data?

## Decision Drivers

* **Separation of concerns**: Data layer (Codices) should be independent of presentation layer (UI)
* **User customization**: Users should be able to design their own UIs without coding
* **Template-driven**: Consistent with extreme atomic architecture - everything is a Codex
* **Reusability**: Same data Codex should support multiple UI layouts
* **Standard compliance**: Use web standards (CSS Grid, Flexbox) rather than proprietary abstractions
* **RAG optimization**: UI metadata should be loadable separately from data (context efficiency)

## Considered Options

**Option 1**: **Embed UI in Data Codices**
- Store layout configuration directly in CharacterCodex metadata
- Simple, all information in one place
- Poor separation of concerns, no reusability

**Option 2**: **UI Templates (Non-Codex)**
- Create separate UI template system outside Codex architecture
- UI templates reference Codex types
- Inconsistent with "everything is a Codex" philosophy

**Option 3**: **UI Codex (Chosen)**
- **UI information itself is a Codex**
- UICodex references data Codices and specifies layout
- Full composition pattern, maximum flexibility
- Consistent with extreme atomic architecture

## Decision Outcome

Chosen option: **"Option 3: UI Codex"**, because it maintains consistency with extreme atomic architecture, enables maximum flexibility and reusability, and treats presentation as first-class data that can itself have metadata, tags, and versioning.

### Positive Consequences

* **Separation of Concerns**: Data (CharacterCodex) completely independent of presentation (CharacterSheetUICodex)
* **Multiple Views**: Same CharacterCodex can have CardViewUI, DetailViewUI, PrintViewUI
* **User Customization**: Users create UICodex instances to design their own layouts
* **Reusability**: UICodex can be shared, versioned, and applied to multiple data Codices
* **RAG Efficiency**: Load only UICodex when rendering, only data Codex when querying content
* **Composition**: UICodex uses REFERENCE fields (perfect fit for Phase 20)
* **Metadata Richness**: UICodex can have tags, creation date, author ("Alice's Custom Character Sheet")
* **Template-Driven**: UICodex templates define different UI patterns (form, dashboard, report)

### Negative Consequences

* **Additional Complexity**: Two Codices instead of one (data + UI)
* **Reference Management**: Need to ensure UICodex references stay valid
* **Initial Learning Curve**: Users must understand data vs. UI separation
* **Implementation Effort**: Requires layout engine, CSS Grid/Flexbox support

## Pros and Cons of the Options

### Option 1: Embed UI in Data Codices

**Example**:
```json5
{
  id: "char-001",
  templateId: "character",
  fields: {
    name: { type: REFERENCE, target: "string-001" },
    age: { type: REFERENCE, target: "number-001" }
  },
  metadata: {
    ui_layout: {
      type: "grid",
      columns: 2,
      areas: "'name portrait' 'age portrait'"
    }
  }
}
```

* Good, because **simple** (everything in one place)
* Good, because **no additional references** to manage
* Bad, because **no separation of concerns** (data mixed with presentation)
* Bad, because **not reusable** (can't share layout across Codices)
* Bad, because **single view only** (can't have multiple layouts for same data)
* Bad, because **violates RAG efficiency** (must load layout even when just querying data)

### Option 2: UI Templates (Non-Codex)

**Example**:
```json5
// Separate UI template system
{
  templateType: "ui-template",  // Not a Codex!
  targetCodexType: "character",
  layout: {
    type: "grid",
    areas: "'name portrait' 'age portrait'"
  }
}
```

* Good, because **separation of concerns** (data and UI separated)
* Good, because **reusable** (template applies to all Characters)
* Bad, because **inconsistent architecture** (not a Codex, breaks "everything is a Codex")
* Bad, because **no metadata richness** (can't tag, version, or track authorship)
* Bad, because **parallel system** (separate management from Codices)

### Option 3: UI Codex (Chosen)

**Example**:
```json5
// CharacterSheetUICodex (is a Codex!)
{
  id: "ui-char-sheet-001",
  templateId: "ui-codex",
  name: "Alice's Character Sheet Layout",
  category: "ui-layouts",
  fields: {
    data_source: {
      type: REFERENCE,
      target: "char-001"  // References CharacterCodex
    },
    layout_type: {
      type: TEXT,
      value: "grid"
    },
    layout_config: {
      type: COMPUTED,
      value: {
        display: "grid",
        gridTemplateColumns: "1fr 1fr",
        gridTemplateAreas: "'name portrait' 'age portrait'",
        gap: "16px"
      }
    },
    sections: {
      type: MULTI_REFERENCE,
      targets: ["ui-section-header", "ui-section-stats"]
    }
  },
  metadata: {
    tags: ["character-sheet", "grid-layout"],
    author: "alice",
    created_at: "2025-01-17"
  }
}
```

* Good, because **consistent architecture** (UICodex is a Codex like everything else)
* Good, because **full separation** (data completely independent of presentation)
* Good, because **multiple views** (multiple UICodex for same data Codex)
* Good, because **reusable** (UICodex can reference different data Codices)
* Good, because **metadata richness** (tags, versioning, authorship on UI layouts)
* Good, because **RAG efficient** (load UICodex only when rendering, not when querying)
* Good, because **uses REFERENCE fields** (natural fit for Phase 20)
* Bad, because **more complex** (two Codices instead of one)
* Bad, because **reference management** (must ensure references stay valid)

**Mitigations for negatives**:
- **Complexity**: "Inline reference" editing hides indirection (ADR-021)
- **References**: Automatic reference tracking in Phase 20

## Implementation Details

### UI Codex Template

Basic template for UI layouts:

```json5
{
  templateId: "ui-codex",
  name: "UI Layout",
  category: "ui-layouts",
  fields: [
    {
      id: "data_source",
      type: REFERENCE,
      label: "Data Source",
      description: "Codex to render",
      required: true
    },
    {
      id: "layout_type",
      type: SELECT,
      label: "Layout Type",
      options: ["flexbox", "grid", "stack", "flow"],
      default: "flexbox"
    },
    {
      id: "layout_config",
      type: COMPUTED,
      label: "Layout Configuration",
      computeFn: "generateLayoutConfig(layout_type, fields_to_show)",
      description: "CSS properties for layout"
    },
    {
      id: "fields_to_show",
      type: MULTI_REFERENCE,
      label: "Fields to Display",
      description: "Which fields from data source to render",
      targetTemplate: "ui-field-config"
    },
    {
      id: "responsive",
      type: REFERENCE,
      label: "Responsive Config",
      targetTemplate: "responsive-config",
      optional: true
    }
  ]
}
```

### UI Field Config Template

Metadata for how a specific field should render:

```json5
{
  templateId: "ui-field-config",
  name: "Field Configuration",
  category: "ui-components",
  fields: [
    {
      id: "field_path",
      type: TEXT,
      label: "Field Path",
      description: "Path to field in data source (e.g., 'name', 'stats.strength')",
      required: true
    },
    {
      id: "display_label",
      type: TEXT,
      label: "Display Label",
      description: "Override label for this field"
    },
    {
      id: "widget_type",
      type: SELECT,
      label: "Widget Type",
      options: ["text-input", "number-input", "select", "textarea", "date-picker", "image-upload"],
      default: "text-input"
    },
    {
      id: "grid_area",
      type: TEXT,
      label: "Grid Area",
      description: "CSS grid area name (e.g., 'name', 'portrait')"
    },
    {
      id: "flex_order",
      type: NUMBER,
      label: "Flex Order",
      description: "Order in flexbox layout"
    },
    {
      id: "validation",
      type: REFERENCE,
      label: "Validation Rules",
      targetTemplate: "validation-rules",
      optional: true
    }
  ]
}
```

### Layout Types

**Flexbox Layout**:
```typescript
interface FlexboxConfig {
  display: "flex";
  flexDirection: "row" | "column" | "row-reverse" | "column-reverse";
  justifyContent: "flex-start" | "center" | "flex-end" | "space-between" | "space-around";
  alignItems: "flex-start" | "center" | "flex-end" | "stretch";
  gap: string;  // CSS gap value (e.g., "16px")
}
```

**Grid Layout**:
```typescript
interface GridConfig {
  display: "grid";
  gridTemplateColumns: string;  // e.g., "1fr 1fr" or "repeat(3, 1fr)"
  gridTemplateRows?: string;
  gridTemplateAreas?: string;   // e.g., "'header header' 'sidebar main'"
  gap: string;
}
```

**Stack Layout** (simplified vertical/horizontal):
```typescript
interface StackConfig {
  display: "flex";
  flexDirection: "column" | "row";
  gap: string;
  // Auto-generated from flexbox
}
```

### Rendering Engine

UI Codices are interpreted by the rendering engine:

```typescript
class UICodexRenderer {
  async render(uiCodex: Codex): Promise<React.ReactElement> {
    // Load data source
    const dataSourceId = uiCodex.fields.data_source.target;
    const dataCodex = await loadCodex(dataSourceId);

    // Get layout config
    const layoutConfig = uiCodex.fields.layout_config.value;

    // Get fields to show
    const fieldsToShow = await batchLoadCodexes(
      uiCodex.fields.fields_to_show.targets
    );

    // Generate layout
    const layoutStyle = this.generateLayoutStyle(layoutConfig);

    // Render fields
    const fieldComponents = fieldsToShow.map(fieldConfig =>
      this.renderField(dataCodex, fieldConfig)
    );

    return (
      <div style={layoutStyle}>
        {fieldComponents}
      </div>
    );
  }

  private generateLayoutStyle(config: LayoutConfig): CSSProperties {
    // Convert layout config to CSS properties
    if (config.display === "grid") {
      return {
        display: "grid",
        gridTemplateColumns: config.gridTemplateColumns,
        gridTemplateAreas: config.gridTemplateAreas,
        gap: config.gap
      };
    } else if (config.display === "flex") {
      return {
        display: "flex",
        flexDirection: config.flexDirection,
        justifyContent: config.justifyContent,
        alignItems: config.alignItems,
        gap: config.gap
      };
    }
    // ... other layout types
  }
}
```

### Use Cases

**1. Character Sheet (Multiple Views)**:
```
CharacterCodex:char-001 (Data)
  ├── name: StringCodex("Alice")
  ├── age: NumberCodex(25)
  └── portrait: ImageCodex(...)

CharacterSheetUICodex:ui-001 (Card View)
  ├── data_source: → char-001
  ├── layout_type: "flexbox"
  └── fields_to_show: [name, portrait]

CharacterSheetUICodex:ui-002 (Detail View)
  ├── data_source: → char-001
  ├── layout_type: "grid"
  └── fields_to_show: [name, age, portrait, backstory]

CharacterSheetUICodex:ui-003 (Print View)
  ├── data_source: → char-001
  ├── layout_type: "flow"
  └── fields_to_show: [all fields, formatted for printing]
```

**2. Dashboard (Multiple Data Sources)**:
```
DashboardUICodex:dashboard-001
  ├── layout_type: "grid"
  ├── sections: MULTI_REFERENCE
  │   ├── → WidgetUICodex:character-list (shows all Characters)
  │   ├── → WidgetUICodex:recent-scenes (shows recent Scenes)
  │   └── → WidgetUICodex:task-tracker (shows Tasks)
  └── responsive: → ResponsiveConfig (mobile collapses to stack)
```

**3. Form Builder**:
```
FormUICodex:character-creator
  ├── data_template: "character" (template for new Codex)
  ├── layout_type: "grid"
  ├── fields: MULTI_REFERENCE
  │   ├── → FormFieldUI:name-input (text input for name)
  │   ├── → FormFieldUI:age-input (number input for age)
  │   └── → FormFieldUI:portrait-upload (image uploader)
  └── submit_action: "createCharacterCodex"
```

## Layout Package Research

**Status**: ✅ **Research Complete** (2025-11-17)

**Final Recommendation**: **react-grid-layout** (MIT License)

**Why react-grid-layout?**
- ✅ **Smallest bundle**: 27.2 KB gzipped (vs. 89.8 KB for flexlayout-react, 258 KB for react-mosaic)
- ✅ **JSON serialization**: Built-in layout persistence via simple JSON arrays
- ✅ **Standards-based**: Uses CSS Grid and Flexbox (not proprietary abstractions)
- ✅ **Proven at scale**: Used by AWS CloudWatch, Grafana, HubSpot, Kibana
- ✅ **MIT license**: Permissive, compatible with AGPL-3.0 project
- ✅ **TypeScript support**: Flow types included, DefinitelyTyped available
- ✅ **Active maintenance**: 21.7k stars, last update Dec 2024

**Installation**:
```bash
npm install react-grid-layout
npm install @types/react-grid-layout --save-dev
```

**Webpack Configuration** (required for CSS bundling):
```typescript
// webpack.config.js
module.exports = {
  module: {
    rules: [
      {
        test: /\.css$/,
        use: ['style-loader', 'css-loader']
      }
    ]
  }
};
```

**Integration Example**:
```typescript
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

// UICodex layout stored as JSON
const layout = [
  { i: "name-field", x: 0, y: 0, w: 2, h: 1 },
  { i: "portrait", x: 2, y: 0, w: 1, h: 2 }
];

// Render UI from UICodex
<GridLayout
  className="layout"
  layout={layout}
  cols={12}
  rowHeight={30}
  width={1200}
>
  <div key="name-field">{renderField(nameField)}</div>
  <div key="portrait">{renderField(portraitField)}</div>
</GridLayout>
```

**Alternative for Complex Dashboards**: **flexlayout-react** (89.8 KB gzipped) provides tabbed docking layouts but comes with larger bundle size and more complex API. Defer to Phase 23+ if needed.

**Not Recommended**:
- **react-mosaic-component**: 258 KB bundle, Apache 2.0 license, window manager focus doesn't align with form/dashboard use case
- **@hello-pangea/dnd**: No layout management, only drag-drop reordering
- **react-rnd**: No layout system, only individual resize/drag

**Full Research Report**: [REACT_LAYOUT_LIBRARIES_RESEARCH.md](../reports/REACT_LAYOUT_LIBRARIES_RESEARCH.md)

## Implementation Strategy: Default-First Approach

**Revised Strategy** (2025-11-17): After user feedback, the implementation approach has shifted to a **default-first pattern** with UI Codex as an optional enhancement.

### Phase 20: Default Rendering (Foundation)

**Default UI for Every Codex Type**:
1. **Atomic Codices have built-in renderers**:
   - StringCodex → `<input type="text" />`
   - NumberCodex → `<input type="number" />`
   - BooleanCodex → `<input type="checkbox" />`
   - DateCodex → `<input type="date" />`
   - TextCodex → `<textarea />`
2. **Compositional rendering**:
   - CharacterCodex auto-renders by recursively rendering its REFERENCE fields
   - Each referenced field uses its default renderer
   - Default layout: simple vertical stack
3. **System works out-of-the-box**:
   - No UICodex required for basic functionality
   - Users can immediately view/edit Codices
   - Progressive enhancement pattern

**UI Codex Template Definition** (Phase 20):
- Create `ui-codex.template.json5` and `ui-field-config.template.json5` templates
- Document template structure for future use
- **Do not implement** rendering engine yet (defer to Phase 23+)
- Templates exist in registry but are not yet functional

**Optional UI Codex Check** (Phase 20):
```typescript
function renderCodex(codex: Codex): React.ReactElement {
  // Check for optional UICodex override
  const uiCodex = findUICodexFor(codex.id);
  if (uiCodex) {
    // Phase 23+: Render with custom layout
    return <UICodexRenderer uiCodex={uiCodex} dataCodex={codex} />;
  }

  // Phase 20: Fall back to default rendering
  return <DefaultCodexRenderer codex={codex} />;
}
```

### Phase 23+: Custom Layout Editor (Enhancement)

**UI Codex Implementation** (deferred):
- Install react-grid-layout (27.2 KB)
- Implement UICodexRenderer with flexbox/grid support
- Build drag-drop visual layout designer
- Create layout templates gallery
- Add responsive breakpoints

**Why Defer**:
- Phase 20 focus is **reference system** (primary goal)
- Default rendering provides **immediate value**
- Custom layouts are **nice-to-have**, not **must-have**
- Reduces Phase 20 scope and complexity
- Allows user feedback on defaults before building custom UI

### Benefits of Default-First Approach

1. **System works immediately**: No UICodex required to render Codices
2. **Progressive enhancement**: Start simple, add complexity later
3. **Reduced Phase 20 scope**: Focus on references, not layout customization
4. **User-centered**: Let users experience defaults before offering customization
5. **Composability**: CharacterCodex auto-composes UI from atomic field defaults

## Migration Path

**Phase 19**: Template editor (no UI Codices yet)
**Phase 20**:
- Create UICodex template
- Implement basic layout support (flexbox/grid)
- Research layout packages for future enhancement
**Phase 21**: FILE/IMAGE integration works with UICodex
**Phase 23+**: Advanced drag-drop visual designer for UICodex

**Backward Compatibility**:
- Existing Codices continue to render with default UI
- UICodex is optional enhancement, not requirement
- Default UICodex auto-generated for Codices without custom UI

## Modifier Codex Pattern

**Insight** (2025-11-17): UI Codex represents a broader architectural pattern - **Modifier Codices** that augment or transform other Codices without modifying their data.

**Examples of Modifier Codex Pattern**:
1. **UICodex** - Modifies presentation/layout (this ADR)
2. **ValidationCodex** - Could store custom validation rules for a Codex
3. **PermissionCodex** - Could define access control and permissions
4. **AutomationCodex** - Could store automation rules triggered by Codex state changes
5. **ThemeCodex** - Could define styling/appearance overrides
6. **BehaviorCodex** - Could specify custom interactions and workflows

**Pattern Characteristics**:
- **Non-destructive**: Modifier doesn't change data Codex structure
- **Optional**: System works without modifier (uses defaults)
- **Composable**: Multiple modifiers can apply to same Codex
- **REFERENCE-based**: Modifier references target Codex
- **Separation of concerns**: Data (Codex) vs. metadata (Modifier)

**Future Exploration**: This pattern may warrant its own ADR documenting the general "Modifier Codex" or "Aspect-Oriented Codex" architecture.

## Links

* Builds on [ADR-020: Extreme Atomic Codex Architecture](./ADR-020-extreme-atomic-architecture.md)
* Related to [ADR-023: Reference Field Implementation](./ADR-023-reference-field-implementation.md)
* Extends [ADR-021: Inline Reference Editing Pattern](./ADR-021-inline-reference-editing-pattern.md)
* Complements [ADR-024: Formula and Computed Fields](./ADR-024-formula-computed-fields.md)
* Implements [ADR-029: Navigator Filtering Levels](./ADR-029-navigator-filtering-levels.md) (UICodex hidden by default)
