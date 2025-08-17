# User Notification System

## Current Implementation

The current implementation likely uses basic notices or modal dialogs to communicate errors to users. However, a more comprehensive notification system is needed to provide clear, actionable information about errors during document processing.

## Notification System Implementation

### 1. Create a NotificationService Class

```typescript
/**
 * Service for managing user notifications
 */
class NotificationService {
  private static instance: NotificationService;
  
  private activeNotices: Map<string, any> = new Map();
  private settings: any;
  
  /**
   * Gets the singleton instance of the NotificationService
   * @returns NotificationService instance
   */
  public static getInstance(): NotificationService {
    if (!NotificationService.instance) {
      NotificationService.instance = new NotificationService();
    }
    return NotificationService.instance;
  }
  
  /**
   * Initialize the notification service with settings
   * @param settings - Plugin settings
   */
  public initialize(settings: any): void {
    this.settings = settings;
  }
  
  /**
   * Show an informational notice
   * @param message - Message to display
   * @param duration - Duration in milliseconds (0 for persistent)
   * @returns Notice ID for reference
   */
  public showInfo(message: string, duration: number = 4000): string {
    return this.showNotice('info', message, duration);
  }
  
  /**
   * Show a warning notice
   * @param message - Message to display
   * @param duration - Duration in milliseconds (0 for persistent)
   * @returns Notice ID for reference
   */
  public showWarning(message: string, duration: number = 6000): string {
    return this.showNotice('warning', message, duration);
  }
  
  /**
   * Show an error notice
   * @param message - Message to display
   * @param error - Optional error object for details
   * @param duration - Duration in milliseconds (0 for persistent)
   * @returns Notice ID for reference
   */
  public showError(message: string, error?: Error, duration: number = 8000): string {
    // Log the error for debugging
    if (error) {
      console.error(message, error);
    }
    
    // Create a detailed message if an error is provided
    let displayMessage = message;
    if (error && this.settings.showDetailedErrors) {
      displayMessage += `\n${error.message}`;
    }
    
    return this.showNotice('error', displayMessage, duration);
  }
  
  /**
   * Show a notice with progress information
   * @param id - ID for updating existing notice
   * @param message - Message to display
   * @param progress - Progress value (0-100)
   * @returns Notice ID for reference
   */
  public showProgress(id: string | null, message: string, progress: number): string {
    const noticeId = id || `progress-${Date.now()}`;
    
    // Create progress bar HTML
    const progressHtml = `
      <div class="vs-progress-container">
        <div class="vs-progress-bar" style="width: ${progress}%"></div>
        <div class="vs-progress-text">${Math.round(progress)}%</div>
      </div>
      <div class="vs-progress-message">${message}</div>
    `;
    
    // Update or create the notice
    if (id && this.activeNotices.has(id)) {
      this.updateNotice(id, progressHtml);
    } else {
      this.showNotice('progress', progressHtml, 0, noticeId);
    }
    
    return noticeId;
  }
  
  /**
   * Update an existing notice
   * @param id - Notice ID to update
   * @param message - New message to display
   * @returns Success status
   */
  public updateNotice(id: string, message: string): boolean {
    const notice = this.activeNotices.get(id);
    if (!notice) {
      return false;
    }
    
    try {
      // Update the notice content
      const messageEl = notice.noticeEl.querySelector('.notice-message');
      if (messageEl) {
        messageEl.innerHTML = message;
      }
      return true;
    } catch (error) {
      console.error('Error updating notice:', error);
      return false;
    }
  }
  
  /**
   * Close a notice by ID
   * @param id - Notice ID to close
   * @returns Success status
   */
  public closeNotice(id: string): boolean {
    const notice = this.activeNotices.get(id);
    if (!notice) {
      return false;
    }
    
    try {
      // Hide the notice
      notice.hide();
      this.activeNotices.delete(id);
      return true;
    } catch (error) {
      console.error('Error closing notice:', error);
      return false;
    }
  }
  
  /**
   * Show a notice with the specified type
   * @param type - Notice type (info, warning, error, progress)
   * @param message - Message to display
   * @param duration - Duration in milliseconds
   * @param id - Optional ID for reference
   * @returns Notice ID for reference
   */
  private showNotice(type: string, message: string, duration: number, id?: string): string {
    const noticeId = id || `${type}-${Date.now()}`;
    
    // Create the notice
    const notice = new Notice('', duration);
    
    // Add type class
    notice.noticeEl.addClass(`vs-notice-${type}`);
    
    // Create container for message
    const messageEl = notice.noticeEl.createDiv({ cls: 'notice-message' });
    messageEl.innerHTML = message;
    
    // Add action buttons for persistent notices
    if (duration === 0) {
      const actionsEl = notice.noticeEl.createDiv({ cls: 'notice-actions' });
      
      // Add close button
      const closeButton = actionsEl.createEl('button', { cls: 'notice-action-close', text: 'Dismiss' });
      closeButton.addEventListener('click', () => {
        this.closeNotice(noticeId);
      });
      
      // Add more buttons based on type
      if (type === 'error') {
        const detailsButton = actionsEl.createEl('button', { cls: 'notice-action-details', text: 'Details' });
        detailsButton.addEventListener('click', () => {
          // Show error details in a modal
          this.showErrorDetailsModal(noticeId);
        });
      }
    }
    
    // Store the notice for later reference
    this.activeNotices.set(noticeId, notice);
    
    return noticeId;
  }
  
  /**
   * Show a modal with detailed error information
   * @param id - Notice ID for the error
   */
  private showErrorDetailsModal(id: string): void {
    const notice = this.activeNotices.get(id);
    if (!notice || !notice.error) {
      return;
    }
    
    // Create a modal
    const modal = new Modal(app);
    modal.titleEl.setText('Error Details');
    
    // Add error information
    const contentEl = modal.contentEl;
    
    // Error message
    contentEl.createEl('h3', { text: 'Message' });
    contentEl.createEl('p', { text: notice.error.message });
    
    // Stack trace
    if (notice.error.stack) {
      contentEl.createEl('h3', { text: 'Stack Trace' });
      const stackEl = contentEl.createEl('pre', { cls: 'error-stack' });
      stackEl.createEl('code', { text: notice.error.stack });
    }
    
    // Context information
    if (notice.error.context) {
      contentEl.createEl('h3', { text: 'Context' });
      const contextEl = contentEl.createEl('pre', { cls: 'error-context' });
      contextEl.createEl('code', { text: JSON.stringify(notice.error.context, null, 2) });
    }
    
    // Add copy button
    const copyButton = contentEl.createEl('button', { cls: 'mod-cta', text: 'Copy Details' });
    copyButton.addEventListener('click', () => {
      const details = `
Error: ${notice.error.message}
Stack: ${notice.error.stack || 'Not available'}
Context: ${JSON.stringify(notice.error.context || {}, null, 2)}
      `.trim();
      
      navigator.clipboard.writeText(details).then(() => {
        new Notice('Error details copied to clipboard');
      });
    });
    
    // Open the modal
    modal.open();
  }
  
  /**
   * Add CSS styles for notices
   */
  private addStyles(): void {
    const styleEl = document.head.createEl('style');
    styleEl.id = 'vs-notification-styles';
    styleEl.textContent = `
      .vs-notice-info {
        background-color: var(--background-primary);
        border-left: 4px solid var(--interactive-accent);
      }
      
      .vs-notice-warning {
        background-color: var(--background-primary);
        border-left: 4px solid var(--color-yellow);
      }
      
      .vs-notice-error {
        background-color: var(--background-primary);
        border-left: 4px solid var(--color-red);
      }
      
      .vs-notice-progress {
        background-color: var(--background-primary);
        border-left: 4px solid var(--interactive-accent);
      }
      
      .vs-progress-container {
        width: 100%;
        height: 6px;
        background-color: var(--background-modifier-border);
        border-radius: 3px;
        margin-bottom: 5px;
        position: relative;
      }
      
      .vs-progress-bar {
        height: 100%;
        background-color: var(--interactive-accent);
        border-radius: 3px;
        transition: width 0.3s ease;
      }
      
      .vs-progress-text {
        position: absolute;
        right: 5px;
        top: -18px;
        font-size: 10px;
      }
      
      .notice-actions {
        display: flex;
        justify-content: flex-end;
        margin-top: 8px;
      }
      
      .notice-actions button {
        margin-left: 8px;
        padding: 2px 8px;
        font-size: 12px;
      }
      
      .error-stack, .error-context {
        max-height: 200px;
        overflow: auto;
        background-color: var(--background-secondary);
        padding: 8px;
        border-radius: 4px;
      }
    `;
    
    document.head.appendChild(styleEl);
  }
}
```

### 2. Initialize the Notification Service

In the plugin's main file:

```typescript
import { NotificationService } from './services/NotificationService';

// In the plugin's onload method
onload() {
  // Initialize other services...
  
  // Initialize the notification service
  const notificationService = NotificationService.getInstance();
  notificationService.initialize(this.settings);
  
  // Store for later use
  this.notificationService = notificationService;
}
```

### 3. Update Error Handling to Use the Notification Service

Update the error handling in the processing functions:

```typescript
async processChunksWithLLM(chunks: Chunk[], options: ProcessingOptions): Promise<ProcessedDocument | null> {
  // Get the notification service
  const notificationService = NotificationService.getInstance();
  
  // Show progress notification
  const noticeId = notificationService.showProgress(null, `Processing ${options.fileName}...`, 0);
  
  try {
    // Processing logic...
    
    // Update progress as chunks are processed
    for (let i = 0; i < chunks.length; i++) {
      try {
        // Process chunk...
        
        // Update progress
        const progress = Math.round((i + 1) / chunks.length * 100);
        notificationService.showProgress(noticeId, `Processing ${options.fileName}...`, progress);
      } catch (chunkError) {
        // Show error for this chunk
        notificationService.showError(`Error processing chunk ${i+1}/${chunks.length}`, chunkError);
        
        // Record failure and continue...
      }
    }
    
    // Close progress notice
    notificationService.closeNotice(noticeId);
    
    // Show success notice
    notificationService.showInfo(`Successfully processed ${processedChunks.length}/${chunks.length} chunks for ${options.fileName}`);
    
    // Return document...
  } catch (error) {
    // Close progress notice
    notificationService.closeNotice(noticeId);
    
    // Show error notice
    notificationService.showError(`Failed to process ${options.fileName}`, error);
    
    // Handle error...
    return null;
  }
}
```

## Error Categories

Define different categories of errors with appropriate messaging:

### 1. Connection Errors

```typescript
// When LLM connection fails
if (error.message.includes('connection refused') || error.message.includes('network error')) {
  notificationService.showError(
    'Cannot connect to LM Studio. Please make sure it is running and configured correctly.',
    error
  );
  return null;
}
```

### 2. Memory Errors

```typescript
// When memory limit is reached
if (error.message.includes('memory limit exceeded') || error instanceof MemoryLimitError) {
  notificationService.showError(
    'Memory limit reached while processing document. Try processing a smaller document or restarting Obsidian.',
    error
  );
  return null;
}
```

### 3. Processing Errors

```typescript
// When processing fails
notificationService.showError(
  `Error processing document: ${error.message}`,
  error,
  0 // Persistent notification
);
```

## Implementation Steps

1. Create the NotificationService class in a new file
2. Initialize the service in the plugin's onload method
3. Update error handling to use the notification service
4. Add CSS styles for the different notification types
5. Test with different error scenarios to ensure clear, actionable messaging

## Best Practices

1. **Categorize Errors**: Group errors by type for consistent messaging
2. **Clear Actions**: Provide actionable steps to resolve issues
3. **Progress Indication**: Show progress during long-running operations
4. **Persistent Notices**: Use persistent notices for critical errors
5. **Copy Functionality**: Allow users to copy error details for support
6. **Consistent Styling**: Use consistent styling that matches Obsidian's theme
7. **Avoid Alert Fatigue**: Don't show too many notices at once
8. **Context-Sensitive Help**: Link to relevant documentation when appropriate

## Return to [Error Handling](./README.md)
