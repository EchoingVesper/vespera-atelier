/**
 * WebView Security Integration Example
 * 
 * Demonstrates how to use the WebView security enhancements in practice,
 * showing complete integration from WebView provider initialization through
 * secure message handling and content generation.
 */

import * as vscode from 'vscode';
import { ChatWebViewProvider } from '../chat/ui/webview/ChatWebViewProvider';
import { WebViewSecurityManager } from '../chat/ui/webview/WebViewSecurityManager';
import { VesperaInputSanitizer } from '../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityAuditLogger } from '../core/security/audit/VesperaSecurityAuditLogger';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { VesperaTelemetryService } from '../core/telemetry/VesperaTelemetryService';
import { generateSecureTemplate, sanitizeHtmlContent } from '../chat/ui/webview/HtmlGenerator';
import { ChatEventRouter } from '../chat/events/ChatEventRouter';
import { ChatConfigurationManager } from '../chat/core/ConfigurationManager';
import { ChatTemplateRegistry } from '../chat/core/TemplateRegistry';
import { SanitizationRule, SanitizationScope, ThreatType, ThreatSeverity } from '../types/security';

/**
 * Example: Complete WebView Security Integration
 */
export class SecureWebViewExample {
  private securityManager?: WebViewSecurityManager;
  private chatProvider?: ChatWebViewProvider;
  private logger: VesperaLogger;
  private errorHandler: VesperaErrorHandler;

  constructor(private context: vscode.ExtensionContext) {
    // Initialize logger with proper static method
    this.logger = VesperaLogger.initialize(context, { 
      level: 0, // DEBUG level
      enableConsole: true,
      enableVSCodeOutput: true
    });
    
    // Initialize telemetry service required for error handler
    const telemetryService = new VesperaTelemetryService(true);
    
    // Initialize error handler with proper static method
    this.errorHandler = VesperaErrorHandler.initialize(context, this.logger, telemetryService);
  }

  /**
   * Initialize secure WebView with comprehensive security configuration
   */
  async initializeSecureWebView(): Promise<void> {
    try {
      // 1. Initialize security infrastructure
      await this.setupSecurityInfrastructure();

      // 2. Create secure WebView provider
      await this.createSecureWebViewProvider();

      // 3. Register WebView with VS Code
      await this.registerWebView();

      // 4. Setup security monitoring
      this.setupSecurityMonitoring();

      this.logger.info('Secure WebView initialized successfully');

    } catch (error) {
      this.logger.error('Failed to initialize secure WebView', error);
      throw error;
    }
  }

  /**
   * Setup comprehensive security infrastructure
   */
  private async setupSecurityInfrastructure(): Promise<void> {
    // Define comprehensive sanitization rules
    const sanitizationRules: SanitizationRule[] = [
      {
        id: 'webview-user-input',
        name: 'WebView User Input Sanitization',
        scope: SanitizationScope.USER_INPUT,
        priority: 100,
        enabled: true,
        threatPatterns: [
          {
            id: 'xss-script-tag',
            type: ThreatType.XSS,
            pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            severity: ThreatSeverity.CRITICAL,
            action: 'BLOCK' as any
          },
          {
            id: 'xss-javascript-protocol',
            type: ThreatType.XSS,
            pattern: /javascript:/gi,
            severity: ThreatSeverity.HIGH,
            action: 'SANITIZE' as any
          },
          {
            id: 'xss-event-handlers',
            type: ThreatType.XSS,
            pattern: /on\w+\s*=/gi,
            severity: ThreatSeverity.MEDIUM,
            action: 'SANITIZE' as any
          }
        ],
        processors: [
          {
            type: 'dompurify',
            config: {
              domPurify: {
                allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre'],
                allowedAttributes: {} as Record<string, string[]>,
                stripIgnoreTag: true,
                stripIgnoreTagBody: ['script', 'style']
              }
            }
          }
        ]
      },
      {
        id: 'webview-html-content',
        name: 'WebView HTML Content Sanitization',
        scope: SanitizationScope.HTML_CONTENT,
        priority: 90,
        enabled: true,
        threatPatterns: [
          {
            id: 'html-injection',
            type: ThreatType.XSS,
            pattern: /<(script|iframe|object|embed|link)\b/gi,
            severity: ThreatSeverity.HIGH,
            action: 'SANITIZE' as any
          }
        ],
        processors: [
          {
            type: 'dompurify',
            config: {
              domPurify: {
                allowedTags: ['div', 'span', 'p', 'br', 'strong', 'em', 'code', 'pre', 'ul', 'ol', 'li'],
                allowedAttributes: { 'div': ['class', 'id'], 'span': ['class', 'id'], 'p': ['class'], 'code': ['class'] } as Record<string, string[]>,
                stripIgnoreTag: false,
                stripIgnoreTagBody: ['script', 'style', 'object', 'embed']
              }
            }
          }
        ]
      }
    ];

    // Initialize input sanitizer
    const sanitizer = await VesperaInputSanitizer.initialize({
      logger: this.logger,
      errorHandler: this.errorHandler,
      rules: sanitizationRules,
      configuration: {
        enabled: true,
        strictMode: true,
        csp: {
          defaultSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          childSrc: ["'none'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'none'"],
          upgradeInsecureRequests: true
        },
        threatDetection: {
          patterns: [
            {
              id: 'command-injection',
              type: ThreatType.COMMAND_INJECTION,
              pattern: /[;&|`$(){}]/g,
              severity: ThreatSeverity.CRITICAL,
              action: 'BLOCK' as any
            },
            {
              id: 'path-traversal',
              type: ThreatType.PATH_TRAVERSAL,
              pattern: /\.\.[\/\\]/g,
              severity: ThreatSeverity.HIGH,
              action: 'BLOCK' as any
            }
          ],
          enableRealTimeDetection: true,
          alertThresholds: {
            low: 10,
            medium: 5,
            high: 2,
            critical: 1
          }
        }
      }
    });

    // Initialize security audit logger
    const auditLogger = new VesperaSecurityAuditLogger(
      this.logger,
      undefined, // No telemetry service in this example
      {
        enabled: true,
        retention: 30 * 24 * 60 * 60 * 1000, // 30 days
        includePII: false,
        exportFormat: 'json',
        realTimeAlerts: true
      }
    );

    // Initialize WebView security manager
    this.securityManager = await WebViewSecurityManager.initialize({
      sanitizer,
      auditLogger,
      logger: this.logger,
      errorHandler: this.errorHandler,
      securityConfig: {
        strictMode: true,
        enableRealTimeValidation: true,
        allowedOrigins: ['vscode-webview://*'],
        maxMessageSize: 1048576, // 1MB
        rateLimitPerSecond: 10,
        enableContentSanitization: true,
        cspStrictMode: true
      }
    });
  }

  /**
   * Create secure WebView provider with enhanced security
   */
  private async createSecureWebViewProvider(): Promise<void> {
    const eventRouter = new ChatEventRouter();
    const templateRegistry = new ChatTemplateRegistry(this.context.extensionUri, eventRouter);
    const configManager = new ChatConfigurationManager(
      this.context, 
      templateRegistry, 
      eventRouter
    );

    // Create ChatWebViewProvider with security dependencies
    this.chatProvider = new ChatWebViewProvider(
      this.context,
      eventRouter,
      configManager,
      templateRegistry,
      this.logger,
      this.errorHandler
    );
  }

  /**
   * Register WebView with VS Code window
   */
  private async registerWebView(): Promise<void> {
    if (!this.chatProvider) {
      throw new Error('Chat provider not initialized');
    }

    // Register WebView provider
    const disposable = vscode.window.registerWebviewViewProvider(
      ChatWebViewProvider.viewType,
      this.chatProvider,
      {
        webviewOptions: {
          retainContextWhenHidden: true
        }
      }
    );

    this.context.subscriptions.push(disposable);
  }

  /**
   * Setup security monitoring and alerting
   */
  private setupSecurityMonitoring(): void {
    if (!this.securityManager) return;

    // Monitor security statistics
    setInterval(() => {
      const stats = this.securityManager!.getSecurityStats();
      
      if (stats.blockRate > 0.1) { // More than 10% messages blocked
        this.logger.warn('High message block rate detected', {
          blockRate: stats.blockRate,
          messagesProcessed: stats.messagesProcessed,
          messagesBlocked: stats.messagesBlocked,
          threatsDetected: stats.threatsDetected
        });
      }

      // Reset stats periodically to prevent memory buildup
      if (stats.messagesProcessed > 10000) {
        this.securityManager!.resetStats();
      }
    }, 60000); // Check every minute
  }

  /**
   * Example: Process user message with security validation
   */
  async processUserMessage(content: string, providerId: string): Promise<{
    success: boolean;
    sanitizedContent?: string;
    threats: any[];
    error?: string;
  }> {
    if (!this.securityManager) {
      throw new Error('Security manager not initialized');
    }

    try {
      const message = {
        type: 'sendMessage' as const,
        data: {
          content,
          providerId
        },
        requestId: `msg_${Date.now()}`
      };

      const validationResult = await this.securityManager.validateMessage(
        message,
        {
          sessionId: 'example-session',
          origin: 'vscode-webview',
          messageCount: 1,
          lastActivity: Date.now(),
          trustLevel: 'medium'
        }
      );

      if (!validationResult.isValid) {
        return {
          success: false,
          threats: validationResult.threats,
          error: validationResult.blocked 
            ? 'Message blocked by security policy'
            : `Validation errors: ${validationResult.errors.join(', ')}`
        };
      }

      return {
        success: true,
        sanitizedContent: validationResult.sanitizedMessage?.data.content || content,
        threats: validationResult.threats
      };

    } catch (error) {
      this.logger.error('Error processing user message', error, { content, providerId });
      return {
        success: false,
        threats: [],
        error: 'Internal processing error'
      };
    }
  }

  /**
   * Example: Generate secure HTML template
   */
  async generateSecureMessageTemplate(messageData: {
    messageId: string;
    role: 'user' | 'assistant';
    content: string;
    provider: string;
    timestamp: string;
  }): Promise<string> {
    try {
      // Sanitize content first
      const sanitizedContent = await sanitizeHtmlContent(messageData.content, {
        allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre'],
        allowedAttributes: [],
        removeScripts: true
      });

      // Generate secure template
      const template = await generateSecureTemplate('message', {
        messageId: messageData.messageId,
        role: messageData.role,
        timestamp: messageData.timestamp,
        provider: messageData.provider,
        text: sanitizedContent,
        retryable: messageData.role === 'assistant'
      }, {
        sanitizeContent: true,
        allowedTags: ['p', 'br', 'strong', 'em', 'code', 'pre'],
        nonce: this.generateNonce()
      });

      return template;

    } catch (error) {
      this.logger.error('Error generating secure template', error, messageData);
      
      // Return safe fallback template
      return `
        <div class="message error">
          <div class="message__content">
            <div class="message__text">Error generating message template</div>
          </div>
        </div>
      `;
    }
  }

  /**
   * Example: Handle security incident
   */
  async handleSecurityIncident(incident: {
    type: 'threat_detected' | 'validation_failed' | 'rate_limit_exceeded';
    severity: 'low' | 'medium' | 'high' | 'critical';
    details: any;
  }): Promise<void> {
    this.logger.warn('Security incident detected', incident);

    // Show user notification for high-severity incidents
    if (incident.severity === 'critical' || incident.severity === 'high') {
      const action = await vscode.window.showWarningMessage(
        `Security Alert: ${incident.type.replace('_', ' ')}`,
        'View Details',
        'Dismiss'
      );

      if (action === 'View Details') {
        this.showSecurityDashboard();
      }
    }

    // Log incident for audit
    if (this.securityManager) {
      // Additional incident-specific logging could be added here
    }
  }

  /**
   * Example: Display security dashboard
   */
  private async showSecurityDashboard(): Promise<void> {
    if (!this.securityManager) return;

    const stats = this.securityManager.getSecurityStats();
    
    const dashboardHtml = `
      <div class="security-dashboard">
        <h3>🔒 WebView Security Status</h3>
        <div class="metrics">
          <div class="metric">
            <span class="label">Messages Processed:</span>
            <span class="value">${stats.messagesProcessed}</span>
          </div>
          <div class="metric">
            <span class="label">Messages Blocked:</span>
            <span class="value">${stats.messagesBlocked}</span>
          </div>
          <div class="metric">
            <span class="label">Block Rate:</span>
            <span class="value">${(stats.blockRate * 100).toFixed(2)}%</span>
          </div>
          <div class="metric">
            <span class="label">Threats Detected:</span>
            <span class="value">${stats.threatsDetected}</span>
          </div>
          <div class="metric">
            <span class="label">Active Contexts:</span>
            <span class="value">${stats.activeContexts}</span>
          </div>
        </div>
      </div>
    `;

    // This would typically be shown in a WebView panel
    console.log('Security Dashboard:', dashboardHtml);
  }

  /**
   * Generate nonce for CSP
   */
  private generateNonce(): string {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    let result = '';
    for (let i = 0; i < 32; i++) {
      result += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return result;
  }

  /**
   * Cleanup resources
   */
  dispose(): void {
    if (this.securityManager) {
      this.securityManager.dispose();
    }

    if (this.chatProvider) {
      this.chatProvider.dispose();
    }

    this.logger.info('SecureWebViewExample disposed');
  }
}

/**
 * Example usage in extension activation
 */
export async function activateSecureWebView(context: vscode.ExtensionContext): Promise<SecureWebViewExample> {
  const example = new SecureWebViewExample(context);
  
  try {
    await example.initializeSecureWebView();
    
    // Register command to test message processing
    const testCommand = vscode.commands.registerCommand(
      'vesperaForge.testSecureMessage',
      async () => {
        const input = await vscode.window.showInputBox({
          prompt: 'Enter a test message (try including some HTML/JavaScript)',
          placeHolder: 'Hello <script>alert("XSS test")</script>'
        });

        if (input) {
          const result = await example.processUserMessage(input, 'test-provider');
          
          if (result.success) {
            vscode.window.showInformationMessage(
              `Message processed successfully. Threats detected: ${result.threats.length}`
            );
          } else {
            vscode.window.showErrorMessage(`Message blocked: ${result.error}`);
          }
        }
      }
    );

    context.subscriptions.push(testCommand);

    return example;
    
  } catch (error) {
    console.error('Failed to activate secure WebView:', error);
    throw error;
  }
}

/**
 * Best Practices Summary for WebView Security
 */
export const WEBVIEW_SECURITY_BEST_PRACTICES = {
  
  /**
   * 1. Input Validation and Sanitization
   */
  INPUT_SANITIZATION: {
    description: 'Always sanitize user input before processing',
    implementation: [
      'Use VesperaInputSanitizer for comprehensive threat detection',
      'Define strict sanitization rules for different content scopes',
      'Block critical threats, sanitize medium threats',
      'Validate message schemas and size limits',
      'Implement rate limiting to prevent abuse'
    ]
  },

  /**
   * 2. Content Security Policy (CSP)
   */
  CSP_CONFIGURATION: {
    description: 'Implement strict CSP to prevent XSS attacks',
    implementation: [
      'Use nonce-based script execution only',
      'Disable unsafe-inline for scripts in production',
      'Restrict resource sources to trusted origins',
      'Enable upgrade-insecure-requests',
      'Use frame-ancestors none to prevent clickjacking'
    ]
  },

  /**
   * 3. Template Security
   */
  TEMPLATE_SECURITY: {
    description: 'Generate HTML templates securely',
    implementation: [
      'Always escape HTML content in templates',
      'Use parameterized templates with sanitization',
      'Add nonce attributes to dynamic elements',
      'Validate all template inputs before rendering',
      'Use type="button" for all interactive elements'
    ]
  },

  /**
   * 4. Security Monitoring
   */
  SECURITY_MONITORING: {
    description: 'Monitor and log security events',
    implementation: [
      'Log all sanitization events and threats',
      'Monitor message processing statistics',
      'Alert on high block rates or threat patterns',
      'Implement security dashboard for visibility',
      'Regular audit log exports for compliance'
    ]
  },

  /**
   * 5. Error Handling
   */
  ERROR_HANDLING: {
    description: 'Handle security errors gracefully',
    implementation: [
      'Never expose internal error details to users',
      'Provide safe fallback content on errors',
      'Log detailed error information for debugging',
      'Implement circuit breaker patterns for resilience',
      'Graceful degradation when security features fail'
    ]
  }
};