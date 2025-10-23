/**
 * Views module - Exports all view components for the Codex Navigator framework
 */

import * as vscode from 'vscode';
import { NavigatorWebviewProvider } from './NavigatorWebviewProvider';
import { EditorPanelProvider } from './EditorPanelProvider';
import { AIAssistantWebviewProvider } from './ai-assistant';
import { ChatChannelListProvider } from './ChatChannelListProvider';
import { getBinderyService } from '../services/bindery';

// Export view providers
export { NavigatorWebviewProvider } from './NavigatorWebviewProvider';
export { EditorPanelProvider } from './EditorPanelProvider';
export { AIAssistantWebviewProvider } from './ai-assistant';
export { ChatChannelListProvider } from './ChatChannelListProvider';

/**
 * View context containing all initialized providers
 */
export interface VesperaViewContext {
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

  // Create AI assistant provider first
  const aiAssistantProvider = new AIAssistantWebviewProvider(context.extensionUri, context);

  // Create chat channel list provider
  const chatChannelProvider = new ChatChannelListProvider(binderyService);

  // Store chat channel provider globally for commands
  (global as any).vesperaChatChannelProvider = chatChannelProvider;

  // Create navigator provider with callback to open editor when codex is selected
  const navigatorProvider = new NavigatorWebviewProvider(
    context,
    binderyService,
    undefined, // logger (optional)
    (codexId: string) => {
      // When a codex is selected in navigator, open the editor panel
      EditorPanelProvider.createOrShow(context, binderyService, undefined, codexId);
      // Optionally notify AI assistant about the selected codex
      console.log('[Vespera] Codex selected:', codexId);
    }
  );

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

  // Register the chat channel list tree view provider
  console.log('[Vespera] Registering Chat Channel List view provider');
  const chatChannelTreeView = vscode.window.createTreeView('vesperaForge.chatChannelList', {
    treeDataProvider: chatChannelProvider,
    showCollapseAll: true
  });
  context.subscriptions.push(chatChannelTreeView);
  console.log('[Vespera] Chat Channel List view provider registered successfully');

  // Store tree view reference in provider for visibility-based loading
  (chatChannelProvider as any).treeView = chatChannelTreeView;

  // Set up visibility handler to load channels when view is first shown
  chatChannelTreeView.onDidChangeVisibility((e) => {
    if (e.visible) {
      console.log('[Vespera] Chat channel list became visible - triggering refresh');
      chatChannelProvider.refresh();
    }
  });

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
  context.subscriptions.push(navigatorProvider, aiAssistantProvider, chatChannelProvider);

  console.log('[Vespera] Codex Navigator framework initialized successfully');

  return {
    navigatorProvider,
    aiAssistantProvider,
    chatChannelProvider
  };
}
