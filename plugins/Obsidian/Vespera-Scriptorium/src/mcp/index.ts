/**
 * MCP (Model Context Protocol) Module
 * 
 * This module provides a unified interface for interacting with MCP servers,
 * handling configuration, connection management, and common operations.
 * 
 * @module MCP
 */

// Core exports
export * from './config';
export * from './client/MCPClient';
export * from './services/MCPManager';

// Re-export types
export * from './types';

// Re-export utilities
export * from './utils';

// Default export for easier imports
import { mcpManager } from './services/MCPManager';
export default mcpManager;

// Initialize with default configuration when imported
const DEFAULT_CONFIG = {
  enabled: false,
  host: 'localhost',
  port: 3000,
  secure: false,
  vaultPath: '',
  logLevel: 'info' as const,
};

// Auto-initialize with default config if not already initialized
if (typeof window !== 'undefined') {
  // Only run in browser environment
  import('./services/MCPManager').then(({ mcpManager }) => {
    if (!mcpManager.isServiceInitialized()) {
      mcpManager.initialize(DEFAULT_CONFIG).catch(console.error);
    }
  });
}

// Add to window for debugging in development
if (process.env.NODE_ENV === 'development' && typeof window !== 'undefined') {
  (window as any).VesperaMCP = mcpManager;
}
