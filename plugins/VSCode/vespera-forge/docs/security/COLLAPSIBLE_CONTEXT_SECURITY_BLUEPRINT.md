# Collapsible Context Security Implementation Blueprint
**Security Architecture Agent - Phase 1 Detailed Implementation**

## Overview

This blueprint provides step-by-step security implementation guidance for the collapsible context display system, addressing Issues #41, #42, #49, and #50 with enterprise-grade security patterns.

## Security Requirements Analysis

### Current Vulnerabilities
1. **XSS in Context Display**: Raw HTML injection in context foldouts
2. **UI State Manipulation**: Persistent state without validation
3. **Memory Leaks**: No secure cleanup of context resources
4. **Path Traversal**: File links without proper validation

### Security Objectives
- **Zero XSS Risk**: All content sanitized and CSP-enforced
- **Validated Persistence**: All UI state changes validated and rate-limited
- **Memory Security**: Proper resource cleanup and disposal
- **Secure Navigation**: File links with path traversal protection

## Detailed Implementation Plan

### 1. Secure Context State Management

#### 1.1 Create SecureContextStateManager.ts

```typescript
/**
 * Secure Context State Manager
 * Handles persistent context UI state with comprehensive security validation
 */

import * as vscode from 'vscode';
import { SecurityEnhancedCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { VesperaInputSanitizer, SanitizationScope } from '../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityEvent } from '../types/security';
import { VesperaThreatError, VesperaRateLimitError } from '../core/security/VesperaSecurityErrors';

export interface SecureContextState {
  readonly sessionId: string;
  readonly isCollapsed: boolean;
  readonly contextVisible: boolean;
  readonly persistentAcrossSessions: boolean;
  readonly lastModified: number;
  readonly securityChecksum: string;
  readonly version: number;
}

export interface ContextStateValidationResult {
  isValid: boolean;
  sanitizedState?: SecureContextState;
  threats: ThreatInfo[];
  errors: string[];
}

export class SecureContextStateManager implements vscode.Disposable {
  private static readonly STATE_KEY_PREFIX = 'secure_context_state_';
  private static readonly MAX_STATES_PER_SESSION = 50;
  private static readonly STATE_EXPIRY_MS = 24 * 60 * 60 * 1000; // 24 hours
  
  private readonly stateCache = new Map<string, SecureContextState>();
  private readonly cleanupTimer: NodeJS.Timer;
  private disposed = false;

  constructor(
    private readonly context: vscode.ExtensionContext,
    private readonly securityServices: SecurityEnhancedCoreServices,
    private readonly logger = securityServices.logger.createChild('SecureContextState')
  ) {
    // Periodic cleanup of expired states
    this.cleanupTimer = setInterval(() => {
      this.cleanupExpiredStates();
    }, 60 * 60 * 1000); // Cleanup every hour
  }

  /**
   * Securely persist context state with validation and rate limiting
   */
  async persistState(
    sessionId: string, 
    newState: Partial<Omit<SecureContextState, 'sessionId' | 'lastModified' | 'securityChecksum' | 'version'>>
  ): Promise<void> {
    if (this.disposed) {
      throw new Error('SecureContextStateManager has been disposed');
    }

    try {
      // 1. Rate limiting check
      const rateLimitKey = `context_state_${sessionId}`;
      if (!await this.securityServices.rateLimiter.checkLimit(rateLimitKey, sessionId, {
        maxRequests: 20,  // Max 20 state changes per minute
        windowMs: 60000,
        burstLimit: 5     // Max 5 rapid state changes
      })) {
        throw new VesperaRateLimitError('Context state change rate limit exceeded');
      }

      // 2. Input validation
      const validationResult = await this.validateStateInput(sessionId, newState);
      if (!validationResult.isValid) {
        await this.logSecurityViolation(sessionId, validationResult.threats, validationResult.errors);
        throw new VesperaThreatError('Invalid context state data', validationResult.threats);
      }

      // 3. Create secure state object
      const currentState = await this.getState(sessionId);
      const secureState: SecureContextState = {
        sessionId,
        isCollapsed: newState.isCollapsed ?? currentState?.isCollapsed ?? true,
        contextVisible: newState.contextVisible ?? currentState?.contextVisible ?? false,
        persistentAcrossSessions: newState.persistentAcrossSessions ?? currentState?.persistentAcrossSessions ?? false,
        lastModified: Date.now(),
        version: (currentState?.version ?? 0) + 1,
        securityChecksum: this.generateSecurityChecksum(sessionId, newState)
      };

      // 4. Secure storage
      await this.storeSecureState(secureState);
      
      // 5. Update cache
      this.stateCache.set(sessionId, secureState);

      // 6. Audit logging
      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.USER_ACTION,
        {
          timestamp: Date.now(),
          userId: sessionId,
          resourceId: 'context_state',
          metadata: {
            action: 'state_persisted',
            collapsed: secureState.isCollapsed,
            visible: secureState.contextVisible,
            version: secureState.version
          }
        }
      );

      this.logger.debug('Context state persisted successfully', {
        sessionId,
        version: secureState.version,
        collapsed: secureState.isCollapsed
      });

    } catch (error) {
      this.logger.error('Failed to persist context state', error, { sessionId });
      await this.securityServices.errorHandler.handleError(error as Error, {
        context: 'context_state_persistence',
        sessionId
      });
      throw error;
    }
  }

  /**
   * Securely retrieve context state with validation
   */
  async getState(sessionId: string): Promise<SecureContextState | null> {
    if (this.disposed) {
      throw new Error('SecureContextStateManager has been disposed');
    }

    try {
      // 1. Check cache first
      const cached = this.stateCache.get(sessionId);
      if (cached && this.isStateValid(cached)) {
        return cached;
      }

      // 2. Retrieve from storage
      const storageKey = `${SecureContextStateManager.STATE_KEY_PREFIX}${sessionId}`;
      const storedState = this.context.globalState.get<SecureContextState>(storageKey);
      
      if (!storedState) {
        return null;
      }

      // 3. Validate stored state
      const validationResult = await this.validateStoredState(storedState);
      if (!validationResult.isValid) {
        this.logger.warn('Invalid stored state detected, clearing', {
          sessionId,
          threats: validationResult.threats,
          errors: validationResult.errors
        });
        
        await this.clearState(sessionId);
        return null;
      }

      // 4. Update cache and return
      this.stateCache.set(sessionId, validationResult.sanitizedState!);
      return validationResult.sanitizedState!;

    } catch (error) {
      this.logger.error('Failed to retrieve context state', error, { sessionId });
      return null;
    }
  }

  /**
   * Validate input state data
   */
  private async validateStateInput(
    sessionId: string, 
    state: Partial<SecureContextState>
  ): Promise<ContextStateValidationResult> {
    const errors: string[] = [];
    const threats: ThreatInfo[] = [];

    // 1. Session ID validation
    const sessionValidation = await this.securityServices.inputSanitizer.sanitize(
      sessionId,
      SanitizationScope.SESSION_ID
    );
    
    if (sessionValidation.blocked) {
      threats.push(...sessionValidation.threats.map(t => this.convertThreat(t)));
      errors.push('Invalid session ID');
    }

    // 2. Boolean field validation
    if (state.isCollapsed !== undefined && typeof state.isCollapsed !== 'boolean') {
      errors.push('isCollapsed must be boolean');
    }

    if (state.contextVisible !== undefined && typeof state.contextVisible !== 'boolean') {
      errors.push('contextVisible must be boolean');
    }

    if (state.persistentAcrossSessions !== undefined && typeof state.persistentAcrossSessions !== 'boolean') {
      errors.push('persistentAcrossSessions must be boolean');
    }

    // 3. Check session limits
    const sessionStates = await this.getSessionStateCount(sessionId);
    if (sessionStates >= SecureContextStateManager.MAX_STATES_PER_SESSION) {
      errors.push('Maximum states per session exceeded');
    }

    const isValid = errors.length === 0 && threats.length === 0;

    return {
      isValid,
      sanitizedState: isValid ? {
        sessionId: sessionValidation.sanitized,
        isCollapsed: state.isCollapsed ?? true,
        contextVisible: state.contextVisible ?? false,
        persistentAcrossSessions: state.persistentAcrossSessions ?? false,
        lastModified: Date.now(),
        version: 1,
        securityChecksum: ''
      } as SecureContextState : undefined,
      threats,
      errors
    };
  }

  /**
   * Generate security checksum for state integrity
   */
  private generateSecurityChecksum(sessionId: string, state: Partial<SecureContextState>): string {
    const crypto = require('crypto');
    const data = JSON.stringify({
      sessionId,
      isCollapsed: state.isCollapsed,
      contextVisible: state.contextVisible,
      persistentAcrossSessions: state.persistentAcrossSessions,
      timestamp: Math.floor(Date.now() / 1000) // Round to second for stability
    });
    
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }

  /**
   * Validate stored state integrity
   */
  private async validateStoredState(state: SecureContextState): Promise<ContextStateValidationResult> {
    const errors: string[] = [];
    const threats: ThreatInfo[] = [];

    // 1. Expiry check
    if (Date.now() - state.lastModified > SecureContextStateManager.STATE_EXPIRY_MS) {
      errors.push('State expired');
    }

    // 2. Structure validation
    if (!state.sessionId || typeof state.sessionId !== 'string') {
      errors.push('Invalid sessionId');
    }

    // 3. Checksum validation
    const expectedChecksum = this.generateSecurityChecksum(state.sessionId, state);
    if (state.securityChecksum !== expectedChecksum) {
      threats.push({
        type: 'tampering',
        severity: 'high',
        patterns: ['checksum_mismatch'],
        blocked: true
      });
      errors.push('State integrity check failed');
    }

    // 4. Sanitize fields
    let sanitizedState: SecureContextState | undefined;
    if (errors.length === 0 && threats.length === 0) {
      sanitizedState = {
        sessionId: state.sessionId,
        isCollapsed: Boolean(state.isCollapsed),
        contextVisible: Boolean(state.contextVisible),
        persistentAcrossSessions: Boolean(state.persistentAcrossSessions),
        lastModified: Number(state.lastModified),
        version: Number(state.version),
        securityChecksum: String(state.securityChecksum)
      };
    }

    return {
      isValid: errors.length === 0 && threats.length === 0,
      sanitizedState,
      threats,
      errors
    };
  }

  /**
   * Clear state securely
   */
  async clearState(sessionId: string): Promise<void> {
    if (this.disposed) return;

    try {
      const storageKey = `${SecureContextStateManager.STATE_KEY_PREFIX}${sessionId}`;
      await this.context.globalState.update(storageKey, undefined);
      this.stateCache.delete(sessionId);

      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.DATA_DELETION,
        {
          timestamp: Date.now(),
          userId: sessionId,
          resourceId: 'context_state',
          metadata: { action: 'state_cleared' }
        }
      );

      this.logger.debug('Context state cleared', { sessionId });
    } catch (error) {
      this.logger.error('Failed to clear context state', error, { sessionId });
    }
  }

  // Helper methods...
  private isStateValid(state: SecureContextState): boolean {
    return Date.now() - state.lastModified < SecureContextStateManager.STATE_EXPIRY_MS;
  }

  private async getSessionStateCount(sessionId: string): Promise<number> {
    // Implementation to count states per session
    return this.stateCache.size; // Simplified for example
  }

  private convertThreat(threat: any): ThreatInfo {
    return {
      type: threat.type,
      severity: threat.severity,
      patterns: threat.patterns,
      blocked: threat.blocked
    };
  }

  private async logSecurityViolation(sessionId: string, threats: ThreatInfo[], errors: string[]): Promise<void> {
    await this.securityServices.securityAuditLogger.logSecurityEvent(
      VesperaSecurityEvent.VALIDATION_FAILED,
      {
        timestamp: Date.now(),
        userId: sessionId,
        resourceId: 'context_state',
        threats,
        metadata: { errors }
      }
    );
  }

  private async storeSecureState(state: SecureContextState): Promise<void> {
    const storageKey = `${SecureContextStateManager.STATE_KEY_PREFIX}${state.sessionId}`;
    await this.context.globalState.update(storageKey, state);
  }

  private async cleanupExpiredStates(): Promise<void> {
    if (this.disposed) return;

    const now = Date.now();
    const expiredSessions: string[] = [];

    for (const [sessionId, state] of this.stateCache.entries()) {
      if (now - state.lastModified > SecureContextStateManager.STATE_EXPIRY_MS) {
        expiredSessions.push(sessionId);
      }
    }

    for (const sessionId of expiredSessions) {
      await this.clearState(sessionId);
    }

    if (expiredSessions.length > 0) {
      this.logger.debug('Cleaned up expired states', { count: expiredSessions.length });
    }
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;

    clearInterval(this.cleanupTimer);
    this.stateCache.clear();
    this.disposed = true;

    this.logger.debug('SecureContextStateManager disposed');
  }
}
```

### 2. Secure Context Display Component

#### 2.1 Create SecureContextRenderer.ts

```typescript
/**
 * Secure Context Renderer
 * Handles XSS-safe rendering of collapsible context displays
 */

import * as vscode from 'vscode';
import { SecurityEnhancedCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { SanitizationScope } from '../core/security/sanitization/VesperaInputSanitizer';
import { WebViewSecurityManager } from './WebViewSecurityManager';
import { SecureContextStateManager, SecureContextState } from './SecureContextStateManager';

export interface ContextRenderConfig {
  maxFilePathLength: number;
  maxContentPreview: number;
  allowedFileExtensions: string[];
  sanitizeFileContent: boolean;
  enableLineNumbers: boolean;
  enableSyntaxHighlighting: boolean;
}

export interface SecureContextDisplayData {
  sessionId: string;
  contextItems: SecureFileContextItem[];
  isCollapsed: boolean;
  metadata: ContextMetadata;
  renderConfig: ContextRenderConfig;
}

export interface SecureFileContextItem {
  readonly sanitizedFilePath: string;
  readonly originalFilePath: string; // For audit trail only
  readonly sanitizedContent: string;
  readonly contentPreview: string;
  readonly fileType: string;
  readonly startLine?: number;
  readonly endLine?: number;
  readonly securityValidated: boolean;
  readonly threats: ThreatInfo[];
}

export class SecureContextRenderer implements vscode.Disposable {
  private static readonly CONTENT_MAX_LENGTH = 10000;
  private static readonly FILE_PATH_MAX_LENGTH = 200;
  
  private readonly renderCache = new Map<string, string>();
  private disposed = false;

  constructor(
    private readonly securityServices: SecurityEnhancedCoreServices,
    private readonly webViewSecurity: WebViewSecurityManager,
    private readonly stateManager: SecureContextStateManager,
    private readonly logger = securityServices.logger.createChild('SecureContextRenderer')
  ) {}

  /**
   * Render secure context display with XSS protection
   */
  async renderContextDisplay(displayData: SecureContextDisplayData): Promise<string> {
    if (this.disposed) {
      throw new Error('SecureContextRenderer has been disposed');
    }

    try {
      // 1. Validate display data
      const validationResult = await this.validateDisplayData(displayData);
      if (!validationResult.isValid) {
        return this.renderSecurityWarning(validationResult.errors);
      }

      // 2. Check render cache
      const cacheKey = this.generateCacheKey(displayData);
      const cached = this.renderCache.get(cacheKey);
      if (cached) {
        return cached;
      }

      // 3. Render secure HTML
      const secureHtml = await this.renderSecureHtml(displayData);
      
      // 4. Apply CSP and final security validation
      const finalHtml = await this.applySecurityPolicies(secureHtml, displayData.sessionId);
      
      // 5. Cache result
      this.renderCache.set(cacheKey, finalHtml);
      
      return finalHtml;

    } catch (error) {
      this.logger.error('Context rendering failed', error, {
        sessionId: displayData.sessionId,
        itemCount: displayData.contextItems.length
      });
      
      return this.renderErrorDisplay('Context rendering failed due to security restrictions');
    }
  }

  /**
   * Render secure HTML structure
   */
  private async renderSecureHtml(displayData: SecureContextDisplayData): Promise<string> {
    const { sessionId, contextItems, isCollapsed, metadata } = displayData;
    
    // Generate secure nonce for this render
    const nonce = this.generateSecureNonce();
    
    const html = `
      <div class="secure-context-display" 
           data-session-id="${this.sanitizeAttribute(sessionId)}"
           data-security-validated="true"
           data-render-time="${Date.now()}">
        
        <div class="context-toggle" 
             data-collapsed="${isCollapsed}"
             role="button" 
             tabindex="0"
             aria-expanded="${!isCollapsed}"
             aria-controls="context-content-${sessionId}">
          
          <span class="context-toggle-icon" aria-hidden="true">
            ${isCollapsed ? '▶' : '▼'}
          </span>
          
          <span class="context-toggle-text">
            Context (${contextItems.length} items)
          </span>
          
          <span class="context-metadata">
            ${this.renderSecureMetadata(metadata)}
          </span>
        </div>

        <div class="context-content" 
             id="context-content-${sessionId}"
             aria-hidden="${isCollapsed}"
             style="display: ${isCollapsed ? 'none' : 'block'}">
          ${await this.renderContextItems(contextItems, nonce)}
        </div>
      </div>`;

    return html;
  }

  /**
   * Render individual context items securely
   */
  private async renderContextItems(items: SecureFileContextItem[], nonce: string): Promise<string> {
    const renderedItems: string[] = [];

    for (const item of items) {
      if (!item.securityValidated) {
        this.logger.warn('Skipping unvalidated context item', { 
          filePath: item.originalFilePath 
        });
        continue;
      }

      const itemHtml = await this.renderContextItem(item, nonce);
      renderedItems.push(itemHtml);
    }

    return renderedItems.join('\n');
  }

  /**
   * Render single context item with security
   */
  private async renderContextItem(item: SecureFileContextItem, nonce: string): Promise<string> {
    const sanitizedPath = await this.sanitizeDisplayPath(item.sanitizedFilePath);
    const sanitizedContent = await this.sanitizeContentForDisplay(item.sanitizedContent);
    
    return `
      <div class="context-item" data-file-type="${this.sanitizeAttribute(item.fileType)}">
        <div class="context-item-header">
          <div class="context-file-info">
            <span class="context-file-icon">${this.getFileIcon(item.fileType)}</span>
            <button class="context-file-link secure-file-link" 
                    data-file-path="${this.sanitizeAttribute(item.sanitizedFilePath)}"
                    data-start-line="${item.startLine || 0}"
                    data-security-validated="true"
                    title="Open ${sanitizedPath}">
              ${sanitizedPath}
            </button>
            ${item.startLine ? `<span class="context-line-info">:${item.startLine}${item.endLine && item.endLine !== item.startLine ? `-${item.endLine}` : ''}</span>` : ''}
          </div>
          
          ${item.threats.length > 0 ? `
            <div class="context-security-warning" title="Security threats detected">
              ⚠️ ${item.threats.length} security issue${item.threats.length > 1 ? 's' : ''} detected
            </div>
          ` : ''}
        </div>

        <div class="context-item-content">
          <pre class="context-content-code" 
               data-language="${this.sanitizeAttribute(item.fileType)}"
               data-nonce="${nonce}"><code>${sanitizedContent}</code></pre>
          
          ${item.contentPreview !== item.sanitizedContent ? `
            <div class="context-content-truncated">
              <small>Content truncated for security. Full content available in file.</small>
            </div>
          ` : ''}
        </div>
      </div>`;
  }

  /**
   * Validate display data for security
   */
  private async validateDisplayData(displayData: SecureContextDisplayData): Promise<{
    isValid: boolean;
    errors: string[];
  }> {
    const errors: string[] = [];

    // Session ID validation
    if (!displayData.sessionId || typeof displayData.sessionId !== 'string') {
      errors.push('Invalid session ID');
    }

    // Context items validation
    if (!Array.isArray(displayData.contextItems)) {
      errors.push('Invalid context items array');
    } else {
      for (const item of displayData.contextItems) {
        if (!item.securityValidated) {
          errors.push('Unvalidated context item detected');
        }
        if (item.sanitizedContent.length > SecureContextRenderer.CONTENT_MAX_LENGTH) {
          errors.push('Content length exceeds security limits');
        }
      }
    }

    return {
      isValid: errors.length === 0,
      errors
    };
  }

  /**
   * Apply Content Security Policy and final validation
   */
  private async applySecurityPolicies(html: string, sessionId: string): Promise<string> {
    // 1. Generate CSP for this content
    const csp = this.webViewSecurity.generateCSP({
      context: 'vespera_context_display',
      nonce: this.generateSecureNonce(),
      allowInlineScripts: false,
      allowInlineStyles: false,
      additionalSources: ['vscode-resource:']
    });

    // 2. Final HTML sanitization
    const sanitizationResult = await this.webViewSecurity.sanitizeHtmlContent(html, {
      allowedTags: [
        'div', 'span', 'button', 'pre', 'code', 'small'
      ],
      allowedAttributes: [
        'class', 'data-*', 'role', 'tabindex', 'aria-*', 'title'
      ],
      removeScripts: true
    });

    if (sanitizationResult.threats.length > 0) {
      this.logger.warn('Security threats in rendered HTML', {
        sessionId,
        threats: sanitizationResult.threats
      });
    }

    return sanitizationResult.sanitizedHtml;
  }

  // Utility methods...
  private sanitizeAttribute(value: string): string {
    return value.replace(/[<>"'&]/g, (match) => {
      switch (match) {
        case '<': return '&lt;';
        case '>': return '&gt;';
        case '"': return '&quot;';
        case "'": return '&#39;';
        case '&': return '&amp;';
        default: return match;
      }
    });
  }

  private async sanitizeDisplayPath(filePath: string): Promise<string> {
    const result = await this.securityServices.inputSanitizer.sanitize(
      filePath,
      SanitizationScope.FILE_PATH
    );
    
    if (result.blocked) {
      return '[REDACTED]';
    }

    // Truncate if too long
    const sanitized = result.sanitized;
    if (sanitized.length > SecureContextRenderer.FILE_PATH_MAX_LENGTH) {
      return '...' + sanitized.substring(sanitized.length - SecureContextRenderer.FILE_PATH_MAX_LENGTH);
    }

    return sanitized;
  }

  private async sanitizeContentForDisplay(content: string): Promise<string> {
    const result = await this.securityServices.inputSanitizer.sanitize(
      content,
      SanitizationScope.FILE_CONTENT
    );
    
    if (result.blocked) {
      return '[CONTENT BLOCKED DUE TO SECURITY POLICY]';
    }

    // HTML escape for safe display
    return this.sanitizeAttribute(result.sanitized);
  }

  private generateCacheKey(displayData: SecureContextDisplayData): string {
    const crypto = require('crypto');
    const keyData = {
      sessionId: displayData.sessionId,
      itemCount: displayData.contextItems.length,
      collapsed: displayData.isCollapsed,
      contentHash: displayData.contextItems.map(i => i.sanitizedContent.substring(0, 100)).join('')
    };
    
    return crypto.createHash('md5').update(JSON.stringify(keyData)).digest('hex');
  }

  private generateSecureNonce(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(16).toString('hex');
  }

  private renderSecureMetadata(metadata: ContextMetadata): string {
    return `<span class="context-size">${metadata.totalSize} chars</span>`;
  }

  private getFileIcon(fileType: string): string {
    const iconMap: Record<string, string> = {
      'typescript': '📘',
      'javascript': '📄',
      'python': '🐍',
      'json': '📋',
      'markdown': '📝',
      'css': '🎨',
      'html': '🌐'
    };
    
    return iconMap[fileType] || '📄';
  }

  private renderSecurityWarning(errors: string[]): string {
    return `
      <div class="context-security-error">
        <div class="security-error-icon">🚨</div>
        <div class="security-error-message">
          Context display blocked due to security policy violations:
          <ul>
            ${errors.map(error => `<li>${this.sanitizeAttribute(error)}</li>`).join('')}
          </ul>
        </div>
      </div>`;
  }

  private renderErrorDisplay(message: string): string {
    return `
      <div class="context-error">
        <div class="context-error-icon">❌</div>
        <div class="context-error-message">${this.sanitizeAttribute(message)}</div>
      </div>`;
  }

  dispose(): void {
    if (this.disposed) return;
    
    this.renderCache.clear();
    this.disposed = true;
    
    this.logger.debug('SecureContextRenderer disposed');
  }
}
```

### 3. WebView JavaScript Security Enhancement

#### 3.1 Secure Client-Side Implementation

```javascript
/**
 * Secure Context Display Client-Side Implementation
 * Handles user interactions with XSS protection and CSP compliance
 */

class SecureContextDisplayClient {
  constructor() {
    this.sessionId = this.generateSessionId();
    this.validator = new ClientSideValidator();
    this.eventHandlers = new Map();
    this.disposed = false;
    
    this.initialize();
  }

  initialize() {
    this.setupCSPValidation();
    this.bindSecureEventHandlers();
    this.setupContextToggleHandlers();
    this.validateDOMSecurity();
  }

  /**
   * Setup Content Security Policy validation
   */
  setupCSPValidation() {
    // Verify CSP is active
    if (!this.isCSPActive()) {
      console.error('[SecureContext] CSP not active - security risk');
      this.showSecurityWarning('Content Security Policy not active');
      return;
    }

    // Monitor for CSP violations
    document.addEventListener('securitypolicyviolation', (event) => {
      console.error('[SecureContext] CSP violation:', event);
      this.handleCSPViolation(event);
    });
  }

  /**
   * Bind secure event handlers for context interaction
   */
  bindSecureEventHandlers() {
    // Context toggle handlers
    document.addEventListener('click', (event) => {
      if (event.target.matches('.context-toggle')) {
        this.handleSecureToggle(event);
      }
    });

    // Secure file link handlers
    document.addEventListener('click', (event) => {
      if (event.target.matches('.secure-file-link')) {
        event.preventDefault();
        this.handleSecureFileLink(event);
      }
    });

    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
      if (event.target.matches('.context-toggle') && (event.key === 'Enter' || event.key === ' ')) {
        event.preventDefault();
        this.handleSecureToggle(event);
      }
    });
  }

  /**
   * Handle secure context toggle
   */
  async handleSecureToggle(event) {
    if (this.disposed) return;

    const toggleElement = event.target.closest('.context-toggle');
    if (!toggleElement) return;

    // Validate element security
    if (!this.validateElementSecurity(toggleElement)) {
      console.error('[SecureContext] Invalid toggle element');
      return;
    }

    const contextDisplay = toggleElement.closest('.secure-context-display');
    const sessionId = contextDisplay?.getAttribute('data-session-id');
    
    if (!sessionId || !this.validator.isValidSessionId(sessionId)) {
      console.error('[SecureContext] Invalid session ID');
      return;
    }

    const isCurrentlyCollapsed = toggleElement.getAttribute('data-collapsed') === 'true';
    const newCollapsedState = !isCurrentlyCollapsed;

    try {
      // Send secure message to extension
      await this.sendSecureMessage({
        type: 'toggleContext',
        data: {
          sessionId: sessionId,
          collapsed: newCollapsedState
        }
      });

      // Update UI optimistically (will be confirmed by extension)
      this.updateToggleUI(toggleElement, newCollapsedState);

    } catch (error) {
      console.error('[SecureContext] Toggle failed:', error);
      this.showSecurityWarning('Context toggle failed due to security restrictions');
    }
  }

  /**
   * Handle secure file link navigation
   */
  async handleSecureFileLink(event) {
    if (this.disposed) return;

    const linkElement = event.target;
    
    // Validate security attributes
    if (linkElement.getAttribute('data-security-validated') !== 'true') {
      console.error('[SecureContext] Unvalidated file link');
      return;
    }

    const filePath = linkElement.getAttribute('data-file-path');
    const startLine = parseInt(linkElement.getAttribute('data-start-line') || '0');

    // Validate file path
    if (!filePath || !this.validator.isValidFilePath(filePath)) {
      console.error('[SecureContext] Invalid file path:', filePath);
      return;
    }

    // Validate line number
    if (isNaN(startLine) || startLine < 0 || startLine > 1000000) {
      console.error('[SecureContext] Invalid line number:', startLine);
      return;
    }

    try {
      await this.sendSecureMessage({
        type: 'openFile',
        data: {
          filePath: filePath,
          lineNumber: startLine
        }
      });
    } catch (error) {
      console.error('[SecureContext] File navigation failed:', error);
      this.showSecurityWarning('File navigation blocked by security policy');
    }
  }

  /**
   * Send secure message to VS Code extension
   */
  async sendSecureMessage(message) {
    // Input validation
    if (!this.validator.isValidMessage(message)) {
      throw new Error('Invalid message format');
    }

    // Add security metadata
    const secureMessage = {
      ...message,
      timestamp: Date.now(),
      sessionId: this.sessionId,
      nonce: this.generateNonce(),
      securityVersion: '1.0'
    };

    // Send to extension
    vscode.postMessage(secureMessage);
  }

  /**
   * Update toggle UI state securely
   */
  updateToggleUI(toggleElement, collapsed) {
    // Validate inputs
    if (!toggleElement || typeof collapsed !== 'boolean') {
      console.error('[SecureContext] Invalid toggle update parameters');
      return;
    }

    const contextContent = document.getElementById(
      toggleElement.getAttribute('aria-controls')
    );

    if (!contextContent) {
      console.error('[SecureContext] Context content element not found');
      return;
    }

    // Update attributes securely
    toggleElement.setAttribute('data-collapsed', collapsed.toString());
    toggleElement.setAttribute('aria-expanded', (!collapsed).toString());
    
    // Update icon
    const icon = toggleElement.querySelector('.context-toggle-icon');
    if (icon) {
      icon.textContent = collapsed ? '▶' : '▼';
    }

    // Update content visibility
    contextContent.style.display = collapsed ? 'none' : 'block';
    contextContent.setAttribute('aria-hidden', collapsed.toString());

    // Add transition class for smooth animation
    contextContent.classList.toggle('expanding', !collapsed);
    contextContent.classList.toggle('collapsing', collapsed);
  }

  /**
   * Validate element security
   */
  validateElementSecurity(element) {
    // Check for security validation attribute
    const contextDisplay = element.closest('.secure-context-display');
    if (!contextDisplay) return false;

    const isValidated = contextDisplay.getAttribute('data-security-validated') === 'true';
    const hasSessionId = contextDisplay.hasAttribute('data-session-id');
    
    return isValidated && hasSessionId;
  }

  /**
   * Check if CSP is active
   */
  isCSPActive() {
    try {
      // Try to execute a simple inline script
      eval('1+1');
      return false; // CSP should block eval
    } catch (e) {
      return true; // CSP is working
    }
  }

  /**
   * Handle CSP violations
   */
  handleCSPViolation(event) {
    console.error('[SecureContext] CSP Violation:', {
      blockedURI: event.blockedURI,
      violatedDirective: event.violatedDirective,
      originalPolicy: event.originalPolicy
    });

    // Report to extension for audit logging
    this.sendSecureMessage({
      type: 'securityViolation',
      data: {
        type: 'csp_violation',
        details: {
          blockedURI: event.blockedURI,
          violatedDirective: event.violatedDirective
        }
      }
    });
  }

  /**
   * Validate DOM security on initialization
   */
  validateDOMSecurity() {
    // Check for potentially dangerous elements
    const scripts = document.querySelectorAll('script:not([nonce])');
    if (scripts.length > 0) {
      console.warn('[SecureContext] Non-nonce scripts detected');
    }

    // Validate all context displays have security attributes
    const contextDisplays = document.querySelectorAll('.secure-context-display');
    contextDisplays.forEach(display => {
      if (display.getAttribute('data-security-validated') !== 'true') {
        console.error('[SecureContext] Unvalidated context display detected');
        display.remove();
      }
    });
  }

  /**
   * Show security warning to user
   */
  showSecurityWarning(message) {
    const warningElement = document.createElement('div');
    warningElement.className = 'security-warning-toast';
    warningElement.innerHTML = `
      <div class="security-warning-icon">⚠️</div>
      <div class="security-warning-message">${this.escapeHtml(message)}</div>
      <button class="security-warning-close">&times;</button>
    `;

    document.body.appendChild(warningElement);

    // Auto-remove after 5 seconds
    setTimeout(() => {
      if (warningElement.parentNode) {
        warningElement.parentNode.removeChild(warningElement);
      }
    }, 5000);

    // Close button handler
    warningElement.querySelector('.security-warning-close').addEventListener('click', () => {
      warningElement.remove();
    });
  }

  /**
   * Generate secure session ID
   */
  generateSessionId() {
    const crypto = window.crypto || window.msCrypto;
    if (!crypto) {
      console.warn('[SecureContext] Crypto API not available, using fallback');
      return 'fallback_' + Date.now() + '_' + Math.random().toString(36);
    }

    const array = new Uint8Array(16);
    crypto.getRandomValues(array);
    return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
  }

  /**
   * Generate secure nonce
   */
  generateNonce() {
    return this.generateSessionId();
  }

  /**
   * Escape HTML to prevent XSS
   */
  escapeHtml(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Dispose of the client
   */
  dispose() {
    if (this.disposed) return;

    // Clear event handlers
    this.eventHandlers.clear();
    
    // Remove DOM listeners would be removed by garbage collection
    // but we can clean up any direct references
    
    this.disposed = true;
    console.log('[SecureContext] Client disposed');
  }
}

/**
 * Client-side validation utilities
 */
class ClientSideValidator {
  isValidSessionId(sessionId) {
    return typeof sessionId === 'string' && 
           sessionId.length >= 8 && 
           sessionId.length <= 64 &&
           /^[a-zA-Z0-9_-]+$/.test(sessionId);
  }

  isValidFilePath(filePath) {
    if (typeof filePath !== 'string' || filePath.length === 0) {
      return false;
    }

    // Block path traversal attempts
    const dangerousPatterns = [
      '../',
      '..\\',
      '/..',
      '\\..',
      '%2e%2e',
      '%252e%252e'
    ];

    const normalizedPath = filePath.toLowerCase();
    return !dangerousPatterns.some(pattern => normalizedPath.includes(pattern));
  }

  isValidMessage(message) {
    return message &&
           typeof message === 'object' &&
           typeof message.type === 'string' &&
           message.type.length > 0 &&
           message.type.length < 50 &&
           typeof message.data === 'object';
  }
}

// Initialize secure context display when DOM is ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => {
    new SecureContextDisplayClient();
  });
} else {
  new SecureContextDisplayClient();
}
```

## Security Testing Suite

### Unit Tests for Security Validation

```typescript
import { SecureContextStateManager } from '../SecureContextStateManager';
import { SecurityEnhancedCoreServices } from '../SecurityEnhancedCoreServices';
import { VesperaThreatError, VesperaRateLimitError } from '../VesperaSecurityErrors';

describe('SecureContextStateManager Security Tests', () => {
  let stateManager: SecureContextStateManager;
  let mockSecurityServices: jest.Mocked<SecurityEnhancedCoreServices>;

  beforeEach(() => {
    // Setup mocked security services
    mockSecurityServices = createMockSecurityServices();
    stateManager = new SecureContextStateManager(mockContext, mockSecurityServices);
  });

  afterEach(() => {
    stateManager.dispose();
  });

  describe('XSS Prevention', () => {
    test('should block XSS in session ID', async () => {
      const maliciousSessionId = '<script>alert("XSS")</script>';
      
      await expect(stateManager.persistState(maliciousSessionId, { isCollapsed: false }))
        .rejects.toThrow(VesperaThreatError);
    });

    test('should sanitize session ID for storage', async () => {
      const sessionId = 'valid_session_123';
      await stateManager.persistState(sessionId, { isCollapsed: true });

      const state = await stateManager.getState(sessionId);
      expect(state?.sessionId).toBe(sessionId);
      expect(state?.securityChecksum).toBeTruthy();
    });
  });

  describe('Rate Limiting', () => {
    test('should enforce rate limits on state changes', async () => {
      const sessionId = 'test_session';
      
      // Simulate rapid state changes
      const promises = Array(25).fill(null).map((_, i) => 
        stateManager.persistState(sessionId, { isCollapsed: i % 2 === 0 })
      );

      // Should reject some requests due to rate limiting
      const results = await Promise.allSettled(promises);
      const rejected = results.filter(r => r.status === 'rejected');
      
      expect(rejected.length).toBeGreaterThan(0);
      expect(rejected.some(r => 
        r.reason instanceof VesperaRateLimitError
      )).toBe(true);
    });
  });

  describe('State Integrity', () => {
    test('should detect tampered state data', async () => {
      const sessionId = 'integrity_test';
      await stateManager.persistState(sessionId, { isCollapsed: true });

      // Manually tamper with stored state
      const storageKey = `secure_context_state_${sessionId}`;
      const storedState = mockContext.globalState.get(storageKey);
      const tamperedState = {
        ...storedState,
        isCollapsed: false, // Change without updating checksum
      };
      await mockContext.globalState.update(storageKey, tamperedState);

      // Should detect tampering and return null
      const retrievedState = await stateManager.getState(sessionId);
      expect(retrievedState).toBeNull();
    });
  });

  describe('Memory Safety', () => {
    test('should cleanup expired states', async () => {
      jest.useFakeTimers();
      
      const sessionId = 'expiry_test';
      await stateManager.persistState(sessionId, { isCollapsed: true });

      // Fast-forward time beyond expiry
      jest.advanceTimersByTime(25 * 60 * 60 * 1000); // 25 hours

      const state = await stateManager.getState(sessionId);
      expect(state).toBeNull();
      
      jest.useRealTimers();
    });
  });
});
```

## Summary

This collapsible context security blueprint provides:

1. **Comprehensive XSS Protection**: All content sanitized and CSP-enforced
2. **Secure State Management**: Rate-limited, validated persistent UI state
3. **Memory Safety**: Proper resource cleanup and expiry handling
4. **Client-Side Security**: CSP compliance and secure event handling
5. **Enterprise Audit Trail**: Complete security event logging

The implementation follows SecurityEnhancedCoreServices patterns and provides defense-in-depth security for the collapsible context display system.