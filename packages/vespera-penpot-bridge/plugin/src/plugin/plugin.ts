/**
 * Main plugin backend - handles communication with React UI and Penpot API
 */

import type {
  UIToPluginMessage,
  PluginToUIMessage,
  CreateErrorDialogMessage,
} from '../shared/messages';
import { createErrorDialog, validateErrorDialogConfig } from './templates/error-dialog';

// Open the plugin UI
penpot.ui.open('Vespera UI Generator', `?theme=${penpot.theme}`, {
  width: 400,
  height: 600,
});

// Send theme updates to UI
penpot.on('themechange', (theme) => {
  sendMessage({
    type: 'theme-change',
    theme,
  });
});

// Handle messages from UI
penpot.ui.onMessage<UIToPluginMessage>((message) => {
  switch (message.type) {
    case 'create-error-dialog':
      handleCreateErrorDialog(message);
      break;

    case 'create-component':
      sendMessage({
        type: 'error',
        error: 'Generic component creation not yet implemented',
        operation: 'create-component',
      });
      break;

    case 'preview-component':
      sendMessage({
        type: 'error',
        error: 'Component preview not yet implemented',
        operation: 'preview-component',
      });
      break;

    default:
      sendMessage({
        type: 'error',
        error: `Unknown message type: ${(message as { type: string }).type}`,
      });
  }
});

/**
 * Handle error dialog creation request
 */
function handleCreateErrorDialog(message: CreateErrorDialogMessage): void {
  // Send working status
  sendMessage({
    type: 'status',
    status: 'working',
    message: 'Creating error dialog...',
  });

  try {
    // Validate configuration
    const validationError = validateErrorDialogConfig(message.config);
    if (validationError) {
      sendMessage({
        type: 'error',
        error: validationError,
        operation: 'create-error-dialog',
      });
      sendMessage({
        type: 'status',
        status: 'error',
        message: validationError,
      });
      return;
    }

    // Create the dialog
    const config = {
      ...message.config,
      dismissible: message.config.dismissible ?? true,
    };

    const componentId = createErrorDialog(config);

    // Send success message
    sendMessage({
      type: 'operation-result',
      success: true,
      operation: 'create-error-dialog',
      message: 'Error dialog created successfully',
      componentId,
    });

    sendMessage({
      type: 'status',
      status: 'success',
      message: 'Error dialog created!',
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendMessage({
      type: 'error',
      error: `Failed to create error dialog: ${errorMessage}`,
      operation: 'create-error-dialog',
    });
    sendMessage({
      type: 'status',
      status: 'error',
      message: 'Failed to create error dialog',
    });
  }
}

/**
 * Send a message to the UI
 */
function sendMessage(message: PluginToUIMessage): void {
  penpot.ui.sendMessage(message);
}