/**
 * Main chat interface component
 */

import { usePlugin } from '../state/context';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { createUserMessage } from '../state/reducer';
import type { UIToPluginMessage } from '../../shared/messages';
import './ChatInterface.css';

export function ChatInterface() {
  const { state, dispatch } = usePlugin();

  const handleSendMessage = (message: string) => {
    // Add user message to chat
    dispatch({ type: 'ADD_MESSAGE', message: createUserMessage(message) });

    // Try to parse the command
    const parsedMessage = parseCommand(message);

    if (parsedMessage) {
      // Send to plugin backend
      parent.postMessage(parsedMessage, '*');
    } else if (message.toLowerCase().includes('help')) {
      showHelpMessage();
    } else {
      showUnknownCommandMessage();
    }
  };

  /**
   * Parse natural language commands into plugin messages
   */
  function parseCommand(input: string): UIToPluginMessage | null {
    const lower = input.toLowerCase();

    // Success dialog: "create success dialog: message" or "success dialog: message"
    const successMatch = input.match(/(?:create\s+)?success\s+dialog:?\s*(.+)/i);
    if (successMatch) {
      return {
        type: 'create-component',
        templateId: 'success-dialog',
        config: {
          title: 'Success',
          message: successMatch[1].trim(),
          dismissible: true,
        },
      };
    }

    // Error/Warning/Info dialog (legacy support)
    if (lower.includes('error dialog') || lower.includes('warning dialog') || lower.includes('info dialog')) {
      const isWarning = lower.includes('warning');
      const isInfo = lower.includes('info');

      let severity: 'error' | 'warning' | 'info' | 'success' = 'error';
      if (isWarning) severity = 'warning';
      else if (isInfo) severity = 'info';

      return {
        type: 'create-error-dialog',
        config: {
          title: severity.charAt(0).toUpperCase() + severity.slice(1),
          message: 'This is an example message. You can customize this text.',
          severity,
          dismissible: true,
        },
      };
    }

    // Button: "create button: label" or "create button: label (style)"
    const buttonMatch = input.match(/(?:create\s+)?button:?\s*"?([^("]+)"?\s*(?:\((\w+)\))?/i);
    if (buttonMatch) {
      const label = buttonMatch[1].trim();
      const style = (buttonMatch[2]?.toLowerCase() as 'primary' | 'secondary' | 'outlined' | 'text') || 'primary';

      return {
        type: 'create-component',
        templateId: 'primary-button',
        config: {
          label,
          style,
        },
      };
    }

    // Input field: "create input: label" or "create input field: label"
    const inputMatch = input.match(/(?:create\s+)?input(?:\s+field)?:?\s*(.+)/i);
    if (inputMatch) {
      const label = inputMatch[1].trim();

      return {
        type: 'create-component',
        templateId: 'input-field',
        config: {
          label,
          placeholder: `Enter ${label.toLowerCase()}...`,
        },
      };
    }

    // Card: "create card: header | body" or "create card: header | body | footer"
    const cardMatch = input.match(/(?:create\s+)?(?:info\s+)?card:?\s*(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.+))?$/i);
    if (cardMatch) {
      const header = cardMatch[1].trim();
      const body = cardMatch[2].trim();
      const footer = cardMatch[3]?.trim();

      return {
        type: 'create-component',
        templateId: 'info-card',
        config: {
          header,
          body,
          footer,
        },
      };
    }

    return null;
  }

  function showHelpMessage() {
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `help-${Date.now()}`,
        type: 'system',
        content:
          'Available commands:\n\n' +
          'Dialogs:\n' +
          '• "create success dialog: Your message" - Success dialog\n' +
          '• "create error dialog" - Error dialog\n' +
          '• "create warning dialog" - Warning dialog\n' +
          '• "create info dialog" - Info dialog\n\n' +
          'Components:\n' +
          '• "create button: Submit" - Primary button\n' +
          '• "create button: Cancel (secondary)" - Secondary button\n' +
          '• "create input: Email" - Input field\n' +
          '• "create card: Title | Body text" - Info card\n' +
          '• "create card: Title | Body | Footer" - Card with footer\n\n' +
          '• "help" - Shows this message',
        timestamp: new Date(),
      },
    });
  }

  function showUnknownCommandMessage() {
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `unknown-${Date.now()}`,
        type: 'system',
        content:
          'I didn\'t understand that command. Type "help" for available commands.',
        timestamp: new Date(),
      },
    });
  }

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