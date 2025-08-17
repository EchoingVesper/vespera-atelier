import { MCPClient, getMCPClient, EnhancedMCPClient, getEnhancedMCPClient } from '../client/MCPClient';
import { mcpConfig, updateMCPConfig, resetMCPConfig } from '../config';
import { MCPClientConfig, MCPResult, MCPFileInfo, MCPSearchOptions } from '../types';

/**
 * MCP Manager Service
 * 
 * High-level service for interacting with the MCP server.
 * Handles initialization, connection management, and provides a clean API for MCP operations.
 */
export class MCPManager {
  private client: MCPClient;
  private enhancedClient: EnhancedMCPClient;
  private isInitialized = false;
  private connectionCheckInterval?: NodeJS.Timeout;
  private static instance: MCPManager;

  private constructor() {
    // Initialize with default config - will be updated during initialize()
    this.client = getMCPClient();
    this.enhancedClient = getEnhancedMCPClient(this.client);
    
    // Set up event listeners for circuit breaker state changes
    this.setupEventListeners();
  }

  /**
   * Get the singleton instance of MCPManager
   */
  public static getInstance(): MCPManager {
    if (!MCPManager.instance) {
      MCPManager.instance = new MCPManager();
    }
    return MCPManager.instance;
  }

  /**
   * Initialize the MCP service
   * @param config MCP configuration
   */
  public async initialize(config: Partial<MCPClientConfig> = {}): Promise<void> {
    if (this.isInitialized) {
      console.warn('MCPManager is already initialized');
      return;
    }

    try {
      // Update configuration
      updateMCPConfig(config);
      
      // Test the connection
      await this.testConnection();
      
      // Start connection monitoring
      this.startConnectionMonitoring();
      
      this.isInitialized = true;
      console.log('MCPManager initialized successfully');
    } catch (error) {
      console.error('Failed to initialize MCPManager:', error);
      throw error;
    }
  }

  /**
   * Test the connection to the MCP server
   */
  /**
   * Set up event listeners for the enhanced client
   */
  private setupEventListeners(): void {
    this.enhancedClient.on('circuitOpen', (event) => {
      console.warn(`Circuit breaker opened for operation: ${event.operation}`, event);
      // TODO: Emit an event that the UI can listen to
    });

    this.enhancedClient.on('circuitReset', () => {
      console.info('Circuit breaker has been reset');
      // TODO: Emit an event that the UI can listen to
    });
  }

  /**
   * Test the connection to the MCP server with circuit breaker awareness
   */
  public async testConnection(): Promise<boolean> {
    try {
      const result = await this.enhancedClient.ping();
      if (!result.success) {
        throw new Error(result.error || 'Failed to connect to MCP server');
      }
      return true;
    } catch (error) {
      console.error('MCP connection test failed:', error);
      throw error;
    }
  }

  /**
   * Start monitoring the MCP server connection
   */
  private startConnectionMonitoring(): void {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
    }

    // Check connection every 30 seconds
    this.connectionCheckInterval = setInterval(async () => {
      try {
        await this.testConnection();
      } catch (error) {
        console.warn('MCP server connection lost');
        // TODO: Emit connection status change event
      }
    }, 30000);
  }

  /**
   * Stop the MCP service and clean up resources
   */
  public async shutdown(): Promise<void> {
    if (this.connectionCheckInterval) {
      clearInterval(this.connectionCheckInterval);
      this.connectionCheckInterval = undefined;
    }
    
    this.isInitialized = false;
    console.log('MCPManager has been shut down');
  }

  // File Operations

  /**
   * Read a file from the vault
   */
  public async readFile(path: string): Promise<MCPResult<MCPFileInfo>> {
    this.ensureInitialized();
    return this.client.readFile(path);
  }

  /**
   * Write content to a file in the vault
   */
  public async writeFile(path: string, content: string): Promise<MCPResult<MCPFileInfo>> {
    this.ensureInitialized();
    return this.client.writeFile(path, content);
  }

  /**
   * Delete a file from the vault
   */
  public async deleteFile(path: string): Promise<MCPResult<{ path: string }>> {
    this.ensureInitialized();
    return this.client.deleteFile(path);
  }

  /**
   * Search for files in the vault
   */
  public async searchFiles(
    query: string,
    options: Omit<MCPSearchOptions, 'query'> = {}
  ): Promise<MCPResult<{ results: MCPFileInfo[]; total: number }>> {
    this.ensureInitialized();
    return this.client.searchFiles({ ...options, query });
  }

  /**
   * Execute a custom MCP command
   */
  public async executeCommand<T = any>(
    command: string,
    data: Record<string, any> = {}
  ): Promise<MCPResult<T>> {
    this.ensureInitialized();
    return this.client.executeCommand<T>(command, data);
  }

  /**
   * Get the current configuration
   */
  public getConfig(): MCPClientConfig {
    return { ...mcpConfig.getConfig() };
  }

  /**
   * Get cache statistics
   */
  public getCacheStats() {
    return this.enhancedClient.getCacheStats();
  }

  /**
   * Clear the client cache
   */
  public clearCache(): void {
    this.enhancedClient.clearCache();
  }

  /**
   * Update the configuration at runtime
   */
  public async updateConfig(updates: Partial<MCPClientConfig>): Promise<void> {
    updateMCPConfig(updates);
    
    // Reinitialize if already initialized
    if (this.isInitialized) {
      await this.initialize(updates);
    }
  }

  /**
   * Ensure the service is initialized
   */
  private ensureInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('MCPManager is not initialized. Call initialize() first.');
    }
  }

  /**
   * Check if the service is initialized
   */
  public isServiceInitialized(): boolean {
    return this.isInitialized;
  }
}

// Export a singleton instance
export const mcpManager = MCPManager.getInstance();

/**
 * Initialize the MCP service
 * @param config MCP configuration
 */
export async function initializeMCP(config: Partial<MCPClientConfig> = {}): Promise<void> {
  return mcpManager.initialize(config);
}

/**
 * Get the MCP manager instance
 */
export function getMCPService(): MCPManager {
  return mcpManager;
}

/**
 * Shutdown the MCP service
 */
export async function shutdownMCP(): Promise<void> {
  return mcpManager.shutdown();
}
