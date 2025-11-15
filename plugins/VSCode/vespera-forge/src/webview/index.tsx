/**
 * React Webview Entry Point
 * Initializes the Vespera Forge UI framework in VS Code webview context
 */
import React from 'react';
import { createRoot } from 'react-dom/client';
import { VesperaForge } from '@/vespera-forge/components/core/VesperaForge';
import { VSCodeAdapter } from '@/vespera-forge/core/adapters/vscode-adapter';
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

/**
 * Initialize the Vespera Forge UI
 */
function initializeVesperaForge(): void {
  // Get or create root element
  const rootElement = document.getElementById('root');
  if (!rootElement) {
    console.error('Root element not found');
    return;
  }

  // Create platform adapter for VS Code
  const adapter = new VSCodeAdapter();

  // Apply VS Code-specific styling
  adapter.applyVSCodeStyling();

  // Create React root and render
  const root = createRoot(rootElement);

  root.render(
    <React.StrictMode>
      <VesperaForge platformAdapter={adapter} />
    </React.StrictMode>
  );

  // Notify extension that webview is ready
  adapter.sendMessage({ type: 'ready' });

  // Listen for theme changes
  const observer = new MutationObserver(() => {
    const newTheme = adapter.getTheme();
    // Update document class for theme
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

  // Set initial theme
  const initialTheme = adapter.getTheme();
  if (initialTheme === 'dark') {
    document.documentElement.classList.add('dark');
  }

  console.log('Vespera Forge initialized successfully', {
    platform: adapter.type,
    theme: initialTheme
  });
}

// Initialize when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeVesperaForge);
} else {
  initializeVesperaForge();
}
