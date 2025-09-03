/**
 * Vespera Forge - AI-enhanced content management and task orchestration for VS Code
 * with collaborative CRDT editing
 */

console.log('[Vespera] 🔥 EXTENSION FILE LOADED - extension.ts is being executed');

import * as vscode from 'vscode';
import { VesperaForgeContext } from '@/types';
import { registerCommands } from '@/commands';
import { initializeProviders } from '@/providers';
import { initializeViews } from '@/views';
import { getConfig, showInfo, showError, log, isDevelopment } from '@/utils';

/**
 * Extension activation function
 * Called when extension is first activated
 */
export async function activate(context: vscode.ExtensionContext): Promise<void> {
  console.log('[Vespera] 🚀 VESPERA FORGE: Extension activated!');
  
  // Initialize providers
  const { contentProvider, treeDataProvider } = initializeProviders(context);
  
  // Initialize views (task tree, dashboard, status bar)
  const viewContext = initializeViews(context);
  
  // Create Vespera Forge context
  const vesperaContext: VesperaForgeContext = {
    extensionContext: context,
    contentProvider,
    config: getConfig(),
    isInitialized: false
  };
  
  // Store view context for cleanup
  (vesperaContext as any)._viewContext = viewContext;
  
  // Store global context for cleanup
  globalExtensionContext = vesperaContext;
  
  // Register all commands
  registerCommands(context, vesperaContext);
  
  // Enable Vespera Forge context for views
  await vscode.commands.executeCommand('setContext', 'vespera-forge:enabled', true);
  
  // Debug configuration
  console.log('[Vespera] 🔍 Config enableAutoStart:', vesperaContext.config.enableAutoStart);
  
  // Auto-initialize if enabled in config (use immediate promise to avoid blocking)
  if (vesperaContext.config.enableAutoStart) {
    console.log('[Vespera] 🚀 Auto-initialization enabled, starting...');
    // Initialize immediately after activation completes
    setImmediate(async () => {
      try {
        console.log('[Vespera] 📞 Calling vespera-forge.initialize command...');
        await vscode.commands.executeCommand('vespera-forge.initialize');
        console.log('[Vespera] ✅ Auto-initialization completed');
      } catch (error) {
        console.error('[Vespera] ❌ Auto-initialization failed:', error);
      }
    });
  } else {
    console.log('[Vespera] ⏸️ Auto-initialization disabled in config');
  }
  
  console.log('✅ VESPERA FORGE: Extension activation completed successfully!');
}

// Global extension context for cleanup
let globalExtensionContext: VesperaForgeContext | undefined;

/**
 * Extension deactivation function
 * Called when extension is deactivated - Enhanced memory leak prevention
 */
export async function deactivate(): Promise<void> {
  try {
    log('🔄 Deactivating Vespera Forge extension with comprehensive cleanup...');
    
    // Clear VS Code context flags
    await vscode.commands.executeCommand('setContext', 'vespera-forge:enabled', false);
    
    // Explicitly dispose WebView providers to prevent memory leaks
    if (globalExtensionContext && (globalExtensionContext as any)._viewContext) {
      const viewContext = (globalExtensionContext as any)._viewContext;
      
      try {
        // Dispose chat panel (most likely to have memory issues)
        if (viewContext.chatPanelProvider && typeof viewContext.chatPanelProvider.dispose === 'function') {
          viewContext.chatPanelProvider.dispose();
          log('✅ Chat panel disposed');
        }
        
        // Dispose task dashboard
        if (viewContext.taskDashboardProvider && typeof viewContext.taskDashboardProvider.dispose === 'function') {
          viewContext.taskDashboardProvider.dispose();
          log('✅ Task dashboard disposed');
        }
        
        // Dispose status bar manager
        if (viewContext.statusBarManager && typeof viewContext.statusBarManager.dispose === 'function') {
          viewContext.statusBarManager.dispose();
          log('✅ Status bar manager disposed');
        }
        
        // Dispose task tree provider
        if (viewContext.taskTreeProvider && typeof viewContext.taskTreeProvider.dispose === 'function') {
          viewContext.taskTreeProvider.dispose();
          log('✅ Task tree provider disposed');
        }
        
      } catch (viewError) {
        console.error('Error disposing views:', viewError);
      }
    }
    
    // Disconnect from Bindery service
    try {
      const { disposeBinderyService } = await import('./services/bindery');
      await disposeBinderyService();
      log('✅ Bindery service disposed');
    } catch (binderyError) {
      console.error('Error disposing Bindery service:', binderyError);
    }
    
    // Clear global references to prevent memory leaks
    globalExtensionContext = undefined;
    
    // Force garbage collection hint (not guaranteed, but helpful)
    if (global.gc) {
      global.gc();
      log('🗑️ Suggested garbage collection');
    }
    
    log('✅ Vespera Forge extension deactivation completed successfully');
    
  } catch (error) {
    console.error('❌ Error during Vespera Forge deactivation:', error);
    
    // Even if there's an error, try to clean up global references
    globalExtensionContext = undefined;
  }
}
