# Vespera Forge Infrastructure Migration Guide

This guide demonstrates how to migrate existing code to use the new infrastructure components and provides examples for implementation agents.

## Table of Contents

1. [Core Services Setup](#core-services-setup)
2. [Error Handling Migration](#error-handling-migration)
3. [Memory Management Upgrade](#memory-management-upgrade)
4. [Provider Migration](#provider-migration)
5. [Testing Examples](#testing-examples)

## Core Services Setup

### Before: Basic Extension Activation

```typescript
// OLD: extension.ts
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('Extension activated!');
  
  const { contentProvider, treeDataProvider } = initializeProviders(context);
  const viewContext = initializeViews(context);
  
  const vesperaContext: VesperaForgeContext = {
    extensionContext: context,
    contentProvider,
    config: getConfig(),
    isInitialized: false
  };
  
  (vesperaContext as any)._viewContext = viewContext;
  globalExtensionContext = vesperaContext;
  
  registerCommands(context, vesperaContext);
}
```

### After: Core Services Integration

```typescript
// NEW: extension.ts
import { VesperaCoreServices } from '@/core';

export async function activate(context: vscode.ExtensionContext): Promise<void> {
  try {
    // Initialize core infrastructure first
    const coreServices = await VesperaCoreServices.initialize(context, {
      logging: {
        level: LogLevel.DEBUG, // Adjust based on environment
        enableConsole: true,
        enableVSCodeOutput: true
      },
      telemetry: {
        enabled: true
      },
      memoryMonitoring: {
        enabled: true,
        thresholdMB: 100
      }
    });

    const { logger, errorHandler, contextManager } = coreServices;
    logger.info('Extension activation started');

    // Initialize providers with error handling
    const { contentProvider, treeDataProvider } = initializeProviders(context);
    const viewContext = initializeViews(context);
    
    // Use memory-safe context management
    contextManager.setViewContext(context, viewContext);
    
    const vesperaContext: VesperaForgeContext = {
      extensionContext: context,
      contentProvider,
      config: getConfig(),
      isInitialized: false,
      coreServices
    };
    
    registerCommands(context, vesperaContext);
    
    vesperaContext.isInitialized = true;
    logger.info('Extension activation completed successfully');
    
  } catch (error) {
    console.error('Extension activation failed:', error);
    // Core services will handle error reporting if available
    throw error;
  }
}
```

## Error Handling Migration

### Before: Inconsistent Error Handling

```typescript
// OLD: ConfigurationManager.ts (lines 756-762)
} catch (error) {
  console.error(`Failed to store sensitive field ${field.name} securely:`, error);
  throw new Error(`Failed to store ${field.name} securely: ${error instanceof Error ? error.message : 'Unknown error'}`);
}
```

### After: Standardized Error Handling

```typescript
// NEW: ConfigurationManager.ts
import { 
  VesperaConfigurationError, 
  VesperaErrorCode,
  VesperaErrorHandler 
} from '@/core';

} catch (error) {
  const vesperaError = new VesperaConfigurationError(
    `Failed to store sensitive field ${field.name} securely`,
    VesperaErrorCode.CREDENTIAL_STORAGE_FAILED,
    { 
      context: { 
        providerId, 
        fieldName: field.name,
        originalError: error instanceof Error ? error.message : String(error)
      } 
    },
    error instanceof Error ? error : new Error(String(error))
  );
  
  // Error handler decides whether to throw based on strategy
  await VesperaErrorHandler.getInstance().handleError(vesperaError);
}
```

### Custom Error Handling Strategy

```typescript
// Override default error handling strategy
const errorHandler = VesperaErrorHandler.getInstance();

errorHandler.setStrategy(VesperaErrorCode.CREDENTIAL_STORAGE_FAILED, {
  shouldLog: true,
  shouldNotifyUser: true,
  shouldThrow: true,
  shouldRetry: false
});

// Handle error with custom strategy
await errorHandler.handleErrorWithStrategy(error, {
  shouldNotifyUser: false, // Override default to suppress user notification
  shouldRetry: true,
  maxRetries: 2
});
```

## Memory Management Upgrade

### Before: Global Context Storage

```typescript
// OLD: extension.ts (lines 86-100)
let globalExtensionContext: VesperaForgeContext | undefined;

export async function deactivate(): Promise<void> {
  if (globalExtensionContext && (globalExtensionContext as any)._viewContext) {
    const viewContext = (globalExtensionContext as any)._viewContext;
    
    if (viewContext.chatPanelProvider && typeof viewContext.chatPanelProvider.dispose === 'function') {
      viewContext.chatPanelProvider.dispose();
    }
    // Manual disposal for each provider...
  }
  globalExtensionContext = undefined;
}
```

### After: Memory-Safe Context Management

```typescript
// NEW: extension.ts
import { VesperaContextManager } from '@/core';

export async function deactivate(): Promise<void> {
  try {
    const contextManager = VesperaContextManager.getInstance();
    
    // Dispose view context safely
    await contextManager.disposeViewContext(context);
    
    // Dispose core services
    await VesperaCoreServices.dispose();
    
  } catch (error) {
    console.error('Extension deactivation error:', error);
  }
}
```

## Provider Migration

### Before: Basic Provider

```typescript
// OLD: ChatWebViewProvider
export class ChatWebViewProvider implements vscode.WebviewViewProvider {
  constructor(private context: vscode.ExtensionContext) {}
  
  resolveWebviewView(webviewView: vscode.WebviewView): void {
    webviewView.webview.onDidReceiveMessage(message => {
      try {
        this.handleMessage(message);
      } catch (error) {
        console.error('Message handling error:', error);
      }
    });
  }
  
  dispose() {
    // Manual cleanup
  }
}
```

### After: Enhanced Base Provider

```typescript
// NEW: ChatWebViewProvider
import { BaseWebViewProvider } from '@/core';

export class ChatWebViewProvider extends BaseWebViewProvider {
  constructor(context: vscode.ExtensionContext) {
    super(context, undefined, 90); // High disposal priority for UI
  }

  protected setupWebview(webviewView: vscode.WebviewView): void {
    // Set up webview HTML
    webviewView.webview.html = this.getWebviewContent();
    
    // Register message handler with automatic error handling
    this.registerMessageHandler(async (message) => {
      await this.handleMessage(message);
    });
    
    this.logger.info('Chat webview setup completed');
  }

  private async handleMessage(message: any): Promise<void> {
    this.ensureNotDisposed('message handling');
    
    switch (message.type) {
      case 'sendMessage':
        await this.processChatMessage(message.payload);
        break;
      case 'clearHistory':
        await this.clearChatHistory();
        break;
      default:
        this.logger.warn('Unknown message type:', message.type);
    }
  }

  private getWebviewContent(): string {
    const scriptUri = this.getWebviewUri('media', 'chat.js');
    const styleUri = this.getWebviewUri('media', 'chat.css');
    
    return `<!DOCTYPE html>
      <html>
        <head>
          <link href="${styleUri}" rel="stylesheet">
        </head>
        <body>
          <div id="chat-container"></div>
          <script src="${scriptUri}"></script>
        </body>
      </html>`;
  }
}
```

### Service Migration Example

```typescript
// NEW: Service with lifecycle management
import { BaseService } from '@/core';

export class BinderyConnectionService extends BaseService {
  private connection?: WebSocket;
  
  constructor() {
    super(undefined, 75); // Medium-high priority
  }

  protected async onStart(): Promise<void> {
    this.connection = new WebSocket(this.getBinderyUrl());
    
    this.connection.onopen = () => {
      this.logger.info('Bindery connection established');
    };
    
    this.connection.onerror = (error) => {
      this.logger.error('Bindery connection error', error);
    };
  }

  protected async onStop(): Promise<void> {
    if (this.connection) {
      this.connection.close();
      this.connection = undefined;
      this.logger.info('Bindery connection closed');
    }
  }

  private getBinderyUrl(): string {
    // Implementation details...
    return 'ws://localhost:8080';
  }
}
```

## Testing Examples

### Error Handling Tests

```typescript
// test/error-handling.test.ts
import { suite, test } from 'mocha';
import * as assert from 'assert';
import { 
  VesperaConfigurationError, 
  VesperaErrorCode,
  VesperaErrorHandler 
} from '@/core';

suite('VesperaErrorHandler', () => {
  test('handles configuration errors correctly', async () => {
    const error = new VesperaConfigurationError(
      'Test config error',
      VesperaErrorCode.CONFIGURATION_LOAD_FAILED
    );
    
    const handler = VesperaErrorHandler.getInstance();
    
    // This should log and potentially retry but not throw (based on default strategy)
    await handler.handleError(error);
    
    // Verify error was handled according to strategy
    const strategy = handler.getStrategy(VesperaErrorCode.CONFIGURATION_LOAD_FAILED);
    assert.strictEqual(strategy.shouldLog, true);
    assert.strictEqual(strategy.shouldRetry, true);
  });
});
```

### Memory Management Tests

```typescript
// test/memory-management.test.ts
import { suite, test } from 'mocha';
import * as assert from 'assert';
import * as sinon from 'sinon';
import { VesperaContextManager } from '@/core';

suite('VesperaContextManager', () => {
  test('properly disposes view contexts', async () => {
    const contextManager = VesperaContextManager.getInstance();
    const mockContext = {} as vscode.ExtensionContext;
    
    const mockProvider = {
      dispose: sinon.spy(),
      isDisposed: false
    };
    
    contextManager.setViewContext(mockContext, { 
      chatPanelProvider: mockProvider 
    });
    
    await contextManager.disposeViewContext(mockContext);
    
    assert(mockProvider.dispose.calledOnce);
  });
  
  test('tracks resource registrations', () => {
    const contextManager = VesperaContextManager.getInstance();
    
    const mockResource = {
      dispose: sinon.spy(),
      isDisposed: false
    };
    
    const resourceId = contextManager.registerResource(mockResource, 'TestResource');
    
    assert(typeof resourceId === 'string');
    assert(resourceId.includes('TestResource'));
    
    const metadata = contextManager.getResourceMetadata(resourceId);
    assert(metadata);
    assert.strictEqual(metadata.type, 'TestResource');
  });
});
```

### Provider Tests

```typescript
// test/providers.test.ts
import { suite, test } from 'mocha';
import * as assert from 'assert';
import * as vscode from 'vscode';
import { ChatWebViewProvider } from '@/views/chat-panel';

suite('Enhanced Providers', () => {
  test('ChatWebViewProvider initializes correctly', () => {
    const mockContext = {} as vscode.ExtensionContext;
    const provider = new ChatWebViewProvider(mockContext);
    
    assert.strictEqual(provider.disposalPriority, 90);
    assert.strictEqual(provider.isDisposed, false);
    
    // Test stats
    const stats = provider.getStats();
    assert.strictEqual(stats.isResolved, false);
    assert.strictEqual(stats.hasMessageHandler, false);
  });
  
  test('BaseWebViewProvider handles disposal correctly', async () => {
    const mockContext = {} as vscode.ExtensionContext;
    const provider = new ChatWebViewProvider(mockContext);
    
    await provider.dispose();
    
    assert.strictEqual(provider.isDisposed, true);
  });
});
```

## Implementation Checklist for Agents

When implementing the infrastructure migration:

### Phase 1: Core Setup
- [ ] Install core services in extension activation
- [ ] Update deactivation to use proper disposal
- [ ] Configure logging levels appropriately
- [ ] Set up error handling strategies

### Phase 2: Provider Migration  
- [ ] Convert providers to extend BaseWebViewProvider or BaseService
- [ ] Replace manual disposal with disposal manager
- [ ] Add proper error handling to all operations
- [ ] Update message handling patterns

### Phase 3: Memory Management
- [ ] Replace global context storage with VesperaContextManager
- [ ] Register all resources with context manager
- [ ] Add memory monitoring for critical components
- [ ] Clean up type casting and unsafe operations

### Phase 4: Testing
- [ ] Add unit tests for error handling scenarios
- [ ] Test memory management and disposal
- [ ] Verify provider lifecycle management
- [ ] Add integration tests for core services

### Phase 5: Validation
- [ ] Compile with strict TypeScript settings
- [ ] Run all tests and ensure they pass
- [ ] Test in both development and production modes
- [ ] Verify memory usage improvements
- [ ] Confirm error handling works as expected

## Best Practices

1. **Always use the core services**: Don't bypass the infrastructure for logging, error handling, or memory management.

2. **Proper disposal**: Always extend BaseDisposable or BaseService for new components that need cleanup.

3. **Error context**: Include meaningful context in VesperaError instances for debugging.

4. **Type safety**: Use the provided type guards and TypeScript types for runtime safety.

5. **Testing**: Write tests that verify error handling, disposal, and memory management.

6. **Documentation**: Document any custom error handling strategies or disposal requirements.

This infrastructure provides a solid foundation for maintainable, reliable VS Code extension development with enterprise-grade error handling and memory management.