/**
 * React Navigator Entry Point
 * Phase 17 Part 2 - Workspace-based architecture
 *
 * Renders the Codex Navigator with workspace initialization and context switching.
 *
 * Architecture Changes (Phase 17):
 * - Workspace = VS Code folder (detected by .vespera/ directory)
 * - Project = the workspace itself (not a database entity)
 * - Contexts = selectable modes (Creative Writing, Software Dev, etc.)
 * - Codices = individual content items within a context
 */
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { VSCodeAdapter } from '@/vespera-forge/core/adapters/vscode-adapter';
import { CodexNavigator } from '@/vespera-forge/components/navigation/CodexNavigator';
import { ContextSelector } from '@/vespera-forge/components/context/ContextSelector';
import { WorkspaceInitializer, WorkspaceState } from '@/vespera-forge/components/workspace/WorkspaceInitializer';
import { Codex, Template } from '@/vespera-forge/core/types';
import { IContext } from '@/types/context';
import '@/app/globals.css';

// Declare VS Code API type
declare global {
  interface Window {
    acquireVsCodeApi?: () => {
      postMessage: (message: any) => void;
      getState: () => any;
      setState: (state: any) => void;
    };
  }
}

// Create platform adapter once (outside component to avoid re-acquiring VS Code API)
const adapter = new VSCodeAdapter();

/**
 * Navigator App Component
 * Phase 17 Part 2 - Workspace-based architecture
 */
function NavigatorApp() {
  // Core state
  const [codices, setCodices] = useState<Codex[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCodexId, setSelectedCodexId] = useState<string | undefined>();

  // Workspace state (checked by backend WorkspaceDiscovery)
  const [workspaceState, setWorkspaceState] = useState<WorkspaceState>('checking');

  // Context state (contexts are what users select to organize their work)
  // TODO: Load contexts from backend when workspace is initialized
  const [contexts, setContexts] = useState<IContext[]>([]);
  const [activeContext, setActiveContext] = useState<IContext | null>(null);
  const [contextsLoading] = useState(false);

  // Filter codices by active context
  // Phase 17: No project filtering needed - workspace is the project
  const filteredCodices = React.useMemo(() => {
    if (!activeContext) {
      // No context selected - show all codices
      return codices;
    }

    // Filter by active context
    return codices.filter(codex => {
      const codexContextId = (codex.metadata as any).context_id || (codex.metadata as any).contextId;
      return codexContextId === activeContext.id;
    });
  }, [codices, activeContext]);

  // Listen for messages from the extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'workspaceState':
          // Backend sends workspace state (no-folder, no-vespera, initialized)
          console.log('[Navigator] Workspace state:', message.payload.state);
          setWorkspaceState(message.payload.state);
          break;

        case 'initialState':
          console.log('[Navigator] Received initialState:', message.payload);
          setCodices(message.payload.codices || []);
          setTemplates(message.payload.templates || []);
          setContexts(message.payload.contexts || []);

          // If we have initialState, workspace must be initialized
          setWorkspaceState('initialized');
          break;

        case 'codex.created':
          console.log('[Navigator] Codex created:', message.payload);
          // Select the newly created codex
          setSelectedCodexId(message.payload.id);
          break;

        case 'response':
          // Handle response from extension
          console.log('[Navigator] Received response:', message);
          break;

        default:
          console.log('[Navigator] Unknown message type:', message.type);
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

  const handleCodexSelect = useCallback((codex: Codex) => {
    setSelectedCodexId(codex.id);
    // Notify extension to open editor panel with this codex
    adapter.sendMessage({
      type: 'codex.selected',
      payload: { codexId: codex.id }
    });
  }, []);

  const handleCodexCreate = useCallback(async (templateId: string) => {
    // Phase 17: No project ID needed - workspace is the project
    // Include context ID if a context is selected
    adapter.sendMessage({
      type: 'codex.create',
      payload: {
        templateId,
        contextId: activeContext?.id  // Optional context ID
      }
    });
  }, [activeContext]);

  const handleCodexDelete = useCallback(async (codexId: string) => {
    adapter.sendMessage({
      type: 'codex.delete',
      payload: { codexId }
    });
    setCodices(prev => prev.filter(c => c.id !== codexId));
  }, [adapter]);

  const handleCodexUpdate = useCallback(async (codex: Codex) => {
    setCodices(prev => prev.map(c => c.id === codex.id ? codex : c));
  }, []);

  const handleOpenFolder = useCallback(() => {
    adapter.sendMessage({
      type: 'command',
      payload: { command: 'workbench.action.files.openFolder' }
    });
  }, []);

  /**
   * Handle workspace initialization
   * Phase 17: Create .vespera/ directory with selected context types
   */
  const handleInitializeWorkspace = useCallback((contextTypes: string[]) => {
    console.log('[Navigator] Initialize workspace with contexts:', contextTypes);
    adapter.sendMessage({
      type: 'workspace:initialize',
      payload: { contextTypes }
    });
  }, []);

  /**
   * Handle context selection
   * Phase 17: Select active context to filter codices
   */
  const handleContextSelect = useCallback((context: IContext) => {
    console.log('[Navigator] Context selected:', context.name);
    setActiveContext(context);

    // Notify backend
    adapter.sendMessage({
      type: 'context:setActive',
      payload: { contextId: context.id }
    });
  }, []);

  /**
   * Handle context creation request
   * Phase 17: Add new context type to workspace
   */
  const handleCreateContext = useCallback(() => {
    console.log('[Navigator] Create context requested');

    adapter.sendMessage({
      type: 'context:create',
      payload: {}
    });
  }, []);

  /**
   * Handle context deletion
   * Phase 17: Remove context from workspace
   */
  const handleDeleteContext = useCallback(async (contextId: string): Promise<boolean> => {
    console.log('[Navigator] Delete context requested:', contextId);

    adapter.sendMessage({
      type: 'context:delete',
      payload: { contextId }
    });

    return true;
  }, []);

  // Phase 17 Part 2: Show WorkspaceInitializer if workspace not initialized
  // States: checking, no-folder, no-vespera
  if (workspaceState !== 'initialized') {
    return (
      <WorkspaceInitializer
        workspaceState={workspaceState}
        onOpenFolder={handleOpenFolder}
        onInitializeWorkspace={handleInitializeWorkspace}
      />
    );
  }

  // Workspace is initialized - show Navigator with Context selector
  return (
    <div className="flex flex-col h-full">
      {/* Context Selector */}
      <div className="flex-shrink-0 border-b border-border p-2">
        <ContextSelector
          activeContext={activeContext}
          contexts={contexts}
          isLoading={contextsLoading}
          onContextSelect={handleContextSelect}
          onCreateContext={handleCreateContext}
          onDeleteContext={handleDeleteContext}
          disabled={false}
        />
      </div>

      {/* Codex Navigator - main content area */}
      <div className="flex-1 overflow-hidden">
        <CodexNavigator
          codices={filteredCodices}
          templates={templates}
          selectedCodexId={selectedCodexId}
          onCodexSelect={handleCodexSelect}
          onCodexCreate={handleCodexCreate}
          onCodexDelete={handleCodexDelete}
          onCodexUpdate={handleCodexUpdate}
        />
      </div>
    </div>
  );
}

/**
 * Initialize the Navigator
 */
function initializeNavigator(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  // Apply VS Code styling (adapter already created globally)
  adapter.applyVSCodeStyling();

  // Create React root and render
  // Phase 17: No ProjectProvider needed - workspace is the project
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <NavigatorApp />
    </React.StrictMode>
  );

  // Notify extension that navigator is ready
  adapter.sendMessage({ type: 'ready' });

  // Handle theme changes
  const initialTheme = adapter.getTheme();
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }

  const observer = new MutationObserver(() => {
    const newTheme = adapter.getTheme();
    if (newTheme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  });

  observer.observe(document.body, {
    attributes: true,
    attributeFilter: ['class']
  });

  console.log('Navigator initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeNavigator);
} else {
  initializeNavigator();
}
