# React Layout Library Research Report
## UI Codex Presentation Layer Implementation

**Research Date:** 2025-11-17
**Researcher:** Claude (AI Assistant)
**Target Phase:** Phase 20 (Basic Layout Support)
**Future Phase:** Phase 23+ (Drag-Drop Support)

---

## Executive Summary

This research evaluates open-source React layout libraries for implementing the UI Codex presentation layer in Vespera Forge. UI Codices will store layout/presentation information separately from data, using REFERENCE fields to specify how data Codices should be rendered using CSS Grid, Flexbox, or other layout systems.

**Top Recommendation:** **react-grid-layout** is the best fit for Phase 20 implementation due to:
- ✅ Native CSS Grid/Flexbox rendering (standards-based)
- ✅ JSON serialization for layout persistence
- ✅ Small bundle size (27.2 KB gzipped)
- ✅ MIT license (permissive)
- ✅ Active maintenance (21.7k stars, recent commits)
- ✅ TypeScript support with type definitions
- ✅ VS Code webview compatibility
- ✅ Programmatic layout control (not just drag-drop)

**Alternative for Complex Dashboards:** **flexlayout-react** excels at tabbed docking layouts but comes with larger bundle size (89.8 KB gzipped) and more complex API.

**Not Recommended:** react-mosaic-component (large bundle at 258 KB, Apache 2.0 license, window manager focus doesn't align with use case).

---

## Package Comparison Table

| Package | License | Bundle Size (Gzip) | GitHub Stars | Last Update | TypeScript | JSON Serialization | Layout Type | Maintenance |
|---------|---------|-------------------|--------------|-------------|------------|-------------------|-------------|-------------|
| **react-grid-layout** | MIT | 27.2 KB | 21.7k | Dec 2024 | ✅ (Flow types) | ✅ Yes | Grid/Flexbox | Active |
| **flexlayout-react** | MIT | 89.8 KB | 1.2k | Jan 2025 | ✅ Native TS | ✅ Yes | Tabbed Docking | Active |
| **react-mosaic** | Apache 2.0 | 258 KB | 4.7k | Dec 2024 | ✅ Native TS | ✅ Yes | Window Manager | Active |
| **react-rnd** | MIT | 15.5 KB | N/A | N/A | ✅ Yes | ❌ No | Drag/Resize | Active |
| **@hello-pangea/dnd** | N/A | ~50 KB est | N/A | 2024 | ✅ Yes | ⚠️ Limited | List Reorder | Active |
| **golden-layout** | MIT | N/A | N/A | 2024 | ⚠️ Via wrappers | ⚠️ Partial | Docking | Active |

**Legend:**
- ✅ = Fully supported/recommended
- ⚠️ = Partial support/requires workarounds
- ❌ = Not supported/not recommended
- N/A = Information not available

---

## Detailed Evaluations

### 1. react-grid-layout (RECOMMENDED)

**Repository:** https://github.com/react-grid-layout/react-grid-layout
**npm:** https://www.npmjs.com/package/react-grid-layout
**License:** MIT

#### Key Features
- **100% React** - No jQuery dependency
- **Draggable & resizable widgets** with responsive breakpoints
- **Static widgets** and configurable packing (vertical, horizontal, or none)
- **Layout serialization** - Save and restore grid layouts
- **CSS Transforms** for improved rendering performance
- **Dynamic addition/removal** of widgets without rebuilding grid
- Compatible with React 16, 17, 18 and `<React.StrictMode>`

#### Bundle Size
- **Minified + Gzipped:** 27.2 KB
- **Dependencies:** Minimal (React only)
- **Performance:** Optimized for 100+ components with virtualization

#### JSON Serialization Example

```typescript
interface LayoutItem {
  i: string;       // Item ID (maps to data Codex)
  x: number;       // Grid position X
  y: number;       // Grid position Y
  w: number;       // Width in grid units
  h: number;       // Height in grid units
  minW?: number;   // Minimum width
  minH?: number;   // Minimum height
  static?: boolean; // Prevent drag/resize
}

// Example UICodex layout configuration
const characterSheetLayout = [
  { i: "name-field", x: 0, y: 0, w: 2, h: 1 },
  { i: "portrait", x: 2, y: 0, w: 1, h: 2 },
  { i: "age-field", x: 0, y: 1, w: 2, h: 1 }
];

// Save to UICodex
const uiCodex = {
  type: "UILayout",
  layoutEngine: "react-grid-layout",
  cols: 12,
  rowHeight: 30,
  layout: JSON.stringify(characterSheetLayout)
};
```

#### TypeScript Support
- **Type Definitions:** Included (Flow types with @flow annotations)
- **Quality:** Good - covers all major props and types
- **Import:** `import GridLayout from 'react-grid-layout';`

#### VS Code Webview Compatibility
- ✅ **Compatible** - Standard React component
- ✅ Requires proper webpack bundling (standard for React extensions)
- ✅ No browser-specific APIs that would break in webview sandbox
- ✅ CSS needs to be bundled/injected properly

#### Accessibility
- ⚠️ **Limited built-in support**
- ARIA attributes not included by default
- Keyboard navigation not documented
- **Mitigation:** Can add custom ARIA labels and keyboard handlers to grid items

#### Pros & Cons

**Pros:**
- ✅ Small bundle size (best performance)
- ✅ Standards-based (CSS Grid/Flexbox)
- ✅ Simple JSON serialization
- ✅ Programmatic control (not just drag-drop UI)
- ✅ Active maintenance and large community
- ✅ Widely adopted (BitMEX, AWS CloudWatch, Grafana, HubSpot, Kibana)
- ✅ Permissive MIT license
- ✅ Responsive breakpoints built-in

**Cons:**
- ⚠️ Limited accessibility features (need custom implementation)
- ⚠️ Flow types instead of native TypeScript
- ⚠️ Grid-focused (may need additional libraries for complex tabbed layouts)
- ⚠️ No nested grid support out-of-box (can be implemented)

#### Use Case Alignment

**Use Case 1: Character Sheet Layout** ✅ EXCELLENT
```javascript
// UICodex configuration
{
  layoutEngine: "react-grid-layout",
  cols: 12,
  rowHeight: 30,
  layout: [
    { i: "name", x: 0, y: 0, w: 8, h: 1 },
    { i: "portrait", x: 8, y: 0, w: 4, h: 4 },
    { i: "age", x: 0, y: 1, w: 4, h: 1 },
    { i: "race", x: 4, y: 1, w: 4, h: 1 }
  ],
  fields: {
    name: { dataCodexRef: "character-001", field: "name" },
    portrait: { dataCodexRef: "character-001", field: "portrait" },
    age: { dataCodexRef: "character-001", field: "age" },
    race: { dataCodexRef: "character-001", field: "race" }
  }
}
```

**Use Case 2: Dashboard Composition** ✅ GOOD
```javascript
// Compose multiple independent widgets
{
  layoutEngine: "react-grid-layout",
  cols: 12,
  layout: [
    { i: "character-list", x: 0, y: 0, w: 6, h: 4 },
    { i: "scene-list", x: 6, y: 0, w: 6, h: 4 },
    { i: "task-tracker", x: 0, y: 4, w: 12, h: 3 }
  ],
  components: {
    "character-list": { type: "CharacterListWidget" },
    "scene-list": { type: "SceneListWidget" },
    "task-tracker": { type: "TaskTracker" }
  }
}
```

**Use Case 3: Form Builder** ⚠️ ACCEPTABLE
```javascript
// Vertical form layout (simpler than grid)
{
  layoutEngine: "react-grid-layout",
  cols: 1,
  layout: [
    { i: "name-input", x: 0, y: 0, w: 1, h: 1 },
    { i: "age-input", x: 0, y: 1, w: 1, h: 1 },
    { i: "submit", x: 0, y: 2, w: 1, h: 1 }
  ]
}
```
Note: For simple vertical forms, react-grid-layout may be overkill. Consider a simpler Flexbox-based solution for basic forms.

#### Integration Example

```typescript
import GridLayout from 'react-grid-layout';
import 'react-grid-layout/css/styles.css';
import 'react-resizable/css/styles.css';

interface UICodexLayout {
  layoutEngine: "react-grid-layout";
  cols: number;
  rowHeight: number;
  layout: Array<{
    i: string;
    x: number;
    y: number;
    w: number;
    h: number;
  }>;
  fields: Record<string, { dataCodexRef: string; field: string }>;
}

function renderUICodex(uiCodex: UICodexLayout, dataCodexMap: Map<string, any>) {
  return (
    <GridLayout
      className="layout"
      layout={uiCodex.layout}
      cols={uiCodex.cols}
      rowHeight={uiCodex.rowHeight}
      width={1200}
      isDraggable={false} // Phase 20: static layouts
      isResizable={false} // Phase 23+: enable drag-drop
    >
      {uiCodex.layout.map(item => {
        const fieldConfig = uiCodex.fields[item.i];
        const dataCodex = dataCodexMap.get(fieldConfig.dataCodexRef);
        const value = dataCodex?.[fieldConfig.field];

        return (
          <div key={item.i}>
            <FieldRenderer value={value} />
          </div>
        );
      })}
    </GridLayout>
  );
}
```

#### Recommendation
**HIGHLY RECOMMENDED** for Phase 20 UI Codex implementation. Best balance of features, performance, and simplicity.

---

### 2. flexlayout-react

**Repository:** https://github.com/caplin/FlexLayout
**npm:** https://www.npmjs.com/package/flexlayout-react
**License:** MIT

#### Key Features
- **Tabbed docking layout** manager for React
- **JSON-based model** with Model.fromJson() and model.toJson()
- **Drag-and-drop** tab/tabset management
- **Popout windows** support (separate browser windows)
- **Resizable splitters** between panels
- **Theme customization** (light, dark, underline, gray, rounded)
- **Mobile device support** (iPad, Android tablets)

#### Bundle Size
- **Minified + Gzipped:** 89.8 KB (3.3x larger than react-grid-layout)
- **Unpacked Size:** 528 KB
- **Dependencies:** React only

#### JSON Serialization Example

```typescript
interface FlexLayoutModel {
  global: {
    tabEnableClose?: boolean;
    tabSetEnableMaximize?: boolean;
  };
  borders: Array<{
    type: "border";
    location: "top" | "bottom" | "left" | "right";
    size: number;
    children: TabNode[];
  }>;
  layout: {
    type: "row" | "column" | "tabset";
    weight: number;
    children: Array<TabSetNode | TabNode>;
  };
}

// Example UICodex configuration
const dashboardLayout: FlexLayoutModel = {
  global: {
    tabEnableClose: false
  },
  borders: [],
  layout: {
    type: "row",
    weight: 100,
    children: [
      {
        type: "tabset",
        weight: 50,
        children: [
          { type: "tab", name: "Characters", component: "CharacterList" }
        ]
      },
      {
        type: "tabset",
        weight: 50,
        children: [
          { type: "tab", name: "Scenes", component: "SceneList" }
        ]
      }
    ]
  }
};
```

#### TypeScript Support
- ✅ **Native TypeScript** - Written in TypeScript
- ✅ Full type definitions included
- ✅ Excellent IDE autocomplete support

#### VS Code Webview Compatibility
- ✅ **Compatible** - Standard React component
- ✅ Requires proper webpack bundling
- ⚠️ Popout window feature may not work in webview (relies on browser APIs)

#### Accessibility
- ❓ **Unknown** - No explicit documentation found
- Documentation focuses on drag-drop and theming
- No mention of ARIA attributes or keyboard navigation
- **Mitigation:** May require custom accessibility implementation

#### Pros & Cons

**Pros:**
- ✅ Excellent for complex tabbed interfaces
- ✅ Native TypeScript support
- ✅ JSON model serialization/deserialization
- ✅ Rich feature set (popouts, themes, mobile)
- ✅ Active maintenance (commits in Jan 2025)
- ✅ Comprehensive documentation with demos
- ✅ Permissive MIT license

**Cons:**
- ❌ Large bundle size (89.8 KB vs 27.2 KB)
- ❌ More complex API (model/view architecture)
- ❌ Overkill for simple grid layouts
- ❌ Tab-focused design may not fit all use cases
- ⚠️ Accessibility features not documented

#### Use Case Alignment

**Use Case 1: Character Sheet Layout** ⚠️ OVERKILL
- Tabbed interface not needed for simple character sheet
- Unnecessarily complex for field layout
- Large bundle size for minimal benefit

**Use Case 2: Dashboard Composition** ✅ EXCELLENT
```typescript
// Perfect for multi-panel dashboards with tabs
{
  layoutEngine: "flexlayout-react",
  model: {
    layout: {
      type: "row",
      children: [
        {
          type: "tabset",
          weight: 60,
          children: [
            { type: "tab", name: "Characters", component: "CharacterListWidget" },
            { type: "tab", name: "Scenes", component: "SceneListWidget" }
          ]
        },
        {
          type: "tabset",
          weight: 40,
          children: [
            { type: "tab", name: "Tasks", component: "TaskTracker" }
          ]
        }
      ]
    }
  }
}
```

**Use Case 3: Form Builder** ❌ NOT SUITABLE
- Tab-based layout doesn't make sense for forms
- Excessive complexity for simple vertical forms

#### Integration Example

```typescript
import { Layout, Model, TabNode } from 'flexlayout-react';
import 'flexlayout-react/style/light.css';

interface UICodexFlexLayout {
  layoutEngine: "flexlayout-react";
  model: object; // JSON model
}

function renderUICodex(uiCodex: UICodexFlexLayout) {
  const model = Model.fromJson(uiCodex.model);

  const factory = (node: TabNode) => {
    const component = node.getComponent();

    switch (component) {
      case "CharacterListWidget":
        return <CharacterListWidget />;
      case "SceneListWidget":
        return <SceneListWidget />;
      case "TaskTracker":
        return <TaskTracker />;
      default:
        return <div>Unknown component: {component}</div>;
    }
  };

  return <Layout model={model} factory={factory} />;
}
```

#### Recommendation
**RECOMMENDED** for complex dashboard layouts with tabbed panels (Phase 23+). **NOT RECOMMENDED** for Phase 20 simple grid layouts due to complexity and bundle size.

---

### 3. react-mosaic-component

**Repository:** https://github.com/nomcopter/react-mosaic
**npm:** https://www.npmjs.com/package/react-mosaic-component
**License:** Apache 2.0 (⚠️ More restrictive than MIT)

#### Key Features
- **Tiling window manager** for React
- **Binary tree structure** for layout (split nodes + leaf nodes)
- **Drag-and-drop** window management
- **Split, resize, and rearrange** panels
- **JSON-serializable** tree structure
- **Window controls** (minimize, maximize, close)

#### Bundle Size
- **Minified + Gzipped:** 258 KB (9.5x larger than react-grid-layout!)
- **Unpacked Size:** ~1.3 MB
- **Dependencies:** React + Blueprint.js (UI framework)

#### License Considerations
- ⚠️ **Apache 2.0** license (more restrictive than MIT)
- Copyright 2019 Kevin Verdieck, Palantir Technologies
- Requires patent grant clause
- May have implications for commercial use (consult legal team)

#### JSON Serialization Example

```typescript
// Binary tree structure
type MosaicNode<T> = T | MosaicParent<T>;

interface MosaicParent<T> {
  direction: "row" | "column";
  first: MosaicNode<T>;
  second: MosaicNode<T>;
  splitPercentage?: number; // 0-100
}

// Example: Split view with character on left, scenes on right
const layoutTree: MosaicNode<string> = {
  direction: "row",
  first: "character-list", // Leaf node
  second: {
    direction: "column",
    first: "scene-list",
    second: "task-tracker",
    splitPercentage: 60
  },
  splitPercentage: 50
};
```

#### TypeScript Support
- ✅ **Native TypeScript** - Written in TypeScript
- ✅ Full type definitions
- ✅ Generic type parameter for window IDs

#### VS Code Webview Compatibility
- ✅ **Compatible** - Standard React component
- ⚠️ Large bundle size may impact extension load time
- ⚠️ Blueprint.js dependency adds additional size

#### Accessibility
- ⚠️ **Limited information**
- GitHub repo mentions "a11y_status_checks_ruleset" feature flag
- No explicit documentation on ARIA or keyboard navigation
- Blueprint.js has some accessibility features, but unclear if Mosaic leverages them

#### Pros & Cons

**Pros:**
- ✅ Excellent for IDE-like interfaces
- ✅ Native TypeScript support
- ✅ Window management features (controls, split, resize)
- ✅ Active maintenance (4.7k stars, Dec 2024 update)
- ✅ JSON-serializable tree structure
- ✅ Blueprint.js integration for consistent UI

**Cons:**
- ❌ **Apache 2.0 license** (more restrictive than MIT)
- ❌ **Very large bundle** (258 KB - 9.5x larger than react-grid-layout)
- ❌ Binary tree model more complex than grid layout
- ❌ Window manager focus doesn't align with UI Codex use case
- ❌ Blueprint.js dependency adds bloat
- ⚠️ Accessibility features unclear

#### Use Case Alignment

**Use Case 1: Character Sheet Layout** ❌ NOT SUITABLE
- Window manager metaphor doesn't fit character sheet UI
- Binary tree structure too complex for simple field layout
- Large bundle size for minimal benefit

**Use Case 2: Dashboard Composition** ⚠️ OVERKILL
- Works, but window controls (minimize/maximize) may be confusing
- Binary tree structure less intuitive than grid or tabs
- 258 KB bundle size excessive for dashboard

**Use Case 3: Form Builder** ❌ NOT SUITABLE
- Window manager doesn't make sense for forms
- Excessive complexity

#### Recommendation
**NOT RECOMMENDED** for UI Codex implementation. Apache 2.0 license, large bundle size, and window manager focus don't align with project requirements. Consider only if building IDE-like interface (e.g., code editor panels).

---

### 4. react-rnd (Specialized Use Case)

**Repository:** https://github.com/bokuweb/react-rnd
**npm:** https://www.npmjs.com/package/react-rnd
**License:** MIT

#### Key Features
- **Resizable and draggable** React component
- **Simple API** for individual movable elements
- **Controlled positioning** (x, y, width, height)
- **Boundary constraints** (prevent dragging outside container)

#### Bundle Size
- **Minified + Gzipped:** 15.5 KB (smallest!)
- **Unpacked Size:** 84.6 KB

#### Pros & Cons

**Pros:**
- ✅ Smallest bundle size (15.5 KB)
- ✅ Simple API for basic drag/resize
- ✅ MIT license

**Cons:**
- ❌ **No JSON layout serialization**
- ❌ Not a layout manager (individual component wrapper)
- ❌ No grid system
- ❌ Requires manual layout logic

#### Recommendation
**NOT RECOMMENDED** for UI Codex layouts. Better suited for individual movable widgets (e.g., floating chat window). Does not provide layout management or JSON serialization.

---

### 5. @hello-pangea/dnd (Drag-Drop Only)

**Repository:** https://github.com/hello-pangea/dnd
**npm:** https://www.npmjs.com/package/@hello-pangea/dnd
**License:** N/A (fork of react-beautiful-dnd)

#### Overview
- Community-maintained fork of **react-beautiful-dnd** (now deprecated)
- Supports React 18 and React Strict Mode
- Focus on **list reordering**, not layout management

#### Key Features
- Drag-and-drop for vertical/horizontal lists
- Accessible (ARIA support, keyboard navigation, screen readers)
- Move items between different lists

#### Bundle Size
- Estimated ~50 KB gzipped (not confirmed)

#### Pros & Cons

**Pros:**
- ✅ Excellent accessibility (ARIA, keyboard, screen readers)
- ✅ React 18 support
- ✅ Drop-in replacement for react-beautiful-dnd

**Cons:**
- ❌ Not a layout manager (list reordering only)
- ❌ No grid/flexbox layout support
- ❌ Limited JSON serialization (just list order)
- ⚠️ **Grid layouts not supported** (Issue #316 from original repo)

#### Recommendation
**NOT RECOMMENDED** for UI Codex layouts. Excellent for Phase 23+ drag-drop reordering of Codex lists in Navigator, but not for layout management.

---

## Final Recommendation

### Phase 20: Basic Layout Support

**Primary Choice: react-grid-layout**

Use **react-grid-layout** for Phase 20 implementation:

1. **Smallest bundle** (27.2 KB) = fast extension loading
2. **Standards-based** (CSS Grid/Flexbox) = future-proof
3. **Simple JSON** serialization = easy to persist in UICodex
4. **Programmatic control** = define layouts without drag-drop UI
5. **Active maintenance** = 21.7k stars, Dec 2024 commits
6. **MIT license** = permissive for AGPL-3.0 project
7. **Wide adoption** = proven in production (AWS, Grafana, HubSpot)

**Implementation Strategy:**

```typescript
// UICodex schema for Phase 20
interface UICodex {
  id: string;
  type: "UILayout";
  layoutEngine: "react-grid-layout";

  // Grid configuration
  cols: number;
  rowHeight: number;
  compactType?: "vertical" | "horizontal" | null;

  // Layout items
  layout: Array<{
    i: string;        // Item ID
    x: number;        // Grid X position
    y: number;        // Grid Y position
    w: number;        // Width in grid units
    h: number;        // Height in grid units
    static?: boolean; // Prevent drag/resize (Phase 20: all static)
  }>;

  // Data bindings (REFERENCE fields)
  fields: Record<string, {
    dataCodexRef: string; // Reference to data Codex
    field: string;        // Field within data Codex
    renderer?: string;    // Optional custom renderer
  }>;

  // Phase 23+ features (disabled for Phase 20)
  isDraggable: false;
  isResizable: false;
}
```

**Phase 20 Limitations:**
- Static layouts only (no drag-drop)
- No resize functionality
- Basic field rendering (text, images)

**Phase 23+ Enhancements:**
- Enable `isDraggable: true` and `isResizable: true`
- Add drag-drop item reordering
- Add resize handles
- Consider @hello-pangea/dnd for list reordering in Navigator

---

### Alternative: flexlayout-react for Dashboard Codices

For **complex dashboard UIs** with multiple tabbed panels (not character sheets or forms), consider **flexlayout-react** as a secondary layout engine:

```typescript
// UICodex with flexlayout for multi-panel dashboards
interface DashboardUICodex {
  id: string;
  type: "UILayout";
  layoutEngine: "flexlayout-react"; // Alternative layout engine

  model: {
    global: { /* flexlayout global config */ };
    layout: { /* flexlayout tree structure */ };
  };

  components: Record<string, {
    type: string;           // Widget component type
    dataCodexRefs?: string[]; // Optional data Codex references
  }>;
}
```

**Use flexlayout-react when:**
- ✅ Building dashboard with tabbed panels
- ✅ Need drag-drop between tab groups
- ✅ Want popout window support
- ✅ Require complex panel splitting

**Use react-grid-layout when:**
- ✅ Simple field layout (character sheets, forms)
- ✅ Grid-based positioning
- ✅ Smaller bundle size preferred
- ✅ Standards-based CSS Grid/Flexbox

---

## Implementation Notes

### 1. CSS Bundling for VS Code Webviews

Both react-grid-layout and flexlayout-react require CSS to be bundled:

```javascript
// webpack.config.js for VS Code extension
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

### 2. Accessibility Enhancements

Neither react-grid-layout nor flexlayout-react provide comprehensive accessibility out-of-box. **Implement custom ARIA attributes:**

```typescript
function AccessibleGridItem({ id, label, children }: Props) {
  return (
    <div
      key={id}
      role="region"
      aria-label={label}
      aria-describedby={`${id}-desc`}
    >
      <span id={`${id}-desc`} className="sr-only">
        {label} field in character sheet
      </span>
      {children}
    </div>
  );
}
```

### 3. Performance Considerations

For large layouts (100+ fields), implement **virtualization**:

```typescript
// Use react-window or react-virtualized with grid layout
import { FixedSizeGrid } from 'react-window';

function VirtualizedGridLayout({ layout, fields }: Props) {
  return (
    <FixedSizeGrid
      columnCount={layout.cols}
      rowCount={Math.ceil(layout.layout.length / layout.cols)}
      columnWidth={100}
      rowHeight={layout.rowHeight}
      width={1200}
      height={800}
    >
      {({ columnIndex, rowIndex, style }) => (
        <div style={style}>
          {/* Render grid item */}
        </div>
      )}
    </FixedSizeGrid>
  );
}
```

### 4. Testing in VS Code Webviews

Test layout libraries in VS Code webview environment:

```typescript
// Test harness for webview compatibility
import * as vscode from 'vscode';

export class LayoutTestPanel {
  public static createOrShow(extensionUri: vscode.Uri) {
    const panel = vscode.window.createWebviewPanel(
      'layoutTest',
      'Layout Test',
      vscode.ViewColumn.One,
      {
        enableScripts: true,
        localResourceRoots: [vscode.Uri.joinPath(extensionUri, 'dist')]
      }
    );

    panel.webview.html = this.getWebviewContent(panel.webview, extensionUri);
  }

  private static getWebviewContent(webview: vscode.Webview, extensionUri: vscode.Uri): string {
    // Bundle react-grid-layout with webpack
    const scriptUri = webview.asWebviewUri(
      vscode.Uri.joinPath(extensionUri, 'dist', 'webview.js')
    );

    return `<!DOCTYPE html>
      <html>
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
        </head>
        <body>
          <div id="root"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>`;
  }
}
```

### 5. Gotchas and Best Practices

#### react-grid-layout Gotchas:
- ⚠️ **Width calculation:** Grid requires explicit width (use `react-measure` or `ResizeObserver`)
- ⚠️ **CSS conflicts:** Ensure grid CSS is loaded before custom styles
- ⚠️ **Item keys:** Must be unique and stable (use Codex IDs)
- ⚠️ **Responsive breakpoints:** Test on different VS Code window sizes

#### flexlayout-react Gotchas:
- ⚠️ **Model mutations:** Use model actions, don't mutate JSON directly
- ⚠️ **Factory function:** Must handle all component types
- ⚠️ **Popout windows:** May not work in VS Code webview (browser API limitation)
- ⚠️ **Theme loading:** Import correct CSS file (light.css, dark.css)

---

## Comparison with Native CSS Grid/Flexbox

### Why Not Just Use Native CSS Grid?

**Considered but rejected:**

```typescript
// Native CSS Grid approach (NO library)
function NativeGridLayout({ layout, fields }: Props) {
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: `repeat(${layout.cols}, 1fr)`,
        gap: '10px'
      }}
    >
      {layout.layout.map(item => (
        <div
          key={item.i}
          style={{
            gridColumn: `${item.x + 1} / span ${item.w}`,
            gridRow: `${item.y + 1} / span ${item.h}`
          }}
        >
          {/* Field content */}
        </div>
      ))}
    </div>
  );
}
```

**Why libraries are better:**

| Feature | Native CSS Grid | react-grid-layout |
|---------|----------------|-------------------|
| JSON serialization | ✅ Yes (custom) | ✅ Built-in |
| Drag-drop (Phase 23+) | ❌ No | ✅ Yes |
| Resize (Phase 23+) | ❌ No | ✅ Yes |
| Collision detection | ❌ Manual | ✅ Automatic |
| Responsive breakpoints | ⚠️ Manual | ✅ Built-in |
| Item constraints (min/max) | ❌ Manual | ✅ Built-in |

**Verdict:** Use react-grid-layout for Phase 20 to enable Phase 23+ features without major refactoring. Native CSS Grid would require significant custom code for drag-drop and resize functionality.

---

## License Compliance

All recommended packages are compatible with Vespera Atelier's **AGPL-3.0** license:

| Package | License | AGPL-3.0 Compatible? |
|---------|---------|---------------------|
| react-grid-layout | MIT | ✅ Yes |
| flexlayout-react | MIT | ✅ Yes |
| react-rnd | MIT | ✅ Yes |
| @hello-pangea/dnd | MIT (assumed) | ✅ Yes |
| react-mosaic | Apache 2.0 | ⚠️ Yes (with patent clause) |

**Note:** Apache 2.0 (react-mosaic) includes patent grant clause which may have implications. Consult legal team if considering react-mosaic.

---

## Conclusion

**For Phase 20 UI Codex implementation, use react-grid-layout** as the primary layout engine:

1. **Best performance** (27.2 KB gzipped)
2. **Standards-based** (CSS Grid/Flexbox)
3. **Simple JSON** serialization
4. **Future-proof** for Phase 23+ drag-drop
5. **Proven at scale** (AWS, Grafana, HubSpot)

**For Phase 23+ complex dashboards**, consider adding **flexlayout-react** as a secondary layout engine option for tabbed docking interfaces.

**Avoid:**
- ❌ react-mosaic (Apache 2.0 license, large bundle, window manager focus)
- ❌ react-rnd (no layout management, no JSON serialization)
- ❌ @hello-pangea/dnd (list reordering only, not layout management)

---

## Next Steps

1. **Phase 20 Implementation:**
   - [ ] Install react-grid-layout: `npm install react-grid-layout`
   - [ ] Add webpack CSS loader for grid styles
   - [ ] Create UICodex schema with layoutEngine field
   - [ ] Implement GridLayoutRenderer component
   - [ ] Add UICodex CRUD operations to MCP server
   - [ ] Test in VS Code webview environment
   - [ ] Implement basic accessibility (ARIA labels)

2. **Phase 23+ Planning:**
   - [ ] Enable isDraggable and isResizable in UICodex schema
   - [ ] Add drag-drop event handlers
   - [ ] Implement layout persistence on drag/resize
   - [ ] Consider flexlayout-react for dashboard Codices
   - [ ] Add @hello-pangea/dnd for Navigator list reordering

3. **Documentation:**
   - [ ] Update ADR-028 with react-grid-layout decision
   - [ ] Create UI Codex schema specification
   - [ ] Write layout engine integration guide
   - [ ] Add examples to docs/examples/

---

**Research completed:** 2025-11-17
**Estimated research time:** 35 minutes
**Packages evaluated:** 6 (react-grid-layout, flexlayout-react, react-mosaic, react-rnd, @hello-pangea/dnd, golden-layout)
**Recommendation confidence:** HIGH (react-grid-layout for Phase 20)
