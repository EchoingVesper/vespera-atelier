# Vespera Atelier - Development Handover

**Last Updated:** 2025-10-01
**Current Focus:** Penpot UI Component Template Development

---

## 🎯 Current Mission

Building a comprehensive UI component library in Penpot to design the interfaces for:
- **Obsidian Plugin** (Vespera Scriptorium) - Three-panel creative workspace
- **VS Code Extension** (Vespera Forge) - Native task orchestration UI

**Strategy:** Design-first approach using Penpot templates, then convert to TypeScript implementations.

---

## 📋 Active Project: Penpot UI Template Library

### What We're Building

A Penpot plugin that generates UI component templates through a keyboard-driven workflow (Esc menu + numpad shortcuts). These templates create design mockups that will guide TypeScript implementation for both Obsidian and VS Code plugins.

### Current Status

**✅ Completed:**
- Phase 1-3: Template gallery with Esc menu system ✓
- Keyboard navigation (Arrow keys, Enter, Numpad 1-6) ✓
- Auto-scroll in gallery ✓
- Message Bubble template (user/assistant/system variants) ✓
- Text wrapping fixes for message bubbles ✓

**🚧 In Progress:**
- Phase 1: Chat UI Foundation (Week 1)
  - [x] Message Bubble template
  - [ ] Provider Selector template
  - [ ] Status Indicator template

**📅 Upcoming Phases:**
- Phase 2: Navigation Components (Week 2)
  - Tree Node, Tag/Badge, Quick Action Card templates
- Phase 3: Complex Organisms (Week 3)
  - Message Thread, Config Panel, Navigation Pane templates
- Phase 4: Layout Templates (Week 4)
  - Three-Panel Layout, Chat Window, Split View templates

### Architecture References

**Primary Documentation:**
- `/docs/technical/UI-Architecture-Three-Panel-Design.md` - Obsidian three-panel design (Navigator + Editor + AI Chat)
- `/plugins/VSCode/vespera-forge/docs/architecture/ui-components.md` - VS Code native UI components

**Key Architectural Concepts:**

**Obsidian Three-Panel Layout:**
```
┌─────────────────┬─────────────────────────┬─────────────────┐
│     LEFT        │        CENTER           │     RIGHT       │
│ Codex Navigator │   Main Editor Area      │   AI Chat       │
│                 │                         │   Interface     │
│  📁 Projects    │  Task Manager View      │  💬 Claude      │
│  ├─ Novel       │  Character Editor       │  Assistant      │
│  ├─ 📋 Tasks    │  Scene Planner          │                 │
│  └─ 🎵 Music    │  Context-aware views    │  Quick Actions  │
└─────────────────┴─────────────────────────┴─────────────────┘
```

**VS Code Component Hierarchy:**
- Task Tree View (TreeDataProvider)
- Task Dashboard WebView (interactive metrics)
- Status Bar Integration (connection status + task counts)
- Context menus and quick actions

### Template Development Plan

**Phase 1: Chat UI Foundation** *(Current Focus)*

1. **Message Bubble** ✓ (Completed)
   - Avatar circle with role initial
   - Content area with dynamic height
   - Timestamp support
   - Role variants: user (blue), assistant (gray), system (amber)

2. **Provider Selector** (Next)
   - Dropdown with LLM provider icons (Claude, GPT-4, etc.)
   - Connection status indicator
   - Model selection display
   - Quick switch affordance

3. **Status Indicator**
   - Connected/disconnected/error states
   - Animated connection spinner
   - Color-coded status (green/yellow/red)

**Phase 2: Navigation Components**

4. **Tree Node Template**
   - Icon + label + expand/collapse indicator
   - Indentation support for hierarchy
   - Drag-drop visual states
   - Selected/hover/active states

5. **Tag/Badge Template**
   - Rounded pill design
   - Color variants (status, category, priority)
   - Removable variant (with X button)
   - Size variants (small, medium, large)

6. **Quick Action Card Template**
   - Icon + title + description layout
   - Keyboard shortcut indicator
   - Hover/active states
   - Grid-friendly design

**Phase 3: Complex Organisms**

7. **Message Thread Template**
   - Stack of message bubbles
   - Date separator components
   - Loading/typing indicators
   - Scroll-to-bottom affordance

8. **Config Panel Template**
   - Grouped form fields (labels + inputs)
   - Collapsible sections with headers
   - Validation state indicators
   - Save/cancel action bar

9. **Navigation Pane Template**
   - Tree structure container
   - Search/filter bar
   - View mode toggle (list/grid/tree)
   - Breadcrumb navigation

**Phase 4: Layout Templates**

10. **Three-Panel Layout Template**
    - Resizable left/center/right panels
    - Panel dividers with drag handles
    - Minimum/maximum width constraints
    - Collapse/expand states

11. **Chat Window Layout Template**
    - Message area with scroll
    - Input field with send button
    - Provider selector integration
    - Settings flyout panel

12. **Split View Template**
    - Side-by-side panes
    - Context relationship indicators
    - Synchronized scrolling markers
    - Focus management visuals

---

## 🛠️ Technical Stack

### Penpot Plugin
- **Framework:** React 19 + TypeScript
- **Build:** Vite with custom SES compatibility plugin
- **API:** Penpot Plugin API (shape creation, boards, styling)
- **UI Pattern:** Template gallery with keyboard-driven workflow

### Plugin Architecture
```
packages/vespera-penpot-bridge/plugin/
├── src/
│   ├── plugin/
│   │   ├── plugin.ts              # Main plugin backend
│   │   └── templates/
│   │       ├── factory.ts         # Template creation dispatcher
│   │       ├── message-bubble.ts  # Chat message bubble ✓
│   │       ├── button.ts          # Button variants ✓
│   │       ├── card.ts            # Info card ✓
│   │       ├── input-field.ts     # Form input ✓
│   │       └── error-dialog.ts    # Dialog templates ✓
│   ├── ui/
│   │   ├── App.tsx                # React root
│   │   ├── components/
│   │   │   ├── TemplateGallery.tsx  # Esc menu system ✓
│   │   │   └── ChatInterface.tsx    # Chat UI (unused)
│   │   └── state/
│   │       └── reducer.ts         # State management
│   └── shared/
│       ├── templates.ts           # Template registry + types
│       └── messages.ts            # Plugin ↔ UI messaging
```

### Template Creation Pattern

Each template follows this structure:

```typescript
// 1. Define configuration interface
export interface TemplateConfig {
  param1: string;
  param2?: number;
  variant?: 'type1' | 'type2';
}

// 2. Implement creation function
export function createTemplate(config: TemplateConfig): string {
  const { param1, param2 = defaultValue, variant = 'type1' } = config;

  // Calculate dimensions
  const width = calculateWidth(config);
  const height = calculateHeight(config);

  // Create board (container)
  const board = penpot.createBoard();
  board.name = `Template - ${param1}`;
  board.resize(width, height);

  // Create shapes (background, text, etc.)
  const background = penpot.createRectangle();
  const text = penpot.createText(param1);

  // Style shapes
  background.fills = [{ fillColor: '#COLOR', fillOpacity: 1 }];
  text.fontFamily = 'Inter';

  // Position shapes
  text.x = padding;
  text.y = padding;

  // Add to board (LAST appended = BOTTOM layer)
  board.appendChild(text);
  board.appendChild(background);

  // Center on viewport
  const viewport = penpot.viewport;
  if (viewport) {
    board.x = viewport.center.x - width / 2;
    board.y = viewport.center.y - height / 2;
  }

  return board.id;
}
```

**Critical Penpot API Details:**
- **Z-ordering:** First appended = top layer (opposite of DOM!)
- **Text sizing:** Font size as string ('14'), not number
- **Fills/Strokes:** Array of style objects
- **Positioning:** Absolute x/y coordinates

---

## 🎨 Design System

### Color Palette

**Message Roles:**
- User: `#3B82F6` (blue) - sent messages
- Assistant: `#F3F4F6` (gray) - AI responses
- System: `#FEF3C7` (amber) - notifications

**Status Colors:**
- Success: `#10B981` (green)
- Warning: `#F59E0B` (amber)
- Error: `#EF4444` (red)
- Info: `#3B82F6` (blue)

**Neutral Palette:**
- Background: `#FFFFFF` (light), `#1F2937` (dark)
- Text: `#111827` (primary), `#6B7280` (secondary)
- Border: `#E5E7EB` (light), `#374151` (dark)

### Typography
- **Font Family:** Inter (fallback: system fonts)
- **Sizes:** 11px (small), 12px (caption), 14px (body), 16px (subhead), 18px (heading)
- **Weights:** 400 (regular), 600 (semibold), 700 (bold)

### Spacing
- **Base unit:** 4px
- **Common values:** 4px, 8px, 12px, 16px, 20px, 24px
- **Padding defaults:** 12px (compact), 16px (normal), 20px (comfortable)

### Border Radius
- **Compact:** 4px (inputs, small buttons)
- **Normal:** 6px-8px (cards, buttons)
- **Rounded:** 12px (message bubbles, panels)
- **Circular:** 50% (avatars, icons)

---

## 🚀 Development Workflow

### Adding a New Template

1. **Create template file:**
   ```bash
   touch packages/vespera-penpot-bridge/plugin/src/plugin/templates/my-template.ts
   ```

2. **Define interface in `shared/templates.ts`:**
   ```typescript
   export interface MyTemplateConfig {
     title: string;
     variant?: 'type1' | 'type2';
   }
   ```

3. **Add to TEMPLATE_REGISTRY:**
   ```typescript
   'my-template': {
     id: 'my-template',
     name: 'My Template',
     category: 'chat',
     description: 'Description here',
     config: MY_TEMPLATE_DIMENSIONS,
   }
   ```

4. **Implement creation function:**
   - Follow pattern above
   - Use design system colors/spacing
   - Support default values
   - Center on viewport

5. **Register in factory.ts:**
   ```typescript
   import { createMyTemplate } from './my-template';
   // ...
   case 'my-template':
     return createMyTemplate(config as MyTemplateConfig);
   ```

6. **Test:**
   - Build: `npm run build`
   - Reload Penpot plugin
   - Press Esc → select template
   - Verify rendering and positioning

### Testing Checklist

- [ ] Template appears in gallery
- [ ] Numpad shortcut works (if template is in first 6)
- [ ] All shapes render correctly
- [ ] Z-order is correct (text on top, background on bottom)
- [ ] Text wraps properly within containers
- [ ] Colors match design system
- [ ] Spacing uses 4px grid
- [ ] Component centers on viewport
- [ ] Default values work when invoked from gallery

---

## 🔄 Git Workflow

### Commit Pattern
```
<type>(<scope>): <subject>

<body>

🤖 Generated with Claude Code

Co-Authored-By: Claude <noreply@anthropic.com>
```

**Types:** feat, fix, refactor, docs, style, test, chore
**Scopes:** penpot-plugin, obsidian-plugin, vscode-extension, bindery-server

### Recent Commits
- `feat(penpot-plugin): Add Message Bubble template (Phase 1)` (8fbd229)
- `fix(penpot-plugin): Add default values to Message Bubble template` (3c5a4b2)
- `fix(penpot-plugin): Improve message bubble text wrapping` (d371417)

### Branch Strategy
- **Main branch:** `main`
- **Feature branch:** `feat/penpot-bridge` *(current)*
- **Archive:** Previous handover in `docs/archive/HANDOVER-2025-10-01-penpot-phase3.md`

---

## 📍 Current State Summary

**Working:**
- Penpot plugin dev server on port 4402
- Template gallery with 6 templates (dialogs, button, input, card, message bubble)
- Keyboard navigation (Esc, arrows, Enter, numpad)
- Build system with TypeScript + Vite

**Next Steps:**
1. Create Provider Selector template
2. Create Status Indicator template
3. Test message bubble text wrapping improvement
4. Begin Phase 2 navigation components

**Known Issues:**
- Text wrapping estimation could be more precise (acceptable for now)
- Undo granularity in Penpot (platform limitation, won't fix)
- Multiple dev servers running in background (can clean up)

---

## 💡 Key Learnings

**Penpot API Gotchas:**
- appendChild order is REVERSED from DOM (first = top)
- Font sizes must be strings, not numbers
- Text elements need explicit width for wrapping
- Character-per-line estimation needs to be conservative (6px/char, not 8px)

**Workflow Insights:**
- Design-first approach prevents TypeScript refactoring hell
- Numpad shortcuts enable one-handed operation (FFXI-inspired)
- Template gallery scales well (auto-scroll, categories)
- Atomic design progression (atoms → molecules → organisms → templates)

---

## 📚 Resources

**Documentation:**
- `/docs/technical/UI-Architecture-Three-Panel-Design.md` - Obsidian UI architecture
- `/plugins/VSCode/vespera-forge/docs/architecture/ui-components.md` - VS Code components
- `/packages/vespera-penpot-bridge/plugin/README.md` - Plugin development guide

**External:**
- [Penpot Plugin API](https://penpot-plugins-api-doc.pages.dev/)
- [Penpot Plugin Examples](https://github.com/penpot/penpot-plugins-samples)
- [React 19 Documentation](https://react.dev/)

---

**End of handover. Good luck, and may your templates render true! 🎨**
