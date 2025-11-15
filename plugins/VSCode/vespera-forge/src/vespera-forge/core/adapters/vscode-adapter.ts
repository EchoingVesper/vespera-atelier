/**
 * VS Code Platform Adapter
 * Handles VS Code-specific API interactions and webview communication
 */

import { PlatformAdapter, Context, UserRole, WorkflowStage, CollaborationMode, DeviceType } from '../types';

export class VSCodeAdapter implements PlatformAdapter {
  public readonly type = 'vscode' as const;
  public api: any;
  private messageCallbacks: ((message: any) => void)[] = [];

  constructor() {
    // Initialize VS Code API
    this.api = this.acquireVSCodeAPI();
    this.setupMessageHandling();
  }

  private acquireVSCodeAPI(): any {
    // VS Code provides the acquireVsCodeApi function in webview context
    if (typeof window !== 'undefined' && (window as any).acquireVsCodeApi) {
      return (window as any).acquireVsCodeApi();
    }
    
    // Fallback for development/testing
    return {
      postMessage: (message: any) => {
        console.log('VSCode API Mock - postMessage:', message);
      },
      getState: () => ({}),
      setState: (state: any) => {
        console.log('VSCode API Mock - setState:', state);
      }
    };
  }

  private setupMessageHandling(): void {
    if (typeof window !== 'undefined') {
      window.addEventListener('message', (event) => {
        this.messageCallbacks.forEach(callback => callback(event.data));
      });
    }
  }

  sendMessage(message: any): void {
    if (this.api && this.api.postMessage) {
      this.api.postMessage(message);
    }
  }

  onMessage(callback: (message: any) => void): void {
    this.messageCallbacks.push(callback);
  }

  getTheme(): string {
    // VS Code theme detection
    if (typeof document !== 'undefined') {
      const body = document.body;
      if (body.classList.contains('vscode-dark')) {
        return 'dark';
      } else if (body.classList.contains('vscode-light')) {
        return 'light';
      } else if (body.classList.contains('vscode-high-contrast')) {
        return 'high-contrast';
      }
    }
    return 'light';
  }

  async openFile(path: string): Promise<void> {
    this.sendMessage({
      type: 'openFile',
      payload: { path }
    });
  }

  async saveFile(path: string, content: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const messageId = Date.now().toString();
      
      const timeout = setTimeout(() => {
        reject(new Error('Save file timeout'));
      }, 10000);

      const handleResponse = (message: any) => {
        if (message.id === messageId) {
          clearTimeout(timeout);
          this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== handleResponse);
          
          if (message.success) {
            resolve();
          } else {
            reject(new Error(message.error || 'Failed to save file'));
          }
        }
      };

      this.onMessage(handleResponse);
      
      this.sendMessage({
        type: 'saveFile',
        id: messageId,
        payload: { path, content }
      });
    });
  }

  showNotification(message: string, type: 'info' | 'warning' | 'error' = 'info'): void {
    this.sendMessage({
      type: 'showNotification',
      payload: { message, type }
    });
  }

  // VS Code-specific methods
  getWorkspaceFolders(): string[] {
    this.sendMessage({
      type: 'getWorkspaceFolders'
    });
    return [];
  }

  showInformationMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return new Promise((resolve) => {
      const messageId = Date.now().toString();
      
      const handleResponse = (message: any) => {
        if (message.id === messageId) {
          this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== handleResponse);
          resolve(message.result);
        }
      };

      this.onMessage(handleResponse);
      
      this.sendMessage({
        type: 'showInformationMessage',
        id: messageId,
        payload: { message, items }
      });
    });
  }

  showErrorMessage(message: string, ...items: string[]): Promise<string | undefined> {
    return new Promise((resolve) => {
      const messageId = Date.now().toString();
      
      const handleResponse = (message: any) => {
        if (message.id === messageId) {
          this.messageCallbacks = this.messageCallbacks.filter(cb => cb !== handleResponse);
          resolve(message.result);
        }
      };

      this.onMessage(handleResponse);
      
      this.sendMessage({
        type: 'showErrorMessage',
        id: messageId,
        payload: { message, items }
      });
    });
  }

  // Context detection for VS Code
  getCurrentContext(): Context {
    // In a real implementation, this would detect the current context
    // from VS Code workspace, opened files, user settings, etc.
    return {
      role: UserRole.DEVELOPER,
      workflowStage: WorkflowStage.CREATION,
      collaborationMode: CollaborationMode.SOLO,
      deviceType: DeviceType.DESKTOP
    };
  }

  // VS Code webview-specific styling
  applyVSCodeStyling(): void {
    if (typeof document !== 'undefined') {
      // Apply VS Code-specific CSS variables and classes
      document.documentElement.style.setProperty('--vscode-font-family', 'var(--vscode-font-family)');
      document.documentElement.style.setProperty('--vscode-font-size', 'var(--vscode-font-size)');
      document.documentElement.style.setProperty('--vscode-font-weight', 'var(--vscode-font-weight)');
      
      // Add VS Code specific classes
      document.body.classList.add('vscode-webview');
    }
  }

  // Handle VS Code webview lifecycle
  onDidReceiveMessage(callback: (message: any) => void): void {
    this.onMessage(callback);
  }

  postMessage(message: any): void {
    this.sendMessage(message);
  }

  // State management for VS Code webview persistence
  getState(): any {
    return this.api?.getState() || {};
  }

  setState(state: any): void {
    if (this.api?.setState) {
      this.api.setState(state);
    }
  }
}