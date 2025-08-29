# Template Editor View Design

## Overview

A revolutionary template editing system that treats templates as first-class editor views (like notes) but with rich GUI tree interfaces and intelligent reference systems. This enables collaborative template development with AI assistance.

## Core Concepts

### Template as Living Document

- **File Extension**: `.vtemplate` (Vespera Template)
- **Storage**: Regular files in vault (version controllable)
- **Content**: JSON + metadata + GUI tree representation
- **AI Assistable**: Full access to chatbot for template development help

### Template Reference System

```typescript
interface TemplateReference {
  id: string;
  name: string;
  version?: string;
  path: string;
  parameters?: Record<string, any>;
}

interface Template {
  id: string;
  name: string;
  description: string;
  version: string;
  author: string;
  
  // Template structure
  structure: TemplateNode[];
  
  // Referenced templates (composition)
  references: TemplateReference[];
  
  // Template parameters/variables
  parameters: TemplateParameter[];
  
  // Metadata
  tags: string[];
  category: string;
  lastModified: Date;
  dependencies: string[];
}

interface TemplateNode {
  id: string;
  type: 'task' | 'reference' | 'group' | 'conditional';
  title: string;
  description?: string;
  
  // For task nodes
  role?: string;
  priority?: string;
  estimatedEffort?: number;
  
  // For reference nodes
  templateRef?: TemplateReference;
  parameterMappings?: Record<string, any>;
  
  // For conditional nodes
  condition?: string;
  
  // Hierarchy
  children: TemplateNode[];
  order: number;
}
```

## Editor View Architecture

### Custom View Implementation

```typescript
export class TemplateEditorView extends ItemView {
  getViewType(): string {
    return 'vespera-template-editor';
  }
  
  getDisplayText(): string {
    return this.file?.basename || 'Template Editor';
  }
  
  async onOpen(): Promise<void> {
    this.renderTemplateEditor();
  }
  
  private renderTemplateEditor(): void {
    const container = this.containerEl.children[1];
    container.empty();
    
    // Create split layout
    const editorContainer = container.createDiv('template-editor-container');
    
    // Tree view panel (left)
    const treePanel = editorContainer.createDiv('template-tree-panel');
    this.renderTreeView(treePanel);
    
    // Properties panel (right)  
    const propsPanel = editorContainer.createDiv('template-props-panel');
    this.renderPropertiesPanel(propsPanel);
    
    // Bottom toolbar
    const toolbar = container.createDiv('template-toolbar');
    this.renderToolbar(toolbar);
  }
}
```

### Tree View Component

```typescript
class TemplateTreeView {
  private tree: TemplateNode[];
  private selectedNode: TemplateNode | null = null;
  
  render(container: HTMLElement): void {
    const treeContainer = container.createDiv('template-tree');
    
    // Tree header with actions
    const header = treeContainer.createDiv('tree-header');
    header.createSpan('tree-title').textContent = 'Template Structure';
    
    const actions = header.createDiv('tree-actions');
    this.createActionButton(actions, 'Add Task', 'plus', () => this.addNode('task'));
    this.createActionButton(actions, 'Add Reference', 'link', () => this.addNode('reference'));
    this.createActionButton(actions, 'Add Group', 'folder', () => this.addNode('group'));
    
    // Tree content
    const treeContent = treeContainer.createDiv('tree-content');
    this.renderTreeNodes(treeContent, this.tree, 0);
  }
  
  private renderTreeNodes(container: HTMLElement, nodes: TemplateNode[], depth: number): void {
    nodes.forEach((node, index) => {
      const nodeEl = this.createTreeNode(container, node, depth, index);
      
      if (node.children.length > 0) {
        const childrenContainer = nodeEl.createDiv('tree-children');
        this.renderTreeNodes(childrenContainer, node.children, depth + 1);
      }
    });
  }
  
  private createTreeNode(container: HTMLElement, node: TemplateNode, depth: number, index: number): HTMLElement {
    const nodeEl = container.createDiv('tree-node');
    nodeEl.style.paddingLeft = `${depth * 20 + 10}px`;
    
    // Node type icon
    const icon = nodeEl.createSpan(`tree-node-icon icon-${node.type}`);
    this.setNodeIcon(icon, node.type);
    
    // Node content
    const content = nodeEl.createDiv('tree-node-content');
    const title = content.createSpan('tree-node-title');
    title.textContent = node.title;
    
    // Node actions
    const actions = content.createDiv('tree-node-actions');
    this.createNodeActions(actions, node, index);
    
    // Selection handling
    nodeEl.addEventListener('click', (e) => {
      e.stopPropagation();
      this.selectNode(node, nodeEl);
    });
    
    // Drag and drop for reordering
    this.makeDraggable(nodeEl, node);
    
    return nodeEl;
  }
  
  private createNodeActions(container: HTMLElement, node: TemplateNode, index: number): void {
    // Edit button
    this.createActionButton(container, 'Edit', 'edit', () => this.editNode(node));
    
    // Add child button
    this.createActionButton(container, 'Add Child', 'plus-circle', () => this.addChildNode(node));
    
    // Delete button
    this.createActionButton(container, 'Delete', 'trash', () => this.deleteNode(node, index));
    
    // Move up/down buttons
    if (index > 0) {
      this.createActionButton(container, 'Move Up', 'arrow-up', () => this.moveNode(node, -1));
    }
    
    this.createActionButton(container, 'Move Down', 'arrow-down', () => this.moveNode(node, 1));
  }
}
```

## Template Reference System

### Reference Resolution Engine

```typescript
class TemplateReferenceResolver {
  private templateCache = new Map<string, Template>();
  
  async resolveTemplate(template: Template): Promise<ResolvedTemplate> {
    const resolved: ResolvedTemplate = {
      ...template,
      resolvedStructure: await this.resolveNodes(template.structure, template.parameters)
    };
    
    return resolved;
  }
  
  private async resolveNodes(nodes: TemplateNode[], parameters: Record<string, any>): Promise<ResolvedTemplateNode[]> {
    const resolved: ResolvedTemplateNode[] = [];
    
    for (const node of nodes) {
      if (node.type === 'reference') {
        // Resolve template reference
        const refTemplate = await this.loadTemplate(node.templateRef.path);
        const resolvedRef = await this.resolveTemplate(refTemplate);
        
        // Apply parameter mappings
        const mappedParams = this.applyParameterMappings(
          node.parameterMappings || {},
          parameters
        );
        
        // Insert resolved nodes
        resolved.push(...resolvedRef.resolvedStructure.map(refNode => ({
          ...refNode,
          id: `${node.id}-${refNode.id}`, // Unique ID
          parentRef: node.id
        })));
        
      } else {
        // Regular node
        const resolvedNode: ResolvedTemplateNode = {
          ...node,
          title: this.interpolateString(node.title, parameters),
          description: node.description ? this.interpolateString(node.description, parameters) : undefined,
          children: await this.resolveNodes(node.children, parameters)
        };
        
        resolved.push(resolvedNode);
      }
    }
    
    return resolved;
  }
  
  private interpolateString(str: string, parameters: Record<string, any>): string {
    return str.replace(/\{\{(\w+)\}\}/g, (match, key) => {
      return parameters[key]?.toString() || match;
    });
  }
}
```

### Live Template Updates

```typescript
class TemplateWatcher {
  private watchers = new Map<string, FileSystemWatcher>();
  
  watchTemplate(templatePath: string, callback: (template: Template) => void): void {
    // Watch the template file for changes
    const watcher = this.app.vault.on('modify', (file) => {
      if (file.path === templatePath) {
        this.reloadTemplate(templatePath).then(callback);
      }
    });
    
    this.watchers.set(templatePath, watcher);
  }
  
  watchReferences(template: Template, callback: (updatedTemplate: Template) => void): void {
    // Watch all referenced templates
    template.references.forEach(ref => {
      this.watchTemplate(ref.path, () => {
        // Reload the main template when references change
        this.reloadTemplate(template.path).then(callback);
      });
    });
  }
}
```

## GUI Components

### Properties Panel

```typescript
class TemplatePropertiesPanel {
  render(container: HTMLElement, selectedNode: TemplateNode | null): void {
    container.empty();
    
    if (!selectedNode) {
      this.renderEmptyState(container);
      return;
    }
    
    const propsContainer = container.createDiv('props-container');
    
    // Basic properties
    this.renderBasicProperties(propsContainer, selectedNode);
    
    // Type-specific properties
    switch (selectedNode.type) {
      case 'task':
        this.renderTaskProperties(propsContainer, selectedNode);
        break;
      case 'reference':
        this.renderReferenceProperties(propsContainer, selectedNode);
        break;
      case 'conditional':
        this.renderConditionalProperties(propsContainer, selectedNode);
        break;
    }
  }
  
  private renderReferenceProperties(container: HTMLElement, node: TemplateNode): void {
    const section = container.createDiv('props-section');
    section.createEl('h3', { text: 'Template Reference' });
    
    // Template selection
    const templateSelect = this.createTemplateSelector(section, node.templateRef?.path);
    templateSelect.addEventListener('change', (e) => {
      const target = e.target as HTMLSelectElement;
      this.updateTemplateReference(node, target.value);
    });
    
    // Parameter mappings
    if (node.templateRef) {
      this.renderParameterMappings(section, node);
    }
  }
  
  private createTemplateSelector(container: HTMLElement, currentValue?: string): HTMLSelectElement {
    const label = container.createEl('label', { text: 'Referenced Template:' });
    const select = container.createEl('select');
    
    // Load available templates
    this.loadAvailableTemplates().then(templates => {
      templates.forEach(template => {
        const option = select.createEl('option', { 
          value: template.path,
          text: template.name 
        });
        
        if (template.path === currentValue) {
          option.selected = true;
        }
      });
    });
    
    return select;
  }
}
```

### Template Instantiation Dialog

```typescript
class TemplateInstantiationDialog extends Modal {
  private template: Template;
  private parameterValues: Record<string, any> = {};
  
  constructor(app: App, template: Template) {
    super(app);
    this.template = template;
  }
  
  onOpen(): void {
    const { contentEl } = this;
    
    contentEl.createEl('h2', { text: `Instantiate: ${this.template.name}` });
    
    // Parameter inputs
    const paramsContainer = contentEl.createDiv('template-params');
    
    this.template.parameters.forEach(param => {
      this.renderParameterInput(paramsContainer, param);
    });
    
    // Preview section
    const previewContainer = contentEl.createDiv('template-preview');
    this.renderPreview(previewContainer);
    
    // Buttons
    const buttonContainer = contentEl.createDiv('modal-buttons');
    
    const instantiateBtn = buttonContainer.createEl('button', { 
      cls: 'mod-cta',
      text: 'Create Tasks' 
    });
    instantiateBtn.addEventListener('click', () => this.instantiateTemplate());
    
    const cancelBtn = buttonContainer.createEl('button', { text: 'Cancel' });
    cancelBtn.addEventListener('click', () => this.close());
  }
  
  private async renderPreview(container: HTMLElement): Promise<void> {
    container.empty();
    container.createEl('h3', { text: 'Preview' });
    
    const resolver = new TemplateReferenceResolver();
    const resolved = await resolver.resolveTemplate({
      ...this.template,
      parameters: { ...this.template.parameters, ...this.parameterValues }
    });
    
    const previewTree = container.createDiv('preview-tree');
    this.renderPreviewNodes(previewTree, resolved.resolvedStructure, 0);
  }
}
```

## Integration Points

### File Association

```typescript
// Register template file type
this.app.workspace.registerExtensions(['vtemplate'], 'vespera-template-editor');

// Register view creator
this.app.workspace.registerViewCreator('vespera-template-editor', (leaf) => {
  return new TemplateEditorView(leaf);
});
```

### Command Integration

```typescript
// Commands for template operations
this.addCommand({
  id: 'create-new-template',
  name: 'Create New Template',
  callback: () => this.createNewTemplate()
});

this.addCommand({
  id: 'instantiate-template',
  name: 'Instantiate Template',
  callback: () => this.showTemplateSelector()
});
```

### Chat Integration

```typescript
// Template context for AI assistance
class TemplateChatContext {
  getCurrentTemplateContext(): string {
    const activeView = this.app.workspace.getActiveViewOfType(TemplateEditorView);
    if (activeView) {
      return `Currently editing template: ${activeView.template.name}
Structure: ${JSON.stringify(activeView.template.structure, null, 2)}
Parameters: ${JSON.stringify(activeView.template.parameters, null, 2)}`;
    }
    return '';
  }
}
```

## Benefits of This Approach

1. **Natural Workflow**: Templates feel like regular files users can edit
2. **AI Assistance**: Full chatbot access for template development help  
3. **Version Control**: Templates are files - full git integration
4. **Live Updates**: Referenced templates update automatically
5. **Visual Editing**: Rich GUI without losing file-based benefits
6. **Composition**: Build complex templates from simpler ones
7. **Parameterization**: Flexible template instantiation
8. **Integration**: Natural fit with Obsidian's architecture

This revolutionary template system treats templates as living documents with intelligent composition and real-time AI assistance - exactly what you envisioned!
