# Vespera Forge UI System

A comprehensive TypeScript UI system for template-driven content management, compatible with both VS Code and Obsidian plugins.

## Features

### Core Architecture
- **Universal Codex System**: All content types (tasks, characters, scenes, music, etc.) are unified as Codex entries
- **Template-Driven Behavior**: Define how content behaves through customizable templates
- **Mixin System**: Reusable template components for specific capabilities
- **Context-Aware UI**: Interface adapts based on user role, workflow stage, and project context

### Three-Panel Layout
- **Left Panel**: Codex Tree Navigator with smart views and organization
- **Center Panel**: Context-adaptive template rendering with multiple view modes
- **Right Panel**: Template-aware AI assistant with specialized personalities

### Cross-Platform Compatibility
- **VS Code Extension**: Full webview integration with VS Code API
- **Obsidian Plugin**: Native Obsidian integration with workspace and vault access
- **Shared Components**: Maximum code reuse between platforms
- **Platform Adapters**: Abstract platform-specific functionality

### Advanced Features
- **Responsive Design**: Mobile, tablet, and desktop layouts
- **AI Integration**: Template-aware AI assistants with contextual expertise
- **Workflow Management**: Template-defined workflow states and transitions
- **Relationship Visualization**: Interactive relationship graphs between codices
- **Real-time Collaboration**: Multi-user support with conflict resolution

## Quick Start

### VS Code Extension

```typescript
import { activate, deactivate } from 'vespera-forge/plugins/vscode-extension';

export function activate(context: vscode.ExtensionContext) {
    // Use the Vespera Forge activation
    return activate(context);
}

export function deactivate() {
    // Use the Vespera Forge deactivation
    return deactivate();
}
```

### Obsidian Plugin

```typescript
import VesperaForgePlugin from 'vespera-forge/plugins/obsidian-plugin';

export default class MyPlugin extends VesperaForgePlugin {
    // Custom plugin logic here
}
```

### Standalone Usage

```typescript
import { VesperaForge, createAdapter } from 'vespera-forge';

// Create the appropriate adapter for your platform
const adapter = createAdapter('vscode'); // or 'obsidian'

// Use the main component
const app = (
    <VesperaForge
        platformAdapter={adapter}
        onCodexCreate={handleCreate}
        onCodexUpdate={handleUpdate}
        onCodexDelete={handleDelete}
    />
);
```

## Architecture

### Core Types

The system is built around these core concepts:

- **Codex**: Universal container for any content type
- **Template**: Defines behavior and appearance of codices
- **Mixin**: Reusable template components
- **Context**: User role, workflow stage, and environment
- **PlatformAdapter**: Abstracts platform-specific functionality

### Component Structure

```
src/vespera-forge/
├── core/
│   ├── types/           # TypeScript type definitions
│   └── adapters/        # Platform-specific adapters
├── components/
│   ├── layout/          # Layout components
│   ├── navigation/      # Navigation components
│   ├── editor/          # Content editor components
│   ├── ai/              # AI assistant components
│   └── core/            # Main application component
├── plugins/
│   ├── vscode-extension.ts  # VS Code extension entry
│   └── obsidian-plugin.ts   # Obsidian plugin entry
└── index.ts             # Main exports
```

### Template System

Templates define everything about how a codex behaves:

```typescript
const characterTemplate: Template = {
    id: 'character',
    name: 'Character',
    fields: [
        { id: 'name', type: 'text', required: true },
        { id: 'description', type: 'rich_text' },
        { id: 'age', type: 'number' }
    ],
    viewModes: [
        { id: 'sheet', layout: { type: 'single' } },
        { id: 'relationships', layout: { type: 'split' } }
    ],
    workflowStates: [
        { id: 'draft', name: 'Draft', color: '#gray' },
        { id: 'complete', name: 'Complete', color: '#green' }
    ],
    actions: [
        { id: 'develop-backstory', type: 'automation' }
    ]
};
```

## Platform-Specific Features

### VS Code Integration
- Webview-based UI with VS Code theming
- File system integration with workspace folders
- Command palette integration
- Status bar integration
- Tree view explorer

### Obsidian Integration
- Native workspace integration
- Vault file operations
- Command palette integration
- Settings tab
- Ribbon icon

## Development

### Building

```bash
# Install dependencies
pnpm install

# Build for production
pnpm build

# Development mode
pnpm dev
```

### Testing

```bash
# Run tests
pnpm test

# Run with coverage
pnpm test:coverage
```

### Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests for new functionality
5. Submit a pull request

## Configuration

### VS Code Extension Configuration

```json
{
    "contributes": {
        "commands": [
            {
                "command": "vespera-forge.open",
                "title": "Open Vespera Forge"
            }
        ],
        "views": {
            "explorer": [
                {
                    "id": "vespera-forge-explorer",
                    "name": "Vespera Forge"
                }
            ]
        }
    }
}
```

### Obsidian Plugin Configuration

```typescript
interface VesperaForgeSettings {
    defaultTemplate: string;
    autoSave: boolean;
    aiEnabled: boolean;
    theme: 'light' | 'dark' | 'auto';
}
```

## License

MIT License - see LICENSE file for details.

## Support

- Documentation: [Full documentation link]
- Issues: [GitHub issues link]
- Community: [Discord/Forum link]