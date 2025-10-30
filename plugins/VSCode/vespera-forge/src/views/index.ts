/**
 * Views module - Exports all view components for the Codex Navigator framework
 */

import * as vscode from 'vscode';
import { NavigatorWebviewProvider } from './NavigatorWebviewProvider';
import { EditorPanelProvider } from './EditorPanelProvider';
import { AIAssistantWebviewProvider } from './ai-assistant';
import { ChatChannelListProvider } from './ChatChannelListProvider';
import { WelcomeViewProvider } from './WelcomeViewProvider';
import { getBinderyService } from '../services/bindery';

// Export view providers
export { NavigatorWebviewProvider } from './NavigatorWebviewProvider';
export { EditorPanelProvider } from './EditorPanelProvider';
export { AIAssistantWebviewProvider } from './ai-assistant';
export { ChatChannelListProvider } from './ChatChannelListProvider';
export { WelcomeViewProvider } from './WelcomeViewProvider';

/**
 * View context containing all initialized providers
 */
export interface VesperaViewContext {
  welcomeProvider: WelcomeViewProvider;
  navigatorProvider: NavigatorWebviewProvider;
  aiAssistantProvider: AIAssistantWebviewProvider;
  chatChannelProvider: ChatChannelListProvider;
}

/**
 * Initialize all views and return context for extension use
 */
export function initializeViews(context: vscode.ExtensionContext): VesperaViewContext {
  console.log('[Vespera] Initializing Codex Navigator framework...');

  // Get the global Bindery service instance
  const binderyService = getBinderyService();

  // Phase 17 Part 2: No ProjectService needed - workspace is the project
  // ContextService may still be used for context management (TODO: implement)
  const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
  if (workspaceFolder) {
    // TODO: Initialize ContextService when context management is implemented
    // For now, context selection is UI-only (frontend filtering)
    console.log('[Vespera] Workspace folder detected:', workspaceFolder.uri.fsPath);
  } else {
    console.warn('[Vespera] No workspace folder open - Navigator will prompt to open one');
  }

  // Create welcome view provider
  const welcomeProvider = new WelcomeViewProvider();

  // Create AI assistant provider with bindery service
  const aiAssistantProvider = new AIAssistantWebviewProvider(context.extensionUri, context, binderyService);

  // Create chat channel list provider
  const chatChannelProvider = new ChatChannelListProvider(binderyService);

  // Store chat channel provider globally for commands
  (global as any).vesperaChatChannelProvider = chatChannelProvider;

  // Create navigator provider with callback to open editor when codex is selected
  // Phase 17 Part 2: No ProjectService needed - workspace-based architecture
  const navigatorProvider = new NavigatorWebviewProvider(
    context,
    binderyService,
    undefined, // logger (optional)
    (codexId: string) => {
      // When a codex is selected in navigator, open the editor panel
      EditorPanelProvider.createOrShow(context, binderyService, undefined, codexId);
      console.log('[Vespera] Codex selected:', codexId);
    }
  );

  // Register the welcome tree view provider in the vespera-forge sidebar
  console.log('[Vespera] Registering Welcome view provider');
  const welcomeTreeView = vscode.window.createTreeView('vesperaForge.welcomeView', {
    treeDataProvider: welcomeProvider,
    showCollapseAll: false
  });
  context.subscriptions.push(welcomeTreeView);
  console.log('[Vespera] Welcome view provider registered successfully');

  // Register the navigator view provider in the vespera-forge sidebar
  console.log('[Vespera] Registering Navigator view provider with ID:', NavigatorWebviewProvider.viewType);
  const navigatorDisposable = vscode.window.registerWebviewViewProvider(
    NavigatorWebviewProvider.viewType,
    navigatorProvider
  );
  context.subscriptions.push(navigatorDisposable);
  console.log('[Vespera] Navigator view provider registered successfully');

  // Register the AI assistant view provider in the vespera-forge-assistant sidebar
  console.log('[Vespera] Registering AI Assistant view provider with ID:', AIAssistantWebviewProvider.viewType);
  const aiAssistantDisposable = vscode.window.registerWebviewViewProvider(
    AIAssistantWebviewProvider.viewType,
    aiAssistantProvider
  );
  context.subscriptions.push(aiAssistantDisposable);
  console.log('[Vespera] AI Assistant view provider registered successfully');

  // Note: Chat channel list is now integrated into the AI Assistant webview
  // The ChatChannelListProvider is kept for backward compatibility with commands,
  // but is not registered as a separate view

  // Register command to open the editor panel
  const openEditorCommand = vscode.commands.registerCommand(
    'vespera-forge.openEditor',
    (codexId?: string) => {
      EditorPanelProvider.createOrShow(context, binderyService, undefined, codexId);
    }
  );
  context.subscriptions.push(openEditorCommand);

  // Register command to open AI Assistant (wired to old openChatPanel command)
  const openChatPanelCommand = vscode.commands.registerCommand(
    'vespera-forge.openChatPanel',
    async () => {
      // Focus the AI Assistant view
      await vscode.commands.executeCommand('vespera-forge.aiAssistant.focus');
    }
  );
  context.subscriptions.push(openChatPanelCommand);

  // Register command to open AI Assistant with new name
  const openAIAssistantCommand = vscode.commands.registerCommand(
    'vespera-forge.openAIAssistant',
    async () => {
      // Focus the AI Assistant view
      await vscode.commands.executeCommand('vespera-forge.aiAssistant.focus');
    }
  );
  context.subscriptions.push(openAIAssistantCommand);

  // Add providers to disposables
  context.subscriptions.push(welcomeProvider, navigatorProvider, aiAssistantProvider, chatChannelProvider);

  console.log('[Vespera] Codex Navigator framework initialized successfully');

  // Handle auto-opening views based on settings
  const config = vscode.workspace.getConfiguration('vesperaForge');
  const autoOpenNavigator = config.get<boolean>('views.autoOpenNavigator', false);
  const autoOpenAIAssistant = config.get<boolean>('views.autoOpenAIAssistant', false);

  // Auto-open views if configured (otherwise VS Code will restore previous state)
  if (autoOpenNavigator) {
    console.log('[Vespera] Auto-opening Navigator view (configured by user)');
    vscode.commands.executeCommand('vesperaForge.navigatorView.focus').then(
      undefined,
      (err: any) => console.warn('[Vespera] Failed to auto-open Navigator:', err)
    );
  }

  if (autoOpenAIAssistant) {
    console.log('[Vespera] Auto-opening AI Assistant view (configured by user)');
    vscode.commands.executeCommand('vespera-forge.aiAssistant.focus').then(
      undefined,
      (err: any) => console.warn('[Vespera] Failed to auto-open AI Assistant:', err)
    );
  }

  return {
    welcomeProvider,
    navigatorProvider,
    aiAssistantProvider,
    chatChannelProvider
  };
}
