/**
 * Secure File Context Collector
 * Coordinates file context collection with security enhancements and separates context from chat content
 */

import * as vscode from 'vscode';
import { FileContextCollector, FileContextItem, FileContextOptions } from './FileContextCollector';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { SanitizationScope, VesperaSecurityEvent } from '../../types/security';
import { SecurityEnhancedVesperaCoreServices } from '../../core/security/SecurityEnhancedCoreServices';

export interface SecureContextData {
  contextItems: FileContextItem[];
  contextSummary: string;
  hasContext: boolean;
  contextId: string;
  timestamp: number;
  sanitized: boolean;
  threatCount: number;
}

export interface SecureContextMessage {
  originalMessage: string;
  contextData: SecureContextData | null;
  messageId: string;
  timestamp: number;
  hasContext: boolean;
  contextualContent: string;
  contextSummary: string;
}

export interface FileContextConfig {
  enabled: boolean;
  autoCollect: boolean;
  contextOptions: FileContextOptions;
  formatOptions: {
    includeLineNumbers: boolean;
    includeLanguageHints: boolean;
    includeFilePaths: boolean;
    contextSeparator: string;
    maxContextPreview: number;
  };
}

export class SecureFileContextCollector {
  private collector: FileContextCollector;
  private config: FileContextConfig;
  private disposables: vscode.Disposable[] = [];
  private disposed = false;
  
  // Core services integration
  private logger: VesperaLogger;
  private coreServices?: SecurityEnhancedVesperaCoreServices;

  constructor(
    config: Partial<FileContextConfig> = {},
    coreServices?: SecurityEnhancedVesperaCoreServices
  ) {
    this.config = {
      enabled: true,
      autoCollect: true,
      contextOptions: {
        includeActiveFile: true,
        includeSelection: true,
        includeCursorArea: true,
        includeOpenTabs: false,
        cursorContextLines: 10,
        maxFileSize: 10000,
        maxTotalSize: 50000,
        excludePatterns: [
          '**/.git/**',
          '**/node_modules/**',
          '**/dist/**',
          '**/build/**',
          '**/*.min.js',
          '**/*.bundle.js'
        ]
      },
      formatOptions: {
        includeLineNumbers: true,
        includeLanguageHints: true,
        includeFilePaths: true,
        contextSeparator: '\n---\n',
        maxContextPreview: 200
      },
      ...config
    };

    this.collector = new FileContextCollector(this.config.contextOptions);
    this.coreServices = coreServices;
    
    // Initialize logger
    if (coreServices?.logger) {
      this.logger = coreServices.logger.createChild('SecureFileContextCollector');
    } else {
      this.logger = console as any;
    }
    
    if (coreServices) {
      this.logger.info('SecureFileContextCollector initialized with core services integration');
    } else {
      console.log('SecureFileContextCollector initialized without core services');
    }
    
    this.setupEventListeners();
  }

  /**
   * Create a contextual message from user input and file context
   */
  async createContextualMessage(userMessage: string): Promise<SecureContextMessage> {
    const contextMessage = await this.collectSecureContext(userMessage);
    
    // Ensure all required properties are set
    const hasContext = contextMessage.contextData !== null && contextMessage.contextData.hasContext;
    const contextSummary = contextMessage.contextData?.contextSummary || 'No context available';
    
    let contextualContent = userMessage;
    if (hasContext && contextMessage.contextData) {
      contextualContent = this._formatContextForLLM(contextMessage.contextData.contextItems);
    }

    return {
      ...contextMessage,
      hasContext,
      contextualContent,
      contextSummary
    };
  }

  /**
   * Collect secure context data separately from user message
   */
  async collectSecureContext(userMessage: string): Promise<SecureContextMessage> {
    if (this.disposed) {
      throw new Error('SecureFileContextCollector has been disposed');
    }

    if (!this.config.enabled) {
      return {
        originalMessage: userMessage,
        contextData: null,
        messageId: this.generateMessageId(),
        timestamp: Date.now(),
        hasContext: false,
        contextualContent: userMessage,
        contextSummary: 'No context available'
      };
    }

    const messageId = this.generateMessageId();
    const timestamp = Date.now();
    
    try {
      this.logger?.debug('Collecting secure context', { 
        messageId,
        messagePreview: userMessage.substring(0, 50) + '...' 
      });
      
      const contextItems = await this.collector.collectContext();
      
      if (contextItems.length === 0) {
        return {
          originalMessage: userMessage,
          contextData: null,
          messageId,
          timestamp,
          hasContext: false,
          contextualContent: userMessage,
          contextSummary: 'No context available'
        };
      }

      // Sanitize context items for security
      const sanitizedContextItems = await this.sanitizeContextItems(contextItems);
      const contextSummary = this.createContextSummary(sanitizedContextItems);
      const contextId = this.generateContextId();

      const contextData: SecureContextData = {
        contextItems: sanitizedContextItems,
        contextSummary,
        hasContext: true,
        contextId,
        timestamp,
        sanitized: this.inputSanitizer !== undefined,
        threatCount: 0 // Will be updated by sanitization
      };

      // Log security event
      await this.logContextCollectionEvent(contextData, messageId);

      const contextualContent = this._formatContextForLLM(sanitizedContextItems);

      return {
        originalMessage: userMessage,
        contextData,
        messageId,
        timestamp,
        hasContext: true,
        contextualContent,
        contextSummary
      };
    } catch (error) {
      this.logger?.error('Secure context collection failed', error, { messageId });
      
      // Log security error
      if (this.coreServices?.securityAuditLogger) {
        await this.coreServices.securityAuditLogger.logSecurityEvent({
          type: VesperaSecurityEvent.FILE_ACCESS_DENIED,
          severity: 'high',
          message: 'Context collection failed',
          metadata: {
            action: 'context_collection_failed',
            messageId,
            error: error instanceof Error ? error.message : String(error),
            timestamp
          }
        });
      }
      
      return {
        originalMessage: userMessage,
        contextData: null,
        messageId,
        timestamp,
        hasContext: false,
        contextualContent: userMessage,
        contextSummary: 'Context collection failed'
      };
    }
  }

  /**
   * Format context items for LLM consumption
   */
  private _formatContextForLLM(items: FileContextItem[]): string {
    const formatted: string[] = [];

    for (const item of items) {
      const sections: string[] = [];

      // Header with file info
      if (this.config.formatOptions.includeFilePaths) {
        let header = `File: ${item.filepath}`;
        
        if (this.config.formatOptions.includeLanguageHints && item.language) {
          header += ` (${item.language})`;
        }
        
        if (item.startLine && item.endLine) {
          header += ` - Lines ${item.startLine}-${item.endLine}`;
        }
        
        if (item.type === 'selection') {
          header += ` - USER SELECTION`;
        } else if (item.type === 'cursor_area') {
          header += ` - CURSOR AREA`;
        }
        
        sections.push(header);
      }

      // Code content
      let content = item.content;
      
      if (this.config.formatOptions.includeLineNumbers && item.startLine) {
        content = this.addLineNumbers(content, item.startLine);
      }

      // Wrap in code block with language hint
      if (this.config.formatOptions.includeLanguageHints && item.language) {
        content = `\`\`\`${item.language}\n${content}\n\`\`\``;
      } else {
        content = `\`\`\`\n${content}\n\`\`\``;
      }

      sections.push(content);
      formatted.push(sections.join('\n'));
    }

    return formatted.join(this.config.formatOptions.contextSeparator);
  }

  /**
   * Add line numbers to content
   */
  private addLineNumbers(content: string, startLine: number): string {
    const lines = content.split('\n');
    const maxLineNumberWidth = String(startLine + lines.length - 1).length;
    
    return lines
      .map((line, index) => {
        const lineNumber = (startLine + index).toString().padStart(maxLineNumberWidth, ' ');
        return `${lineNumber}: ${line}`;
      })
      .join('\n');
  }

  /**
   * Sanitize context items for security using core services
   */
  private async sanitizeContextItems(contextItems: FileContextItem[]): Promise<FileContextItem[]> {
    const sanitizedItems: FileContextItem[] = [];
    let totalThreatCount = 0;

    for (const item of contextItems) {
      try {
        // Use core services for sanitization if available
        if (this.coreServices?.inputSanitizer) {
          const sanitizationResult = await this.coreServices.inputSanitizer.sanitize(
            item.content,
            SanitizationScope.FILE_CONTENT
          );
          
          if (sanitizationResult.sanitizedContent !== null) {
            sanitizedItems.push({
              ...item,
              content: sanitizationResult.sanitizedContent
            });
            totalThreatCount += sanitizationResult.threats.length;
          } else {
            this.logger?.warn('Context item blocked by security policy', {
              filepath: item.filepath,
              threats: sanitizationResult.threats.length
            });
          }
        } else {
          // Fallback: include original item
          sanitizedItems.push(item);
        }
      } catch (error) {
        this.logger?.error('Context sanitization failed', error, { filepath: item.filepath });
        // Include original item if sanitization fails (fail-open for context)
        sanitizedItems.push(item);
      }
    }

    this.logger?.debug('Context sanitization completed', {
      originalCount: contextItems.length,
      sanitizedCount: sanitizedItems.length,
      totalThreats: totalThreatCount
    });

    return sanitizedItems;
  }

  /**
   * Create a human-readable summary of collected context
   */
  private createContextSummary(items: FileContextItem[]): string {
    if (items.length === 0) {
      return 'No context collected';
    }

    const summary: string[] = [];
    const byType = this.groupContextByType(items);

    if (byType['selection'] && byType['selection'].length > 0) {
      const item = byType['selection'][0];
      if (item) {
        const preview = item.content.substring(0, this.config.formatOptions.maxContextPreview);
        summary.push(`Selected text from ${item.filepath}: "${preview}..."`);
      }
    }

    if (byType['cursor_area'] && byType['cursor_area'].length > 0) {
      const item = byType['cursor_area'][0];
      if (item && item.startLine && item.endLine) {
        summary.push(`Cursor area in ${item.filepath} (lines ${item.startLine}-${item.endLine})`);
      }
    }

    if (byType['file'] && byType['file'].length > 0) {
      const files = byType['file'].map(item => item.filepath).join(', ');
      summary.push(`Files: ${files}`);
    }

    const totalSize = items.reduce((sum, item) => sum + item.content.length, 0);
    summary.push(`(${items.length} items, ~${Math.round(totalSize / 1000)}k chars)`);

    return summary.join(' | ');
  }

  /**
   * Group context items by type
   */
  private groupContextByType(items: FileContextItem[]): Record<string, FileContextItem[]> {
    const grouped: Record<string, FileContextItem[]> = {
      selection: [],
      cursor_area: [],
      file: []
    };

    for (const item of items) {
      const type = item.type;
      if (grouped[type]) {
        grouped[type].push(item);
      }
    }

    return grouped;
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    return `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Generate unique context ID
   */
  private generateContextId(): string {
    return `ctx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  /**
   * Log context collection security event using core services
   */
  private async logContextCollectionEvent(
    contextData: SecureContextData,
    messageId: string
  ): Promise<void> {
    try {
      // Use core services for audit logging
      if (this.coreServices?.securityAuditLogger) {
        await this.coreServices.securityAuditLogger.logSecurityEvent({
          type: VesperaSecurityEvent.FILE_ACCESS_GRANTED,
          severity: 'info',
          message: 'Secure context collected',
          metadata: {
            action: 'secure_context_collected',
            contextId: contextData.contextId,
            messageId,
            itemCount: contextData.contextItems.length,
            sanitized: contextData.sanitized,
            threatCount: contextData.threatCount,
            filePaths: contextData.contextItems.map(item => item.filepath)
          }
        });
      }
    } catch (error) {
      this.logger?.error('Failed to log context collection event', error);
    }
  }

  /**
   * Setup event listeners for context auto-collection
   */
  private setupEventListeners(): void {
    if (!this.config.autoCollect) {
      return;
    }

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        this.logger?.debug('Active editor changed - context will be refreshed on next request');
      })
    );

    // Listen for selection changes  
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => {
        this.logger?.debug('Selection changed - context will be refreshed on next request');
      })
    );
  }

  /**
   * Update configuration
   */
  updateConfig(newConfig: Partial<FileContextConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    if (newConfig.contextOptions) {
      this.collector.updateOptions(newConfig.contextOptions);
    }

    console.log('[FileContextManager] Configuration updated');
  }

  /**
   * Get current configuration
   */
  getConfig(): FileContextConfig {
    return { ...this.config };
  }

  /**
   * Force context collection (for testing or manual triggers)
   */
  async collectContextNow(): Promise<FileContextItem[]> {
    return await this.collector.collectContext();
  }

  /**
   * Enable/disable context collection
   */
  setEnabled(enabled: boolean): void {
    this.config.enabled = enabled;
    this.logger?.info(`Context collection ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if context collection is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Dispose of the collector
   */
  dispose(): void {
    if (this.disposed) return;
    
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    this.disposed = true;
    
    this.logger?.info('SecureFileContextCollector disposed');
  }
}