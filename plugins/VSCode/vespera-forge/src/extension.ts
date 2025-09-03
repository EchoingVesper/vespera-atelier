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

/**
 * Extension deactivation function
 * Called when extension is deactivated
 */
export async function deactivate(): Promise<void> {
  try {
    log('Deactivating Vespera Forge extension...');
    
    // Disconnect from Bindery service
    const { disposeBinderyService } = await import('./services/bindery');
    await disposeBinderyService();
    
    log('Vespera Forge extension deactivation completed');
    
  } catch (error) {
    console.error('Error during Vespera Forge deactivation:', error);
  }
}
