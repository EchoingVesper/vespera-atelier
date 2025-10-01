/**
 * Main plugin backend - handles communication with React UI and Penpot API
 */

import type {
  PluginToUIMessage,
  CreateErrorDialogMessage,
  CreateComponentMessage,
  PreviewComponentMessage,
} from '../shared/messages';
import { isUIToPluginMessage } from '../shared/messages';
import { createErrorDialog, validateErrorDialogConfig } from './templates/error-dialog';
import { createComponent, getTemplate } from './templates/factory';

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
penpot.ui.onMessage((message: unknown) => {
  // Filter out non-UI messages (echoed messages, Penpot internals, etc.)
  if (!isUIToPluginMessage(message)) {
    // Silently ignore non-UI messages
    return;
  }

  switch (message.type) {
    case 'create-error-dialog':
      handleCreateErrorDialog(message);
      break;

    case 'create-component':
      handleCreateComponent(message);
      break;

    case 'preview-component':
      handlePreviewComponent(message);
      break;

    default:
      // This should never happen if type guard is working correctly
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
 * Handle generic component creation request
 */
function handleCreateComponent(message: CreateComponentMessage): void {
  // Send working status
  sendMessage({
    type: 'status',
    status: 'working',
    message: `Creating ${message.templateId}...`,
  });

  try {
    // Verify template exists
    const template = getTemplate(message.templateId);
    if (!template) {
      throw new Error(`Unknown template: ${message.templateId}`);
    }

    // Create the component using the factory
    const componentId = createComponent(message.templateId, message.config);

    // Send success message
    sendMessage({
      type: 'operation-result',
      success: true,
      operation: 'create-component',
      message: `${template.name} created successfully`,
      componentId,
    });

    sendMessage({
      type: 'status',
      status: 'success',
      message: `${template.name} created!`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendMessage({
      type: 'error',
      error: `Failed to create component: ${errorMessage}`,
      operation: 'create-component',
    });
    sendMessage({
      type: 'status',
      status: 'error',
      message: 'Failed to create component',
    });
  }
}

/**
 * Handle component preview request
 */
function handlePreviewComponent(message: PreviewComponentMessage): void {
  // For Phase 2, we'll implement a simple preview that just returns template info
  // In Phase 3, we could generate actual thumbnails or more detailed previews
  try {
    const template = getTemplate(message.templateId);
    if (!template) {
      throw new Error(`Unknown template: ${message.templateId}`);
    }

    sendMessage({
      type: 'operation-result',
      success: true,
      operation: 'preview-component',
      message: `Preview for ${template.name}`,
    });
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error);
    sendMessage({
      type: 'error',
      error: `Failed to preview component: ${errorMessage}`,
      operation: 'preview-component',
    });
  }
}

/**
 * Send a message to the UI
 */
function sendMessage(message: PluginToUIMessage): void {
  penpot.ui.sendMessage(message);
}