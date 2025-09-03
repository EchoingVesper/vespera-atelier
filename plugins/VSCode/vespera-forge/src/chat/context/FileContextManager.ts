/**
 * File Context Manager
 * Coordinates file context collection and formats it for LLM consumption
 */

import * as vscode from 'vscode';
import { FileContextCollector, FileContextItem, FileContextOptions } from './FileContextCollector';

export interface ContextualMessage {
  originalContent: string;
  contextualContent: string;
  hasContext: boolean;
  contextItems: FileContextItem[];
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

export class FileContextManager {
  private collector: FileContextCollector;
  private config: FileContextConfig;
  private disposables: vscode.Disposable[] = [];

  constructor(config: Partial<FileContextConfig> = {}) {
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
    this.setupEventListeners();
  }

  /**
   * Create a contextual message by augmenting user input with file context
   */
  async createContextualMessage(userMessage: string): Promise<ContextualMessage> {
    if (!this.config.enabled) {
      return {
        originalContent: userMessage,
        contextualContent: userMessage,
        hasContext: false,
        contextItems: [],
        contextSummary: 'Context collection disabled'
      };
    }

    try {
      console.log('[FileContextManager] Collecting context for message:', userMessage.substring(0, 100));
      
      const contextItems = await this.collector.collectContext();
      
      if (contextItems.length === 0) {
        return {
          originalContent: userMessage,
          contextualContent: userMessage,
          hasContext: false,
          contextItems: [],
          contextSummary: 'No relevant context found'
        };
      }

      const formattedContext = this.formatContextForLLM(contextItems);
      const contextualContent = this.combineMessageWithContext(userMessage, formattedContext);
      const contextSummary = this.createContextSummary(contextItems);

      return {
        originalContent: userMessage,
        contextualContent,
        hasContext: true,
        contextItems,
        contextSummary
      };
    } catch (error) {
      console.error('[FileContextManager] Error creating contextual message:', error);
      return {
        originalContent: userMessage,
        contextualContent: userMessage,
        hasContext: false,
        contextItems: [],
        contextSummary: `Context collection failed: ${error}`
      };
    }
  }

  /**
   * Format context items for LLM consumption
   */
  private formatContextForLLM(items: FileContextItem[]): string {
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
   * Combine user message with context
   */
  private combineMessageWithContext(userMessage: string, formattedContext: string): string {
    // Check if user message already contains context indicators
    const hasExplicitContext = /(?:based on|looking at|in this file|current file|selected)/i.test(userMessage);
    
    let contextualMessage: string;
    
    if (hasExplicitContext || formattedContext.length < 1000) {
      // Short context or explicit reference - put context first
      contextualMessage = `Here's the current file context:\n\n${formattedContext}\n\n---\n\n${userMessage}`;
    } else {
      // Long context - put user message first, then context
      contextualMessage = `${userMessage}\n\n---\n\nHere's the current file context for reference:\n\n${formattedContext}`;
    }

    return contextualMessage;
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
   * Setup event listeners for context auto-collection
   */
  private setupEventListeners(): void {
    if (!this.config.autoCollect) {
      return;
    }

    // Listen for active editor changes
    this.disposables.push(
      vscode.window.onDidChangeActiveTextEditor(() => {
        console.log('[FileContextManager] Active editor changed');
        // Context will be collected on next message
      })
    );

    // Listen for selection changes  
    this.disposables.push(
      vscode.window.onDidChangeTextEditorSelection(() => {
        console.log('[FileContextManager] Selection changed');
        // Context will be collected on next message
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
    console.log(`[FileContextManager] Context collection ${enabled ? 'enabled' : 'disabled'}`);
  }

  /**
   * Check if context collection is currently enabled
   */
  isEnabled(): boolean {
    return this.config.enabled;
  }

  /**
   * Dispose of the manager
   */
  dispose(): void {
    this.disposables.forEach(d => d.dispose());
    this.disposables.length = 0;
    console.log('[FileContextManager] Disposed');
  }
}