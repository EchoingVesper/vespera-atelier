import type { z } from 'zod';

/**
 * Core plugin interface that all Vespera plugins must implement
 */
export interface VesperaPlugin {
  readonly metadata: PluginMetadata;
  
  /**
   * Initialize the plugin with provided context
   */
  initialize(context: PluginContext): Promise<void>;
  
  /**
   * Activate the plugin and register its capabilities
   */
  activate(): Promise<void>;
  
  /**
   * Deactivate the plugin and unregister its capabilities
   */
  deactivate(): Promise<void>;
  
  /**
   * Clean up resources before plugin removal
   */
  destroy(): Promise<void>;
}

/**
 * Plugin metadata describing the plugin
 */
export interface PluginMetadata {
  id: string;
  name: string;
  version: string;
  description: string;
  author?: string;
  homepage?: string;
  repository?: string;
  license?: string;
  dependencies?: string[];
  tags?: string[];
  capabilities: PluginCapabilities;
}

/**
 * Capabilities that a plugin can provide
 */
export interface PluginCapabilities {
  tools?: ToolDefinition[];
  resources?: ResourceDefinition[];
  prompts?: PromptDefinition[];
}

/**
 * Tool definition for MCP
 */
export interface ToolDefinition {
  name: string;
  description: string;
  inputSchema: z.ZodType<unknown>;
}

/**
 * Resource definition for MCP
 */
export interface ResourceDefinition {
  name: string;
  description: string;
  uriTemplate: string;
  mimeType?: string;
}

/**
 * Prompt definition for MCP
 */
export interface PromptDefinition {
  name: string;
  description: string;
  arguments?: PromptArgument[];
}

/**
 * Prompt argument definition
 */
export interface PromptArgument {
  name: string;
  description: string;
  required: boolean;
  default?: string;
}

/**
 * Context provided to plugins during initialization
 */
export interface PluginContext {
  logger: Logger;
  config: PluginConfig;
  registerTool: ToolRegistrar;
  registerResource: ResourceRegistrar;
  registerPrompt: PromptRegistrar;
  getPlugin: (pluginId: string) => VesperaPlugin | undefined;
}

/**
 * Logger interface for plugins
 */
export interface Logger {
  debug(message: string, ...args: unknown[]): void;
  info(message: string, ...args: unknown[]): void;
  warn(message: string, ...args: unknown[]): void;
  error(message: string, error?: Error, ...args: unknown[]): void;
}

/**
 * Plugin-specific configuration
 */
export interface PluginConfig {
  [key: string]: unknown;
}

/**
 * Function type for registering tools
 */
export type ToolRegistrar = (
  name: string,
  schema: z.ZodType<unknown>,
  handler: ToolHandler
) => void;

/**
 * Function type for registering resources
 */
export type ResourceRegistrar = (
  name: string,
  uriTemplate: string,
  handler: ResourceHandler
) => void;

/**
 * Function type for registering prompts
 */
export type PromptRegistrar = (
  name: string,
  handler: PromptHandler
) => void;

/**
 * Tool handler function type
 */
export type ToolHandler = (params: unknown) => Promise<ToolResult>;

/**
 * Resource handler function type
 */
export type ResourceHandler = (uri: string, params: Record<string, string>) => Promise<ResourceResult>;

/**
 * Prompt handler function type
 */
export type PromptHandler = (args: Record<string, string>) => PromptResult;

/**
 * Tool execution result
 */
export interface ToolResult {
  content: Array<{ type: 'text'; text: string }>;
  isError?: boolean;
}

/**
 * Resource fetch result
 */
export interface ResourceResult {
  contents: Array<{
    uri: string;
    text?: string;
    mimeType?: string;
    blob?: string;
  }>;
}

/**
 * Prompt generation result
 */
export interface PromptResult {
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: {
      type: 'text';
      text: string;
    };
  }>;
  description?: string;
}