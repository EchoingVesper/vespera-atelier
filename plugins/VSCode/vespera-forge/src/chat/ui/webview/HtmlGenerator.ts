/**
 * HTML Generator for Chat WebView
 */
import * as vscode from 'vscode';
import * as path from 'path';

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

export function getChatWebViewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const nonce = getNonce();
  
  // Get URIs for resources
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'chat.css')
  );
  
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'chat.js')
  );
  
  // Content Security Policy
  const cspSource = webview.cspSource;
  const csp = `
    default-src 'none';
    style-src ${cspSource} 'unsafe-inline';
    script-src ${cspSource} 'nonce-${nonce}';
    img-src ${cspSource} https: data:;
    font-src ${cspSource};
  `.replace(/\s+/g, ' ').trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Vespera Chat</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="chat-root">
        <!-- Chat interface will be rendered here -->
        <div class="chat-loading">
            <div class="chat-loading__spinner">⟳</div>
            <div class="chat-loading__text">Initializing chat...</div>
        </div>
    </div>
    
    <!-- Templates for dynamic content -->
    <template id="message-template">
        <div class="message" data-message-id="">
            <div class="message__header">
                <span class="message__role"></span>
                <span class="message__timestamp"></span>
                <span class="message__provider"></span>
            </div>
            <div class="message__content">
                <div class="message__text"></div>
                <div class="message__error" style="display: none;"></div>
                <div class="message__usage" style="display: none;"></div>
            </div>
            <div class="message__actions">
                <button class="message__action message__action--copy" title="Copy message">📋</button>
                <button class="message__action message__action--retry" title="Retry message" style="display: none;">🔄</button>
            </div>
        </div>
    </template>
    
    <template id="provider-option-template">
        <div class="provider-selector__option" data-provider-id="">
            <div class="provider-selector__option-content">
                <div class="provider-icon">
                    <span class="provider-icon__main"></span>
                    <span class="provider-icon__status"></span>
                </div>
                <div class="provider-selector__option-info">
                    <span class="provider-selector__option-name"></span>
                    <span class="provider-selector__option-model"></span>
                </div>
                <div class="status-indicator">
                    <div class="status-indicator__dot"></div>
                </div>
            </div>
            <button class="provider-selector__configure" title="Configure provider">⚙️</button>
        </div>
    </template>
    
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

export function getConfigurationFlyoutContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri
): string {
  const nonce = getNonce();
  
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'config', 'config.css')
  );
  
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'config', 'config.js')
  );
  
  const cspSource = webview.cspSource;
  const csp = `
    default-src 'none';
    style-src ${cspSource} 'unsafe-inline';
    script-src ${cspSource} 'nonce-${nonce}';
    img-src ${cspSource} https: data:;
    font-src ${cspSource};
  `.replace(/\s+/g, ' ').trim();

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    <title>Chat Configuration</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="config-root">
        <div class="config-header">
            <h2>Chat Configuration</h2>
            <button class="config-close" title="Close">✕</button>
        </div>
        
        <div class="config-content">
            <div class="config-section">
                <h3>Providers</h3>
                <div id="provider-configs">
                    <!-- Provider configurations will be rendered here -->
                </div>
                <button class="config-button config-button--add">Add Provider</button>
            </div>
            
            <div class="config-section">
                <h3>User Interface</h3>
                <div class="config-field">
                    <label for="theme-select">Theme</label>
                    <select id="theme-select" class="config-select">
                        <option value="auto">Auto</option>
                        <option value="light">Light</option>
                        <option value="dark">Dark</option>
                    </select>
                </div>
                
                <div class="config-field">
                    <label for="layout-select">Layout</label>
                    <select id="layout-select" class="config-select">
                        <option value="embedded">Embedded</option>
                        <option value="sidebar">Sidebar</option>
                        <option value="floating">Floating</option>
                        <option value="panel">Panel</option>
                    </select>
                </div>
                
                <div class="config-field">
                    <label class="config-checkbox">
                        <input type="checkbox" id="show-timestamps">
                        Show timestamps
                    </label>
                </div>
                
                <div class="config-field">
                    <label class="config-checkbox">
                        <input type="checkbox" id="compact-mode">
                        Compact mode
                    </label>
                </div>
            </div>
            
            <div class="config-section">
                <h3>Integration</h3>
                <div class="config-field">
                    <label class="config-checkbox">
                        <input type="checkbox" id="task-integration">
                        Enable task integration
                    </label>
                </div>
                
                <div class="config-field">
                    <label class="config-checkbox">
                        <input type="checkbox" id="auto-suggest-tasks">
                        Auto-suggest tasks from chat
                    </label>
                </div>
            </div>
        </div>
        
        <div class="config-footer">
            <button class="config-button config-button--primary">Save</button>
            <button class="config-button config-button--secondary">Cancel</button>
        </div>
    </div>
    
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}