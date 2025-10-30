/**
 * Template Initializer
 * Creates default Codex template files and system prompts in organized .vespera directory structure
 *
 * Directory structure:
 * .vespera/
 *   ├── templates/
 *   │   ├── providers/   (LLM provider configurations)
 *   │   ├── chat/        (Chat session templates)
 *   │   └── agents/      (Agent task templates)
 *   ├── prompts/         (System prompts for agents and assistants)
 *   └── chat-templates/  (User-customizable chat provider templates)
 */
import * as vscode from 'vscode';
// import * as path from 'path'; // Unused - may be needed for future path operations
import * as JSON5 from 'json5';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { DEFAULT_TEMPLATES, type TemplateDefinition } from './templates';

export interface CodexTemplateDefinition {
  id: string;
  name: string;
  description: string;
  content: string;
}

export class TemplateInitializer {
  constructor(private readonly logger?: VesperaLogger) {}

  /**
   * Ensure all required directory structure exists
   * This runs ALWAYS, regardless of template initialization status
   */
  public async ensureDirectoryStructure(workspaceUri: vscode.Uri): Promise<void> {
    try {
      const vesperaDir = vscode.Uri.joinPath(workspaceUri, '.vespera');

      // Ensure base .vespera directory exists
      await this.ensureDirectoryExists(vesperaDir);

      // Create all expected subdirectories upfront to prevent ENOENT errors
      const requiredDirectories = [
        'templates',
        'templates/codex',     // Codex content templates (note, scene, etc.)
        'templates/providers',
        'templates/chat',
        'templates/agents',
        'prompts',
        'chat-templates'  // For ChatTemplateRegistry user templates
      ];

      for (const subdir of requiredDirectories) {
        const dirUri = vscode.Uri.joinPath(vesperaDir, subdir);
        await this.ensureDirectoryExists(dirUri);
      }

      this.logger?.info('Directory structure ensured', {
        vesperaDir: vesperaDir.fsPath,
        directoriesCreated: requiredDirectories.length
      });
    } catch (error) {
      this.logger?.error('Failed to ensure directory structure', error);
      throw error;
    }
  }

  /**
   * Initialize templates and prompts in organized .vespera directory structure
   */
  public async initializeTemplates(workspaceUri: vscode.Uri): Promise<void> {
    try {
      const vesperaDir = vscode.Uri.joinPath(workspaceUri, '.vespera');

      // Ensure directory structure exists first
      await this.ensureDirectoryStructure(workspaceUri);

      // Create all templates and prompts with subdirectories
      for (const template of DEFAULT_TEMPLATES) {
        await this.createTemplateFileWithSubdir(vesperaDir, template);
      }

      this.logger?.info('Template and prompt initialization completed', {
        vesperaDir: vesperaDir.fsPath,
        fileCount: DEFAULT_TEMPLATES.length
      });
    } catch (error) {
      this.logger?.error('Failed to initialize templates and prompts', error);
      throw error;
    }
  }

  /**
   * Create a template/prompt file in the appropriate subdirectory
   */
  private async createTemplateFileWithSubdir(
    vesperaDir: vscode.Uri,
    template: TemplateDefinition
  ): Promise<void> {
    // Create subdirectory path
    const subdirUri = vscode.Uri.joinPath(vesperaDir, template.subdirectory);
    await this.ensureDirectoryExists(subdirUri);

    // Create file path
    const fileUri = vscode.Uri.joinPath(subdirUri, template.filename);

    try {
      // Check if file already exists
      await vscode.workspace.fs.stat(fileUri);
      this.logger?.debug('Template/prompt file already exists, skipping', {
        file: fileUri.fsPath
      });
    } catch (error) {
      // File doesn't exist, create it
      const content = Buffer.from(template.content, 'utf8');
      await vscode.workspace.fs.writeFile(fileUri, content);

      this.logger?.info('Created template/prompt file', {
        file: fileUri.fsPath,
        subdirectory: template.subdirectory
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

  /**
   * Load all templates from .vespera/templates directory (recursively searches subdirectories)
   */
  public async loadTemplates(workspaceUri: vscode.Uri): Promise<Array<{ id: string; name: string; description: string; icon?: string }>> {
    try {
      const templatesDir = vscode.Uri.joinPath(workspaceUri, '.vespera', 'templates');
      const templates: Array<{ id: string; name: string; description: string; icon?: string }> = [];

      // Search all subdirectories: codex, providers, chat, agents
      const subdirs = ['codex', 'providers', 'chat', 'agents'];

      for (const subdir of subdirs) {
        const subdirUri = vscode.Uri.joinPath(templatesDir, subdir);
        try {
          const entries = await vscode.workspace.fs.readDirectory(subdirUri);

          for (const [filename, type] of entries) {
            if (type === vscode.FileType.File && filename.endsWith('.json5')) {
              try {
                const templateUri = vscode.Uri.joinPath(subdirUri, filename);
                const content = await vscode.workspace.fs.readFile(templateUri);
                const templateData = JSON5.parse(Buffer.from(content).toString('utf8'));

                // Extract template metadata including icon
                templates.push({
                  id: templateData.template_id || filename.replace('.json5', ''),
                  name: templateData.name || templateData.template_id || filename.replace('.json5', ''),
                  description: templateData.description || '',
                  icon: templateData.icon || templateData.metadata?.icon || undefined
                });
              } catch (error) {
                this.logger?.warn('Failed to load template file', {
                  filename,
                  subdirectory: subdir,
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
        } catch (error) {
          // Subdirectory doesn't exist yet, skip it
          this.logger?.debug(`Template subdirectory not found: ${subdir}`);
        }
      }

      this.logger?.info('Loaded templates', {
        count: templates.length,
        templates: templates.map(t => t.id)
      });

      return templates;
    } catch (error) {
      this.logger?.error('Failed to load templates', error);
      return [];
    }
  }

  /**
   * Load full template objects (for UI consumption)
   */
  public async loadFullTemplates(workspaceUri: vscode.Uri): Promise<any[]> {
    try {
      const templatesDir = vscode.Uri.joinPath(workspaceUri, '.vespera', 'templates');
      const templates: any[] = [];

      // Search all subdirectories: codex, providers, chat, agents
      const subdirs = ['codex', 'providers', 'chat', 'agents'];

      for (const subdir of subdirs) {
        const subdirUri = vscode.Uri.joinPath(templatesDir, subdir);
        try {
          const entries = await vscode.workspace.fs.readDirectory(subdirUri);

          for (const [filename, type] of entries) {
            if (type === vscode.FileType.File && filename.endsWith('.json5')) {
              try {
                const templateUri = vscode.Uri.joinPath(subdirUri, filename);
                const content = await vscode.workspace.fs.readFile(templateUri);
                const templateData = JSON5.parse(Buffer.from(content).toString('utf8'));

                // Transform to full Template object for UI
                const template = {
                  id: templateData.template_id || filename.replace('.json5', ''),
                  name: templateData.name || templateData.template_id || filename.replace('.json5', ''),
                  description: templateData.description || '',
                  version: templateData.metadata?.version || '1.0.0',
                  baseTemplate: undefined,
                  mixins: [],
                  fields: (templateData.fields || []).map((field: any) => ({
                    ...field,
                    id: field.id || field.name, // Ensure id exists, fallback to name
                    label: field.label || field.name.charAt(0).toUpperCase() + field.name.slice(1)
                  })),
                  viewModes: [{
                    id: 'default',
                    name: 'Default View',
                    description: 'Default view for this template',
                    layout: 'vertical',
                    sections: [],
                    contexts: ['all']
                  }],
                  workflowStates: [],
                  actions: [],
                  styling: {
                    theme: 'default',
                    customCSS: undefined,
                    componentStyles: {}
                  }
                };

                templates.push(template);
              } catch (error) {
                this.logger?.warn('Failed to load full template', {
                  filename,
                  subdirectory: subdir,
                  error: error instanceof Error ? error.message : String(error)
                });
              }
            }
          }
        } catch (error) {
          // Subdirectory doesn't exist yet, skip it
          this.logger?.debug(`Template subdirectory not found: ${subdir}`);
        }
      }

      this.logger?.info('Loaded full templates', {
        count: templates.length,
        templates: templates.map(t => t.id)
      });

      return templates;
    } catch (error) {
      this.logger?.error('Failed to load full templates', error);
      return [];
    }
  }
}
