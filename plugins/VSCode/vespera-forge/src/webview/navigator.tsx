/**
 * React Navigator Entry Point
 * Renders only the Codex Navigator for the sidebar view
 */
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { VSCodeAdapter } from '@/vespera-forge/core/adapters/vscode-adapter';
import { CodexNavigator } from '@/vespera-forge/components/navigation/CodexNavigator';
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

/**
 * Navigator App Component
 */
function NavigatorApp() {
  const [codices, setCodices] = useState<Codex[]>([]);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selectedCodexId, setSelectedCodexId] = useState<string | undefined>();

  // Listen for messages from the extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'initialState':
          console.log('[Navigator] Received initialState:', message.payload);
          setCodices(message.payload.codices || []);
          setTemplates(message.payload.templates || []);
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

  return (
    <CodexNavigator
      codices={codices}
      templates={templates}
      selectedCodexId={selectedCodexId}
      onCodexSelect={handleCodexSelect}
      onCodexCreate={handleCodexCreate}
      onCodexDelete={handleCodexDelete}
      onCodexUpdate={handleCodexUpdate}
    />
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
