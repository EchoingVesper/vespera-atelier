/**
 * HTML Generator for Chat WebView with Security Integration
 */
import * as vscode from 'vscode';
import * as path from 'path';
import { VesperaInputSanitizer } from '../../../core/security/sanitization/VesperaInputSanitizer';
import { SanitizationScope } from '../../../types/security';

export function getNonce(): string {
  let text = '';
  const possible = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  for (let i = 0; i < 32; i++) {
    text += possible.charAt(Math.floor(Math.random() * possible.length));
  }
  return text;
}

/**
 * Generate secure Content Security Policy for WebView
 */
export function generateSecureCSP(
  webview: vscode.Webview,
  nonce: string,
  options: WebViewContentOptions
): string {
  const cspSource = webview.cspSource;
  const securityEnabled = options.securityEnabled ?? true;
  
  // Base CSP configuration
  const cspConfig = {
    defaultSrc: ["'none'"],
    styleSrc: [
      cspSource,
      ...(options.allowedStyleSources || []),
      "'unsafe-inline'" // Required for VS Code themes
    ],
    scriptSrc: [
      cspSource,
      `'nonce-${nonce}'`,
      ...(options.allowedScriptSources || [])
    ],
    imgSrc: [
      cspSource,
      "https:",
      "data:"
    ],
    fontSrc: [cspSource],
    connectSrc: securityEnabled ? [cspSource] : [cspSource, "*"],
    mediaSrc: [cspSource],
    objectSrc: ["'none'"],
    childSrc: ["'none'"],
    frameAncestors: ["'none'"],
    baseUri: ["'self'"],
    formAction: ["'none'"]
  };

  // Remove unsafe-inline from scripts if security is strict
  if (securityEnabled && !options.allowedScriptSources?.includes("'unsafe-inline'")) {
    cspConfig.scriptSrc = cspConfig.scriptSrc.filter(src => src !== "'unsafe-inline'");
  }

  // Build CSP string
  const cspParts = [
    `default-src ${cspConfig.defaultSrc.join(' ')}`,
    `style-src ${cspConfig.styleSrc.join(' ')}`,
    `script-src ${cspConfig.scriptSrc.join(' ')}`,
    `img-src ${cspConfig.imgSrc.join(' ')}`,
    `font-src ${cspConfig.fontSrc.join(' ')}`,
    `connect-src ${cspConfig.connectSrc.join(' ')}`,
    `media-src ${cspConfig.mediaSrc.join(' ')}`,
    `object-src ${cspConfig.objectSrc.join(' ')}`,
    `child-src ${cspConfig.childSrc.join(' ')}`,
    `frame-ancestors ${cspConfig.frameAncestors.join(' ')}`,
    `base-uri ${cspConfig.baseUri.join(' ')}`,
    `form-action ${cspConfig.formAction.join(' ')}`
  ];

  if (securityEnabled) {
    cspParts.push('upgrade-insecure-requests');
  }

  return cspParts.join('; ');
}

/**
 * Sanitize HTML content for safe injection
 */
export async function sanitizeHtmlContent(
  html: string,
  context: {
    allowedTags?: string[];
    allowedAttributes?: string[];
    removeScripts?: boolean;
  } = {}
): Promise<string> {
  try {
    const sanitizer = VesperaInputSanitizer.getInstance();
    const result = await sanitizer.sanitize(html, SanitizationScope.HTML_CONTENT, context);
    return result.sanitized || '';
  } catch (error) {
    // Fallback to basic sanitization if security system unavailable
    return basicHtmlSanitization(html);
  }
}

/**
 * Basic HTML sanitization fallback
 */
function basicHtmlSanitization(html: string): string {
  return html
    // Remove script tags
    .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
    // Remove javascript: protocols
    .replace(/javascript:/gi, '')
    // Remove event handlers
    .replace(/on\w+\s*=/gi, '')
    // Remove object/embed tags
    .replace(/<(object|embed|iframe|form|input|textarea)[^>]*>/gi, '')
    // Remove link tags with javascript
    .replace(/<link[^>]*href\s*=\s*['"]*javascript:/gi, '');
}

/**
 * Generate secure template with sanitization
 */
export async function generateSecureTemplate(
  templateId: string,
  content: Record<string, any>,
  options: {
    sanitizeContent?: boolean;
    allowedTags?: string[];
    nonce?: string;
  } = {}
): Promise<string> {
  const { sanitizeContent = true, allowedTags = [], nonce } = options;
  
  let processedContent = { ...content };
  
  // Sanitize content if enabled
  if (sanitizeContent) {
    for (const [key, value] of Object.entries(processedContent)) {
      if (typeof value === 'string') {
        processedContent[key] = await sanitizeHtmlContent(value, { allowedTags });
      }
    }
  }

  // Generate template based on ID
  switch (templateId) {
    case 'message':
      return generateMessageTemplate(processedContent, nonce);
    case 'provider-option':
      return generateProviderOptionTemplate(processedContent, nonce);
    case 'error-notice':
      return generateErrorNoticeTemplate(processedContent, nonce);
    default:
      throw new Error(`Unknown template ID: ${templateId}`);
  }
}

/**
 * Generate secure message template
 */
function generateMessageTemplate(content: any, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  
  return `
    <div class="message" data-message-id="${escapeHtml(content.messageId || '')}">
      <div class="message__header">
        <span class="message__role">${escapeHtml(content.role || 'user')}</span>
        <span class="message__timestamp">${escapeHtml(content.timestamp || '')}</span>
        <span class="message__provider">${escapeHtml(content.provider || '')}</span>
      </div>
      <div class="message__content">
        <div class="message__text">${content.text || ''}</div>
        ${content.error ? `<div class="message__error">${escapeHtml(content.error)}</div>` : ''}
        ${content.usage ? `<div class="message__usage">${escapeHtml(JSON.stringify(content.usage))}</div>` : ''}
      </div>
      <div class="message__actions">
        <button class="message__action message__action--copy" title="Copy message"${nonceAttr}>📋</button>
        ${content.retryable ? `<button class="message__action message__action--retry" title="Retry message"${nonceAttr}>🔄</button>` : ''}
      </div>
    </div>
  `;
}

/**
 * Generate secure provider option template
 */
function generateProviderOptionTemplate(content: any, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  
  return `
    <div class="provider-selector__option" data-provider-id="${escapeHtml(content.providerId || '')}">
      <div class="provider-selector__option-content">
        <div class="provider-icon">
          <span class="provider-icon__main">${escapeHtml(content.icon || '⚡')}</span>
          <span class="provider-icon__status ${content.status || 'unknown'}"></span>
        </div>
        <div class="provider-selector__option-info">
          <span class="provider-selector__option-name">${escapeHtml(content.name || '')}</span>
          <span class="provider-selector__option-model">${escapeHtml(content.model || '')}</span>
        </div>
        <div class="status-indicator">
          <div class="status-indicator__dot status-${content.status || 'unknown'}"></div>
        </div>
      </div>
      <button class="provider-selector__configure" title="Configure provider"${nonceAttr}>⚙️</button>
    </div>
  `;
}

/**
 * Generate secure error notice template
 */
function generateErrorNoticeTemplate(content: any, nonce?: string): string {
  const nonceAttr = nonce ? ` nonce="${nonce}"` : '';
  
  return `
    <div class="error-notice ${content.severity || 'warning'}">
      <div class="error-notice__icon">⚠️</div>
      <div class="error-notice__content">
        <div class="error-notice__title">${escapeHtml(content.title || 'Error')}</div>
        <div class="error-notice__message">${escapeHtml(content.message || '')}</div>
        ${content.details ? `<div class="error-notice__details">${escapeHtml(content.details)}</div>` : ''}
      </div>
      ${content.dismissible ? `<button class="error-notice__dismiss" title="Dismiss"${nonceAttr}>✕</button>` : ''}
    </div>
  `;
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(unsafe: string): string {
  return unsafe
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;');
}

export interface WebViewContentOptions {
  nonce?: string;
  sessionId?: string;
  cspOverride?: string;
  securityEnabled?: boolean;
  allowedScriptSources?: string[];
  allowedStyleSources?: string[];
}

export function getChatWebViewContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options: WebViewContentOptions = {}
): string {
  const nonce = options.nonce || getNonce();
  
  // Get URIs for resources
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'chat.css')
  );
  
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'chat', 'chat.js')
  );
  
  // Generate Content Security Policy
  const csp = options.cspOverride || generateSecureCSP(webview, nonce, options);

  // Add security metadata for debugging
  const securityMeta = options.securityEnabled 
    ? `<meta name="vespera-security" content="enabled" data-session="${escapeHtml(options.sessionId || '')}">`
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta http-equiv="Content-Security-Policy" content="${csp}">
    ${securityMeta}
    <title>Vespera Chat</title>
    <link rel="stylesheet" href="${styleUri}">
</head>
<body>
    <div id="chat-root" data-session-id="${escapeHtml(options.sessionId || '')}" data-security="${options.securityEnabled ? 'enabled' : 'disabled'}">
        <!-- Chat interface will be rendered here -->
        <div class="chat-loading">
            <div class="chat-loading__spinner">⟳</div>
            <div class="chat-loading__text">
              ${options.securityEnabled ? 'Initializing secure chat...' : 'Initializing chat...'}
            </div>
        </div>
        
        <!-- Security status indicator -->
        ${options.securityEnabled ? `
        <div class="security-status" title="Security features enabled">
            <span class="security-status__icon">🔒</span>
            <span class="security-status__text">Secured</span>
        </div>
        ` : ''}
    </div>
    
    <!-- Templates for dynamic content (sanitized) -->
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
                <button class="message__action message__action--copy" title="Copy message" type="button">📋</button>
                <button class="message__action message__action--retry" title="Retry message" style="display: none;" type="button">🔄</button>
            </div>
        </div>
    </template>
    
    <template id="provider-option-template">
        <div class="provider-selector__option" data-provider-id="">
            <div class="provider-selector__option-content">
                <div class="provider-icon">
                    <span class="provider-icon__main">⚡</span>
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
            <button class="provider-selector__configure" title="Configure provider" type="button">⚙️</button>
        </div>
    </template>

    <template id="error-notice-template">
        <div class="error-notice">
            <div class="error-notice__icon">⚠️</div>
            <div class="error-notice__content">
                <div class="error-notice__title"></div>
                <div class="error-notice__message"></div>
                <div class="error-notice__details" style="display: none;"></div>
            </div>
            <button class="error-notice__dismiss" title="Dismiss" type="button" style="display: none;">✕</button>
        </div>
    </template>
    
    <script nonce="${nonce}" src="${scriptUri}"></script>
</body>
</html>`;
}

export function getConfigurationFlyoutContent(
  webview: vscode.Webview,
  extensionUri: vscode.Uri,
  options: WebViewContentOptions = {}
): string {
  const nonce = options.nonce || getNonce();
  
  const styleUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'config', 'config.css')
  );
  
  const scriptUri = webview.asWebviewUri(
    vscode.Uri.joinPath(extensionUri, 'media', 'config', 'config.js')
  );
  
  // Generate secure CSP for configuration flyout
  const csp = options.cspOverride || generateSecureCSP(webview, nonce, {
    ...options,
    securityEnabled: options.securityEnabled ?? true
  });

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