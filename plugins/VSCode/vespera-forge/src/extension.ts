/**
 * Vespera Forge - AI-enhanced content management and task orchestration for VS Code
 * with collaborative CRDT editing and enhanced memory management
 */

console.log('[Vespera] 🔥 EXTENSION FILE LOADED - extension.ts is being executed');

import * as vscode from 'vscode';
import { VesperaForgeContext } from '@/types';
import { registerCommands } from '@/commands';
import { initializeProviders } from '@/providers';
import { initializeViews } from '@/views';
import { getConfig, isDevelopment } from '@/utils';
import { 
  VesperaCoreServices, 
  VesperaCoreServicesConfig,
  VesperaContextManager
} from '@/core';
import { SecurityIntegrationManager } from './security-integration';

// Core services instance - managed by VesperaCoreServices singleton
let coreServices: Awaited<ReturnType<typeof VesperaCoreServices.initialize>> | undefined;
let securityIntegration: SecurityIntegrationManager | undefined;

/**
 * Extension activation function with enhanced memory management
 * Called when extension is first activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[Vespera] 🚀 VESPERA FORGE: Extension activated with enhanced memory management!');
  
  try {
    // Initialize core services first (includes memory management, logging, error handling)
    const coreConfig: VesperaCoreServicesConfig = {
      logging: {
        level: isDevelopment() ? 1 : 2, // DEBUG in dev, INFO in prod
        enableConsole: true,
        enableVSCodeOutput: true,
        enableStructuredLogging: true
      },
      memoryMonitoring: {
        enabled: true,
        thresholdMB: 150, // Alert at 150MB
        checkIntervalMs: 30000 // Check every 30 seconds
      },
      telemetry: {
        enabled: true
      }
    };

    coreServices = await VesperaCoreServices.initialize(context, coreConfig);
    const { logger, contextManager, disposalManager, errorHandler } = coreServices;

    // Initialize enterprise-grade security integration
    logger.info('Initializing security integration...');
    try {
      securityIntegration = await SecurityIntegrationManager.initializeFromConfig(context);
      const securityStatus = securityIntegration.getStatus();
      
      if (securityStatus.healthStatus.overall === 'healthy') {
        logger.info(`Security integration initialized successfully in ${securityStatus.performanceMetrics.initializationTime.toFixed(2)}ms`);
        logger.info(`Security overhead: ${securityStatus.performanceMetrics.totalSecurityOverhead.toFixed(2)}%`);
      } else {
        logger.warn(`Security integration initialized with ${securityStatus.healthStatus.overall} status`);
        logger.warn(`Failed components: ${securityStatus.performanceMetrics.failedComponents.join(', ')}`);
      }
      
      // Register security integration for disposal
      disposalManager.add(securityIntegration);
    } catch (error) {
      logger.error('Security integration initialization failed - continuing with reduced security', error);
    }

    logger.info('Vespera Forge activation started', {
      vsCodeVersion: vscode.version,
      environment: isDevelopment() ? 'development' : 'production'
    });

    // Initialize providers
    const { contentProvider } = initializeProviders(context);
    
    // Initialize views (task tree, dashboard, status bar)
    const viewContext = initializeViews(context);
    
    // Register view context with memory-safe context manager
    contextManager.setViewContext(context, viewContext);
    
    // Register view providers as disposable resources
    if (viewContext.chatPanelProvider) {
      contextManager.registerResource(
        viewContext.chatPanelProvider,
        'ChatPanelProvider',
        'main-chat-panel'
      );
    }
    
    if (viewContext.taskDashboardProvider) {
      contextManager.registerResource(
        viewContext.taskDashboardProvider,
        'TaskDashboardProvider',
        'main-task-dashboard'
      );
    }
    
    if (viewContext.statusBarManager) {
      contextManager.registerResource(
        viewContext.statusBarManager,
        'StatusBarManager',
        'main-status-bar'
      );
    }
    
    if (viewContext.taskTreeProvider) {
      contextManager.registerResource(
        viewContext.taskTreeProvider,
        'TaskTreeProvider',
        'main-task-tree'
      );
    }

    // Create enhanced Vespera Forge context with core services
    const vesperaContext: VesperaForgeContext = {
      extensionContext: context,
      contentProvider,
      config: getConfig(),
      isInitialized: false,
      coreServices
    };

    // Register content provider as disposable resource (if it has dispose method)
    if ('dispose' in contentProvider && typeof contentProvider.dispose === 'function') {
      contextManager.registerResource(
        contentProvider as any, // Type assertion since ContentProvider doesn't extend DisposableResource
        'ContentProvider',
        'main-content-provider'
      );
    }

    // Register all commands
    registerCommands(context, vesperaContext);
    
    // Enable Vespera Forge context for views
    await vscode.commands.executeCommand('setContext', 'vespera-forge:enabled', true);
    
    logger.debug('Extension configuration', { 
      enableAutoStart: vesperaContext.config.enableAutoStart,
      rustBinderyPath: vesperaContext.config.rustBinderyPath
    });
    
    // Set up disposal hooks for comprehensive cleanup
    disposalManager.addHook({
      beforeDispose: async () => {
        logger.info('Starting comprehensive extension cleanup');
        
        // Clear VS Code context flags
        await vscode.commands.executeCommand('setContext', 'vespera-forge:enabled', false);
        
        // Dispose view context and all providers
        await contextManager.disposeViewContext(context);
      },
      afterDispose: async () => {
        // Perform final cleanup tasks
        logger.info('Extension cleanup completed');
        
        // Suggest garbage collection
        if (global.gc) {
          global.gc();
          logger.debug('Garbage collection triggered');
        }
      },
      onDisposeError: async (error: Error) => {
        logger.error('Error during disposal process', error);
        await errorHandler.handleError(error);
      }
    });

    // Auto-initialize if enabled in config (use immediate promise to avoid blocking)
    if (vesperaContext.config.enableAutoStart) {
      logger.info('Auto-initialization enabled, starting...');
      // Initialize immediately after activation completes
      setImmediate(async () => {
        try {
          logger.debug('Executing vespera-forge.initialize command');
          await vscode.commands.executeCommand('vespera-forge.initialize');
          logger.info('Auto-initialization completed successfully');
        } catch (error) {
          const errorToHandle = error instanceof Error ? error : new Error(String(error));
          logger.error('Auto-initialization failed', errorToHandle);
          await errorHandler.handleError(errorToHandle);
        }
      });
    } else {
      logger.info('Auto-initialization disabled in configuration');
    }
    
    // Mark context as initialized
    vesperaContext.isInitialized = true;
    
    logger.info('Vespera Forge extension activation completed successfully', {
      registeredResources: contextManager.getMemoryStats().registeredResources,
      memoryUsage: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + 'MB'
    });

  } catch (error) {
    console.error('[Vespera] ❌ Extension activation failed:', error);
    
    // Try to report error if core services are available
    if (coreServices?.errorHandler) {
      const errorToHandle = error instanceof Error ? error : new Error(String(error));
      await coreServices.errorHandler.handleError(errorToHandle);
    }
    
    // Clean up any partially initialized resources
    if (coreServices) {
      await coreServices.disposalManager.dispose();
      coreServices = undefined;
    }
    
    throw error;
  }
}

/**
 * Extension deactivation function with enhanced memory management
 * Called when extension is deactivated
 */
export async function deactivate(): Promise<void> {
  if (!coreServices) {
    console.log('[Vespera] Extension already deactivated or never fully activated');
    return;
  }

  const { logger, contextManager, disposalManager, errorHandler } = coreServices;
  
  try {
    logger.info('Starting Vespera Forge extension deactivation with enhanced cleanup');
    
    const startTime = Date.now();
    const initialMemory = process.memoryUsage();
    
    // Get memory stats before cleanup
    const memoryStatsBefore = contextManager.getMemoryStats();
    logger.debug('Memory state before cleanup', {
      registeredResources: memoryStatsBefore.registeredResources,
      memoryUsage: Math.round(memoryStatsBefore.memoryUsage.heapUsed / 1024 / 1024) + 'MB'
    });
    
    // Disconnect from Bindery service before main disposal
    try {
      const { disposeBinderyService } = await import('./services/bindery');
      await disposeBinderyService();
      logger.info('Bindery service disposed successfully');
    } catch (binderyError) {
      const errorToHandle = binderyError instanceof Error ? binderyError : new Error(String(binderyError));
      logger.error('Error disposing Bindery service', errorToHandle);
      await errorHandler.handleError(errorToHandle);
    }
    
    // Perform comprehensive cleanup via disposal manager
    // This will trigger all the disposal hooks we registered during activation
    const disposalResult = await disposalManager.dispose();
    
    logger.info('Primary disposal process completed', {
      successful: disposalResult.successful,
      failed: disposalResult.failed,
      totalTime: disposalResult.totalTime,
      errors: disposalResult.errors.length
    });
    
    // If there were disposal failures, log them
    if (disposalResult.errors.length > 0) {
      logger.warn('Some resources failed to dispose properly', {
        errorCount: disposalResult.errors.length,
        errors: disposalResult.errors.map(e => e.message)
      });
      
      // Report each disposal error
      for (const error of disposalResult.errors) {
        await errorHandler.handleError(error);
      }
    }
    
    // Cleanup any stale resources that might have been missed
    const staleCleanup = await contextManager.cleanupStaleResources(5 * 60 * 1000); // 5 minutes
    if (staleCleanup.cleaned > 0 || staleCleanup.errors > 0) {
      logger.info('Stale resource cleanup completed', staleCleanup);
    }
    
    // Final memory check and garbage collection
    const finalMemory = process.memoryUsage();
    const memoryFreed = Math.round((initialMemory.heapUsed - finalMemory.heapUsed) / 1024 / 1024);
    
    logger.info('Memory cleanup summary', {
      memoryFreedMB: memoryFreed,
      finalHeapUsedMB: Math.round(finalMemory.heapUsed / 1024 / 1024),
      totalDeactivationTime: Date.now() - startTime,
      resourcesDisposed: disposalResult.successful
    });
    
    // Note: Core services are disposed via context subscriptions
    
    // Clear the core services reference
    coreServices = undefined;
    
    console.log('[Vespera] ✅ Vespera Forge extension deactivated successfully with comprehensive cleanup');
    
  } catch (error) {
    console.error('[Vespera] ❌ Critical error during extension deactivation:', error);
    
    // Try to report the error if error handler is still available
    if (coreServices?.errorHandler) {
      try {
        const errorToHandle = error instanceof Error ? error : new Error(String(error));
        await coreServices.errorHandler.handleError(errorToHandle);
      } catch (reportError) {
        console.error('[Vespera] Failed to report deactivation error:', reportError);
      }
    }
    
    // Emergency cleanup - force dispose core services even if there's an error
    try {
      if (coreServices) {
        // Core services disposed via context subscriptions
      }
    } catch (emergencyError) {
      console.error('[Vespera] Emergency cleanup failed:', emergencyError);
    } finally {
      coreServices = undefined;
    }
    
    // Force garbage collection as last resort
    if (global.gc) {
      global.gc();
      console.log('[Vespera] Emergency garbage collection triggered');
    }
  }
}

// =============================================================================
// MEMORY MANAGEMENT UTILITIES
// =============================================================================

/**
 * Get the current view context safely using memory-managed storage
 * Replaces the old global context pattern
 */
export function getViewContext(extensionContext: vscode.ExtensionContext): import('@/core/memory-management/VesperaContextManager').ViewContextEntry | undefined {
  if (!coreServices?.contextManager) {
    console.warn('[Vespera] Context manager not available');
    return undefined;
  }
  
  return coreServices.contextManager.getViewContext(extensionContext);
}

/**
 * Check if core services are available and properly initialized
 */
export function isCoreServicesAvailable(): boolean {
  return coreServices !== undefined && VesperaCoreServices.isInitialized();
}

/**
 * Get memory statistics for the extension
 */
export function getMemoryStats(): ReturnType<VesperaContextManager['getMemoryStats']> | undefined {
  if (!coreServices?.contextManager) {
    return undefined;
  }
  
  return coreServices.contextManager.getMemoryStats();
}

/**
 * Perform a health check on all core services
 */
export async function performHealthCheck(): Promise<any> {
  if (!coreServices) {
    return {
      healthy: false,
      error: 'Core services not initialized',
      services: {},
      stats: {}
    };
  }
  
  try {
    // Use the health check method from the VesperaCoreServices singleton
    if (VesperaCoreServices.isInitialized()) {
      // Get the actual VesperaCoreServices instance to call healthCheck
      const instance = VesperaCoreServices as any;
      if (instance.instance && typeof instance.instance.healthCheck === 'function') {
        return await instance.instance.healthCheck();
      }
    }
    
    // Fallback to basic service verification if healthCheck method is not available
    const { logger, errorHandler, contextManager, telemetryService, disposalManager } = coreServices;
    return {
      healthy: true,
      services: {
        logger: { healthy: !!logger },
        errorHandler: { healthy: !!errorHandler },
        contextManager: { healthy: !!contextManager },
        telemetryService: { healthy: !!telemetryService },
        disposalManager: { healthy: !!disposalManager }
      },
      stats: {
        logger: logger?.getLogStats?.() || {},
        memory: contextManager?.getMemoryStats?.() || {},
        disposal: disposalManager?.getStats?.() || {}
      }
    };
  } catch (error) {
    return {
      healthy: false,
      error: String(error),
      services: {},
      stats: {}
    };
  }
}

/**
 * Force garbage collection and cleanup of stale resources
 * Useful for debugging memory issues or manual cleanup
 */
export async function forceMemoryCleanup(): Promise<{
  garbageCollectionTriggered: boolean;
  staleResourcesCleanup?: { cleaned: number; errors: number; } | undefined;
  memoryBefore: NodeJS.MemoryUsage;
  memoryAfter: NodeJS.MemoryUsage;
}> {
  const memoryBefore = process.memoryUsage();
  let staleResourcesCleanup: Awaited<ReturnType<VesperaContextManager['cleanupStaleResources']>> | undefined;
  
  // Clean up stale resources if context manager is available
  if (coreServices?.contextManager) {
    staleResourcesCleanup = await coreServices.contextManager.cleanupStaleResources();
  }
  
  // Force garbage collection if available
  let garbageCollectionTriggered = false;
  if (global.gc) {
    global.gc();
    garbageCollectionTriggered = true;
  }
  
  const memoryAfter = process.memoryUsage();
  
  if (coreServices?.logger) {
    coreServices.logger.info('Manual memory cleanup performed', {
      garbageCollectionTriggered,
      staleResourcesCleanup,
      memoryFreedMB: Math.round((memoryBefore.heapUsed - memoryAfter.heapUsed) / 1024 / 1024)
    });
  }
  
  return {
    garbageCollectionTriggered,
    staleResourcesCleanup: staleResourcesCleanup || undefined,
    memoryBefore,
    memoryAfter
  };
}

/**
 * Advanced memory diagnostics command (for testing/debugging)
 * This command can be called from VS Code command palette
 */
export async function runMemoryDiagnostics(): Promise<void> {
  if (!coreServices?.logger) {
    vscode.window.showWarningMessage('Core services not available for memory diagnostics');
    return;
  }

  const { logger, contextManager } = coreServices;
  
  try {
    logger.info('Running memory diagnostics...');
    
    // Get current memory stats
    const memStats = contextManager.getMemoryStats();
    
    // Perform health check
    const healthCheck = await performHealthCheck();
    
    // Format diagnostic information
    const diagnosticInfo = {
      memoryStats: {
        heapUsedMB: Math.round(memStats.memoryUsage.heapUsed / 1024 / 1024),
        heapTotalMB: Math.round(memStats.memoryUsage.heapTotal / 1024 / 1024),
        externalMB: Math.round(memStats.memoryUsage.external / 1024 / 1024),
        rssMB: Math.round(memStats.memoryUsage.rss / 1024 / 1024),
        registeredResources: memStats.registeredResources,
        peakUsageMB: Math.round((memStats.memoryMonitoring.peakUsage || 0) / 1024 / 1024),
        checksPerformed: memStats.memoryMonitoring.checksPerformed
      },
      resourceBreakdown: memStats.resourceTypes,
      healthStatus: healthCheck.healthy,
      serviceStatus: Object.entries(healthCheck.services).map(([name, status]) => ({
        name,
        healthy: (status as any).healthy,
        error: (status as any).error
      }))
    };
    
    // Show results in VS Code output channel and information message
    const summary = `Memory Diagnostics:
• Heap Used: ${diagnosticInfo.memoryStats.heapUsedMB}MB / ${diagnosticInfo.memoryStats.heapTotalMB}MB
• Peak Usage: ${diagnosticInfo.memoryStats.peakUsageMB}MB
• Registered Resources: ${diagnosticInfo.memoryStats.registeredResources}
• System Health: ${healthCheck.healthy ? '✅ Healthy' : '❌ Issues Detected'}
• Memory Checks: ${diagnosticInfo.memoryStats.checksPerformed}`;

    logger.info('Memory diagnostics completed', diagnosticInfo);
    
    vscode.window.showInformationMessage(
      `Memory Diagnostics Complete - See output for details`,
      'View Output'
    ).then((selection) => {
      if (selection === 'View Output') {
        vscode.commands.executeCommand('workbench.action.output.toggleOutput');
      }
    });
    
    // Also show in information modal for immediate viewing
    const detailedInfo = `${summary}

Resource Types:
${Object.entries(diagnosticInfo.resourceBreakdown).map(([type, count]) => `• ${type}: ${count}`).join('\n')}

Service Status:
${diagnosticInfo.serviceStatus.map(s => `• ${s.name}: ${s.healthy ? '✅' : '❌'}`).join('\n')}`;
    
    const action = await vscode.window.showInformationMessage(
      detailedInfo,
      { modal: true },
      'Force Cleanup',
      'Close'
    );
    
    if (action === 'Force Cleanup') {
      const cleanupResult = await forceMemoryCleanup();
      const freedMB = Math.round((cleanupResult.memoryBefore.heapUsed - cleanupResult.memoryAfter.heapUsed) / 1024 / 1024);
      vscode.window.showInformationMessage(
        `Memory cleanup completed. Freed: ${freedMB}MB, GC: ${cleanupResult.garbageCollectionTriggered ? 'Yes' : 'No'}`
      );
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    logger.error('Memory diagnostics failed', error);
    vscode.window.showErrorMessage(`Memory diagnostics failed: ${errorMessage}`);
  }
}

// Export core services for advanced usage (be careful with this)
export { coreServices };
