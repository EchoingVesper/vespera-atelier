/**
 * Main chat interface component
 */

import { useEffect } from 'react';
import { usePlugin } from '../state/context';
import { MessageList } from './MessageList';
import { MessageInput } from './MessageInput';
import { TemplateGallery } from './TemplateGallery';
import { createUserMessage } from '../state/reducer';
import type { UIToPluginMessage } from '../../shared/messages';
import './ChatInterface.css';

export function ChatInterface() {
  const { state, dispatch } = usePlugin();

  // Handle Esc key to toggle gallery
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        dispatch({ type: 'TOGGLE_GALLERY' });
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [dispatch]);

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
      // Check for partial matches to provide helpful hints
      showUnknownCommandMessage(message);
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

  function showUnknownCommandMessage(input: string) {
    const lower = input.toLowerCase();
    let hint = '';

    // Detect partial matches and provide specific hints
    if (lower.includes('card') && !input.includes('|')) {
      hint = '\n\n💡 Hint: Cards need the format "create card: Header | Body text"';
    } else if (lower.includes('button') && !input.match(/button:?\s*.+/i)) {
      hint = '\n\n💡 Hint: Buttons need a label, like "create button: Submit"';
    } else if (lower.includes('input') && !input.match(/input(?:\s+field)?:?\s*.+/i)) {
      hint = '\n\n💡 Hint: Input fields need a label, like "create input: Email"';
    } else if (lower.includes('success') && !input.match(/success\s+dialog:?\s*.+/i)) {
      hint = '\n\n💡 Hint: Success dialogs need a message, like "create success dialog: Done!"';
    }

    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `unknown-${Date.now()}`,
        type: 'system',
        content:
          `I didn't understand that command. Type "help" for available commands.${hint}`,
        timestamp: new Date(),
      },
    });
  }

  // Handle template selection from gallery
  const handleSelectTemplate = (templateId: string) => {
    // Create default config based on template type
    let config: Record<string, unknown> = {};

    switch (templateId) {
      case 'error-dialog':
        config = { title: 'Error', message: 'An error occurred', severity: 'error', dismissible: true };
        break;
      case 'success-dialog':
        config = { title: 'Success', message: 'Operation completed successfully', dismissible: true };
        break;
      case 'primary-button':
        config = { label: 'Button', style: 'primary' };
        break;
      case 'input-field':
        config = { label: 'Input Field', placeholder: 'Enter value...' };
        break;
      case 'info-card':
        config = { header: 'Card Title', body: 'Card content goes here' };
        break;
    }

    // Send create message to plugin backend
    parent.postMessage(
      {
        type: templateId === 'error-dialog' ? 'create-error-dialog' : 'create-component',
        templateId,
        config,
      } as UIToPluginMessage,
      '*'
    );

    // Add system message to chat
    dispatch({
      type: 'ADD_MESSAGE',
      message: {
        id: `template-${Date.now()}`,
        type: 'system',
        content: `Creating ${templateId.replace('-', ' ')}...`,
        timestamp: new Date(),
      },
    });
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

      {/* Template Gallery (Esc menu) */}
      {state.isGalleryOpen && (
        <TemplateGallery
          onClose={() => dispatch({ type: 'CLOSE_GALLERY' })}
          onSelectTemplate={handleSelectTemplate}
          theme={state.theme}
        />
      )}
    </div>
  );
}