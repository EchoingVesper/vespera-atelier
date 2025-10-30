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
      console.log('[Editor] Received message:', message.type);

      switch (message.type) {
        case 'setActiveCodex':
          console.log('[Editor] ========== setActiveCodex MESSAGE ==========');
          console.log('[Editor] Full message:', JSON.stringify(message, null, 2));
          console.log('[Editor] Current templates state:', templates.length, 'templates');
          console.log('[Editor] Payload templates:', message.payload.templates?.length || 0, 'templates');

          if (message.payload.codex) {
            const codex = message.payload.codex;
            console.log('[Editor] Codex received:', {
              id: codex.id,
              name: codex.name,
              templateId: codex.templateId,
              hasContent: !!codex.content,
              hasMetadata: !!codex.metadata
            });

            setActiveCodex(codex);

            // Update templates if provided in this message
            const templatesToUse = message.payload.templates || templates;
            if (message.payload.templates && message.payload.templates.length > 0) {
              console.log('[Editor] Updating templates from payload:', message.payload.templates.length, 'templates');
              console.log('[Editor] Template IDs:', message.payload.templates.map((t: any) => t.id));
              setTemplates(message.payload.templates);
            } else {
              console.log('[Editor] Using existing templates:', templates.length);
            }

            // Load template
            if (templatesToUse.length > 0 && codex.templateId) {
              console.log('[Editor] Searching for template with ID:', codex.templateId);
              console.log('[Editor] Available templates:', templatesToUse.map((t: any) => ({ id: t.id, name: t.name })));

              const template = templatesToUse.find((t: any) => t.id === codex.templateId);
              if (template) {
                console.log('[Editor] ✓ Found matching template:', template.name);
                console.log('[Editor] Template has', template.fields?.length || 0, 'fields');
                setActiveTemplate(template);
              } else {
                console.error('[Editor] ✗ No matching template found for ID:', codex.templateId);
                console.error('[Editor] Available template IDs:', templatesToUse.map((t: any) => t.id));
                // Set codex even without template so we can show the error
                setActiveTemplate(undefined);
              }
            } else {
              console.error('[Editor] Cannot load template - templates:', templatesToUse.length, 'templateId:', codex.templateId);
            }
          } else {
            console.error('[Editor] No codex in payload!');
          }
          console.log('[Editor] ========================================');
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
        case 'response':
          // Handle successful save response - update codex with backend data
          if (message.success && message.result) {
            console.log('[Editor] Save response received, updating codex with backend data');
            const updatedData = message.result;

            // Update active codex with backend response
            setActiveCodex(prevCodex => {
              if (!prevCodex) return undefined;

              // Create new codex object maintaining all required fields
              return {
                ...prevCodex,
                name: updatedData.title,  // ✅ Sync name from backend's title field
                metadata: {
                  ...prevCodex.metadata,
                  title: updatedData.title,
                  updated_at: updatedData.updated_at
                },
                content: updatedData.content || prevCodex.content
              } as Codex;
            });

            console.log('[Editor] Codex updated with new title:', updatedData.title);
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

    // Generate message ID for tracking response
    const messageId = `codex-update-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;

    adapter.sendMessage({
      type: 'codex.update',
      id: messageId,
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
