# Context Handover - Penpot Plugin Project

**Date**: 2025-09-30
**Branch**: `feat/penpot-bridge`
**Status**: Phase 0 Complete, Ready for Phase 1

---

## Executive Summary

We're building an **accessibility-focused Penpot plugin** that enables keyboard-driven UI component creation. The plugin uses a chatbot interface for command-based design, specifically to help users with motor difficulties who struggle with precise mouse clicking.

**Inspiration**: FFXI's numpad-centric UI design for one-handed operation.

**Approach**: Walking skeleton - build ONE complete error dialog template end-to-end before expanding.

---

## What's Been Completed ✅

### Phase 0: Shared Utilities Foundation (COMPLETE)

**Total**: 44 files, 12,888 lines of production-ready TypeScript

#### 1. Architecture Documentation
- **File**: `/docs/technical/PENPOT_PLUGIN_ARCHITECTURE.md` (1,800 lines)
- Comprehensive research findings (3,400+ lines of code analyzed)
- Accessibility design rationale (keyboard-driven, numpad support)
- Esc menu system (DOS/game-inspired)
- FFXI-inspired one-handed operation patterns
- Complete implementation plan with time estimates

#### 2. Shared TypeScript Utilities Package
- **Location**: `/packages/vespera-utilities/typescript-shared/`
- **Package**: `@vespera/typescript-shared`
- **Status**: ✅ Compiles without errors, ready for use

**Modules Implemented**:

1. **Error Handling** (4 files, 217+ lines)
   - 12 specialized error classes with categorization
   - Strategy-based error handler with retry logic
   - Exponential backoff with jitter
   - Standard error response format

2. **Validation** (4 files, Zod schemas)
   - Penpot types (Fill, Stroke, Shadow, all shape types)
   - Component templates (recursive layers, style definitions)
   - MCP messages (request/response, tools, resources)
   - Full type inference via `z.infer`

3. **Logging** (6 files, 1,318 lines)
   - Structured logging with context inheritance
   - Multiple transports (Console, File with rotation, Buffered)
   - Multiple formatters (JSON, Pretty with colors, Compact)
   - Child loggers with context

4. **Circuit Breaker** (4 files)
   - State machine (Closed → Open → HalfOpen → Closed)
   - Timeout support, exponential backoff
   - 5 predefined policies (aggressive, normal, lenient, strict, fastRecovery)
   - Stats tracking (failure rates, request counts)

5. **Performance Metrics** (6 files)
   - High-resolution timing (`performance.now()`)
   - Memory tracking, RAII-style timer
   - Statistical analysis (percentiles, outliers)
   - Size-limited storage with auto-cleanup

6. **Lifecycle Management** (4 files)
   - EnhancedDisposable interface
   - DisposalManager with hooks
   - ResourceTracker (memory leak detection)

#### 3. Git Commits
- ✅ 3 commits on `feat/penpot-bridge` branch
- All changes properly committed
- Clean working directory (except untracked `/research/` folder)

---

## What's Next: Phase 1 - Walking Skeleton 🎯

**Goal**: Build ONE complete error dialog template end-to-end to validate architecture.

**Estimated Time**: ~8 hours

### Tasks (In Order)

**Task 1: Set up React Plugin Project** (~2-3 hours)
```bash
cd /home/aya/Development/vespera-atelier/packages/vespera-penpot-bridge
mkdir plugin
cp -r /home/aya/Development/vespera-atelier/research/penpot-plugins/plugin-examples/react-example-plugin/* plugin/
cd plugin
npm install
npm install @vespera/typescript-shared
```

**Project Structure**:
```
plugin/
├── src/
│   ├── shared/          # NEW: Message protocol types
│   │   ├── messages.ts
│   │   └── templates.ts
│   ├── plugin/          # Backend (Penpot API access)
│   │   ├── plugin.ts
│   │   └── templates/
│   │       └── error-dialog.ts
│   ├── ui/              # Frontend (React)
│   │   ├── App.tsx
│   │   ├── state/
│   │   │   ├── context.tsx
│   │   │   └── reducer.ts
│   │   └── components/
│   │       ├── ChatInterface.tsx
│   │       ├── MessageList.tsx
│   │       └── MessageInput.tsx
│   ├── main.tsx
│   └── index.css
├── manifest.json
├── package.json
└── vite.config.ts
```

**Task 2: Define Error Dialog Template** (~1 hour)

Create `src/shared/templates.ts`:
```typescript
export interface ErrorDialogConfig {
  title: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  dismissible: boolean;
}

export const ERROR_DIALOG_TEMPLATE = {
  id: 'error-dialog-v1',
  name: 'Error Dialog',
  category: 'dialog',
  config: { width: 400, height: 250 },
  // ... layer definitions
};
```

**Task 3: Implement Error Dialog Creation** (~2-3 hours)

Create `src/plugin/templates/error-dialog.ts`:
```typescript
import { ErrorDialogConfig } from '../shared/templates';

export function createErrorDialog(config: ErrorDialogConfig): void {
  const board = penpot.createBoard();
  board.resize(400, 250);

  // Create background, title, message, buttons
  // Use Penpot API: createRectangle(), createText(), appendChild()
  // Center on viewport using penpot.viewport.center
}
```

**Task 4: Build Minimal Chat UI** (~2-3 hours)

Create `src/ui/App.tsx`:
```typescript
function App() {
  const [state, dispatch] = useReducer(pluginReducer, initialState);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    // Simple keyword matching
    if (input.includes('create error dialog')) {
      parent.postMessage({ type: 'create-error-dialog', config: {...} }, '*');
    }
  };

  return (
    <div className="chat-container">
      <MessageList messages={state.messages} />
      <MessageInput value={input} onChange={setInput} onSubmit={handleSubmit} />
    </div>
  );
}
```

**Task 5: Test End-to-End** (~1-2 hours)
```bash
npm run dev
# Open Penpot (http://localhost:9001)
# Press Ctrl+Alt+P
# Load: http://localhost:4402/manifest.json
# Type: "create error dialog"
# Verify: Dialog appears centered on viewport
```

**Success Criteria**:
- [ ] Plugin loads without errors
- [ ] Chat interface appears
- [ ] Can type "create error dialog"
- [ ] Error dialog is created in Penpot
- [ ] Dialog is centered on viewport
- [ ] Native undo (Ctrl+Z) removes dialog
- [ ] Theme switching works

---

## Bindery Task Tracking

**Main Task**: `a288afdf-3648-4a93-aeb6-875c70710c6f`
**Title**: "Penpot UI Generator Plugin - Accessibility Tool (Walking Skeleton)"

**Subtasks Created**:
1. Phase 0: Extract Shared Utilities (✅ COMPLETE)
2. Phase 1: Walking Skeleton - ONE Working Template (🔜 NEXT)
3. Phase 2: Template Expansion (4 more templates)
4. Phase 3: Accessibility & Polish (Esc menu, numpad support)
5. Phase 4: MCP Integration (Future)

**Additional Task**: `9c3430a4-2f61-40cb-a877-32e0d3724295`
**Title**: "Implement Esc Menu System and Numpad Support"
**Status**: Created, will be implemented in Phase 3

**View Tasks**:
```bash
# List all tasks
curl http://localhost:3000/api/tasks | jq

# Get specific task
curl http://localhost:3000/api/tasks/a288afdf-3648-4a93-aeb6-875c70710c6f | jq
```

---

## Key Design Decisions

### 1. Accessibility-Focused Design

**Context**: User has difficulty with precise mouse clicking, proficient with keyboard.

**Design Principles**:
- Keyboard-first interface (text commands via chat)
- Esc menu system (DOS/CLI-inspired, not just close)
- Numpad-centric (FFXI-inspired one-handed operation)
- No mouse required for any operation

**Esc Menu Structure** (Phase 3):
```
┌─────────────────────────────────────┐
│         ESC MENU                    │
├─────────────────────────────────────┤
│  1. Template Gallery                │
│  2. Command History                 │
│  3. Settings                        │
│  4. Keyboard Shortcuts              │
│  5. Help                            │
│  6. About                           │
│                                     │
│  0. Close Plugin                    │
│                                     │
│  Press Esc again to close menu      │
└─────────────────────────────────────┘
```

**Numpad Mappings** (Phase 3):
- `Numpad 0`: Template selector (tab-like cycling)
- `Numpad Enter`: Confirm selections
- `Numpad +`: Context menu (like FFXI inventory sorting)
- `Numpad .`: Alternative Esc key
- `Numpad 9/3`: Page Up/Down
- `Numpad 1-6`: Quick menu selections

### 2. Walking Skeleton Approach

**Philosophy**: Build systems, not games.

**Order**:
1. Extract shared utilities FIRST ✅
2. Build ONE complete template end-to-end
3. Validate architecture works
4. Then expand horizontally

### 3. MCP Integration Scope

**Phase 1-3**: No runtime MCP integration (browser sandbox limitation)

**Phase 4** (Future): Optional WebSocket bridge for external MCP servers

**Current**: MCP used for build-time only (Claude Code analyzing designs, generating templates)

---

## Important File Locations

### Documentation
- **Architecture**: `/docs/technical/PENPOT_PLUGIN_ARCHITECTURE.md`
- **This Handover**: `/docs/HANDOVER.md`
- **Utilities README**: `/packages/vespera-utilities/typescript-shared/README.md`
- **Error Handling**: `/packages/vespera-utilities/typescript-shared/docs/ERROR_HANDLING.md`
- **Circuit Breaker**: `/packages/vespera-utilities/typescript-shared/docs/CIRCUIT_BREAKER.md`

### Research
- **Penpot Research**: `/research/penpot-plugins/RESEARCH_REPORT.md`
- **React Template**: `/research/penpot-plugins/plugin-examples/react-example-plugin/`
- **Plugin Samples**: `/research/penpot-plugins/penpot-plugins-samples/`

### Shared Utilities
- **Package**: `/packages/vespera-utilities/typescript-shared/`
- **Main Entry**: `src/index.ts`
- **Error Handling**: `src/error-handling/`
- **Validation**: `src/validation/schemas/`
- **Logging**: `src/logging/`
- **Circuit Breaker**: `src/circuit-breaker/`
- **Metrics**: `src/metrics/`
- **Lifecycle**: `src/lifecycle/`

### Penpot Bridge (MCP Server)
- **Package**: `/packages/vespera-penpot-bridge/`
- **API Client**: `src/penpot-api/client.ts`
- **Types**: `src/penpot-api/types.ts`

---

## Environment Setup

### Prerequisites
- Node.js 20+
- Local Penpot instance running on `http://localhost:9001`
- Penpot credentials in `.env` file

### Penpot Local Instance
```bash
# Location: /home/aya/Development/Penpot
cd /home/aya/Development/Penpot
docker-compose up

# Access: http://localhost:9001
# Credentials in password manager
```

### Build Utilities
```bash
cd /home/aya/Development/vespera-atelier/packages/vespera-utilities/typescript-shared
npm install
npm run build
# Output: dist/
```

### MCP Server (if needed)
```bash
# Already configured in Claude Code
claude mcp list | grep vespera-penpot-bridge

# Manual testing
cd /home/aya/Development/vespera-atelier/packages/vespera-penpot-bridge
npm run build
node dist/mcp-server.js
```

---

## Common Commands

### Development
```bash
# Build utilities
cd packages/vespera-utilities/typescript-shared && npm run build

# Start plugin dev server (Phase 1)
cd packages/vespera-penpot-bridge/plugin && npm run dev

# Watch mode
npm run watch
```

### Testing
```bash
# Test logging
cd packages/vespera-utilities/typescript-shared && npx ts-node test-logging.ts

# Load plugin in Penpot
# 1. Open http://localhost:9001
# 2. Press Ctrl+Alt+P
# 3. Enter: http://localhost:4402/manifest.json
```

### Git
```bash
# Current branch
git branch --show-current
# Output: feat/penpot-bridge

# Recent commits
git log --oneline -5

# Status
git status
```

---

## Known Issues / Notes

1. **Research folder untracked**: `/research/` contains cloned repositories and should remain untracked
2. **Types module empty**: `/packages/vespera-utilities/typescript-shared/src/types/` only has placeholder - will be populated as needed
3. **Technical debt**: 1,019 TODOs/FIXMEs in codebase (system-wide, not from our work)
4. **MCP server**: Uses cookie-based authentication for Penpot 2.x, Transit-JS for data format

---

## Quick Start for New Context

### Step 1: Orient Yourself
```bash
cd /home/aya/Development/vespera-atelier
git status
git log --oneline -5
```

### Step 2: Read Key Documentation
- Read this file: `/docs/HANDOVER.md`
- Skim architecture: `/docs/technical/PENPOT_PLUGIN_ARCHITECTURE.md`
- Review Bindery tasks: Check task `a288afdf-3648-4a93-aeb6-875c70710c6f`

### Step 3: Verify Setup
```bash
# Build utilities
cd packages/vespera-utilities/typescript-shared
npm install
npm run build

# Check Penpot is running
curl http://localhost:9001/api/rpc/command/get-all-projects \
  -H "Content-Type: application/transit+json" \
  -d '["^ "]'
```

### Step 4: Start Phase 1
Follow "What's Next: Phase 1" section above.

---

## Success Metrics for Phase 1

**Phase 1 is complete when**:
1. Plugin loads in Penpot without errors
2. User can type "create error dialog" in chat
3. Error dialog appears centered on Penpot canvas
4. Dialog has: background, title, message, OK button
5. Native undo (Ctrl+Z) removes the dialog
6. Light/dark theme switching works

**After Phase 1**: Expand to 4 more templates (button, form, card, success dialog)

---

## Context from User

**User's Accessibility Need**:
> "This is a case of 'building a tool to build a tool', yes, but I've spent over a year learning coding through AI hitting a wall every time I get to UI components... think of it as a disability aid. Precise clicking is hard for me, but I'm decent at typing and other keyboard tasks, so I'm trying to create a workaround."

**User's Favorite Game UI**: Final Fantasy XI (FFXI)
- Entire MMO playable via numpad + arrow keys
- Numpad 0 = Tab (target cycling)
- Numpad + = Context menu (inventory sorting)
- Numpad Enter = Select
- Numpad . = Esc
- Minimal hand movement, one-handed operation

This context is **critical** - the plugin is an accessibility tool, not just a convenience feature.

---

## Troubleshooting

### TypeScript Errors
```bash
# Check compilation
npm run build

# Common issue: isolatedModules requires "export type"
# Fix: Separate type exports from value exports
```

### Penpot API Issues
```bash
# Check local Penpot is running
curl http://localhost:9001

# Check authentication
# Credentials in: packages/vespera-penpot-bridge/.env
```

### MCP Server Issues
```bash
# Reconnect MCP
# In Claude Code: /mcp reconnect vespera-scriptorium

# Check logs
tail -f ~/.local/state/claude/logs/mcp-server.log
```

---

## Final Notes

- **Branch**: `feat/penpot-bridge` (don't merge to main yet)
- **Clean State**: All Phase 0 work committed
- **Ready**: Can start Phase 1 immediately
- **Estimated Phase 1 Time**: ~8 hours
- **User's Next Availability**: After vet appointment (kitten neutering)

**Good luck with Phase 1!** 🚀

Remember: Build ONE complete template first. Don't expand horizontally until the walking skeleton works end-to-end.

---

**Document Version**: 1.0
**Last Updated**: 2025-09-30
**Created By**: Claude Code Session (context about to rotate)