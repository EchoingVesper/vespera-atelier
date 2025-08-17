import { EventEmitter } from 'node:events';
import { readdir, readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';
import type { 
  VesperaPlugin, 
  PluginContext, 
  Logger,
  PluginManifest,
  ToolHandler,
  ResourceHandler,
  PromptHandler
} from '../interfaces/index.js';
import type { PluginLoadResult, PluginOperationResult, PluginEventPayload } from './types.js';
import { PluginState, PluginEvent } from './types.js';
import { PluginRegistry } from './plugin-registry.js';
import { 
  PluginError, 
  PluginLoadError, 
  PluginDependencyError,
  PluginNotFoundError 
} from '../utils/errors.js';
import { createLogger } from '../utils/logger.js';
import type { z } from 'zod';

interface PluginManagerOptions {
  pluginDirectory: string;
  logger: Logger;
  autoload?: boolean;
}

interface PluginHandlers {
  tools: Map<string, { schema: z.ZodType<unknown>; handler: ToolHandler }>;
  resources: Map<string, { uriTemplate: string; handler: ResourceHandler }>;
  prompts: Map<string, { handler: PromptHandler }>;
}

/**
 * Manages plugin lifecycle and operations
 */
export class PluginManager extends EventEmitter {
  private readonly registry = new PluginRegistry();
  private readonly handlers: PluginHandlers = {
    tools: new Map(),
    resources: new Map(),
    prompts: new Map()
  };
  private readonly pluginContexts = new Map<string, PluginContext>();

  constructor(private readonly options: PluginManagerOptions) {
    super();
  }

  /**
   * Initialize the plugin manager
   */
  async initialize(): Promise<void> {
    if (this.options.autoload) {
      await this.loadAllPlugins();
    }
  }

  /**
   * Load all plugins from the plugin directory
   */
  async loadAllPlugins(): Promise<PluginLoadResult[]> {
    try {
      const entries = await readdir(this.options.pluginDirectory, { withFileTypes: true });
      const results: PluginLoadResult[] = [];

      for (const entry of entries) {
        if (entry.isDirectory()) {
          const result = await this.loadPlugin(entry.name);
          results.push(result);
        }
      }

      return results;
    } catch (error) {
      this.options.logger.error('Failed to load plugins', error as Error);
      return [];
    }
  }

  /**
   * Load a plugin by directory name
   */
  async loadPlugin(pluginName: string): Promise<PluginLoadResult> {
    const pluginPath = join(this.options.pluginDirectory, pluginName);
    
    try {
      // Read plugin manifest
      const manifestPath = join(pluginPath, 'plugin.json');
      const manifestContent = await readFile(manifestPath, 'utf-8');
      const manifest: PluginManifest = JSON.parse(manifestContent);

      // Import plugin module
      const modulePath = join(pluginPath, manifest.main);
      const moduleUrl = pathToFileURL(modulePath).href;
      const module = await import(moduleUrl);
      
      // Get plugin instance
      const PluginClass = module.default || module[manifest.name];
      if (!PluginClass) {
        throw new Error(`No default export or export named '${manifest.name}' found`);
      }

      const plugin: VesperaPlugin = new PluginClass();
      
      // Validate plugin metadata matches manifest
      if (plugin.metadata.id !== manifest.id) {
        throw new Error(`Plugin ID mismatch: ${plugin.metadata.id} !== ${manifest.id}`);
      }

      // Register plugin
      this.registry.register(plugin);
      this.emitPluginEvent(PluginEvent.LOADED, plugin.metadata.id, PluginState.LOADED);

      this.options.logger.info(`Loaded plugin: ${plugin.metadata.name} v${plugin.metadata.version}`);
      
      return { success: true, pluginId: plugin.metadata.id };
    } catch (error) {
      const err = error as Error;
      this.options.logger.error(`Failed to load plugin from ${pluginPath}`, err);
      return { success: false, error: new PluginLoadError(pluginName, err) };
    }
  }

  /**
   * Initialize a plugin
   */
  async initializePlugin(pluginId: string): Promise<PluginOperationResult> {
    try {
      const plugin = this.registry.get(pluginId);
      if (!plugin) {
        throw new PluginNotFoundError(pluginId);
      }

      // Check dependencies
      const missingDeps = this.registry.checkDependencies(pluginId);
      if (missingDeps.length > 0) {
        throw new PluginDependencyError(pluginId, missingDeps);
      }

      // Create plugin context
      const context = this.createPluginContext(pluginId);
      this.pluginContexts.set(pluginId, context);

      // Initialize plugin
      await plugin.initialize(context);
      
      this.registry.updateState(pluginId, PluginState.INITIALIZED);
      this.emitPluginEvent(PluginEvent.INITIALIZED, pluginId, PluginState.INITIALIZED);

      return { success: true };
    } catch (error) {
      const err = error as Error;
      this.registry.updateState(pluginId, PluginState.ERROR, err);
      this.emitPluginEvent(PluginEvent.ERROR, pluginId, PluginState.ERROR, err);
      return { success: false, error: err };
    }
  }

  /**
   * Activate a plugin
   */
  async activatePlugin(pluginId: string): Promise<PluginOperationResult> {
    try {
      const plugin = this.registry.get(pluginId);
      if (!plugin) {
        throw new PluginNotFoundError(pluginId);
      }

      const instance = this.registry.getInstance(pluginId);
      if (instance?.state !== PluginState.INITIALIZED && instance?.state !== PluginState.INACTIVE) {
        throw new PluginError(`Plugin '${pluginId}' must be initialized before activation`, pluginId);
      }

      await plugin.activate();
      
      this.registry.updateState(pluginId, PluginState.ACTIVE);
      this.emitPluginEvent(PluginEvent.ACTIVATED, pluginId, PluginState.ACTIVE);

      return { success: true };
    } catch (error) {
      const err = error as Error;
      this.registry.updateState(pluginId, PluginState.ERROR, err);
      this.emitPluginEvent(PluginEvent.ERROR, pluginId, PluginState.ERROR, err);
      return { success: false, error: err };
    }
  }

  /**
   * Deactivate a plugin
   */
  async deactivatePlugin(pluginId: string): Promise<PluginOperationResult> {
    try {
      const plugin = this.registry.get(pluginId);
      if (!plugin) {
        throw new PluginNotFoundError(pluginId);
      }

      // Check dependents
      const dependents = this.registry.getDependents(pluginId);
      const activeDependents = dependents.filter(depId => {
        const inst = this.registry.getInstance(depId);
        return inst?.state === PluginState.ACTIVE;
      });

      if (activeDependents.length > 0) {
        throw new PluginError(
          `Cannot deactivate '${pluginId}' while plugins depend on it: ${activeDependents.join(', ')}`,
          pluginId
        );
      }

      await plugin.deactivate();
      
      this.registry.updateState(pluginId, PluginState.INACTIVE);
      this.emitPluginEvent(PluginEvent.DEACTIVATED, pluginId, PluginState.INACTIVE);

      return { success: true };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err };
    }
  }

  /**
   * Unload a plugin
   */
  async unloadPlugin(pluginId: string): Promise<PluginOperationResult> {
    try {
      const plugin = this.registry.get(pluginId);
      if (!plugin) {
        return { success: true }; // Already unloaded
      }

      // Deactivate if active
      const instance = this.registry.getInstance(pluginId);
      if (instance?.state === PluginState.ACTIVE) {
        await this.deactivatePlugin(pluginId);
      }

      // Destroy plugin
      await plugin.destroy();

      // Clean up
      this.removePluginHandlers(pluginId);
      this.pluginContexts.delete(pluginId);
      this.registry.unregister(pluginId);
      
      this.emitPluginEvent(PluginEvent.UNLOADED, pluginId, PluginState.UNLOADED);

      return { success: true };
    } catch (error) {
      const err = error as Error;
      return { success: false, error: err };
    }
  }

  /**
   * Get all plugins
   */
  getPlugins(): VesperaPlugin[] {
    return this.registry.getAll();
  }

  /**
   * Get plugin by ID
   */
  getPlugin(pluginId: string): VesperaPlugin | undefined {
    return this.registry.get(pluginId);
  }

  /**
   * Get plugin handlers
   */
  getHandlers(): PluginHandlers {
    return this.handlers;
  }

  /**
   * Create plugin context
   */
  private createPluginContext(pluginId: string): PluginContext {
    const logger = createLogger(`plugin:${pluginId}`, {
      level: this.options.logger.debug ? 'debug' : 'info',
      format: 'pretty'
    });

    return {
      logger,
      config: {}, // TODO: Load from plugin settings
      registerTool: (name, schema, handler) => {
        const fullName = `${pluginId}:${name}`;
        this.handlers.tools.set(fullName, { schema, handler });
      },
      registerResource: (name, uriTemplate, handler) => {
        const fullName = `${pluginId}:${name}`;
        this.handlers.resources.set(fullName, { uriTemplate, handler });
      },
      registerPrompt: (name, handler) => {
        const fullName = `${pluginId}:${name}`;
        this.handlers.prompts.set(fullName, { handler });
      },
      getPlugin: (id) => this.registry.get(id)
    };
  }

  /**
   * Remove plugin handlers
   */
  private removePluginHandlers(pluginId: string): void {
    const prefix = `${pluginId}:`;
    
    // Remove tools
    for (const [name] of this.handlers.tools) {
      if (name.startsWith(prefix)) {
        this.handlers.tools.delete(name);
      }
    }

    // Remove resources  
    for (const [name] of this.handlers.resources) {
      if (name.startsWith(prefix)) {
        this.handlers.resources.delete(name);
      }
    }

    // Remove prompts
    for (const [name] of this.handlers.prompts) {
      if (name.startsWith(prefix)) {
        this.handlers.prompts.delete(name);
      }
    }
  }

  /**
   * Emit plugin event
   */
  private emitPluginEvent(
    event: PluginEvent, 
    pluginId: string, 
    state: PluginState, 
    error?: Error
  ): void {
    const payload: PluginEventPayload = {
      pluginId,
      state,
      timestamp: new Date(),
      error
    };
    this.emit(event, payload);
  }
}