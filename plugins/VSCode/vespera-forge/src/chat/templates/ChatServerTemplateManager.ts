/**
 * Chat Server Template Manager with Codex Integration
 * 
 * Features:
 * - Task-based server templates for different task types (Phase 1, Phase 2, etc.)
 * - Agent channel templates for different agent roles
 * - Dynamic template application based on task characteristics
 * - Regular server templates for static conversations
 * - Template inheritance and customization system
 * - Codex system integration for dynamic template discovery and loading
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';
import { 
  TaskServerTemplate, 
  ChannelTemplate,
  TaskServerConfig,
  AgentChannelConfig
} from '../servers/TaskServerManager';

// Template system interfaces
export interface ChatServerTemplate extends TaskServerTemplate {
  metadata: TemplateMetadata;
  codexConfig?: CodexTemplateConfig;
  inheritance?: TemplateInheritance;
  customization?: TemplateCustomization;
}

export interface TemplateMetadata {
  version: string;
  author: string;
  description: string;
  tags: string[];
  compatibility: string[];
  createdAt: number;
  updatedAt: number;
  priority: number;
}

export interface CodexTemplateConfig {
  codexPath: string;
  templatePattern: string;
  dynamicFields: DynamicFieldConfig[];
  contentTemplates: ContentTemplateConfig[];
  environmentalAdaptation: EnvironmentalAdaptationConfig;
}

export interface DynamicFieldConfig {
  fieldName: string;
  fieldType: 'text' | 'number' | 'boolean' | 'array' | 'object';
  source: 'task' | 'agent' | 'codex' | 'user';
  defaultValue?: any;
  validation?: FieldValidation;
}

export interface ContentTemplateConfig {
  contentType: 'message' | 'notification' | 'progress' | 'error';
  template: string;
  variables: string[];
  localization?: Record<string, string>;
}

export interface EnvironmentalAdaptationConfig {
  themeAdaptation: ThemeAdaptationConfig;
  contextualBehavior: ContextualBehaviorConfig;
  userPreferences: UserPreferenceAdaptation;
}

export interface ThemeAdaptationConfig {
  lightTheme: ThemeVariant;
  darkTheme: ThemeVariant;
  highContrast: ThemeVariant;
}

export interface ThemeVariant {
  colors: Record<string, string>;
  fonts: Record<string, string>;
  spacing: Record<string, number>;
}

export interface ContextualBehaviorConfig {
  taskPhaseAdaptation: Record<string, PhaseAdaptation>;
  agentBehaviorModifiers: Record<string, AgentBehaviorModifier>;
  progressIndicators: ProgressIndicatorConfig[];
}

export interface PhaseAdaptation {
  phaseName: string;
  channelConfiguration: Partial<ChannelTemplate>[];
  uiBehavior: UIBehaviorModifier;
  notificationSettings: NotificationModifier;
}

export interface AgentBehaviorModifier {
  agentRole: string;
  channelCustomization: ChannelCustomization;
  messageFormatting: MessageFormattingConfig;
  interactionRules: InteractionRuleConfig[];
}

export interface ChannelCustomization {
  namePrefix?: string;
  nameSuffix?: string;
  description?: string;
  iconOverride?: string;
  colorOverride?: string;
}

export interface MessageFormattingConfig {
  timestampFormat: string;
  mentionFormat: string;
  codeBlockTheme: string;
  markdownEnabled: boolean;
}

export interface InteractionRuleConfig {
  ruleType: 'allow' | 'deny' | 'require';
  condition: string;
  action: string;
  message?: string;
}

export interface ProgressIndicatorConfig {
  indicatorType: 'bar' | 'circle' | 'dots' | 'text';
  position: 'inline' | 'sidebar' | 'overlay';
  updateFrequency: number;
  colors: Record<string, string>;
}

export interface UIBehaviorModifier {
  layout: 'standard' | 'compact' | 'expanded';
  animation: boolean;
  autoScroll: boolean;
  focusBehavior: 'maintain' | 'follow' | 'none';
}

export interface NotificationModifier {
  priority: 'low' | 'normal' | 'high';
  sound: boolean;
  visual: boolean;
  desktop: boolean;
  conditions: string[];
}

export interface UserPreferenceAdaptation {
  respectUserTheme: boolean;
  adaptToUserDensity: boolean;
  followUserNotifications: boolean;
  customizableFields: string[];
}

export interface TemplateInheritance {
  baseTemplate?: string;
  overrides: Record<string, any>;
  mergeStrategy: 'replace' | 'merge' | 'extend';
}

export interface TemplateCustomization {
  userCustomizations: Record<string, any>;
  projectCustomizations: Record<string, any>;
  temporaryOverrides: Record<string, any>;
}

export interface FieldValidation {
  required: boolean;
  pattern?: string;
  minLength?: number;
  maxLength?: number;
  allowedValues?: any[];
}

export interface TemplateLoadResult {
  template: ChatServerTemplate;
  warnings: string[];
  errors: string[];
  codexIntegration: boolean;
}

export class ChatServerTemplateManager {
  private templates: Map<string, ChatServerTemplate> = new Map();
  private templateCache: Map<string, TemplateLoadResult> = new Map();
  private codexIntegration: Map<string, string> = new Map(); // templateId -> codexPath
  private disposables: vscode.Disposable[] = [];
  

  constructor(
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {}

  /**
   * Initialize template manager and load templates
   */
  public async initialize(): Promise<void> {
    try {
      this.logger.info('Initializing ChatServerTemplateManager');

      // Load built-in templates
      await this.loadBuiltInTemplates();

      // Discover and load Codex templates
      await this.discoverCodexTemplates();

      // Load user custom templates
      await this.loadUserTemplates();

      // Setup file watchers for template changes
      this.setupTemplateWatchers();

      this.logger.info('ChatServerTemplateManager initialized', {
        totalTemplates: this.templates.size,
        codexIntegrations: this.codexIntegration.size
      });

    } catch (error) {
      this.logger.error('Failed to initialize ChatServerTemplateManager', error);
      await this.errorHandler.handleError(error as Error);
      
      // Load minimal default templates as fallback
      await this.loadMinimalTemplates();
    }
  }

  /**
   * Get template for task type with Codex integration
   */
  public async getTaskTemplate(
    taskType: string,
    taskConfig?: TaskServerConfig,
    templateId?: string
  ): Promise<ChatServerTemplate> {
    try {
      // Try specific template ID first
      if (templateId) {
        const template = await this.loadTemplate(templateId);
        if (template) {
          return await this.applyDynamicConfiguration(template, taskConfig);
        }
      }

      // Find template by task type
      for (const template of this.templates.values()) {
        if (template.taskTypes.includes(taskType) || template.taskTypes.includes('*')) {
          return await this.applyDynamicConfiguration(template, taskConfig);
        }
      }

      // Look for Codex-based templates
      const codexTemplate = await this.findCodexTemplate(taskType, taskConfig);
      if (codexTemplate) {
        return await this.applyDynamicConfiguration(codexTemplate, taskConfig);
      }

      // Fall back to default
      const defaultTemplate = this.templates.get('default');
      if (!defaultTemplate) {
        throw new Error('No default template available');
      }

      return await this.applyDynamicConfiguration(defaultTemplate, taskConfig);

    } catch (error) {
      this.logger.error('Failed to get task template', error, {
        taskType,
        templateId
      });
      throw error;
    }
  }

  /**
   * Get agent channel template
   */
  public async getAgentChannelTemplate(
    agentConfig: AgentChannelConfig,
    serverTemplate: ChatServerTemplate
  ): Promise<ChannelTemplate> {
    try {
      // Find channel template for this agent role
      const channelTemplate = serverTemplate.channelTemplates.find(
        ct => ct.channelType === 'agent' && 
              (ct.agentRoles?.includes(agentConfig.agentRole) || !ct.agentRoles)
      );

      if (!channelTemplate) {
        // Create default agent channel template
        return this.createDefaultAgentChannelTemplate(agentConfig);
      }

      // Apply agent-specific customizations
      const customizedTemplate = await this.applyAgentCustomization(
        channelTemplate,
        agentConfig,
        serverTemplate
      );

      return customizedTemplate;

    } catch (error) {
      this.logger.error('Failed to get agent channel template', error, {
        agentRole: agentConfig.agentRole
      });
      
      // Return basic template
      return this.createDefaultAgentChannelTemplate(agentConfig);
    }
  }

  /**
   * Register custom template
   */
  public async registerTemplate(template: ChatServerTemplate): Promise<void> {
    try {
      // Validate template
      await this.validateTemplate(template);

      // Process inheritance if specified
      const processedTemplate = await this.processTemplateInheritance(template);

      // Store template
      this.templates.set(processedTemplate.templateId, processedTemplate);

      // Update cache
      this.templateCache.set(processedTemplate.templateId, {
        template: processedTemplate,
        warnings: [],
        errors: [],
        codexIntegration: !!processedTemplate.codexConfig
      });

      this.logger.info('Template registered', {
        templateId: template.templateId,
        taskTypes: template.taskTypes,
        hasCodexIntegration: !!template.codexConfig
      });

    } catch (error) {
      this.logger.error('Failed to register template', error, {
        templateId: template.templateId
      });
      throw error;
    }
  }

  /**
   * Get available templates
   */
  public getAvailableTemplates(): ChatServerTemplate[] {
    return Array.from(this.templates.values()).sort((a, b) => {
      // Sort by priority, then by name
      if (a.metadata.priority !== b.metadata.priority) {
        return b.metadata.priority - a.metadata.priority;
      }
      return a.templateName.localeCompare(b.templateName);
    });
  }

  /**
   * Search templates by criteria
   */
  public searchTemplates(criteria: {
    taskType?: string;
    tags?: string[];
    author?: string;
    compatibility?: string[];
  }): ChatServerTemplate[] {
    const results: ChatServerTemplate[] = [];

    for (const template of this.templates.values()) {
      let matches = true;

      if (criteria.taskType && !template.taskTypes.includes(criteria.taskType)) {
        matches = false;
      }

      if (criteria.tags && !criteria.tags.some(tag => template.metadata.tags.includes(tag))) {
        matches = false;
      }

      if (criteria.author && template.metadata.author !== criteria.author) {
        matches = false;
      }

      if (criteria.compatibility && 
          !criteria.compatibility.some(comp => template.metadata.compatibility.includes(comp))) {
        matches = false;
      }

      if (matches) {
        results.push(template);
      }
    }

    return results.sort((a, b) => b.metadata.priority - a.metadata.priority);
  }

  /**
   * Load built-in templates
   */
  private async loadBuiltInTemplates(): Promise<void> {
    const builtInTemplates: ChatServerTemplate[] = [
      {
        templateId: 'default',
        templateName: 'Default Task Server',
        taskTypes: ['*'],
        serverNameTemplate: '{taskTitle}',
        channelTemplates: [
          {
            channelType: 'general',
            nameTemplate: 'General Discussion',
            autoCreate: true,
            permissions: {
              readRoles: ['*'],
              writeRoles: ['*'],
              adminRoles: ['admin']
            }
          }
        ],
        autoCreateChannels: ['general'],
        permissions: {
          allowGuestAccess: true,
          restrictedRoles: [],
          adminRoles: ['admin']
        },
        metadata: {
          version: '1.0.0',
          author: 'Vespera Forge',
          description: 'Default template for all task types',
          tags: ['default', 'general'],
          compatibility: ['*'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          priority: 0
        }
      },

      {
        templateId: 'phase-development',
        templateName: 'Phase Development Server',
        taskTypes: ['phase1', 'phase2', 'phase3', 'phase4'],
        serverNameTemplate: '{phase}: {taskTitle}',
        channelTemplates: [
          {
            channelType: 'planning',
            nameTemplate: 'Planning & Architecture',
            autoCreate: true,
            permissions: {
              readRoles: ['*'],
              writeRoles: ['architect', 'lead', 'admin'],
              adminRoles: ['admin']
            }
          },
          {
            channelType: 'agent',
            nameTemplate: '{agentRole}',
            agentRoles: ['SessionPersistenceAgent', 'SecurityEnhancementAgent', 'UIEnhancementAgent'],
            autoCreate: false,
            permissions: {
              readRoles: ['*'],
              writeRoles: ['{agentRole}', 'admin'],
              adminRoles: ['admin']
            }
          },
          {
            channelType: 'progress',
            nameTemplate: 'Progress Tracking',
            autoCreate: true,
            permissions: {
              readRoles: ['*'],
              writeRoles: ['agent', 'admin'],
              adminRoles: ['admin']
            }
          }
        ],
        autoCreateChannels: ['planning', 'progress'],
        permissions: {
          allowGuestAccess: false,
          restrictedRoles: ['guest'],
          adminRoles: ['admin', 'lead']
        },
        metadata: {
          version: '1.0.0',
          author: 'Vespera Forge',
          description: 'Template for phase-based development tasks with agent channels',
          tags: ['phase', 'development', 'agents'],
          compatibility: ['vespera-forge'],
          createdAt: Date.now(),
          updatedAt: Date.now(),
          priority: 10
        },
        codexConfig: {
          codexPath: 'templates/servers/phase-development',
          templatePattern: '*.phase.codex.template.*',
          dynamicFields: [
            {
              fieldName: 'phase',
              fieldType: 'text',
              source: 'task',
              validation: {
                required: true,
                pattern: '^(phase1|phase2|phase3|phase4)$'
              }
            },
            {
              fieldName: 'expectedAgents',
              fieldType: 'array',
              source: 'task'
            }
          ],
          contentTemplates: [
            {
              contentType: 'progress',
              template: 'Phase {phase} Progress: {progress}%',
              variables: ['phase', 'progress']
            }
          ],
          environmentalAdaptation: {
            themeAdaptation: {
              lightTheme: {
                colors: { primary: '#007ACC', secondary: '#F3F3F3' },
                fonts: { main: 'Segoe UI', code: 'Consolas' },
                spacing: { padding: 8, margin: 4 }
              },
              darkTheme: {
                colors: { primary: '#0E639C', secondary: '#1E1E1E' },
                fonts: { main: 'Segoe UI', code: 'Consolas' },
                spacing: { padding: 8, margin: 4 }
              },
              highContrast: {
                colors: { primary: '#FFFFFF', secondary: '#000000' },
                fonts: { main: 'Segoe UI', code: 'Consolas' },
                spacing: { padding: 12, margin: 6 }
              }
            },
            contextualBehavior: {
              taskPhaseAdaptation: {},
              agentBehaviorModifiers: {},
              progressIndicators: [
                {
                  indicatorType: 'bar',
                  position: 'sidebar',
                  updateFrequency: 1000,
                  colors: { complete: '#28A745', incomplete: '#6C757D' }
                }
              ]
            },
            userPreferences: {
              respectUserTheme: true,
              adaptToUserDensity: true,
              followUserNotifications: true,
              customizableFields: ['serverNameTemplate', 'channelTemplates']
            }
          }
        }
      }
    ];

    for (const template of builtInTemplates) {
      await this.registerTemplate(template);
    }

    this.logger.info('Built-in templates loaded', {
      templateCount: builtInTemplates.length
    });
  }

  /**
   * Discover Codex templates in workspace
   */
  private async discoverCodexTemplates(): Promise<void> {
    try {
      // Search for Codex template files
      const workspaceFolders = vscode.workspace.workspaceFolders;
      if (!workspaceFolders) {
        return;
      }

      for (const folder of workspaceFolders) {
        const codexFiles = await vscode.workspace.findFiles(
          new vscode.RelativePattern(folder, '**/*.codex.template.*'),
          '**/node_modules/**'
        );

        for (const file of codexFiles) {
          try {
            await this.loadCodexTemplate(file);
          } catch (error) {
            this.logger.warn('Failed to load Codex template', {
              file: file.fsPath,
              error: error
            });
          }
        }
      }

      this.logger.info('Codex template discovery completed', {
        codexTemplates: this.codexIntegration.size
      });

    } catch (error) {
      this.logger.error('Codex template discovery failed', error);
    }
  }

  /**
   * Load Codex template from file
   */
  private async loadCodexTemplate(file: vscode.Uri): Promise<void> {
    try {
      const content = await vscode.workspace.fs.readFile(file);
      const templateData = this.parseTemplateFile(content, path.extname(file.fsPath));

      if (this.isValidCodexTemplate(templateData)) {
        const template = await this.createTemplateFromCodexData(templateData, file);
        await this.registerTemplate(template);
        
        // Map template to codex path
        this.codexIntegration.set(template.templateId, file.fsPath);
      }

    } catch (error) {
      this.logger.error('Failed to load Codex template', error, {
        file: file.fsPath
      });
      throw error;
    }
  }

  /**
   * Apply dynamic configuration to template
   */
  private async applyDynamicConfiguration(
    template: ChatServerTemplate,
    taskConfig?: TaskServerConfig
  ): Promise<ChatServerTemplate> {
    if (!template.codexConfig || !taskConfig) {
      return template;
    }

    const configuredTemplate = JSON.parse(JSON.stringify(template)); // Deep clone

    try {
      // Apply dynamic field values
      for (const field of template.codexConfig.dynamicFields) {
        const value = this.extractFieldValue(field, taskConfig);
        if (value !== undefined) {
          this.applyFieldValue(configuredTemplate, field.fieldName, value);
        }
      }

      // Apply environmental adaptations
      if (template.codexConfig.environmentalAdaptation) {
        await this.applyEnvironmentalAdaptation(
          configuredTemplate,
          template.codexConfig.environmentalAdaptation
        );
      }

      return configuredTemplate;

    } catch (error) {
      this.logger.error('Failed to apply dynamic configuration', error, {
        templateId: template.templateId
      });
      return template; // Return original template as fallback
    }
  }

  /**
   * Apply agent customization to channel template
   */
  private async applyAgentCustomization(
    channelTemplate: ChannelTemplate,
    agentConfig: AgentChannelConfig,
    serverTemplate: ChatServerTemplate
  ): Promise<ChannelTemplate> {
    const customized = JSON.parse(JSON.stringify(channelTemplate)); // Deep clone

    // Apply agent-specific behavior modifiers
    if (serverTemplate.codexConfig?.environmentalAdaptation.contextualBehavior) {
      const agentModifier = serverTemplate.codexConfig.environmentalAdaptation
        .contextualBehavior.agentBehaviorModifiers[agentConfig.agentRole];
      
      if (agentModifier) {
        // Apply channel customization
        if (agentModifier.channelCustomization) {
          const custom = agentModifier.channelCustomization;
          if (custom.namePrefix) {
            customized.nameTemplate = custom.namePrefix + customized.nameTemplate;
          }
          if (custom.nameSuffix) {
            customized.nameTemplate = customized.nameTemplate + custom.nameSuffix;
          }
        }
      }
    }

    // Replace template variables
    customized.nameTemplate = customized.nameTemplate
      .replace('{agentRole}', agentConfig.agentRole)
      .replace('{agentName}', agentConfig.agentName);

    return customized;
  }

  /**
   * Create default agent channel template
   */
  private createDefaultAgentChannelTemplate(agentConfig: AgentChannelConfig): ChannelTemplate {
    return {
      channelType: 'agent',
      nameTemplate: agentConfig.agentRole,
      agentRoles: [agentConfig.agentRole],
      autoCreate: false,
      permissions: {
        readRoles: ['*'],
        writeRoles: [agentConfig.agentRole, 'admin'],
        adminRoles: ['admin']
      }
    };
  }

  /**
   * Find Codex template for task type
   */
  private async findCodexTemplate(
    taskType: string,
    _taskConfig?: TaskServerConfig
  ): Promise<ChatServerTemplate | null> {
    // Look for templates with Codex integration that match task type
    for (const [templateId, _codexPath] of this.codexIntegration) {
      const template = this.templates.get(templateId);
      if (template && (template.taskTypes.includes(taskType) || template.taskTypes.includes('*'))) {
        return template;
      }
    }

    return null;
  }

  /**
   * Validate template structure
   */
  private async validateTemplate(template: ChatServerTemplate): Promise<void> {
    if (!template.templateId) {
      throw new Error('Template must have a templateId');
    }
    
    if (!template.templateName) {
      throw new Error('Template must have a templateName');
    }
    
    if (!template.taskTypes || template.taskTypes.length === 0) {
      throw new Error('Template must specify at least one task type');
    }

    if (!template.channelTemplates || template.channelTemplates.length === 0) {
      throw new Error('Template must have at least one channel template');
    }

    // Validate channel templates
    for (const channelTemplate of template.channelTemplates) {
      if (!channelTemplate.channelType) {
        throw new Error('Channel template must have a channelType');
      }
      
      if (!channelTemplate.nameTemplate) {
        throw new Error('Channel template must have a nameTemplate');
      }
    }

    // Validate Codex config if present
    if (template.codexConfig) {
      await this.validateCodexConfig(template.codexConfig);
    }
  }

  /**
   * Validate Codex configuration
   */
  private async validateCodexConfig(config: CodexTemplateConfig): Promise<void> {
    if (!config.codexPath) {
      throw new Error('Codex config must have a codexPath');
    }

    if (!config.templatePattern) {
      throw new Error('Codex config must have a templatePattern');
    }

    // Validate dynamic fields
    for (const field of config.dynamicFields) {
      if (!field.fieldName || !field.fieldType || !field.source) {
        throw new Error('Dynamic field must have fieldName, fieldType, and source');
      }
    }
  }

  /**
   * Process template inheritance
   */
  private async processTemplateInheritance(template: ChatServerTemplate): Promise<ChatServerTemplate> {
    if (!template.inheritance || !template.inheritance.baseTemplate) {
      return template;
    }

    const baseTemplate = this.templates.get(template.inheritance.baseTemplate);
    if (!baseTemplate) {
      this.logger.warn('Base template not found', {
        baseTemplate: template.inheritance.baseTemplate,
        templateId: template.templateId
      });
      return template;
    }

    // Merge with base template based on strategy
    const mergedTemplate = JSON.parse(JSON.stringify(baseTemplate)); // Deep clone
    
    switch (template.inheritance.mergeStrategy) {
      case 'replace':
        Object.assign(mergedTemplate, template);
        break;
        
      case 'merge':
        this.deepMerge(mergedTemplate, template);
        break;
        
      case 'extend':
        this.deepMerge(mergedTemplate, template);
        // Apply specific overrides
        this.applyOverrides(mergedTemplate, template.inheritance.overrides);
        break;
    }

    return mergedTemplate;
  }

  /**
   * Deep merge objects
   */
  private deepMerge(target: any, source: any): void {
    for (const key in source) {
      if (source[key] && typeof source[key] === 'object' && !Array.isArray(source[key])) {
        if (!target[key]) {
          target[key] = {};
        }
        this.deepMerge(target[key], source[key]);
      } else {
        target[key] = source[key];
      }
    }
  }

  /**
   * Apply template overrides
   */
  private applyOverrides(template: any, overrides: Record<string, any>): void {
    for (const [path, value] of Object.entries(overrides)) {
      const keys = path.split('.');
      let current = template;
      
      for (let i = 0; i < keys.length - 1; i++) {
        const key = keys[i];
        if (key && !current[key]) {
          current[key] = {};
        }
        if (key) {
          current = current[key];
        }
      }
      
      const finalKey = keys[keys.length - 1];
      if (finalKey) {
        current[finalKey] = value;
      }
    }
  }

  /**
   * Load user templates
   */
  private async loadUserTemplates(): Promise<void> {
    // Implementation for loading user-defined templates
    this.logger.debug('User templates loading completed');
  }

  /**
   * Load minimal templates as fallback
   */
  private async loadMinimalTemplates(): Promise<void> {
    const minimalTemplate: ChatServerTemplate = {
      templateId: 'minimal',
      templateName: 'Minimal Server',
      taskTypes: ['*'],
      serverNameTemplate: '{taskTitle}',
      channelTemplates: [
        {
          channelType: 'general',
          nameTemplate: 'General',
          autoCreate: true,
          permissions: {
            readRoles: ['*'],
            writeRoles: ['*'],
            adminRoles: ['admin']
          }
        }
      ],
      autoCreateChannels: ['general'],
      permissions: {
        allowGuestAccess: true,
        restrictedRoles: [],
        adminRoles: ['admin']
      },
      metadata: {
        version: '1.0.0',
        author: 'System',
        description: 'Minimal fallback template',
        tags: ['minimal', 'fallback'],
        compatibility: ['*'],
        createdAt: Date.now(),
        updatedAt: Date.now(),
        priority: -1
      }
    };

    this.templates.set('minimal', minimalTemplate);
  }

  /**
   * Setup file watchers for template changes
   */
  private setupTemplateWatchers(): void {
    // Watch for changes in Codex template files
    for (const [templateId, codexPath] of this.codexIntegration) {
      const watcher = vscode.workspace.createFileSystemWatcher(codexPath);
      
      watcher.onDidChange(async () => {
        try {
          await this.reloadTemplate(templateId);
        } catch (error) {
          this.logger.error('Failed to reload template', error, { templateId });
        }
      });
      
      this.disposables.push(watcher);
    }
  }

  /**
   * Reload template from file
   */
  private async reloadTemplate(templateId: string): Promise<void> {
    const codexPath = this.codexIntegration.get(templateId);
    if (!codexPath) {
      return;
    }

    try {
      await this.loadCodexTemplate(vscode.Uri.file(codexPath));
      this.logger.info('Template reloaded', { templateId, codexPath });
    } catch (error) {
      this.logger.error('Template reload failed', error, { templateId });
    }
  }

  /**
   * Load template by ID
   */
  private async loadTemplate(templateId: string): Promise<ChatServerTemplate | null> {
    return this.templates.get(templateId) || null;
  }

  /**
   * Parse template file content
   */
  private parseTemplateFile(content: Uint8Array, extension: string): any {
    const text = Buffer.from(content).toString('utf8');
    
    switch (extension) {
      case '.json':
      case '.json5':
        return JSON.parse(text);
        
      case '.yaml':
      case '.yml':
        // Simple YAML parser fallback - converts basic YAML to JSON
        return this.parseSimpleYaml(text);
        
      default:
        throw new Error(`Unsupported template file extension: ${extension}`);
    }
  }

  /**
   * Simple YAML parser fallback for basic YAML structures
   * This is a minimal implementation that handles common cases
   */
  private parseSimpleYaml(yamlText: string): any {
    try {
      const lines = yamlText.split('\n');
      const result: any = {};
      let currentObj = result;
      const stack: any[] = [result];
      let currentIndent = 0;

      for (const line of lines) {
        const trimmed = line.trim();
        
        // Skip empty lines and comments
        if (!trimmed || trimmed.startsWith('#')) {
          continue;
        }

        // Calculate indentation
        const indent = line.length - line.trimLeft().length;
        
        // Handle indentation changes
        if (indent < currentIndent) {
          // Pop from stack until we reach the correct level
          while (stack.length > 1 && indent < currentIndent) {
            stack.pop();
            currentIndent -= 2; // Assuming 2-space indentation
          }
          currentObj = stack[stack.length - 1];
        }

        // Parse key-value pairs
        if (trimmed.includes(':')) {
          const [key, ...valueParts] = trimmed.split(':');
          const value = valueParts.join(':').trim();
          
          // Ensure key exists (it should since we checked for ':')
          if (!key) {
            continue;
          }
          
          if (value) {
            // Handle different value types
            let parsedValue: any = value;
            
            // Boolean
            if (value === 'true') parsedValue = true;
            else if (value === 'false') parsedValue = false;
            // Number
            else if (!isNaN(Number(value)) && value !== '') parsedValue = Number(value);
            // String (remove quotes if present)
            else if (value.startsWith('"') && value.endsWith('"')) {
              parsedValue = value.slice(1, -1);
            } else if (value.startsWith("'") && value.endsWith("'")) {
              parsedValue = value.slice(1, -1);
            }
            
            currentObj[key.trim()] = parsedValue;
          } else {
            // Object (no value after colon)
            const keyTrimmed = key.trim();
            currentObj[keyTrimmed] = {};
            stack.push(currentObj[keyTrimmed]);
            currentObj = currentObj[keyTrimmed];
            currentIndent = indent;
          }
        } else if (trimmed.startsWith('- ')) {
          // Array item
          const item = trimmed.substring(2).trim();
          const parentKey = Object.keys(currentObj).pop();
          
          if (parentKey && !Array.isArray(currentObj[parentKey])) {
            currentObj[parentKey] = [];
          }
          
          if (parentKey && Array.isArray(currentObj[parentKey])) {
            // Parse array item value
            let parsedItem: any = item;
            if (item === 'true') parsedItem = true;
            else if (item === 'false') parsedItem = false;
            else if (!isNaN(Number(item)) && item !== '') parsedItem = Number(item);
            else if (item.startsWith('"') && item.endsWith('"')) {
              parsedItem = item.slice(1, -1);
            } else if (item.startsWith("'") && item.endsWith("'")) {
              parsedItem = item.slice(1, -1);
            }
            
            currentObj[parentKey].push(parsedItem);
          }
        }
      }

      return result;
    } catch (error) {
      // Fallback: try to parse as JSON in case it's actually JSON with .yaml extension
      try {
        return JSON.parse(yamlText);
      } catch {
        throw new Error(`Failed to parse YAML: ${error instanceof Error ? error.message : String(error)}`);
      }
    }
  }

  /**
   * Check if template data is valid Codex template
   */
  private isValidCodexTemplate(data: any): boolean {
    return data && 
           data.templateId && 
           data.templateName && 
           data.taskTypes && 
           data.channelTemplates;
  }

  /**
   * Create template from Codex data
   */
  private async createTemplateFromCodexData(
    data: any,
    file: vscode.Uri
  ): Promise<ChatServerTemplate> {
    const template: ChatServerTemplate = {
      ...data,
      metadata: {
        ...data.metadata,
        createdAt: data.metadata?.createdAt || Date.now(),
        updatedAt: Date.now()
      }
    };

    // Add Codex config if not present
    if (!template.codexConfig) {
      template.codexConfig = {
        codexPath: path.dirname(file.fsPath),
        templatePattern: '*.codex.template.*',
        dynamicFields: [],
        contentTemplates: [],
        environmentalAdaptation: {
          themeAdaptation: {
            lightTheme: { colors: {}, fonts: {}, spacing: {} },
            darkTheme: { colors: {}, fonts: {}, spacing: {} },
            highContrast: { colors: {}, fonts: {}, spacing: {} }
          },
          contextualBehavior: {
            taskPhaseAdaptation: {},
            agentBehaviorModifiers: {},
            progressIndicators: []
          },
          userPreferences: {
            respectUserTheme: true,
            adaptToUserDensity: true,
            followUserNotifications: true,
            customizableFields: []
          }
        }
      };
    }

    return template;
  }

  /**
   * Extract field value from task config
   */
  private extractFieldValue(field: DynamicFieldConfig, taskConfig: TaskServerConfig): any {
    switch (field.source) {
      case 'task':
        return (taskConfig as any)[field.fieldName];
      case 'user':
        // Would get from user preferences
        return field.defaultValue;
      default:
        return field.defaultValue;
    }
  }

  /**
   * Apply field value to template
   */
  private applyFieldValue(template: any, fieldName: string, value: any): void {
    // Simple dot notation support
    const keys = fieldName.split('.');
    let current = template;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (key && !current[key]) {
        current[key] = {};
      }
      if (key) {
        current = current[key];
      }
    }
    
    const finalKey = keys[keys.length - 1];
    if (finalKey) {
      current[finalKey] = value;
    }
  }

  /**
   * Apply environmental adaptation
   */
  private async applyEnvironmentalAdaptation(
    template: ChatServerTemplate,
    adaptation: EnvironmentalAdaptationConfig
  ): Promise<void> {
    // Get current VS Code theme
    const currentTheme = vscode.window.activeColorTheme.kind;
    let themeVariant: ThemeVariant;
    
    switch (currentTheme) {
      case vscode.ColorThemeKind.Light:
        themeVariant = adaptation.themeAdaptation.lightTheme;
        break;
      case vscode.ColorThemeKind.Dark:
        themeVariant = adaptation.themeAdaptation.darkTheme;
        break;
      case vscode.ColorThemeKind.HighContrast:
        themeVariant = adaptation.themeAdaptation.highContrast;
        break;
      default:
        return;
    }

    // Apply theme-specific adaptations
    if (template.codexConfig) {
      template.codexConfig.environmentalAdaptation = {
        ...template.codexConfig.environmentalAdaptation,
        currentTheme: themeVariant
      } as any;
    }
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.templates.clear();
    this.templateCache.clear();
    this.codexIntegration.clear();
    
    this.logger.info('ChatServerTemplateManager disposed');
  }
}