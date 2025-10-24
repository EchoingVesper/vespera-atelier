# Vespera Forge UI Integration - Quick Start

**Quick reference for integrating the UI framework into VS Code extension**

---

## TL;DR

This worktree contains a Next.js/React UI framework that needs to be integrated into the VS Code extension as a webview-based replacement for the current Task Manager UI.

**Main files to create:**
1. `plugins/VSCode/vespera-forge/src/webview/VesperaForgeWebviewProvider.ts` - Webview provider
2. `plugins/VSCode/vespera-forge/src/webview/index.tsx` - React entry point
3. Update `plugins/VSCode/vespera-forge/src/extension.ts` - Register webview
4. Update `plugins/VSCode/vespera-forge/package.json` - Add webview view
5. Update `webpack.config.js` - Build webview bundle

---

## Quick Command Reference

```bash
# Navigate to worktree
cd ~/Development/vespera-atelier-worktrees/feat-codex-ui-framework

# Install dependencies
cd plugins/VSCode/vespera-forge
npm install

# Copy framework files (if needed)
rsync -av ../../../src/vespera-forge/ ./src/vespera-forge/
rsync -av ../../../src/components/ ./src/components/
rsync -av ../../../src/lib/ ./src/lib/
rsync -av ../../../src/hooks/ ./src/hooks/

# Build extension
npm run compile

# Test in VS Code
# Press F5 or use "Run Extension" from debug menu
```

---

## File Structure After Integration

```
plugins/VSCode/vespera-forge/
├── src/
│   ├── extension.ts                      # MODIFY: Register webview
│   ├── webview/                          # NEW: Webview code
│   │   ├── VesperaForgeWebviewProvider.ts
│   │   └── index.tsx
│   ├── vespera-forge/                    # COPY: Framework
│   │   ├── components/
│   │   ├── core/
│   │   └── plugins/
│   ├── components/                       # COPY: UI components
│   │   └── ui/
│   ├── lib/                              # COPY: Utilities
│   └── hooks/                            # COPY: React hooks
├── package.json                          # MODIFY: Add dependencies & views
└── webpack.config.js                     # MODIFY: Build webview
```

---

## Critical Dependencies

```json
{
  "dependencies": {
    "react": "^18.0.0",
    "react-dom": "^18.0.0",
    "tailwindcss": "^4.0.0",
    "zustand": "^4.0.0",
    "@tanstack/react-query": "^5.0.0",
    "framer-motion": "^11.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.0.0",
    "@types/react-dom": "^18.0.0",
    "ts-loader": "^9.0.0",
    "css-loader": "^6.0.0",
    "style-loader": "^3.0.0",
    "postcss-loader": "^7.0.0"
  }
}
```

---

## package.json Webview View Configuration

Add to `contributes` section:

```json
{
  "contributes": {
    "viewsContainers": {
      "activitybar": [
        {
          "id": "vespera-forge",
          "title": "Vespera Forge",
          "icon": "resources/icon.svg"
        }
      ]
    },
    "views": {
      "vespera-forge": [
        {
          "type": "webview",
          "id": "vespera-forge.mainView",
          "name": "Main"
        }
      ]
    }
  }
}
```

---

## Minimal Webview Provider Template

```typescript
// src/webview/VesperaForgeWebviewProvider.ts
import * as vscode from 'vscode';

export class VesperaForgeWebviewProvider implements vscode.WebviewViewProvider {
    constructor(private readonly _extensionUri: vscode.Uri) {}

    resolveWebviewView(webviewView: vscode.WebviewView) {
        webviewView.webview.options = {
            enableScripts: true,
            localResourceRoots: [this._extensionUri]
        };

        const scriptUri = webviewView.webview.asWebviewUri(
            vscode.Uri.joinPath(this._extensionUri, 'dist', 'webview', 'index.js')
        );

        webviewView.webview.html = `<!DOCTYPE html>
            <html>
            <head><meta charset="UTF-8"></head>
            <body>
                <div id="root"></div>
                <script src="${scriptUri}"></script>
            </body>
            </html>`;
    }
}
```

---

## Minimal React Entry Point

```typescript
// src/webview/index.tsx
import React from 'react';
import ReactDOM from 'react-dom/client';
import { VesperaForge } from '../vespera-forge/components/core/VesperaForge';

const root = ReactDOM.createRoot(document.getElementById('root')!);
root.render(
    <VesperaForge
        platformAdapter={null} // TODO: Create VS Code adapter
        onCodexCreate={() => {}}
        onCodexUpdate={() => {}}
        onCodexDelete={() => {}}
    />
);
```

---

## Extension Registration

```typescript
// src/extension.ts (add to activate function)
import { VesperaForgeWebviewProvider } from './webview/VesperaForgeWebviewProvider';

export function activate(context: vscode.ExtensionContext) {
    const provider = new VesperaForgeWebviewProvider(context.extensionUri);

    context.subscriptions.push(
        vscode.window.registerWebviewViewProvider(
            'vespera-forge.mainView',
            provider
        )
    );
}
```

---

## Webpack Configuration for Webview

```javascript
// webpack.config.js (add second config)
module.exports = [
  // Existing extension config
  { /* ... extension config ... */ },

  // New webview config
  {
    target: 'web',
    entry: './src/webview/index.tsx',
    output: {
      path: path.resolve(__dirname, 'dist/webview'),
      filename: 'index.js'
    },
    module: {
      rules: [
        { test: /\.tsx?$/, use: 'ts-loader' },
        { test: /\.css$/, use: ['style-loader', 'css-loader', 'postcss-loader'] }
      ]
    },
    resolve: {
      extensions: ['.tsx', '.ts', '.js']
    }
  }
];
```

---

## Testing Checklist

- [ ] Extension compiles without errors
- [ ] Webview appears in activity bar
- [ ] React app loads in webview
- [ ] Three-panel layout visible
- [ ] Tailwind styles applied
- [ ] Components render correctly
- [ ] Console has no errors

---

## Debugging

**Open Webview Developer Tools:**
- `Ctrl+Shift+P` → "Developer: Open Webview Developer Tools"

**Common Issues:**
- **Webview blank**: Check CSP in HTML, verify script URI
- **Styles missing**: Ensure PostCSS/Tailwind configured
- **Components not rendering**: Check React/ReactDOM versions
- **Build errors**: Verify webpack config, TypeScript paths

---

## Next Steps After Basic Integration

1. Implement VS Code platform adapter
2. Connect to existing Bindery backend
3. Wire up command palette commands
4. Add file system integration
5. Test all features work end-to-end

---

## Need More Detail?

See `INTEGRATION_PROMPT.md` for comprehensive step-by-step guide.
