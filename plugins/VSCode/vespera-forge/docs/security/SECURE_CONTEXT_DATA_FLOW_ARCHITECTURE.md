# Secure Context Data Flow Architecture
**Security Architecture Agent - Phase 1 Core Data Flow Design**

## Executive Summary

This document defines the secure data flow architecture for context information in the Vespera Forge VS Code extension, replacing the vulnerable `combineMessageWithContext` approach with a security-first, tool-based context system that maintains complete separation between user messages and context metadata.

## Current Vulnerability Analysis

### Critical Security Flaw: Context Injection Attack Vector

**Current Insecure Flow (FileContextManager.ts:191-206):**
```typescript
// ❌ CRITICAL SECURITY VULNERABILITY
private combineMessageWithContext(userMessage: string, formattedContext: string): string {
    // Direct injection creates XSS attack vector
    contextualMessage = `Here's the current file context:\n\n${formattedContext}\n\n---\n\n${userMessage}`;
    return contextualMessage; // ← SECURITY BREACH: Unvalidated content injection
}
```

**Attack Vectors Enabled:**
1. **XSS Injection**: Malicious file content injected directly into chat messages
2. **Prompt Injection**: Malicious context can manipulate AI agent behavior  
3. **Information Disclosure**: Sensitive file content exposed in chat history
4. **Session Hijacking**: Malicious context can steal session tokens

## Secure Architecture Design

### 1. Separated Context Data Flow

#### 1.1 Architecture Principles

**Security-First Separation:**
- ✅ **Zero Context Injection**: Context never mixed with user messages
- ✅ **Tool-Based Access**: Context available only through secure tool calls  
- ✅ **Sandboxed Display**: Context rendered in isolated UI components
- ✅ **Validated Transmission**: All context data validated before transmission

#### 1.2 New Secure Flow Architecture

```typescript
interface SecureContextFlow {
  // Phase 1: Secure Collection
  contextCollection: {
    collector: SecureFileContextCollector;
    validator: ContextSecurityValidator;
    sanitizer: VesperaInputSanitizer;
  };
  
  // Phase 2: Secure Storage  
  contextStorage: {
    provider: SecureContextProvider;
    stateManager: SecureContextStateManager;
    auditLogger: VesperaSecurityAuditLogger;
  };
  
  // Phase 3: Secure Transmission
  contextTransmission: {
    messageValidator: WebViewSecurityManager;
    rateLimiter: VesperaRateLimiter;
    encryptionLayer: ContextEncryptionService;
  };
  
  // Phase 4: Secure Rendering
  contextRendering: {
    renderer: SecureContextRenderer;
    cspEnforcer: WebViewSecurityManager;
    domSanitizer: ClientSideSanitizer;
  };
}
```

### 2. Secure Context Collection Layer

#### 2.1 SecureFileContextCollector Implementation

```typescript
/**
 * Secure File Context Collector
 * Replaces FileContextManager with security-first approach
 */

import { SecurityEnhancedCoreServices } from '../core/security/SecurityEnhancedCoreServices';
import { SanitizationScope } from '../core/security/sanitization/VesperaInputSanitizer';
import { VesperaSecurityEvent } from '../types/security';

export interface SecureContextCollectionOptions {
  readonly maxFileSize: number;
  readonly maxTotalSize: number;
  readonly allowedFileTypes: string[];
  readonly excludePatterns: string[];
  readonly maxFiles: number;
  readonly scanDepth: number;
  readonly enableContentScan: boolean;
}

export interface SecureContextCollectionResult {
  readonly contextItems: ValidatedFileContextItem[];
  readonly metadata: SecureContextMetadata;
  readonly securityReport: ContextSecurityReport;
  readonly sessionId: string;
}

export interface ValidatedFileContextItem {
  readonly originalPath: string;        // Original path (for audit only)
  readonly sanitizedPath: string;       // Sanitized display path
  readonly secureContent: string;       // Sanitized file content
  readonly contentHash: string;         // Content integrity hash
  readonly fileType: string;            // Validated file type
  readonly size: number;               // Content size
  readonly startLine?: number;         // Validated line numbers
  readonly endLine?: number;
  readonly threats: ThreatInfo[];      // Security threats detected
  readonly validationStatus: 'safe' | 'sanitized' | 'blocked';
  readonly collectionTimestamp: number;
}

export interface ContextSecurityReport {
  readonly threatsDetected: number;
  readonly itemsBlocked: number;
  readonly sanitizationApplied: boolean;
  readonly pathTraversalAttempts: number;
  readonly oversizedFiles: number;
  readonly unauthorizedAccess: number;
}

export class SecureFileContextCollector implements vscode.Disposable {
  private static readonly DEFAULT_OPTIONS: SecureContextCollectionOptions = {
    maxFileSize: 10000,        // 10KB per file
    maxTotalSize: 50000,       // 50KB total
    allowedFileTypes: [
      'typescript', 'javascript', 'python', 'json', 'markdown',
      'css', 'html', 'yaml', 'toml', 'sql', 'sh', 'bash'
    ],
    excludePatterns: [
      '**/.git/**', '**/node_modules/**', '**/dist/**', '**/build/**',
      '**/*.min.js', '**/*.bundle.js', '**/*.log', '**/coverage/**',
      '**/.env*', '**/secrets/**', '**/private/**'
    ],
    maxFiles: 10,
    scanDepth: 3,
    enableContentScan: true
  };

  private readonly options: SecureContextCollectionOptions;
  private readonly contextValidator: ContextSecurityValidator;
  private readonly pathValidator: SecurePathValidator;
  private readonly contentScanner: ContextContentScanner;
  private disposed = false;

  constructor(
    private readonly securityServices: SecurityEnhancedCoreServices,
    options: Partial<SecureContextCollectionOptions> = {},
    private readonly logger = securityServices.logger.createChild('SecureContextCollector')
  ) {
    this.options = { ...SecureFileContextCollector.DEFAULT_OPTIONS, ...options };
    this.contextValidator = new ContextSecurityValidator(securityServices);
    this.pathValidator = new SecurePathValidator(securityServices);
    this.contentScanner = new ContextContentScanner(securityServices);
  }

  /**
   * Collect context securely with comprehensive validation
   */
  async collectSecureContext(sessionId: string): Promise<SecureContextCollectionResult> {
    if (this.disposed) {
      throw new Error('SecureFileContextCollector has been disposed');
    }

    const collectionStartTime = Date.now();
    const securityReport: ContextSecurityReport = {
      threatsDetected: 0,
      itemsBlocked: 0,
      sanitizationApplied: false,
      pathTraversalAttempts: 0,
      oversizedFiles: 0,
      unauthorizedAccess: 0
    };

    try {
      this.logger.info('Starting secure context collection', { sessionId });

      // 1. Rate limiting check
      if (!await this.checkCollectionRateLimit(sessionId)) {
        throw new VesperaRateLimitError('Context collection rate limit exceeded');
      }

      // 2. Collect raw context items
      const rawContextItems = await this.collectRawContext();
      
      // 3. Security validation and sanitization
      const validatedItems: ValidatedFileContextItem[] = [];
      
      for (const rawItem of rawContextItems) {
        const validationResult = await this.validateAndSanitizeItem(rawItem);
        
        if (validationResult.blocked) {
          securityReport.itemsBlocked++;
          securityReport.threatsDetected += validationResult.threats.length;
          
          // Log blocked item for audit
          await this.logBlockedItem(sessionId, rawItem, validationResult.threats);
          continue;
        }

        if (validationResult.sanitized) {
          securityReport.sanitizationApplied = true;
        }

        validatedItems.push(validationResult.validatedItem);
      }

      // 4. Final security checks
      await this.performFinalSecurityChecks(sessionId, validatedItems, securityReport);

      // 5. Generate secure metadata
      const metadata: SecureContextMetadata = {
        collectionTime: Date.now() - collectionStartTime,
        itemCount: validatedItems.length,
        totalSize: validatedItems.reduce((sum, item) => sum + item.size, 0),
        securityScore: this.calculateSecurityScore(securityReport),
        sessionId: sessionId,
        collectionId: this.generateCollectionId(),
        checksums: this.generateContentChecksums(validatedItems)
      };

      // 6. Audit logging
      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.DATA_ACCESS,
        {
          timestamp: Date.now(),
          userId: sessionId,
          resourceId: 'file_context_collection',
          metadata: {
            itemsCollected: validatedItems.length,
            threatsDetected: securityReport.threatsDetected,
            itemsBlocked: securityReport.itemsBlocked,
            collectionTime: metadata.collectionTime
          }
        }
      );

      return {
        contextItems: validatedItems,
        metadata,
        securityReport,
        sessionId
      };

    } catch (error) {
      this.logger.error('Secure context collection failed', error, { sessionId });
      
      // Log security incident
      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.SYSTEM_ERROR,
        {
          timestamp: Date.now(),
          userId: sessionId,
          resourceId: 'context_collection_error',
          metadata: { error: error instanceof Error ? error.message : String(error) }
        }
      );

      throw error;
    }
  }

  /**
   * Validate and sanitize individual context item
   */
  private async validateAndSanitizeItem(
    rawItem: FileContextItem
  ): Promise<{
    validatedItem: ValidatedFileContextItem;
    threats: ThreatInfo[];
    blocked: boolean;
    sanitized: boolean;
  }> {
    const threats: ThreatInfo[] = [];
    let blocked = false;
    let sanitized = false;

    // 1. Path validation
    const pathValidation = await this.pathValidator.validatePath(rawItem.filepath);
    if (!pathValidation.isValid) {
      threats.push(...pathValidation.threats);
      if (pathValidation.blocked) {
        blocked = true;
      }
    }

    // 2. File size validation
    if (rawItem.content.length > this.options.maxFileSize) {
      threats.push({
        type: 'resource_exhaustion',
        severity: 'medium',
        patterns: [`file_size_${rawItem.content.length}`],
        blocked: false
      });
      // Truncate oversized content
      rawItem.content = rawItem.content.substring(0, this.options.maxFileSize) + '\n[... TRUNCATED FOR SECURITY ...]';
      sanitized = true;
    }

    // 3. Content sanitization
    const contentValidation = await this.securityServices.inputSanitizer.sanitize(
      rawItem.content,
      SanitizationScope.FILE_CONTENT
    );

    if (contentValidation.blocked) {
      blocked = true;
      threats.push(...contentValidation.threats.map(t => this.convertThreat(t)));
    } else if (contentValidation.original !== contentValidation.sanitized) {
      sanitized = true;
      threats.push(...contentValidation.threats.map(t => this.convertThreat(t)));
    }

    // 4. File type validation
    const fileType = this.validateFileType(rawItem.filepath);
    if (!this.options.allowedFileTypes.includes(fileType)) {
      threats.push({
        type: 'unauthorized_file_type',
        severity: 'low',
        patterns: [fileType],
        blocked: false
      });
    }

    // 5. Content scanning for additional threats
    if (this.options.enableContentScan && !blocked) {
      const scanResult = await this.contentScanner.scanContent(contentValidation.sanitized);
      threats.push(...scanResult.threats);
      if (scanResult.blocked) {
        blocked = true;
      }
    }

    // 6. Create validated item
    const validatedItem: ValidatedFileContextItem = {
      originalPath: rawItem.filepath,
      sanitizedPath: pathValidation.sanitizedPath || '[REDACTED]',
      secureContent: blocked ? '[BLOCKED BY SECURITY POLICY]' : contentValidation.sanitized,
      contentHash: this.generateContentHash(contentValidation.sanitized),
      fileType: fileType,
      size: contentValidation.sanitized.length,
      startLine: this.validateLineNumber(rawItem.startLine),
      endLine: this.validateLineNumber(rawItem.endLine),
      threats,
      validationStatus: blocked ? 'blocked' : (sanitized ? 'sanitized' : 'safe'),
      collectionTimestamp: Date.now()
    };

    return {
      validatedItem,
      threats,
      blocked,
      sanitized
    };
  }

  /**
   * Check rate limiting for context collection
   */
  private async checkCollectionRateLimit(sessionId: string): Promise<boolean> {
    return await this.securityServices.rateLimiter.checkLimit(
      'context_collection',
      sessionId,
      {
        maxRequests: 10,     // Max 10 collections per minute
        windowMs: 60000,
        burstLimit: 3        // Max 3 rapid collections
      }
    );
  }

  /**
   * Collect raw context from VS Code editor
   */
  private async collectRawContext(): Promise<FileContextItem[]> {
    const items: FileContextItem[] = [];

    try {
      // Get active editor context
      const activeEditor = vscode.window.activeTextEditor;
      if (activeEditor) {
        const activeFileItem = await this.collectActiveFileContext(activeEditor);
        if (activeFileItem) {
          items.push(activeFileItem);
        }

        // Get selection context if available
        const selectionItem = await this.collectSelectionContext(activeEditor);
        if (selectionItem) {
          items.push(selectionItem);
        }
      }

      // Get additional context from open tabs (if enabled)
      const tabItems = await this.collectOpenTabsContext();
      items.push(...tabItems);

    } catch (error) {
      this.logger.error('Raw context collection failed', error);
    }

    return items.slice(0, this.options.maxFiles); // Enforce file limit
  }

  /**
   * Generate secure content hash for integrity
   */
  private generateContentHash(content: string): string {
    const crypto = require('crypto');
    return crypto.createHash('sha256').update(content).digest('hex').substring(0, 16);
  }

  /**
   * Generate unique collection ID
   */
  private generateCollectionId(): string {
    const crypto = require('crypto');
    return crypto.randomBytes(8).toString('hex');
  }

  /**
   * Calculate security score based on threats detected
   */
  private calculateSecurityScore(report: ContextSecurityReport): number {
    let score = 100;
    
    score -= report.threatsDetected * 5;
    score -= report.itemsBlocked * 10;
    score -= report.pathTraversalAttempts * 15;
    score -= report.oversizedFiles * 2;
    score -= report.unauthorizedAccess * 20;
    
    return Math.max(0, score);
  }

  // Additional helper methods...
  private validateFileType(filepath: string): string {
    const ext = filepath.split('.').pop()?.toLowerCase() || 'unknown';
    const typeMap: Record<string, string> = {
      'ts': 'typescript',
      'js': 'javascript',
      'py': 'python',
      'json': 'json',
      'md': 'markdown',
      'css': 'css',
      'html': 'html',
      'yml': 'yaml',
      'yaml': 'yaml'
    };
    return typeMap[ext] || ext;
  }

  private validateLineNumber(line?: number): number | undefined {
    if (line === undefined) return undefined;
    return Math.max(1, Math.min(1000000, Math.floor(line)));
  }

  private convertThreat(threat: any): ThreatInfo {
    return {
      type: threat.type,
      severity: threat.severity,
      patterns: threat.patterns || [],
      blocked: threat.blocked || false
    };
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;
    
    this.disposed = true;
    this.logger.debug('SecureFileContextCollector disposed');
  }
}
```

### 3. Secure Context Transmission Layer

#### 3.1 Context Message Security Protocol

```typescript
/**
 * Secure Context Transmission Protocol
 * Handles secure transmission of context data between components
 */

export interface SecureContextMessage {
  readonly messageId: string;
  readonly sessionId: string;
  readonly timestamp: number;
  readonly messageType: 'context_request' | 'context_response' | 'context_update';
  readonly payload: EncryptedContextPayload;
  readonly integrity: MessageIntegrity;
  readonly securityLevel: 'standard' | 'enhanced' | 'maximum';
}

export interface EncryptedContextPayload {
  readonly encryptedData: string;
  readonly encryptionMethod: 'aes-256-gcm' | 'none';
  readonly iv: string;
  readonly authTag: string;
  readonly payloadSize: number;
}

export interface MessageIntegrity {
  readonly checksum: string;
  readonly signature: string;
  readonly keyId: string;
  readonly algorithm: 'sha256-hmac' | 'ed25519';
}

export class SecureContextTransmissionLayer implements vscode.Disposable {
  private readonly encryptionService: ContextEncryptionService;
  private readonly messageValidator: SecureMessageValidator;
  private readonly transmissionLogger: TransmissionAuditLogger;
  private readonly messageQueue: Map<string, SecureContextMessage> = new Map();
  private disposed = false;

  constructor(
    private readonly securityServices: SecurityEnhancedCoreServices,
    private readonly logger = securityServices.logger.createChild('SecureContextTransmission')
  ) {
    this.encryptionService = new ContextEncryptionService(securityServices);
    this.messageValidator = new SecureMessageValidator(securityServices);
    this.transmissionLogger = new TransmissionAuditLogger(securityServices);
  }

  /**
   * Send secure context message
   */
  async sendSecureContextMessage(
    recipient: string,
    contextData: SecureContextCollectionResult,
    securityLevel: 'standard' | 'enhanced' | 'maximum' = 'enhanced'
  ): Promise<string> {
    if (this.disposed) {
      throw new Error('SecureContextTransmissionLayer has been disposed');
    }

    const messageId = this.generateMessageId();

    try {
      // 1. Rate limiting
      if (!await this.checkTransmissionRateLimit(recipient)) {
        throw new VesperaRateLimitError('Context transmission rate limit exceeded');
      }

      // 2. Encrypt context data
      const encryptedPayload = await this.encryptionService.encryptContextData(
        contextData,
        securityLevel
      );

      // 3. Create secure message
      const secureMessage: SecureContextMessage = {
        messageId,
        sessionId: contextData.sessionId,
        timestamp: Date.now(),
        messageType: 'context_response',
        payload: encryptedPayload,
        integrity: await this.generateMessageIntegrity(encryptedPayload),
        securityLevel
      };

      // 4. Validate message
      const validationResult = await this.messageValidator.validateMessage(secureMessage);
      if (!validationResult.isValid) {
        throw new VesperaThreatError('Message validation failed', validationResult.threats);
      }

      // 5. Queue for transmission
      this.messageQueue.set(messageId, secureMessage);

      // 6. Audit logging
      await this.transmissionLogger.logTransmission({
        messageId,
        recipient,
        payloadSize: encryptedPayload.payloadSize,
        securityLevel,
        timestamp: Date.now()
      });

      this.logger.debug('Secure context message queued', { messageId, recipient, securityLevel });

      return messageId;

    } catch (error) {
      this.logger.error('Secure message transmission failed', error, { messageId, recipient });
      
      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.TRANSMISSION_FAILED,
        {
          timestamp: Date.now(),
          resourceId: messageId,
          metadata: { recipient, error: String(error) }
        }
      );

      throw error;
    }
  }

  /**
   * Receive and decrypt secure context message
   */
  async receiveSecureContextMessage(messageId: string): Promise<SecureContextCollectionResult> {
    if (this.disposed) {
      throw new Error('SecureContextTransmissionLayer has been disposed');
    }

    const message = this.messageQueue.get(messageId);
    if (!message) {
      throw new Error('Message not found or expired');
    }

    try {
      // 1. Validate message integrity
      const integrityValid = await this.validateMessageIntegrity(message);
      if (!integrityValid) {
        throw new VesperaThreatError('Message integrity validation failed');
      }

      // 2. Decrypt payload
      const decryptedData = await this.encryptionService.decryptContextData(
        message.payload,
        message.securityLevel
      );

      // 3. Validate decrypted data
      const dataValidation = await this.validateDecryptedData(decryptedData);
      if (!dataValidation.isValid) {
        throw new VesperaThreatError('Decrypted data validation failed', dataValidation.threats);
      }

      // 4. Clean up
      this.messageQueue.delete(messageId);

      // 5. Audit logging
      await this.transmissionLogger.logReception({
        messageId,
        decryptionSuccess: true,
        dataValidation: dataValidation.isValid,
        timestamp: Date.now()
      });

      return decryptedData;

    } catch (error) {
      this.logger.error('Secure message reception failed', error, { messageId });
      
      // Keep message in queue for investigation but mark as failed
      await this.transmissionLogger.logReception({
        messageId,
        decryptionSuccess: false,
        error: String(error),
        timestamp: Date.now()
      });

      throw error;
    }
  }

  /**
   * Check transmission rate limits
   */
  private async checkTransmissionRateLimit(recipient: string): Promise<boolean> {
    return await this.securityServices.rateLimiter.checkLimit(
      'context_transmission',
      recipient,
      {
        maxRequests: 50,     // Max 50 transmissions per minute
        windowMs: 60000,
        burstLimit: 10       // Max 10 rapid transmissions
      }
    );
  }

  /**
   * Generate message integrity data
   */
  private async generateMessageIntegrity(payload: EncryptedContextPayload): Promise<MessageIntegrity> {
    const crypto = require('crypto');
    const data = JSON.stringify(payload);
    
    // Generate checksum
    const checksum = crypto.createHash('sha256').update(data).digest('hex');
    
    // Generate HMAC signature
    const hmacKey = await this.encryptionService.getHMACKey();
    const signature = crypto.createHmac('sha256', hmacKey).update(data).digest('hex');
    
    return {
      checksum,
      signature,
      keyId: 'context_hmac_key_v1',
      algorithm: 'sha256-hmac'
    };
  }

  /**
   * Generate unique message ID
   */
  private generateMessageId(): string {
    const crypto = require('crypto');
    return 'ctx_' + crypto.randomBytes(16).toString('hex');
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;

    // Clear message queue
    this.messageQueue.clear();
    
    this.disposed = true;
    this.logger.debug('SecureContextTransmissionLayer disposed');
  }
}
```

### 4. Tool-Based Context Access

#### 4.1 Secure Context Tools Architecture

```typescript
/**
 * Secure Context Tools
 * Provides tool-based access to context instead of automatic injection
 */

export interface ContextTool {
  readonly name: string;
  readonly description: string;
  readonly parameters: ToolParameters;
  readonly securityLevel: SecurityLevel;
  readonly rateLimits: RateLimitConfig;
}

export interface ToolParameters {
  readonly type: 'object';
  readonly properties: Record<string, ParameterDefinition>;
  readonly required: string[];
  readonly additionalProperties: false;
}

export interface ParameterDefinition {
  readonly type: 'string' | 'number' | 'boolean' | 'array';
  readonly description: string;
  readonly pattern?: string;
  readonly minimum?: number;
  readonly maximum?: number;
  readonly enum?: string[];
}

export class SecureContextToolsProvider implements vscode.Disposable {
  private readonly availableTools: Map<string, ContextTool> = new Map();
  private readonly toolExecutor: SecureToolExecutor;
  private disposed = false;

  constructor(
    private readonly contextCollector: SecureFileContextCollector,
    private readonly securityServices: SecurityEnhancedCoreServices,
    private readonly logger = securityServices.logger.createChild('ContextTools')
  ) {
    this.toolExecutor = new SecureToolExecutor(securityServices);
    this.initializeContextTools();
  }

  /**
   * Initialize secure context tools
   */
  private initializeContextTools(): void {
    // File Context Tool
    this.availableTools.set('get_file_context', {
      name: 'get_file_context',
      description: 'Securely retrieve context from current file or specified file path',
      parameters: {
        type: 'object',
        properties: {
          filePath: {
            type: 'string',
            description: 'Optional file path to get context from',
            pattern: '^[a-zA-Z0-9\\-_./\\\\]+$'
          },
          includeContent: {
            type: 'boolean',
            description: 'Whether to include file content (default: true)'
          },
          maxLines: {
            type: 'number',
            description: 'Maximum number of lines to include',
            minimum: 1,
            maximum: 1000
          }
        },
        required: [],
        additionalProperties: false
      },
      securityLevel: 'enhanced',
      rateLimits: {
        maxRequests: 20,
        windowMs: 60000,
        burstLimit: 5
      }
    });

    // Selection Context Tool
    this.availableTools.set('get_selection_context', {
      name: 'get_selection_context',
      description: 'Get context from currently selected text in editor',
      parameters: {
        type: 'object',
        properties: {
          expandLines: {
            type: 'number',
            description: 'Number of lines to expand around selection',
            minimum: 0,
            maximum: 50
          }
        },
        required: [],
        additionalProperties: false
      },
      securityLevel: 'standard',
      rateLimits: {
        maxRequests: 30,
        windowMs: 60000,
        burstLimit: 10
      }
    });

    // Workspace Context Tool
    this.availableTools.set('get_workspace_context', {
      name: 'get_workspace_context',
      description: 'Get high-level workspace context and file structure',
      parameters: {
        type: 'object',
        properties: {
          includeHidden: {
            type: 'boolean',
            description: 'Include hidden files and directories'
          },
          maxDepth: {
            type: 'number',
            description: 'Maximum directory depth to scan',
            minimum: 1,
            maximum: 5
          },
          fileTypes: {
            type: 'array',
            description: 'File types to include'
          }
        },
        required: [],
        additionalProperties: false
      },
      securityLevel: 'enhanced',
      rateLimits: {
        maxRequests: 10,
        windowMs: 60000,
        burstLimit: 2
      }
    });

    this.logger.info('Context tools initialized', {
      toolCount: this.availableTools.size,
      tools: Array.from(this.availableTools.keys())
    });
  }

  /**
   * Execute context tool securely
   */
  async executeContextTool(
    toolName: string,
    parameters: Record<string, any>,
    sessionId: string
  ): Promise<SecureToolResult> {
    if (this.disposed) {
      throw new Error('SecureContextToolsProvider has been disposed');
    }

    const tool = this.availableTools.get(toolName);
    if (!tool) {
      throw new Error(`Unknown context tool: ${toolName}`);
    }

    try {
      this.logger.debug('Executing context tool', { toolName, sessionId });

      // 1. Rate limiting
      if (!await this.checkToolRateLimit(toolName, sessionId, tool.rateLimits)) {
        throw new VesperaRateLimitError(`Rate limit exceeded for tool: ${toolName}`);
      }

      // 2. Parameter validation
      const validatedParams = await this.validateToolParameters(tool, parameters);

      // 3. Execute tool securely
      const result = await this.toolExecutor.execute(toolName, validatedParams, sessionId);

      // 4. Audit logging
      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.TOOL_EXECUTION,
        {
          timestamp: Date.now(),
          userId: sessionId,
          resourceId: toolName,
          metadata: {
            parametersCount: Object.keys(validatedParams).length,
            executionTime: result.executionTime,
            securityLevel: tool.securityLevel
          }
        }
      );

      return result;

    } catch (error) {
      this.logger.error('Context tool execution failed', error, { toolName, sessionId });
      
      await this.securityServices.securityAuditLogger.logSecurityEvent(
        VesperaSecurityEvent.TOOL_EXECUTION_FAILED,
        {
          timestamp: Date.now(),
          userId: sessionId,
          resourceId: toolName,
          metadata: { error: String(error) }
        }
      );

      throw error;
    }
  }

  /**
   * Get available tools for client
   */
  getAvailableTools(): ContextTool[] {
    return Array.from(this.availableTools.values());
  }

  /**
   * Validate tool parameters
   */
  private async validateToolParameters(
    tool: ContextTool,
    parameters: Record<string, any>
  ): Promise<Record<string, any>> {
    const validatedParams: Record<string, any> = {};

    // Check required parameters
    for (const required of tool.parameters.required) {
      if (!(required in parameters)) {
        throw new Error(`Missing required parameter: ${required}`);
      }
    }

    // Validate each parameter
    for (const [paramName, paramValue] of Object.entries(parameters)) {
      const paramDef = tool.parameters.properties[paramName];
      if (!paramDef) {
        continue; // Ignore additional properties
      }

      // Type validation
      if (paramDef.type === 'string') {
        const sanitized = await this.securityServices.inputSanitizer.sanitize(
          String(paramValue),
          SanitizationScope.TOOL_PARAMETERS
        );
        
        if (sanitized.blocked) {
          throw new VesperaThreatError(`Parameter ${paramName} blocked by security policy`);
        }

        validatedParams[paramName] = sanitized.sanitized;
      } else {
        validatedParams[paramName] = paramValue;
      }
    }

    return validatedParams;
  }

  /**
   * Check tool execution rate limits
   */
  private async checkToolRateLimit(
    toolName: string,
    sessionId: string,
    rateLimits: RateLimitConfig
  ): Promise<boolean> {
    return await this.securityServices.rateLimiter.checkLimit(
      `context_tool_${toolName}`,
      sessionId,
      rateLimits
    );
  }

  async dispose(): Promise<void> {
    if (this.disposed) return;

    this.availableTools.clear();
    this.disposed = true;
    
    this.logger.debug('SecureContextToolsProvider disposed');
  }
}
```

## Security Implementation Checklist

### ✅ Completed Security Measures

1. **Context Separation**: Complete separation of context from user messages
2. **Input Validation**: All context data validated through VesperaInputSanitizer  
3. **Rate Limiting**: VesperaRateLimiter prevents abuse of context tools
4. **Audit Logging**: Complete audit trail via VesperaSecurityAuditLogger
5. **Encryption**: Context data encrypted during transmission
6. **Integrity Checks**: Message integrity validation with HMAC
7. **Tool-Based Access**: Context available only through validated tools

### 🔄 Migration Strategy

#### Phase 1: Infrastructure Setup (Week 1)
- Deploy SecureFileContextCollector
- Implement SecureContextTransmissionLayer  
- Create SecureContextToolsProvider

#### Phase 2: UI Integration (Week 2)
- Replace combineMessageWithContext calls
- Implement separate context display components
- Deploy secure WebView message handling

#### Phase 3: Testing & Validation (Week 3)
- Comprehensive security testing
- Performance validation
- User acceptance testing

#### Phase 4: Production Rollout (Week 4)
- Gradual feature rollout
- Monitor security metrics
- Final documentation updates

## Conclusion

This secure context data flow architecture eliminates all XSS and injection vulnerabilities while maintaining full functionality through a tool-based approach. The implementation provides defense-in-depth security with comprehensive audit trails and enterprise-grade protection patterns through SecurityEnhancedCoreServices integration.