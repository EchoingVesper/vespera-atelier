/**
 * WebView Security Integration Tests
 * 
 * Comprehensive test suite for WebView input sanitization, XSS prevention,
 * and security manager functionality.
 */

import { describe, it, beforeEach, afterEach, expect, jest } from '@jest/globals';
import * as vscode from 'vscode';
import { WebViewSecurityManager } from '../chat/ui/webview/WebViewSecurityManager';
import { VesperaInputSanitizer } from '../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityAuditLogger } from '../core/security/audit/VesperaSecurityAuditLogger';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { VesperaErrorHandler } from '../core/error-handling/VesperaErrorHandler';
import { sanitizeHtmlContent, generateSecureCSP, generateSecureTemplate } from '../chat/ui/webview/HtmlGenerator';
import { WebViewMessage } from '../chat/types/webview';
import { ThreatType, ThreatSeverity } from '../types/security';

// Mock VS Code API
jest.mock('vscode');

describe('WebView Security Integration', () => {
  let securityManager: WebViewSecurityManager;
  let mockSanitizer: jest.Mocked<VesperaInputSanitizer>;
  let mockAuditLogger: jest.Mocked<VesperaSecurityAuditLogger>;
  let mockLogger: jest.Mocked<VesperaLogger>;
  let mockErrorHandler: jest.Mocked<VesperaErrorHandler>;
  let mockWebview: jest.Mocked<any>;

  beforeEach(async () => {
    // Create mocks
    mockLogger = {
      createChild: jest.fn().mockReturnThis(),
      info: jest.fn(),
      warn: jest.fn(),
      error: jest.fn(),
      debug: jest.fn(),
    } as any;

    mockErrorHandler = {
      handleError: jest.fn().mockResolvedValue(undefined),
    } as any;

    mockAuditLogger = {
      logSecurityEvent: jest.fn().mockResolvedValue(undefined),
      dispose: jest.fn(),
    } as any;

    mockSanitizer = {
      sanitize: jest.fn(),
      generateCSPPolicy: jest.fn(),
      validateMessage: jest.fn(),
      dispose: jest.fn(),
    } as any;

    mockWebview = {
      cspSource: 'vscode-resource:',
      asWebviewUri: jest.fn().mockImplementation((uri) => uri),
      postMessage: jest.fn(),
      onDidReceiveMessage: jest.fn(),
    } as any;

    // Initialize security manager
    securityManager = await WebViewSecurityManager.initialize({
      sanitizer: mockSanitizer,
      auditLogger: mockAuditLogger,
      logger: mockLogger,
      errorHandler: mockErrorHandler,
      securityConfig: {
        strictMode: true,
        enableRealTimeValidation: true,
        maxMessageSize: 1048576,
        rateLimitPerSecond: 10,
        enableContentSanitization: true,
        cspStrictMode: true
      }
    });
  });

  afterEach(() => {
    if (securityManager) {
      securityManager.dispose();
    }
    jest.clearAllMocks();
  });

  describe('Message Validation', () => {
    it('should validate clean message successfully', async () => {
      const cleanMessage: WebViewMessage = {
        type: 'sendMessage',
        data: {
          content: 'Hello, this is a clean message',
          providerId: 'openai'
        },
        requestId: 'test-123'
      };

      // Verify webview mock is properly initialized
      expect(mockWebview.cspSource).toBeDefined();
      
      mockSanitizer.sanitize.mockResolvedValue({
        original: cleanMessage.data.content,
        sanitized: cleanMessage.data.content,
        threats: [],
        applied: [],
        blocked: false
      });

      const result = await securityManager.validateMessage(cleanMessage, {
        sessionId: 'test-session',
        origin: 'vscode-webview',
        messageCount: 1,
        lastActivity: Date.now(),
        trustLevel: 'medium'
      });

      expect(result.isValid).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.threats).toHaveLength(0);
      expect(result.errors).toHaveLength(0);
    });

    it('should block message with XSS payload', async () => {
      const maliciousMessage: WebViewMessage = {
        type: 'sendMessage',
        data: {
          content: 'Hello <script>alert("XSS")</script>',
          providerId: 'openai'
        },
        requestId: 'test-123'
      };

      mockSanitizer.sanitize.mockResolvedValue({
        original: maliciousMessage.data.content,
        sanitized: null,
        threats: [{
          pattern: {
            id: 'xss-script-tag',
            type: ThreatType.XSS,
            pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            severity: ThreatSeverity.CRITICAL,
            action: 'BLOCK' as any
          },
          matches: ['<script>alert("XSS")</script>'],
          severity: ThreatSeverity.CRITICAL,
          location: 'USER_INPUT'
        }],
        applied: [],
        blocked: true
      });

      const result = await securityManager.validateMessage(maliciousMessage, {
        sessionId: 'test-session',
        origin: 'vscode-webview',
        messageCount: 1,
        lastActivity: Date.now(),
        trustLevel: 'low'
      });

      expect(result.isValid).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0]?.type).toBe('xss');
      expect(result.threats[0]?.severity).toBe('critical');
    });

    it('should sanitize message with medium threats', async () => {
      const suspiciousMessage: WebViewMessage = {
        type: 'sendMessage',
        data: {
          content: 'Hello <a href="javascript:void(0)">link</a>',
          providerId: 'openai'
        },
        requestId: 'test-123'
      };

      const sanitizedContent = 'Hello <a href="#">link</a>';
      mockSanitizer.sanitize.mockResolvedValue({
        original: suspiciousMessage.data.content,
        sanitized: sanitizedContent,
        threats: [{
          pattern: {
            id: 'xss-javascript-protocol',
            type: ThreatType.XSS,
            pattern: /javascript:/gi,
            severity: ThreatSeverity.MEDIUM,
            action: 'SANITIZE' as any
          },
          matches: ['javascript:'],
          severity: ThreatSeverity.MEDIUM,
          location: 'USER_INPUT'
        }],
        applied: ['dompurify'],
        blocked: false
      });

      const result = await securityManager.validateMessage(suspiciousMessage, {
        sessionId: 'test-session',
        origin: 'vscode-webview',
        messageCount: 1,
        lastActivity: Date.now(),
        trustLevel: 'medium'
      });

      expect(result.isValid).toBe(true);
      expect(result.blocked).toBe(false);
      expect(result.sanitizedMessage?.data.content).toBe(sanitizedContent);
      expect(result.threats).toHaveLength(1);
      expect(result.threats[0]?.severity).toBe('medium');
    });

    it('should enforce rate limiting', async () => {
      const message: WebViewMessage = {
        type: 'sendMessage',
        data: { content: 'Test message' },
        requestId: 'test-123'
      };

      // Send messages rapidly to trigger rate limit
      const promises = Array(15).fill(null).map(() => 
        securityManager.validateMessage(message, {
          sessionId: 'rate-limit-test',
          origin: 'vscode-webview',
          messageCount: 1,
          lastActivity: Date.now(),
          trustLevel: 'medium'
        })
      );

      const results = await Promise.all(promises);
      
      // Some messages should be blocked due to rate limiting
      const blockedResults = results.filter(r => r.blocked);
      expect(blockedResults.length).toBeGreaterThan(0);
    });

    it('should reject oversized messages', async () => {
      const largeMessage: WebViewMessage = {
        type: 'sendMessage',
        data: {
          content: 'x'.repeat(2000000) // 2MB, exceeds 1MB limit
        },
        requestId: 'test-123'
      };

      const result = await securityManager.validateMessage(largeMessage, {
        sessionId: 'test-session',
        origin: 'vscode-webview',
        messageCount: 1,
        lastActivity: Date.now(),
        trustLevel: 'medium'
      });

      expect(result.isValid).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.errors.some(e => e.includes('size'))).toBe(true);
    });

    it('should validate message schema', async () => {
      const invalidMessage: WebViewMessage = {
        type: 'configureProvider',
        data: {
          // Missing required providerId
          config: { apiKey: 'test' }
        },
        requestId: 'test-123'
      };

      const result = await securityManager.validateMessage(invalidMessage, {
        sessionId: 'test-session',
        origin: 'vscode-webview',
        messageCount: 1,
        lastActivity: Date.now(),
        trustLevel: 'medium'
      });

      expect(result.isValid).toBe(false);
      expect(result.errors.some(e => e.includes('required field'))).toBe(true);
    });
  });

  describe('CSP Generation', () => {
    it('should generate strict CSP policy', () => {
      const csp = securityManager.generateCSP({
        context: 'chat-webview',
        nonce: 'test-nonce',
        allowInlineScripts: false,
        allowInlineStyles: true
      });

      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain("'nonce-test-nonce'");
      expect(csp).toContain("'unsafe-inline'"); // For styles only
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('should allow additional sources when specified', () => {
      const csp = securityManager.generateCSP({
        context: 'chat-webview',
        nonce: 'test-nonce',
        additionalSources: ['https://api.openai.com']
      });

      expect(csp).toContain('https://api.openai.com');
    });
  });

  describe('HTML Content Sanitization', () => {
    it('should sanitize malicious HTML', async () => {
      const maliciousHtml = '<div>Hello <script>alert("XSS")</script></div>';
      
      mockSanitizer.sanitize.mockResolvedValue({
        original: maliciousHtml,
        sanitized: '<div>Hello </div>',
        threats: [{
          pattern: {
            id: 'xss-script-tag',
            type: ThreatType.XSS,
            pattern: /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
            severity: ThreatSeverity.CRITICAL,
            action: 'SANITIZE' as any
          },
          matches: ['<script>alert("XSS")</script>'],
          severity: ThreatSeverity.CRITICAL,
          location: 'HTML_CONTENT'
        }],
        applied: ['dompurify'],
        blocked: false
      });

      const result = await securityManager.sanitizeHtmlContent(maliciousHtml, {
        allowedTags: ['div', 'span', 'p'],
        removeScripts: true
      });

      expect(result.sanitizedHtml).toBe('<div>Hello </div>');
      expect(result.threats).toHaveLength(1);
      expect(result.modified).toBe(true);
    });

    it('should preserve safe HTML', async () => {
      const safeHtml = '<div class="message">Hello <em>world</em>!</div>';
      
      mockSanitizer.sanitize.mockResolvedValue({
        original: safeHtml,
        sanitized: safeHtml,
        threats: [],
        applied: [],
        blocked: false
      });

      const result = await securityManager.sanitizeHtmlContent(safeHtml, {
        allowedTags: ['div', 'em'],
        allowedAttributes: ['class']
      });

      expect(result.sanitizedHtml).toBe(safeHtml);
      expect(result.threats).toHaveLength(0);
      expect(result.modified).toBe(false);
    });
  });

  describe('Template Generation', () => {
    it('should generate secure message template', async () => {
      const templateContent = {
        messageId: 'msg-123',
        role: 'user',
        timestamp: '2024-01-01T00:00:00Z',
        provider: 'openai',
        text: 'Hello world',
        retryable: true
      };

      const template = await generateSecureTemplate('message', templateContent, {
        sanitizeContent: true,
        nonce: 'test-nonce'
      });

      expect(template).toContain('data-message-id="msg-123"');
      expect(template).toContain('Hello world');
      expect(template).toContain('nonce="test-nonce"');
      expect(template).toContain('type="button"'); // Secure button attributes
    });

    it('should sanitize template content', async () => {
      const maliciousContent = {
        messageId: 'msg-123<script>alert("xss")</script>',
        role: 'user',
        text: 'Hello <script>evil()</script>',
      };

      // Mock sanitization for each field
      let callCount = 0;
      mockSanitizer.sanitize.mockImplementation((input: any) => {
        const inputStr = typeof input === 'string' ? input : JSON.stringify(input);
        callCount++;
        
        if (inputStr.includes('script')) {
          return Promise.resolve({
            original: inputStr,
            sanitized: inputStr.replace(/<script[^>]*>.*?<\/script>/gi, ''),
            threats: [],
            applied: ['dompurify'],
            blocked: false
          });
        }
        
        return Promise.resolve({
          original: inputStr,
          sanitized: inputStr,
          threats: [],
          applied: [],
          blocked: false
        });
      });

      const template = await generateSecureTemplate('message', maliciousContent, {
        sanitizeContent: true
      });

      expect(template).not.toContain('<script>');
      expect(template).toContain('msg-123'); // ID should be sanitized
      expect(template).toContain('Hello'); // Text should be sanitized
    });

    it('should generate error notice template', async () => {
      const errorContent = {
        title: 'Security Alert',
        message: 'Malicious content blocked',
        severity: 'critical',
        dismissible: true
      };

      const template = await generateSecureTemplate('error-notice', errorContent, {
        nonce: 'test-nonce'
      });

      expect(template).toContain('error-notice critical');
      expect(template).toContain('Security Alert');
      expect(template).toContain('Malicious content blocked');
      expect(template).toContain('nonce="test-nonce"');
    });
  });

  describe('PostMessage Validation', () => {
    it('should validate allowed origin', async () => {
      const message = { type: 'test', data: 'safe' };
      const allowedOrigin = 'vscode-webview://test';

      const result = await securityManager.validatePostMessage(
        message,
        allowedOrigin,
        'test-source'
      );

      expect(result.allowed).toBe(true);
    });

    it('should block disallowed origin', async () => {
      const message = { type: 'test', data: 'safe' };
      const disallowedOrigin = 'https://malicious.com';

      const result = await securityManager.validatePostMessage(
        message,
        disallowedOrigin,
        'test-source'
      );

      expect(result.allowed).toBe(false);
      expect(result.reason).toContain('Origin not allowed');
    });

    it('should sanitize message for postMessage', async () => {
      const maliciousMessage = {
        type: 'test',
        data: '<script>alert("xss")</script>'
      };

      mockSanitizer.sanitize.mockResolvedValue({
        original: maliciousMessage,
        sanitized: { type: 'test', data: '' },
        threats: [],
        applied: ['dompurify'],
        blocked: false
      });

      const result = await securityManager.validatePostMessage(
        maliciousMessage,
        'vscode-webview://test'
      );

      expect(result.allowed).toBe(true);
      expect(result.sanitizedMessage?.data).not.toContain('<script>');
    });
  });

  describe('Security Statistics', () => {
    it('should track security metrics', async () => {
      // Process some messages to generate statistics
      const cleanMessage: WebViewMessage = {
        type: 'sendMessage',
        data: { content: 'Hello' },
        requestId: 'test-1'
      };

      const maliciousMessage: WebViewMessage = {
        type: 'sendMessage',
        data: { content: '<script>alert("xss")</script>' },
        requestId: 'test-2'
      };

      mockSanitizer.sanitize
        .mockResolvedValueOnce({
          original: 'Hello',
          sanitized: 'Hello',
          threats: [],
          applied: [],
          blocked: false
        })
        .mockResolvedValueOnce({
          original: '<script>alert("xss")</script>',
          sanitized: null,
          threats: [{ pattern: { type: ThreatType.XSS } } as any],
          applied: [],
          blocked: true
        });

      await securityManager.validateMessage(cleanMessage, {
        sessionId: 'stats-test',
        origin: 'vscode-webview',
        messageCount: 1,
        lastActivity: Date.now(),
        trustLevel: 'medium'
      });

      await securityManager.validateMessage(maliciousMessage, {
        sessionId: 'stats-test',
        origin: 'vscode-webview',
        messageCount: 2,
        lastActivity: Date.now(),
        trustLevel: 'low'
      });

      const stats = securityManager.getSecurityStats();

      expect(stats.messagesProcessed).toBe(2);
      expect(stats.messagesBlocked).toBe(1);
      expect(stats.threatsDetected).toBe(1);
      expect(stats.blockRate).toBe(0.5);
    });

    it('should reset statistics', () => {
      securityManager.resetStats();
      const stats = securityManager.getSecurityStats();

      expect(stats.messagesProcessed).toBe(0);
      expect(stats.messagesBlocked).toBe(0);
      expect(stats.threatsDetected).toBe(0);
      expect(stats.blockRate).toBe(0);
    });
  });

  describe('Error Handling', () => {
    it('should handle sanitizer errors gracefully', async () => {
      const message: WebViewMessage = {
        type: 'sendMessage',
        data: { content: 'test' },
        requestId: 'test-error'
      };

      mockSanitizer.sanitize.mockRejectedValue(new Error('Sanitizer error'));

      const result = await securityManager.validateMessage(message, {
        sessionId: 'error-test',
        origin: 'vscode-webview',
        messageCount: 1,
        lastActivity: Date.now(),
        trustLevel: 'medium'
      });

      expect(result.isValid).toBe(false);
      expect(result.blocked).toBe(true);
      expect(result.errors).toContain('Validation system error');
    });
  });
});

describe('HTML Generator Security Functions', () => {
  let mockWebview: jest.Mocked<vscode.Webview>;

  beforeEach(() => {
    mockWebview = {
      cspSource: 'vscode-resource:',
      asWebviewUri: jest.fn().mockImplementation((uri) => uri),
    } as any;

    // Mock the static method
    const mockGetInstance = jest.fn().mockImplementation(() => ({
      sanitize: jest.fn().mockResolvedValue({
        original: 'test',
        sanitized: 'test',
        threats: [],
        applied: [],
        blocked: false
      })
    }));

    (VesperaInputSanitizer as any).getInstance = mockGetInstance;
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('generateSecureCSP', () => {
    it('should generate CSP with nonce', () => {
      const csp = generateSecureCSP(mockWebview, 'test-nonce', {
        securityEnabled: true
      });

      expect(csp).toContain("'nonce-test-nonce'");
      expect(csp).toContain("default-src 'none'");
      expect(csp).toContain('upgrade-insecure-requests');
    });

    it('should include additional sources', () => {
      const csp = generateSecureCSP(mockWebview, 'test-nonce', {
        securityEnabled: true,
        allowedScriptSources: ['https://cdn.example.com']
      });

      expect(csp).toContain('https://cdn.example.com');
    });

    it('should disable strict mode when requested', () => {
      const csp = generateSecureCSP(mockWebview, 'test-nonce', {
        securityEnabled: false
      });

      expect(csp).not.toContain('upgrade-insecure-requests');
      expect(csp).toContain("connect-src vscode-resource: *");
    });
  });

  describe('sanitizeHtmlContent', () => {
    it('should use input sanitizer when available', async () => {
      const html = '<div>Test content</div>';
      const result = await sanitizeHtmlContent(html, {
        allowedTags: ['div']
      });

      expect(result).toBe('test'); // Based on mock implementation
    });

    it('should fallback to basic sanitization', async () => {
      // Mock sanitizer to throw error
      const mockGetInstance = jest.fn().mockImplementation(() => {
        throw new Error('Sanitizer not available');
      });
      (VesperaInputSanitizer as any).getInstance = mockGetInstance;

      const maliciousHtml = '<div>Hello <script>alert("xss")</script></div>';
      const result = await sanitizeHtmlContent(maliciousHtml);

      expect(result).toBe('<div>Hello </div>');
      expect(result).not.toContain('<script>');
    });
  });
});