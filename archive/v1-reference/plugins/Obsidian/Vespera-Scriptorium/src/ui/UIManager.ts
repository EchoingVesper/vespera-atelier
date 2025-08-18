import { App, Modal, Notice, Plugin } from 'obsidian';
import { StyleManager } from './StyleManager';

/**
 * Sample modal for demonstration purposes
 */
export class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.setText('This is a sample modal!');
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}

/**
 * Manages UI components for the plugin
 */
export class UIManager {
  private app: App;
  private plugin: Plugin;
  private styleManager: StyleManager;

  /**
   * Create a new UIManager
   * @param app Obsidian app instance
   * @param plugin Plugin instance
   * @param pluginManifestDir Plugin manifest directory
   */
  constructor(app: App, plugin: Plugin, pluginManifestDir: string) {
    this.app = app;
    this.plugin = plugin;
    this.styleManager = new StyleManager(app, pluginManifestDir);
  }

  /**
   * Initialize UI components
   */
  async initialize(): Promise<void> {
    try {
      await this.styleManager.loadStyles();
      console.log('UI Manager initialized successfully');
    } catch (error) {
      console.error('Error initializing UI Manager:', error);
    }
  }

  /**
   * Clean up UI components
   */
  cleanup(): void {
    this.styleManager.removeStyles();
  }

  /**
   * Show a notice with the given message
   * @param message Message to display
   * @param timeout Timeout in milliseconds
   */
  showNotice(message: string, timeout: number = 3000): void {
    new Notice(message, timeout);
  }

  /**
   * Show an error notice
   * @param message Error message to display
   * @param timeout Timeout in milliseconds
   */
  showError(message: string, timeout: number = 5000): void {
    const notice = new Notice(`Error: ${message}`, timeout);
    notice.noticeEl.addClass('vespera-error-notice');
  }

  /**
   * Show a success notice
   * @param message Success message to display
   * @param timeout Timeout in milliseconds
   */
  showSuccess(message: string, timeout: number = 3000): void {
    const notice = new Notice(`Success: ${message}`, timeout);
    notice.noticeEl.addClass('vespera-success-notice');
  }

  /**
   * Open a modal
   * @param modal Modal to open
   */
  openModal(modal: Modal): void {
    modal.open();
  }

  /**
   * Create and open a sample modal
   */
  openSampleModal(): void {
    const modal = new SampleModal(this.app);
    this.openModal(modal);
  }
}