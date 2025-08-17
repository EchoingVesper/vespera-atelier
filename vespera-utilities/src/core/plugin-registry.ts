import type { VesperaPlugin } from '../interfaces/index.js';
import type { PluginInstance, DependencyNode } from './types.js';
import { PluginState } from './types.js';
import { PluginNotFoundError, CircularDependencyError } from '../utils/errors.js';

/**
 * Registry for managing loaded plugins
 */
export class PluginRegistry {
  private readonly plugins = new Map<string, PluginInstance>();
  private readonly dependencyGraph = new Map<string, DependencyNode>();

  /**
   * Register a plugin in the registry
   */
  register(plugin: VesperaPlugin): void {
    const { id, dependencies = [] } = plugin.metadata;
    
    this.plugins.set(id, {
      plugin,
      state: PluginState.LOADED,
      loadedAt: new Date()
    });

    // Update dependency graph
    this.dependencyGraph.set(id, {
      pluginId: id,
      dependencies,
      dependents: []
    });

    // Update dependents for dependencies
    dependencies.forEach(depId => {
      const depNode = this.dependencyGraph.get(depId);
      if (depNode && !depNode.dependents.includes(id)) {
        depNode.dependents.push(id);
      }
    });
  }

  /**
   * Get a plugin by ID
   */
  get(pluginId: string): VesperaPlugin | undefined {
    return this.plugins.get(pluginId)?.plugin;
  }

  /**
   * Get plugin instance with state
   */
  getInstance(pluginId: string): PluginInstance | undefined {
    return this.plugins.get(pluginId);
  }

  /**
   * Check if a plugin is registered
   */
  has(pluginId: string): boolean {
    return this.plugins.has(pluginId);
  }

  /**
   * Update plugin state
   */
  updateState(pluginId: string, state: PluginState, error?: Error): void {
    const instance = this.plugins.get(pluginId);
    if (!instance) {
      throw new PluginNotFoundError(pluginId);
    }

    instance.state = state;
    instance.error = error;

    if (state === PluginState.ACTIVE) {
      instance.activatedAt = new Date();
    } else if (state === PluginState.INACTIVE) {
      instance.deactivatedAt = new Date();
    }
  }

  /**
   * Remove a plugin from the registry
   */
  unregister(pluginId: string): void {
    const plugin = this.plugins.get(pluginId);
    if (!plugin) {
      return;
    }

    // Remove from dependents
    const node = this.dependencyGraph.get(pluginId);
    if (node) {
      node.dependencies.forEach(depId => {
        const depNode = this.dependencyGraph.get(depId);
        if (depNode) {
          depNode.dependents = depNode.dependents.filter(id => id !== pluginId);
        }
      });
    }

    this.plugins.delete(pluginId);
    this.dependencyGraph.delete(pluginId);
  }

  /**
   * Get all registered plugins
   */
  getAll(): VesperaPlugin[] {
    return Array.from(this.plugins.values()).map(instance => instance.plugin);
  }

  /**
   * Get all plugin instances
   */
  getAllInstances(): PluginInstance[] {
    return Array.from(this.plugins.values());
  }

  /**
   * Get plugins in dependency order
   */
  getInDependencyOrder(): string[] {
    const visited = new Set<string>();
    const result: string[] = [];
    const visiting = new Set<string>();

    const visit = (pluginId: string): void => {
      if (visited.has(pluginId)) {
        return;
      }

      if (visiting.has(pluginId)) {
        // Circular dependency detected
        const cycle = Array.from(visiting);
        cycle.push(pluginId);
        throw new CircularDependencyError(cycle);
      }

      visiting.add(pluginId);
      const node = this.dependencyGraph.get(pluginId);
      
      if (node) {
        node.dependencies.forEach(depId => {
          if (this.plugins.has(depId)) {
            visit(depId);
          }
        });
      }

      visiting.delete(pluginId);
      visited.add(pluginId);
      result.push(pluginId);
    };

    this.plugins.forEach((_, pluginId) => {
      if (!visited.has(pluginId)) {
        visit(pluginId);
      }
    });

    return result;
  }

  /**
   * Get plugin dependents
   */
  getDependents(pluginId: string): string[] {
    return this.dependencyGraph.get(pluginId)?.dependents || [];
  }

  /**
   * Check if all dependencies are satisfied
   */
  checkDependencies(pluginId: string): string[] {
    const node = this.dependencyGraph.get(pluginId);
    if (!node) {
      return [];
    }

    return node.dependencies.filter(depId => !this.plugins.has(depId));
  }

  /**
   * Clear the registry
   */
  clear(): void {
    this.plugins.clear();
    this.dependencyGraph.clear();
  }
}