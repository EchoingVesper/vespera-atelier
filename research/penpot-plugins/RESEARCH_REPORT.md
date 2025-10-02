# Penpot Plugin Research Report

**Date**: 2025-09-30
**Purpose**: Set up a Penpot plugin using React for a chatbot UI that can programmatically create UI components

## Repository Locations

### Cloned Repositories

All repositories have been cloned to: `/home/aya/Development/vespera-atelier/research/penpot-plugins/`

1. **penpot-plugin-starter-template** - Basic TypeScript/Vite starter
2. **penpot-plugins-samples** - 13 practical examples of plugin features
3. **plugin-examples** - Framework-specific examples (React, Vue, Angular, Svelte)

## Key Findings

### 1. Plugin Architecture Overview

Penpot plugins consist of two separate execution contexts:

#### A. Plugin Backend (`plugin.ts`)
- **Only file that can access the Penpot API object**
- Runs in Penpot's plugin runtime
- Handles all shape creation, manipulation, and Penpot API calls
- Cannot directly interact with UI framework code

#### B. Plugin Frontend (UI) (`main.tsx` / `App.tsx`)
- Runs in an iframe
- Can use any UI framework (React, Vue, Angular, Svelte)
- Communicates with backend via `postMessage` API
- Cannot access Penpot API directly

### 2. Communication Pattern

```typescript
// Frontend (React) -> Backend
// UI sends messages to plugin backend
parent.postMessage("create-rectangle", "*");

// Backend -> Frontend
// Plugin backend sends messages to UI
penpot.ui.sendMessage({ type: 'status', content: 'created' });

// Frontend receives messages
window.addEventListener('message', (event) => {
  if (event.data.type === 'status') {
    // Handle message
  }
});
```

### 3. Plugin Manifest Structure

Located in `public/manifest.json`:

```json
{
  "name": "Plugin Name",
  "description": "Plugin description",
  "code": "/plugin.js",
  "icon": "/icon.png",
  "permissions": [
    "content:read",
    "content:write",
    "library:read",
    "library:write",
    "user:read",
    "page:read",
    "file:read",
    "selection:read"
  ]
}
```

**Available Permissions**:
- `content:read` / `content:write` - Read/modify shapes and content
- `library:read` / `library:write` - Access component libraries
- `user:read` - Access user information
- `page:read` - Read page data
- `file:read` - Read file metadata
- `selection:read` - Access current selection

### 4. React Plugin Setup

#### Required Dependencies

```json
{
  "dependencies": {
    "@penpot/plugin-styles": "^1.2.0",
    "@penpot/plugin-types": "^1.2.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.4",
    "typescript": "^5.8.2",
    "vite": "^5.4.14"
  }
}
```

#### Vite Configuration

```typescript
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      input: {
        plugin: 'src/plugin.ts',  // Backend entry
        index: './index.html',     // Frontend entry
      },
      output: {
        entryFileNames: '[name].js',
      },
    },
  },
  preview: {
    port: 4402,
    headers: {
      'Access-Control-Allow-Origin': '*',
    },
  },
});
```

#### Project Structure

```
react-plugin/
├── public/
│   └── manifest.json          # Plugin metadata
├── src/
│   ├── plugin.ts             # Backend (Penpot API access)
│   ├── main.tsx              # React entry point
│   ├── App.tsx               # Main React component
│   ├── model.ts              # TypeScript interfaces
│   └── index.css             # Styles
├── index.html                # UI HTML template
├── package.json
├── tsconfig.json
└── vite.config.ts
```

### 5. Creating Shapes Programmatically

#### Basic Shape Creation

```typescript
// In plugin.ts
penpot.ui.onMessage<string>((message) => {
  if (message === "create-rectangle") {
    // Create rectangle
    const shape = penpot.createRectangle();

    // Set properties
    shape.resize(150, 150);
    shape.name = "My Rectangle";
    shape.fills = [{ fillColor: "#7EFFF5" }];
    shape.borderRadius = 8;
    shape.strokes = [{
      strokeColor: "#2e3434",
      strokeStyle: "solid",
      strokeWidth: 2,
      strokeAlignment: "center"
    }];

    // Position at viewport center
    const center = penpot.viewport.center;
    shape.x = center.x;
    shape.y = center.y;

    // Set as selected
    penpot.selection = [shape];
  }
});
```

#### Available Shape Types

```typescript
// Basic shapes
penpot.createRectangle()  // Rectangle with border radius support
penpot.createEllipse()    // Ellipse/circle
penpot.createPath()       // Custom SVG path
penpot.createText("text") // Text element
penpot.createBoard()      // Frame/artboard

// Each returns a shape object with properties:
// - id, type, name, x, y, width, height
// - fills, strokes, shadows, blur
// - rotation, flipX, flipY
// - opacity, blendMode
// - And many more...
```

#### Text Creation

```typescript
const text = penpot.createText("Hello World!");
if (text) {
  text.growType = "auto-width";
  text.fontId = "gfont-work-sans";
  text.fontSize = "20";
  text.fontWeight = "500";
  text.fontStyle = "italic";
  text.textTransform = "uppercase";

  // Style specific text ranges
  const textRange = text.getRange(0, 5);
  textRange.fontSize = "40";
  textRange.fills = [{ fillColor: '#ff6fe0', fillOpacity: 1 }];

  text.x = penpot.viewport.center.x;
  text.y = penpot.viewport.center.y;
  penpot.selection = [text];
}
```

#### Layout Systems

##### Flex Layout
```typescript
// Create board with flex layout
const board = penpot.createBoard();
board.horizontalSizing = "auto";
board.verticalSizing = "auto";

const flex = board.addFlexLayout();
flex.dir = "column";  // "row" | "column" | "row-reverse" | "column-reverse"
flex.wrap = "wrap";   // "wrap" | "nowrap"
flex.alignItems = "center";  // "start" | "end" | "center" | "stretch"
flex.justifyContent = "center";  // "start" | "end" | "center" | "space-between" | etc
flex.verticalPadding = 5;
flex.horizontalPadding = 5;

// Add children
board.appendChild(penpot.createRectangle());
board.appendChild(penpot.createEllipse());
```

##### Grid Layout
```typescript
const board = penpot.createBoard();
const grid = board.addGridLayout();

// Add rows and columns
grid.addRow("flex", 1);    // "flex" | "fixed" | "percent" | "auto"
grid.addRow("flex", 1);
grid.addColumn("flex", 1);
grid.addColumn("flex", 1);

grid.alignItems = "center";
grid.justifyItems = "start";
grid.rowGap = 10;
grid.columnGap = 10;
grid.verticalPadding = 5;
grid.horizontalPadding = 5;
```

### 6. Theme Support

Plugins should respect Penpot's theme (light/dark):

```typescript
// In plugin.ts
penpot.ui.open("Plugin Name", `?theme=${penpot.theme}`);

penpot.on('themechange', (theme) => {
  penpot.ui.sendMessage({
    source: "penpot",
    type: "themechange",
    theme,
  });
});

// In React component
const url = new URL(window.location.href);
const initialTheme = url.searchParams.get('theme');
const [theme, setTheme] = useState(initialTheme || null);

window.addEventListener('message', (event) => {
  if (event.data.type === 'themechange') {
    setTheme(event.data.content);
  }
});

// Apply theme
<div data-theme={theme}>Content</div>
```

### 7. Component Library Integration

```typescript
// Create component from shape
const rectangle = penpot.createRectangle();
const shape = penpot.currentPage?.getShapeById(rectangle.id);
if (shape) {
  penpot.library.local.createComponent(shape);
}

// Read available components
console.log(penpot.library.local.components);
// Returns: [{ id: "...", name: "Rectangle", path: "" }]
```

### 8. Development Workflow

#### Setup
```bash
npm install
```

#### Development
```bash
npm run dev
# Server runs on http://localhost:4400 (or 4402 for React example)
# Load in Penpot: Ctrl+Alt+P -> http://localhost:4400/manifest.json
```

#### Build
```bash
npm run build
# Outputs to dist/ directory
```

#### Testing
1. Start dev server: `npm run dev`
2. Open Penpot (local instance or web)
3. Press `Ctrl+Alt+P` to open Plugin Manager
4. Enter manifest URL: `http://localhost:4400/manifest.json`
5. Plugin installs and opens in sidebar

### 9. Common Patterns from Examples

#### Pattern 1: Button-triggered Actions
```typescript
// UI (main.ts/App.tsx)
<button onClick={() => parent.postMessage("action-name", "*")}>
  Do Something
</button>

// Backend (plugin.ts)
penpot.ui.onMessage<string>((message) => {
  if (message === "action-name") {
    // Perform Penpot API action
  }
});
```

#### Pattern 2: Typed Message Events
```typescript
// model.ts - Define message types
export interface CreateShapeEvent {
  type: 'create-shape';
  shapeType: 'rectangle' | 'ellipse';
  properties: {
    width: number;
    height: number;
    color: string;
  };
}

export type PluginMessageEvent = CreateShapeEvent | OtherEvent;

// Use strongly typed messages
penpot.ui.onMessage<PluginMessageEvent>((message) => {
  if (message.type === 'create-shape') {
    // TypeScript knows the message structure
  }
});
```

#### Pattern 3: Positioning at Viewport Center
```typescript
// Common pattern for new shapes
const center = penpot.viewport.center;
shape.x = center.x;
shape.y = center.y;
```

### 10. UI Component Patterns for Chatbot

For building a chatbot UI that creates Penpot components, consider:

#### A. Chat Interface Structure
```typescript
interface Message {
  id: string;
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

interface ChatState {
  messages: Message[];
  isProcessing: boolean;
  currentShape?: string;
}
```

#### B. Command Parser
```typescript
// Parse natural language commands
type Command =
  | { type: 'create-dialog', title: string, message: string }
  | { type: 'create-error-pane', error: string }
  | { type: 'create-button', label: string, style: 'primary' | 'secondary' };

function parseCommand(input: string): Command | null {
  // NLP or keyword matching
  if (input.includes('dialog')) {
    return { type: 'create-dialog', title: '...', message: '...' };
  }
  // ...
}
```

#### C. UI Component Templates
```typescript
// Define templates for common UI components
const UI_TEMPLATES = {
  dialog: {
    width: 400,
    height: 300,
    components: [
      { type: 'rectangle', role: 'background' },
      { type: 'text', role: 'title' },
      { type: 'text', role: 'message' },
      { type: 'board', role: 'button-container' }
    ]
  },
  errorPane: {
    width: 350,
    height: 120,
    components: [
      { type: 'rectangle', role: 'background', color: '#ff0000' },
      { type: 'text', role: 'error-message' }
    ]
  }
};
```

## Next Steps

### 1. Set Up React Plugin Project

```bash
cd /home/aya/Development/vespera-atelier/packages/vespera-penpot-bridge
mkdir plugin
cd plugin

# Copy React example as starting point
cp -r /home/aya/Development/vespera-atelier/research/penpot-plugins/plugin-examples/react-example-plugin/* .

# Install dependencies
npm install

# Start development
npm run dev
```

### 2. Implement Chatbot UI

Create components:
- `ChatInterface.tsx` - Main chat container
- `MessageList.tsx` - Display messages
- `MessageInput.tsx` - User input
- `PreviewPanel.tsx` - Show what will be created
- `TemplateLibrary.tsx` - Pre-built UI component templates

### 3. Implement Shape Creation Service

Create `shapeService.ts` to handle:
- Dialog creation (background, title, message, buttons)
- Error pane creation (error styling, icon, message)
- Button creation (various styles)
- Form component creation (inputs, labels, validation states)
- Panel/card creation

### 4. Bridge with MCP Server

Options:
1. **Standalone Plugin** - Plugin communicates directly with Penpot API
2. **Hybrid Approach** - Plugin for creation, MCP server for reading/analysis
3. **MCP-Controlled Plugin** - MCP server sends commands to plugin

Recommended: **Hybrid Approach**
- Plugin handles all shape creation (fast, direct API access)
- MCP server handles file reading, analysis, batch operations
- Both can coexist and complement each other

### 5. Testing Strategy

1. Test individual shape creation functions
2. Test complex layouts (nested boards, flex, grid)
3. Test with different Penpot themes
4. Test with existing designs (don't break things)
5. Test performance with many shapes

## Code Snippets for Quick Start

### Basic React Plugin Template

#### src/plugin.ts
```typescript
import type { PluginMessageEvent } from './model';

penpot.ui.open('Vespera UI Builder', `?theme=${penpot.theme}`);

penpot.on('themechange', (theme) => {
  sendMessage({ type: 'theme', content: theme });
});

penpot.ui.onMessage<PluginMessageEvent>((message) => {
  switch (message.type) {
    case 'create-dialog':
      createDialog(message.config);
      break;
    case 'create-error-pane':
      createErrorPane(message.config);
      break;
    // ... other cases
  }
});

function sendMessage(message: PluginMessageEvent) {
  penpot.ui.sendMessage(message);
}

function createDialog(config: DialogConfig) {
  const board = penpot.createBoard();
  board.name = config.title;
  board.resize(400, 300);

  // Background
  const bg = penpot.createRectangle();
  bg.resize(400, 300);
  bg.fills = [{ fillColor: '#ffffff' }];
  bg.borderRadius = 8;
  board.appendChild(bg);

  // Title
  const title = penpot.createText(config.title);
  if (title) {
    title.fontSize = '24';
    title.fontWeight = '700';
    title.x = 20;
    title.y = 20;
    board.appendChild(title);
  }

  // Message
  const message = penpot.createText(config.message);
  if (message) {
    message.fontSize = '16';
    message.x = 20;
    message.y = 60;
    board.appendChild(message);
  }

  // Position at center
  const center = penpot.viewport.center;
  board.x = center.x - 200;
  board.y = center.y - 150;

  penpot.selection = [board];
}
```

#### src/App.tsx
```typescript
import { useState } from 'react';
import './App.css';

interface Message {
  role: 'user' | 'assistant';
  content: string;
}

function App() {
  const url = new URL(window.location.href);
  const initialTheme = url.searchParams.get('theme');
  const [theme, setTheme] = useState(initialTheme || 'light');
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState('');

  window.addEventListener('message', (event) => {
    if (event.data.type === 'theme') {
      setTheme(event.data.content);
    }
  });

  const handleSend = () => {
    if (!input.trim()) return;

    // Add user message
    setMessages([...messages, { role: 'user', content: input }]);

    // Parse command and send to plugin backend
    if (input.toLowerCase().includes('dialog')) {
      parent.postMessage({
        type: 'create-dialog',
        config: {
          title: 'My Dialog',
          message: 'Dialog content here'
        }
      }, '*');

      setMessages([
        ...messages,
        { role: 'user', content: input },
        { role: 'assistant', content: 'Created dialog component!' }
      ]);
    }

    setInput('');
  };

  return (
    <div data-theme={theme} className="chat-container">
      <div className="messages">
        {messages.map((msg, i) => (
          <div key={i} className={`message ${msg.role}`}>
            {msg.content}
          </div>
        ))}
      </div>
      <div className="input-container">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && handleSend()}
          placeholder="Describe the UI component..."
        />
        <button onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}

export default App;
```

## Resources

### Documentation
- Main docs: https://help.penpot.app/plugins/
- API docs: https://penpot-plugins-api-doc.pages.dev/
- Plugin styles: https://penpot-plugins-styles.pages.dev/

### Repositories
- Starter template: https://github.com/penpot/penpot-plugin-starter-template
- Framework examples: https://github.com/penpot/plugin-examples
- Sample plugins: https://github.com/penpot/penpot-plugins-samples

### Local Paths
- Research directory: `/home/aya/Development/vespera-atelier/research/penpot-plugins/`
- Target package: `/home/aya/Development/vespera-atelier/packages/vespera-penpot-bridge/`

## Recommendations

1. **Use React Plugin Template** - Better for complex UIs than vanilla TypeScript
2. **Implement Command Parser** - Map natural language to component creation
3. **Create Template Library** - Pre-defined UI component structures
4. **Add Preview Mode** - Show what will be created before creating
5. **Support Undo** - Keep track of created components for easy removal
6. **Theme Integration** - Respect Penpot's light/dark theme
7. **Keep MCP Server** - Use for file operations and batch processing
8. **Type Safety** - Use TypeScript interfaces for all messages

## Conclusion

The Penpot Plugin API provides a powerful way to programmatically create UI components. The React-based approach is ideal for building a sophisticated chatbot interface. The key insight is the separation between the plugin backend (which has Penpot API access) and the frontend (which provides the UI), communicating via postMessage.

The next step is to copy the React example template and start implementing the chatbot interface with command parsing and UI component templates.