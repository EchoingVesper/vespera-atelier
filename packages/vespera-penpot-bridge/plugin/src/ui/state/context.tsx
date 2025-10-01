/**
 * React Context for plugin state
 */

import React, { createContext, useContext, useReducer, useEffect, type ReactNode } from 'react';
import type { PluginState, PluginAction } from './reducer';
import { pluginReducer, initialState } from './reducer';
import type { PluginToUIMessage } from '../../shared/messages';
import { isPluginToUIMessage } from '../../shared/messages';

/**
 * Context value shape
 */
interface PluginContextValue {
  state: PluginState;
  dispatch: React.Dispatch<PluginAction>;
}

/**
 * Create the context
 */
const PluginContext = createContext<PluginContextValue | undefined>(undefined);

/**
 * Props for the context provider
 */
interface PluginProviderProps {
  children: ReactNode;
}

/**
 * Context provider component
 */
export function PluginProvider({ children }: PluginProviderProps) {
  const [state, dispatch] = useReducer(pluginReducer, initialState);

  // Listen for messages from the plugin backend
  useEffect(() => {
    const handleMessage = (event: MessageEvent) => {
      // Filter out non-plugin messages (browser extensions, Penpot internals, etc.)
      if (!isPluginToUIMessage(event.data)) {
        // Silently ignore non-plugin messages
        return;
      }

      dispatch({ type: 'HANDLE_PLUGIN_MESSAGE', message: event.data });
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, []);

  // Set initial theme from URL parameter
  useEffect(() => {
    const url = new URL(window.location.href);
    const theme = url.searchParams.get('theme');
    if (theme === 'light' || theme === 'dark') {
      dispatch({ type: 'SET_THEME', theme });
    }
  }, []);

  return (
    <PluginContext.Provider value={{ state, dispatch }}>
      {children}
    </PluginContext.Provider>
  );
}

/**
 * Hook to use the plugin context
 */
export function usePlugin(): PluginContextValue {
  const context = useContext(PluginContext);
  if (context === undefined) {
    throw new Error('usePlugin must be used within a PluginProvider');
  }
  return context;
}