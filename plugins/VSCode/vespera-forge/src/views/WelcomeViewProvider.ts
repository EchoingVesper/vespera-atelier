/**
 * Welcome View Provider - Simple tree view showing getting started info
 */
import * as vscode from 'vscode';

export class WelcomeViewProvider implements vscode.TreeDataProvider<WelcomeItem> {
  private _onDidChangeTreeData: vscode.EventEmitter<WelcomeItem | undefined | null | void> = new vscode.EventEmitter<WelcomeItem | undefined | null | void>();
  readonly onDidChangeTreeData: vscode.Event<WelcomeItem | undefined | null | void> = this._onDidChangeTreeData.event;

  refresh(): void {
    this._onDidChangeTreeData.fire();
  }

  dispose(): void {
    this._onDidChangeTreeData.dispose();
  }

  getTreeItem(element: WelcomeItem): vscode.TreeItem {
    return element;
  }

  getChildren(element?: WelcomeItem): Thenable<WelcomeItem[]> {
    if (!element) {
      // Root level - show welcome items
      return Promise.resolve([
        new WelcomeItem(
          'Quick Start',
          'Start creating and organizing content',
          vscode.TreeItemCollapsibleState.Expanded,
          'folder'
        ),
        new WelcomeItem(
          'Documentation',
          'Learn more about Vespera Forge',
          vscode.TreeItemCollapsibleState.Collapsed,
          'folder'
        )
      ]);
    }

    if (element.label === 'Quick Start') {
      return Promise.resolve([
        new WelcomeItem(
          'Create Your First Codex',
          'Create a new content entry',
          vscode.TreeItemCollapsibleState.None,
          'action',
          {
            command: 'vespera-forge.createCodex',
            title: 'Create Codex'
          }
        ),
        new WelcomeItem(
          'Browse Templates',
          'Explore available content templates',
          vscode.TreeItemCollapsibleState.None,
          'action',
          {
            command: 'vespera-forge.browseTemplates',
            title: 'Browse Templates'
          }
        ),
        new WelcomeItem(
          'Open Navigator',
          'View all your content',
          vscode.TreeItemCollapsibleState.None,
          'action',
          {
            command: 'vesperaForge.navigatorView.focus',
            title: 'Open Navigator'
          }
        )
      ]);
    }

    if (element.label === 'Documentation') {
      return Promise.resolve([
        new WelcomeItem(
          'Getting Started Guide',
          'Learn the basics',
          vscode.TreeItemCollapsibleState.None,
          'link'
        ),
        new WelcomeItem(
          'Template System',
          'Create custom templates',
          vscode.TreeItemCollapsibleState.None,
          'link'
        ),
        new WelcomeItem(
          'AI Assistant',
          'Use AI to enhance your workflow',
          vscode.TreeItemCollapsibleState.None,
          'link'
        )
      ]);
    }

    return Promise.resolve([]);
  }
}

class WelcomeItem extends vscode.TreeItem {
  public override readonly contextValue: string;

  constructor(
    label: string,
    tooltip: string,
    collapsibleState: vscode.TreeItemCollapsibleState,
    contextValue: string,
    command?: vscode.Command
  ) {
    super(label, collapsibleState);
    this.tooltip = tooltip;
    this.contextValue = contextValue;
    if (command) {
      this.command = command;
    }

    // Set icons based on context
    if (contextValue === 'folder') {
      this.iconPath = new vscode.ThemeIcon('folder');
    } else if (contextValue === 'action') {
      this.iconPath = new vscode.ThemeIcon('play');
    } else if (contextValue === 'link') {
      this.iconPath = new vscode.ThemeIcon('book');
    }
  }
}
