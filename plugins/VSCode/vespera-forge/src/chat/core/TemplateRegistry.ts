/**
 * Template Registry for managing provider templates and configurations
 */
import * as vscode from 'vscode';
import JSON5 from 'json5';
import { ProviderTemplate } from '../types/provider';
import { ChatEventRouter } from '../events/ChatEventRouter';
import { TemplateLoadedEvent } from '../types/events';
import { VesperaEvents } from '../../utils/events';

export class ChatTemplateRegistry {
  private templates = new Map<string, ProviderTemplate>();
  private templateWatcher?: vscode.FileSystemWatcher;
  
  constructor(
    private readonly extensionUri: vscode.Uri,
    private readonly eventRouter: ChatEventRouter
  ) {}
  
  async initialize(): Promise<void> {
    await this.loadBuiltinTemplates();
    await this.loadUserTemplates();
    this.setupTemplateWatcher();
  }
  
  async loadBuiltinTemplates(): Promise<void> {
    // TODO: Implement builtin template loading
    const templatesPath = vscode.Uri.joinPath(this.extensionUri, 'templates', 'providers');
    
    try {
      const templateFiles = await vscode.workspace.fs.readDirectory(templatesPath);
      
      for (const [filename] of templateFiles) {
        if (filename.endsWith('.json5')) {
          await this.loadTemplate(vscode.Uri.joinPath(templatesPath, filename));
        }
      }
    } catch (error) {
      console.warn('No builtin templates found:', error);
    }
  }
  
  async loadUserTemplates(): Promise<void> {
    // TODO: Implement user template loading from workspace/settings
    // Check for user-defined templates in workspace .vscode folder
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const userTemplatesPath = vscode.Uri.joinPath(folder.uri, '.vscode', 'vespera-templates');
        try {
          const userTemplates = await vscode.workspace.fs.readDirectory(userTemplatesPath);
          for (const [filename] of userTemplates) {
            if (filename.endsWith('.json5')) {
              await this.loadTemplate(vscode.Uri.joinPath(userTemplatesPath, filename));
            }
          }
        } catch {
          // User templates directory doesn't exist, skip
        }
      }
    }
  }
  
  async loadTemplate(templateUri: vscode.Uri): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(templateUri);
      const templateData = JSON5.parse(Buffer.from(content).toString());
      
      // Validate template schema
      const validationResult = this.validateTemplate(templateData);
      if (!validationResult.valid) {
        throw new Error(`Invalid template: ${validationResult.errors.join(', ')}`);
      }
      
      // Process template inheritance
      const processedTemplate = await this.processTemplateInheritance(templateData);
      
      this.templates.set(processedTemplate.template_id, processedTemplate);
      
      // Emit template loaded event
      this.eventRouter.emit(new TemplateLoadedEvent({
        providerId: processedTemplate.template_id,
        providerName: processedTemplate.name
      }));
      
      // Also emit via VesperaEvents for cross-system integration
      VesperaEvents.chatProviderConnected(processedTemplate.template_id, processedTemplate.name);
      
    } catch (error) {
      console.error(`Failed to load template from ${templateUri.fsPath}:`, error);
    }
  }
  
  getTemplate(templateId: string): ProviderTemplate | undefined {
    return this.templates.get(templateId);
  }
  
  getTemplatesByCategory(category: string): ProviderTemplate[] {
    return Array.from(this.templates.values())
      .filter(template => template.category === category);
  }
  
  getAllTemplates(): ProviderTemplate[] {
    return Array.from(this.templates.values());
  }
  
  private async processTemplateInheritance(template: any): Promise<ProviderTemplate> {
    // TODO: Implement template inheritance processing
    if (template.extends) {
      const parentTemplate = this.templates.get(template.extends);
      if (parentTemplate) {
        return this.mergeTemplates(parentTemplate, template);
      }
    }
    return template;
  }
  
  private mergeTemplates(parent: ProviderTemplate, child: any): ProviderTemplate {
    // TODO: Implement deep merging logic for template inheritance
    return {
      ...parent,
      ...child,
      provider_config: { ...parent.provider_config, ...child.provider_config },
      authentication: { ...parent.authentication, ...child.authentication },
      ui_schema: {
        config_fields: [
          ...parent.ui_schema.config_fields,
          ...(child.ui_schema?.config_fields || [])
        ]
      },
      capabilities: { ...parent.capabilities, ...child.capabilities }
    };
  }
  
  private validateTemplate(template: any): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // TODO: Implement comprehensive template validation
    if (!template.template_id) {
      errors.push('template_id is required');
    }
    
    if (!template.name) {
      errors.push('name is required');
    }
    
    if (!template.provider_config) {
      errors.push('provider_config is required');
    }
    
    if (!template.authentication) {
      errors.push('authentication is required');
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private setupTemplateWatcher(): void {
    // TODO: Implement file system watcher for template changes
    const templatePattern = new vscode.RelativePattern(this.extensionUri, 'templates/**/*.json5');
    this.templateWatcher = vscode.workspace.createFileSystemWatcher(templatePattern);
    
    this.templateWatcher.onDidChange((uri) => {
      console.log('Template changed:', uri.fsPath);
      this.loadTemplate(uri);
    });
    
    this.templateWatcher.onDidCreate((uri) => {
      console.log('Template created:', uri.fsPath);
      this.loadTemplate(uri);
    });
    
    this.templateWatcher.onDidDelete((uri) => {
      console.log('Template deleted:', uri.fsPath);
      // TODO: Remove template from registry
    });
  }
  
  dispose(): void {
    if (this.templateWatcher) {
      this.templateWatcher.dispose();
    }
    this.templates.clear();
  }
}