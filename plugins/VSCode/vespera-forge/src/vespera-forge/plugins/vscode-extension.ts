/**
 * VS Code Extension Entry Point
 * Vespera Forge VS Code Extension
 */

import * as vscode from 'vscode';
import { VSCodeAdapter } from '../core/adapters/vscode-adapter';

export function activate(context: vscode.ExtensionContext) {
    console.log('Vespera Forge extension is now active!');

    // Create the adapter
    const adapter = new VSCodeAdapter();

    // Register the webview panel
    const disposable = vscode.commands.registerCommand('vespera-forge.open', () => {
        VesperaForgePanel.createOrShow(context.extensionUri, adapter);
    });

    context.subscriptions.push(disposable);

    // Register command to create new codex
    const createCodexCommand = vscode.commands.registerCommand('vespera-forge.createCodex', () => {
        const panel = VesperaForgePanel.currentPanel;
        if (panel) {
            // Send message to webview to create new codex
            panel.postMessage({
                type: 'createCodex'
            });
        } else {
            VesperaForgePanel.createOrShow(context.extensionUri, adapter);
        }
    });

    context.subscriptions.push(createCodexCommand);

    // Register view container
    vscode.window.registerTreeDataProvider('vespera-forge-explorer', new VesperaForgeTreeDataProvider());

    vscode.commands.registerCommand('vespera-forge.refreshExplorer', () => {
        VesperaForgeTreeDataProvider.instance?.refresh();
    });

    // Status bar item
    const statusBarItem = vscode.window.createStatusBarItem(vscode.StatusBarAlignment.Right, 100);
    statusBarItem.text = '$(book) Vespera Forge';
    statusBarItem.tooltip = 'Open Vespera Forge';
    statusBarItem.command = 'vespera-forge.open';
    statusBarItem.show();
    context.subscriptions.push(statusBarItem);
}

export function deactivate() {}

class VesperaForgePanel {
    public static currentPanel: VesperaForgePanel | undefined;
    public static readonly viewType = 'vespera-forge';

    private readonly _panel: vscode.WebviewPanel;
    private readonly _extensionUri: vscode.Uri;
    private _disposables: vscode.Disposable[] = [];

    public static createOrShow(extensionUri: vscode.Uri, adapter: VSCodeAdapter) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;

        // If we already have a panel, show it
        if (VesperaForgePanel.currentPanel) {
            VesperaForgePanel.currentPanel._panel.reveal(column);
            return;
        }

        // Otherwise, create a new panel
        const panel = vscode.window.createWebviewPanel(
            VesperaForgePanel.viewType,
            'Vespera Forge',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'out'),
                    vscode.Uri.joinPath(extensionUri, 'webview')
                ]
            }
        );

        VesperaForgePanel.currentPanel = new VesperaForgePanel(panel, extensionUri, adapter);
    }

    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, _adapter: VSCodeAdapter) {
        this._panel = panel;
        this._extensionUri = extensionUri;

        // Set the webview's initial html content
        this._update();

        // Listen for when the panel is disposed
        // This happens when the user closes the panel or when the panel is closed programmatically
        this._panel.onDidDispose(() => this.dispose(), null, this._disposables);

        // Handle messages from the webview
        this._panel.webview.onDidReceiveMessage(
            async (message) => {
                switch (message.type) {
                    case 'openFile':
                        const doc = await vscode.workspace.openTextDocument(message.payload.path);
                        await vscode.window.showTextDocument(doc);
                        break;
                    case 'saveFile':
                        try {
                            const fs = require('fs').promises;
                            await fs.writeFile(message.payload.path, message.payload.content, 'utf8');
                            this._panel.webview.postMessage({
                                id: message.id,
                                success: true
                            });
                        } catch (error) {
                            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
                            this._panel.webview.postMessage({
                                id: message.id,
                                success: false,
                                error: errorMessage
                            });
                        }
                        break;
                    case 'showNotification':
                        vscode.window.showInformationMessage(message.payload.message);
                        break;
                    case 'getWorkspaceFolders':
                        const folders = vscode.workspace.workspaceFolders?.map(f => f.uri.fsPath) || [];
                        this._panel.webview.postMessage({
                            type: 'workspaceFolders',
                            payload: folders
                        });
                        break;
                    case 'showInformationMessage':
                        const result = await vscode.window.showInformationMessage(
                            message.payload.message,
                            ...message.payload.items
                        );
                        this._panel.webview.postMessage({
                            id: message.id,
                            result
                        });
                        break;
                    case 'showErrorMessage':
                        const errorResult = await vscode.window.showErrorMessage(
                            message.payload.message,
                            ...message.payload.items
                        );
                        this._panel.webview.postMessage({
                            id: message.id,
                            result: errorResult
                        });
                        break;
                }
            },
            undefined,
            this._disposables
        );
    }

    public postMessage(message: any) {
        this._panel.webview.postMessage(message);
    }

    private _update() {
        const webview = this._panel.webview;
        this._panel.webview.html = this._getHtmlForWebview(webview);
    }

    private _getHtmlForWebview(webview: vscode.Webview) {
        // Use a nonce to only allow specific scripts to be run
        const nonce = getNonce();

        return `<!DOCTYPE html>
        <html lang="en">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline' ${webview.cspSource}; script-src 'nonce-${nonce}'; font-src ${webview.cspSource};">
            <title>Vespera Forge</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    font-size: var(--vscode-font-size);
                    color: var(--vscode-foreground);
                    background-color: var(--vscode-editor-background);
                    margin: 0;
                    padding: 0;
                    height: 100vh;
                    overflow: hidden;
                }
                #root {
                    height: 100vh;
                    width: 100vw;
                }
            </style>
        </head>
        <body>
            <div id="root"></div>
            <script nonce="${nonce}" src="${this._getWebviewScriptUri(webview, 'main.js')}"></script>
        </body>
        </html>`;
    }

    private _getWebviewScriptUri(webview: vscode.Webview, scriptName: string) {
        return webview.asWebviewUri(vscode.Uri.joinPath(this._extensionUri, 'out', scriptName));
    }

    public dispose() {
        VesperaForgePanel.currentPanel = undefined;

        // Clean up our resources
        this._panel.dispose();

        while (this._disposables.length) {
            const x = this._disposables.pop();
            if (x) {
                x.dispose();
            }
        }
    }
}

class VesperaForgeTreeDataProvider implements vscode.TreeDataProvider<vscode.TreeItem> {
    public static instance: VesperaForgeTreeDataProvider;
    private _onDidChangeTreeData: vscode.EventEmitter<vscode.TreeItem | undefined | null | void> = new vscode.EventEmitter<vscode.TreeItem | undefined | null | void>();
    readonly onDidChangeTreeData: vscode.Event<vscode.TreeItem | undefined | null | void> = this._onDidChangeTreeData.event;

    constructor() {
        VesperaForgeTreeDataProvider.instance = this;
    }

    refresh(): void {
        this._onDidChangeTreeData.fire();
    }

    getTreeItem(element: vscode.TreeItem): vscode.TreeItem {
        return element;
    }

    getChildren(element?: vscode.TreeItem): Thenable<vscode.TreeItem[]> {
        if (!element) {
            // Root level
            const openItem = new vscode.TreeItem('Open Vespera Forge', vscode.TreeItemCollapsibleState.None);
            openItem.command = {
                command: 'vespera-forge.open',
                title: 'Open Vespera Forge'
            };

            const createItem = new vscode.TreeItem('Create New Codex', vscode.TreeItemCollapsibleState.None);
            createItem.command = {
                command: 'vespera-forge.createCodex',
                title: 'Create New Codex'
            };

            return Promise.resolve([openItem, createItem]);
        }
        return Promise.resolve([]);
    }
}

function getNonce() {
    let text = '';
    const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
    for (let i = 0; i < 32; i++) {
        text += possible.charAt(Math.floor(Math.random() * possible.length));
    }
    return text;
}
