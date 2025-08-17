# Modular Architecture for UI Components

## Overview

This document outlines the modular architecture for UI components in Vespera Scriptorium after the refactoring of `main.ts`. It provides guidelines for maintaining the modular structure, proper import/export patterns, and best practices to avoid common issues like circular dependencies and inconsistent import paths.

## Modular Architecture

### Directory Structure

The UI module is organized in the `src/ui` directory (lowercase) with the following structure:

```
src/ui/
├── index.ts                 # Main export file for the UI module
├── UIManager.ts             # Central manager for UI components
├── StyleManager.ts          # Manages CSS styles
├── Modal.ts                 # Base modal class
├── MultiSelectModal.ts      # File selection modal
├── ProgressPane.ts          # Progress visualization
├── OutputFilesView.ts       # Output files view
├── CheckpointManagerModal.ts # Checkpoint management
├── VaultTreeView.ts         # Vault file tree view
├── treeUtils.ts             # Utilities for tree views
└── robust-processing.css    # CSS styles for robust processing
```

> **IMPORTANT**: Always use the lowercase `src/ui` directory path for all UI components. The uppercase `src/UI` directory is deprecated and should not be used.

### Module Organization

The UI module follows a hierarchical organization:

1. **UIManager**: Central manager that coordinates all UI components
2. **Base Components**: Fundamental UI building blocks (Modal, etc.)
3. **Specialized Components**: Components for specific functionality (MultiSelectModal, ProgressPane, etc.)
4. **Utilities**: Helper functions and classes (treeUtils, etc.)

## Export and Import Patterns

### Proper Use of index.ts

The `index.ts` file in the UI module serves as the central export point for all UI components. This approach:

1. Provides a clean public API for the UI module
2. Hides implementation details
3. Makes imports cleaner in other modules
4. Facilitates refactoring without changing import paths throughout the codebase

Example of the proper `index.ts` structure:

```typescript
/**
 * UI module
 * Entry point for user interface management components
 * @module ui
 */

// Export components with clear comments indicating their source files
export { UIManager, SampleModal } from './UIManager';
export { StyleManager } from './StyleManager';
export { MultiSelectModal } from './MultiSelectModal';

// Export types separately for clarity
export type { FileTreeNode } from './MultiSelectModal';

// Re-export types from other modules when needed
export type { ModuleInterface } from '../core';
```

### Correct Import Paths

When importing UI components:

1. **Always** import from the UI module using the lowercase path:

```typescript
// CORRECT
import { MultiSelectModal } from './ui';
import { UIManager } from './ui/UIManager';

// INCORRECT - Do not use uppercase 'UI'
import { MultiSelectModal } from './UI';
import { UIManager } from './UI/UIManager';
```

2. **Prefer** importing from the module's index file rather than individual component files:

```typescript
// PREFERRED
import { MultiSelectModal, UIManager } from './ui';

// AVOID when possible
import { MultiSelectModal } from './ui/MultiSelectModal';
import { UIManager } from './ui/UIManager';
```

## Avoiding Circular Dependencies

Circular dependencies occur when two or more modules depend on each other, directly or indirectly. They can cause initialization issues, make code harder to understand, and lead to unexpected behavior.

### Prevention Strategies

1. **Identify Module Responsibilities**: Clearly define each module's responsibility and ensure it only depends on modules at a lower level of abstraction.

2. **Use Interfaces**: Define interfaces in a separate file that both dependent modules can import.

3. **Dependency Injection**: Pass dependencies as parameters rather than importing them directly.

4. **Event-Based Communication**: Use an event system to communicate between modules instead of direct dependencies.

5. **Refactor Large Modules**: Split large modules into smaller, more focused ones to reduce the likelihood of circular dependencies.

### Example of Resolving Circular Dependencies

If `UIManager.ts` and `MultiSelectModal.ts` have a circular dependency:

```typescript
// Before: Circular dependency
// UIManager.ts imports from MultiSelectModal.ts
import { MultiSelectModal } from './MultiSelectModal';

// MultiSelectModal.ts imports from UIManager.ts
import { UIManager } from './UIManager';
```

Resolve by:

```typescript
// After: Using interfaces and dependency injection
// Define interfaces in a separate file (ui-types.ts)
export interface IUIManager {
  showNotice(message: string): void;
}

// UIManager.ts implements the interface
import { IUIManager } from './ui-types';
export class UIManager implements IUIManager {
  showNotice(message: string): void {
    // Implementation
  }
}

// MultiSelectModal.ts uses the interface
import { IUIManager } from './ui-types';
export class MultiSelectModal {
  constructor(private uiManager: IUIManager) {
    // Use uiManager through the interface
  }
}
```

## Best Practices for Maintaining Modular Structure

### 1. Follow the Single Responsibility Principle

Each UI component should have a single responsibility. If a component is doing too much, consider splitting it into multiple components.

### 2. Use Consistent Naming Conventions

- Use PascalCase for component classes: `MultiSelectModal`, `ProgressPane`
- Use camelCase for instances, methods, and properties: `uiManager`, `showNotice()`
- Use descriptive names that indicate the component's purpose

### 3. Document Component Interfaces

- Use JSDoc comments to document component interfaces
- Specify required and optional parameters
- Document return values and possible exceptions

### 4. Maintain a Clean Public API

- Only export what is necessary from each module
- Use the index.ts file to define the public API
- Hide implementation details when possible

### 5. Test Components in Isolation

- Write unit tests for individual components
- Mock dependencies to test components in isolation
- Test component interactions with integration tests

## Guidelines for Adding New UI Components

When adding a new UI component:

1. **Create the component file** in the `src/ui` directory (lowercase)
2. **Export the component** from the `src/ui/index.ts` file
3. **Document the component** with JSDoc comments
4. **Add unit tests** for the component
5. **Update this documentation** if the component introduces new patterns or concepts

### Example: Adding a New Component

```typescript
// 1. Create the component file (src/ui/NewComponent.ts)
import { App } from 'obsidian';

/**
 * A new UI component
 */
export class NewComponent {
  constructor(app: App) {
    // Implementation
  }
}

// 2. Export the component from index.ts
// Add to src/ui/index.ts:
export { NewComponent } from './NewComponent';

// 3. Import the component elsewhere using the module
import { NewComponent } from './ui';
```

## Common Issues and Solutions

### Issue: TypeScript Module Import Errors

**Problem**: TypeScript cannot find modules when using inconsistent import paths.

**Solution**: Always use lowercase `ui` in import paths and ensure all files are in the correct directory.

### Issue: Duplicate Files in src/UI and src/ui

**Problem**: Having files in both uppercase and lowercase directories causes confusion and import errors.

**Solution**: 
1. Use only the lowercase `src/ui` directory
2. Move any files from `src/UI` to `src/ui`
3. Update import paths throughout the codebase

### Issue: Circular Dependencies

**Problem**: Modules depend on each other, causing initialization issues.

**Solution**: Follow the strategies outlined in the "Avoiding Circular Dependencies" section.

## Conclusion

Following these guidelines will help maintain a clean, modular architecture for UI components in Vespera Scriptorium. The consistent use of lowercase `src/ui` for directory paths and proper export/import patterns will prevent TypeScript module import errors and make the codebase more maintainable.