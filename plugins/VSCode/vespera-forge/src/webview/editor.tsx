/**
 * React Editor Entry Point
 * Renders the Editor + AI Assistant in a two-panel layout
 */
import React, { useState, useCallback, useMemo } from 'react';
import { createRoot } from 'react-dom/client';
import { VSCodeAdapter } from '@/vespera-forge/core/adapters/vscode-adapter';
import { CodexEditor } from '@/vespera-forge/components/editor/CodexEditor';
import { AIAssistant } from '@/vespera-forge/components/ai/AIAssistant';
import { Panel, PanelGroup, PanelResizeHandle } from 'react-resizable-panels';
import { Codex, Template, AIAssistant as AIAssistantType, Context } from '@/vespera-forge/core/types';
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
 * Editor App Component
 */
function EditorApp() {
  const [activeCodex, setActiveCodex] = useState<Codex | undefined>();
  const [activeTemplate, setActiveTemplate] = useState<Template | undefined>();
  const [templates, setTemplates] = useState<Template[]>([]);
  const [assistants, setAssistants] = useState<AIAssistantType[]>([]);
  const [currentAssistant, setCurrentAssistant] = useState<AIAssistantType | undefined>();

  const context: Context = adapter.getCurrentContext();

  const handleCodexUpdate = useCallback(async (codex: Codex) => {
    setActiveCodex(codex);
    adapter.sendMessage({
      type: 'codex.update',
      payload: codex
    });
  }, [adapter]);

  const handleAIMessage = useCallback(async (message: string, assistant: AIAssistantType, aiContext: any) => {
    return new Promise<string>((resolve) => {
      const messageId = Date.now().toString();

      const handleResponse = (event: MessageEvent) => {
        const data = event.data;
        if (data.type === 'ai.response' && data.id === messageId) {
          window.removeEventListener('message', handleResponse);
          resolve(data.payload.response);
        }
      };

      window.addEventListener('message', handleResponse);

      adapter.sendMessage({
        type: 'ai.message',
        id: messageId,
        payload: { message, assistant, context: aiContext }
      });
    });
  }, [adapter]);

  const centerPanel = useMemo(() => (
    <CodexEditor
      codex={activeCodex}
      template={activeTemplate}
      context={context}
      onCodexUpdate={handleCodexUpdate}
      platformAdapter={adapter}
    />
  ), [activeCodex, activeTemplate, context, handleCodexUpdate, adapter]);

  const rightPanel = useMemo(() => (
    <AIAssistant
      assistants={assistants}
      currentAssistant={currentAssistant || assistants[0]}
      activeCodex={activeCodex}
      activeTemplate={activeTemplate}
      context={context}
      onAssistantChange={setCurrentAssistant}
      onSendMessage={handleAIMessage}
    />
  ), [assistants, currentAssistant, activeCodex, activeTemplate, context, handleAIMessage]);

  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground">
      <PanelGroup direction="horizontal" className="h-full">
        {/* Center Panel - Editor */}
        <Panel defaultSize={60} minSize={40} className="min-w-0">
          <div className="h-full overflow-auto bg-background">
            {centerPanel}
          </div>
        </Panel>

        {/* Resize Handle */}
        <PanelResizeHandle className="w-1 bg-border hover:bg-primary transition-colors" />

        {/* Right Panel - AI Assistant */}
        <Panel defaultSize={40} minSize={30} maxSize={60} className="min-w-0">
          <div className="h-full overflow-auto border-l border-border bg-background">
            {rightPanel}
          </div>
        </Panel>
      </PanelGroup>
    </div>
  );
}

/**
 * Initialize the Editor
 */
function initializeEditor(): void {
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  // Apply VS Code styling (adapter already created globally)
  adapter.applyVSCodeStyling();

  // Create React root and render
  const root = createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <EditorApp />
    </React.StrictMode>
  );

  // Notify extension that editor is ready
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

  console.log('Editor initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeEditor);
} else {
  initializeEditor();
}
