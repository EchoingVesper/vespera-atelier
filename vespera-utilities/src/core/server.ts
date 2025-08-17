import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { ResourceTemplate } from '@modelcontextprotocol/sdk/server/mcp.js';
import type { Logger, ServerConfig } from '../interfaces/index.js';
import { PluginManager } from './plugin-manager.js';
import { PluginEvent } from './types.js';
import { createLogger } from '../utils/logger.js';

interface VesperaServerOptions {
  config: ServerConfig;
  pluginDirectory: string;
}

/**
 * Main Vespera server class that integrates MCP with the plugin system
 */
export class VesperaServer {
  private readonly mcpServer: McpServer;
  private readonly pluginManager: PluginManager;
  private readonly logger: Logger;
  private transport?: StdioServerTransport;

  constructor(private readonly options: VesperaServerOptions) {
    const { config } = options;
    
    this.logger = createLogger('server', {
      level: config.logging.level,
      format: config.logging.format
    });

    // Initialize MCP server
    this.mcpServer = new McpServer({
      name: config.server.name,
      version: config.server.version
    });

    // Initialize plugin manager
    this.pluginManager = new PluginManager({
      pluginDirectory: options.pluginDirectory,
      logger: this.logger,
      autoload: config.plugins.autoload
    });

    this.setupPluginEvents();
  }

  /**
   * Start the server
   */
  async start(): Promise<void> {
    try {
      this.logger.info('Starting Vespera Utilities server...');

      // Initialize plugin manager
      await this.pluginManager.initialize();

      // Initialize and activate enabled plugins
      await this.initializeEnabledPlugins();

      // Register plugin handlers with MCP server
      this.registerPluginHandlers();

      // Start transport
      await this.startTransport();

      this.logger.info('Vespera Utilities server started successfully');
    } catch (error) {
      this.logger.error('Failed to start server', error as Error);
      throw error;
    }
  }

  /**
   * Stop the server
   */
  async stop(): Promise<void> {
    try {
      this.logger.info('Stopping server...');

      // Stop transport
      if (this.transport) {
        await this.transport.close();
      }

      // Unload all plugins
      const plugins = this.pluginManager.getPlugins();
      for (const plugin of plugins) {
        await this.pluginManager.unloadPlugin(plugin.metadata.id);
      }

      this.logger.info('Server stopped');
    } catch (error) {
      this.logger.error('Error stopping server', error as Error);
      throw error;
    }
  }

  /**
   * Initialize enabled plugins
   */
  private async initializeEnabledPlugins(): Promise<void> {
    const enabledPlugins = this.options.config.plugins.enabled;
    
    for (const pluginId of enabledPlugins) {
      try {
        const plugin = this.pluginManager.getPlugin(pluginId);
        if (!plugin) {
          this.logger.warn(`Enabled plugin '${pluginId}' not found`);
          continue;
        }

        // Initialize plugin
        const initResult = await this.pluginManager.initializePlugin(pluginId);
        if (!initResult.success) {
          this.logger.error(`Failed to initialize plugin '${pluginId}'`, initResult.error);
          continue;
        }

        // Activate plugin
        const activateResult = await this.pluginManager.activatePlugin(pluginId);
        if (!activateResult.success) {
          this.logger.error(`Failed to activate plugin '${pluginId}'`, activateResult.error);
        }
      } catch (error) {
        this.logger.error(`Error with plugin '${pluginId}'`, error as Error);
      }
    }
  }

  /**
   * Register plugin handlers with MCP server
   */
  private registerPluginHandlers(): void {
    const handlers = this.pluginManager.getHandlers();

    // Register tools
    for (const [name, { schema, handler }] of handlers.tools) {
      this.mcpServer.tool(name, schema, async (params) => {
        try {
          return await handler(params);
        } catch (error) {
          this.logger.error(`Tool '${name}' error`, error as Error);
          return {
            content: [{ type: 'text', text: `Error: ${(error as Error).message}` }],
            isError: true
          };
        }
      });
    }

    // Register resources
    for (const [name, { uriTemplate, handler }] of handlers.resources) {
      this.mcpServer.resource(
        name,
        new ResourceTemplate(uriTemplate, { list: undefined }),
        async (uri, params) => {
          try {
            return await handler(uri.href, params);
          } catch (error) {
            this.logger.error(`Resource '${name}' error`, error as Error);
            return {
              contents: [{
                uri: uri.href,
                text: `Error: ${(error as Error).message}`
              }]
            };
          }
        }
      );
    }

    // Register prompts
    for (const [name, { handler }] of handlers.prompts) {
      this.mcpServer.prompt(name, {}, (args) => {
        try {
          return handler(args);
        } catch (error) {
          this.logger.error(`Prompt '${name}' error`, error as Error);
          return {
            messages: [{
              role: 'user',
              content: {
                type: 'text',
                text: `Error: ${(error as Error).message}`
              }
            }]
          };
        }
      });
    }
  }

  /**
   * Start the appropriate transport
   */
  private async startTransport(): Promise<void> {
    if (this.options.config.server.transport === 'stdio') {
      this.transport = new StdioServerTransport();
      await this.mcpServer.connect(this.transport);
      this.logger.info('Started with stdio transport');
    } else {
      throw new Error(`Transport '${this.options.config.server.transport}' not yet implemented`);
    }
  }

  /**
   * Setup plugin event handlers
   */
  private setupPluginEvents(): void {
    this.pluginManager.on(PluginEvent.LOADED, (payload) => {
      this.logger.info(`Plugin loaded: ${payload.pluginId}`);
    });

    this.pluginManager.on(PluginEvent.ACTIVATED, (payload) => {
      this.logger.info(`Plugin activated: ${payload.pluginId}`);
      // Re-register handlers when plugins are activated
      this.registerPluginHandlers();
    });

    this.pluginManager.on(PluginEvent.DEACTIVATED, (payload) => {
      this.logger.info(`Plugin deactivated: ${payload.pluginId}`);
    });

    this.pluginManager.on(PluginEvent.ERROR, (payload) => {
      this.logger.error(`Plugin error: ${payload.pluginId}`, payload.error);
    });
  }
}