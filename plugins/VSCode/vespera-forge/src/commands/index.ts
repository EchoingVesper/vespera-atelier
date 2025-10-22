/**
 * Command handlers for Vespera Forge extension
 */

import * as vscode from 'vscode';
import { VesperaForgeContext, CommandHandler, ContentType } from '@/types';
import { showInfo, showError, getConfig, log } from '@/utils';
import { VesperaEvents } from '@/utils/events';
import { BinderyContentProvider } from '../providers/bindery-content';
import { showBinderyConfigurationDialog } from '../utils/bindery-config';
import { getBinderyService } from '../services/bindery';
import { SessionSummary } from '../chat/types/chat';

// Interface for session QuickPick items
interface SessionQuickPickItem extends vscode.QuickPickItem {
  sessionId: string;
}

/**
 * Initialize Vespera Forge command handler
 */
export const initializeCommand: CommandHandler = async (context: VesperaForgeContext) => {
  try {
    log('Initializing Vespera Forge...');
    
    // Update configuration
    context.config = getConfig();
    
    // Initialize Bindery service
    const binderyService = getBinderyService();
    const result = await binderyService.initialize();
    
    if (result.success) {
      log('Bindery service connected:', result.data);

      // Set context as initialized
      await vscode.commands.executeCommand('setContext', 'vespera-forge:enabled', true);
      context.isInitialized = true;

      // Show all views
      vscode.commands.executeCommand('vespera-forge.showAllViews');

      await showInfo(`Vespera Forge initialized successfully! Connected to Bindery v${result.data?.version || 'unknown'}.`);

      // Refresh all views
      vscode.commands.executeCommand('vespera-forge.globalRefresh');
    } else {
      // Don't show error toast for NoWorkspace - Navigator already displays this
      const isNoWorkspace = result.error.message?.includes('No workspace folder open');
      if (!isNoWorkspace) {
        await showError(`Failed to connect to Bindery: ${result.error.message}`);
      }

      // Still set as initialized to allow configuration
      await vscode.commands.executeCommand('setContext', 'vespera-forge:enabled', true);
      context.isInitialized = true;
    }
    
    // Initialize legacy provider if available
    if (context.contentProvider instanceof BinderyContentProvider) {
      const success = await context.contentProvider.initialize();
      if (!success) {
        log('Legacy Bindery provider initialization failed, using new service');
      }
    }
    
    log('Vespera Forge initialization completed');
  } catch (error) {
    await showError('Failed to initialize Vespera Forge', error as Error);
  }
};

/**
 * Create content command handler
 */
export const createContentCommand: CommandHandler = async (context: VesperaForgeContext) => {
  try {
    log('Create Content command started');
    if (!context.isInitialized) {
      log('Context not initialized, showing error');
      await showError('Vespera Forge is not initialized. Please run the Initialize command first.');
      return;
    }
    
    // Show quick pick for content types
    const contentTypes = [
      { label: 'Task', description: 'Create a new task', type: ContentType.Task },
      { label: 'Note', description: 'Create a new note', type: ContentType.Note },
      { label: 'Project', description: 'Create a new project', type: ContentType.Project },
      { label: 'Template', description: 'Create a new template', type: ContentType.Template }
    ];
    
    log('Showing content type picker');
    const selected = await vscode.window.showQuickPick(contentTypes, {
      placeHolder: 'Select content type to create'
    });
    
    if (selected) {
      log(`Content type selected: ${selected.label}`);
      // Get title from user
      const title = await vscode.window.showInputBox({
        prompt: `Enter title for the ${selected.label.toLowerCase()}`,
        placeHolder: `My ${selected.label}`
      });
      
      if (title && title.trim()) {
        log(`Title entered: ${title.trim()}`);
        
        if (selected.type === ContentType.Task) {
          log('Creating task via Bindery service');
          // Use Bindery service for task creation
          const binderyService = getBinderyService();
          log('Bindery service obtained, sending createTask request');
          const result = await binderyService.createTask({
            title: title.trim(),
            description: '',
            tags: [],
            labels: {},
            subtasks: []
          });
          
          log(`Task creation result: ${JSON.stringify(result)}`);
          if (result.success) {
            await showInfo(`Created Task: ${title.trim()}`);
            log(`Created task with ID: ${result.data}`);
            
            // Emit task creation event for cross-component sync
            console.log(`[Commands] 📡 Emitting taskCreated event for task: ${result.data}`);
            VesperaEvents.taskCreated(result.data, title.trim());
            
            // Refresh task views
            log('Refreshing task views');
            vscode.commands.executeCommand('vespera-forge.refreshTaskTree');
            vscode.commands.executeCommand('vespera-forge.refreshTaskDashboard');
          } else {
            log(`Task creation failed: ${result.error.message}`);
            await showError(`Failed to create task: ${result.error.message}`);
          }
        } else {
          // Use legacy provider for other content types
          const newItem = await context.contentProvider.createContent({
            type: selected.type,
            title: title.trim(),
            content: '',
            metadata: {}
          });
          
          await showInfo(`Created ${selected.label}: ${newItem.title}`);
          log(`Created ${selected.label} with ID: ${newItem.id}`);
          
          // Refresh the tree view if available
          vscode.commands.executeCommand('vesperaForgeExplorer.refresh');
        }
      } else {
        log('No title entered or title was empty');
      }
    } else {
      log('No content type selected');
    }
  } catch (error) {
    log(`Error in createContentCommand: ${error}`);
    await showError('Failed to create content', error as Error);
  }
};

/**
 * Open task manager command handler
 */
export const openTaskManagerCommand: CommandHandler = async (context: VesperaForgeContext) => {
  try {
    if (!context.isInitialized) {
      await showError('Vespera Forge is not initialized. Please run the Initialize command first.');
      return;
    }
    
    // Open the modern task dashboard webview
    vscode.commands.executeCommand('vespera-forge.openTaskDashboard');
    
    // Also ensure task tree is visible
    vscode.commands.executeCommand('vesperaForgeTaskTree.focus');
    
    log('Opened task manager views');
  } catch (error) {
    await showError('Failed to open task manager', error as Error);
  }
};

/**
 * Configure Bindery command handler
 */
export const configureBinderyCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    await showBinderyConfigurationDialog();
  } catch (error) {
    await showError('Failed to show Bindery configuration', error as Error);
  }
};

/**
 * Chat session management command handlers
 */

// Create a new chat session
export const createChatSessionCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const title = await vscode.window.showInputBox({
      prompt: 'Enter session title (optional)',
      placeHolder: 'New Chat Session'
    });

    // Get chat panel if it exists
    const chatPanel = (global as any).vesperaChatPanel;
    if (chatPanel && typeof chatPanel.createNewSession === 'function') {
      await chatPanel.createNewSession(title || undefined);
      await showInfo(`Chat session "${title || 'New Session'}" created`);
    } else {
      await showError('Chat panel not available. Please open the chat panel first.');
    }
  } catch (error) {
    await showError('Failed to create chat session', error as Error);
  }
};

// Switch between chat sessions
export const switchChatSessionCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const chatPanel = (global as any).vesperaChatPanel;
    if (!chatPanel) {
      await showError('Chat panel not available. Please open the chat panel first.');
      return;
    }

    // Get session summaries from chat system
    const chatSystem = (global as any).vesperaChatSystem;
    if (!chatSystem) {
      await showError('Chat system not initialized.');
      return;
    }

    const sessions = chatSystem.getSessionSummaries();
    if (sessions.length === 0) {
      await showInfo('No chat sessions available. Create a new session first.');
      return;
    }

    const sessionItems = sessions.map((session: SessionSummary) => ({
      label: `${session.isPinned ? '📌 ' : ''}${session.title}`,
      description: `${session.messageCount} messages • ${session.provider} • ${new Date(session.lastActivity).toLocaleDateString()}`,
      detail: session.isActive ? '(Active)' : undefined,
      sessionId: session.id
    }));

    const selected = await vscode.window.showQuickPick(sessionItems, {
      placeHolder: 'Select a session to switch to'
    }) as SessionQuickPickItem | undefined;

    if (selected && !sessions.find((s: SessionSummary) => s.id === selected.sessionId)?.isActive) {
      await chatSystem.switchToSession(selected.sessionId);
      await showInfo(`Switched to session: ${selected.label}`);
    }
  } catch (error) {
    await showError('Failed to switch chat session', error as Error);
  }
};

// Export current chat sessions
export const exportChatSessionsCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const chatSystem = (global as any).vesperaChatSystem;
    if (!chatSystem) {
      await showError('Chat system not initialized.');
      return;
    }

    const sessions = chatSystem.getSessionSummaries();
    if (sessions.length === 0) {
      await showInfo('No chat sessions available to export.');
      return;
    }

    const sessionItems = sessions.map((session: SessionSummary) => ({
      label: `${session.isPinned ? '📌 ' : ''}${session.title}`,
      description: `${session.messageCount} messages • ${new Date(session.lastActivity).toLocaleDateString()}`,
      picked: session.isActive,
      sessionId: session.id
    }));

    const selected = await vscode.window.showQuickPick(sessionItems, {
      placeHolder: 'Select sessions to export',
      canPickMany: true
    }) as SessionQuickPickItem[] | undefined;

    if (selected && selected.length > 0) {
      const format = await vscode.window.showQuickPick([
        { label: 'JSON', value: 'json' },
        { label: 'Markdown', value: 'markdown' }
      ], {
        placeHolder: 'Select export format'
      });

      if (format) {
        const sessionIds = selected.map((s: SessionQuickPickItem) => s.sessionId);
        const exportedData = await chatSystem.exportSessions(sessionIds, format.value);
        
        const fileName = `chat-export-${new Date().toISOString().split('T')[0]}.${format.value === 'markdown' ? 'md' : 'json'}`;
        const uri = await vscode.window.showSaveDialog({
          defaultUri: vscode.Uri.file(fileName),
          filters: format.value === 'json' 
            ? { 'JSON Files': ['json'] }
            : { 'Markdown Files': ['md'] }
        });

        if (uri) {
          await vscode.workspace.fs.writeFile(uri, Buffer.from(exportedData, 'utf8'));
          await showInfo(`Sessions exported to ${uri.fsPath}`);
        }
      }
    }
  } catch (error) {
    await showError('Failed to export chat sessions', error as Error);
  }
};

// Import chat sessions
export const importChatSessionsCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const chatSystem = (global as any).vesperaChatSystem;
    if (!chatSystem) {
      await showError('Chat system not initialized.');
      return;
    }

    const uri = await vscode.window.showOpenDialog({
      canSelectMany: false,
      filters: { 'JSON Files': ['json'] },
      openLabel: 'Import Sessions'
    });

    if (uri && uri.length > 0) {
      const data = await vscode.workspace.fs.readFile(uri[0]!);
      const jsonData = Buffer.from(data).toString('utf8');
      
      const result = await chatSystem.importSessions(jsonData);
      
      const message = `Import completed: ${result.imported} sessions imported, ${result.skipped} skipped`;
      if (result.errors.length > 0) {
        await showError(`${message}. ${result.errors.length} errors occurred.`);
      } else {
        await showInfo(message);
      }
    }
  } catch (error) {
    await showError('Failed to import chat sessions', error as Error);
  }
};

// Clear chat session history
export const clearChatHistoryCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const chatSystem = (global as any).vesperaChatSystem;
    if (!chatSystem) {
      await showError('Chat system not initialized.');
      return;
    }

    const action = await vscode.window.showWarningMessage(
      'Clear chat history?',
      { modal: true },
      'Clear Current Session',
      'Clear All Sessions'
    );

    if (action === 'Clear Current Session') {
      await chatSystem.clearHistory();
      await showInfo('Current session history cleared');
    } else if (action === 'Clear All Sessions') {
      const historyManager = (global as any).vesperaChatHistoryManager;
      if (historyManager) {
        await historyManager.clearAllHistory();
        await showInfo('All chat history cleared');
      }
    }
  } catch (error) {
    await showError('Failed to clear chat history', error as Error);
  }
};

// Show chat statistics
export const showChatStatsCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const chatSystem = (global as any).vesperaChatSystem;
    if (!chatSystem) {
      await showError('Chat system not initialized.');
      return;
    }

    const stats = chatSystem.getStatistics();
    const sessionStats = stats.sessions;
    const historyStats = stats.history;

    const message = `
**Chat Statistics**

**Sessions:**
- Total Sessions: ${sessionStats.totalSessions}
- Active Sessions: ${sessionStats.activeSessions}
- Pinned Sessions: ${sessionStats.pinnedSessions}
- Recent Activity (24h): ${sessionStats.recentActivity}

**Messages:**
- Total Messages: ${historyStats.totalMessages}
- Storage Size: ${(historyStats.storageSize / 1024).toFixed(1)} KB
- Oldest Message: ${historyStats.oldestMessage ? new Date(historyStats.oldestMessage).toLocaleDateString() : 'None'}
- Newest Message: ${historyStats.newestMessage ? new Date(historyStats.newestMessage).toLocaleDateString() : 'None'}

**Providers:**
${Object.entries(sessionStats.providerDistribution).map(([provider, count]) => `- ${provider}: ${count} sessions`).join('\n')}
    `.trim();

    await vscode.window.showInformationMessage(message, { modal: true });
  } catch (error) {
    await showError('Failed to show chat statistics', error as Error);
  }
};

/**
 * Codex management command handlers
 */

// Open Codex Navigator
export const openCodexNavigatorCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    await vscode.commands.executeCommand('vesperaForge.navigatorView.focus');
    log('Opened Codex Navigator');
  } catch (error) {
    await showError('Failed to open Codex Navigator', error as Error);
  }
};

// Create New Codex
export const createCodexCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const binderyService = getBinderyService();

    // Show template picker
    const templates = [
      { label: '📝 Note', description: 'Simple note or document', templateId: 'note' },
      { label: '✓ Task', description: 'Task or todo item', templateId: 'task' },
      { label: '📁 Project', description: 'Project container', templateId: 'project' },
      { label: '👤 Character', description: 'Character profile for creative writing', templateId: 'character' },
      { label: '🎬 Scene', description: 'Scene or chapter for creative writing', templateId: 'scene' },
      { label: '🗺️ Location', description: 'Place or setting for creative writing', templateId: 'location' }
    ];

    const selectedTemplate = await vscode.window.showQuickPick(templates, {
      placeHolder: 'Select a template for the new codex'
    });

    if (!selectedTemplate) {
      return;
    }

    // Get title from user
    const title = await vscode.window.showInputBox({
      prompt: `Enter a name for your new ${selectedTemplate.description.toLowerCase()}`,
      placeHolder: `My ${selectedTemplate.label.replace(/[^\w\s]/g, '').trim()}`
    });

    if (!title?.trim()) {
      return;
    }

    // Create the codex with title
    const result = await binderyService.createCodex(title.trim(), selectedTemplate.templateId);

    if (result.success) {
      const codexId = result.data;
      log(`Created codex with ID: ${codexId}, title: ${title.trim()}`);

      // Small delay to ensure Bindery has persisted the data
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger Navigator refresh
      const navigatorProvider = (global as any).vesperaNavigatorProvider;
      if (navigatorProvider && typeof navigatorProvider.sendInitialState === 'function') {
        log('Triggering Navigator refresh after creation');
        await navigatorProvider.sendInitialState();
      } else {
        log('Warning: Navigator provider not available for refresh');
      }

      await showInfo(`Created ${selectedTemplate.label}: ${title.trim()}`);

      // Focus navigator
      await vscode.commands.executeCommand('vesperaForge.navigatorView.focus');
    } else {
      await showError(`Failed to create codex: ${result.error.message}`);
    }
  } catch (error) {
    await showError('Failed to create codex', error as Error);
  }
};

// Search Codices
export const searchCodexCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const binderyService = getBinderyService();
    const result = await binderyService.listCodeices();

    if (!result.success || !result.data || result.data.length === 0) {
      await showInfo('No codices found. Create one first!');
      return;
    }

    // Template name mapping
    const templateNames: Record<string, string> = {
      'note': '📝 Note',
      'task': '✓ Task',
      'project': '📁 Project',
      'character': '👤 Character',
      'scene': '🎬 Scene',
      'location': '🗺️ Location'
    };

    // Create quick pick items from codex list
    const codexItems = await Promise.all(
      result.data.map(async (codexId: string) => {
        const codexResult = await binderyService.getCodex(codexId);
        if (codexResult.success && codexResult.data) {
          const codex = codexResult.data as any; // Bindery returns flat structure
          const templateName = templateNames[codex.template_id] || codex.template_id;
          const title = codex.title || '(Untitled)';
          const tags = codex.tags || [];

          return {
            label: `${title}`,
            description: templateName,
            detail: tags.length > 0 ? `Tags: ${tags.join(', ')}` : 'No tags',
            codexId: codexId
          };
        }
        return null;
      })
    );

    const validItems = codexItems.filter(item => item !== null);

    if (validItems.length === 0) {
      await showInfo('No codices available.');
      return;
    }

    const selected = await vscode.window.showQuickPick(validItems as any[], {
      placeHolder: 'Search and select a codex to open',
      matchOnDescription: true,
      matchOnDetail: true
    });

    if (selected) {
      await showInfo(`Selected: ${selected.label} (${selected.description})`);
      // Focus navigator and let it handle selection
      await vscode.commands.executeCommand('vesperaForge.navigatorView.focus');
      log(`Codex selected: ${selected.codexId}`);
      // TODO: Send message to Navigator to select this codex
    }
  } catch (error) {
    await showError('Failed to search codices', error as Error);
  }
};

// Delete Active Codex
export const deleteCodexCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    const binderyService = getBinderyService();
    const result = await binderyService.listCodeices();

    if (!result.success || !result.data || result.data.length === 0) {
      await showInfo('No codices to delete.');
      return;
    }

    // Template name mapping
    const templateNames: Record<string, string> = {
      'note': '📝 Note',
      'task': '✓ Task',
      'project': '📁 Project',
      'character': '👤 Character',
      'scene': '🎬 Scene',
      'location': '🗺️ Location'
    };

    // Create quick pick items from codex list
    const codexItems = await Promise.all(
      result.data.map(async (codexId: string) => {
        const codexResult = await binderyService.getCodex(codexId);
        if (codexResult.success && codexResult.data) {
          const codex = codexResult.data as any; // Bindery returns flat structure
          const templateName = templateNames[codex.template_id] || codex.template_id;
          const title = codex.title || '(Untitled)';
          const tags = codex.tags || [];

          return {
            label: `${title}`,
            description: templateName,
            detail: tags.length > 0 ? `Tags: ${tags.join(', ')}` : 'No tags',
            codexId: codexId
          };
        }
        return null;
      })
    );

    const validItems = codexItems.filter(item => item !== null);

    if (validItems.length === 0) {
      await showInfo('No codices available to delete.');
      return;
    }

    const selected = await vscode.window.showQuickPick(validItems as any[], {
      placeHolder: 'Select a codex to delete'
    });

    if (!selected) {
      return;
    }

    // Confirm deletion
    const confirmation = await vscode.window.showWarningMessage(
      `Delete "${selected.label}"?`,
      { modal: true, detail: 'This action cannot be undone. All content in this codex will be permanently removed.' },
      'Delete',
      'Cancel'
    );

    if (confirmation !== 'Delete') {
      return;
    }

    // Delete the codex
    const deleteResult = await binderyService.deleteCodex(selected.codexId);

    if (deleteResult.success) {
      log(`Deleted codex with ID: ${selected.codexId}`);

      // Small delay to ensure Bindery has persisted the deletion
      await new Promise(resolve => setTimeout(resolve, 100));

      // Trigger Navigator refresh
      const navigatorProvider = (global as any).vesperaNavigatorProvider;
      if (navigatorProvider && typeof navigatorProvider.sendInitialState === 'function') {
        log('Triggering Navigator refresh after deletion');
        await navigatorProvider.sendInitialState();
      } else {
        log('Warning: Navigator provider not available for refresh');
      }

      await showInfo(`Deleted ${selected.description}: ${selected.label}`);

      // Focus navigator
      await vscode.commands.executeCommand('vesperaForge.navigatorView.focus');
    } else {
      await showError(`Failed to delete codex: ${deleteResult.error.message}`);
    }
  } catch (error) {
    await showError('Failed to delete codex', error as Error);
  }
};

// Refresh Codex List
export const refreshCodexListCommand: CommandHandler = async (_context: VesperaForgeContext) => {
  try {
    // Trigger Navigator refresh
    const navigatorProvider = (global as any).vesperaNavigatorProvider;
    if (navigatorProvider && typeof navigatorProvider.sendInitialState === 'function') {
      await navigatorProvider.sendInitialState();
    }

    // Focus the view
    await vscode.commands.executeCommand('vesperaForge.navigatorView.focus');
    log('Refreshed Codex Navigator');

    // Get count to show in confirmation
    const binderyService = getBinderyService();
    const result = await binderyService.listCodeices();
    const count = result.success ? result.data?.length || 0 : 0;

    await showInfo(`Codex Navigator refreshed (${count} ${count === 1 ? 'codex' : 'codices'})`);
  } catch (error) {
    await showError('Failed to refresh codex list', error as Error);
  }
};

/**
 * Get the commands map following Roo Code pattern
 */
const getCommandsMap = (vesperaContext: VesperaForgeContext) => ({
  'vespera-forge.initialize': async () => {
    log('[Command] Initialize command executed');
    await initializeCommand(vesperaContext);
  },
  'vespera-forge.createContent': async () => {
    try {
      log('[Command] Create Content command started');
      log('[Command] VesperaContext initialized:', vesperaContext.isInitialized);
      log('[Command] Calling createContentCommand...');
      await createContentCommand(vesperaContext);
      log('[Command] Create Content command completed');
    } catch (error) {
      log('[Command] Create Content command error:', error);
      await vscode.window.showErrorMessage(`Create Content failed: ${error}`);
    }
  },
  'vespera-forge.testCommand': async () => {
    try {
      log('[Command] 🧪 TEST COMMAND STARTED!');
      log('[Command] Test command context available:', !!vesperaContext);
      log('[Command] VesperaContext initialized:', vesperaContext.isInitialized);
      await vscode.window.showInformationMessage('Test command works!');
      log('[Command] 🧪 TEST COMMAND COMPLETED!');
    } catch (error) {
      log('[Command] Test command error:', error);
      await vscode.window.showErrorMessage(`Test command failed: ${error}`);
    }
  },
  'vespera-forge.openTaskManager': async () => {
    log('[Command] Open Task Manager command executed');
    await openTaskManagerCommand(vesperaContext);
  },
  'vespera-forge.configureBindery': async () => {
    log('[Command] Configure Bindery command executed');
    await configureBinderyCommand(vesperaContext);
  },
  'vespera-forge.inlineTest': async () => {
    log('[Command] 🎯 INLINE TEST COMMAND EXECUTED!');
    await vscode.window.showInformationMessage('Inline test works!');
  },
  'vespera-forge.activationCompleted': () => {
    log('[Command] Activation completed signal received');
    // This is a no-op command that signals VS Code the extension is ready
  },
  // Chat session management commands
  'vespera-forge.createChatSession': async () => {
    log('[Command] Create Chat Session command executed');
    await createChatSessionCommand(vesperaContext);
  },
  'vespera-forge.switchChatSession': async () => {
    log('[Command] Switch Chat Session command executed');
    await switchChatSessionCommand(vesperaContext);
  },
  'vespera-forge.exportChatSessions': async () => {
    log('[Command] Export Chat Sessions command executed');
    await exportChatSessionsCommand(vesperaContext);
  },
  'vespera-forge.importChatSessions': async () => {
    log('[Command] Import Chat Sessions command executed');
    await importChatSessionsCommand(vesperaContext);
  },
  'vespera-forge.clearChatHistory': async () => {
    log('[Command] Clear Chat History command executed');
    await clearChatHistoryCommand(vesperaContext);
  },
  'vespera-forge.showChatStats': async () => {
    log('[Command] Show Chat Statistics command executed');
    await showChatStatsCommand(vesperaContext);
  },
  'vespera-forge.showAllViews': async () => {
    log('[Command] Show All Views command executed');
    // Focus on the navigator view to make sidebar visible
    await vscode.commands.executeCommand('vesperaForge.navigatorView.focus');
  },
  'vespera-forge.globalRefresh': async () => {
    log('[Command] Global Refresh command executed');
    // Refresh all views
    vscode.commands.executeCommand('vespera-forge.refreshTaskTree');
    vscode.commands.executeCommand('vespera-forge.refreshTaskDashboard');
  },
  // Codex management commands
  'vespera-forge.openCodexNavigator': async () => {
    log('[Command] Open Codex Navigator command executed');
    await openCodexNavigatorCommand(vesperaContext);
  },
  'vespera-forge.createCodex': async () => {
    log('[Command] Create Codex command executed');
    await createCodexCommand(vesperaContext);
  },
  'vespera-forge.searchCodex': async () => {
    log('[Command] Search Codex command executed');
    await searchCodexCommand(vesperaContext);
  },
  'vespera-forge.deleteCodex': async () => {
    log('[Command] Delete Codex command executed');
    await deleteCodexCommand(vesperaContext);
  },
  'vespera-forge.refreshCodexList': async () => {
    log('[Command] Refresh Codex List command executed');
    await refreshCodexListCommand(vesperaContext);
  }
});

/**
 * Register all commands with VS Code following Roo Code pattern
 */
export function registerCommands(context: vscode.ExtensionContext, vesperaContext: VesperaForgeContext): void {
  log('registerCommands called - using Roo Code registration pattern');
  
  const commandsMap = getCommandsMap(vesperaContext);
  
  for (const [commandId, callback] of Object.entries(commandsMap)) {
    log(`Registering command: ${commandId}`);
    
    const disposable = vscode.commands.registerCommand(commandId, callback);
    context.subscriptions.push(disposable);
  }
  
  log(`Successfully registered ${Object.keys(commandsMap).length} commands`);
}