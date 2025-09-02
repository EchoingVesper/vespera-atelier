# Chat System Development Guide

This document provides guidance for implementing and extending the Vespera Forge chat system.

## Quick Start

### 1. Integration with Main Extension

Add to your main extension file (`src/extension.ts`):

```typescript
import { VesperaChatSystem } from './chat';

let chatSystem: VesperaChatSystem;

export async function activate(context: vscode.ExtensionContext) {
  try {
    // Initialize chat system
    chatSystem = new VesperaChatSystem(context);
    await chatSystem.initialize();
    
    console.log('Vespera Forge Chat System activated');
  } catch (error) {
    console.error('Failed to activate chat system:', error);
    vscode.window.showErrorMessage('Failed to activate chat system');
  }
}

export function deactivate() {
  if (chatSystem) {
    chatSystem.dispose();
  }
}
```

### 2. Package.json Configuration

Add the required configuration and commands to your `package.json`:

```json
{
  "contributes": {
    "configuration": {
      "title": "Vespera Forge Chat",
      "properties": {
        "vesperaForge.chat.providers": {
          "type": "object",
          "description": "Chat provider configurations"
        },
        "vesperaForge.chat.ui.theme": {
          "type": "string",
          "enum": ["auto", "light", "dark"],
          "default": "auto",
          "description": "Chat UI theme"
        },
        "vesperaForge.chat.ui.layout": {
          "type": "string",
          "enum": ["embedded", "sidebar", "floating", "panel"],
          "default": "embedded",
          "description": "Chat layout mode"
        },
        "vesperaForge.chat.integration.taskIntegration": {
          "type": "boolean",
          "default": true,
          "description": "Enable task integration from chat messages"
        }
      }
    },
    "commands": [
      {
        "command": "vesperaForge.showChat",
        "title": "Show Chat",
        "category": "Vespera Forge"
      },
      {
        "command": "vesperaForge.configureChatProviders",
        "title": "Configure Chat Providers",
        "category": "Vespera Forge"
      }
    ],
    "views": {
      "explorer": [
        {
          "type": "webview",
          "id": "vesperaForge.chatView",
          "name": "Chat",
          "when": "vesperaForge.chatEnabled"
        }
      ]
    },
    "keybindings": [
      {
        "command": "vesperaForge.showChat",
        "key": "ctrl+shift+c",
        "mac": "cmd+shift+c"
      }
    ]
  }
}
```

## Implementation Checklist

### Phase 1: Core Infrastructure ✅

- [✅] Template Registry with JSON5 parsing structure
- [✅] Base Provider abstraction and interface
- [✅] Configuration Manager with VS Code settings
- [✅] Event Router with VesperaEvents integration placeholder
- [✅] Basic WebView Provider setup
- [✅] Core TypeScript interfaces and types

### Phase 2: Provider Implementation 🚧

- [🚧] OpenAI Provider implementation (skeleton created)
  - [ ] Actual HTTP requests using fetch/axios
  - [ ] Proper error handling and retry logic
  - [ ] Streaming response parsing
  - [ ] Function calling support
- [🚧] Anthropic Provider implementation (skeleton created)
  - [ ] Anthropic Messages API integration
  - [ ] Claude-specific message formatting
  - [ ] Streaming support
- [🚧] LM Studio Provider implementation (skeleton created)
  - [ ] Local server connection handling
  - [ ] Model discovery and selection
  - [ ] Local model response parsing
- [✅] Provider Factory for dynamic creation
- [ ] Provider configuration validation

### Phase 3: UI Implementation 🚧

- [🚧] Atomic UI components (basic structure created)
  - [✅] Message component
  - [✅] SendButton component
  - [✅] ProviderIcon component
  - [✅] StatusIndicator component
  - [✅] MessageInput molecule
  - [✅] ProviderSelector molecule
  - [✅] ChatWindow organism
  - [ ] Configuration flyout component
  - [ ] Theme integration components
- [✅] WebView HTML/CSS/JS foundation
- [ ] Responsive design implementation
- [ ] Accessibility features
- [ ] Keyboard shortcuts

### Phase 4: Advanced Features 📋

- [ ] Message persistence (SQLite/IndexedDB)
- [ ] Chat history search and filtering
- [ ] Export functionality (JSON, Markdown, PDF)
- [ ] Task integration with suggestions
- [ ] Multi-thread conversation support
- [ ] Error recovery and retry mechanisms

## Development Workflows

### Adding a New Provider

1. **Create Template**: Add a new JSON5 file in `templates/providers/`
2. **Implement Provider**: Extend `BaseProvider` class
3. **Register Provider**: Add to `ProviderFactory`
4. **Test Integration**: Verify connection and messaging

Example:
```typescript
// 1. Create template: templates/providers/my-provider.json5
{
  template_id: "my-provider",
  name: "My Custom Provider",
  provider_config: {
    provider_type: "my_provider",
    // ... configuration
  },
  // ... rest of template
}

// 2. Implement provider
export class MyProvider extends ChatProvider {
  async connect(): Promise<void> {
    // Implementation
  }
  
  async sendMessage(message: ChatMessage): Promise<ChatResponse> {
    // Implementation
  }
  
  async* streamMessage(message: ChatMessage): AsyncIterable<ChatChunk> {
    // Implementation
  }
  
  async disconnect(): Promise<void> {
    // Implementation
  }
}

// 3. Register provider
ProviderFactory.registerProvider('my_provider', MyProvider);
```

### Adding UI Components

Follow atomic design principles:

1. **Atoms**: Basic building blocks (buttons, inputs, icons)
2. **Molecules**: Composed components (input groups, status displays)
3. **Organisms**: Complex components (chat windows, configuration panels)
4. **Templates**: Layout components (full interfaces)

### Testing Providers

Use the mock implementations to test UI without actual API calls:

```typescript
// Enable mock mode in provider
const mockProvider = new OpenAIProvider(template, { ...config, mockMode: true });
```

## Troubleshooting

### Common Issues

1. **WebView not loading**: Check CSP settings and resource URIs
2. **Provider not connecting**: Verify API keys and endpoints
3. **Messages not displaying**: Check event router and message formatting
4. **Configuration not saving**: Verify VS Code settings integration

### Debug Mode

Enable debug mode in configuration:

```json
{
  "vesperaForge.chat.advanced.debugMode": true
}
```

This will enable:
- Detailed console logging
- Request/response logging
- Event emission tracking
- Template loading details

### Performance Monitoring

Monitor chat system performance:

```typescript
// Enable performance monitoring
const perfObserver = new PerformanceObserver((list) => {
  list.getEntries().forEach(entry => {
    console.log(`[Chat Performance] ${entry.name}: ${entry.duration}ms`);
  });
});
```

## Architecture Decisions

### Why Template-Driven?

- **Extensibility**: New providers without code changes
- **User Customization**: Users can create custom providers
- **Maintenance**: Configuration changes don't require rebuilds
- **Consistency**: Unified interface across all providers

### Why Atomic Design?

- **Reusability**: Components can be composed in different ways
- **Testing**: Small, focused components are easier to test
- **Maintenance**: Changes to atoms propagate to all compositions
- **Consistency**: Design system ensures uniform appearance

### Why Event-Driven?

- **Decoupling**: Components don't need direct references
- **Integration**: Easy integration with existing VesperaEvents
- **Extensibility**: New event handlers can be added easily
- **Debugging**: Event flow is traceable and loggable

## Next Steps

1. **Implement HTTP Client**: Replace mock responses with actual HTTP requests
2. **Add Provider Authentication**: Implement secure credential management
3. **Build Configuration UI**: Create provider setup and management interface
4. **Add Persistence**: Implement chat history storage
5. **Enhance UI**: Add themes, animations, and accessibility features
6. **Write Tests**: Add comprehensive unit and integration tests
7. **Performance Optimization**: Implement virtual scrolling and streaming optimizations

## Resources

- [Architecture Specification](../../docs/chat-system-architecture.md)
- [VS Code WebView API](https://code.visualstudio.com/api/extension-guides/webview)
- [VS Code Configuration API](https://code.visualstudio.com/api/references/contribution-points#contributes.configuration)
- [Atomic Design Methodology](https://atomicdesign.bradfrost.com/)

## Contributing

When contributing to the chat system:

1. Follow the existing patterns and architecture
2. Add comprehensive TODO comments for incomplete features
3. Update type definitions for new functionality
4. Test with multiple providers where possible
5. Ensure VS Code theme compatibility
6. Consider accessibility in all UI components
7. Document any architectural decisions or changes