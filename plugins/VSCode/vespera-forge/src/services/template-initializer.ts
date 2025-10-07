/**
 * Template Initializer
 * Creates default Codex template files in .vespera/templates when Bindery initializes
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { VesperaLogger } from '../core/logging/VesperaLogger';

export interface CodexTemplateDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
}

export class TemplateInitializer {
  constructor(private readonly logger?: VesperaLogger) {}

  /**
   * Initialize templates in the .vespera/templates directory
   */
  public async initializeTemplates(workspaceUri: vscode.Uri): Promise<void> {
    try {
      const templatesDir = vscode.Uri.joinPath(workspaceUri, '.vespera', 'templates');

      // Ensure templates directory exists
      await this.ensureDirectoryExists(templatesDir);

      // Create default templates
      const defaultTemplates = this.getDefaultTemplates();

      for (const template of defaultTemplates) {
        await this.createTemplateFile(templatesDir, template);
      }

      this.logger?.info('Template initialization completed', {
        templatesDir: templatesDir.fsPath,
        templateCount: defaultTemplates.length
      });
    } catch (error) {
      this.logger?.error('Failed to initialize templates', error);
      throw error;
    }
  }

  /**
   * Get default template definitions
   */
  private getDefaultTemplates(): CodexTemplateDefinition[] {
    return [
      {
        id: 'note',
        name: 'Note',
        description: 'Simple note or document',
        content: this.createTemplateContent('Note', 'note', {
          icon: '📝',
          fields: ['content', 'tags'],
          defaultTags: ['note']
        })
      },
      {
        id: 'task',
        name: 'Task',
        description: 'Task or todo item',
        content: this.createTemplateContent('Task', 'task', {
          icon: '✓',
          fields: ['title', 'description', 'status', 'priority', 'dueDate'],
          defaultTags: ['task'],
          statusOptions: ['todo', 'in-progress', 'done'],
          priorityOptions: ['low', 'medium', 'high']
        })
      },
      {
        id: 'project',
        name: 'Project',
        description: 'Project container',
        content: this.createTemplateContent('Project', 'project', {
          icon: '📁',
          fields: ['name', 'description', 'status', 'startDate', 'endDate'],
          defaultTags: ['project'],
          statusOptions: ['planning', 'active', 'on-hold', 'completed']
        })
      },
      {
        id: 'character',
        name: 'Character',
        description: 'Character profile for creative writing',
        content: this.createTemplateContent('Character', 'character', {
          icon: '👤',
          fields: ['name', 'age', 'description', 'background', 'relationships'],
          defaultTags: ['character', 'creative-writing']
        })
      },
      {
        id: 'scene',
        name: 'Scene',
        description: 'Scene or chapter for creative writing',
        content: this.createTemplateContent('Scene', 'scene', {
          icon: '🎬',
          fields: ['title', 'description', 'location', 'characters', 'mood', 'content'],
          defaultTags: ['scene', 'creative-writing']
        })
      },
      {
        id: 'location',
        name: 'Location',
        description: 'Place or setting for creative writing',
        content: this.createTemplateContent('Location', 'location', {
          icon: '🗺️',
          fields: ['name', 'description', 'atmosphere', 'details'],
          defaultTags: ['location', 'creative-writing']
        })
      }
    ];
  }

  /**
   * Create template file content
   */
  private createTemplateContent(
    name: string,
    type: string,
    options: {
      icon?: string;
      fields?: string[];
      defaultTags?: string[];
      statusOptions?: string[];
      priorityOptions?: string[];
    }
  ): string {
    const { icon = '📄', fields = ['content'], defaultTags = [], statusOptions, priorityOptions } = options;

    // Build template metadata
    const metadata = {
      templateId: type,
      templateName: name,
      templateType: type,
      icon,
      version: '1.0.0',
      created: new Date().toISOString()
    };

    // Build field definitions
    const fieldDefs = fields.map(field => {
      const def: any = {
        name: field,
        label: field.charAt(0).toUpperCase() + field.slice(1),
        type: this.getFieldType(field)
      };

      if (field === 'status' && statusOptions) {
        def.options = statusOptions;
      }

      if (field === 'priority' && priorityOptions) {
        def.options = priorityOptions;
      }

      return def;
    });

    // Create JSON5 template
    const template = {
      template_id: type,
      name,
      description: `${name} template`,
      category: 'codex',
      metadata,
      fields: fieldDefs,
      defaultContent: {
        type,
        tags: defaultTags,
        metadata: {}
      }
    };

    return JSON.stringify(template, null, 2);
  }

  /**
   * Determine field type based on field name
   */
  private getFieldType(fieldName: string): string {
    const textFields = ['content', 'description', 'background', 'details', 'atmosphere'];
    const dateFields = ['dueDate', 'startDate', 'endDate', 'created'];
    const selectFields = ['status', 'priority', 'mood'];
    const arrayFields = ['tags', 'characters', 'relationships'];

    if (textFields.includes(fieldName)) {
      return 'textarea';
    }
    if (dateFields.includes(fieldName)) {
      return 'date';
    }
    if (selectFields.includes(fieldName)) {
      return 'select';
    }
    if (arrayFields.includes(fieldName)) {
      return 'array';
    }
    return 'text';
  }

  /**
   * Create a template file if it doesn't already exist
   */
  private async createTemplateFile(
    templatesDir: vscode.Uri,
    template: CodexTemplateDefinition
  ): Promise<void> {
    const templateFile = vscode.Uri.joinPath(templatesDir, `${template.id}.json5`);

    try {
      // Check if file already exists
      await vscode.workspace.fs.stat(templateFile);
      this.logger?.debug('Template file already exists, skipping', {
        templateId: template.id,
        file: templateFile.fsPath
      });
    } catch (error) {
      // File doesn't exist, create it
      const content = Buffer.from(template.content, 'utf8');
      await vscode.workspace.fs.writeFile(templateFile, content);

      this.logger?.info('Created template file', {
        templateId: template.id,
        file: templateFile.fsPath
      });
    }
  }

  /**
   * Ensure directory exists, create if it doesn't
   */
  private async ensureDirectoryExists(dirUri: vscode.Uri): Promise<void> {
    try {
      await vscode.workspace.fs.stat(dirUri);
    } catch (error) {
      // Directory doesn't exist, create it
      await vscode.workspace.fs.createDirectory(dirUri);
      this.logger?.info('Created templates directory', {
        dir: dirUri.fsPath
      });
    }
  }

  /**
   * Check if templates have been initialized
   */
  public async areTemplatesInitialized(workspaceUri: vscode.Uri): Promise<boolean> {
    try {
      const templatesDir = vscode.Uri.joinPath(workspaceUri, '.vespera', 'templates');
      const entries = await vscode.workspace.fs.readDirectory(templatesDir);

      // Consider initialized if at least one template file exists
      return entries.some(([name]) => name.endsWith('.json5'));
    } catch (error) {
      return false;
    }
  }
}
