# WebView Context Security Enhancement Architecture
**Security Architecture Agent - Phase 1 WebView Security Specification**

## Overview

This document provides comprehensive WebView security enhancements specifically for context display functionality, addressing XSS vulnerabilities, CSP enforcement, and secure message passing between the VS Code extension and WebView components.

## Current WebView Security Analysis

### Existing Security Infrastructure (Strong Foundation)

The codebase already includes comprehensive WebView security infrastructure:

**✅ WebViewSecurityManager (src/chat/ui/webview/WebViewSecurityManager.ts)**
- Message validation and sanitization
- CSP policy generation and enforcement
- Threat detection and blocking
- Rate limiting and session management
- Comprehensive security statistics and monitoring

**✅ SecurityEnhancedCoreServices Integration**
- VesperaInputSanitizer integration
- VesperaSecurityAuditLogger integration
- VesperaRateLimiter integration
- Enterprise-grade security patterns

**✅ Message Security Validation**
- Schema-based message validation
- Content sanitization for all message types
- Rate limiting per session
- Security event logging

### Context-Specific Security Gaps

Despite the strong foundation, context display introduces new attack vectors:

1. **Context Content XSS**: File content displayed in WebView without proper sandboxing
2. **File Path Injection**: Malicious file paths in context navigation
3. **Context State Manipulation**: UI state changes without proper validation
4. **Memory Exhaustion**: Large context content causing DoS

## Enhanced WebView Security Architecture

### 1. Context-Specific Security Enhancements

#### 1.1 Enhanced Message Types for Context Operations

```typescript
/**
 * Enhanced WebView message types for secure context operations
 */

export interface ContextWebViewMessage extends WebViewMessage {
  type: 'context_toggle' | 'context_refresh' | 'context_navigate' | 'context_configure';
  data: ContextMessageData;
  contextMetadata: ContextSecurityMetadata;
}

export interface ContextMessageData {
  // Context toggle data
  collapsed?: boolean;
  persistent?: boolean;
  
  // Navigation data  
  filePath?: string;
  lineNumber?: number;
  columnNumber?: number;
  
  // Configuration data
  displayOptions?: ContextDisplayOptions;
  securityLevel?: 'minimal' | 'standard' | 'enhanced';
}

export interface ContextSecurityMetadata {
  readonly sessionId: string;
  readonly contextId: string;
  readonly timestamp: number;
  readonly checksum: string;
  readonly securityVersion: string;
  readonly trustedSource: boolean;
}

export interface ContextDisplayOptions {
  readonly maxFileSize: number;
  readonly maxTotalSize: number;
  readonly allowedFileTypes: string[];
  readonly sanitizeContent: boolean;
  readonly showLineNumbers: boolean;
  readonly enableSyntaxHighlighting: boolean;
}
```

#### 1.2 Enhanced WebView Security Manager for Context

```typescript
/**
 * Context-Enhanced WebView Security Manager
 * Extends existing WebViewSecurityManager with context-specific protections
 */

export class ContextEnhancedWebViewSecurityManager extends WebViewSecurityManager {
  private readonly contextValidator: ContextMessageValidator;
  private readonly filePathValidator: FilePathSecurityValidator;
  private readonly contentSanitizer: ContextContentSanitizer;
  private readonly navigationGuard: SecureNavigationGuard;

  constructor(
    sanitizer: VesperaInputSanitizer,
    auditLogger: VesperaSecurityAuditLogger,
    logger: VesperaLogger,
    errorHandler: VesperaErrorHandler,
    config: WebViewSecurityConfiguration
  ) {
    super(sanitizer, auditLogger, logger, errorHandler, config);
    
    this.contextValidator = new ContextMessageValidator(sanitizer, logger);
    this.filePathValidator = new FilePathSecurityValidator(sanitizer, logger);
    this.contentSanitizer = new ContextContentSanitizer(sanitizer, logger);
    this.navigationGuard = new SecureNavigationGuard(sanitizer, auditLogger, logger);
  }

  /**
   * Validate context-specific WebView messages
   */
  async validateContextMessage(message: ContextWebViewMessage): Promise<ContextMessageValidationResult> {
    const baseValidation = await super.validateMessage(message, {
      sessionId: message.contextMetadata?.sessionId
    });

    if (!baseValidation.isValid) {
      return {
        ...baseValidation,
        contextValid: false,
        contextThreats: [],
        sanitizedContextData: undefined
      };
    }

    // Context-specific validation
    const contextValidation = await this.validateContextSpecificData(message);
    
    return {
      ...baseValidation,
      contextValid: contextValidation.isValid,
      contextThreats: contextValidation.threats,
      sanitizedContextData: contextValidation.sanitizedData
    };
  }

  /**
   * Validate context-specific message data
   */
  private async validateContextSpecificData(
    message: ContextWebViewMessage
  ): Promise<ContextValidationResult> {
    const threats: ThreatInfo[] = [];
    let sanitizedData = message.data;
    let blocked = false;

    try {
      // 1. Context metadata validation
      if (!await this.validateContextMetadata(message.contextMetadata)) {
        threats.push({
          type: 'tampering',
          severity: 'high',
          patterns: ['invalid_context_metadata'],
          blocked: true
        });
        blocked = true;
      }

      // 2. File path validation (if present)
      if (message.data.filePath) {
        const pathValidation = await this.filePathValidator.validatePath(message.data.filePath);
        if (!pathValidation.isValid) {
          threats.push(...pathValidation.threats);
          if (pathValidation.blocked) {
            blocked = true;
          } else {
            sanitizedData = {
              ...sanitizedData,
              filePath: pathValidation.sanitizedPath
            };
          }
        }
      }

      // 3. Line/column number validation
      if (message.data.lineNumber !== undefined) {
        const validatedLine = this.validateLineNumber(message.data.lineNumber);
        if (validatedLine === null) {
          threats.push({
            type: 'parameter_injection',
            severity: 'medium',
            patterns: [`invalid_line_number_${message.data.lineNumber}`],
            blocked: false
          });
          sanitizedData = { ...sanitizedData, lineNumber: undefined };
        } else {
          sanitizedData = { ...sanitizedData, lineNumber: validatedLine };
        }
      }

      // 4. Display options validation
      if (message.data.displayOptions) {
        const optionsValidation = await this.validateDisplayOptions(message.data.displayOptions);
        if (!optionsValidation.isValid) {
          threats.push(...optionsValidation.threats);
          sanitizedData = {
            ...sanitizedData,
            displayOptions: optionsValidation.sanitizedOptions
          };
        }
      }

      return {
        isValid: !blocked,
        threats,
        sanitizedData,
        blocked
      };

    } catch (error) {
      this.logger.error('Context message validation failed', error);
      
      return {
        isValid: false,
        threats: [{
          type: 'validation_error',
          severity: 'high',
          patterns: ['validation_exception'],
          blocked: true
        }],
        sanitizedData: undefined,
        blocked: true
      };
    }
  }

  /**
   * Generate context-specific CSP with enhanced restrictions
   */
  generateContextCSP(contextId: string, securityLevel: 'minimal' | 'standard' | 'enhanced'): string {
    const baseCSP = super.generateCSP({
      context: `vespera_context_${contextId}`,
      allowInlineScripts: false,
      allowInlineStyles: false
    });

    // Enhanced CSP directives for context display
    const contextSpecificDirectives: string[] = [];

    switch (securityLevel) {
      case 'enhanced':
        contextSpecificDirectives.push(
          "object-src 'none'",
          "embed-src 'none'", 
          "frame-src 'none'",
          "worker-src 'none'",
          "manifest-src 'none'",
          "base-uri 'none'",
          "form-action 'none'"
        );
        break;
        
      case 'standard':
        contextSpecificDirectives.push(
          "object-src 'none'",
          "embed-src 'none'",
          "base-uri 'self'"
        );
        break;
        
      case 'minimal':
        contextSpecificDirectives.push(
          "object-src 'none'"
        );
        break;
    }

    return `${baseCSP}; ${contextSpecificDirectives.join('; ')}`;
  }

  /**
   * Sanitize context content for safe WebView display
   */
  async sanitizeContextContent(
    content: string,
    fileType: string,
    securityLevel: 'minimal' | 'standard' | 'enhanced'
  ): Promise<ContextContentSanitizationResult> {
    return await this.contentSanitizer.sanitizeForWebView(content, fileType, securityLevel);
  }

  /**
   * Validate navigation requests securely
   */
  async validateNavigationRequest(
    filePath: string,
    lineNumber?: number,
    sessionId?: string
  ): Promise<NavigationValidationResult> {
    return await this.navigationGuard.validateNavigation(filePath, lineNumber, sessionId);
  }

  // Private validation methods...

  private async validateContextMetadata(metadata: ContextSecurityMetadata): Promise<boolean> {
    if (!metadata) return false;
    
    // Check required fields
    if (!metadata.sessionId || !metadata.contextId || !metadata.timestamp) {
      return false;
    }

    // Validate timestamp (not too old, not in future)
    const now = Date.now();
    const maxAge = 5 * 60 * 1000; // 5 minutes
    if (metadata.timestamp < now - maxAge || metadata.timestamp > now + 60000) {
      return false;
    }

    // Validate checksum
    const expectedChecksum = this.calculateMetadataChecksum(metadata);
    if (metadata.checksum !== expectedChecksum) {
      return false;
    }

    return true;
  }

  private validateLineNumber(line: number): number | null {
    if (!Number.isInteger(line) || line < 1 || line > 1000000) {
      return null;
    }
    return line;
  }

  private async validateDisplayOptions(
    options: ContextDisplayOptions
  ): Promise<DisplayOptionsValidationResult> {
    const threats: ThreatInfo[] = [];
    const sanitizedOptions: ContextDisplayOptions = { ...options };

    // Validate file size limits
    if (options.maxFileSize > 100000) { // 100KB max
      threats.push({
        type: 'resource_exhaustion',
        severity: 'medium',
        patterns: [`max_file_size_${options.maxFileSize}`],
        blocked: false
      });
      sanitizedOptions.maxFileSize = 100000;
    }

    // Validate total size limits  
    if (options.maxTotalSize > 500000) { // 500KB max total
      threats.push({
        type: 'resource_exhaustion',
        severity: 'medium', 
        patterns: [`max_total_size_${options.maxTotalSize}`],
        blocked: false
      });
      sanitizedOptions.maxTotalSize = 500000;
    }

    // Validate allowed file types
    const allowedTypes = [
      'typescript', 'javascript', 'python', 'json', 'markdown',
      'css', 'html', 'yaml', 'sql', 'sh', 'bash', 'xml', 'toml'
    ];
    
    const invalidTypes = options.allowedFileTypes.filter(type => !allowedTypes.includes(type));
    if (invalidTypes.length > 0) {
      threats.push({
        type: 'unauthorized_file_type',
        severity: 'low',
        patterns: invalidTypes,
        blocked: false
      });
      sanitizedOptions.allowedFileTypes = options.allowedFileTypes.filter(type => 
        allowedTypes.includes(type)
      );
    }

    return {
      isValid: threats.length === 0,
      threats,
      sanitizedOptions
    };
  }

  private calculateMetadataChecksum(metadata: ContextSecurityMetadata): string {
    const crypto = require('crypto');
    const data = `${metadata.sessionId}:${metadata.contextId}:${metadata.timestamp}:${metadata.securityVersion}`;
    return crypto.createHash('sha256').update(data).digest('hex').substring(0, 16);
  }
}
```

### 2. Enhanced Client-Side Security

#### 2.1 Context Content Sandboxing

```typescript
/**
 * Client-Side Context Content Sandboxing
 * Provides additional XSS protection for context content display
 */

class ContextContentSandbox {
  private static readonly ALLOWED_TAGS = [
    'div', 'span', 'pre', 'code', 'p', 'br', 'strong', 'em', 
    'ul', 'ol', 'li', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6'
  ];

  private static readonly ALLOWED_ATTRIBUTES = [
    'class', 'data-line', 'data-language', 'data-file-type',
    'aria-label', 'role', 'tabindex'
  ];

  private readonly sanitizerConfig: SandboxConfiguration;

  constructor(securityLevel: 'minimal' | 'standard' | 'enhanced') {
    this.sanitizerConfig = this.createSanitizerConfig(securityLevel);
  }

  /**
   * Sanitize and render context content safely
   */
  sanitizeAndRender(content: string, fileType: string): HTMLElement {
    // 1. Create sandbox container
    const sandbox = this.createSandboxContainer();
    
    // 2. Sanitize content
    const sanitizedContent = this.sanitizeContent(content);
    
    // 3. Create safe content element
    const contentElement = this.createContentElement(sanitizedContent, fileType);
    
    // 4. Validate final HTML
    if (!this.validateSafeHTML(contentElement)) {
      throw new Error('Content failed security validation');
    }

    sandbox.appendChild(contentElement);
    return sandbox;
  }

  /**
   * Create isolated sandbox container
   */
  private createSandboxContainer(): HTMLElement {
    const sandbox = document.createElement('div');
    sandbox.className = 'context-content-sandbox';
    
    // Security attributes
    sandbox.setAttribute('data-sandbox', 'true');
    sandbox.setAttribute('data-security-level', this.sanitizerConfig.securityLevel);
    
    // Prevent event propagation outside sandbox
    sandbox.addEventListener('click', this.handleSandboxClick.bind(this), true);
    sandbox.addEventListener('keydown', this.handleSandboxKeydown.bind(this), true);
    
    return sandbox;
  }

  /**
   * Sanitize content using whitelist approach
   */
  private sanitizeContent(content: string): string {
    // 1. HTML escape all content first
    const escaped = this.htmlEscape(content);
    
    // 2. Apply syntax highlighting safely (if enabled)
    if (this.sanitizerConfig.enableSyntaxHighlighting) {
      return this.applySafeSyntaxHighlighting(escaped);
    }
    
    return escaped;
  }

  /**
   * HTML escape to prevent XSS
   */
  private htmlEscape(text: string): string {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  /**
   * Apply safe syntax highlighting using CSS classes only
   */
  private applySafeSyntaxHighlighting(content: string): string {
    // Simple, safe syntax highlighting using CSS classes
    // No JavaScript execution, only CSS class assignment
    
    return content
      .replace(/\b(function|const|let|var|class|if|else|for|while|return)\b/g, 
               '<span class="syntax-keyword">$1</span>')
      .replace(/("[^"]*")/g, '<span class="syntax-string">$1</span>')
      .replace(/('([^'\\]|\\.)*')/g, '<span class="syntax-string">$1</span>')
      .replace(/(\d+)/g, '<span class="syntax-number">$1</span>')
      .replace(/(\/\/.*$)/gm, '<span class="syntax-comment">$1</span>');
  }

  /**
   * Create content element with proper structure
   */
  private createContentElement(content: string, fileType: string): HTMLElement {
    const container = document.createElement('div');
    container.className = `context-content context-content--${fileType}`;
    
    const preElement = document.createElement('pre');
    preElement.className = 'context-code';
    preElement.setAttribute('data-language', fileType);
    
    const codeElement = document.createElement('code');
    codeElement.innerHTML = content; // Content already escaped
    
    preElement.appendChild(codeElement);
    container.appendChild(preElement);
    
    return container;
  }

  /**
   * Validate final HTML for security
   */
  private validateSafeHTML(element: HTMLElement): boolean {
    // Check all elements recursively
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_ELEMENT,
      null,
      false
    );

    let node = walker.nextNode();
    while (node) {
      const el = node as HTMLElement;
      
      // Check tag name
      if (!ContextContentSandbox.ALLOWED_TAGS.includes(el.tagName.toLowerCase())) {
        return false;
      }
      
      // Check attributes
      for (const attr of Array.from(el.attributes)) {
        if (!this.isAllowedAttribute(attr.name)) {
          return false;
        }
      }
      
      // Check for dangerous content
      if (el.textContent && this.containsDangerousContent(el.textContent)) {
        return false;
      }
      
      node = walker.nextNode();
    }

    return true;
  }

  /**
   * Handle sandbox click events securely
   */
  private handleSandboxClick(event: Event): void {
    // Only allow specific safe interactions
    const target = event.target as HTMLElement;
    
    if (!target.hasAttribute('data-safe-interactive')) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  /**
   * Handle sandbox keyboard events securely
   */
  private handleSandboxKeydown(event: KeyboardEvent): void {
    // Prevent potentially dangerous key combinations
    if (event.ctrlKey || event.altKey || event.metaKey) {
      event.preventDefault();
      event.stopPropagation();
    }
  }

  // Configuration and validation helpers...

  private createSanitizerConfig(securityLevel: string): SandboxConfiguration {
    const baseConfig = {
      securityLevel,
      enableSyntaxHighlighting: false,
      maxContentLength: 50000,
      allowInteractiveElements: false
    };

    switch (securityLevel) {
      case 'enhanced':
        return {
          ...baseConfig,
          enableSyntaxHighlighting: true,
          maxContentLength: 25000
        };
        
      case 'standard':
        return {
          ...baseConfig,
          enableSyntaxHighlighting: true,
          maxContentLength: 50000
        };
        
      case 'minimal':
        return {
          ...baseConfig,
          maxContentLength: 100000
        };
        
      default:
        return baseConfig;
    }
  }

  private isAllowedAttribute(attrName: string): boolean {
    // Check static allowed attributes
    if (ContextContentSandbox.ALLOWED_ATTRIBUTES.includes(attrName)) {
      return true;
    }
    
    // Check data attributes (only specific patterns)
    if (attrName.startsWith('data-')) {
      const allowedDataAttrs = ['data-line', 'data-language', 'data-file-type', 'data-sandbox', 'data-security-level'];
      return allowedDataAttrs.includes(attrName);
    }
    
    return false;
  }

  private containsDangerousContent(content: string): boolean {
    const dangerousPatterns = [
      /<script/i,
      /javascript:/i,
      /data:.*script/i,
      /vbscript:/i,
      /onload=/i,
      /onerror=/i,
      /onclick=/i,
      /eval\s*\(/i,
      /expression\s*\(/i
    ];

    return dangerousPatterns.some(pattern => pattern.test(content));
  }
}

interface SandboxConfiguration {
  securityLevel: string;
  enableSyntaxHighlighting: boolean;
  maxContentLength: number;
  allowInteractiveElements: boolean;
}
```

### 3. Enhanced Message Security Protocol

#### 3.1 Context Message Encryption

```typescript
/**
 * Context Message Encryption Service
 * Provides additional encryption for sensitive context data
 */

export class ContextMessageEncryption {
  private static readonly ENCRYPTION_ALGORITHM = 'aes-256-gcm';
  private static readonly KEY_DERIVATION_ITERATIONS = 10000;
  
  private readonly encryptionKey: Buffer;
  private readonly logger: VesperaLogger;

  constructor(
    sessionId: string,
    securityServices: SecurityEnhancedCoreServices,
    logger?: VesperaLogger
  ) {
    this.encryptionKey = this.deriveEncryptionKey(sessionId);
    this.logger = logger || securityServices.logger.createChild('ContextEncryption');
  }

  /**
   * Encrypt context message payload
   */
  async encryptContextPayload(payload: any): Promise<EncryptedContextPayload> {
    try {
      const crypto = require('crypto');
      
      // 1. Serialize payload
      const serializedPayload = JSON.stringify(payload);
      
      // 2. Generate random IV
      const iv = crypto.randomBytes(12); // 96-bit IV for GCM
      
      // 3. Create cipher
      const cipher = crypto.createCipherGCM(ContextMessageEncryption.ENCRYPTION_ALGORITHM, this.encryptionKey, iv);
      
      // 4. Encrypt
      let encrypted = cipher.update(serializedPayload, 'utf8', 'base64');
      encrypted += cipher.final('base64');
      
      // 5. Get authentication tag
      const authTag = cipher.getAuthTag();
      
      const encryptedPayload: EncryptedContextPayload = {
        encryptedData: encrypted,
        encryptionMethod: ContextMessageEncryption.ENCRYPTION_ALGORITHM,
        iv: iv.toString('base64'),
        authTag: authTag.toString('base64'),
        payloadSize: serializedPayload.length
      };

      this.logger.debug('Context payload encrypted', { 
        originalSize: serializedPayload.length,
        encryptedSize: encrypted.length 
      });

      return encryptedPayload;

    } catch (error) {
      this.logger.error('Context payload encryption failed', error);
      throw new Error('Encryption failed');
    }
  }

  /**
   * Decrypt context message payload
   */
  async decryptContextPayload(encryptedPayload: EncryptedContextPayload): Promise<any> {
    try {
      const crypto = require('crypto');
      
      // 1. Parse components
      const iv = Buffer.from(encryptedPayload.iv, 'base64');
      const authTag = Buffer.from(encryptedPayload.authTag, 'base64');
      
      // 2. Create decipher
      const decipher = crypto.createDecipherGCM(encryptedPayload.encryptionMethod, this.encryptionKey, iv);
      decipher.setAuthTag(authTag);
      
      // 3. Decrypt
      let decrypted = decipher.update(encryptedPayload.encryptedData, 'base64', 'utf8');
      decrypted += decipher.final('utf8');
      
      // 4. Parse JSON
      const payload = JSON.parse(decrypted);

      this.logger.debug('Context payload decrypted', { 
        payloadSize: decrypted.length 
      });

      return payload;

    } catch (error) {
      this.logger.error('Context payload decryption failed', error);
      throw new Error('Decryption failed');
    }
  }

  /**
   * Derive encryption key from session ID
   */
  private deriveEncryptionKey(sessionId: string): Buffer {
    const crypto = require('crypto');
    
    // Use PBKDF2 to derive key from session ID
    const salt = crypto.createHash('sha256').update('vespera_context_encryption').digest();
    
    return crypto.pbkdf2Sync(
      sessionId,
      salt,
      ContextMessageEncryption.KEY_DERIVATION_ITERATIONS,
      32, // 256-bit key
      'sha256'
    );
  }
}
```

## Security Testing & Validation

### WebView Security Test Suite

```typescript
/**
 * WebView Context Security Test Suite
 */

describe('WebView Context Security', () => {
  let securityManager: ContextEnhancedWebViewSecurityManager;
  let mockServices: MockSecurityServices;

  beforeEach(() => {
    mockServices = createMockSecurityServices();
    securityManager = new ContextEnhancedWebViewSecurityManager(
      mockServices.sanitizer,
      mockServices.auditLogger,
      mockServices.logger,
      mockServices.errorHandler,
      defaultConfig
    );
  });

  describe('Context Message Validation', () => {
    test('should block XSS attempts in context navigation', async () => {
      const maliciousMessage: ContextWebViewMessage = {
        type: 'context_navigate',
        data: {
          filePath: '<script>alert("XSS")</script>',
          lineNumber: 1
        },
        contextMetadata: createValidMetadata()
      };

      const result = await securityManager.validateContextMessage(maliciousMessage);
      
      expect(result.contextValid).toBe(false);
      expect(result.contextThreats).toContainEqual(
        expect.objectContaining({ type: 'xss' })
      );
    });

    test('should validate file path traversal attempts', async () => {
      const pathTraversalMessage: ContextWebViewMessage = {
        type: 'context_navigate',
        data: {
          filePath: '../../../etc/passwd',
          lineNumber: 1
        },
        contextMetadata: createValidMetadata()
      };

      const result = await securityManager.validateContextMessage(pathTraversalMessage);
      
      expect(result.contextValid).toBe(false);
      expect(result.contextThreats).toContainEqual(
        expect.objectContaining({ type: 'path_traversal' })
      );
    });

    test('should sanitize display options', async () => {
      const oversizedOptionsMessage: ContextWebViewMessage = {
        type: 'context_configure',
        data: {
          displayOptions: {
            maxFileSize: 1000000, // 1MB - should be reduced
            maxTotalSize: 5000000, // 5MB - should be reduced
            allowedFileTypes: ['typescript', 'exe'], // exe should be removed
            sanitizeContent: true,
            showLineNumbers: true,
            enableSyntaxHighlighting: true
          }
        },
        contextMetadata: createValidMetadata()
      };

      const result = await securityManager.validateContextMessage(oversizedOptionsMessage);
      
      expect(result.sanitizedContextData?.displayOptions?.maxFileSize).toBe(100000);
      expect(result.sanitizedContextData?.displayOptions?.maxTotalSize).toBe(500000);
      expect(result.sanitizedContextData?.displayOptions?.allowedFileTypes).not.toContain('exe');
    });
  });

  describe('CSP Generation', () => {
    test('should generate enhanced CSP for high security level', () => {
      const csp = securityManager.generateContextCSP('test-context', 'enhanced');
      
      expect(csp).toContain("object-src 'none'");
      expect(csp).toContain("embed-src 'none'");
      expect(csp).toContain("frame-src 'none'");
      expect(csp).toContain("worker-src 'none'");
      expect(csp).toContain("form-action 'none'");
    });

    test('should generate minimal CSP for low security level', () => {
      const csp = securityManager.generateContextCSP('test-context', 'minimal');
      
      expect(csp).toContain("object-src 'none'");
      expect(csp).not.toContain("frame-src 'none'");
      expect(csp).not.toContain("worker-src 'none'");
    });
  });

  describe('Content Sanitization', () => {
    test('should sanitize malicious context content', async () => {
      const maliciousContent = `
        function example() {
          eval('alert("XSS")'); // This should be sanitized
          document.write('<script>alert("XSS")</script>');
        }
      `;

      const result = await securityManager.sanitizeContextContent(
        maliciousContent,
        'javascript',
        'enhanced'
      );

      expect(result.sanitizedContent).not.toContain('eval(');
      expect(result.sanitizedContent).not.toContain('<script>');
      expect(result.threats.length).toBeGreaterThan(0);
    });
  });
});

describe('Client-Side Context Sandbox', () => {
  let sandbox: ContextContentSandbox;

  beforeEach(() => {
    sandbox = new ContextContentSandbox('enhanced');
  });

  test('should create safe sandbox container', () => {
    const content = 'console.log("Hello World");';
    const element = sandbox.sanitizeAndRender(content, 'javascript');
    
    expect(element.hasAttribute('data-sandbox')).toBe(true);
    expect(element.querySelector('script')).toBeNull();
  });

  test('should block dangerous HTML content', () => {
    const maliciousContent = '<script>alert("XSS")</script>console.log("safe");';
    
    expect(() => {
      sandbox.sanitizeAndRender(maliciousContent, 'javascript');
    }).not.toThrow(); // Should sanitize, not throw
    
    const element = sandbox.sanitizeAndRender(maliciousContent, 'javascript');
    expect(element.innerHTML).not.toContain('<script>');
  });
});
```

## Implementation Checklist

### ✅ Security Enhancements Delivered

1. **Enhanced Message Validation**: Context-specific message validation with threat detection
2. **Advanced CSP Generation**: Security level-based CSP policies for context display  
3. **Content Sandboxing**: Client-side sandbox for safe context content rendering
4. **Path Traversal Protection**: Comprehensive file path validation and sanitization
5. **Message Encryption**: Optional encryption for sensitive context data transmission
6. **Enhanced Audit Logging**: Detailed security event logging for all context operations

### 🔄 Integration with Existing Security

This enhancement builds upon the existing strong security foundation:
- **Extends WebViewSecurityManager**: Adds context-specific protections
- **Leverages SecurityEnhancedCoreServices**: Full integration with enterprise security
- **Maintains Existing Patterns**: Consistent with current security architecture

### 📋 Deployment Strategy

1. **Phase 1**: Deploy ContextEnhancedWebViewSecurityManager
2. **Phase 2**: Implement client-side content sandboxing
3. **Phase 3**: Add message encryption for sensitive contexts
4. **Phase 4**: Complete security testing and validation

## Conclusion

These WebView security enhancements provide comprehensive protection for context display functionality while maintaining the strong existing security foundation. The implementation follows defense-in-depth principles with multiple layers of validation, sanitization, and threat detection specifically tailored for context operations.