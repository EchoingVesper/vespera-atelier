/**
 * MCP Client Implementation (Enhanced)
 * 
 * This is the enhanced version of MCPClient with additional features:
 * - Circuit breaker pattern for fault tolerance
 * - Request batching for improved performance
 * - Response caching to reduce network traffic
 * - Request deduplication for identical concurrent requests
 * - Connection pooling and retry logic
 * 
 * This file serves as a backward-compatible wrapper around the EnhancedMCPClient.
 */

import { EnhancedMCPClient, getEnhancedMCPClient as getEnhancedClient } from './EnhancedMCPClient';
import { MCPClientConfig, MCPResult, MCPRequestOptions, MCPFileInfo, MCPSearchOptions } from '../types';

export * from '../types';

/**
 * MCP Client for interacting with the MCP server
 * 
 * This is now a thin wrapper around EnhancedMCPClient for backward compatibility.
 * New code should use EnhancedMCPClient directly for access to advanced features.
 */
export class MCPClient {
  private enhancedClient: EnhancedMCPClient;

  /**
   * Create a new MCP client
   * @param config Optional configuration (uses global config if not provided)
   */
  constructor(config?: MCPClientConfig) {
    // Create a base client with just the minimal required functionality
    const baseClient = {
      ping: async () => ({} as MCPResult<{ version: string }>),
      getServerInfo: async () => ({} as MCPResult<{ name: string; version: string; capabilities: string[] }>),
      readFile: async (_path: string, _options?: MCPRequestOptions) => ({} as MCPResult<MCPFileInfo>),
      writeFile: async (_path: string, _content: string, _options?: MCPRequestOptions) => ({} as MCPResult<MCPFileInfo>),
      deleteFile: async (_path: string, _options?: MCPRequestOptions) => ({} as MCPResult<{ path: string }>),
      searchFiles: async (_options: MCPSearchOptions) => ({} as MCPResult<{ results: MCPFileInfo[]; total: number }>),
      executeCommand: async <T = any>(_command: string, _data?: Record<string, any>) => ({} as MCPResult<T>),
    };

    // Initialize the enhanced client
    this.enhancedClient = getEnhancedClient(baseClient as any);
    
    // Apply configuration if provided
    if (config) {
      this.enhancedClient.updateConfig(config);
    }
  }

  /**
   * Check if the MCP server is reachable
   */
  public async ping(): Promise<MCPResult<{ version: string }>> {
    return this.enhancedClient.ping();
  }

  /**
   * Get server information
   */
  public async getServerInfo(): Promise<MCPResult<{
    name: string;
    version: string;
    capabilities: string[];
  }>> {
    return this.enhancedClient.getServerInfo();
  }

  /**
   * Read a file from the vault
   */
  public async readFile(
    path: string,
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<MCPFileInfo>> {
    return this.enhancedClient.readFile(path, options);
  }

  /**
   * Write content to a file in the vault
   */
  public async writeFile(
    path: string,
    content: string,
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<MCPFileInfo>> {
    return this.enhancedClient.writeFile(path, content, options);
  }

  /**
   * Delete a file from the vault
   */
  public async deleteFile(
    path: string,
    options: MCPRequestOptions = {}
  ): Promise<MCPResult<{ path: string }>> {
    return this.enhancedClient.deleteFile(path, options);
  }

  /**
   * Search for files in the vault
   */
  public async searchFiles(
    options: MCPSearchOptions
  ): Promise<MCPResult<{ results: MCPFileInfo[]; total: number }>> {
    return this.enhancedClient.searchFiles(options);
  }

  /**
   * Execute a custom MCP command
   */
  public async executeCommand<T = any>(
    command: string,
    data: Record<string, any> = {}
  ): Promise<MCPResult<T>> {
    return this.enhancedClient.executeCommand<T>(command, data);
  }
}

// Singleton instance
let mcpClientInstance: MCPClient | null = null;

/**
 * Get or create the MCP client instance
 * @param config Optional configuration (only used on first call)
 */
export function getMCPClient(config?: MCPClientConfig): MCPClient {
  if (!mcpClientInstance) {
    mcpClientInstance = new MCPClient(config);
  } else if (config) {
    console.warn('Configuration was provided but MCPClient was already initialized. Call resetMCPClient() first to apply new configuration.');
  }
  return mcpClientInstance;
}

/**
 * Reset the MCP client instance (for testing)
 */
export function resetMCPClient(): void {
  mcpClientInstance = null;
}

// Re-export enhanced client types and functions
export { EnhancedMCPClient, getEnhancedMCPClient } from './EnhancedMCPClient';
