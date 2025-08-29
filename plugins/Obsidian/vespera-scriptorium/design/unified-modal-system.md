# Unified Modal System Design

## Overview

The Vespera Scriptorium plugin requires a sophisticated modal system for managing tasks, roles, templates, and configurations. This design provides a unified, extensible modal architecture that integrates seamlessly with Obsidian's native UI patterns.

## Design Principles

### 1. **Consistency with Obsidian UX**
- Follow Obsidian's modal patterns and styling
- Use familiar keyboard shortcuts and navigation
- Integrate with Obsidian's theme system

### 2. **Context Awareness** 
- Modals understand current workspace context
- Smart defaults based on active note and project
- Preserve user's workflow state

### 3. **Progressive Disclosure**
- Simple interfaces for basic operations
- Advanced options available but not overwhelming
- Expandable sections for power users

### 4. **Cross-Modal Linking**
- Seamless navigation between related modals
- Consistent data flow and state management
- Shared components and validation logic

## Core Modal Types

### 1. Task Editor Modal
```typescript
interface TaskEditorModal {
  mode: 'create' | 'edit' | 'duplicate';
  context: {
    parentTaskId?: string;
    projectId?: string;
    templateId?: string;
  };
  sections: {
    basic: TaskBasicInfo;
    hierarchy: TaskHierarchy;
    execution: TaskExecution;
    metadata: TaskMetadata;
  };
}
```

**Features:**
- **Smart templates**: Auto-suggest based on project type and context
- **Role assignment**: Dropdown with capability validation
- **Dependency management**: Visual dependency graph editor
- **Subtask creation**: Inline subtask editor with drag-and-drop ordering
- **Quick actions**: Template application, role suggestions, priority shortcuts

### 2. Role Management Modal
```typescript
interface RoleManagerModal {
  mode: 'create' | 'edit' | 'assign' | 'capabilities';
  context: {
    taskId?: string;
    projectId?: string;
  };
  sections: {
    definition: RoleDefinition;
    capabilities: CapabilityMatrix;
    restrictions: RoleRestrictions;
    assignments: ActiveAssignments;
  };
}
```

**Features:**
- **Capability matrix**: Interactive grid for tool group permissions
- **File pattern editor**: Visual regex builder for file restrictions
- **Role templates**: Pre-configured roles for common use cases
- **Assignment preview**: Show affected tasks and potential conflicts
- **Validation feedback**: Real-time capability conflict detection

### 3. Template Editor Modal
```typescript
interface TemplateEditorModal {
  mode: 'create' | 'edit' | 'instantiate';
  templateType: 'task' | 'project' | 'workflow';
  sections: {
    definition: TemplateDefinition;
    structure: TemplateStructure;
    variables: TemplateVariables;
    preview: TemplatePreview;
  };
}
```

**Features:**
- **Visual structure editor**: Drag-and-drop task hierarchy builder
- **Variable system**: Parameterized templates with type validation
- **Preview generation**: Real-time preview of template instantiation
- **Import/export**: Share templates between vaults and users
- **Version management**: Track template changes and rollback options

### 4. Project Configuration Modal
```typescript
interface ProjectConfigModal {
  context: {
    projectId: string;
    vaultPath: string;
  };
  sections: {
    general: ProjectSettings;
    integration: MCPSettings;
    automation: WorkflowRules;
    collaboration: SharingSettings;
  };
}
```

## Shared Modal Framework

### Base Modal Component
```typescript
abstract class VesperaModal extends Modal {
  protected config: ModalConfig;
  protected state: ModalState;
  protected validation: ValidationEngine;
  
  abstract render(): void;
  abstract validate(): ValidationResult;
  abstract onSubmit(): Promise<SubmitResult>;
  
  // Shared functionality
  protected setupKeyboardShortcuts(): void;
  protected renderNavigation(): HTMLElement;
  protected handleCrossModalNavigation(): void;
  protected persistState(): void;
  protected restoreState(): void;
}
```

### Navigation System
```typescript
interface ModalNavigation {
  breadcrumbs: BreadcrumbItem[];
  backStack: ModalState[];
  forwardStack: ModalState[];
  
  // Cross-modal navigation
  navigateTo(modalType: ModalType, context: any): void;
  goBack(): void;
  goForward(): void;
  showBreadcrumbs(): HTMLElement;
}
```

## Advanced Features

### 1. **Smart Context Switching**
- **Auto-save**: Preserve work when switching between modals
- **Context restoration**: Return to exact state when navigating back
- **Conflict detection**: Warn about unsaved changes in related modals

### 2. **Collaborative Editing**
- **Real-time updates**: Show changes from other users/agents
- **Conflict resolution**: Visual merge interface for conflicting edits  
- **Presence indicators**: Show who else is editing related items

### 3. **Keyboard-First Design**
- **Vim-style navigation**: h/j/k/l for power users
- **Tab-based focus management**: Logical tab order through form elements
- **Command palette integration**: Search and execute actions from anywhere
- **Quick shortcuts**: Single-key actions for common operations

### 4. **Responsive Layout System**
```typescript
interface ResponsiveLayout {
  breakpoints: {
    compact: number;    // < 600px - mobile/narrow sidebars
    standard: number;   // 600-1000px - normal desktop
    expanded: number;   // > 1000px - large screens
  };
  layouts: {
    compact: SingleColumnLayout;
    standard: TwoColumnLayout;
    expanded: ThreeColumnLayout;
  };
}
```

## Integration Points

### 1. **Obsidian API Integration**
```typescript
// Modal triggering from various contexts
class ModalIntegration {
  // From command palette
  registerCommands(): void;
  
  // From right-click context menus
  registerContextMenus(): void;
  
  // From ribbon/toolbar buttons
  registerRibbonActions(): void;
  
  // From note content (links, embeds)
  registerLinkHandlers(): void;
  
  // From hotkeys
  registerHotkeys(): void;
}
```

### 2. **MCP Client Integration**
```typescript
// Bidirectional sync with Vespera Scriptorium
class MCPModalBridge {
  // Load data for modal population
  async loadTaskData(taskId: string): Promise<TaskData>;
  async loadRoleData(roleId: string): Promise<RoleData>;
  
  // Save modal changes back to MCP server
  async saveTaskChanges(changes: TaskChanges): Promise<SaveResult>;
  async validateRoleCapabilities(role: Role): Promise<ValidationResult>;
  
  // Real-time subscriptions
  subscribeToTaskUpdates(taskId: string, callback: UpdateCallback): void;
  subscribeToRoleChanges(roleId: string, callback: ChangeCallback): void;
}
```

### 3. **Obsidian Bases Integration**
```typescript
// Export modal data to Obsidian Bases
class BasesExportIntegration {
  async exportTasksToBase(tasks: Task[]): Promise<BaseExportResult>;
  async exportRolesToBase(roles: Role[]): Promise<BaseExportResult>;
  async syncModalChangesToBases(): Promise<SyncResult>;
}
```

## Technical Implementation

### 1. **State Management**
```typescript
// Centralized state management for all modals
class ModalStateManager {
  private states: Map<ModalId, ModalState> = new Map();
  private subscriptions: Map<StateKey, Callback[]> = new Map();
  
  getState<T>(modalId: ModalId): T;
  setState<T>(modalId: ModalId, state: Partial<T>): void;
  subscribe<T>(stateKey: StateKey, callback: (state: T) => void): void;
  
  // Persistence
  saveToLocalStorage(): void;
  loadFromLocalStorage(): void;
  
  // Cross-modal coordination
  broadcastChange(change: StateChange): void;
  handleCrossModalUpdate(update: CrossModalUpdate): void;
}
```

### 2. **Validation Engine**
```typescript
// Unified validation across all modal types
class ModalValidationEngine {
  private rules: ValidationRule[] = [];
  private validators: Map<FieldType, Validator> = new Map();
  
  validateField(field: Field, value: any): ValidationResult;
  validateModal(modal: ModalData): ValidationResult[];
  validateCrossModalConsistency(): ValidationResult[];
  
  // Real-time validation
  setupRealTimeValidation(modal: VesperaModal): void;
  showValidationErrors(errors: ValidationResult[]): void;
}
```

### 3. **Theme Integration**
```typescript
// Automatic theme adaptation
class ThemeIntegration {
  detectTheme(): ObsidianTheme;
  applyThemeStyles(modal: HTMLElement): void;
  registerThemeChangeListener(): void;
  
  // Custom styling for Vespera components
  loadVesperaThemeOverrides(): void;
  adaptToCustomThemes(): void;
}
```

## User Experience Flows

### 1. **Task Creation Flow**
```
User Context: Editing project note about "User Authentication"

1. Right-click text → "Create Vespera Task"
2. Task modal opens with:
   - Title: Pre-filled from selected text
   - Project: Auto-detected from note properties
   - Template suggestions: Based on project type
3. User selects "API Development" template
4. Modal expands to show template structure
5. User customizes template parameters
6. One-click submit creates hierarchical tasks
7. Confirmation with quick actions: "View in Bases", "Add to Calendar"
```

### 2. **Role Assignment Flow**
```
User Context: Viewing task that needs role assignment

1. Click "Assign Role" button in task modal
2. Role selection modal opens with:
   - Compatible roles highlighted (based on task requirements)
   - Capability requirements shown for task
   - Current workload for each role
3. User selects role → validation check runs
4. If conflicts: Show warning with resolution options
5. If valid: Preview impact on project timeline
6. Confirm assignment → Update both MCP server and Bases
```

### 3. **Template Customization Flow**
```
User Context: Creating new project type that needs custom template

1. Open template editor from command palette
2. Start with existing template or blank
3. Visual editor shows task hierarchy as tree
4. Add/remove/reorder tasks with drag-and-drop
5. Define variables with type validation
6. Preview template with sample data
7. Save with versioning → Available for future projects
```

## Implementation Phases

### Phase 1: Core Framework
- [ ] Base modal component with Obsidian integration
- [ ] State management system
- [ ] Navigation and routing between modals
- [ ] Basic validation engine

### Phase 2: Task Management
- [ ] Task editor modal with full functionality
- [ ] Role assignment integration
- [ ] Template application system
- [ ] MCP client integration for tasks

### Phase 3: Advanced Features
- [ ] Role management modal
- [ ] Template editor modal
- [ ] Project configuration modal
- [ ] Cross-modal linking and workflows

### Phase 4: Polish and Integration
- [ ] Obsidian Bases export integration
- [ ] Advanced keyboard shortcuts
- [ ] Collaborative features
- [ ] Performance optimization

## Success Metrics

### User Experience
- **Task creation time**: < 30 seconds for typical tasks
- **Learning curve**: New users productive within 5 minutes
- **Error reduction**: 80% fewer validation errors vs. manual entry
- **Workflow integration**: Zero-friction access from any Obsidian context

### Technical Performance
- **Modal load time**: < 200ms for any modal type
- **State persistence**: 100% reliable across session boundaries
- **Memory footprint**: < 10MB additional RAM for modal system
- **Compatibility**: Works with 95% of popular Obsidian themes

This unified modal system will provide the foundation for intuitive task orchestration within Obsidian, making the power of Vespera Scriptorium accessible through familiar, responsive interfaces.