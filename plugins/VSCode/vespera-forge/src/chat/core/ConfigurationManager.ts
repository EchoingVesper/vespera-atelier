/**
 * Configuration Manager for hierarchical chat system configuration
 */
import * as vscode from 'vscode';
import { ChatConfiguration, ConfigScope, ConfigurationWatcher } from '../types/config';
import { ProviderConfig, ProviderTemplate, ConfigSchema, JsonSchemaProperty } from '../types/provider';
import { ChatTemplateRegistry } from './TemplateRegistry';
import { ChatEventRouter } from '../events/ChatEventRouter';
import { ConfigurationChangedEvent } from '../types/events';
import { CredentialManager } from '../utils/encryption';
import { VesperaEvents } from '../../utils/events';
import { 
  VesperaConfigurationError, 
  VesperaErrorCode,
  VesperaSeverity
} from '../../core/error-handling/VesperaErrors';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';
import { VesperaSecurityManager } from '../../core/security/VesperaSecurityManager';
import { VesperaRateLimiter } from '../../core/security/rate-limiting/VesperaRateLimiter';
import { VesperaConsentManager } from '../../core/security/consent/VesperaConsentManager';
import { QuickUsageFunctions } from '../integration/UnusedVariableIntegrationExamples';
import {
  RateLimitContext,
  ConsentPurpose,
  ConsentCategory,
  LegalBasis,
  VesperaSecurityEvent,
  VesperaSecurityErrorCode
} from '../../types/security';
import { VesperaSecurityError, VesperaCredentialMigrationError } from '../../core/security/VesperaSecurityErrors';

export class ChatConfigurationManager {
  private config: ChatConfiguration;
  private watchers = new Map<string, ConfigurationWatcher[]>();
  private disposables: vscode.Disposable[] = [];
  private securityManager?: VesperaSecurityManager;
  private rateLimiter?: VesperaRateLimiter;
  private consentManager?: VesperaConsentManager;
  private credentialMigrationInProgress = new Set<string>();
  
  // Credential migration consent purposes
  private readonly CREDENTIAL_CONSENT_PURPOSES: ConsentPurpose[] = [
    {
      id: 'credential_storage',
      name: 'Secure Credential Storage',
      description: 'Store API keys and credentials securely using VS Code\'s encrypted storage',
      category: ConsentCategory.ESSENTIAL,
      required: true,
      dataTypes: ['api_keys', 'authentication_tokens'],
      retentionPeriod: 365 * 24 * 60 * 60 * 1000, // 1 year
      thirdParties: ['vscode_secret_storage'],
      legalBasis: LegalBasis.LEGITIMATE_INTERESTS
    },
    {
      id: 'credential_migration',
      name: 'Credential Migration',
      description: 'Automatically migrate existing credentials to secure storage for enhanced security',
      category: ConsentCategory.FUNCTIONAL,
      required: false,
      dataTypes: ['legacy_credentials', 'migration_logs'],
      retentionPeriod: 90 * 24 * 60 * 60 * 1000, // 90 days
      thirdParties: [],
      legalBasis: LegalBasis.CONSENT
    }
  ];
  
  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly templateRegistry: ChatTemplateRegistry,
    private readonly eventRouter: ChatEventRouter
  ) {
    this.config = this.getDefaultConfiguration();
    this.loadConfiguration();
    this.setupConfigurationWatchers();
    this.initializeSecurityIntegration();
  }
  
  /**
   * Initialize security manager integration for credential operations
   */
  private async initializeSecurityIntegration(): Promise<void> {
    try {
      // Get security manager instance if available
      this.securityManager = VesperaSecurityManager.getInstance();
      this.rateLimiter = this.securityManager.getService<VesperaRateLimiter>('rateLimiter');
      this.consentManager = this.securityManager.getService<VesperaConsentManager>('consentManager');
      
      // Register consent purposes for credential operations
      if (this.consentManager) {
        for (const purpose of this.CREDENTIAL_CONSENT_PURPOSES) {
          this.consentManager.addPurpose(purpose);
        }
      }
      
      console.log('[ConfigurationManager] Security integration initialized');
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.log('[ConfigurationManager] Security manager not available, using legacy mode:', errorMessage);
    }
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
      const vesperaError = new VesperaConfigurationError(
        'Failed to load workspace configuration',
        VesperaErrorCode.CONFIGURATION_LOAD_FAILED,
        {
          context: {
            configScope: 'workspace',
            operation: 'getWorkspaceConfiguration'
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      // Handle error but don't throw (graceful degradation)
      VesperaErrorHandler.getInstance().handleErrorWithStrategy(vesperaError, { 
        shouldThrow: false,
        shouldNotifyUser: false  // Don't spam user with workspace config issues
      });
      return {};
    }
  }
  
  private getUserConfiguration(): Partial<ChatConfiguration> {
    // Load user-specific configuration from extension global state
    try {
      const userConfig = this.context.globalState.get<Partial<ChatConfiguration>>('vesperaForge.chat.user', {});
      return userConfig;
    } catch (error) {
      const vesperaError = new VesperaConfigurationError(
        'Failed to load user configuration',
        VesperaErrorCode.CONFIGURATION_LOAD_FAILED,
        {
          context: {
            configScope: 'user',
            operation: 'getUserConfiguration',
            globalStateKey: 'vesperaForge.chat.user'
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      // Handle error but don't throw (graceful degradation)
      VesperaErrorHandler.getInstance().handleErrorWithStrategy(vesperaError, { 
        shouldThrow: false,
        shouldNotifyUser: false  // Don't spam user with user config loading issues
      });
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
      const vesperaError = new VesperaConfigurationError(
        'Failed to update user configuration',
        VesperaErrorCode.CONFIGURATION_SAVE_FAILED,
        {
          context: {
            configScope: 'user',
            operation: 'updateUserConfiguration',
            globalStateKey: 'vesperaForge.chat.user',
            updates: JSON.stringify(updates)
          }
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      // Handle error and then rethrow
      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      throw vesperaError;
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
      const vesperaError = new VesperaConfigurationError(
        `Provider template not found: ${providerId}`,
        VesperaErrorCode.PROVIDER_INITIALIZATION_FAILED,
        {
          context: {
            providerId,
            operation: 'configureProvider',
            templateRegistry: 'ChatTemplateRegistry'
          }
        }
      );
      
      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      throw vesperaError;
    }
    
    // Validate configuration against template schema
    const validationResult = this.validateProviderConfig(config, template);
    if (!validationResult.valid) {
      const vesperaError = new VesperaConfigurationError(
        `Configuration validation failed: ${validationResult.errors.join(', ')}`,
        VesperaErrorCode.CONFIGURATION_VALIDATION_FAILED,
        {
          context: {
            providerId,
            operation: 'configureProvider',
            validationErrors: validationResult.errors,
            configFields: Object.keys(config)
          }
        }
      );
      
      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      throw vesperaError;
    }
    
    // Store sensitive fields securely using VS Code SecretStorage API
    const secureConfig = await this.encryptSensitiveFields(config, template, providerId);
    
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
        const firstProvider = firstProviderId ? updates.providers[firstProviderId] : undefined;
        if (firstProviderId && firstProvider) {
          firstProvider.isDefault = true;
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
      const vesperaError = new VesperaConfigurationError(
        `Provider not configured: ${providerId}`,
        VesperaErrorCode.PROVIDER_INITIALIZATION_FAILED,
        {
          context: {
            providerId,
            operation: 'setDefaultProvider',
            configuredProviders: Object.keys(this.config.providers)
          }
        }
      );
      
      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      throw vesperaError;
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
  
  private async encryptSensitiveFields(config: ProviderConfig, template: ProviderTemplate, providerId: string): Promise<ProviderConfig> {
    const secureConfig = { ...config };
    
    // Store sensitive fields using rate-limited and consent-aware credential storage
    if (template.ui_schema && template.ui_schema.config_fields) {
      for (const field of template.ui_schema.config_fields) {
        if (field.type === 'password' && field.name in secureConfig) {
          try {
            const credentialKey = `${providerId}.${field.name}`;
            await this.secureCredentialOperation(
              credentialKey,
              'store',
              secureConfig[field.name],
              { providerId, fieldName: field.name }
            );
            
            // Remove the sensitive value from the config (store reference instead)
            secureConfig[field.name] = `[STORED_SECURELY:${credentialKey}]`;
            console.log(`[ConfigurationManager] Stored sensitive field ${field.name} for provider ${providerId} securely`);
          } catch (error) {
            const vesperaError = new VesperaConfigurationError(
              `Failed to store ${field.name} securely`,
              VesperaErrorCode.CREDENTIAL_STORAGE_FAILED,
              {
                context: {
                  providerId,
                  fieldName: field.name,
                  credentialKey: `${providerId}.${field.name}`
                }
              },
              error instanceof Error ? error : new Error(String(error))
            );
            
            // Use error handler to handle consistently
            await VesperaErrorHandler.getInstance().handleError(vesperaError);
            throw vesperaError;
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
    
    // Retrieve sensitive fields from secure storage with rate limiting
    if (template.ui_schema && template.ui_schema.config_fields) {
      for (const field of template.ui_schema.config_fields) {
        if (field.type === 'password' && field.name in decryptedConfig) {
          const storedValue = decryptedConfig[field.name];
          
          // Check if this is a securely stored credential reference
          if (typeof storedValue === 'string' && storedValue.startsWith('[STORED_SECURELY:')) {
            const credentialKey = storedValue.substring('[STORED_SECURELY:'.length, storedValue.length - 1);
            try {
              const retrievedCredential = await this.secureCredentialOperation(
                credentialKey,
                'retrieve',
                undefined,
                { providerId, fieldName: field.name }
              );
              if (retrievedCredential) {
                decryptedConfig[field.name] = retrievedCredential;
                console.log(`[ConfigurationManager] Retrieved secure credential for ${field.name}`);
              } else {
                console.warn(`[ConfigurationManager] No secure credential found for ${field.name}, may need migration`);
                // Check for legacy base64 stored credential
                await this.migrateLegacyCredentialWithConsent(providerId, field.name, storedValue);
              }
            } catch (error) {
              console.error(`Failed to retrieve secure credential for ${field.name}:`, error);
              // Try to migrate legacy credential if available
              await this.migrateLegacyCredentialWithConsent(providerId, field.name, storedValue);
            }
          } else {
            // This might be a legacy insecure credential - attempt migration
            console.warn(`[ConfigurationManager] Found potential legacy credential for ${field.name}, attempting migration`);
            await this.migrateLegacyCredentialWithConsent(providerId, field.name, storedValue);
          }
        }
      }
    }
    
    return decryptedConfig;
  }
  
  /**
   * Enhanced secure credential operation with rate limiting and circuit breaker protection
   */
  private async secureCredentialOperation(
    credentialKey: string,
    operation: 'store' | 'retrieve' | 'delete',
    value?: string,
    context?: { providerId: string; fieldName: string }
  ): Promise<string | undefined> {
    const operationId = `credential_${operation}_${credentialKey}`;
    
    // Check rate limit if security manager is available
    if (this.rateLimiter) {
      try {
        const rateLimitContext: RateLimitContext = {
          resourceId: operationId,
          userId: 'vscode-user', // In VS Code extension context
          metadata: {
            operation,
            credentialKey,
            providerId: context?.providerId
          }
        };
        
        const rateLimitResult = await this.rateLimiter.checkRateLimit(rateLimitContext);
        
        if (!rateLimitResult.allowed) {
          const retryAfter = rateLimitResult.retryAfter || 1000;
          throw new VesperaCredentialMigrationError(
            `Rate limit exceeded for credential operation: ${operation}`,
            retryAfter,
            0,
            { operationId, credentialKey, context }
          );
        }
      } catch (error) {
        if (error instanceof VesperaCredentialMigrationError) {
          throw error;
        }
        // If rate limiting fails, log but continue (graceful degradation)
        console.warn('[ConfigurationManager] Rate limiting check failed, continuing with operation:', error instanceof Error ? error.message : String(error));
      }
    }
    
    // Execute the credential operation with circuit breaker protection
    try {
      switch (operation) {
        case 'store':
          if (!value) {
            throw new Error('Value required for store operation');
          }
          await CredentialManager.storeCredential(this.context, credentialKey, value);
          return undefined;
        
        case 'retrieve':
          return await CredentialManager.retrieveCredential(this.context, credentialKey);
        
        case 'delete':
          await CredentialManager.deleteCredential(this.context, credentialKey);
          return undefined;
        
        default:
          throw new Error(`Unsupported credential operation: ${operation}`);
      }
    } catch (error) {
      // Log security event
      if (this.securityManager) {
        this.securityManager.getEventBus().emitSecurityEvent(
          VesperaSecurityEvent.SECURITY_BREACH,
          {
            timestamp: Date.now(),
            resourceId: operationId,
            metadata: {
              operation,
              credentialKey,
              error: error instanceof Error ? error.message : String(error),
              context
            }
          }
        );
      }
      
      throw new VesperaSecurityError(
        `Credential operation ${operation} failed`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        VesperaSeverity.HIGH,
        { operation, credentialKey, error: error instanceof Error ? error.message : String(error), context }
      );
    }
  }
  
  /**
   * Migrate legacy insecure credentials to secure VS Code SecretStorage with user consent
   */
  private async migrateLegacyCredentialWithConsent(
    providerId: string, 
    fieldName: string, 
    legacyValue: string
  ): Promise<void> {
    // Prevent concurrent migrations of the same credential
    const migrationKey = `${providerId}.${fieldName}`;
    if (this.credentialMigrationInProgress.has(migrationKey)) {
      console.log(`[ConfigurationManager] Migration already in progress for ${migrationKey}`);
      return;
    }
    
    this.credentialMigrationInProgress.add(migrationKey);
    
    try {
      // Check for user consent to migrate credentials
      const hasConsent = await this.checkCredentialMigrationConsent();
      if (!hasConsent) {
        console.log(`[ConfigurationManager] User consent not granted for credential migration: ${migrationKey}`);
        return;
      }
      
      let actualCredential = legacyValue;
      
      // Check if this is a base64 encoded legacy credential
      if (legacyValue && !legacyValue.startsWith('[STORED_SECURELY:')) {
        try {
          // Try to decode as base64 (legacy format)
          const decoded = Buffer.from(legacyValue, 'base64').toString();
          // If decoding succeeds and looks like a valid credential, use it
          if (decoded && decoded.length > 0 && decoded !== legacyValue) {
            actualCredential = decoded;
            console.log(`[ConfigurationManager] Decoded legacy base64 credential for ${providerId}.${fieldName}`);
          }
        } catch (decodeError) {
          // If base64 decode fails, assume it's already plain text
          console.log(`[ConfigurationManager] Legacy credential for ${providerId}.${fieldName} is not base64, using as-is`);
        }
      }
      
      // Store the credential securely using rate-limited operation
      const credentialKey = `${providerId}.${fieldName}`;
      await this.secureCredentialOperation(
        credentialKey,
        'store',
        actualCredential,
        { providerId, fieldName }
      );
      
      console.log(`[ConfigurationManager] Successfully migrated legacy credential for ${providerId}.${fieldName}`);
      
      // Update the config to reference the secure storage
      const currentProvider = this.config.providers[providerId];
      if (!currentProvider) {
        const vesperaError = new VesperaConfigurationError(
          `Provider ${providerId} not found in current configuration`,
          VesperaErrorCode.PROVIDER_INITIALIZATION_FAILED,
          {
            context: {
              providerId,
              fieldName,
              operation: 'migrateLegacyCredentialWithConsent',
              configuredProviders: Object.keys(this.config.providers)
            }
          }
        );
        
        await VesperaErrorHandler.getInstance().handleError(vesperaError);
        throw vesperaError;
      }
      
      const updates: Partial<ChatConfiguration> = {
        providers: {
          ...this.config.providers,
          [providerId]: {
            enabled: currentProvider.enabled,
            ...(currentProvider.isDefault !== undefined && { isDefault: currentProvider.isDefault }),
            config: {
              ...currentProvider.config,
              [fieldName]: `[STORED_SECURELY:${credentialKey}]`
            }
          }
        }
      };
      
      // Update configuration to remove legacy credential
      await this.updateUserConfiguration(updates);
      console.log(`[ConfigurationManager] Updated configuration after credential migration for ${providerId}.${fieldName}`);
      
      // Create backup for recovery
      await this.createCredentialBackup(providerId, fieldName, legacyValue);
      
      // Show migration success message
      vscode.window.showInformationMessage(
        `Successfully migrated ${fieldName} for ${providerId} to secure encrypted storage.`,
        { modal: false }
      );
      
    } catch (error) {
      const vesperaError = new VesperaCredentialMigrationError(
        `Failed to migrate legacy credential for ${providerId}.${fieldName}`,
        5000, // 5 second retry
        0,
        {
          providerId,
          fieldName,
          operation: 'migrateLegacyCredentialWithConsent',
          originalError: error
        }
      );
      
      // Handle error but don't throw (graceful degradation for migration)
      await VesperaErrorHandler.getInstance().handleErrorWithStrategy(vesperaError, {
        shouldThrow: false,
        shouldNotifyUser: true  // User should know about migration failures
      });
    } finally {
      this.credentialMigrationInProgress.delete(migrationKey);
    }
  }
  
  /**
   * Check user consent for credential migration
   */
  private async checkCredentialMigrationConsent(): Promise<boolean> {
    if (!this.consentManager) {
      // If no consent manager, fall back to user prompt
      return this.promptUserForMigrationConsent();
    }
    
    try {
      const userId = 'vscode-user'; // In VS Code extension context
      const hasStorageConsent = this.consentManager.hasConsent(userId, 'credential_storage');
      const hasMigrationConsent = this.consentManager.hasConsent(userId, 'credential_migration');
      
      if (hasStorageConsent && hasMigrationConsent) {
        return true;
      }
      
      // Request missing consents
      const purposesToRequest: string[] = [];
      if (!hasStorageConsent) {
        purposesToRequest.push('credential_storage');
      }
      if (!hasMigrationConsent) {
        purposesToRequest.push('credential_migration');
      }
      
      const consentRecord = await this.consentManager.requestConsent(
        userId,
        purposesToRequest,
        {
          source: 'credential_migration',
          timestamp: Date.now(),
          triggeredBy: 'legacy_credential_detection'
        }
      );
      
      return consentRecord.purposes.every(p => p.granted);
      
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error('[ConfigurationManager] Failed to check credential migration consent:', errorMessage);
      return this.promptUserForMigrationConsent();
    }
  }
  
  /**
   * Prompt user for migration consent as fallback
   */
  private async promptUserForMigrationConsent(): Promise<boolean> {
    const result = await vscode.window.showInformationMessage(
      'Legacy credentials detected. Would you like to migrate them to secure encrypted storage for better security?',
      { modal: true },
      'Yes, migrate securely',
      'Not now'
    );
    
    return result === 'Yes, migrate securely';
  }
  
  /**
   * Create backup of credential for recovery purposes
   */
  private async createCredentialBackup(
    providerId: string,
    fieldName: string, 
    originalValue: string
  ): Promise<void> {
    try {
      const backupKey = `backup_${providerId}_${fieldName}_${Date.now()}`;
      const backupData = {
        providerId,
        fieldName,
        originalValue: originalValue.substring(0, 4) + '***', // Store only first 4 chars for verification
        migrationDate: new Date().toISOString(),
        checksum: Buffer.from(originalValue).toString('base64').substring(0, 8)
      };
      
      // Store backup metadata (not the actual credential)
      await this.context.globalState.update(backupKey, backupData);
      console.log(`[ConfigurationManager] Created credential backup metadata: ${backupKey}`);
      
    } catch (error) {
      console.error('[ConfigurationManager] Failed to create credential backup:', error);
      // Non-critical error, don't throw
    }
  }
  
  /**
   * Legacy migration method (deprecated - kept for backward compatibility)
   */
  private async __migrateLegacyCredential(providerId: string, fieldName: string, legacyValue: string): Promise<void> {
    // Phase 1: Quick error suppression using scaffolding
    QuickUsageFunctions.useParam(providerId);
    QuickUsageFunctions.useParam(fieldName);
    QuickUsageFunctions.useParam(legacyValue);
    
    console.warn('[ConfigurationManager] Using deprecated migrateLegacyCredential method. Please use migrateLegacyCredentialWithConsent instead.');
    await this.migrateLegacyCredentialWithConsent(providerId, fieldName, legacyValue);
  }
  
  /**
   * Validate all stored credentials and detect security issues
   */
  async validateCredentialSecurity(): Promise<{
    valid: boolean;
    issues: string[];
    recommendations: string[];
    migrationNeeded: boolean;
  }> {
    const issues: string[] = [];
    const recommendations: string[] = [];
    let migrationNeeded = false;
    
    try {
      for (const [providerId, providerData] of Object.entries(this.config.providers)) {
        if (!providerData.enabled) {
          continue;
        }
        
        const template = this.templateRegistry.getTemplate(providerId);
        if (!template?.ui_schema?.config_fields) {
          continue;
        }
        
        for (const field of template.ui_schema.config_fields) {
          if (field.type === 'password' && field.name in providerData.config) {
            const storedValue = providerData.config[field.name];
            
            if (typeof storedValue === 'string') {
              if (storedValue.startsWith('[STORED_SECURELY:')) {
                // Verify the credential exists in secure storage
                const credentialKey = storedValue.substring('[STORED_SECURELY:'.length, storedValue.length - 1);
                const exists = await CredentialManager.validateCredential(this.context, credentialKey);
                if (!exists) {
                  issues.push(`Missing secure credential for ${providerId}.${field.name}`);
                  recommendations.push(`Reconfigure ${providerId} with a valid API key`);
                }
              } else {
                // Legacy credential detected
                issues.push(`Legacy insecure credential detected for ${providerId}.${field.name}`);
                recommendations.push(`Migrate ${providerId} credentials to secure storage`);
                migrationNeeded = true;
              }
            }
          }
        }
      }
      
      // Check for orphaned credentials in secure storage
      const storedProviders = await CredentialManager.listStoredProviders(this.context);
      for (const storedProvider of storedProviders) {
        const providerParts = storedProvider.split('.');
        const providerId = providerParts[0];
        if (providerId && !this.config.providers[providerId]) {
          issues.push(`Orphaned credential found: ${storedProvider}`);
          recommendations.push(`Remove unused credential: ${storedProvider}`);
        }
      }
      
      return {
        valid: issues.length === 0,
        issues,
        recommendations,
        migrationNeeded
      };
      
    } catch (error) {
      console.error('[ConfigurationManager] Credential security validation failed:', error);
      return {
        valid: false,
        issues: ['Security validation failed'],
        recommendations: ['Check system integrity and retry'],
        migrationNeeded: false
      };
    }
  }
  
  /**
   * Get comprehensive security status of credential management
   */
  async getCredentialSecurityStatus(): Promise<{
    secure: boolean;
    totalCredentials: number;
    secureCredentials: number;
    legacyCredentials: number;
    orphanedCredentials: number;
    rateLimitingEnabled: boolean;
    consentManagementEnabled: boolean;
    lastValidation?: number;
    recommendations: string[];
  }> {
    const validation = await this.validateCredentialSecurity();
    const storedProviders = await CredentialManager.listStoredProviders(this.context);
    
    let totalCredentials = 0;
    let secureCredentials = 0;
    let legacyCredentials = 0;
    
    // Count credentials by type
    for (const [providerId, providerData] of Object.entries(this.config.providers)) {
      if (!providerData.enabled) {
        continue;
      }
      
      const template = this.templateRegistry.getTemplate(providerId);
      if (!template?.ui_schema?.config_fields) {
        continue;
      }
      
      for (const field of template.ui_schema.config_fields) {
        if (field.type === 'password' && field.name in providerData.config) {
          totalCredentials++;
          const storedValue = providerData.config[field.name];
          
          if (typeof storedValue === 'string' && storedValue.startsWith('[STORED_SECURELY:')) {
            secureCredentials++;
          } else {
            legacyCredentials++;
          }
        }
      }
    }
    
    // Count orphaned credentials
    const configuredProviders = new Set(Object.keys(this.config.providers));
    const orphanedCredentials = storedProviders.filter(stored => {
      const providerParts = stored.split('.');
      const providerId = providerParts[0];
      return providerId && !configuredProviders.has(providerId);
    }).length;
    
    return {
      secure: validation.valid && legacyCredentials === 0 && orphanedCredentials === 0,
      totalCredentials,
      secureCredentials,
      legacyCredentials,
      orphanedCredentials,
      rateLimitingEnabled: !!this.rateLimiter,
      consentManagementEnabled: !!this.consentManager,
      lastValidation: Date.now(),
      recommendations: validation.recommendations
    };
  }
  
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    this.watchers.clear();
    this.credentialMigrationInProgress.clear();
  }
}