/**
 * React AI Assistant Entry Point
 * Renders only the AI Assistant for the right sidebar view
 */
import React, { useState, useCallback } from 'react';
import { createRoot } from 'react-dom/client';
import { VSCodeAdapter } from '@/vespera-forge/core/adapters/vscode-adapter';
import { AIAssistant } from '@/vespera-forge/components/ai/AIAssistant';
import { AIAssistant as AIAssistantType, Codex, Template, Context } from '@/vespera-forge/core/types';
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

// Default assistants
function getDefaultAssistants(): AIAssistantType[] {
  return [
    {
      id: 'general-assistant',
      name: 'Vespera Assistant',
      personality: {
        tone: 'friendly',
        expertise: 'expert',
        communicationStyle: 'detailed'
      },
      expertise: ['content creation', 'organization', 'productivity'],
      templateIds: [],
      contexts: ['creation', 'review', 'planning'],
      config: {
        model: 'gpt-4',
        temperature: 0.7,
        maxTokens: 1000,
        systemPrompt: 'You are a helpful assistant for content creation and organization.'
      }
    }
  ];
}

/**
 * AI Assistant App Component
 */
function AIAssistantApp() {
  const [assistants] = useState<AIAssistantType[]>(getDefaultAssistants());
  const [currentAssistant, setCurrentAssistant] = useState<AIAssistantType>(assistants[0]);
  const [activeCodex, setActiveCodex] = useState<Codex | undefined>();
  const [activeTemplate, setActiveTemplate] = useState<Template | undefined>();

  const context: Context = adapter.getCurrentContext();

  // Listen for active codex changes from the extension
  React.useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      switch (message.type) {
        case 'setActiveCodex':
          // TODO: Load actual codex data
          console.log('Active codex changed:', message.payload.codexId);
          break;
        case 'initialState':
          // TODO: Load initial state
          console.log('Initial state received:', message.payload);
          break;
      }
    };

    window.addEventListener('message', handleMessage);
    return () => window.removeEventListener('message', handleMessage);
  }, []);

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
  }, []);

  return (
    <div className="h-full w-full">
      <AIAssistant
        assistants={assistants}
        currentAssistant={currentAssistant}
        activeCodex={activeCodex}
        activeTemplate={activeTemplate}
        context={context}
        onAssistantChange={setCurrentAssistant}
        onSendMessage={handleAIMessage}
      />
    </div>
  );
}

/**
 * Initialize the AI Assistant
 */
function initializeAIAssistant(): void {
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
      <AIAssistantApp />
    </React.StrictMode>
  );

  // Notify extension that AI assistant is ready
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

  console.log('AI Assistant initialized successfully');
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeAIAssistant);
} else {
  initializeAIAssistant();
}
