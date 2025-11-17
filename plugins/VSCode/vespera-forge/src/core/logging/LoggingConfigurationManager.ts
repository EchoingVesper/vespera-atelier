/**
 * Logging Configuration Manager
 *
 * Handles loading, saving, and hot-reloading of logging configuration
 * from .vespera/config/logging-config.json5
 */

import * as vscode from 'vscode';
import { promises as fsPromises } from 'fs';
import * as path from 'path';
import * as os from 'os';
import JSON5 from 'json5';
import {
  LoggingConfiguration,
  DEFAULT_LOGGING_CONFIG,
  validateLoggingConfiguration,
  serializeLoggingConfiguration,
  LogLevel,
  LogRotationStrategy
} from './LoggingConfiguration';
import { VesperaEvents } from '../../utils/events';
import { validateLogPath, PathValidationError } from './VesperaLogger';

/**
 * Manager for logging configuration with hot-reload support
 */
export class LoggingConfigurationManager {
  private static instance: LoggingConfigurationManager;
  private config: LoggingConfiguration;
  private configPath: string;
  private workspaceConfigPath: string;
  private userConfigPath: string;
  private fileWatcher?: vscode.FileSystemWatcher;
  private disposed = false;

  private constructor(private context: vscode.ExtensionContext) {
    this.config = DEFAULT_LOGGING_CONFIG;

    // Get allowed roots for path validation
    const allowedRoots = this.getAllowedConfigRoots();

    // Determine config paths with validation
    // User-level config: ~/.vespera/config/logging-config.json5 (or %APPDATA% on Windows)
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    const userConfigCandidate = path.join(homeDir, '.vespera', 'config', 'logging-config.json5');

    try {
      this.userConfigPath = validateLogPath(userConfigCandidate, allowedRoots);
    } catch (error) {
      console.error('[SECURITY] User config path validation failed:', error);
      // Fall back to a safe default path in home directory
      this.userConfigPath = path.join(homeDir, '.vespera', 'config', 'logging-config.json5');
    }

    // Workspace-level config: {workspace}/.vespera/config/logging-config.json5
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      const workspaceConfigCandidate = path.join(workspaceFolder.uri.fsPath, '.vespera', 'config', 'logging-config.json5');
      try {
        this.workspaceConfigPath = validateLogPath(workspaceConfigCandidate, allowedRoots);
      } catch (error) {
        console.error('[SECURITY] Workspace config path validation failed:', error);
        this.workspaceConfigPath = '';
      }
    } else {
      this.workspaceConfigPath = '';
    }

    // Workspace config takes precedence
    this.configPath = this.workspaceConfigPath || this.userConfigPath;
  }

  /**
   * Get allowed root directories for configuration file paths
   */
  private getAllowedConfigRoots(): string[] {
    const roots: string[] = [];

    // Workspace directory
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
      roots.push(workspaceFolder.uri.fsPath);
    }

    // User home directory
    const homeDir = process.env['HOME'] || process.env['USERPROFILE'] || '';
    if (homeDir) {
      roots.push(homeDir);
    }

    // Temp directory (fallback)
    roots.push(os.tmpdir());

    return roots;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(context?: vscode.ExtensionContext): LoggingConfigurationManager {
    if (!LoggingConfigurationManager.instance) {
      if (!context) {
        throw new Error('LoggingConfigurationManager requires ExtensionContext on first initialization');
      }
      LoggingConfigurationManager.instance = new LoggingConfigurationManager(context);
    }
    return LoggingConfigurationManager.instance;
  }

  /**
   * Initialize the configuration manager
   */
  public async initialize(): Promise<void> {
    // Try to load existing configuration
    await this.loadConfiguration();

    // Sync with VS Code settings
    this.syncWithVSCodeSettings();

    // Watch for VS Code settings changes
    this.context.subscriptions.push(
      vscode.workspace.onDidChangeConfiguration(e => {
        if (e.affectsConfiguration('vesperaForge.logging')) {
          this.syncWithVSCodeSettings();
        }
      })
    );

    // Set up file watcher for hot-reload
    if (this.configPath) {
      const pattern = new vscode.RelativePattern(
        path.dirname(this.configPath),
        'logging-config.json5'
      );

      this.fileWatcher = vscode.workspace.createFileSystemWatcher(pattern);

      this.fileWatcher.onDidChange(async () => {
        await this.reloadConfiguration();
      });

      this.fileWatcher.onDidCreate(async () => {
        await this.reloadConfiguration();
      });

      this.fileWatcher.onDidDelete(() => {
        // Revert to default config if file is deleted
        this.config = DEFAULT_LOGGING_CONFIG;
        this.notifyConfigurationChanged();
      });
    }

    // If no config file exists, create default
    if (!(await this.configFileExists())) {
      await this.saveConfiguration(DEFAULT_LOGGING_CONFIG);
    }
  }

  /**
   * Load configuration from file
   */
  private async loadConfiguration(): Promise<void> {
    try {
      // Check if file exists using async
      try {
        const content = await fsPromises.readFile(this.configPath, 'utf-8');

        // Parse JSON5 using the json5 library (handles comments and unquoted keys)
        const parsedConfig = JSON5.parse(content);

        // Validate and set configuration
        this.config = validateLoggingConfiguration(parsedConfig);
      } catch (error: any) {
        if (error.code === 'ENOENT') {
          // File doesn't exist - use default configuration
          this.config = DEFAULT_LOGGING_CONFIG;
        } else {
          throw error;
        }
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);

      // Log detailed error for debugging
      console.error('Logging configuration error:', {
        configPath: this.configPath,
        error: errorMsg,
        stack: error instanceof Error ? error.stack : undefined
      });

      // Show user notification with action options
      void vscode.window.showErrorMessage(
        `Failed to load logging configuration: ${errorMsg}. Using default configuration.`,
        'Open Config File',
        'Reset to Defaults'
      ).then(async (selection) => {
        if (selection === 'Open Config File') {
          // Open the config file for editing
          try {
            const doc = await vscode.workspace.openTextDocument(this.configPath);
            await vscode.window.showTextDocument(doc);
          } catch {
            // File might not exist yet, offer to create it
            const createSelection = await vscode.window.showWarningMessage(
              'Configuration file does not exist. Create default config?',
              'Create'
            );
            if (createSelection === 'Create') {
              await this.createDefaultConfigFile();
            }
          }
        } else if (selection === 'Reset to Defaults') {
          // Reset to default configuration
          try {
            await this.resetToDefaults();
            vscode.window.showInformationMessage('Logging configuration reset to defaults.');
          } catch (resetError) {
            vscode.window.showErrorMessage(`Failed to reset configuration: ${resetError}`);
          }
        }
      });

      // Emit error event for system monitoring
      VesperaEvents.criticalErrorOccurred(
        error instanceof Error ? error : new Error(errorMsg),
        'LoggingConfigurationManager',
        'Failed to load logging configuration',
        true
      );

      // Fall back to default config on error
      this.config = DEFAULT_LOGGING_CONFIG;
    }
  }

  /**
   * Reload configuration and emit change event
   */
  private async reloadConfiguration(): Promise<void> {
    const oldConfig = { ...this.config };
    await this.loadConfiguration();

    // Emit change events for modified components
    this.notifyConfigurationChanged(oldConfig);
  }

  /**
   * Save configuration to file
   */
  public async saveConfiguration(config: LoggingConfiguration): Promise<void> {
    try {
      // Validate config path before writing
      const allowedRoots = this.getAllowedConfigRoots();
      let validatedConfigPath: string;

      try {
        validatedConfigPath = validateLogPath(this.configPath, allowedRoots);
      } catch (error) {
        console.error('[SECURITY] Configuration path validation failed:', error);
        throw new PathValidationError(
          'Configuration path is invalid or outside allowed directories',
          this.configPath
        );
      }

      // Ensure directory exists
      const configDir = path.dirname(validatedConfigPath);

      // Validate directory path as well
      let validatedConfigDir: string;
      try {
        validatedConfigDir = validateLogPath(configDir, allowedRoots);
      } catch (error) {
        console.error('[SECURITY] Configuration directory path validation failed:', error);
        throw new PathValidationError(
          'Configuration directory path is invalid or outside allowed directories',
          configDir
        );
      }

      try {
        await fsPromises.access(validatedConfigDir);
      } catch {
        // Directory doesn't exist, create it
        await fsPromises.mkdir(validatedConfigDir, { recursive: true });
      }

      // Serialize and write configuration
      const content = serializeLoggingConfiguration(config);
      await fsPromises.writeFile(validatedConfigPath, content, 'utf-8');

      // Update in-memory config
      this.config = config;

      // Notify listeners
      this.notifyConfigurationChanged();
    } catch (error) {
      console.error('Failed to save logging configuration:', error);
      throw error;
    }
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): LoggingConfiguration {
    return { ...this.config };
  }

  /**
   * Get log level for a specific component
   */
  public getLogLevel(component: string): LogLevel {
    return this.config.levels.components[component] || this.config.levels.global;
  }

  /**
   * Set log level for a specific component
   */
  public async setLogLevel(component: string, level: LogLevel): Promise<void> {
    const oldLevel = this.getLogLevel(component);

    const newConfig = {
      ...this.config,
      levels: {
        ...this.config.levels,
        components: {
          ...this.config.levels.components,
          [component]: level
        }
      }
    };

    await this.saveConfiguration(newConfig);

    // Emit log level changed event
    VesperaEvents.logLevelChanged(component, oldLevel, level, 'component');
  }

  /**
   * Set global log level
   */
  public async setGlobalLogLevel(level: LogLevel): Promise<void> {
    const oldLevel = this.config.levels.global;

    const newConfig = {
      ...this.config,
      levels: {
        ...this.config.levels,
        global: level
      }
    };

    await this.saveConfiguration(newConfig);

    // Emit log level changed event
    VesperaEvents.logLevelChanged('global', oldLevel, level, 'global');
  }

  /**
   * Check if console output is enabled
   */
  public isConsoleOutputEnabled(): boolean {
    return this.config.outputs.console.enabled;
  }

  /**
   * Check if file output is enabled
   */
  public isFileOutputEnabled(): boolean {
    return this.config.outputs.file.enabled;
  }

  /**
   * Check if event bus output is enabled
   */
  public isEventBusOutputEnabled(): boolean {
    return this.config.outputs.events.enabled;
  }

  /**
   * Check if running in development mode
   */
  public isDevelopmentMode(): boolean {
    if (!this.config.development.autoEnable) {
      return false;
    }
    return this.context.extensionMode === vscode.ExtensionMode.Development;
  }

  /**
   * Check if verbose logging is enabled
   */
  public isVerboseLoggingEnabled(): boolean {
    return this.isDevelopmentMode() && this.config.development.verboseLogging;
  }

  /**
   * Check if notifications should be suppressed
   */
  public shouldSuppressNotifications(): boolean {
    return !this.isDevelopmentMode() && this.config.production.suppressNotifications;
  }

  /**
   * Notify listeners that configuration changed
   */
  private notifyConfigurationChanged(oldConfig?: LoggingConfiguration): void {
    if (oldConfig) {
      // Check for component-level changes
      for (const [component, newLevel] of Object.entries(this.config.levels.components)) {
        const oldLevel = oldConfig.levels.components[component];
        if (oldLevel !== newLevel) {
          VesperaEvents.logLevelChanged(component, oldLevel || oldConfig.levels.global, newLevel, 'component');
        }
      }

      // Check for global level change
      if (oldConfig.levels.global !== this.config.levels.global) {
        VesperaEvents.logLevelChanged(
          'global',
          oldConfig.levels.global,
          this.config.levels.global,
          'global'
        );
      }
    }
  }

  /**
   * Get configuration file path
   */
  public getConfigPath(): string {
    return this.configPath;
  }

  /**
   * Check if configuration file exists
   */
  public async configFileExists(): Promise<boolean> {
    try {
      await fsPromises.access(this.configPath);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Reset configuration to defaults
   */
  public async resetToDefaults(): Promise<void> {
    await this.saveConfiguration(DEFAULT_LOGGING_CONFIG);
  }

  /**
   * Create default configuration file
   */
  public async createDefaultConfigFile(): Promise<void> {
    try {
      const config = DEFAULT_LOGGING_CONFIG;
      await this.saveConfiguration(config);

      const selection = await vscode.window.showInformationMessage(
        `Created default logging configuration at ${this.configPath}`,
        'Open File'
      );

      if (selection === 'Open File') {
        const doc = await vscode.workspace.openTextDocument(this.configPath);
        await vscode.window.showTextDocument(doc);
      }
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      vscode.window.showErrorMessage(`Failed to create configuration file: ${errorMsg}`);
      throw error;
    }
  }

  /**
   * Sync configuration with VS Code settings
   */
  private syncWithVSCodeSettings(): void {
    const vsConfig = vscode.workspace.getConfiguration('vesperaForge.logging');

    // Update configuration from VS Code settings
    const updatedConfig = { ...this.config };

    // Global level
    const globalLevel = vsConfig.get<string>('globalLevel');
    if (globalLevel) {
      updatedConfig.levels.global = globalLevel as any;
    }

    // Component levels
    const componentLevels = vsConfig.get<Record<string, string>>('componentLevels');
    if (componentLevels) {
      updatedConfig.levels.components = {
        ...updatedConfig.levels.components,
        ...(componentLevels as any)
      };
    }

    // File logging
    const enableFileLogging = vsConfig.get<boolean>('enableFileLogging');
    if (enableFileLogging !== undefined) {
      updatedConfig.outputs.file.enabled = enableFileLogging;
    }

    // Console logging
    const enableConsoleLogging = vsConfig.get<boolean>('enableConsoleLogging');
    if (enableConsoleLogging !== undefined) {
      updatedConfig.outputs.console.enabled = enableConsoleLogging;
    }

    // Event bus logging
    const enableEventBusLogging = vsConfig.get<boolean>('enableEventBusLogging');
    if (enableEventBusLogging !== undefined) {
      updatedConfig.outputs.events.enabled = enableEventBusLogging;
    }

    // Rotation strategy
    const rotationStrategy = vsConfig.get<string>('fileRotationStrategy');
    if (rotationStrategy) {
      updatedConfig.outputs.file.rotation = rotationStrategy as LogRotationStrategy;
    }

    // Max log files
    const maxLogFiles = vsConfig.get<number>('maxLogFiles');
    if (maxLogFiles !== undefined) {
      updatedConfig.outputs.file.maxFiles = maxLogFiles;
    }

    // Security notifications
    const suppressSecurityNotifications = vsConfig.get<boolean>('suppressSecurityNotifications');
    if (suppressSecurityNotifications !== undefined) {
      updatedConfig.production.suppressNotifications = suppressSecurityNotifications;
    }

    // Verbose logging
    const verboseLogging = vsConfig.get<boolean>('verboseLogging');
    if (verboseLogging !== undefined) {
      updatedConfig.development.verboseLogging = verboseLogging;
      updatedConfig.development.showSourceLocation = verboseLogging;
    }

    // Update in-memory config
    this.config = updatedConfig;

    // Notify listeners
    this.notifyConfigurationChanged();
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    if (this.disposed) {
      return;
    }

    this.fileWatcher?.dispose();
    this.disposed = true;
  }
}
