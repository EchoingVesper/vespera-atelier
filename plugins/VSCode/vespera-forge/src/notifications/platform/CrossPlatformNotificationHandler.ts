/**
 * Cross-Platform Notification Handler
 * 
 * Handles native OS notifications across Windows, macOS, and Linux with
 * consistent branding, rich notifications, and fallback mechanisms.
 */

import * as vscode from 'vscode';
import * as os from 'os';
import * as path from 'path';
import { spawn, exec } from 'child_process';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../../core/error-handling/VesperaErrorHandler';
import { SecurityEnhancedVesperaCoreServices } from '../../core/security/SecurityEnhancedCoreServices';
import { 
  NotificationRequest,
  NotificationResult,
  NotificationLevel 
} from '../SecureNotificationManager';

export enum PlatformType {
  WINDOWS = 'win32',
  MACOS = 'darwin',
  LINUX = 'linux',
  UNKNOWN = 'unknown'
}

export enum NotificationCapability {
  BASIC_TOAST = 'basic_toast',
  RICH_CONTENT = 'rich_content',
  ACTION_BUTTONS = 'action_buttons',
  PROGRESS_BAR = 'progress_bar',
  AUDIO = 'audio',
  PERSISTENCE = 'persistence',
  GROUPING = 'grouping'
}

export interface PlatformNotificationConfig {
  enabled: boolean;
  capabilities: Set<NotificationCapability>;
  iconPath?: string;
  soundEnabled: boolean;
  fallbackToVSCode: boolean;
  maxRetries: number;
  retryDelay: number; // milliseconds
}

export interface NotificationAssets {
  iconPath: string;
  soundPath?: string;
  logoPath?: string;
}

export interface PlatformNotificationResult {
  success: boolean;
  method: 'native' | 'vscode-fallback' | 'console-fallback';
  platformDetails?: any;
  error?: Error;
  capabilities: NotificationCapability[];
}

export class CrossPlatformNotificationHandler implements vscode.Disposable {
  private static instance: CrossPlatformNotificationHandler;
  private initialized = false;
  private platform: PlatformType;
  private config: PlatformNotificationConfig;
  private assets: NotificationAssets;
  private disposables: vscode.Disposable[] = [];

  private constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly coreServices: SecurityEnhancedVesperaCoreServices,
    private readonly logger: VesperaLogger,
    private readonly errorHandler: VesperaErrorHandler
  ) {
    this.platform = this.detectPlatform();
    this.config = this.getDefaultConfig();
    this.assets = this.initializeAssets();
  }

  /**
   * Initialize the cross-platform notification handler
   */
  public static async initialize(
    context: vscode.ExtensionContext,
    coreServices: SecurityEnhancedVesperaCoreServices
  ): Promise<CrossPlatformNotificationHandler> {
    if (CrossPlatformNotificationHandler.instance) {
      return CrossPlatformNotificationHandler.instance;
    }

    const logger = coreServices.logger.createChild('CrossPlatformNotificationHandler');
    const instance = new CrossPlatformNotificationHandler(
      context,
      coreServices,
      logger,
      coreServices.errorHandler
    );

    await instance.initializeInternal();
    CrossPlatformNotificationHandler.instance = instance;
    
    return instance;
  }

  /**
   * Get the singleton instance
   */
  public static getInstance(): CrossPlatformNotificationHandler {
    if (!CrossPlatformNotificationHandler.instance?.initialized) {
      throw new Error('CrossPlatformNotificationHandler not initialized');
    }
    return CrossPlatformNotificationHandler.instance;
  }

  /**
   * Internal initialization
   */
  private async initializeInternal(): Promise<void> {
    try {
      this.logger.info('Initializing CrossPlatformNotificationHandler', {
        platform: this.platform,
        capabilities: Array.from(this.config.capabilities)
      });

      // Detect platform capabilities
      await this.detectPlatformCapabilities();

      // Validate assets
      await this.validateAssets();

      // Register disposal
      this.context.subscriptions.push(this);

      this.initialized = true;
      this.logger.info('CrossPlatformNotificationHandler initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize CrossPlatformNotificationHandler', error);
      throw error;
    }
  }

  /**
   * Show native OS notification
   */
  public async showNotification(request: NotificationRequest): Promise<PlatformNotificationResult> {
    try {
      if (!this.config.enabled) {
        return this.createResult(false, 'console-fallback', 'Native notifications disabled');
      }

      this.logger.debug('Showing platform notification', {
        platform: this.platform,
        title: request.title.substring(0, 50),
        level: request.level
      });

      // Security audit logging for cross-platform notifications
      await this.coreServices.securityAuditLogger.logSecurityEvent(
        'platform_notification_shown',
        'low',
        {
          platform: this.platform,
          notificationLevel: request.level,
          hasActions: (request.actions?.length || 0) > 0,
          timestamp: Date.now()
        }
      );

      let result: PlatformNotificationResult;

      // Try platform-specific notification
      switch (this.platform) {
        case PlatformType.WINDOWS:
          result = await this.showWindowsNotification(request);
          break;
        case PlatformType.MACOS:
          result = await this.showMacOSNotification(request);
          break;
        case PlatformType.LINUX:
          result = await this.showLinuxNotification(request);
          break;
        default:
          result = await this.showFallbackNotification(request);
          break;
      }

      // Retry logic for failed notifications
      if (!result.success && this.config.maxRetries > 0) {
        result = await this.retryNotification(request, result);
      }

      this.logger.debug('Platform notification result', {
        success: result.success,
        method: result.method,
        platform: this.platform
      });

      return result;

    } catch (error) {
      this.logger.error('Failed to show platform notification', error);
      await this.errorHandler.handleError(error as Error);
      return this.createResult(false, 'console-fallback', error as Error);
    }
  }

  /**
   * Show Windows toast notification
   */
  private async showWindowsNotification(request: NotificationRequest): Promise<PlatformNotificationResult> {
    try {
      // Use PowerShell to show Windows toast notification
      const powershellScript = this.generateWindowsToastScript(request);
      
      return new Promise((resolve) => {
        exec(`powershell -Command "${powershellScript}"`, { timeout: 5000 }, (error, _stdout, _stderr) => {
          if (error) {
            this.logger.warn('Windows PowerShell notification failed', { error });
            resolve(this.createResult(false, 'vscode-fallback', error, 
              [NotificationCapability.BASIC_TOAST]));
          } else {
            resolve(this.createResult(true, 'native', undefined, 
              [NotificationCapability.BASIC_TOAST, NotificationCapability.AUDIO]));
          }
        });
      });

    } catch (error) {
      return this.createResult(false, 'vscode-fallback', error as Error);
    }
  }

  /**
   * Show macOS notification
   */
  private async showMacOSNotification(request: NotificationRequest): Promise<PlatformNotificationResult> {
    try {
      // Use osascript to show macOS notification
      const applescript = this.generateMacOSNotificationScript(request);
      
      return new Promise((resolve) => {
        exec(`osascript -e '${applescript}'`, { timeout: 5000 }, (error, _stdout, _stderr) => {
          if (error) {
            this.logger.warn('macOS osascript notification failed', { error });
            resolve(this.createResult(false, 'vscode-fallback', error, 
              [NotificationCapability.BASIC_TOAST]));
          } else {
            resolve(this.createResult(true, 'native', undefined, 
              [NotificationCapability.BASIC_TOAST, NotificationCapability.AUDIO, NotificationCapability.ACTION_BUTTONS]));
          }
        });
      });

    } catch (error) {
      return this.createResult(false, 'vscode-fallback', error as Error);
    }
  }

  /**
   * Show Linux notification
   */
  private async showLinuxNotification(request: NotificationRequest): Promise<PlatformNotificationResult> {
    try {
      // Try different Linux notification systems
      const notificationSystems = ['notify-send', 'kdialog', 'zenity'];
      
      for (const system of notificationSystems) {
        try {
          const result = await this.tryLinuxNotificationSystem(system, request);
          if (result.success) {
            return result;
          }
        } catch (error) {
          this.logger.debug(`Linux notification system ${system} failed`, { error });
        }
      }

      return this.createResult(false, 'vscode-fallback', new Error('All Linux notification systems failed'));

    } catch (error) {
      return this.createResult(false, 'vscode-fallback', error as Error);
    }
  }

  /**
   * Try specific Linux notification system
   */
  private async tryLinuxNotificationSystem(
    system: string,
    request: NotificationRequest
  ): Promise<PlatformNotificationResult> {
    return new Promise((resolve) => {
      let command: string;
      let args: string[];

      switch (system) {
        case 'notify-send':
          command = 'notify-send';
          args = this.generateNotifySendArgs(request);
          break;
        case 'kdialog':
          command = 'kdialog';
          args = this.generateKDialogArgs(request);
          break;
        case 'zenity':
          command = 'zenity';
          args = this.generateZenityArgs(request);
          break;
        default:
          resolve(this.createResult(false, 'vscode-fallback', new Error(`Unknown system: ${system}`)));
          return;
      }

      const childProcess = spawn(command, args, { timeout: 5000 });
      
      childProcess.on('close', (code) => {
        if (code === 0) {
          resolve(this.createResult(true, 'native', { system }, 
            [NotificationCapability.BASIC_TOAST, NotificationCapability.AUDIO]));
        } else {
          resolve(this.createResult(false, 'vscode-fallback', new Error(`${system} exited with code ${code}`)));
        }
      });

      childProcess.on('error', (error) => {
        resolve(this.createResult(false, 'vscode-fallback', error));
      });
    });
  }

  /**
   * Show fallback notification (VS Code or console)
   */
  private async showFallbackNotification(request: NotificationRequest): Promise<PlatformNotificationResult> {
    try {
      if (this.config.fallbackToVSCode) {
        await this.showVSCodeNotification(request);
        return this.createResult(true, 'vscode-fallback', undefined, []);
      } else {
        console.log(`${request.level.toUpperCase()}: ${request.title} - ${request.message}`);
        return this.createResult(true, 'console-fallback', undefined, []);
      }
    } catch (error) {
      console.error(`NOTIFICATION ERROR: ${request.title} - ${request.message}`);
      return this.createResult(false, 'console-fallback', error as Error);
    }
  }

  /**
   * Show VS Code notification as fallback
   */
  private async showVSCodeNotification(request: NotificationRequest): Promise<void> {
    const options: vscode.MessageOptions = {
      modal: request.persistent || request.level === NotificationLevel.CRITICAL
    };

    let showMethod: any;
    switch (request.level) {
      case NotificationLevel.CRITICAL:
        showMethod = vscode.window.showErrorMessage;
        break;
      case NotificationLevel.IMPORTANT:
        showMethod = vscode.window.showWarningMessage;
        break;
      default:
        showMethod = vscode.window.showInformationMessage;
        break;
    }

    const actionLabels = request.actions?.map(a => a.label) || [];
    const result = await showMethod(`${request.title}: ${request.message}`, options, ...actionLabels);

    // Handle action selection
    if (result && request.actions) {
      const action = request.actions.find(a => a.label === result);
      if (action) {
        try {
          await action.callback();
        } catch (error) {
          this.logger.error('Notification action failed', error);
        }
      }
    }
  }

  /**
   * Retry notification with backoff
   */
  private async retryNotification(
    request: NotificationRequest,
    lastResult: PlatformNotificationResult,
    attempt = 1
  ): Promise<PlatformNotificationResult> {
    if (attempt > this.config.maxRetries) {
      return lastResult;
    }

    // Wait before retry
    await new Promise(resolve => setTimeout(resolve, this.config.retryDelay * attempt));

    this.logger.debug('Retrying platform notification', { attempt, maxRetries: this.config.maxRetries });

    try {
      const result = await this.showNotification(request);
      if (result.success) {
        return result;
      } else {
        return this.retryNotification(request, result, attempt + 1);
      }
    } catch (error) {
      return this.retryNotification(request, lastResult, attempt + 1);
    }
  }

  /**
   * Generate Windows toast script
   */
  private generateWindowsToastScript(request: NotificationRequest): string {
    const title = request.title.replace(/"/g, '""');
    const message = request.message.replace(/"/g, '""');
    const iconPath = this.assets.iconPath.replace(/\\/g, '\\\\');
    
    return `
      Add-Type -AssemblyName System.Windows.Forms
      $notify = New-Object System.Windows.Forms.NotifyIcon
      $notify.Icon = [System.Drawing.Icon]::ExtractAssociatedIcon("${iconPath}")
      $notify.BalloonTipIcon = [System.Windows.Forms.ToolTipIcon]::Info
      $notify.BalloonTipText = "${message}"
      $notify.BalloonTipTitle = "${title}"
      $notify.Visible = $true
      $notify.ShowBalloonTip(5000)
      Start-Sleep -Seconds 1
      $notify.Dispose()
    `.replace(/\s+/g, ' ').trim();
  }

  /**
   * Generate macOS notification script
   */
  private generateMacOSNotificationScript(request: NotificationRequest): string {
    const title = request.title.replace(/'/g, "\\'");
    const message = request.message.replace(/'/g, "\\'");
    const subtitle = this.getSubtitleForLevel(request.level);
    
    return `display notification "${message}" with title "${title}" subtitle "${subtitle}"`;
  }

  /**
   * Generate notify-send arguments
   */
  private generateNotifySendArgs(request: NotificationRequest): string[] {
    const args = [
      '--app-name=Vespera Forge',
      `--icon=${this.assets.iconPath}`,
      `--urgency=${this.getLinuxUrgency(request.level)}`,
      '--expire-time=5000'
    ];

    if (request.timeout) {
      args.push(`--expire-time=${request.timeout}`);
    }

    args.push(request.title, request.message);
    return args;
  }

  /**
   * Generate kdialog arguments
   */
  private generateKDialogArgs(request: NotificationRequest): string[] {
    return [
      '--passivepopup',
      `${request.title}: ${request.message}`,
      '5'
    ];
  }

  /**
   * Generate zenity arguments
   */
  private generateZenityArgs(request: NotificationRequest): string[] {
    const type = request.level === NotificationLevel.CRITICAL ? 'error' : 'info';
    return [
      `--${type}`,
      `--text=${request.title}: ${request.message}`,
      '--no-wrap'
    ];
  }

  /**
   * Get subtitle for macOS based on notification level
   */
  private getSubtitleForLevel(level: NotificationLevel): string {
    switch (level) {
      case NotificationLevel.CRITICAL:
        return 'Critical Alert';
      case NotificationLevel.IMPORTANT:
        return 'Important';
      case NotificationLevel.INFO:
        return 'Information';
      case NotificationLevel.DEBUG:
        return 'Debug';
      default:
        return 'Notification';
    }
  }

  /**
   * Get Linux urgency level
   */
  private getLinuxUrgency(level: NotificationLevel): string {
    switch (level) {
      case NotificationLevel.CRITICAL:
        return 'critical';
      case NotificationLevel.IMPORTANT:
        return 'normal';
      default:
        return 'low';
    }
  }

  /**
   * Detect current platform
   */
  private detectPlatform(): PlatformType {
    const platform = os.platform();
    switch (platform) {
      case 'win32':
        return PlatformType.WINDOWS;
      case 'darwin':
        return PlatformType.MACOS;
      case 'linux':
        return PlatformType.LINUX;
      default:
        return PlatformType.UNKNOWN;
    }
  }

  /**
   * Detect platform-specific capabilities
   */
  private async detectPlatformCapabilities(): Promise<void> {
    const capabilities = new Set<NotificationCapability>();

    // Basic toast is supported on all platforms
    capabilities.add(NotificationCapability.BASIC_TOAST);

    switch (this.platform) {
      case PlatformType.WINDOWS:
        capabilities.add(NotificationCapability.AUDIO);
        capabilities.add(NotificationCapability.PERSISTENCE);
        // Check for Windows 10+ features
        if (await this.checkWindowsVersion()) {
          capabilities.add(NotificationCapability.ACTION_BUTTONS);
          capabilities.add(NotificationCapability.PROGRESS_BAR);
        }
        break;

      case PlatformType.MACOS:
        capabilities.add(NotificationCapability.AUDIO);
        capabilities.add(NotificationCapability.ACTION_BUTTONS);
        capabilities.add(NotificationCapability.GROUPING);
        break;

      case PlatformType.LINUX:
        capabilities.add(NotificationCapability.AUDIO);
        // Check for specific notification daemon capabilities
        if (await this.checkLinuxNotificationDaemon()) {
          capabilities.add(NotificationCapability.ACTION_BUTTONS);
        }
        break;
    }

    this.config.capabilities = capabilities;
    
    this.logger.debug('Platform capabilities detected', {
      platform: this.platform,
      capabilities: Array.from(capabilities)
    });
  }

  /**
   * Check Windows version for advanced features
   */
  private async checkWindowsVersion(): Promise<boolean> {
    if (this.platform !== PlatformType.WINDOWS) return false;
    
    try {
      const version = os.release();
      const versionParts = version.split('.').map(Number);
      return versionParts[0] >= 10; // Windows 10+
    } catch (error) {
      return false;
    }
  }

  /**
   * Check Linux notification daemon capabilities
   */
  private async checkLinuxNotificationDaemon(): Promise<boolean> {
    if (this.platform !== PlatformType.LINUX) return false;
    
    return new Promise((resolve) => {
      exec('notify-send --help', (error) => {
        resolve(!error); // notify-send is available
      });
    });
  }

  /**
   * Initialize notification assets
   */
  private initializeAssets(): NotificationAssets {
    const extensionPath = this.context.extensionPath;
    
    return {
      iconPath: path.join(extensionPath, 'resources', 'icons', 'vespera-icon.png'),
      soundPath: path.join(extensionPath, 'resources', 'sounds', 'notification.wav'),
      logoPath: path.join(extensionPath, 'resources', 'icons', 'vespera-logo.png')
    };
  }

  /**
   * Validate notification assets
   */
  private async validateAssets(): Promise<void> {
    try {
      const fs = require('fs');
      
      // Check if icon exists, create placeholder if not
      if (!fs.existsSync(this.assets.iconPath)) {
        this.logger.warn('Notification icon not found, using default');
        // Would create or use a default system icon
      }

      this.logger.debug('Notification assets validated', {
        iconExists: fs.existsSync(this.assets.iconPath),
        soundExists: fs.existsSync(this.assets.soundPath || ''),
        logoExists: fs.existsSync(this.assets.logoPath)
      });

    } catch (error) {
      this.logger.warn('Failed to validate notification assets', { error });
    }
  }

  /**
   * Create platform notification result
   */
  private createResult(
    success: boolean,
    method: 'native' | 'vscode-fallback' | 'console-fallback',
    error?: string | Error,
    capabilities: NotificationCapability[] = []
  ): PlatformNotificationResult {
    return {
      success,
      method,
      error: typeof error === 'string' ? new Error(error) : error,
      capabilities,
      platformDetails: {
        platform: this.platform,
        detectedCapabilities: Array.from(this.config.capabilities)
      }
    };
  }

  /**
   * Get platform capabilities
   */
  public getPlatformCapabilities(): NotificationCapability[] {
    return Array.from(this.config.capabilities);
  }

  /**
   * Check if capability is supported
   */
  public hasCapability(capability: NotificationCapability): boolean {
    return this.config.capabilities.has(capability);
  }

  /**
   * Update configuration
   */
  public async updateConfiguration(config: Partial<PlatformNotificationConfig>): Promise<void> {
    this.config = { ...this.config, ...config };
    
    this.logger.info('Platform notification configuration updated', {
      enabled: this.config.enabled,
      capabilities: Array.from(this.config.capabilities)
    });
  }

  /**
   * Get current configuration
   */
  public getConfiguration(): PlatformNotificationConfig {
    return { ...this.config };
  }

  /**
   * Get default configuration
   */
  private getDefaultConfig(): PlatformNotificationConfig {
    return {
      enabled: true,
      capabilities: new Set([NotificationCapability.BASIC_TOAST]),
      iconPath: undefined,
      soundEnabled: false,
      fallbackToVSCode: true,
      maxRetries: 2,
      retryDelay: 1000
    };
  }

  /**
   * Dispose resources
   */
  public dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    
    this.initialized = false;
    CrossPlatformNotificationHandler.instance = undefined as any;
    
    this.logger.info('CrossPlatformNotificationHandler disposed');
  }
}