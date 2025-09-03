/**
 * Vespera Forge - Memory-Safe Context Management
 * 
 * WeakMap-based context storage with automatic garbage collection,
 * resource registry, and memory usage monitoring.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../logging/VesperaLogger';
import { VesperaMemoryError, VesperaErrorCode } from '../error-handling/VesperaErrors';
import { VesperaErrorHandler } from '../error-handling/VesperaErrorHandler';

export interface ViewContextEntry {
  chatPanelProvider?: any; // Using any to avoid circular dependencies
  taskDashboardProvider?: any;
  statusBarManager?: any;
  taskTreeProvider?: any;
  createdAt: number;
  lastAccessedAt: number;
}

export interface DisposableResource {
  dispose(): void | Promise<void>;
}

export interface ResourceMetadata {
  type: string;
  createdAt: number;
  lastAccessedAt?: number;
  size?: number;
}

/**
 * Memory-safe context manager with WeakMap storage and resource tracking
 */
export class VesperaContextManager implements vscode.Disposable {
  private static instance: VesperaContextManager;
  
  // WeakMap automatically handles garbage collection when extension context is disposed
  private readonly viewContexts = new WeakMap<vscode.ExtensionContext, ViewContextEntry>();
  
  // Track disposables by unique ID for cleanup
  private readonly resourceRegistry = new Map<string, DisposableResource>();
  private readonly resourceMetadata = new Map<string, ResourceMetadata>();
  
  // Memory usage tracking
  private memoryCheckInterval?: NodeJS.Timeout;
  private readonly memoryThreshold = 100 * 1024 * 1024; // 100MB threshold
  private memoryStats: {
    peakUsage: number;
    lastCheck: number;
    checksPerformed: number;
  } = {
    peakUsage: 0,
    lastCheck: 0,
    checksPerformed: 0
  };
  
  private constructor(private logger: VesperaLogger) {
    this.startMemoryMonitoring();
  }

  public static initialize(logger: VesperaLogger): VesperaContextManager {
    if (!VesperaContextManager.instance) {
      VesperaContextManager.instance = new VesperaContextManager(logger);
    }
    return VesperaContextManager.instance;
  }

  public static getInstance(): VesperaContextManager {
    if (!VesperaContextManager.instance) {
      throw new Error('VesperaContextManager not initialized');
    }
    return VesperaContextManager.instance;
  }

  /**
   * Set view context data using WeakMap for automatic memory management
   */
  public setViewContext(extensionContext: vscode.ExtensionContext, viewContext: Partial<ViewContextEntry>): void {
    const existing = this.viewContexts.get(extensionContext) || {
      createdAt: Date.now(),
      lastAccessedAt: Date.now()
    };

    const updated: ViewContextEntry = {
      ...existing,
      ...viewContext,
      lastAccessedAt: Date.now()
    };

    this.viewContexts.set(extensionContext, updated);
    
    this.logger.debug('ViewContext updated', {
      hasChat: !!updated.chatPanelProvider,
      hasTaskDashboard: !!updated.taskDashboardProvider,
      hasStatusBar: !!updated.statusBarManager,
      hasTaskTree: !!updated.taskTreeProvider
    });
  }

  /**
   * Get view context data with automatic access time tracking
   */
  public getViewContext(extensionContext: vscode.ExtensionContext): ViewContextEntry | undefined {
    const context = this.viewContexts.get(extensionContext);
    if (context) {
      context.lastAccessedAt = Date.now();
    }
    return context;
  }

  /**
   * Register a disposable resource for tracking and cleanup
   */
  public registerResource<T extends DisposableResource>(
    resource: T,
    type: string,
    id?: string,
    metadata?: Partial<ResourceMetadata>
  ): string {
    const resourceId = id || this.generateResourceId(type);
    
    this.resourceRegistry.set(resourceId, resource);
    this.resourceMetadata.set(resourceId, {
      type,
      createdAt: Date.now(),
      lastAccessedAt: Date.now(),
      ...metadata
    });

    this.logger.debug(`Resource registered: ${type}:${resourceId}`, { 
      totalResources: this.resourceRegistry.size 
    });
    return resourceId;
  }

  /**
   * Update resource metadata (e.g., access time, size)
   */
  public updateResourceMetadata(resourceId: string, metadata: Partial<ResourceMetadata>): boolean {
    const existing = this.resourceMetadata.get(resourceId);
    if (!existing) {
      this.logger.warn(`Resource metadata not found for update: ${resourceId}`);
      return false;
    }

    this.resourceMetadata.set(resourceId, {
      ...existing,
      ...metadata,
      lastAccessedAt: Date.now()
    });

    return true;
  }

  /**
   * Get resource metadata
   */
  public getResourceMetadata(resourceId: string): ResourceMetadata | undefined {
    return this.resourceMetadata.get(resourceId);
  }

  /**
   * Dispose a specific resource by ID
   */
  public async disposeResource(resourceId: string): Promise<boolean> {
    const resource = this.resourceRegistry.get(resourceId);
    const metadata = this.resourceMetadata.get(resourceId);

    if (!resource || !metadata) {
      this.logger.warn(`Resource not found for disposal: ${resourceId}`);
      return false;
    }

    try {
      await resource.dispose();
      
      this.resourceRegistry.delete(resourceId);
      this.resourceMetadata.delete(resourceId);
      
      this.logger.debug(`Resource disposed: ${metadata.type}:${resourceId}`, {
        totalResources: this.resourceRegistry.size
      });
      return true;
    } catch (error) {
      const vesperaError = new VesperaMemoryError(
        `Failed to dispose resource ${metadata.type}:${resourceId}`,
        VesperaErrorCode.RESOURCE_DISPOSAL_FAILED,
        { context: { resourceId, resourceType: metadata.type } },
        error instanceof Error ? error : new Error(String(error))
      );

      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      return false;
    }
  }

  /**
   * Dispose all resources of a specific type
   */
  public async disposeResourcesByType(type: string): Promise<{ successful: number; failed: number }> {
    const resourceIds = Array.from(this.resourceMetadata.entries())
      .filter(([_, metadata]) => metadata.type === type)
      .map(([id, _]) => id);

    let successful = 0;
    let failed = 0;

    for (const resourceId of resourceIds) {
      const result = await this.disposeResource(resourceId);
      if (result) {
        successful++;
      } else {
        failed++;
      }
    }

    this.logger.debug(`Disposed resources of type ${type}`, { successful, failed });
    return { successful, failed };
  }

  /**
   * Dispose view context and all associated providers
   */
  public async disposeViewContext(extensionContext: vscode.ExtensionContext): Promise<void> {
    const viewContext = this.viewContexts.get(extensionContext);
    
    if (!viewContext) {
      this.logger.debug('No view context found for disposal');
      return;
    }

    const disposalPromises: Promise<void>[] = [];

    // Dispose each provider safely
    if (viewContext.chatPanelProvider) {
      disposalPromises.push(this.safeDispose(viewContext.chatPanelProvider, 'ChatPanelProvider'));
    }

    if (viewContext.taskDashboardProvider) {
      disposalPromises.push(this.safeDispose(viewContext.taskDashboardProvider, 'TaskDashboardProvider'));
    }

    if (viewContext.statusBarManager) {
      disposalPromises.push(this.safeDispose(viewContext.statusBarManager, 'StatusBarManager'));
    }

    if (viewContext.taskTreeProvider) {
      disposalPromises.push(this.safeDispose(viewContext.taskTreeProvider, 'TaskTreeProvider'));
    }

    // Wait for all disposals to complete
    const results = await Promise.allSettled(disposalPromises);
    const failed = results.filter(result => result.status === 'rejected').length;
    
    if (failed > 0) {
      this.logger.warn(`${failed} view context providers failed to dispose properly`);
    }

    // Remove from WeakMap (though it would be garbage collected anyway)
    this.viewContexts.delete(extensionContext);
    
    this.logger.info('View context disposed successfully', { 
      providersDisposed: disposalPromises.length,
      failed 
    });
  }

  private async safeDispose(resource: DisposableResource, resourceType: string): Promise<void> {
    try {
      await resource.dispose();
      this.logger.debug(`${resourceType} disposed successfully`);
    } catch (error) {
      const vesperaError = new VesperaMemoryError(
        `Failed to dispose ${resourceType}`,
        VesperaErrorCode.RESOURCE_DISPOSAL_FAILED,
        { context: { resourceType } },
        error instanceof Error ? error : new Error(String(error))
      );

      await VesperaErrorHandler.getInstance().handleError(vesperaError);
    }
  }

  private startMemoryMonitoring(): void {
    this.memoryCheckInterval = setInterval(() => {
      this.checkMemoryUsage();
    }, 30000); // Check every 30 seconds
  }

  private checkMemoryUsage(): void {
    const memUsage = process.memoryUsage();
    this.memoryStats.lastCheck = Date.now();
    this.memoryStats.checksPerformed++;
    
    if (memUsage.heapUsed > this.memoryStats.peakUsage) {
      this.memoryStats.peakUsage = memUsage.heapUsed;
    }
    
    if (memUsage.heapUsed > this.memoryThreshold) {
      this.logger.warn('High memory usage detected', {
        heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024),
        heapTotal: Math.round(memUsage.heapTotal / 1024 / 1024),
        external: Math.round(memUsage.external / 1024 / 1024),
        rss: Math.round(memUsage.rss / 1024 / 1024),
        registeredResources: this.resourceRegistry.size,
        threshold: Math.round(this.memoryThreshold / 1024 / 1024)
      });

      // Create memory leak detection error
      const memoryError = new VesperaMemoryError(
        `High memory usage detected: ${Math.round(memUsage.heapUsed / 1024 / 1024)}MB`,
        VesperaErrorCode.MEMORY_LEAK_DETECTED,
        { 
          context: { 
            heapUsed: memUsage.heapUsed,
            registeredResources: this.resourceRegistry.size,
            threshold: this.memoryThreshold
          } 
        }
      );

      VesperaErrorHandler.getInstance().handleError(memoryError);

      // Suggest garbage collection
      if (global.gc) {
        global.gc();
        this.logger.debug('Garbage collection triggered');
      }
    }

    this.logger.debug('Memory usage check', {
      heapUsed: Math.round(memUsage.heapUsed / 1024 / 1024) + 'MB',
      registeredResources: this.resourceRegistry.size,
      checkNumber: this.memoryStats.checksPerformed
    });
  }

  private generateResourceId(type: string): string {
    return `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Get comprehensive memory and resource statistics
   */
  public getMemoryStats(): {
    viewContexts: string; // WeakMap size is not accessible
    registeredResources: number;
    memoryUsage: NodeJS.MemoryUsage;
    resourceTypes: Record<string, number>;
    memoryMonitoring: {
      peakUsage: number;
      checksPerformed: number;
      lastCheck: number;
      thresholdMB: number;
    };
  } {
    const resourceTypes: Record<string, number> = {};
    
    for (const metadata of this.resourceMetadata.values()) {
      resourceTypes[metadata.type] = (resourceTypes[metadata.type] || 0) + 1;
    }

    return {
      viewContexts: 'WeakMap size not accessible',
      registeredResources: this.resourceRegistry.size,
      memoryUsage: process.memoryUsage(),
      resourceTypes,
      memoryMonitoring: {
        peakUsage: this.memoryStats.peakUsage,
        checksPerformed: this.memoryStats.checksPerformed,
        lastCheck: this.memoryStats.lastCheck,
        thresholdMB: Math.round(this.memoryThreshold / 1024 / 1024)
      }
    };
  }

  /**
   * Get list of all registered resources
   */
  public getRegisteredResources(): Array<{ id: string; metadata: ResourceMetadata }> {
    return Array.from(this.resourceMetadata.entries()).map(([id, metadata]) => ({
      id,
      metadata
    }));
  }

  /**
   * Clean up stale resources (optional maintenance operation)
   */
  public async cleanupStaleResources(maxAgeMs: number = 3600000): Promise<{ cleaned: number; errors: number }> {
    const now = Date.now();
    const staleResourceIds: string[] = [];

    for (const [id, metadata] of this.resourceMetadata.entries()) {
      const lastAccess = metadata.lastAccessedAt || metadata.createdAt;
      if (now - lastAccess > maxAgeMs) {
        staleResourceIds.push(id);
      }
    }

    let cleaned = 0;
    let errors = 0;

    for (const resourceId of staleResourceIds) {
      const success = await this.disposeResource(resourceId);
      if (success) {
        cleaned++;
      } else {
        errors++;
      }
    }

    if (cleaned > 0 || errors > 0) {
      this.logger.info('Stale resource cleanup completed', { cleaned, errors, maxAgeMs });
    }

    return { cleaned, errors };
  }

  public dispose(): void {
    if (this.memoryCheckInterval) {
      clearInterval(this.memoryCheckInterval);
      this.memoryCheckInterval = undefined;
    }

    // Dispose all registered resources
    const disposalPromises = Array.from(this.resourceRegistry.entries()).map(
      async ([id, resource]) => {
        try {
          await resource.dispose();
        } catch (error) {
          this.logger.error(`Failed to dispose resource ${id}`, error);
        }
      }
    );

    Promise.allSettled(disposalPromises).then((results) => {
      const failed = results.filter(r => r.status === 'rejected').length;
      this.logger.info('All resources disposed during context manager cleanup', {
        total: disposalPromises.length,
        failed
      });
    });

    this.resourceRegistry.clear();
    this.resourceMetadata.clear();
  }
}