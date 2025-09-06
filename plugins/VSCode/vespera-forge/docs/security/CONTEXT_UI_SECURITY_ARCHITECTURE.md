# Context UI Security Architecture
**Security Architecture Agent - Phase 1 Deliverable**

## Executive Summary

This document provides a comprehensive security-first architecture for resolving critical context display issues identified in the Vespera Forge VS Code extension. The architecture addresses XSS vulnerabilities, improper UI separation, and implements enterprise-grade security patterns through SecurityEnhancedCoreServices integration.

## Critical Security Issues Addressed

### Primary Issues
- **Issue #1**: Context information incorrectly injected into agent replies (XSS risk)
- **Issue #2**: Missing collapsible context UI with persistent state (injection vulnerabilities) 
- **Issue #3**: Automatic context injection creates security boundaries violation
- **WebView Security Gap**: Uncontrolled content rendering in WebView components

### Security Impact Analysis
- **High Risk**: XSS attacks through unsanitized context content injection
- **Medium Risk**: UI state manipulation through malicious context data
- **Low Risk**: Information disclosure through persistent context state

## Security-First Architecture Design

### 1. Secure UI Component Separation

#### 1.1 Component Architecture Overview

```typescript
// New Secure Context Display Architecture
interface SecureContextDisplaySystem {
  contextProvider: SecureContextProvider;
  contextRenderer: SecureContextRenderer; 
  stateManager: SecureContextStateManager;
  securityValidator: ContextSecurityValidator;
}
```

#### 1.2 Component Security Boundaries

**Separate Context Components (NOT mixed with chat messages):**

1. **`SecureContextProvider`** - Isolated context data management
   - SecurityEnhancedCoreServices integration
   - VesperaInputSanitizer for all context data
   - Memory-safe resource management via VesperaContextManager

2. **`SecureContextRenderer`** - XSS-safe context display
   - WebViewSecurityManager CSP enforcement
   - Sanitized HTML rendering with threat detection
   - Secure file path and line number rendering

3. **`SecureContextStateManager`** - Persistent UI state with validation
   - VesperaInputSanitizer for all user preferences
   - Rate-limited state persistence operations
   - Secure storage in VS Code extension context

#### 1.3 SecurityEnhancedCoreServices Integration Pattern

```typescript
class SecureContextDisplayManager implements vscode.Disposable {
  private securityServices: SecurityEnhancedCoreServices;
  private webViewSecurity: WebViewSecurityManager;
  private contextValidator: ContextSecurityValidator;

  constructor(
    securityServices: SecurityEnhancedCoreServices,
    context: vscode.ExtensionContext
  ) {
    this.securityServices = securityServices;
    this.webViewSecurity = securityServices.webViewSecurityManager;
    this.contextValidator = new ContextSecurityValidator(securityServices);
  }
}
```

### 2. Collapsible Context Security System

#### 2.1 Secure State Management Architecture

**Persistent State Security Requirements:**
- All UI preferences sanitized through VesperaInputSanitizer
- State changes rate-limited via VesperaRateLimiter  
- Audit logging for security-sensitive state modifications
- Memory-safe cleanup via VesperaContextManager

**Implementation Pattern:**
```typescript
interface SecureContextState {
  sessionId: string;
  isCollapsed: boolean;
  contextVisible: boolean;
  lastModified: number;
  securityChecksum: string; // Prevents tampering
}

class SecureContextStateManager {
  async persistState(state: SecureContextState): Promise<void> {
    // 1. Input validation
    const validationResult = await this.securityServices.inputSanitizer
      .sanitize(state, SanitizationScope.USER_PREFERENCES);
    
    if (validationResult.blocked) {
      throw new VesperaThreatError('Invalid context state data');
    }

    // 2. Rate limiting
    if (!await this.securityServices.rateLimiter.checkLimit('context_state', state.sessionId)) {
      throw new VesperaRateLimitError('Context state change rate limit exceeded');
    }

    // 3. Secure storage
    await this.context.globalState.update(
      `secure_context_state_${state.sessionId}`, 
      validationResult.sanitized
    );

    // 4. Audit logging
    await this.securityServices.securityAuditLogger.logSecurityEvent(
      VesperaSecurityEvent.USER_ACTION,
      {
        timestamp: Date.now(),
        userId: state.sessionId,
        resourceId: 'context_state',
        metadata: { action: 'state_persisted', collapsed: state.isCollapsed }
      }
    );
  }
}
```

#### 2.2 UI Component Security

**Collapsible Context Component Requirements:**
- CSP-compliant HTML structure
- XSS-safe event handling
- Sanitized content rendering
- Secure file link generation

### 3. Security-First Context Data Flow

#### 3.1 Secure Context Data Pipeline

```typescript
// Current INSECURE flow (to be replaced)
// FileContextManager.combineMessageWithContext() 
// ❌ Injects raw context into user message (XSS risk)

// New SECURE flow
interface SecureContextFlow {
  1: ContextCollectionPhase;    // Secure collection with validation
  2: SecurityValidationPhase;   // Threat detection and sanitization  
  3: SeparateRenderingPhase;    // Isolated UI rendering
  4: SecureStoragePhase;        // Persistent state with validation
}
```

#### 3.2 Context Data Security Validation

**Input Validation Requirements:**
```typescript
class ContextSecurityValidator {
  async validateContextData(contextItems: FileContextItem[]): Promise<ContextValidationResult> {
    const threats: ThreatInfo[] = [];
    const sanitizedItems: FileContextItem[] = [];

    for (const item of contextItems) {
      // 1. File path validation (prevent path traversal)
      if (!this.isValidFilePath(item.filepath)) {
        threats.push({
          type: 'path_traversal',
          severity: 'high',
          patterns: [item.filepath],
          blocked: true
        });
        continue;
      }

      // 2. Content sanitization
      const contentResult = await this.securityServices.inputSanitizer
        .sanitize(item.content, SanitizationScope.FILE_CONTENT);
      
      if (contentResult.blocked) {
        threats.push(...contentResult.threats.map(t => this.convertThreat(t)));
        continue;
      }

      // 3. Safe item creation
      sanitizedItems.push({
        ...item,
        content: contentResult.sanitized,
        filepath: this.sanitizeFilePath(item.filepath)
      });
    }

    return { sanitizedItems, threats, blocked: threats.some(t => t.blocked) };
  }
}
```

### 4. WebView Security Enhancement

#### 4.1 Enhanced CSP Configuration

**Secure Content Security Policy:**
```typescript
class ContextWebViewSecurityManager extends WebViewSecurityManager {
  generateContextCSP(): string {
    return this.sanitizer.generateCSPPolicy({
      context: 'vespera_context_display',
      strictMode: true,
      allowedSources: [
        'vscode-resource:', // VS Code resource URLs only
        'data: image/svg+xml' // Safe SVG icons only
      ],
      disallowedFeatures: [
        'eval',
        'inline-script',
        'unsafe-inline',
        'unsafe-eval'
      ]
    });
  }
}
```

#### 4.2 Message Security Enhancement

**Secure WebView Message Handling:**
```typescript
// Enhanced message validation for context operations
interface ContextWebViewMessage extends WebViewMessage {
  type: 'toggleContext' | 'openFile' | 'navigateToLine';
  data: {
    filePath?: string;      // Validated file path
    lineNumber?: number;    // Validated line number  
    collapsed?: boolean;    // Validated boolean state
  };
}

class ContextMessageValidator {
  async validateContextMessage(message: ContextWebViewMessage): Promise<MessageValidationResult> {
    // 1. Structural validation
    if (!this.isValidContextMessage(message)) {
      return { isValid: false, errors: ['Invalid context message structure'], blocked: true };
    }

    // 2. File path security validation
    if (message.data.filePath) {
      const pathValidation = await this.validateFilePath(message.data.filePath);
      if (!pathValidation.isValid) {
        return { 
          isValid: false, 
          errors: ['Invalid file path'], 
          threats: pathValidation.threats,
          blocked: true 
        };
      }
    }

    // 3. Parameter sanitization
    const sanitizedData = await this.securityServices.inputSanitizer
      .sanitize(message.data, SanitizationScope.UI_PARAMETERS);

    return {
      isValid: true,
      sanitizedMessage: { ...message, data: sanitizedData.sanitized },
      threats: [],
      blocked: false
    };
  }
}
```

## Implementation Blueprint

### File-by-File Security Modifications

#### 1. FileContextManager.ts Security Refactor

**Current Security Issues:**
- `combineMessageWithContext()` method creates XSS vulnerability
- No input sanitization for context data
- Direct injection into user messages

**Security Fixes:**
```typescript
// ❌ REMOVE: Insecure context injection
// private combineMessageWithContext(userMessage: string, formattedContext: string): string

// ✅ ADD: Secure context provider
class SecureFileContextProvider {
  constructor(private securityServices: SecurityEnhancedCoreServices) {}

  async collectSecureContext(): Promise<SecureContextData> {
    const rawContext = await this.collector.collectContext();
    
    // Validate and sanitize all context data
    const validationResult = await this.contextValidator.validateContextData(rawContext);
    
    if (validationResult.blocked) {
      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.THREAT_BLOCKED,
        { timestamp: Date.now(), resourceId: 'file_context', threats: validationResult.threats }
      );
      throw new VesperaThreatError('Context collection blocked due to security threats');
    }

    return {
      contextItems: validationResult.sanitizedItems,
      metadata: this.generateSecureMetadata(validationResult),
      sessionId: this.generateSecureSessionId()
    };
  }
}
```

#### 2. ChatWebViewProvider.ts Security Enhancement

**Current Security Issues:**
- Insufficient message validation
- No CSP enforcement for context content
- Missing threat detection for context operations

**Security Enhancements:**
```typescript
class SecureChatWebViewProvider extends ChatWebViewProvider {
  private contextSecurityManager: ContextWebViewSecurityManager;
  private contextRenderer: SecureContextRenderer;

  async handleContextMessage(message: ContextWebViewMessage): Promise<void> {
    // 1. Security validation
    const validationResult = await this.contextSecurityManager
      .validateContextMessage(message);
    
    if (validationResult.blocked) {
      await this.sendSecurityWarning(validationResult.threats);
      return;
    }

    // 2. Secure message processing
    const sanitizedMessage = validationResult.sanitizedMessage!;
    
    switch (sanitizedMessage.type) {
      case 'toggleContext':
        await this.secureToggleContext(sanitizedMessage.data.collapsed);
        break;
      case 'openFile':
        await this.secureOpenFile(sanitizedMessage.data.filePath);
        break;
      case 'navigateToLine':
        await this.secureNavigateToLine(
          sanitizedMessage.data.filePath,
          sanitizedMessage.data.lineNumber
        );
        break;
    }
  }

  private async secureToggleContext(collapsed?: boolean): Promise<void> {
    if (collapsed !== undefined) {
      await this.contextStateManager.persistState({
        sessionId: this._sessionId,
        isCollapsed: collapsed,
        contextVisible: !collapsed,
        lastModified: Date.now(),
        securityChecksum: this.generateStateChecksum(collapsed)
      });
    }
    
    await this.contextRenderer.renderSecureContext(collapsed);
  }
}
```

#### 3. WebView JavaScript Security (chat.js)

**Current Security Issues:**
- No CSP compliance checks
- Unvalidated DOM manipulation
- Missing XSS protection for context content

**Security Implementation:**
```javascript
// Secure context display component
class SecureContextDisplay {
  constructor(securityConfig) {
    this.securityConfig = securityConfig;
    this.sanitizer = new ClientSideSanitizer(securityConfig.cspPolicy);
    this.validator = new ContextDataValidator();
  }

  renderContextSection(contextData) {
    // 1. Validate context data structure
    if (!this.validator.isValidContextData(contextData)) {
      this.showSecurityWarning('Invalid context data received');
      return;
    }

    // 2. Create secure context container
    const contextContainer = this.createSecureContainer();
    
    // 3. Render sanitized context items
    contextData.items.forEach(item => {
      const secureItem = this.renderSecureContextItem(item);
      contextContainer.appendChild(secureItem);
    });

    // 4. Update UI with security validation
    this.updateContextUI(contextContainer);
  }

  createSecureContainer() {
    const container = document.createElement('div');
    container.className = 'secure-context-display';
    container.setAttribute('data-security-validated', 'true');
    
    // CSP-compliant styling only
    container.style.cssText = this.securityConfig.allowedStyles;
    
    return container;
  }

  renderSecureContextItem(item) {
    // Sanitize all content before rendering
    const sanitizedContent = this.sanitizer.sanitizeHTML(item.content);
    const sanitizedPath = this.sanitizer.sanitizeFilePath(item.filepath);
    
    const itemElement = document.createElement('div');
    itemElement.className = 'context-item';
    
    // Secure file link creation (no javascript: URLs)
    const fileLink = this.createSecureFileLink(sanitizedPath, item.startLine);
    itemElement.appendChild(fileLink);
    
    // XSS-safe content display
    const contentElement = document.createElement('pre');
    contentElement.textContent = sanitizedContent; // textContent prevents XSS
    itemElement.appendChild(contentElement);
    
    return itemElement;
  }
}
```

#### 4. CSS Security Compliance (chat.css)

**Security Enhancements:**
```css
/* CSP-compliant styles for context display */
.secure-context-display {
  border: 1px solid var(--vscode-chat-border);
  border-radius: var(--chat-border-radius);
  margin: var(--chat-gap) 0;
  overflow: hidden;
  position: relative;
  background: var(--vscode-chat-input-background);
}

.context-toggle {
  cursor: pointer;
  padding: var(--chat-padding);
  background: var(--vscode-chat-background);
  border: none;
  width: 100%;
  text-align: left;
  display: flex;
  align-items: center;
  gap: var(--chat-gap);
  transition: background-color 0.2s ease;
}

.context-toggle:hover {
  background: var(--vscode-list-hoverBackground);
}

.context-toggle::before {
  content: '▶';
  font-size: 12px;
  transition: transform 0.2s ease;
  color: var(--vscode-icon-foreground);
}

.context-toggle.expanded::before {
  transform: rotate(90deg);
}

.context-content {
  padding: 0 var(--chat-padding) var(--chat-padding);
  max-height: 0;
  overflow: hidden;
  transition: max-height 0.3s ease;
}

.context-content.expanded {
  max-height: 500px; /* Prevent excessive height */
  overflow-y: auto;
}

.context-item {
  background: var(--vscode-textCodeBlock-background);
  border: 1px solid var(--vscode-chat-border);
  border-radius: calc(var(--chat-border-radius) / 2);
  margin-bottom: var(--chat-gap);
  overflow: hidden;
}

.context-item-header {
  padding: 8px var(--chat-padding);
  background: var(--vscode-badge-background);
  color: var(--vscode-badge-foreground);
  font-size: 11px;
  font-weight: 500;
  border-bottom: 1px solid var(--vscode-chat-border);
}

.context-item-content {
  padding: var(--chat-padding);
  font-family: var(--vscode-editor-font-family);
  font-size: var(--vscode-editor-font-size);
  line-height: 1.4;
  white-space: pre-wrap;
  word-break: break-all; /* Prevent path overflow */
  max-height: 300px;
  overflow-y: auto;
}

/* Security-focused file link styles */
.secure-file-link {
  color: var(--vscode-textLink-foreground);
  text-decoration: none;
  cursor: pointer;
  padding: 2px 4px;
  border-radius: 2px;
  transition: background-color 0.2s ease;
}

.secure-file-link:hover {
  background: var(--vscode-textLink-activeForeground);
  color: var(--vscode-editor-background);
}

/* Prevent CSS injection attacks */
* {
  /* No user-controlled CSS variables */
  --user-content: initial;
}
```

### Security Testing Requirements

#### 1. XSS Prevention Testing
```typescript
// Test malicious context injection
const maliciousContext: FileContextItem = {
  filepath: '<script>alert("XSS")</script>',
  content: '"><script>alert("XSS")</script>',
  type: 'file',
  startLine: 1,
  endLine: 1
};

// Should be blocked by security validation
expect(await contextValidator.validateContextData([maliciousContext]))
  .toHaveProperty('blocked', true);
```

#### 2. Path Traversal Testing
```typescript
// Test path traversal attempts  
const traversalAttempts = [
  '../../../etc/passwd',
  '..\\..\\..\\windows\\system32\\config\\sam',
  '%2e%2e%2f%2e%2e%2f%2e%2e%2fetc%2fpasswd'
];

for (const maliciousPath of traversalAttempts) {
  expect(await pathValidator.isValidFilePath(maliciousPath)).toBe(false);
}
```

#### 3. UI State Injection Testing
```typescript
// Test malicious UI state data
const maliciousState = {
  sessionId: '<script>alert("XSS")</script>',
  isCollapsed: "true'; DROP TABLE sessions; --",
  securityChecksum: 'bypassed'
};

// Should be blocked by input sanitization
expect(await stateManager.persistState(maliciousState))
  .rejects.toThrow(VesperaThreatError);
```

### Performance & Memory Security

#### Memory-Safe Resource Management
```typescript
class SecureContextResourceManager implements vscode.Disposable {
  private resources: Set<SecureContextResource> = new Set();
  private disposed = false;

  registerResource(resource: SecureContextResource): void {
    if (this.disposed) {
      throw new Error('Resource manager disposed');
    }
    this.resources.add(resource);
    
    // Automatic cleanup after timeout
    setTimeout(() => {
      if (this.resources.has(resource)) {
        this.cleanupResource(resource);
      }
    }, 300000); // 5 minute timeout
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    
    // Clean up all resources
    const cleanupPromises = Array.from(this.resources)
      .map(resource => this.cleanupResource(resource));
    
    await Promise.allSettled(cleanupPromises);
    this.resources.clear();
    this.disposed = true;
  }
}
```

## Security Compliance & Audit

### Enterprise Security Requirements Met
- ✅ **XSS Prevention**: All content sanitized through VesperaInputSanitizer
- ✅ **Input Validation**: Comprehensive validation for all user inputs and context data
- ✅ **Rate Limiting**: VesperaRateLimiter prevents abuse
- ✅ **Audit Logging**: Complete security event logging via VesperaSecurityAuditLogger
- ✅ **Memory Safety**: VesperaContextManager ensures proper resource cleanup
- ✅ **CSP Compliance**: WebViewSecurityManager enforces strict CSP policies
- ✅ **Path Traversal Protection**: Secure file path validation and sanitization

### Security Monitoring & Alerts
- Real-time threat detection and blocking
- Audit trail for all context operations
- Performance metrics for security operations
- Automated security health checks

## Migration Strategy

### Phase 1: Security Infrastructure (Current)
1. Deploy SecurityEnhancedCoreServices integration
2. Implement ContextSecurityValidator
3. Create SecureContextStateManager

### Phase 2: UI Component Refactor
1. Replace combineMessageWithContext with SecureContextProvider
2. Implement collapsible context UI with security validation
3. Deploy secure WebView message handling

### Phase 3: Testing & Validation
1. Comprehensive security testing
2. Performance validation
3. User acceptance testing with security review

### Phase 4: Production Deployment
1. Gradual rollout with monitoring
2. Security metrics collection
3. Continuous security monitoring

## Conclusion

This security architecture provides enterprise-grade protection for the context display system while maintaining usability and performance. The implementation follows defense-in-depth principles with multiple layers of security validation, threat detection, and secure resource management.

The architecture addresses all identified vulnerabilities through SecurityEnhancedCoreServices integration, ensuring consistent security patterns across the entire Vespera Forge extension.