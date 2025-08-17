import type { VesperaPlugin } from '../interfaces/index.js';

/**
 * Plugin state in the system
 */
export enum PluginState {
  UNLOADED = 'unloaded',
  LOADED = 'loaded',
  INITIALIZED = 'initialized',
  ACTIVE = 'active',
  INACTIVE = 'inactive',
  ERROR = 'error'
}

/**
 * Plugin instance with state tracking
 */
export interface PluginInstance {
  plugin: VesperaPlugin;
  state: PluginState;
  error?: Error;
  loadedAt: Date;
  activatedAt?: Date;
  deactivatedAt?: Date;
}

/**
 * Plugin load result
 */
export interface PluginLoadResult {
  success: boolean;
  pluginId?: string;
  error?: Error;
}

/**
 * Plugin operation result
 */
export interface PluginOperationResult {
  success: boolean;
  message?: string;
  error?: Error;
}

/**
 * Plugin dependency graph node
 */
export interface DependencyNode {
  pluginId: string;
  dependencies: string[];
  dependents: string[];
}

/**
 * Events emitted by the plugin system
 */
export enum PluginEvent {
  LOADED = 'plugin:loaded',
  INITIALIZED = 'plugin:initialized',
  ACTIVATED = 'plugin:activated',
  DEACTIVATED = 'plugin:deactivated',
  ERROR = 'plugin:error',
  UNLOADED = 'plugin:unloaded'
}

/**
 * Plugin event payload
 */
export interface PluginEventPayload {
  pluginId: string;
  state: PluginState;
  timestamp: Date;
  error?: Error;
}