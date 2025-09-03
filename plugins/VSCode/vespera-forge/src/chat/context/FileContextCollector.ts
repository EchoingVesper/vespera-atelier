/**
 * File Context Collector for VS Code Extension
 * Collects file content, selections, cursor context from VS Code APIs
 */

import * as vscode from 'vscode';

export interface FileContextItem {
  type: 'file' | 'selection' | 'cursor_area';
  filepath: string;
  content: string;
  language?: string;
  startLine?: number;
  endLine?: number;
  priority: number; // Higher priority = more relevant
}

export interface FileContextOptions {
  includeActiveFile?: boolean;
  includeSelection?: boolean;
  includeCursorArea?: boolean;
  includeOpenTabs?: boolean;
  cursorContextLines?: number;
  maxFileSize?: number; // Max characters per file
  maxTotalSize?: number; // Max total context size
  excludePatterns?: string[];
}

export class FileContextCollector {
  private readonly defaultOptions: FileContextOptions = {
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
  };

  constructor(private options: FileContextOptions = {}) {
    this.options = { ...this.defaultOptions, ...options };
  }

  /**
   * Collect all relevant file context based on current VS Code state
   */
  async collectContext(): Promise<FileContextItem[]> {
    const contextItems: FileContextItem[] = [];
    const activeEditor = vscode.window.activeTextEditor;

    if (!activeEditor) {
      console.log('[FileContextCollector] No active editor found');
      return contextItems;
    }

    const document = activeEditor.document;
    const filepath = this.getRelativeFilePath(document.uri);

    // Skip if file matches exclude patterns
    if (this.shouldExcludeFile(filepath)) {
      console.log(`[FileContextCollector] Excluding file: ${filepath}`);
      return contextItems;
    }

    // Priority order: Selection > Cursor Area > Full File > Open Tabs

    // 1. Collect selected text (highest priority)
    if (this.options.includeSelection && !activeEditor.selection.isEmpty) {
      const selection = await this.collectSelection(activeEditor);
      if (selection) {
        contextItems.push(selection);
      }
    }

    // 2. Collect cursor area context (high priority)
    if (this.options.includeCursorArea) {
      const cursorArea = await this.collectCursorArea(activeEditor);
      if (cursorArea && !this.hasOverlapWithSelection(cursorArea, contextItems)) {
        contextItems.push(cursorArea);
      }
    }

    // 3. Collect full active file (medium priority)
    if (this.options.includeActiveFile && contextItems.length === 0) {
      const fullFile = await this.collectActiveFile(activeEditor);
      if (fullFile) {
        contextItems.push(fullFile);
      }
    }

    // 4. Collect open tabs (low priority)
    if (this.options.includeOpenTabs && contextItems.length < 3) {
      const openTabs = await this.collectOpenTabs(activeEditor);
      contextItems.push(...openTabs);
    }

    console.log(`[FileContextCollector] Collected ${contextItems.length} context items`);
    return this.limitContextSize(contextItems);
  }

  /**
   * Collect selected text with context
   */
  private async collectSelection(editor: vscode.TextEditor): Promise<FileContextItem | null> {
    const selection = editor.selection;
    const document = editor.document;

    if (selection.isEmpty) {
      return null;
    }

    const selectedText = document.getText(selection);
    const filepath = this.getRelativeFilePath(document.uri);

    // Add some context around the selection
    const startLine = Math.max(0, selection.start.line - 2);
    const endLine = Math.min(document.lineCount - 1, selection.end.line + 2);
    const contextRange = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    const contextText = document.getText(contextRange);

    return {
      type: 'selection',
      filepath,
      content: `SELECTED TEXT:\n${selectedText}\n\nSURROUNDING CONTEXT:\n${contextText}`,
      language: document.languageId,
      startLine: startLine + 1, // 1-based for display
      endLine: endLine + 1,
      priority: 10 // Highest priority
    };
  }

  /**
   * Collect cursor area context (lines around cursor)
   */
  private async collectCursorArea(editor: vscode.TextEditor): Promise<FileContextItem | null> {
    const document = editor.document;
    const position = editor.selection.active;
    const filepath = this.getRelativeFilePath(document.uri);
    
    const contextLines = this.options.cursorContextLines || 10;
    const startLine = Math.max(0, position.line - Math.floor(contextLines / 2));
    const endLine = Math.min(document.lineCount - 1, position.line + Math.floor(contextLines / 2));
    
    const range = new vscode.Range(startLine, 0, endLine, document.lineAt(endLine).text.length);
    const content = document.getText(range);

    return {
      type: 'cursor_area',
      filepath,
      content,
      language: document.languageId,
      startLine: startLine + 1,
      endLine: endLine + 1,
      priority: 8 // High priority
    };
  }

  /**
   * Collect full active file content
   */
  private async collectActiveFile(editor: vscode.TextEditor): Promise<FileContextItem | null> {
    const document = editor.document;
    const filepath = this.getRelativeFilePath(document.uri);
    
    let content = document.getText();
    
    // Truncate if too large
    if (content.length > (this.options.maxFileSize || 10000)) {
      content = content.substring(0, this.options.maxFileSize || 10000) + '\n... [FILE TRUNCATED] ...';
    }

    return {
      type: 'file',
      filepath,
      content,
      language: document.languageId,
      priority: 5 // Medium priority
    };
  }

  /**
   * Collect context from other open tabs
   */
  private async collectOpenTabs(activeEditor: vscode.TextEditor): Promise<FileContextItem[]> {
    const contextItems: FileContextItem[] = [];
    const activeUri = activeEditor.document.uri;

    // Get visible editors (other tabs)
    for (const editor of vscode.window.visibleTextEditors) {
      if (editor.document.uri.toString() === activeUri.toString()) {
        continue; // Skip active editor
      }

      const document = editor.document;
      const filepath = this.getRelativeFilePath(document.uri);

      if (this.shouldExcludeFile(filepath)) {
        continue;
      }

      let content = document.getText();
      
      // Truncate if too large
      if (content.length > (this.options.maxFileSize || 10000)) {
        content = content.substring(0, this.options.maxFileSize || 10000) + '\n... [FILE TRUNCATED] ...';
      }

      contextItems.push({
        type: 'file',
        filepath,
        content,
        language: document.languageId,
        priority: 3 // Lower priority
      });

      // Limit to reasonable number of tabs
      if (contextItems.length >= 3) {
        break;
      }
    }

    return contextItems;
  }

  /**
   * Get relative file path for display
   */
  private getRelativeFilePath(uri: vscode.Uri): string {
    const workspaceFolder = vscode.workspace.getWorkspaceFolder(uri);
    if (workspaceFolder) {
      return vscode.workspace.asRelativePath(uri);
    }
    return uri.fsPath;
  }

  /**
   * Check if file should be excluded based on patterns
   */
  private shouldExcludeFile(filepath: string): boolean {
    const excludePatterns = this.options.excludePatterns || [];
    
    return excludePatterns.some(pattern => {
      // Simple glob pattern matching
      const regex = new RegExp(pattern.replace(/\*\*/g, '.*').replace(/\*/g, '[^/]*'));
      return regex.test(filepath);
    });
  }

  /**
   * Check if cursor area overlaps with existing selection
   */
  private hasOverlapWithSelection(cursorArea: FileContextItem, existingItems: FileContextItem[]): boolean {
    return existingItems.some(item => 
      item.type === 'selection' && 
      item.filepath === cursorArea.filepath &&
      item.startLine && item.endLine && cursorArea.startLine && cursorArea.endLine &&
      !(item.endLine < cursorArea.startLine || item.startLine > cursorArea.endLine)
    );
  }

  /**
   * Limit total context size by priority and truncation
   */
  private limitContextSize(items: FileContextItem[]): FileContextItem[] {
    // Sort by priority (highest first)
    items.sort((a, b) => b.priority - a.priority);

    const maxTotalSize = this.options.maxTotalSize || 50000;
    let totalSize = 0;
    const limitedItems: FileContextItem[] = [];

    for (const item of items) {
      const itemSize = item.content.length;
      
      if (totalSize + itemSize <= maxTotalSize) {
        limitedItems.push(item);
        totalSize += itemSize;
      } else {
        // Try to fit a truncated version
        const remainingSpace = maxTotalSize - totalSize;
        if (remainingSpace > 500) { // Only truncate if we have reasonable space
          const truncatedItem = {
            ...item,
            content: item.content.substring(0, remainingSpace - 100) + '\n... [CONTEXT TRUNCATED] ...'
          };
          limitedItems.push(truncatedItem);
          break;
        }
      }
    }

    console.log(`[FileContextCollector] Limited context to ${limitedItems.length} items, ${totalSize} chars`);
    return limitedItems;
  }

  /**
   * Update collection options
   */
  updateOptions(newOptions: Partial<FileContextOptions>): void {
    this.options = { ...this.options, ...newOptions };
  }

  /**
   * Get current options
   */
  getOptions(): FileContextOptions {
    return { ...this.options };
  }
}