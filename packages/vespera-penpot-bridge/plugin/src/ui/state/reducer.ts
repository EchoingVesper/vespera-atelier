/**
 * State management for the plugin UI
 */

import type { PluginToUIMessage } from '../../shared/messages';

/**
 * Message in the chat interface
 */
export interface ChatMessage {
  id: string;
  type: 'user' | 'system' | 'error' | 'success';
  content: string;
  timestamp: Date;
}

/**
 * Application state
 */
export interface PluginState {
  theme: 'light' | 'dark';
  messages: ChatMessage[];
  status: 'idle' | 'working' | 'success' | 'error';
  statusMessage?: string;
  isGalleryOpen: boolean;
}

/**
 * Actions that can modify state
 */
export type PluginAction =
  | { type: 'SET_THEME'; theme: 'light' | 'dark' }
  | { type: 'ADD_MESSAGE'; message: ChatMessage }
  | { type: 'SET_STATUS'; status: PluginState['status']; message?: string }
  | { type: 'HANDLE_PLUGIN_MESSAGE'; message: PluginToUIMessage }
  | { type: 'TOGGLE_GALLERY' }
  | { type: 'CLOSE_GALLERY' };

/**
 * Initial state
 */
export const initialState: PluginState = {
  theme: 'light',
  messages: [
    {
      id: '1',
      type: 'system',
      content: 'Welcome to Vespera UI Generator! Press Esc to open the template gallery, or type commands like "create error dialog".',
      timestamp: new Date(),
    },
  ],
  status: 'idle',
  isGalleryOpen: false,
};

/**
 * Generate a unique message ID
 */
function generateMessageId(): string {
  return `msg-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Reducer function for state updates
 */
export function pluginReducer(state: PluginState, action: PluginAction): PluginState {
  switch (action.type) {
    case 'SET_THEME':
      return {
        ...state,
        theme: action.theme,
      };

    case 'ADD_MESSAGE':
      return {
        ...state,
        messages: [...state.messages, action.message],
      };

    case 'SET_STATUS':
      return {
        ...state,
        status: action.status,
        statusMessage: action.message,
      };

    case 'TOGGLE_GALLERY':
      return {
        ...state,
        isGalleryOpen: !state.isGalleryOpen,
      };

    case 'CLOSE_GALLERY':
      return {
        ...state,
        isGalleryOpen: false,
      };

    case 'HANDLE_PLUGIN_MESSAGE': {
      const { message } = action;

      switch (message.type) {
        case 'theme-change':
          return {
            ...state,
            theme: message.theme,
          };

        case 'operation-result': {
          const newMessage: ChatMessage = {
            id: generateMessageId(),
            type: message.success ? 'success' : 'error',
            content: message.message || (message.success ? 'Operation completed' : 'Operation failed'),
            timestamp: new Date(),
          };
          return {
            ...state,
            messages: [...state.messages, newMessage],
            status: message.success ? 'success' : 'error',
          };
        }

        case 'error': {
          const newMessage: ChatMessage = {
            id: generateMessageId(),
            type: 'error',
            content: `Error: ${message.error}`,
            timestamp: new Date(),
          };
          return {
            ...state,
            messages: [...state.messages, newMessage],
            status: 'error',
          };
        }

        case 'status':
          return {
            ...state,
            status: message.status,
            statusMessage: message.message,
          };

        default:
          return state;
      }
    }

    default:
      return state;
  }
}

/**
 * Helper to create a user message
 */
export function createUserMessage(content: string): ChatMessage {
  return {
    id: generateMessageId(),
    type: 'user',
    content,
    timestamp: new Date(),
  };
}

/**
 * Helper to create a system message
 */
export function createSystemMessage(content: string): ChatMessage {
  return {
    id: generateMessageId(),
    type: 'system',
    content,
    timestamp: new Date(),
  };
}