# Penpot UI Generator Plugin - Architecture & Research Findings

**Date**: 2025-09-30
**Status**: Pre-implementation architectural analysis
**Purpose**: Accessibility-focused tool for keyboard-driven UI component creation

---

## Executive Summary

This document captures the comprehensive architectural analysis and research findings for the Vespera Penpot Plugin project. The plugin is designed as an **accessibility aid** to enable keyboard-driven UI component creation in Penpot, addressing difficulties with precise mouse clicking.

### Core Philosophy

> "Build systems, not games" - Extract reusable utilities first, then build plugin-specific functionality.

### Key Decisions

1. **Walking Skeleton Approach**: Build one complete template end-to-end before expanding
2. **Shared Utilities First**: Extract reusable components to `vespera-utilities` before plugin development
3. **Accessibility-Focused**: Keyboard-driven chatbot interface for command-based UI creation
4. **MCP Integration Phase 2/3**: Focus on core functionality first, add external MCP servers later
5. **Browser-Only**: No runtime MCP integration (browser sandbox limitation)

---

## Research Findings

### Comprehensive Codebase Analysis

**Agent Research Summary** (3,400+ lines of code analyzed):
- **vespera-utilities** (Rust): 90+ production-ready reusable components
- **vespera-scriptorium** (Python): Pydantic validation patterns
- **Obsidian Plugin** (TypeScript): MCP client patterns, server lifecycle management
- **VS Code Extension** (TypeScript): Error handling strategies, resource lifecycle
- **Penpot Bridge** (TypeScript): MCP server patterns, Transit-JS integration

### Critical Discoveries

#### 1. Zod Already Installed But Unused

**Location**: `/packages/vespera-penpot-bridge/package.json`

**Status**: Zod v3.23.8 is declared as dependency but no schemas exist

**Gap**: All tool inputs and Penpot API responses lack runtime validation

**Action Required**: Create comprehensive Zod schemas before building plugin

#### 2. Bindery Template System (Revolutionary)

**Location**: `/packages/vespera-utilities/vespera-bindery/`

**Key Files**:
- `codex-format-spec.json5` (474 lines)
- `templates/vespera.task.template.json5` (753 lines)

**Philosophy**: Everything is template-driven via JSON5, no hardcoded content types

**Features**:
- Template inheritance and mixins
- CRDT layer specification per field
- UI hints and automation rules co-located
- Field validation and constraints
- Dynamic content type registration

**Applicability**: Can be adapted for Penpot component templates

#### 3. Production-Ready Utilities in Rust

**vespera-bindery** (Rust → TypeScript conversion needed):

| Component | Lines | Priority | Use Case |
|-----------|-------|----------|----------|
| Error handling system | 217 | 🔥 Critical | Categorization, retry logic, recovery patterns |
| Type definitions | 680 | 🔥 Critical | Template fields, validation, relationships |
| Task management | 144 | 🔥 Critical | Status tracking, priorities, hierarchies |
| Circuit breaker | ~100 | ⚠️ Important | Resilient API calls |
| Performance metrics | ~150 | ⚠️ Important | Plugin health monitoring |
| Observability | 281 | 💡 Optional | Logging, tracing, audit trails |

**Action Required**: Create TypeScript equivalents in shared utilities package

#### 4. MCP Client Patterns (Obsidian Plugin)

**Location**: `/plugins/Obsidian/vespera-scriptorium/src/mcp/`

**Reusable Patterns**:
- Transport abstraction (WebSocket, HTTP/SSE, stdio)
- Request/response handling with timeout
- Event-based architecture with EventEmitter
- Connection lifecycle management
- Graceful error handling

**Action Required**: Extract `BaseMCPClient` to shared utilities

#### 5. Error Handling Strategies (VS Code Extension)

**Location**: `/plugins/VSCode/vespera-forge/src/core/error-handling/`

**Sophisticated Pattern**:
```typescript
interface ErrorHandlingStrategy {
  shouldLog: boolean;
  shouldNotifyUser: boolean;
  shouldThrow: boolean;
  shouldRetry: boolean;
  maxRetries?: number;
  retryDelay?: number;
}
```

**Features**:
- Per-error-code handling strategies
- Configurable retry logic with exponential backoff
- User notification management
- Telemetry integration

**Action Required**: Extract to shared utilities as `BaseErrorHandler`

---

## Architecture Improvements

### Critical Issues Identified

#### Issue 1: MCP Runtime Integration Infeasible

**Problem**: Penpot plugins run in browser iframes → cannot directly connect to local MCP servers (Node.js/Python)

**Original Plan**: "Add MCP client to plugin backend for Scriptorium/Bindery integration"

**Solution**:
- ✅ Use MCP for **build-time only** (Claude Code analyzing designs, generating templates)
- ✅ Plugin remains **self-contained** and browser-based
- ✅ Phase 2/3: Build optional **WebSocket bridge server** for runtime MCP

**Benefit**: Plugins are portable and don't require infrastructure

#### Issue 2: Template System Needs Design-First

**Problem**: No clear template definition format

**Solution**: Define schema before implementation:

```typescript
interface ComponentTemplate {
  id: string;
  name: string;
  category: 'dialog' | 'form' | 'button' | 'card' | 'error-pane';
  config: {
    // Parameterizable properties
    width?: number;
    height?: number;
    title?: string;
    message?: string;
    buttons?: string[];
  };
  layers: TemplateLayer[];  // Shape hierarchy
  styles: StyleDefinition;  // Semantic tokens
}

interface TemplateLayer {
  type: 'board' | 'rect' | 'ellipse' | 'text' | 'path';
  name: string;
  properties: ShapeProperties;
  children?: TemplateLayer[];
}
```

**Approach**: Start with 3-5 hardcoded templates, design for JSON extensibility later

#### Issue 3: State Management Strategy

**Problem**: Chatbot needs message history, template state, preview, undo - no strategy defined

**Solution**: React Context + useReducer pattern

```typescript
interface PluginState {
  messages: ChatMessage[];
  activeTemplate: ComponentTemplate | null;
  previewConfig: ComponentConfig | null;
  history: CreatedComponent[];
  theme: 'light' | 'dark';
  commandSuggestions: string[];
}

type PluginAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SELECT_TEMPLATE'; payload: ComponentTemplate }
  | { type: 'UPDATE_PREVIEW'; payload: ComponentConfig }
  | { type: 'CREATE_COMPONENT'; payload: CreatedComponent }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' };

function pluginReducer(state: PluginState, action: PluginAction): PluginState {
  // Single source of truth for all state transitions
}
```

**Benefits**:
- Single reducer for all state transitions
- Easier debugging (action log)
- Natural undo support (action replay)
- Time-travel debugging capability

#### Issue 4: Preview Mode Implementation

**Problem**: "Show preview before creating" - how exactly?

**Solution**: SVG preview in React UI (not Penpot API)

**Approach A (Recommended)**: Canvas Preview in UI
- Render simplified version in React using SVG
- Shows approximate layout/colors
- Fast, no Penpot API calls
- Good enough for validation

**Approach B**: Temporary Layer (Phase 2)
- Create in hidden layer, export image, delete
- Accurate but slower
- Use for final validation only

#### Issue 5: Command Parser Scope

**Problem**: "Natural language parsing" as first step is risky and time-consuming

**Solution**: Phased approach

**Phase 1: Keyword Matching**
```typescript
// Simple pattern matching
if (input.includes('create dialog') || input.includes('make dialog')) {
  return { command: 'create-dialog', params: extractParams(input) };
}
```

**Phase 2: Structured Commands**
```typescript
// Slack-style commands
/dialog title="Error" message="Something went wrong" buttons="OK,Cancel"
```

**Phase 3: Template Selection**
```typescript
// Named templates
"use error-template-1"
"apply dialog-variant-dark"
```

**Phase 4: Natural Language** (far future)
- Integrate AI for NLP
- Parse "create a red button with 'Submit' text"

---

## Shared Utilities Extraction Plan

### Priority 1: Core Infrastructure

#### 1. Error Handling (`@vespera/error-handling`)

**Source**: VS Code extension `/plugins/VSCode/vespera-forge/src/core/error-handling/`

**Components to Extract**:
```typescript
// Base error class with categorization
abstract class VesperaError extends Error {
  abstract category(): string;
  abstract isRecoverable(): boolean;
  abstract userMessage(): string;
}

// Error handler with strategies
class ErrorHandler {
  private strategies: Map<string, ErrorHandlingStrategy>;

  async handleError(error: Error): Promise<RetryMetadata | void>;
  setStrategy(code: string, strategy: ErrorHandlingStrategy): void;
}

// Standard error response
interface ErrorResponse {
  success: false;
  error: string;
  error_code: string;
  operation: string;
  context?: Record<string, any>;
  suggestions?: string[];
}
```

**Rust Reference**: `/packages/vespera-utilities/vespera-bindery/src/error.rs` (217 lines)

#### 2. Validation Schemas (`@vespera/validation`)

**Purpose**: Zod schemas for all Penpot types and MCP messages

**Structure**:
```typescript
// packages/vespera-utilities/typescript-shared/validation/

schemas/
  ├── penpot/
  │   ├── shapes.ts       // Fill, Stroke, Shadow, PenpotObject
  │   ├── operations.ts   // AddObjChange, ModObjChange, etc.
  │   └── api.ts          // API request/response schemas
  ├── templates/
  │   ├── component.ts    // ComponentTemplate schema
  │   ├── layers.ts       // TemplateLayer schema
  │   └── styles.ts       // StyleDefinition schema
  ├── mcp/
  │   ├── messages.ts     // MCP message protocol
  │   ├── tools.ts        // Tool input/output schemas
  │   └── errors.ts       // MCP error schema
  └── index.ts
```

**Example**:
```typescript
import { z } from 'zod';

// Penpot shape schemas
export const FillSchema = z.object({
  fillColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  fillOpacity: z.number().min(0).max(1),
});

export const PenpotObjectSchema = z.object({
  id: z.string().uuid(),
  type: z.enum(['rect', 'ellipse', 'text', 'path', 'frame']),
  name: z.string(),
  x: z.number().optional(),
  y: z.number().optional(),
  width: z.number().positive().optional(),
  height: z.number().positive().optional(),
  fills: z.array(FillSchema).optional(),
});

// Template schemas
export const ComponentTemplateSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['dialog', 'form', 'button', 'card', 'error-pane']),
  config: z.record(z.any()),
  layers: z.array(z.lazy(() => TemplateLayerSchema)),
});

export type ComponentTemplate = z.infer<typeof ComponentTemplateSchema>;
```

#### 3. Lifecycle Management (`@vespera/lifecycle`)

**Source**: VS Code extension `/plugins/VSCode/vespera-forge/src/core/disposal/`

**Components to Extract**:
```typescript
// Enhanced disposable interface
interface EnhancedDisposable {
  isDisposed: boolean;
  dispose(): void | Promise<void>;
}

// Disposal hooks for orchestration
interface DisposalHooks {
  beforeDispose?: () => Promise<void>;
  afterDispose?: () => Promise<void>;
  onDisposeError?: (error: Error) => Promise<void>;
}

// Disposal manager
class DisposalManager implements EnhancedDisposable {
  add(disposable: EnhancedDisposable): void;
  addHook(hook: DisposalHooks): void;
  dispose(): Promise<DisposalResult>;
  isDisposed: boolean;
}

// Resource tracking
class ResourceTracker {
  registerResource(resource: EnhancedDisposable, name: string): string;
  disposeResource(id: string): Promise<void>;
  getMemoryStats(): MemoryStats;
  cleanupStaleResources(maxAge: number): Promise<CleanupResult>;
}
```

#### 4. Logging Utilities (`@vespera/logging`)

**Source**: Penpot bridge `/packages/vespera-penpot-bridge/src/utils/logger.ts`

**Enhancement**: Add structured logging with context

```typescript
interface Logger {
  info(message: string, context?: Record<string, any>): void;
  warn(message: string, context?: Record<string, any>): void;
  error(message: string, error?: Error, context?: Record<string, any>): void;
  debug(message: string, context?: Record<string, any>): void;
}

class StructuredLogger implements Logger {
  constructor(private category: string) {}

  info(message: string, context?: Record<string, any>): void {
    console.log(JSON.stringify({
      level: 'info',
      category: this.category,
      message,
      timestamp: new Date().toISOString(),
      ...context
    }));
  }

  // ... other methods
}
```

### Priority 2: Platform Abstractions

#### 5. Circuit Breaker (`@vespera/circuit-breaker`)

**Source**: Bindery `/packages/vespera-utilities/vespera-bindery/src/rag/circuit_breaker.rs`

**Purpose**: Resilient API calls with failure handling

```typescript
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  requestTimeout: number;
}

export enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half_open'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.Closed;
  private failureCount = 0;
  private lastFailureTime?: number;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T>;
  private shouldAttemptReset(): boolean;
  private onSuccess(): void;
  private onFailure(): void;
}
```

**Use Case**: Wrap all Penpot API calls for resilience

#### 6. Performance Metrics (`@vespera/metrics`)

**Source**: Bindery `/packages/vespera-utilities/rust-file-ops/src/types.rs`

**Purpose**: Plugin health monitoring

```typescript
export interface PerformanceMetrics {
  operationName: string;
  startTime: number;
  endTime: number;
  duration: number;
  memoryUsed?: number;
  success: boolean;
  errorCode?: string;
}

export class MetricsCollector {
  private metrics: PerformanceMetrics[] = [];

  startOperation(name: string): OperationTimer;
  recordMetric(metric: PerformanceMetrics): void;
  getMetrics(filter?: MetricsFilter): PerformanceMetrics[];
  getSummary(): MetricsSummary;
}

export class OperationTimer {
  constructor(private name: string, private collector: MetricsCollector);

  end(success: boolean, errorCode?: string): void;
}
```

**Use Case**: Track Penpot API performance, identify bottlenecks

### Priority 3: Shared Types

#### 7. Common Type Definitions (`@vespera/types`)

**Purpose**: Shared TypeScript types across all packages

```typescript
// Task management types (from Bindery)
export enum TaskStatus {
  Todo = 'todo',
  Doing = 'doing',
  Review = 'review',
  Done = 'done',
  Blocked = 'blocked',
  Cancelled = 'cancelled'
}

export enum TaskPriority {
  Low = 'low',
  Normal = 'normal',
  High = 'high',
  Critical = 'critical'
}

// MCP types
export interface MCPRequest {
  method: string;
  params?: Record<string, any>;
}

export interface MCPResponse {
  result?: any;
  error?: MCPError;
}

export interface MCPError {
  code: number;
  message: string;
  data?: any;
}

// Penpot types
export interface PenpotObject {
  id: string;
  type: 'rect' | 'ellipse' | 'text' | 'path' | 'frame';
  name: string;
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  fills?: Fill[];
  strokes?: Stroke[];
  children?: string[];
}
```

---

## Accessibility-Focused Design

### Context

**User Need**: Difficulty with precise mouse clicking, proficient with keyboard

**Solution**: Keyboard-driven chatbot interface for command-based UI creation

**Inspiration**: Terminal/CLI workflows adapted to design tools

### Design Principles

#### 1. Keyboard-First Interface

**Primary Input**: Text commands via chat interface

**No Mouse Required For**:
- Creating components
- Selecting templates
- Modifying properties
- Navigating history
- Undoing actions

**Example Workflow**:
```
User types: "create error dialog"
Plugin suggests: "Which template? [1] Simple [2] With icon [3] Dismissible"
User types: "2"
Plugin creates: Error dialog with icon
User types: "change title to 'Connection Failed'"
Plugin updates: Title updated
```

#### 2. Command Suggestions

**Auto-complete for Common Actions**:
- "create dialog"
- "create button"
- "create form"
- "make it red"
- "add shadow"
- "center on page"

**Template Selection**:
- Show thumbnails/descriptions
- Number-based selection (type "1", "2", "3")
- Name-based selection (type "error-simple")

#### 3. Esc Menu System (DOS/Game-Inspired)

**Philosophy**: Esc key doesn't close the plugin - it opens a navigation menu (like DOS CLI apps and classic games)

**Menu Structure**:
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

**Behavior**:
- First Esc press: Show menu (overlay on chat interface)
- Second Esc press: Close menu (return to chat)
- Number keys (1-6, 0): Select menu option
- Arrow keys: Navigate menu items
- Enter: Select highlighted item
- **Numpad support**: All number keys work from numpad too

**Sub-Menus**: Each menu option can have its own submenu (e.g., Settings → Theme, Font Size, etc.)

**Accessibility Benefits**:
- No need to remember shortcuts - everything discoverable via Esc menu
- Number-based selection faster than mouse clicking
- Can navigate entire plugin with one hand on numpad

#### 4. Numpad-Centric Design (Inspired by FFXI)

**Design Goal**: Enable one-handed operation using primarily the numpad and arrow keys

**Numpad Layout**:
```
┌───────────────────────────┐
│  [7]  [8]  [9]    [+]     │  + = Context menu
│  [4]  [5]  [6]            │  9 = Page up
│  [1]  [2]  [3]  [Enter]   │  3 = Page down
│      [0]    [.]           │  0 = Template selector (tab-like)
└───────────────────────────┘  . = Alt Esc
```

**Key Mappings**:
- **Numpad 0**: Quick template selector (cycles through templates like tab-targeting)
- **Numpad Enter**: Select/confirm (duplicate of main Enter)
- **Numpad +**: Context menu for current element (like FFXI inventory sorting)
- **Numpad Period/Del**: Alternative Esc key (toggle Esc menu)
- **Numpad 9/3**: Page Up/Down in lists
- **Numpad 1-6**: Quick menu selections when Esc menu is open
- **Numpad arrows** (8/4/6/2): Navigate (if numlock off, otherwise use dedicated arrows)

**Rationale**: Based on proven FFXI design where entire MMO was playable via numpad + arrow keys. Minimizes hand movement, reduces need for precise clicking, enables comfortable one-handed operation.

#### 5. Progressive Enhancement

**Phase 1**: Simple keyword matching
```
"create dialog" → Dialog template selection
"red button" → Button with red fill
```

**Phase 2**: Property modification
```
"change width to 300" → Update width
"add blue stroke" → Add stroke with blue color
```

**Phase 3**: Conversational refinement
```
"make it darker" → Adjust fill color
"add more padding" → Increase dimensions
```

### Accessibility Features

#### Visual

- **High contrast mode support**: Respect Penpot's dark/light theme
- **Large text in chat**: Readable font sizes
- **Clear visual hierarchy**: Template categories, command suggestions

#### Motor

- **No precise clicking required**: All via text commands
- **Esc menu system**: Discoverable navigation without memorizing shortcuts
- **Numpad-centric operation**: Entire plugin usable with one hand on numpad
- **Keyboard shortcuts**: Quick access (Ctrl+Space to focus chat)
- **Tab navigation**: Move between UI elements
- **Command history**: Up arrow to repeat commands
- **Context menus**: Numpad + key for element-specific actions
- **Minimal hand movement**: Numpad + adjacent arrow keys cover all operations

#### Cognitive

- **Clear command syntax**: Simple, predictable patterns
- **Immediate feedback**: Visual confirmation of actions
- **Undo support**: "undo" command or native Penpot Ctrl+Z
- **Suggestions**: Show available commands/templates
- **Error messages**: Clear, actionable error descriptions

---

## Implementation Plan

### Phase 0: Foundation (Week 1)

**Goal**: Extract shared utilities and create project structure

#### Step 1: Create Shared Utilities Package
```bash
cd /home/aya/Development/vespera-atelier/packages
mkdir -p vespera-utilities/typescript-shared
cd vespera-utilities/typescript-shared
npm init -y
```

**Package Structure**:
```
typescript-shared/
├── package.json
├── tsconfig.json
├── src/
│   ├── error-handling/
│   │   ├── errors.ts
│   │   ├── handler.ts
│   │   └── index.ts
│   ├── validation/
│   │   ├── schemas/
│   │   │   ├── penpot.ts
│   │   │   ├── templates.ts
│   │   │   └── mcp.ts
│   │   └── index.ts
│   ├── lifecycle/
│   │   ├── disposable.ts
│   │   ├── manager.ts
│   │   └── index.ts
│   ├── logging/
│   │   ├── logger.ts
│   │   └── index.ts
│   ├── circuit-breaker/
│   │   ├── breaker.ts
│   │   └── index.ts
│   ├── metrics/
│   │   ├── collector.ts
│   │   └── index.ts
│   ├── types/
│   │   ├── task.ts
│   │   ├── mcp.ts
│   │   ├── penpot.ts
│   │   └── index.ts
│   └── index.ts
└── README.md
```

#### Step 2: Implement Core Utilities

**2.1 Error Handling** (2-3 hours)
- Convert VS Code error handling pattern
- Add Bindery error categorization
- Create standard error response format
- Add retry logic

**2.2 Validation** (2-3 hours)
- Create Zod schemas for Penpot objects
- Create template definition schemas
- Create MCP message schemas
- Add type inference utilities

**2.3 Lifecycle Management** (1-2 hours)
- Extract disposal pattern from VS Code
- Create resource tracker
- Add cleanup hooks

**2.4 Logging** (1 hour)
- Enhance Penpot bridge logger
- Add structured logging
- Add context support

**2.5 Circuit Breaker** (2 hours)
- Convert Rust implementation
- Add fetch API integration
- Add timeout support

**2.6 Metrics** (1 hour)
- Create performance metrics collector
- Add operation timer
- Add summary generation

**Total Time**: ~12 hours

#### Step 3: Documentation

Create `/packages/vespera-utilities/typescript-shared/docs/`:
- `ERROR_HANDLING.md`: Error patterns and examples
- `VALIDATION.md`: Zod schema usage
- `LIFECYCLE.md`: Resource management patterns
- `CIRCUIT_BREAKER.md`: Resilient API calls
- `METRICS.md`: Performance tracking

### Phase 1: Walking Skeleton (Week 2)

**Goal**: ONE working template end-to-end

#### Step 1: Plugin Setup (2-3 hours)

```bash
# Copy React template from research
cd /home/aya/Development/vespera-atelier/packages/vespera-penpot-bridge
mkdir plugin
cp -r /home/aya/Development/vespera-atelier/research/penpot-plugins/plugin-examples/react-example-plugin/* plugin/
cd plugin
npm install

# Add shared utilities dependency
npm install @vespera/typescript-shared
```

**Project Structure**:
```
plugin/
├── src/
│   ├── shared/
│   │   ├── messages.ts    # Message protocol types
│   │   └── templates.ts   # Template definitions
│   ├── plugin/
│   │   ├── plugin.ts      # Backend entry point
│   │   └── templates/
│   │       └── error-dialog.ts
│   ├── ui/
│   │   ├── App.tsx        # Main React component
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

#### Step 2: Error Dialog Template (2-3 hours)

**Template Definition**:
```typescript
// src/shared/templates.ts
export interface ErrorDialogConfig {
  title: string;
  message: string;
  severity: 'error' | 'warning' | 'info';
  dismissible: boolean;
}

export const ERROR_DIALOG_TEMPLATE: ComponentTemplate = {
  id: 'error-dialog-v1',
  name: 'Error Dialog',
  category: 'dialog',
  config: {
    width: 400,
    height: 250,
    title: 'Error',
    message: 'Something went wrong',
    severity: 'error',
    dismissible: true
  },
  layers: [
    {
      type: 'board',
      name: 'Dialog Container',
      properties: { width: 400, height: 250 },
      children: [
        {
          type: 'rect',
          name: 'Background',
          properties: {
            width: 400,
            height: 250,
            fills: [{ fillColor: '#FFFFFF' }],
            borderRadius: 12
          }
        },
        {
          type: 'text',
          name: 'Title',
          properties: {
            content: 'Error',
            x: 24,
            y: 24,
            fontSize: '24',
            fontWeight: '700'
          }
        },
        {
          type: 'text',
          name: 'Message',
          properties: {
            content: 'Something went wrong',
            x: 24,
            y: 60,
            fontSize: '16'
          }
        },
        {
          type: 'rect',
          name: 'OK Button',
          properties: {
            x: 300,
            y: 200,
            width: 80,
            height: 36,
            fills: [{ fillColor: '#3B82F6' }],
            borderRadius: 6
          }
        }
      ]
    }
  ]
};
```

**Implementation**:
```typescript
// src/plugin/templates/error-dialog.ts
export function createErrorDialog(config: ErrorDialogConfig): void {
  const board = penpot.createBoard();
  board.name = config.title;
  board.resize(400, 250);

  // Background
  const bg = penpot.createRectangle();
  bg.resize(400, 250);
  bg.fills = [{ fillColor: '#ffffff' }];
  bg.borderRadius = 12;
  board.appendChild(bg);

  // Title
  const title = penpot.createText(config.title);
  if (title) {
    title.fontSize = '24';
    title.fontWeight = '700';
    title.x = 24;
    title.y = 24;
    board.appendChild(title);
  }

  // Message
  const message = penpot.createText(config.message);
  if (message) {
    message.fontSize = '16';
    message.x = 24;
    message.y = 60;
    board.appendChild(message);
  }

  // OK Button
  const button = penpot.createRectangle();
  button.resize(80, 36);
  button.x = 300;
  button.y = 200;
  button.fills = [{ fillColor: '#3b82f6' }];
  button.borderRadius = 6;
  board.appendChild(button);

  // Button Text
  const buttonText = penpot.createText('OK');
  if (buttonText) {
    buttonText.x = 330;
    buttonText.y = 210;
    buttonText.fills = [{ fillColor: '#ffffff' }];
    board.appendChild(buttonText);
  }

  // Center on viewport
  const center = penpot.viewport.center;
  board.x = center.x - 200;
  board.y = center.y - 125;

  penpot.selection = [board];
}
```

#### Step 3: Minimal Chat UI (2-3 hours)

**State Management**:
```typescript
// src/ui/state/reducer.ts
interface PluginState {
  messages: ChatMessage[];
  theme: 'light' | 'dark';
}

type PluginAction =
  | { type: 'ADD_MESSAGE'; payload: ChatMessage }
  | { type: 'SET_THEME'; payload: 'light' | 'dark' };

const initialState: PluginState = {
  messages: [],
  theme: 'light'
};

function pluginReducer(state: PluginState, action: PluginAction): PluginState {
  switch (action.type) {
    case 'ADD_MESSAGE':
      return { ...state, messages: [...state.messages, action.payload] };
    case 'SET_THEME':
      return { ...state, theme: action.payload };
    default:
      return state;
  }
}
```

**Chat Component**:
```typescript
// src/ui/App.tsx
function App() {
  const [state, dispatch] = useReducer(pluginReducer, initialState);
  const [input, setInput] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // Add user message
    dispatch({
      type: 'ADD_MESSAGE',
      payload: { role: 'user', content: input }
    });

    // Simple keyword matching
    if (input.toLowerCase().includes('create error dialog')) {
      // Send to plugin backend
      parent.postMessage({
        type: 'create-error-dialog',
        config: {
          title: 'Error',
          message: 'Something went wrong',
          severity: 'error',
          dismissible: true
        }
      }, '*');

      dispatch({
        type: 'ADD_MESSAGE',
        payload: { role: 'assistant', content: 'Creating error dialog...' }
      });
    }

    setInput('');
  };

  return (
    <div className="chat-container">
      <div className="messages">
        {state.messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <form onSubmit={handleSubmit}>
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Type a command..."
          autoFocus
        />
        <button type="submit">Send</button>
      </form>
    </div>
  );
}
```

**Plugin Backend**:
```typescript
// src/plugin/plugin.ts
import { createErrorDialog } from './templates/error-dialog';

penpot.ui.open('Vespera UI Generator', `?theme=${penpot.theme}`);

penpot.ui.onMessage<any>((message) => {
  if (message.type === 'create-error-dialog') {
    createErrorDialog(message.config);
  }
});

penpot.on('themechange', (theme) => {
  penpot.ui.sendMessage({ type: 'theme', content: theme });
});
```

#### Step 4: Test End-to-End (1-2 hours)

```bash
# Start dev server
npm run dev

# Open Penpot
# Press Ctrl+Alt+P
# Load: http://localhost:4402/manifest.json
```

**Test Checklist**:
- [ ] Plugin loads without errors
- [ ] Chat interface appears
- [ ] Can type "create error dialog"
- [ ] Error dialog is created in Penpot
- [ ] Dialog is centered on viewport
- [ ] Can select created dialog
- [ ] Native undo (Ctrl+Z) removes dialog
- [ ] Theme switching works

**Total Time**: ~8 hours

### Phase 2: Template Expansion (Week 3)

**Goal**: Add 4 more templates

#### Templates to Implement

1. **Simple Button**
   - Configurable: label, color, size
   - Variants: primary, secondary, danger, ghost

2. **Form Input**
   - Components: label, input field, validation indicator
   - Configurable: placeholder, required, type

3. **Card Component**
   - Components: header, body, footer
   - Configurable: width, has-shadow, has-border

4. **Success Dialog**
   - Like error dialog but with success styling
   - Green accent color, checkmark icon

#### Enhanced Command Parser

```typescript
interface ParsedCommand {
  action: 'create' | 'modify' | 'delete';
  target: 'dialog' | 'button' | 'form' | 'card';
  params: Record<string, any>;
}

function parseCommand(input: string): ParsedCommand | null {
  const lower = input.toLowerCase();

  // Create commands
  if (lower.includes('create') || lower.includes('make')) {
    if (lower.includes('error dialog')) {
      return { action: 'create', target: 'dialog', params: { type: 'error' } };
    }
    if (lower.includes('button')) {
      return { action: 'create', target: 'button', params: extractButtonParams(input) };
    }
    // ... more patterns
  }

  // Modify commands
  if (lower.includes('change') || lower.includes('update')) {
    // ... modification patterns
  }

  return null;
}
```

**Total Time**: ~12 hours

### Phase 3: Polish & Accessibility (Week 4)

**Goal**: Enhance UX and accessibility features

#### Features to Add

1. **Command Suggestions**
   - Auto-complete dropdown
   - Show as user types
   - Number-based selection

2. **Template Gallery**
   - Visual thumbnails
   - Category filtering
   - Quick create buttons

3. **Command History**
   - Up arrow to repeat
   - History dropdown
   - Recent commands

4. **Keyboard Shortcuts & Esc Menu**
   - `Ctrl+Space`: Focus chat
   - `Esc`: Toggle Esc menu (DOS/game-style menu system)
   - `Ctrl+/`: Show help
   - **Numpad Support** (inspired by FFXI):
     - `Numpad 0`: Quick template selector (tab-like behavior)
     - `Numpad Enter`: Select/confirm (duplicate of main Enter)
     - `Numpad +`: Context menu for current element
     - `Numpad Period/Del`: Alternative Esc key

5. **Preview Mode**
   - SVG preview before creating
   - "Create" button to confirm
   - "Cancel" to dismiss

6. **Error Handling**
   - Clear error messages
   - Suggestions for fixes
   - Retry buttons

**Total Time**: ~12 hours

---

## Success Metrics

### Phase 1 Success Criteria

- [ ] Can create error dialog via text command
- [ ] Dialog appears centered on viewport
- [ ] Dialog has correct styling
- [ ] Chat interface is keyboard-accessible
- [ ] Theme switching works
- [ ] No console errors

### Phase 2 Success Criteria

- [ ] 5 templates working (error dialog, button, form, card, success dialog)
- [ ] Command parser recognizes all template types
- [ ] Can customize basic properties via commands
- [ ] Templates are visually consistent

### Phase 3 Success Criteria

- [ ] Command suggestions work
- [ ] Template gallery is usable
- [ ] Keyboard shortcuts work
- [ ] Preview mode functional
- [ ] Error handling is clear
- [ ] Documentation complete

### Overall Success

**Primary Goal**: Create UI components via keyboard commands without needing precise mouse clicking

**User Feedback**: Can the user comfortably create and edit UI components using only keyboard?

---

## Future Enhancements (Phase 4+)

### MCP Integration

**Phase 4: WebSocket Bridge** (optional)
- Standalone WebSocket server
- Bridges browser plugin ↔ local MCP servers
- Enables Scriptorium/Bindery integration

**Phase 5: Template Generator**
- Use Scriptorium to analyze existing designs
- Generate templates from selected components
- Store templates in project library

### Advanced Features

**Natural Language Processing**
- Integrate Claude API for command parsing
- "Create a dark mode login form with email and password"
- Property modification: "make it 20% darker"

**Template Marketplace**
- Share templates with community
- Import/export template packs
- Template versioning

**Design System Integration**
- Import design tokens
- Apply theme to all components
- Maintain consistency

**Batch Operations**
- "Create 5 buttons with these labels: Submit, Cancel, Reset, Save, Delete"
- "Update all dialogs to use new error styling"

---

## References

### Research Reports

- **Utilities Audit**: `/home/aya/Development/vespera-atelier/research/penpot-plugins/UTILITIES_AUDIT.md`
- **Validation Patterns**: `/home/aya/Development/vespera-atelier/research/penpot-plugins/VALIDATION_PATTERNS.md`
- **Plugin Architecture**: `/home/aya/Development/vespera-atelier/research/penpot-plugins/PLUGIN_ARCHITECTURE.md`
- **Penpot Research**: `/home/aya/Development/vespera-atelier/research/penpot-plugins/RESEARCH_REPORT.md`

### Code References

- **Bindery Template System**: `/packages/vespera-utilities/vespera-bindery/templates/vespera.task.template.json5`
- **VS Code Error Handling**: `/plugins/VSCode/vespera-forge/src/core/error-handling/`
- **Obsidian MCP Client**: `/plugins/Obsidian/vespera-scriptorium/src/mcp/`
- **Penpot Bridge MCP Server**: `/packages/vespera-penpot-bridge/src/`

### External Documentation

- **Penpot Plugin API**: https://penpot-plugins-api-doc.pages.dev/
- **Penpot Plugin Guide**: https://help.penpot.app/plugins/
- **React Example**: `/research/penpot-plugins/plugin-examples/react-example-plugin/`
- **Template Starter**: `/research/penpot-plugins/penpot-plugin-starter-template/`

---

## Appendix A: Rust to TypeScript Conversion Examples

### Error Handling

**Rust** (`vespera-bindery/src/error.rs`):
```rust
pub enum BinderyError {
    #[error("Template not found: {0}")]
    TemplateNotFound(TemplateId),

    #[error("Network error: {0}")]
    NetworkError(String),
}

impl BinderyError {
    pub fn is_recoverable(&self) -> bool {
        matches!(self, Self::NetworkError(_))
    }

    pub fn category(&self) -> &'static str {
        match self {
            Self::TemplateNotFound(_) => "template",
            Self::NetworkError(_) => "network",
        }
    }
}
```

**TypeScript** (proposed):
```typescript
export abstract class PenpotPluginError extends Error {
  abstract isRecoverable(): boolean;
  abstract category(): string;
  abstract userMessage(): string;
}

export class TemplateNotFoundError extends PenpotPluginError {
  constructor(public templateId: string) {
    super(`Template not found: ${templateId}`);
  }

  isRecoverable() { return false; }
  category() { return 'template'; }
  userMessage() { return `Could not find template "${this.templateId}"`; }
}

export class NetworkError extends PenpotPluginError {
  constructor(message: string) {
    super(`Network error: ${message}`);
  }

  isRecoverable() { return true; }
  category() { return 'network'; }
  userMessage() { return 'Connection problem. Please try again.'; }
}
```

### Circuit Breaker

**Rust** (`vespera-bindery/src/rag/circuit_breaker.rs`):
```rust
pub struct CircuitBreakerConfig {
    pub failure_threshold: usize,
    pub recovery_timeout: Duration,
    pub request_timeout: Duration,
}

pub enum CircuitState {
    Closed,
    Open,
    HalfOpen,
}
```

**TypeScript** (proposed):
```typescript
export interface CircuitBreakerConfig {
  failureThreshold: number;
  recoveryTimeout: number; // milliseconds
  requestTimeout: number;
}

export enum CircuitState {
  Closed = 'closed',
  Open = 'open',
  HalfOpen = 'half_open'
}

export class CircuitBreaker {
  private state: CircuitState = CircuitState.Closed;
  private failureCount = 0;
  private lastFailureTime?: number;

  constructor(private config: CircuitBreakerConfig) {}

  async execute<T>(fn: () => Promise<T>): Promise<T> {
    if (this.state === CircuitState.Open) {
      if (this.shouldAttemptReset()) {
        this.state = CircuitState.HalfOpen;
      } else {
        throw new Error('Circuit breaker is open');
      }
    }

    try {
      const result = await Promise.race([
        fn(),
        this.timeout()
      ]);
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return false;
    return Date.now() - this.lastFailureTime >= this.config.recoveryTimeout;
  }

  private onSuccess(): void {
    this.failureCount = 0;
    this.state = CircuitState.Closed;
  }

  private onFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = CircuitState.Open;
    }
  }

  private timeout(): Promise<never> {
    return new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')),
        this.config.requestTimeout)
    );
  }
}
```

---

## Appendix B: Accessibility Testing Checklist

### Keyboard Navigation

- [ ] All interactive elements focusable
- [ ] Tab order is logical
- [ ] No keyboard traps
- [ ] Esc key toggles Esc menu (doesn't close plugin)
- [ ] Esc menu navigable with numbers and arrows
- [ ] Second Esc press closes menu
- [ ] Enter key submits commands
- [ ] Arrow keys navigate suggestions
- [ ] Shortcuts work (Ctrl+Space, etc.)

### Numpad Support

- [ ] Numpad 0 cycles through templates (tab-like)
- [ ] Numpad Enter confirms selections
- [ ] Numpad + opens context menu
- [ ] Numpad Period/Del acts as alternative Esc
- [ ] Numpad 9/3 scrolls pages up/down
- [ ] Numpad 1-6 selects Esc menu options
- [ ] All numpad keys work with NumLock on
- [ ] Numpad arrows work with NumLock off

### Screen Reader Support

- [ ] All buttons have labels
- [ ] Form fields have associated labels
- [ ] ARIA roles are correct
- [ ] Status messages announced
- [ ] Error messages announced
- [ ] Success messages announced

### Visual Accessibility

- [ ] High contrast mode support
- [ ] Text is readable (min 14px)
- [ ] Focus indicators visible
- [ ] Color is not sole indicator
- [ ] Theme respects user preference

### Motor Accessibility

- [ ] No double-click required
- [ ] No precise clicking needed
- [ ] Click targets min 44x44px
- [ ] Keyboard shortcuts available
- [ ] Command history accessible

### Cognitive Accessibility

- [ ] Commands are predictable
- [ ] Suggestions are clear
- [ ] Error messages are specific
- [ ] Undo is always available
- [ ] Help is easily accessible

---

**Document Status**: Living document - will be updated as implementation progresses
**Last Updated**: 2025-09-30
**Next Review**: After Phase 1 completion