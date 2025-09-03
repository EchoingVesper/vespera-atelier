/**
 * Vespera Forge - Enhanced Base Disposable Classes
 * 
 * Base classes with standardized disposal patterns, error handling,
 * and enhanced lifecycle management.
 */

import * as vscode from 'vscode';
import { VesperaLogger } from '../logging/VesperaLogger';
import { VesperaMemoryError, VesperaErrorCode } from '../error-handling/VesperaErrors';
import { VesperaErrorHandler } from '../error-handling/VesperaErrorHandler';
import { DisposalManager, EnhancedDisposable } from './DisposalManager';

/**
 * Abstract base class for all disposable resources with standardized patterns
 */
export abstract class BaseDisposable implements EnhancedDisposable {
  private _disposed = false;
  private _disposing = false;
  protected logger: VesperaLogger;
  public readonly disposalPriority: number = 0;
  private readonly createdAt: number;

  constructor(logger?: VesperaLogger, disposalPriority?: number) {
    this.logger = logger || VesperaLogger.getInstance();
    this.disposalPriority = disposalPriority || 0;
    this.createdAt = Date.now();
  }

  /**
   * Dispose the resource with error handling and lifecycle management
   */
  public async dispose(): Promise<void> {
    if (this._disposed || this._disposing) {
      return;
    }

    this._disposing = true;
    const startTime = Date.now();
    
    try {
      await this.onDispose();
      this._disposed = true;
      
      const disposalTime = Date.now() - startTime;
      this.logger.debug(`${this.constructor.name} disposed successfully`, {
        disposalTime,
        lifetime: Date.now() - this.createdAt,
        priority: this.disposalPriority
      });
    } catch (error) {
      const vesperaError = new VesperaMemoryError(
        `Failed to dispose ${this.constructor.name}`,
        VesperaErrorCode.RESOURCE_DISPOSAL_FAILED,
        { 
          context: { 
            className: this.constructor.name,
            priority: this.disposalPriority,
            lifetime: Date.now() - this.createdAt
          } 
        },
        error instanceof Error ? error : new Error(String(error))
      );
      
      this._disposed = true; // Mark as disposed even on error to prevent retry loops
      this._disposing = false;
      
      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      throw vesperaError;
    } finally {
      this._disposing = false;
    }
  }

  /**
   * Template method for subclasses to implement disposal logic
   */
  protected abstract onDispose(): void | Promise<void>;

  /**
   * Check if disposal is in progress
   */
  public get isDisposing(): boolean {
    return this._disposing;
  }

  /**
   * Check if resource has been disposed
   */
  public get isDisposed(): boolean {
    return this._disposed;
  }

  /**
   * Get resource lifetime in milliseconds
   */
  public get lifetime(): number {
    return Date.now() - this.createdAt;
  }

  /**
   * Get creation timestamp
   */
  public get createdTimestamp(): number {
    return this.createdAt;
  }

  /**
   * Ensure resource is not disposed before operation
   */
  protected ensureNotDisposed(operation: string = 'operation'): void {
    if (this._disposed) {
      throw new Error(`Cannot perform ${operation} on disposed ${this.constructor.name}`);
    }
  }
}

/**
 * Enhanced WebView Provider Base with standardized disposal and lifecycle management
 */
export abstract class BaseWebViewProvider extends BaseDisposable implements vscode.WebviewViewProvider {
  protected webviewView?: vscode.WebviewView;
  protected disposalManager: DisposalManager;
  private messageHandlerDisposable?: vscode.Disposable;

  constructor(
    protected context: vscode.ExtensionContext,
    logger?: VesperaLogger,
    disposalPriority: number = 100 // High priority for UI components
  ) {
    super(logger, disposalPriority);
    this.disposalManager = new DisposalManager(this.logger);
  }

  /**
   * VS Code WebviewViewProvider interface implementation
   */
  public resolveWebviewView(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void> {
    this.ensureNotDisposed('webview resolution');
    
    this.webviewView = webviewView;
    
    // Setup webview with security and resource handling
    webviewView.webview.options = {
      enableScripts: true,
      localResourceRoots: [this.context.extensionUri]
    };

    // Add webview to disposal management
    this.disposalManager.add({
      dispose: () => {
        if (this.messageHandlerDisposable) {
          this.messageHandlerDisposable.dispose();
          this.messageHandlerDisposable = undefined;
        }
        if (this.webviewView) {
          this.webviewView = undefined;
        }
      },
      isDisposed: false
    } as EnhancedDisposable);

    this.logger.debug(`${this.constructor.name} webview resolved`);

    return this.setupWebview(webviewView, context, token);
  }

  /**
   * Template method for subclasses to setup webview-specific functionality
   */
  protected abstract setupWebview(
    webviewView: vscode.WebviewView,
    context: vscode.WebviewViewResolveContext,
    token: vscode.CancellationToken
  ): void | Thenable<void>;

  /**
   * Safely register message handler with disposal tracking
   */
  protected registerMessageHandler(
    handler: (message: any) => void | Promise<void>
  ): void {
    this.ensureNotDisposed('message handler registration');
    
    if (!this.webviewView) {
      throw new Error('Cannot register message handler before webview is resolved');
    }

    // Dispose existing handler if any
    if (this.messageHandlerDisposable) {
      this.messageHandlerDisposable.dispose();
    }

    // Wrap handler with error handling
    const wrappedHandler = async (message: any) => {
      try {
        await handler(message);
      } catch (error) {
        const vesperaError = new VesperaMemoryError(
          `WebView message handler error in ${this.constructor.name}`,
          VesperaErrorCode.WEBVIEW_MESSAGE_FAILED,
          { 
            context: { 
              messageType: message?.type, 
              className: this.constructor.name 
            } 
          },
          error instanceof Error ? error : new Error(String(error))
        );

        await VesperaErrorHandler.getInstance().handleError(vesperaError);
      }
    };

    this.messageHandlerDisposable = this.webviewView.webview.onDidReceiveMessage(wrappedHandler);
    
    // Track the disposable
    this.disposalManager.add({
      dispose: () => {
        if (this.messageHandlerDisposable) {
          this.messageHandlerDisposable.dispose();
          this.messageHandlerDisposable = undefined;
        }
      },
      isDisposed: false
    } as EnhancedDisposable);

    this.logger.debug(`Message handler registered for ${this.constructor.name}`);
  }

  /**
   * Safely post message to webview
   */
  protected async postMessage(message: any): Promise<boolean> {
    this.ensureNotDisposed('message posting');
    
    if (!this.webviewView) {
      this.logger.warn(`Cannot post message to ${this.constructor.name}: webview not resolved`);
      return false;
    }

    try {
      await this.webviewView.webview.postMessage(message);
      return true;
    } catch (error) {
      const vesperaError = new VesperaMemoryError(
        `Failed to post message to ${this.constructor.name}`,
        VesperaErrorCode.WEBVIEW_MESSAGE_FAILED,
        { 
          context: { 
            messageType: message?.type, 
            className: this.constructor.name 
          } 
        },
        error instanceof Error ? error : new Error(String(error))
      );

      await VesperaErrorHandler.getInstance().handleError(vesperaError);
      return false;
    }
  }

  /**
   * Get webview HTML with resource URI resolution
   */
  protected getWebviewUri(...pathSegments: string[]): vscode.Uri {
    if (!this.webviewView) {
      throw new Error('Cannot get webview URI before webview is resolved');
    }

    return this.webviewView.webview.asWebviewUri(
      vscode.Uri.joinPath(this.context.extensionUri, ...pathSegments)
    );
  }

  /**
   * Base disposal implementation
   */
  protected async onDispose(): Promise<void> {
    this.logger.debug(`Disposing ${this.constructor.name} webview provider`);

    // Dispose the disposal manager (which handles all tracked resources)
    await this.disposalManager.dispose();
    
    // Clear webview reference
    this.webviewView = undefined;
    this.messageHandlerDisposable = undefined;

    this.logger.debug(`${this.constructor.name} webview provider disposed`);
  }

  /**
   * Get provider statistics
   */
  public getStats(): {
    isResolved: boolean;
    hasMessageHandler: boolean;
    managedResources: number;
    lifetime: number;
  } {
    return {
      isResolved: !!this.webviewView,
      hasMessageHandler: !!this.messageHandlerDisposable,
      managedResources: this.disposalManager.count,
      lifetime: this.lifetime
    };
  }
}

/**
 * Enhanced Service Base with dependency injection and lifecycle management
 */
export abstract class BaseService extends BaseDisposable {
  private serviceStartTime?: number;
  private _isRunning = false;

  constructor(
    logger?: VesperaLogger,
    disposalPriority: number = 50 // Medium priority for services
  ) {
    super(logger, disposalPriority);
  }

  /**
   * Start the service
   */
  public async start(): Promise<void> {
    this.ensureNotDisposed('service start');

    if (this._isRunning) {
      this.logger.warn(`Service ${this.constructor.name} already running`);
      return;
    }

    this.serviceStartTime = Date.now();
    this.logger.info(`Starting service: ${this.constructor.name}`);

    try {
      await this.onStart();
      this._isRunning = true;
      this.logger.info(`Service started: ${this.constructor.name}`, {
        startTime: Date.now() - this.serviceStartTime
      });
    } catch (error) {
      this.logger.error(`Failed to start service: ${this.constructor.name}`, error);
      throw error;
    }
  }

  /**
   * Stop the service
   */
  public async stop(): Promise<void> {
    if (!this._isRunning) {
      return;
    }

    this.logger.info(`Stopping service: ${this.constructor.name}`);

    try {
      await this.onStop();
      this._isRunning = false;
      
      const uptime = this.serviceStartTime ? Date.now() - this.serviceStartTime : 0;
      this.logger.info(`Service stopped: ${this.constructor.name}`, { uptime });
    } catch (error) {
      this.logger.error(`Error stopping service: ${this.constructor.name}`, error);
      throw error;
    }
  }

  /**
   * Template methods for subclasses
   */
  protected abstract onStart(): void | Promise<void>;
  protected abstract onStop(): void | Promise<void>;

  /**
   * Default disposal implementation stops the service
   */
  protected async onDispose(): Promise<void> {
    if (this._isRunning) {
      await this.stop();
    }
  }

  public get isRunning(): boolean {
    return this._isRunning;
  }

  public get uptime(): number {
    return this.serviceStartTime ? Date.now() - this.serviceStartTime : 0;
  }
}