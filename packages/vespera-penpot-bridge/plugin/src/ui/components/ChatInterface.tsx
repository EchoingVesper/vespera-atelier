/**
 * Main chat interface component
 */

import { usePlugin } from '../state/context';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { createUserMessage } from '../state/reducer';
import type { CreateErrorDialogMessage } from '../../shared/messages';
import './ChatInterface.css';

export function ChatInterface() {
  const { state, dispatch } = usePlugin();

  const handleSendMessage = (message: string) => {
    // Add user message to chat
    dispatch({ type: 'ADD_MESSAGE', message: createUserMessage(message) });

    // Simple keyword matching for now (Phase 1)
    const lowerMessage = message.toLowerCase();

    if (lowerMessage.includes('create error dialog') || lowerMessage.includes('error dialog')) {
      // Parse basic parameters or use defaults
      const isWarning = lowerMessage.includes('warning');
      const isInfo = lowerMessage.includes('info');
      const isSuccess = lowerMessage.includes('success');

      let severity: 'error' | 'warning' | 'info' | 'success' = 'error';
      if (isWarning) severity = 'warning';
      else if (isInfo) severity = 'info';
      else if (isSuccess) severity = 'success';

      const pluginMessage: CreateErrorDialogMessage = {
        type: 'create-error-dialog',
        config: {
          title: 'Error Dialog',
          message: 'This is an example error message. You can customize this text.',
          severity,
          dismissible: true,
        },
      };

      // Send to plugin backend
      parent.postMessage(pluginMessage, '*');
    } else if (lowerMessage.includes('help')) {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: `help-${Date.now()}`,
          type: 'system',
          content:
            'Available commands:\n' +
            '• "create error dialog" - Creates an error dialog\n' +
            '• "create warning dialog" - Creates a warning dialog\n' +
            '• "create info dialog" - Creates an info dialog\n' +
            '• "create success dialog" - Creates a success dialog\n' +
            '• "help" - Shows this help message',
          timestamp: new Date(),
        },
      });
    } else {
      dispatch({
        type: 'ADD_MESSAGE',
        message: {
          id: `unknown-${Date.now()}`,
          type: 'system',
          content:
            'I didn\'t understand that command. Try "create error dialog" or type "help" for available commands.',
          timestamp: new Date(),
        },
      });
    }
  };

  return (
    <div className="chat-interface" data-theme={state.theme}>
      <div className="chat-header">
        <h2>Vespera UI Generator</h2>
        {state.status !== 'idle' && (
          <div className={`status-indicator status-${state.status}`}>
            {state.statusMessage || state.status}
          </div>
        )}
      </div>
      <MessageList messages={state.messages} />
      <MessageInput
        onSubmit={handleSendMessage}
        disabled={state.status === 'working'}
      />
    </div>
  );
}