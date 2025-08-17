// src/error-handling/ErrorView.ts

import { ItemView, WorkspaceLeaf, setIcon } from 'obsidian';
import { VesperaError, ErrorSeverity, ErrorType } from '../utils/ErrorHandler';
import { ErrorReporter, ErrorReportingChannel } from './ErrorReporter';

// View type for the error view
export const ERROR_VIEW_TYPE = 'vespera-error-view';

/**
 * @class UIReportingChannel
 * Reports errors to a dedicated UI view in Obsidian.
 */
export class UIReportingChannel implements ErrorReportingChannel {
  private enabled: boolean = true;
  private errorView: ErrorView | null = null;
  
  /**
   * Report an error to the UI view.
   * 
   * @param error The error to report.
   */
  public report(error: VesperaError): void {
    if (!this.enabled || !this.errorView) return;
    
    this.errorView.addError(error);
    this.errorView.requestReveal();
  }
  
  /**
   * Enable or disable UI reporting.
   * 
   * @param enabled Whether UI reporting should be enabled.
   */
  public setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }
  
  /**
   * Check if UI reporting is enabled.
   * 
   * @returns Whether UI reporting is enabled.
   */
  public isEnabled(): boolean {
    return this.enabled;
  }
  
  /**
   * Set the error view for this channel.
   * 
   * @param view The error view.
   */
  public setErrorView(view: ErrorView): void {
    this.errorView = view;
  }
}

/**
 * @class ErrorView
 * A dedicated view for displaying errors in the Obsidian UI.
 */
export class ErrorView extends ItemView {
  private errors: VesperaError[] = [];
  private maxErrors: number = 100;
  private uiReportingChannel: UIReportingChannel;
  
  constructor(leaf: WorkspaceLeaf) {
    super(leaf);
    
    // Create and register the UI reporting channel
    this.uiReportingChannel = new UIReportingChannel();
    this.uiReportingChannel.setErrorView(this);
    ErrorReporter.getInstance().registerChannel('ui', this.uiReportingChannel);
  }
  
  /**
   * Get the type of this view.
   */
  public getViewType(): string {
    return ERROR_VIEW_TYPE;
  }
  
  /**
   * Get the display text for this view.
   */
  public getDisplayText(): string {
    return 'Error Log';
  }
  
  /**
   * Get the icon for this view.
   */
  public getIcon(): string {
    return 'alert-triangle';
  }
  
  /**
   * Add an error to the view.
   * 
   * @param error The error to add.
   */
  public addError(error: VesperaError): void {
    this.errors.unshift(error); // Add to the beginning for newest-first order
    
    // Trim error list if needed
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
    }
    
    this.renderErrors();
  }
  
  /**
   * Clear all errors from the view.
   */
  public clearErrors(): void {
    this.errors = [];
    this.renderErrors();
  }
  
  /**
   * Set the maximum number of errors to display.
   * 
   * @param max The maximum number of errors.
   */
  public setMaxErrors(max: number): void {
    this.maxErrors = max;
    
    // Trim error list if needed
    if (this.errors.length > this.maxErrors) {
      this.errors = this.errors.slice(0, this.maxErrors);
      this.renderErrors();
    }
  }
  
  /**
   * Request that this view be revealed in the UI.
   */
  public requestReveal(): void {
    this.leaf.setEphemeralState({ active: true });
  }
  
  /**
   * Render the view's content.
   */
  protected async onOpen(): Promise<void> {
    const container = this.containerEl.children[1];
    container.empty();
    container.createEl('h2', { text: 'Error Log' });
    
    // Add clear button
    const headerDiv = container.createDiv({ cls: 'error-view-header' });
    const clearButton = headerDiv.createEl('button', { text: 'Clear All' });
    clearButton.addEventListener('click', () => this.clearErrors());
    
    // Create errors container
    container.createDiv({ cls: 'error-view-container' });
    
    this.renderErrors();
  }
  
  /**
   * Render the errors in the view.
   */
  private renderErrors(): void {
    const container = this.containerEl.querySelector('.error-view-container');
    if (!container) return;
    
    container.empty();
    
    if (this.errors.length === 0) {
      container.createEl('p', { text: 'No errors to display.' });
      return;
    }
    
    // Create error list
    const errorList = container.createEl('div', { cls: 'error-list' });
    
    for (const error of this.errors) {
      const errorEl = errorList.createEl('div', { cls: `error-item error-severity-${error.severity}` });
      
      // Header with timestamp, severity, and type
      const header = errorEl.createEl('div', { cls: 'error-header' });
      
      // Timestamp
      header.createEl('span', { 
        cls: 'error-timestamp',
        text: error.timestamp.toLocaleTimeString()
      });
      
      // Severity badge
      header.createEl('span', { 
        cls: `error-severity error-severity-${error.severity}`,
        text: error.severity.toUpperCase()
      });
      
      // Type badge
      header.createEl('span', { 
        cls: 'error-type',
        text: error.type
      });
      
      // Message
      errorEl.createEl('div', { 
        cls: 'error-message',
        text: error.message
      });
      
      // Source information if available
      if (error.details?.source) {
        const source = error.details.source;
        const sourceEl = errorEl.createEl('div', { cls: 'error-source' });
        sourceEl.createEl('span', { 
          cls: 'error-source-label',
          text: 'Source:'
        });
        sourceEl.createEl('span', { 
          cls: 'error-source-value',
          text: `${source.component}.${source.operation}`
        });
      }
      
      // Stack trace or additional details (collapsible)
      if (error.details?.originalError?.stack) {
        const detailsContainer = errorEl.createEl('details', { cls: 'error-details' });
        detailsContainer.createEl('summary', { text: 'Stack Trace' });
        detailsContainer.createEl('pre', { 
          cls: 'error-stack',
          text: error.details.originalError.stack
        });
      }
    }
  }
}

/**
 * Register the error view with Obsidian.
 * 
 * @param plugin The Vespera plugin instance.
 */
export function registerErrorView(plugin: any): void {
  // Register the view type
  plugin.registerView(
    ERROR_VIEW_TYPE,
    (leaf: WorkspaceLeaf) => new ErrorView(leaf)
  );
  
  // Add a command to open the error view
  plugin.addCommand({
    id: 'open-error-log',
    name: 'Open Error Log',
    callback: async () => {
      // If the view is already open, activate it
      const leaves = plugin.app.workspace.getLeavesOfType(ERROR_VIEW_TYPE);
      if (leaves.length > 0) {
        plugin.app.workspace.revealLeaf(leaves[0]);
        return;
      }
      
      // Otherwise, create a new leaf and open the view
      await plugin.app.workspace.getRightLeaf(false).setViewState({
        type: ERROR_VIEW_TYPE,
        active: true,
      });
    },
  });
  
  // Add a ribbon icon to open the error view
  const ribbonIconEl = plugin.addRibbonIcon(
    'alert-triangle',
    'Open Error Log',
    async () => {
      plugin.app.commands.executeCommandById('vespera-scriptorium:open-error-log');
    }
  );
}