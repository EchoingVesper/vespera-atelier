---
title: Developer Getting Started Guide
category: development
difficulty: beginner  
time_estimate: "30 minutes"
prerequisites: ["Node.js 18+", "VS Code", "TypeScript knowledge"]
last_updated: 2025-01-09
---

# Developer Getting Started Guide

## Prerequisites

Before contributing to Vespera Forge, ensure you have:

- **Node.js 18+** with npm/yarn
- **VS Code** (latest stable version)
- **TypeScript** experience (intermediate level)
- **Git** for version control
- **Basic VS Code Extension** development knowledge (helpful)

Optional for full functionality:
- **Rust toolchain** (for Bindery backend development)
- **Cargo** (Rust package manager)

## Quick Setup

### 1. Clone the Repository

```bash
# Clone the monorepo
git clone https://github.com/vespera-atelier/vespera-atelier.git
cd vespera-atelier

# Navigate to the extension directory
cd plugins/VSCode/vespera-forge
```

### 2. Install Dependencies

```bash
# Install Node.js dependencies
npm install

# Alternative: if you prefer yarn
yarn install
```

### 3. Build the Extension

```bash
# Development build with watch mode
npm run watch

# Production build (optimized)
npm run package

# Clean build artifacts
npm run clean
```

### 4. Launch Development Environment

```bash
# Option 1: Use the provided launch configuration
# Open in VS Code and press F5

# Option 2: Manual launch
code --extensionDevelopmentPath=$(pwd) --new-window
```

## Development Workflow

### Project Structure

```
vespera-forge/
├── src/                          # TypeScript source code
│   ├── extension.ts             # Extension entry point
│   ├── services/                # Backend integration layer
│   │   └── bindery.ts          # Bindery service implementation
│   ├── views/                   # UI components
│   │   ├── task-tree-view.ts   # Tree view provider
│   │   ├── task-dashboard.ts   # WebView dashboard
│   │   └── status-bar.ts       # Status bar integration
│   ├── types/                   # TypeScript type definitions
│   │   └── bindery.ts          # API interfaces
│   ├── utils/                   # Utility functions
│   └── test/                    # Test files
├── media/                       # WebView assets (HTML/CSS/JS)
├── out/                         # Compiled JavaScript (build artifacts)
├── dist/                        # Webpack bundled extension
├── docs/                        # Documentation (you're reading this!)
├── package.json                 # Extension manifest
├── tsconfig.json               # TypeScript configuration
├── webpack.config.js           # Webpack bundling configuration
└── .vscode/                    # VS Code development settings
    ├── launch.json             # Debug configurations
    ├── settings.json           # Workspace settings
    └── tasks.json              # Build tasks
```

### Key Development Commands

```bash
# Development workflows
npm run compile                  # Compile TypeScript to JavaScript
npm run watch                   # Watch mode for development
npm run dev                     # Clean + watch (development shortcut)

# Building and packaging
npm run package                 # Production webpack build
npm run vscode:prepublish       # Pre-publish build step

# Code quality
npm run lint                    # ESLint code analysis
npm run lint:fix               # Auto-fix linting issues

# Testing
npm run compile-tests          # Compile test files
npm run pretest               # Prepare test environment
npm run test                  # Run all tests

# Cleanup
npm run clean                 # Remove build artifacts
```

## Extension Development Mode

### Launch Configuration

The extension includes pre-configured launch settings in `.vscode/launch.json`:

```json
{
  "name": "Run Extension",
  "type": "extensionHost", 
  "request": "launch",
  "args": [
    "--extensionDevelopmentPath=${workspaceFolder}"
  ],
  "outFiles": [
    "${workspaceFolder}/out/**/*.js"
  ],
  "preLaunchTask": "${workspaceFolder}:watch"
}
```

### Development Process

1. **Start Watch Mode**:
   ```bash
   npm run watch
   ```
   This continuously compiles TypeScript changes.

2. **Launch Extension Host**:
   - Press `F5` in VS Code
   - Or use `Ctrl+Shift+P` → "Debug: Start Debugging"

3. **Test Changes**:
   - Changes are automatically reflected in the Extension Development Host
   - Use `Ctrl+R` to reload the extension host window

4. **Debug**:
   - Set breakpoints in TypeScript source files
   - Use VS Code debugging tools (variables, call stack, etc.)
   - Console output appears in the Debug Console

### Mock Mode Development

The extension includes a comprehensive mock mode for development without the Rust Bindery backend:

```typescript
// Mock mode automatically activated when Bindery not found
private async handleMockRequest<T>(method: string, params?: any): Promise<BinderyResult<T>> {
  // Simulate realistic network delays
  await new Promise(resolve => setTimeout(resolve, 100 + Math.random() * 200));
  
  switch (method) {
    case 'get_task_dashboard':
      return {
        success: true,
        data: {
          total_tasks: 12,
          status_breakdown: { 
            Todo: 5, 
            Doing: 3, 
            Review: 2, 
            Done: 2 
          },
          // ... more mock data
        } as any
      };
  }
}
```

**Mock Mode Benefits**:
- ✅ Full UI functionality without backend
- ✅ Realistic async behavior with delays
- ✅ Comprehensive test data
- ✅ Error simulation capabilities
- ✅ Perfect for UI development and demos

## Code Organization Patterns

### Service Layer Pattern

All backend communication goes through the `BinderyService` class:

```typescript
// services/bindery.ts
export class BinderyService extends EventEmitter {
  // High-level API methods
  async createTask(input: TaskInput): Promise<BinderyResult<CodexId>> {
    return this.sendRequest('create_task', { task_input: input });
  }
  
  // Low-level communication
  private async sendRequest<T>(method: string, params?: any): Promise<BinderyResult<T>> {
    // JSON-RPC communication with error handling
  }
}

// Singleton access pattern
export function getBinderyService(): BinderyService {
  return binderyServiceInstance || (binderyServiceInstance = new BinderyService());
}
```

### UI Component Pattern

UI components implement VS Code provider interfaces:

```typescript
// views/task-tree-view.ts
export class TaskTreeDataProvider implements vscode.TreeDataProvider<TaskTreeItem> {
  // Required VS Code TreeDataProvider methods
  getTreeItem(element: TaskTreeItem): vscode.TreeItem { /* */ }
  getChildren(element?: TaskTreeItem): Promise<TaskTreeItem[]> { /* */ }
  
  // Custom methods for extension control
  refresh(): void { this._onDidChangeTreeData.fire(); }
  refreshTask(taskId: CodexId): void { /* */ }
}
```

### Type Safety Strategy

Strong typing throughout the codebase:

```typescript
// types/bindery.ts - Comprehensive type definitions
export interface TaskInput {
  title: string;
  description: string;
  parent_id?: CodexId;
  priority?: TaskPriority;
  due_date?: string;
  tags: string[];
  labels: Record<string, string>;
  subtasks: TaskInput[];
}

export interface BinderyResult<T> {
  success: boolean;
  data?: T;
  error?: BinderyError;
}

// Usage with full type safety
const result: BinderyResult<CodexId> = await binderyService.createTask(taskInput);
if (result.success) {
  console.log(`Created task: ${result.data}`); // TypeScript knows this is CodexId
}
```

## Testing Strategy

### Unit Testing Setup

```typescript
// src/test/extension.test.ts
import * as vscode from 'vscode';
import * as assert from 'assert';
import { getBinderyService } from '../services/bindery';

suite('Extension Test Suite', () => {
  test('Bindery service initialization', async () => {
    const service = getBinderyService();
    assert.ok(service);
    
    // Test mock mode functionality
    const versionResult = await service.getVersionInfo();
    assert.ok(versionResult);
  });
});
```

### Integration Testing

```typescript
// src/test/bindery-integration.test.ts
suite('Bindery Integration Tests', () => {
  let service: BinderyService;
  
  setup(() => {
    service = getBinderyService();
  });
  
  test('Task CRUD operations', async () => {
    // Create task
    const createResult = await service.createTask({
      title: 'Test Task',
      description: 'Integration test task',
      tags: ['test'],
      labels: {},
      subtasks: []
    });
    
    assert.ok(createResult.success);
    const taskId = createResult.data!;
    
    // Get task
    const getResult = await service.getTask(taskId);
    assert.ok(getResult.success);
    assert.strictEqual(getResult.data!.title, 'Test Task');
    
    // Update task
    const updateResult = await service.updateTask({
      task_id: taskId,
      status: TaskStatus.Done
    });
    assert.ok(updateResult.success);
  });
});
```

### Running Tests

```bash
# Compile tests
npm run compile-tests

# Run all tests
npm run test

# Run tests with VS Code UI (helpful for debugging)
# Open Command Palette -> "Test: Run All Tests"
```

## Debugging Techniques

### Extension Debugging

1. **Set Breakpoints**: In TypeScript source files
2. **Launch Debug**: Press F5 or use Debug view
3. **Extension Development Host**: New VS Code window opens
4. **Trigger Functionality**: Use extension commands/UI
5. **Debug Console**: View console output and evaluate expressions

### Service Layer Debugging

```typescript
class BinderyService {
  private log(...args: any[]): void {
    if (this.config.enableLogging) {
      console.log('[BinderyService]', ...args);
    }
  }
  
  private async sendRequest<T>(method: string, params?: any): Promise<BinderyResult<T>> {
    this.log(`Sending request: ${method}`, params);
    
    // Request logic...
    
    this.log(`Received response for ${method}:`, result);
    return result;
  }
}
```

### WebView Debugging

For the Task Dashboard WebView:

1. **Open WebView**: Launch the Task Dashboard
2. **Developer Tools**: Right-click in WebView → "Open Developer Tools"
3. **Debug Web Code**: Use Chrome DevTools for HTML/CSS/JavaScript
4. **Message Passing**: Debug extension ↔ WebView communication

## Contributing Guidelines

### Code Style

The project uses ESLint with TypeScript rules:

```bash
# Check code style
npm run lint

# Auto-fix style issues
npm run lint:fix
```

**Key Style Guidelines**:
- Use TypeScript strict mode
- Prefer `const` over `let` where possible
- Use descriptive variable and function names
- Add JSDoc comments for public APIs
- Follow VS Code extension patterns

### Git Workflow

```bash
# Create feature branch
git checkout -b feature/my-new-feature

# Make changes and commit
git add .
git commit -m "feat(ui): add task priority filtering"

# Push branch
git push origin feature/my-new-feature

# Create pull request on GitHub
```

**Commit Message Format**:
```
type(scope): description

feat(services): add task dependency analysis
fix(ui): resolve tree view refresh issues  
docs(api): update bindery service documentation
test(integration): add mock mode test coverage
```

### Pull Request Process

1. **Fork** the repository
2. **Create** feature branch from `main`
3. **Implement** changes with tests
4. **Run** full test suite
5. **Submit** pull request with description
6. **Address** code review feedback
7. **Merge** after approval

## Troubleshooting

### Common Issues

**Extension Won't Load**:
```bash
# Clear build artifacts
npm run clean

# Reinstall dependencies
rm -rf node_modules package-lock.json
npm install

# Rebuild
npm run compile
```

**TypeScript Errors**:
```bash
# Check TypeScript version compatibility
npx tsc --version

# Verify VS Code API types
npm list @types/vscode

# Rebuild with verbose output
npx tsc --build --verbose
```

**Mock Mode Not Working**:
- Check console for Bindery connection errors
- Verify mock request handlers in `BinderyService`
- Ensure proper error fallback paths

**WebView Not Loading**:
- Check Content Security Policy in HTML
- Verify asset URI generation with `webview.asWebviewUri()`
- Use browser DevTools for WebView debugging

### Getting Help

- **GitHub Issues**: Report bugs and feature requests
- **Discussions**: Ask questions and share ideas  
- **Documentation**: Check the `/docs` folder for detailed guides
- **Code Comments**: Read inline documentation in source files

## Next Steps

After completing this setup:

1. **Explore the Codebase**: Study the service layer and UI components
2. **Run Tests**: Ensure everything works in your environment
3. **Make Small Changes**: Start with minor improvements or bug fixes
4. **Read Architecture Docs**: Understand the system design
5. **Check Open Issues**: Find tasks to contribute to

---

You're now ready to contribute to Vespera Forge! The extension provides a solid foundation for AI-enhanced task orchestration with comprehensive TypeScript typing, mock development mode, and native VS Code integration patterns.