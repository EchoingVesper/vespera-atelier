/**
 * React Editor Entry Point
 * Renders the Editor + AI Assistant in a two-panel layout
 */
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { VSCodeAdapter } from '@/vespera-forge/core/adapters/vscode-adapter';
import { CodexEditor } from '@/vespera-forge/components/editor/CodexEditor';
import { Codex, Template, Context } from '@/vespera-forge/core/types';
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
 * Shows only the CodexEditor (AI Assistant is in a separate sidebar panel)
 */
function EditorApp() {
  const [activeCodex, setActiveCodex] = useState<Codex | undefined>();
  const [activeTemplate, setActiveTemplate] = useState<Template | undefined>();
  const [templates, setTemplates] = useState<Template[]>([]);

  const context: Context = adapter.getCurrentContext();

  // Listen for active codex changes from the extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'setActiveCodex':
          console.log('[Editor] Received setActiveCodex message:', JSON.stringify(message, null, 2));
          console.log('[Editor] Current templates state:', templates);
          console.log('[Editor] Payload templates:', message.payload.templates);

          if (message.payload.codex) {
            console.log('[Editor] Setting active codex:', message.payload.codex);
            setActiveCodex(message.payload.codex);

            // Update templates if provided in this message
            const templatesToUse = message.payload.templates || templates;
            if (message.payload.templates) {
              console.log('[Editor] Updating templates from payload:', message.payload.templates);
              setTemplates(message.payload.templates);
            }

            // Load template
            if (templatesToUse.length > 0 && message.payload.codex.templateId) {
              console.log('[Editor] Looking for template with ID:', message.payload.codex.templateId);
              console.log('[Editor] Available templates:', templatesToUse.map((t: any) => ({ id: t.id, name: t.name })));
              const template = templatesToUse.find((t: any) => t.id === message.payload.codex.templateId);
              if (template) {
                console.log('[Editor] Found matching template:', template.name);
                setActiveTemplate(template);
              } else {
                console.warn('[Editor] No matching template found for ID:', message.payload.codex.templateId);
              }
            } else {
              console.warn('[Editor] Cannot load template - templates:', templatesToUse.length, 'templateId:', message.payload.codex.templateId);
            }
          }
          break;
        case 'initialState':
          console.log('[Editor] Initial state received:', message.payload);
          if (message.payload.templates) {
            setTemplates(message.payload.templates);
          }
          if (message.payload.codex) {
            setActiveCodex(message.payload.codex);
            // Load template
            if (message.payload.templates && message.payload.codex.templateId) {
              const template = message.payload.templates.find((t: Template) => t.id === message.payload.codex.templateId);
              if (template) {
                setActiveTemplate(template);
              }
            }
          }
          break;
        case 'error':
          console.error('[Editor] Error from extension:', message.error);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, [templates]);

  const handleCodexUpdate = useCallback(async (codex: Codex) => {
    setActiveCodex(codex);
    adapter.sendMessage({
      type: 'codex.update',
      payload: codex
    });
  }, []);

  return (
    <div className="h-screen w-full overflow-hidden bg-background text-foreground">
      <CodexEditor
        codex={activeCodex}
        template={activeTemplate}
        context={context}
        onCodexUpdate={handleCodexUpdate}
        platformAdapter={adapter}
      />
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
