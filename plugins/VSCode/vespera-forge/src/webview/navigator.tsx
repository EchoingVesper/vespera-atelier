/**
 * React Navigator Entry Point
 * Phase 16b Stage 1 - Added ProjectSelector integration
 * Renders the Codex Navigator with project switching support
 */
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { VSCodeAdapter } from '@/vespera-forge/core/adapters/vscode-adapter';
import { CodexNavigator } from '@/vespera-forge/components/navigation/CodexNavigator';
import { ProjectSelector } from '@/vespera-forge/components/project/ProjectSelector';
import { WelcomeScreen } from '@/vespera-forge/components/project/WelcomeScreen';
import { ProjectProvider, useProjectContext } from '@/contexts/ProjectContext';
import { Codex, Template } from '@/vespera-forge/core/types';
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

// Use the adapter's existing VS Code API instance (already acquired in adapter constructor)
const vscodeApi = adapter.api;

/**
 * Navigator App Component
 */
function NavigatorApp() {
  const [codices, setCodices] = useState<Codex[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCodexId, setSelectedCodexId] = useState<string | undefined>();
  const [noWorkspace, setNoWorkspace] = useState<{ message: string; action: string } | null>(null);

  // Phase 16b Stage 2: Access project context for WelcomeScreen logic
  // Phase 16b Stage 3: Access activeProject for codex filtering
  const { projects, isLoading, activeProject } = useProjectContext();

  // Phase 16b Stage 3: Filter codices by active project
  // Only show codices that belong to the currently active project
  const filteredCodices = React.useMemo(() => {
    if (!activeProject) {
      // No active project - show no codices
      return [];
    }
    // Handle both camelCase (projectId) and snake_case (project_id) from backend
    return codices.filter(codex => {
      const codexProjectId = codex.metadata.projectId || (codex.metadata as any).project_id;
      return codexProjectId === activeProject.id;
    });
  }, [codices, activeProject]);

  // Listen for messages from the extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'initialState':
          console.log('[Navigator] Received initialState:', message.payload);
          setCodices(message.payload.codices || []);
          setTemplates(message.payload.templates || []);
          setNoWorkspace(null); // Clear no-workspace state
          break;

        case 'noWorkspace':
          console.log('[Navigator] No workspace folder open:', message.payload);
          setNoWorkspace(message.payload);
          break;

        case 'codex.created':
          console.log('[Navigator] Codex created:', message.payload);
          // Select the newly created codex
          setSelectedCodexId(message.payload.id);
          // TODO: Enter edit mode when UI supports it
          break;

        case 'response':
          // Handle response from extension
          console.log('[Navigator] Received response:', message);
          break;

        // Project-related messages are handled by ProjectContext, silently ignore here
        case 'project:list:response':
        case 'project:get:response':
        case 'project:create:response':
        case 'project:update:response':
        case 'project:delete:response':
        case 'project:setActive:response':
        case 'project:projectsChanged':
        case 'project:activeChanged':
          // Handled by ProjectContext
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
    adapter.sendMessage({
      type: 'codex.create',
      payload: { templateId }
    });
  }, [adapter]);

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
   * Handle project creation request
   * Phase 16b Stage 2 will implement full creation wizard
   */
  const handleCreateProject = useCallback(() => {
    adapter.sendMessage({
      type: 'project:createWizard',
      payload: {}
    });
  }, []);

  // Show "Open Folder" prompt if no workspace
  if (noWorkspace) {
    return (
      <div className="flex flex-col items-center justify-center h-full p-6 text-center">
        <div className="w-16 h-16 mb-4 text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Folder Open</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          {noWorkspace.message}
        </p>
        <button
          onClick={handleOpenFolder}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Open Folder
        </button>
      </div>
    );
  }

  // Phase 16b Stage 2: Show WelcomeScreen when no projects exist
  const shouldShowWelcome = !isLoading && projects.length === 0;

  if (shouldShowWelcome) {
    return <WelcomeScreen onCreateProject={handleCreateProject} />;
  }

  // Phase 16b Stage 1: Navigator with ProjectSelector
  return (
    <div className="flex flex-col h-full">
      {/* Project Selector - allows switching between projects */}
      <div className="flex-shrink-0 border-b border-border p-2">
        <ProjectSelector
          onCreateProject={handleCreateProject}
        />
      </div>

      {/* Codex Navigator - main content area */}
      {/* Phase 16b Stage 3: Show filtered codices (only active project) */}
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
  // Phase 16b Stage 1: Wrap in ProjectProvider for project context
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <ProjectProvider vscode={vscodeApi}>
        <NavigatorApp />
      </ProjectProvider>
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
