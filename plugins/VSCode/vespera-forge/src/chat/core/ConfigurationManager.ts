/**
 * Configuration Manager for hierarchical chat system configuration
 */
import * as vscode from 'vscode';
import { ChatConfiguration, ConfigScope, ConfigurationWatcher } from '../types/config';
import { ProviderConfig, ProviderTemplate, ConfigSchema, JsonSchemaProperty } from '../types/provider';
import { ChatTemplateRegistry } from './TemplateRegistry';
import { ChatEventRouter } from '../events/ChatEventRouter';
import { ConfigurationChangedEvent } from '../types/events';
import { encrypt, decrypt } from '../utils/encryption';
import { VesperaEvents } from '../../utils/events';

export class ChatConfigurationManager {
  private config: ChatConfiguration;
  private watchers = new Map<string, ConfigurationWatcher[]>();
  private disposables: vscode.Disposable[] = [];
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly templateRegistry: ChatTemplateRegistry,
    private readonly eventRouter: ChatEventRouter
  ) {
    this.config = this.getDefaultConfiguration();
    this.loadConfiguration();
    this.setupConfigurationWatchers();
  }
  
  private loadConfiguration(): void {
    console.log(`[ConfigurationManager] Loading configuration...`);
    const defaults = this.getDefaultConfiguration();
    console.log(`[ConfigurationManager] Default config:`, JSON.stringify(defaults, null, 2));
    
    const globalConfig = this.getVSCodeConfiguration();
    console.log(`[ConfigurationManager] Global VS Code config:`, JSON.stringify(globalConfig, null, 2));
    
    const workspaceConfig = this.getWorkspaceConfiguration();
    console.log(`[ConfigurationManager] Workspace config:`, JSON.stringify(workspaceConfig, null, 2));
    
    const userConfig = this.getUserConfiguration();
    console.log(`[ConfigurationManager] User config from globalState:`, JSON.stringify(userConfig, null, 2));
    
    this.config = this.mergeConfigurations([
      defaults,
      globalConfig,
      workspaceConfig,
      userConfig
    ]);
    
    console.log(`[ConfigurationManager] Final merged config:`, JSON.stringify(this.config, null, 2));
  }
  
  private getDefaultConfiguration(): ChatConfiguration {
    return {
      providers: {},
      ui: {
        theme: 'auto',
        layout: 'embedded',
        position: 'right',
        showTimestamps: true,
        compactMode: false,
        animationsEnabled: true
      },
      interaction: {
        hotkeys: {
          send: 'enter',
          newLine: 'shift_enter',
          clearChat: 'ctrl+l',
          switchProvider: 'ctrl+shift+p'
        },
        inputBehavior: {
          showCharacterCounter: true,
          sendOnPaste: false,
          enableCommandDetection: true,
          enableHistoryNavigation: true,
          enableDraftPersistence: false,
          maxHistorySize: 50,
          draftSaveDelay: 1000
        },
        autoSave: true,
        showSendButton: true,
        streaming: true
      },
      integration: {
        taskIntegration: true,
        taskKeywords: ['task', 'todo', 'reminder', 'schedule'],
        autoSuggestTasks: true,
        linkToWorkspace: true
      },
      advanced: {
        maxHistorySize: 1000,
        requestTimeout: 30000,
        retryAttempts: 3,
        debugMode: false
      }
    };
  }
  
  private getVSCodeConfiguration(): Partial<ChatConfiguration> {
    const config = vscode.workspace.getConfiguration('vesperaForge.chat');
    
    // TODO: Implement comprehensive VS Code configuration loading
    return {
      providers: config.get('providers', {}),
      ui: {
        layout: config.get('ui.layout', 'embedded'),
        position: config.get('ui.position', 'right'),
        theme: config.get('ui.theme', 'auto'),
        showTimestamps: config.get('ui.showTimestamps', true),
        compactMode: config.get('ui.compactMode', false),
        animationsEnabled: config.get('ui.animationsEnabled', true)
      },
      interaction: {
        hotkeys: {
          send: config.get('hotkeys.send', 'enter'),
          newLine: config.get('hotkeys.newLine', 'shift_enter'),
          clearChat: config.get('hotkeys.clearChat', 'ctrl+l'),
          switchProvider: config.get('hotkeys.switchProvider', 'ctrl+shift+p')
        },
        inputBehavior: {
          showCharacterCounter: config.get('inputBehavior.showCharacterCounter', true),
          sendOnPaste: config.get('inputBehavior.sendOnPaste', false),
          enableCommandDetection: config.get('inputBehavior.enableCommandDetection', true),
          enableHistoryNavigation: config.get('inputBehavior.enableHistoryNavigation', true),
          enableDraftPersistence: config.get('inputBehavior.enableDraftPersistence', false),
          maxHistorySize: config.get('inputBehavior.maxHistorySize', 50),
          draftSaveDelay: config.get('inputBehavior.draftSaveDelay', 1000)
        },
        autoSave: config.get('interaction.autoSave', true),
        showSendButton: config.get('interaction.showSendButton', true),
        streaming: config.get('interaction.streaming', true)
      },
      integration: {
        taskIntegration: config.get('integration.taskIntegration', true),
        taskKeywords: config.get('integration.taskKeywords', []),
        autoSuggestTasks: config.get('integration.autoSuggestTasks', true),
        linkToWorkspace: config.get('integration.linkToWorkspace', true)
      },
      advanced: {
        maxHistorySize: config.get('advanced.maxHistorySize', 1000),
        requestTimeout: config.get('advanced.requestTimeout', 30000),
        retryAttempts: config.get('advanced.retryAttempts', 3),
        debugMode: config.get('advanced.debugMode', false)
      }
    };
  }
  
  private getWorkspaceConfiguration(): Partial<ChatConfiguration> {
    // Load workspace-specific configuration from .vscode/settings.json
    try {
      const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge.chat', null);
      return this.extractConfigurationFromVSCode(workspaceConfig);
    } catch (error) {
      console.warn('Failed to load workspace configuration:', error);
      return {};
    }
  }
  
  private getUserConfiguration(): Partial<ChatConfiguration> {
    // Load user-specific configuration from extension global state
    try {
      const userConfig = this.context.globalState.get<Partial<ChatConfiguration>>('vesperaForge.chat.user', {});
      return userConfig;
    } catch (error) {
      console.warn('Failed to load user configuration:', error);
      return {};
    }
  }
  
  private extractConfigurationFromVSCode(config: vscode.WorkspaceConfiguration): Partial<ChatConfiguration> {
    return {
      providers: config.get('providers', {}),
      ui: {
        layout: config.get('ui.layout') || 'embedded',
        position: config.get('ui.position') || 'right',
        theme: config.get('ui.theme') || 'auto',
        showTimestamps: config.get('ui.showTimestamps') ?? true,
        compactMode: config.get('ui.compactMode') ?? false,
        animationsEnabled: config.get('ui.animationsEnabled') ?? true
      },
      interaction: {
        hotkeys: {
          send: config.get('hotkeys.send') || 'enter',
          newLine: config.get('hotkeys.newLine') || 'shift_enter', 
          clearChat: config.get('hotkeys.clearChat') || 'ctrl+l',
          switchProvider: config.get('hotkeys.switchProvider') || 'ctrl+shift+p'
        },
        inputBehavior: {
          showCharacterCounter: config.get('inputBehavior.showCharacterCounter') ?? true,
          sendOnPaste: config.get('inputBehavior.sendOnPaste') ?? false,
          enableCommandDetection: config.get('inputBehavior.enableCommandDetection') ?? true,
          enableHistoryNavigation: config.get('inputBehavior.enableHistoryNavigation') ?? true,
          enableDraftPersistence: config.get('inputBehavior.enableDraftPersistence') ?? false,
          maxHistorySize: config.get('inputBehavior.maxHistorySize') ?? 50,
          draftSaveDelay: config.get('inputBehavior.draftSaveDelay') ?? 1000
        },
        autoSave: config.get('interaction.autoSave') ?? true,
        showSendButton: config.get('interaction.showSendButton') ?? true,
        streaming: config.get('interaction.streaming') ?? true
      },
      integration: {
        taskIntegration: config.get('integration.taskIntegration') ?? true,
        taskKeywords: config.get('integration.taskKeywords') ?? ['task', 'todo', 'reminder', 'schedule'],
        autoSuggestTasks: config.get('integration.autoSuggestTasks') ?? true,
        linkToWorkspace: config.get('integration.linkToWorkspace') ?? true
      },
      advanced: {
        maxHistorySize: config.get('advanced.maxHistorySize') ?? 1000,
        requestTimeout: config.get('advanced.requestTimeout') ?? 30000,
        retryAttempts: config.get('advanced.retryAttempts') ?? 3,
        debugMode: config.get('advanced.debugMode') ?? false
      }
    };
  }
  
  private mergeConfigurations(configs: Partial<ChatConfiguration>[]): ChatConfiguration {
    // Deep merge configurations with proper handling of nested objects
    const merged = this.getDefaultConfiguration();
    
    for (const config of configs) {
      if (config.providers) {
        merged.providers = this.deepMerge(merged.providers, config.providers);
      }
      if (config.ui) {
        merged.ui = this.deepMerge(merged.ui, config.ui);
      }
      if (config.interaction) {
        merged.interaction = this.deepMerge(merged.interaction, config.interaction);
      }
      if (config.integration) {
        merged.integration = this.deepMerge(merged.integration, config.integration);
      }
      if (config.advanced) {
        merged.advanced = this.deepMerge(merged.advanced, config.advanced);
      }
    }
    
    return merged;
  }
  
  private deepMerge<T extends Record<string, any>>(target: T, source: Partial<T>): T {
    const result = { ...target };
    
    for (const key in source) {
      if (source[key] !== undefined && source[key] !== null) {
        if (this.isObject(source[key]) && this.isObject(result[key])) {
          result[key] = this.deepMerge(result[key], source[key]);
        } else {
          result[key] = source[key] as any;
        }
      }
    }
    
    return result;
  }
  
  private isObject(value: any): value is Record<string, any> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
  }
  
  private setupConfigurationWatchers(): void {
    // Watch VS Code settings changes
    const settingsWatcher = vscode.workspace.onDidChangeConfiguration((e) => {
      if (e.affectsConfiguration('vesperaForge.chat')) {
        this.loadConfiguration();
        this.notifyWatchers('settings', this.config);
      }
    });
    this.disposables.push(settingsWatcher);
    
    // Watch template changes in extension directory
    const templatePattern = new vscode.RelativePattern(
      vscode.Uri.joinPath(this.context.extensionUri, 'templates'), 
      '**/*.json5'
    );
    const templateWatcher = vscode.workspace.createFileSystemWatcher(templatePattern);
    
    templateWatcher.onDidChange(() => {
      this.loadConfiguration();
      this.notifyWatchers('templates', this.config);
    });
    
    templateWatcher.onDidCreate(() => {
      this.loadConfiguration();
      this.notifyWatchers('templates', this.config);
    });
    
    templateWatcher.onDidDelete(() => {
      this.loadConfiguration();
      this.notifyWatchers('templates', this.config);
    });
    
    this.disposables.push(templateWatcher);
    
    // Watch workspace template changes
    if (vscode.workspace.workspaceFolders) {
      for (const folder of vscode.workspace.workspaceFolders) {
        const workspacePattern = new vscode.RelativePattern(
          vscode.Uri.joinPath(folder.uri, '.vscode', 'vespera-templates'),
          '*.json5'
        );
        const workspaceWatcher = vscode.workspace.createFileSystemWatcher(workspacePattern);
        
        workspaceWatcher.onDidChange(() => {
          this.loadConfiguration();
          this.notifyWatchers('workspace-templates', this.config);
        });
        
        workspaceWatcher.onDidCreate(() => {
          this.loadConfiguration();
          this.notifyWatchers('workspace-templates', this.config);
        });
        
        workspaceWatcher.onDidDelete(() => {
          this.loadConfiguration();
          this.notifyWatchers('workspace-templates', this.config);
        });
        
        this.disposables.push(workspaceWatcher);
      }
    }
  }
  
  // Configuration access methods
  getConfiguration(): ChatConfiguration {
    return { ...this.config };
  }
  
  getProviderConfig(providerId: string): ProviderConfig | undefined {
    return this.config.providers[providerId]?.config;
  }
  
  async updateConfiguration(
    scope: ConfigScope,
    updates: Partial<ChatConfiguration>
  ): Promise<void> {
    switch (scope) {
      case 'global':
        await this.updateVSCodeConfiguration(updates);
        break;
      case 'workspace':
        await this.updateWorkspaceConfiguration(updates);
        break;
      case 'user':
        await this.updateUserConfiguration(updates);
        break;
    }
    
    this.loadConfiguration();
    this.notifyWatchers(scope, this.config);
    
    // Emit configuration change event
    this.eventRouter.emit(new ConfigurationChangedEvent({
      providerId: 'system', // TODO: Make this more specific
      changes: updates
    }));
  }
  
  private async updateVSCodeConfiguration(updates: Partial<ChatConfiguration>): Promise<void> {
    const config = vscode.workspace.getConfiguration('vesperaForge.chat');
    
    // Update providers configuration
    if (updates.providers) {
      await config.update('providers', updates.providers, vscode.ConfigurationTarget.Global);
    }
    
    // Update UI configuration
    if (updates.ui) {
      for (const [key, value] of Object.entries(updates.ui)) {
        if (value !== undefined) {
          await config.update(`ui.${key}`, value, vscode.ConfigurationTarget.Global);
        }
      }
    }
    
    // Update interaction configuration
    if (updates.interaction) {
      if (updates.interaction.hotkeys) {
        for (const [key, value] of Object.entries(updates.interaction.hotkeys)) {
          if (value !== undefined) {
            await config.update(`hotkeys.${key}`, value, vscode.ConfigurationTarget.Global);
          }
        }
      }
      
      if (updates.interaction.inputBehavior) {
        for (const [key, value] of Object.entries(updates.interaction.inputBehavior)) {
          if (value !== undefined) {
            await config.update(`inputBehavior.${key}`, value, vscode.ConfigurationTarget.Global);
          }
        }
      }
      
      const interactionKeys = ['autoSave', 'showSendButton', 'streaming'];
      for (const key of interactionKeys) {
        if (updates.interaction[key as keyof typeof updates.interaction] !== undefined) {
          await config.update(
            `interaction.${key}`, 
            updates.interaction[key as keyof typeof updates.interaction], 
            vscode.ConfigurationTarget.Global
          );
        }
      }
    }
    
    // Update integration configuration
    if (updates.integration) {
      for (const [key, value] of Object.entries(updates.integration)) {
        if (value !== undefined) {
          await config.update(`integration.${key}`, value, vscode.ConfigurationTarget.Global);
        }
      }
    }
    
    // Update advanced configuration
    if (updates.advanced) {
      for (const [key, value] of Object.entries(updates.advanced)) {
        if (value !== undefined) {
          await config.update(`advanced.${key}`, value, vscode.ConfigurationTarget.Global);
        }
      }
    }
  }
  
  private async updateWorkspaceConfiguration(updates: Partial<ChatConfiguration>): Promise<void> {
    const config = vscode.workspace.getConfiguration('vesperaForge.chat');
    
    // Update workspace-scoped configuration
    if (updates.providers) {
      await config.update('providers', updates.providers, vscode.ConfigurationTarget.Workspace);
    }
    
    if (updates.ui) {
      for (const [key, value] of Object.entries(updates.ui)) {
        if (value !== undefined) {
          await config.update(`ui.${key}`, value, vscode.ConfigurationTarget.Workspace);
        }
      }
    }
    
    // Add other workspace configuration updates as needed
    console.log('Workspace configuration updated');
  }
  
  private async updateUserConfiguration(updates: Partial<ChatConfiguration>): Promise<void> {
    // Update user configuration in extension global state
    try {
      console.log(`[ConfigurationManager] updateUserConfiguration called with:`, JSON.stringify(updates, null, 2));
      const currentUserConfig = this.context.globalState.get<Partial<ChatConfiguration>>('vesperaForge.chat.user', {});
      console.log(`[ConfigurationManager] Current user config from globalState:`, JSON.stringify(currentUserConfig, null, 2));
      
      const mergedConfig = this.deepMerge(currentUserConfig, updates);
      console.log(`[ConfigurationManager] Merged config to save:`, JSON.stringify(mergedConfig, null, 2));
      
      await this.context.globalState.update('vesperaForge.chat.user', mergedConfig);
      console.log(`[ConfigurationManager] User configuration updated in globalState`);
      
      // Verify it was saved
      const savedConfig = this.context.globalState.get<Partial<ChatConfiguration>>('vesperaForge.chat.user', {});
      console.log(`[ConfigurationManager] Verification - config after save:`, JSON.stringify(savedConfig, null, 2));
    } catch (error) {
      console.error('Failed to update user configuration:', error);
      throw error;
    }
  }
  
  watchConfiguration(
    key: string, 
    callback: ConfigurationWatcher,
    immediate: boolean = false
  ): void {
    const watchers = this.watchers.get(key) || [];
    watchers.push(callback);
    this.watchers.set(key, watchers);
    
    if (immediate) {
      callback(this.config, 'immediate');
    }
  }
  
  private notifyWatchers(changeType: string, config: ChatConfiguration): void {
    this.watchers.forEach((watchers) => {
      watchers.forEach(watcher => watcher(config, changeType));
    });
  }
  
  // Provider configuration methods
  async configureProvider(providerId: string, config: ProviderConfig, scope: ConfigScope = 'user'): Promise<void> {
    console.log(`[ConfigurationManager] configureProvider called - providerId: ${providerId}, scope: ${scope}`);
    console.log(`[ConfigurationManager] config:`, JSON.stringify(config, null, 2));
    
    // Get provider template for validation
    const template = this.templateRegistry.getTemplate(providerId);
    console.log(`[ConfigurationManager] template found:`, template ? 'yes' : 'no');
    if (!template) {
      console.error(`[ConfigurationManager] Provider template not found: ${providerId}`);
      throw new Error(`Provider template not found: ${providerId}`);
    }
    
    // Validate configuration against template schema
    const validationResult = this.validateProviderConfig(config, template);
    if (!validationResult.valid) {
      throw new Error(`Configuration validation failed: ${validationResult.errors.join(', ')}`);
    }
    
    // Encrypt sensitive fields
    const secureConfig = await this.encryptSensitiveFields(config, template);
    
    // Update provider configuration
    const updates: Partial<ChatConfiguration> = {
      providers: {
        [providerId]: {
          enabled: true,
          config: secureConfig,
          isDefault: Object.keys(this.config.providers).length === 0
        }
      }
    };
    
    await this.updateConfiguration(scope, updates);
    
    // Emit VesperaEvent for provider configuration
    const providerTemplate = this.templateRegistry.getTemplate(providerId);
    VesperaEvents.chatProviderConfigured(
      providerId, 
      providerTemplate?.name || providerId, 
      { ...config, apiKey: '[HIDDEN]' } // Don't log sensitive data
    );
  }
  
  async removeProvider(providerId: string, scope: ConfigScope = 'user'): Promise<void> {
    if (!this.config.providers[providerId]) {
      return; // Provider not configured
    }
    
    const updates: Partial<ChatConfiguration> = {
      providers: { ...this.config.providers }
    };
    
    if (updates.providers) {
      delete updates.providers[providerId];
    }
    
    // If this was the default provider, make another one default
    if (this.config.providers[providerId]?.isDefault && updates.providers) {
      const remainingProviders = Object.keys(updates.providers);
      if (remainingProviders.length > 0) {
        const firstProviderId = remainingProviders[0];
        if (firstProviderId && updates.providers[firstProviderId]) {
          updates.providers[firstProviderId]!.isDefault = true;
        }
      }
    }
    
    await this.updateConfiguration(scope, updates);
    
    // Emit VesperaEvent for provider removal
    const providerTemplate = this.templateRegistry.getTemplate(providerId);
    VesperaEvents.chatProviderRemoved(providerId, providerTemplate?.name);
  }
  
  async setDefaultProvider(providerId: string, scope: ConfigScope = 'user'): Promise<void> {
    if (!this.config.providers[providerId]) {
      throw new Error(`Provider not configured: ${providerId}`);
    }
    
    const updates: Partial<ChatConfiguration> = {
      providers: { ...this.config.providers }
    };
    
    // Remove default from all providers
    if (updates.providers) {
      for (const provider of Object.values(updates.providers)) {
        provider.isDefault = false;
      }
    }
    
    // Set new default
    if (updates.providers && updates.providers[providerId]) {
      updates.providers[providerId].isDefault = true;
    }
    
    await this.updateConfiguration(scope, updates);
    
    // Emit VesperaEvent for provider change
    const providerTemplate = this.templateRegistry.getTemplate(providerId);
    VesperaEvents.chatProviderChanged(undefined, providerId, providerTemplate?.name);
  }
  
  getAvailableProviders(): ProviderTemplate[] {
    return this.templateRegistry.getTemplatesByCategory('llm_provider');
  }
  
  getConfiguredProviders(): Array<{ id: string; template: ProviderTemplate; config: ProviderConfig }> {
    const configured: Array<{ id: string; template: ProviderTemplate; config: ProviderConfig }> = [];
    
    for (const [providerId, providerData] of Object.entries(this.config.providers)) {
      if (providerData.enabled) {
        const template = this.templateRegistry.getTemplate(providerId);
        if (template) {
          configured.push({
            id: providerId,
            template,
            config: providerData.config
          });
        }
      }
    }
    
    return configured;
  }
  
  private validateProviderConfig(config: ProviderConfig, template: ProviderTemplate): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Use template's config_schema if available
    if (template.config_schema) {
      const schemaErrors = this.validateAgainstJsonSchema(config, template.config_schema);
      errors.push(...schemaErrors);
    } else {
      // Fallback to UI schema validation
      if (template.ui_schema && template.ui_schema.config_fields) {
        const uiSchemaErrors = this.validateAgainstUISchema(config, template.ui_schema.config_fields);
        errors.push(...uiSchemaErrors);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors
    };
  }
  
  private validateAgainstJsonSchema(config: any, schema: ConfigSchema): string[] {
    const errors: string[] = [];
    
    // Check required fields
    if (schema.required) {
      for (const requiredField of schema.required) {
        if (!(requiredField in config) || config[requiredField] === undefined || config[requiredField] === null) {
          errors.push(`Required field missing: ${requiredField}`);
        }
      }
    }
    
    // Validate each property
    for (const [fieldName, fieldSchema] of Object.entries(schema.properties)) {
      if (fieldName in config) {
        const fieldErrors = this.validateFieldAgainstSchema(config[fieldName], fieldSchema, fieldName);
        errors.push(...fieldErrors);
      }
    }
    
    return errors;
  }
  
  private validateFieldAgainstSchema(value: any, schema: JsonSchemaProperty, fieldName: string): string[] {
    const errors: string[] = [];
    
    // Type validation
    if (schema.type && typeof value !== schema.type) {
      if (!(schema.type === 'number' && typeof value === 'string' && !isNaN(Number(value)))) {
        errors.push(`Field ${fieldName} must be of type ${schema.type}`);
        return errors; // Don't continue validation if type is wrong
      }
    }
    
    // Pattern validation
    if (schema.pattern && typeof value === 'string') {
      const regex = new RegExp(schema.pattern);
      if (!regex.test(value)) {
        errors.push(`Field ${fieldName} does not match required pattern`);
      }
    }
    
    // Number validations
    if (schema.type === 'number' || typeof value === 'number') {
      const numValue = typeof value === 'string' ? Number(value) : value;
      
      if (schema.minimum !== undefined && numValue < schema.minimum) {
        errors.push(`Field ${fieldName} must be at least ${schema.minimum}`);
      }
      
      if (schema.maximum !== undefined && numValue > schema.maximum) {
        errors.push(`Field ${fieldName} must be at most ${schema.maximum}`);
      }
    }
    
    // String validations
    if (schema.type === 'string' || typeof value === 'string') {
      if (schema.minLength !== undefined && value.length < schema.minLength) {
        errors.push(`Field ${fieldName} must be at least ${schema.minLength} characters`);
      }
      
      if (schema.maxLength !== undefined && value.length > schema.maxLength) {
        errors.push(`Field ${fieldName} must be at most ${schema.maxLength} characters`);
      }
    }
    
    // Enum validation
    if (schema.enum && !schema.enum.includes(value)) {
      errors.push(`Field ${fieldName} must be one of: ${schema.enum.join(', ')}`);
    }
    
    return errors;
  }
  
  private validateAgainstUISchema(config: any, fields: any[]): string[] {
    const errors: string[] = [];
    
    for (const field of fields) {
      if (field.required && (!(field.name in config) || config[field.name] === undefined || config[field.name] === '')) {
        errors.push(`Required field missing: ${field.name}`);
        continue;
      }
      
      if (field.name in config && field.validation) {
        const value = config[field.name];
        const validation = field.validation;
        
        if (validation.pattern && typeof value === 'string') {
          const regex = new RegExp(validation.pattern);
          if (!regex.test(value)) {
            errors.push(validation.message || `Field ${field.name} does not match required pattern`);
          }
        }
        
        if (validation.min !== undefined && typeof value === 'number' && value < validation.min) {
          errors.push(validation.message || `Field ${field.name} must be at least ${validation.min}`);
        }
        
        if (validation.max !== undefined && typeof value === 'number' && value > validation.max) {
          errors.push(validation.message || `Field ${field.name} must be at most ${validation.max}`);
        }
        
        if (validation.options && !validation.options.includes(value)) {
          errors.push(validation.message || `Field ${field.name} must be one of: ${validation.options.join(', ')}`);
        }
      }
    }
    
    return errors;
  }
  
  private async encryptSensitiveFields(config: ProviderConfig, template: ProviderTemplate): Promise<ProviderConfig> {
    const secureConfig = { ...config };
    
    // Encrypt fields marked as password type
    if (template.ui_schema && template.ui_schema.config_fields) {
      for (const field of template.ui_schema.config_fields) {
        if (field.type === 'password' && field.name in secureConfig) {
          try {
            secureConfig[field.name] = await encrypt(secureConfig[field.name]);
          } catch (error) {
            console.warn(`Failed to encrypt field ${field.name}:`, error);
            // Continue without encryption - better to have working config than to fail
          }
        }
      }
    }
    
    return secureConfig;
  }
  
  async getDecryptedProviderConfig(providerId: string): Promise<ProviderConfig | undefined> {
    const providerData = this.config.providers[providerId];
    if (!providerData?.enabled) {
      return undefined;
    }
    
    const template = this.templateRegistry.getTemplate(providerId);
    if (!template) {
      return providerData.config;
    }
    
    const decryptedConfig = { ...providerData.config };
    
    // Decrypt fields that were encrypted
    if (template.ui_schema && template.ui_schema.config_fields) {
      for (const field of template.ui_schema.config_fields) {
        if (field.type === 'password' && field.name in decryptedConfig) {
          try {
            decryptedConfig[field.name] = await decrypt(decryptedConfig[field.name]);
          } catch (error) {
            console.warn(`Failed to decrypt field ${field.name}:`, error);
            // Return encrypted value as fallback
          }
        }
      }
    }
    
    return decryptedConfig;
  }
  
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    this.watchers.clear();
  }
}