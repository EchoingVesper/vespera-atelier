# Vespera Forge UI Framework Integration Prompt

**Worktree:** `feat-codex-ui-framework`
**Target:** VS Code Extension (`plugins/VSCode/vespera-forge`)
**Objective:** Wire in the Next.js-based UI framework as a replacement for the current webview UI

---

## Context

This worktree contains a **Next.js-based UI framework** (`src/vespera-forge/`) that provides a complete, React-powered interface for the Vespera Atelier system. It was originally developed as a standalone UI scaffold and is now being integrated into the VS Code extension.

### What We Have

**Current VS Code Extension** (`plugins/VSCode/vespera-forge/`):
- Extension entry point: `src/extension.ts`
- Current UI: Task Manager webview, tree views, status bar
- Commands: `vespera-forge.openTaskManager`, `vespera-forge.createContent`, etc.
- Active features: Task orchestration, Bindery integration, security manager

**New UI Framework** (`src/vespera-forge/`):
- **Three-Panel Layout**: Navigator + Editor + AI Chat
- **Codex System**: Universal content management
- **Template-Driven UI**: Configurable content types
- **Platform Adapters**: VS Code and Obsidian compatibility
- **80+ shadcn/ui Components**: Complete component library
- **Type-Safe Architecture**: Full TypeScript support

### Integration Goal

Replace the current webview-based Task Manager with the comprehensive Vespera Forge UI, providing:
1. Three-panel interface (as designed in architecture docs)
2. Codex Navigator for hierarchical content
3. Template-driven content editor
4. AI assistant integration
5. Real-time collaboration support (future)

---

## Phase 1: Assess Current State

### Tasks

1. **Examine Current VS Code Extension Structure**
   ```bash
   cd plugins/VSCode/vespera-forge
   ```
   - Review `src/extension.ts` - identify webview creation code
   - Check `src/views/` - understand current UI implementation
   - Review `src/commands/` - map existing commands to new UI actions
   - Identify dependencies in `package.json` that conflict with framework

2. **Examine New UI Framework**
   ```bash
   cd src/vespera-forge
   ```
   - Review `src/vespera-forge/plugins/vscode-extension.ts` - entry point for VS Code
   - Check `src/vespera-forge/core/adapters/vscode-adapter.ts` - platform integration
   - Understand component structure in `src/vespera-forge/components/`
   - Review type definitions in `src/vespera-forge/core/types/`

3. **Document Integration Points**
   - Create a mapping document: Current Commands → New UI Actions
   - Identify which current features to preserve vs. replace
   - List required VS Code API integrations (file system, commands, tree views)

---

## Phase 2: Disable Current UI (Optional Safety Step)

To test the new UI without conflicts, we can temporarily disable the current webview UI:

### Tasks

1. **Create Feature Flag**
   ```typescript
   // In src/extension.ts
   const USE_NEW_UI = true; // Toggle between old/new UI
   ```

2. **Conditionally Disable Current Webviews**
   ```typescript
   if (!USE_NEW_UI) {
     // Existing webview code here
     context.subscriptions.push(
       vscode.commands.registerCommand('vespera-forge.openTaskManager', () => {
         // Current task manager
       })
     );
   }
   ```

3. **Keep Core Services Active**
   - Keep Bindery integration running
   - Keep security manager active
   - Keep logging/telemetry services
   - Keep MCP server connections

---

## Phase 3: Integrate New UI Framework

### Step 1: Install Dependencies

```bash
cd ~/Development/vespera-atelier-worktrees/feat-codex-ui-framework
cd plugins/VSCode/vespera-forge

# Install framework dependencies (may need to merge package.json)
npm install react react-dom @types/react @types/react-dom
npm install tailwindcss postcss autoprefixer
npm install @radix-ui/react-* # All shadcn/ui dependencies
npm install zustand @tanstack/react-query axios
npm install framer-motion
```

### Step 2: Copy Framework Files

```bash
# Copy the Vespera Forge framework into the extension
rsync -av ../../src/vespera-forge/ ./src/vespera-forge/

# Copy UI components
rsync -av ../../src/components/ ./src/components/

# Copy utilities and hooks
rsync -av ../../src/lib/ ./src/lib/
rsync -av ../../src/hooks/ ./src/hooks/
```

### Step 3: Create Webview HTML Template

Create `src/webview/vespera-forge-webview.html`:

```html
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${cspSource} 'unsafe-inline'; script-src ${cspSource};">
    <title>Vespera Forge</title>
    <link href="${stylesUri}" rel="stylesheet">
</head>
<body>
    <div id="root"></div>
    <script src="${scriptUri}"></script>
</body>
</html>
```

### Step 4: Create Webview Provider

Create `src/webview/VesperaForgeWebviewProvider.ts`:

```typescript
import * as vscode from 'vscode';
import * as path from 'path';

export class VesperaForgeWebviewProvider implements vscode.WebviewViewProvider {
    private _view?: vscode.WebviewView;

    constructor(
        private readonly _extensionUri: vscode.Uri,
    ) {}

    public resolveWebviewView(
        webviewView: vscode.WebviewView,
        context: vscode.WebviewViewResolveContext,
        _token: vscode.CancellationToken,
    ) {
        this._view = webviewView;

        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        webviewView.webview.html = this._getHtmlForWebview(webviewView.webview);

        // Message handling between extension and webview
        webviewView.webview.onDidReceiveMessage(async (data) => {
            switch (data.type) {
                case 'codex.create':
                    // Handle codex creation
                    break;
                case 'codex.update':
                    // Handle codex update
                    break;
                case 'codex.delete':
                    // Handle codex deletion
                    break;
            }
        });
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        const scriptUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js')
        );
        const stylesUri = webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'styles.css')
        );

        const nonce = getNonce();

        return `<!DOCTYPE html>
            <html lang="en">
            <head>
                <meta charset="UTF-8">
                <meta name="viewport" content="width=device-width, initial-scale=1.0">
                <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource} 'unsafe-inline'; script-src 'nonce-${nonce}';">
                <link href="${stylesUri}" rel="stylesheet">
                <title>Vespera Forge</title>
            </head>
            <body>
                <div id="root"></div>
                <script nonce="${nonce}" src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
```

### Step 5: Create React Entry Point for Webview

Create `src/webview/index.tsx`:

```typescript
import React from 'react';
import ReactDOM from 'react-dom/client';
import { VesperaForge } from '../vespera-forge/components/core/VesperaForge';
import { createVSCodeAdapter } from '../vespera-forge/core/adapters/vscode-adapter';
import '../app/globals.css'; // Tailwind styles

// Create VS Code webview API wrapper
const vscode = acquireVsCodeApi();

// Create platform adapter
const adapter = createVSCodeAdapter(vscode);

// Render the main application
const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
    <React.StrictMode>
        <VesperaForge
            platformAdapter={adapter}
            onCodexCreate={(codex) => {
                vscode.postMessage({ type: 'codex.create', codex });
            }}
            onCodexUpdate={(codex) => {
                vscode.postMessage({ type: 'codex.update', codex });
            }}
            onCodexDelete={(id) => {
                vscode.postMessage({ type: 'codex.delete', id });
            }}
        />
    </React.StrictMode>
);
```

### Step 6: Update Extension Activation

Modify `src/extension.ts`:

```typescript
import { VesperaForgeWebviewProvider } from './webview/VesperaForgeWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
    // ... existing code ...

    // Register the new Vespera Forge webview
    const provider = new VesperaForgeWebviewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'vespera-forge.mainView',
            provider
        )
    );

    // Register command to open Vespera Forge
    context.subscriptions.push(
        vscode.commands.registerCommand('vespera-forge.open', () => {
            vscode.commands.executeCommand('vespera-forge.mainView.focus');
        })
    );

    // ... rest of existing code ...
}
```

### Step 7: Update package.json

Add webview view container:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "vespera-forge",
          "title": "Vespera Forge",
          "icon": "resources/vespera-icon.svg"
        }
      ]
    },
    "views": {
      "vespera-forge": [
        {
          "type": "webview",
          "id": "vespera-forge.mainView",
          "name": "Main",
          "icon": "resources/vespera-icon.svg"
        }
      ]
    },
    "commands": [
      {
        "command": "vespera-forge.open",
        "title": "Open Vespera Forge",
        "category": "Vespera Forge"
      }
    ]
  }
}
```

### Step 8: Update Build Configuration

Update `webpack.config.js` to build both extension and webview:

```javascript
const path = require('path');

module.exports = [
  // Extension configuration
  {
    target: 'node',
    entry: './src/extension.ts',
    output: {
      path: path.resolve(__dirname, 'dist'),
      filename: 'extension.js',
      libraryTarget: 'commonjs2'
    },
    // ... existing extension config ...
  },

  // Webview configuration
  {
    target: 'web',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist/webview'),
      filename: 'index.js'
    },
    module: {
      rules: [
        {
          test: /\.tsx?$/,
          use: 'ts-loader',
          exclude: /node_modules/
        },
        {
          test: /\.css$/,
          use: ['style-loader', 'css-loader', 'postcss-loader']
        }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    }
  }
];
```

---

## Phase 4: Test Integration

### Testing Checklist

1. **Build Extension**
   ```bash
   npm run compile
   # or
   npm run watch
   ```

2. **Launch Extension Development Host**
   - Press F5 in VS Code
   - Or use "Run Extension" from debug menu

3. **Verify Basic Functionality**
   - [ ] Extension activates without errors
   - [ ] Vespera Forge view appears in activity bar
   - [ ] Webview loads and displays UI
   - [ ] Three-panel layout renders correctly
   - [ ] Components are styled correctly (Tailwind + shadcn/ui)

4. **Test Platform Adapter**
   - [ ] VS Code API calls work (file system, commands)
   - [ ] Message passing between extension and webview
   - [ ] Context menu integration
   - [ ] Command palette integration

5. **Test Core Features**
   - [ ] Codex Navigator displays content
   - [ ] Content editor opens and edits files
   - [ ] AI Assistant panel responds
   - [ ] Template selection works
   - [ ] Task creation/management functions

---

## Phase 5: Connect to Existing Services

### Integration Points

1. **Bindery Integration**
   - Connect UI to existing Bindery MCP server
   - Wire codex CRUD operations to Bindery backend
   - Sync task state between UI and Bindery

2. **Security Manager**
   - Apply existing security policies to UI actions
   - Integrate consent manager for AI features
   - Add audit logging for UI operations

3. **File System Operations**
   - Use existing file watchers
   - Integrate with workspace folder detection
   - Connect to .codex.md file handlers

4. **Telemetry**
   - Add telemetry events for UI interactions
   - Track feature usage
   - Monitor performance metrics

---

## Troubleshooting Guide

### Common Issues

1. **Webview doesn't load**
   - Check CSP settings in HTML template
   - Verify script/style URIs are correct
   - Check browser console in webview developer tools

2. **Styles not applying**
   - Ensure Tailwind is configured and building
   - Check PostCSS configuration
   - Verify CSS is being bundled correctly

3. **React components not rendering**
   - Check for React/ReactDOM version conflicts
   - Verify webpack configuration for JSX/TSX
   - Check browser console for errors

4. **Platform adapter errors**
   - Verify VS Code API is available in webview context
   - Check message passing between extension and webview
   - Ensure adapter methods are implemented

5. **Type errors**
   - Update tsconfig.json for React and DOM types
   - Ensure all dependencies have @types packages
   - Check for conflicts between extension and webview types

---

## Success Criteria

- [ ] Extension builds without errors
- [ ] Webview loads and displays three-panel layout
- [ ] All shadcn/ui components render correctly
- [ ] Platform adapter connects to VS Code APIs
- [ ] Codex Navigator displays hierarchical content
- [ ] Content editor opens and edits files
- [ ] AI Assistant panel is functional
- [ ] Commands work from command palette
- [ ] No console errors in webview developer tools
- [ ] Performance is acceptable (< 1s initial load)

---

## Next Steps After Integration

1. **Feature Parity**: Ensure all current Task Manager features work in new UI
2. **Polish UI**: Refine layouts, add animations, improve UX
3. **Documentation**: Create user guide for new interface
4. **Testing**: Write unit and integration tests
5. **Performance**: Optimize bundle size and load time
6. **Accessibility**: Ensure WCAG compliance
7. **Obsidian Plugin**: Adapt for Obsidian using same framework

---

## Resources

- **VS Code Extension API**: https://code.visualstudio.com/api
- **Webview Guide**: https://code.visualstudio.com/api/extension-guides/webview
- **shadcn/ui Docs**: https://ui.shadcn.com/
- **Tailwind CSS**: https://tailwindcss.com/
- **React + TypeScript**: https://react.dev/learn/typescript

---

## Notes

- The framework was designed to be platform-agnostic, so most components should work with minimal changes
- The VS Code adapter (`vscode-adapter.ts`) is the key integration point
- Consider creating a development mode that hot-reloads the webview for faster iteration
- Use VS Code's webview developer tools (Ctrl+Shift+P → "Developer: Open Webview Developer Tools")
