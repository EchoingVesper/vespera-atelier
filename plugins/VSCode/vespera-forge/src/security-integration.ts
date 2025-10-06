/**
 * Security Integration Layer
 * 
 * Centralizes initialization and management of all security components
 * for the Vespera Forge VS Code extension, ensuring proper coordination
 * between SecurityEnhancedCoreServices, tool management, file operations,
 * and MCP security layers.
 */

import * as vscode from 'vscode';
import { EnhancedDisposable } from './core/disposal/DisposalManager';
import { SecurityEnhancedVesperaCoreServices } from './core/security/SecurityEnhancedCoreServices';
import { LogLevel } from './core/logging/VesperaLogger';
import { SecureToolManager, ToolManagementPolicy } from './config/tool-management';
import { ToolOverrideSecurityManager } from './security/tool-override-security';
import { FileOperationsSecurityManager, FileSecurityPolicy } from './security/file-operations-security';
import { RustFileOpsSecurityWrapper } from './rust-file-ops/security-wrapper';
import { McpSecureFileTools } from './mcp/secure-file-tools';
import { McpMessageValidator } from './security/mcp-validation';
import { BinderyService } from './services/bindery';
import { 
  SecurityConfiguration,
  VesperaSecurityErrorCode,
  VesperaSecurityEvent,
  SecurityEventContext 
} from './types/security';
import { VesperaSecurityError } from './core/security/VesperaSecurityErrors';

export interface SecurityIntegrationConfig {
  securityLevel: 'strict' | 'standard' | 'permissive';
  enableAuditLogging: boolean;
  enableProcessIsolation: boolean;
  enableToolManagement: boolean;
  enableFileOperationsSecurity: boolean;
  enableMcpValidation: boolean;
  enableRustFileOps: boolean;
  performanceMode: 'optimal' | 'balanced' | 'secure';
  targetSecurityOverhead: number; // percentage
}

export interface SecurityIntegrationStatus {
  initialized: boolean;
  securityServicesReady: boolean;
  toolManagementReady: boolean;
  fileOperationsReady: boolean;
  mcpValidationReady: boolean;
  binderySecurityReady: boolean;
  performanceMetrics: {
    initializationTime: number;
    totalSecurityOverhead: number;
    componentsInitialized: number;
    failedComponents: string[];
  };
  healthStatus: {
    overall: 'healthy' | 'degraded' | 'failed';
    components: Record<string, {
      status: 'healthy' | 'degraded' | 'failed';
      error?: string;
      lastCheck: number;
    }>;
  };
}

/**
 * Central security integration manager for Vespera Forge
 */
export class SecurityIntegrationManager implements EnhancedDisposable {
  private static instance: SecurityIntegrationManager | null = null;
  
  // Core security services
  private securityServices: SecurityEnhancedVesperaCoreServices | null = null;
  private secureToolManager: SecureToolManager | null = null;
  private toolSecurityManager: ToolOverrideSecurityManager | null = null;
  private fileSecurityManager: FileOperationsSecurityManager | null = null;
  private rustSecurityWrapper: RustFileOpsSecurityWrapper | null = null;
  private mcpSecureTools: McpSecureFileTools | null = null;
  private mcpValidator: McpMessageValidator | null = null;
  private binderyService: BinderyService | null = null;

  private config: SecurityIntegrationConfig;
  private status: SecurityIntegrationStatus;
  private disposables: vscode.Disposable[] = [];
  private _isDisposed = false;
  public readonly disposalPriority = 100; // High priority for security integration

  private constructor(
    private context: vscode.ExtensionContext,
    config: SecurityIntegrationConfig
  ) {
    this.config = config;
    this.status = {
      initialized: false,
      securityServicesReady: false,
      toolManagementReady: false,
      fileOperationsReady: false,
      mcpValidationReady: false,
      binderySecurityReady: false,
      performanceMetrics: {
        initializationTime: 0,
        totalSecurityOverhead: 0,
        componentsInitialized: 0,
        failedComponents: []
      },
      healthStatus: {
        overall: 'failed',
        components: {}
      }
    };
  }

  /**
   * Initialize security integration from VS Code configuration
   */
  public static async initializeFromConfig(
    context: vscode.ExtensionContext
  ): Promise<SecurityIntegrationManager> {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge');
    
    const config: SecurityIntegrationConfig = {
      securityLevel: workspaceConfig.get('security.level', 'standard'),
      enableAuditLogging: workspaceConfig.get('security.auditLogging', true),
      enableProcessIsolation: workspaceConfig.get('security.processIsolation', true),
      enableToolManagement: workspaceConfig.get('toolManagement.enabled', true),
      enableFileOperationsSecurity: workspaceConfig.get('fileOperations.securityValidation', true),
      enableMcpValidation: workspaceConfig.get('mcp.validation.enabled', true),
      enableRustFileOps: workspaceConfig.get('fileOperations.enableRustFileOps', true),
      performanceMode: 'balanced',
      targetSecurityOverhead: workspaceConfig.get('performance.targetSecurityOverhead', 2.0)
    };

    const manager = new SecurityIntegrationManager(context, config);
    await manager.initializeSecurityComponents();
    
    SecurityIntegrationManager.instance = manager;
    return manager;
  }

  /**
   * Get singleton instance
   */
  public static getInstance(): SecurityIntegrationManager | null {
    return SecurityIntegrationManager.instance;
  }

  /**
   * Initialize all security components with proper dependency management
   */
  private async initializeSecurityComponents(): Promise<void> {
    const startTime = performance.now();
    
    try {
      console.log('Initializing Vespera Forge security integration...');

      // Phase 1: Core Security Services (foundation)
      await this.initializeCoreSecurityServices();
      
      // Phase 2: Component Security Managers
      await this.initializeComponentSecurityManagers();
      
      // Phase 3: High-Level Security Services
      await this.initializeHighLevelSecurityServices();
      
      // Phase 4: Integration and Validation
      await this.validateSecurityIntegration();

      // Calculate performance metrics
      this.status.performanceMetrics.initializationTime = performance.now() - startTime;
      this.status.initialized = true;
      
      // Perform initial health check
      await this.performHealthCheck();

      console.log(`Security integration completed in ${this.status.performanceMetrics.initializationTime.toFixed(2)}ms`);
      
      // Log successful initialization
      await this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
        timestamp: Date.now(),
        metadata: {
          action: 'security_integration_initialized',
          initializationTime: this.status.performanceMetrics.initializationTime,
          componentsInitialized: this.status.performanceMetrics.componentsInitialized,
          securityLevel: this.config.securityLevel,
          performanceMode: this.config.performanceMode
        }
      });

    } catch (error) {
      this.status.performanceMetrics.initializationTime = performance.now() - startTime;
      this.status.healthStatus.overall = 'failed';
      
      console.error('Security integration initialization failed:', error);
      
      await this.logSecurityEvent(VesperaSecurityEvent.SECURITY_BREACH, {
        timestamp: Date.now(),
        metadata: {
          action: 'security_integration_failed',
          error: error instanceof Error ? error.message : String(error),
          initializationTime: this.status.performanceMetrics.initializationTime
        }
      });

      throw new VesperaSecurityError(
        `Security integration initialization failed: ${error instanceof Error ? error.message : String(error)}`,
        VesperaSecurityErrorCode.UNAUTHORIZED_ACCESS,
        undefined,
        { config: this.config }
      );
    }
  }

  /**
   * Phase 1: Initialize core security services
   */
  private async initializeCoreSecurityServices(): Promise<void> {
    try {
      console.log('Initializing core security services...');
      
      // Build security configuration from VS Code settings
      const securityConfig = this.buildSecurityConfiguration();
      
      // Initialize SecurityEnhancedCoreServices
      this.securityServices = await SecurityEnhancedVesperaCoreServices.initialize(
        this.context,
        {
          logging: {
            level: LogLevel.INFO
          },
          security: securityConfig
        }
      ) as unknown as SecurityEnhancedVesperaCoreServices;
      
      this.status.securityServicesReady = true;
      this.status.performanceMetrics.componentsInitialized++;
      this.updateComponentHealth('securityServices', 'healthy');

      console.log('Core security services initialized successfully');

    } catch (error) {
      this.status.performanceMetrics.failedComponents.push('securityServices');
      this.updateComponentHealth('securityServices', 'failed', error instanceof Error ? error.message : String(error));
      console.warn('Core security services initialization failed:', error);
      // Continue with reduced security
    }
  }

  /**
   * Phase 2: Initialize component security managers
   */
  private async initializeComponentSecurityManagers(): Promise<void> {
    const initPromises: Promise<void>[] = [];

    // Tool Management Security
    if (this.config.enableToolManagement) {
      initPromises.push(this.initializeToolManagement().catch(error => {
        this.status.performanceMetrics.failedComponents.push('toolManagement');
        this.updateComponentHealth('toolManagement', 'failed', error.message);
        console.warn('Tool management security initialization failed:', error);
      }));
    }

    // File Operations Security
    if (this.config.enableFileOperationsSecurity) {
      initPromises.push(this.initializeFileOperationsSecurity().catch(error => {
        this.status.performanceMetrics.failedComponents.push('fileOperations');
        this.updateComponentHealth('fileOperations', 'failed', error.message);
        console.warn('File operations security initialization failed:', error);
      }));
    }

    // MCP Validation
    if (this.config.enableMcpValidation) {
      initPromises.push(this.initializeMcpValidation().catch(error => {
        this.status.performanceMetrics.failedComponents.push('mcpValidation');
        this.updateComponentHealth('mcpValidation', 'failed', error.message);
        console.warn('MCP validation initialization failed:', error);
      }));
    }

    await Promise.allSettled(initPromises);
  }

  /**
   * Phase 3: Initialize high-level security services
   */
  private async initializeHighLevelSecurityServices(): Promise<void> {
    // MCP Secure File Tools (depends on file operations security and MCP validation)
    if (this.config.enableRustFileOps && (this.status.fileOperationsReady || this.status.mcpValidationReady)) {
      try {
        this.mcpSecureTools = await McpSecureFileTools.initialize();
        this.updateComponentHealth('mcpSecureTools', 'healthy');
        this.status.performanceMetrics.componentsInitialized++;
        console.log('MCP secure file tools initialized');
      } catch (error) {
        this.status.performanceMetrics.failedComponents.push('mcpSecureTools');
        this.updateComponentHealth('mcpSecureTools', 'failed', error instanceof Error ? error.message : String(error));
        console.warn('MCP secure file tools initialization failed:', error);
      }
    }

    // Bindery Service with Security
    if (this.config.enableProcessIsolation) {
      try {
        this.binderyService = new BinderyService({
          enableLogging: true,
          security: {
            enableProcessIsolation: true,
            enableJsonRpcValidation: true,
            enableContentProtection: true,
            maxProcessMemoryMB: vscode.workspace.getConfiguration('vesperaForge').get('security.maxProcessMemoryMB', 256),
            maxExecutionTimeMs: 300000, // 5 minutes for development (was 30000)
            allowedBinderyPaths: [],
            blockedBinderyPaths: [],
            requireSandbox: this.config.securityLevel === 'strict',
            auditAllOperations: this.config.enableAuditLogging,
            rateLimiting: {
              enabled: true,
              maxRequestsPerMinute: 1000,
              maxConcurrentRequests: 10
            }
          }
        });
        
        this.status.binderySecurityReady = true;
        this.updateComponentHealth('binderyService', 'healthy');
        this.status.performanceMetrics.componentsInitialized++;
        console.log('Bindery service with security initialized');
      } catch (error) {
        this.status.performanceMetrics.failedComponents.push('binderyService');
        this.updateComponentHealth('binderyService', 'failed', error instanceof Error ? error.message : String(error));
        console.warn('Bindery service initialization failed:', error);
      }
    }
  }

  /**
   * Initialize tool management security
   */
  private async initializeToolManagement(): Promise<void> {
    console.log('Initializing tool management security...');
    
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge');
    
    const toolPolicy: ToolManagementPolicy = {
      allowedTools: workspaceConfig.get('toolManagement.allowedTools', []),
      blockedTools: workspaceConfig.get('toolManagement.blockedTools', []),
      requireSecurityValidation: true,
      requirePerformanceValidation: true,
      enableRollback: workspaceConfig.get('toolManagement.enableRollback', true),
      maxOverrides: workspaceConfig.get('toolManagement.maxOverrides', 50),
      auditAllChanges: this.config.enableAuditLogging
    };

    this.secureToolManager = await SecureToolManager.initialize(toolPolicy);
    this.toolSecurityManager = await ToolOverrideSecurityManager.initialize();
    
    this.status.toolManagementReady = true;
    this.updateComponentHealth('toolManagement', 'healthy');
    this.status.performanceMetrics.componentsInitialized += 2;
  }

  /**
   * Initialize file operations security
   */
  private async initializeFileOperationsSecurity(): Promise<void> {
    console.log('Initializing file operations security...');
    
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge');
    
    const filePolicy: FileSecurityPolicy = {
      allowedDirectories: workspaceConfig.get('fileOperations.allowedDirectories', []).map((dir: string) =>
        dir.replace('${workspaceFolder}', vscode.workspace.workspaceFolders?.[0]?.uri.fsPath || '')
      ),
      blockedDirectories: workspaceConfig.get('fileOperations.blockedDirectories', []),
      allowedExtensions: ['.ts', '.js', '.json', '.md', '.txt', '.yaml', '.yml', '.toml', '.rs', '.py'],
      blockedExtensions: ['.exe', '.dll', '.so', '.dylib', '.sh', '.bat', '.cmd'],
      maxFileSize: workspaceConfig.get('fileOperations.maxFileSize', 52428800),
      requireContentScan: this.config.securityLevel !== 'permissive',
      enableRealTimeMonitoring: this.config.enableAuditLogging
    };

    this.fileSecurityManager = await FileOperationsSecurityManager.initialize(filePolicy);
    this.rustSecurityWrapper = await RustFileOpsSecurityWrapper.initialize();
    
    this.status.fileOperationsReady = true;
    this.updateComponentHealth('fileOperations', 'healthy');
    this.status.performanceMetrics.componentsInitialized += 2;
  }

  /**
   * Initialize MCP validation
   */
  private async initializeMcpValidation(): Promise<void> {
    console.log('Initializing MCP validation...');
    
    this.mcpValidator = await McpMessageValidator.initialize();
    
    this.status.mcpValidationReady = true;
    this.updateComponentHealth('mcpValidation', 'healthy');
    this.status.performanceMetrics.componentsInitialized++;
  }

  /**
   * Validate security integration
   */
  private async validateSecurityIntegration(): Promise<void> {
    console.log('Validating security integration...');
    
    // Test component connectivity
    const connectivityTests = [
      this.testSecurityServicesConnectivity(),
      this.testToolManagementConnectivity(),
      this.testFileOperationsConnectivity(),
      this.testMcpValidationConnectivity()
    ];

    const results = await Promise.allSettled(connectivityTests);
    
    // Calculate overall security overhead
    let totalOverhead = 0;
    let validTests = 0;
    
    results.forEach((result, _index) => {
      if (result.status === 'fulfilled' && result.value.overhead !== undefined) {
        totalOverhead += result.value.overhead;
        validTests++;
      }
    });
    
    if (validTests > 0) {
      this.status.performanceMetrics.totalSecurityOverhead = totalOverhead / validTests;
    }

    // Validate against target overhead
    if (this.status.performanceMetrics.totalSecurityOverhead > this.config.targetSecurityOverhead) {
      console.warn(
        `Security overhead ${this.status.performanceMetrics.totalSecurityOverhead.toFixed(2)}% exceeds target ${this.config.targetSecurityOverhead}%`
      );
    }
  }

  /**
   * Perform comprehensive health check
   */
  public async performHealthCheck(): Promise<SecurityIntegrationStatus> {
    const healthChecks = [
      this.checkSecurityServicesHealth(),
      this.checkToolManagementHealth(),
      this.checkFileOperationsHealth(),
      this.checkMcpValidationHealth()
    ];

    await Promise.allSettled(healthChecks);

    // Determine overall health
    const healthyComponents = Object.values(this.status.healthStatus.components)
      .filter(comp => comp.status === 'healthy').length;
    const totalComponents = Object.keys(this.status.healthStatus.components).length;
    
    if (healthyComponents === totalComponents) {
      this.status.healthStatus.overall = 'healthy';
    } else if (healthyComponents > totalComponents / 2) {
      this.status.healthStatus.overall = 'degraded';
    } else {
      this.status.healthStatus.overall = 'failed';
    }

    return { ...this.status };
  }

  /**
   * Build security configuration from VS Code settings
   */
  private buildSecurityConfiguration(): SecurityConfiguration {
    const workspaceConfig = vscode.workspace.getConfiguration('vesperaForge');
    
    return {
      enabled: workspaceConfig.get('security.enabled', true),
      rateLimiting: {
        enabled: workspaceConfig.get('mcp.rateLimiting.enabled', true),
        rules: [],
        globalDefaults: {
          capacity: 1000,
          refillRate: 16.67, // ~1000 per minute
          refillInterval: 1000
        }
      },
      consent: {
        enabled: false, // Not needed for this use case
        purposes: [],
        uiMode: 'status-bar',
        retention: {
          activeConsentDays: 30,
          auditLogDays: 90
        },
        encryption: {
          enabled: false,
          algorithm: 'AES-256-GCM'
        }
      },
      sanitization: {
        enabled: true,
        rules: [],
        strictMode: this.config.securityLevel === 'strict',
        csp: {
          defaultSrc: ["'self'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'", "'unsafe-inline'"],
          imgSrc: ["'self'", "data:", "https:"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          mediaSrc: ["'self'"],
          objectSrc: ["'none'"],
          childSrc: ["'self'"],
          frameAncestors: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: true
        },
        threatDetection: {
          patterns: [],
          enableRealTimeDetection: true,
          alertThresholds: {
            low: 10,
            medium: 5,
            high: 2,
            critical: 1
          }
        }
      },
      audit: {
        enabled: this.config.enableAuditLogging,
        retention: 90,
        includePII: false,
        exportFormat: 'json',
        realTimeAlerts: true
      }
    };
  }

  /**
   * Test connectivity methods (simplified for brevity)
   */
  private async testSecurityServicesConnectivity(): Promise<{ overhead: number }> {
    const startTime = performance.now();
    try {
      if (this.securityServices) {
        await this.securityServices.healthCheck();
      }
      return { overhead: performance.now() - startTime };
    } catch (error) {
      return { overhead: 100 }; // High overhead indicates failure
    }
  }

  private async testToolManagementConnectivity(): Promise<{ overhead: number }> {
    const startTime = performance.now();
    try {
      if (this.secureToolManager) {
        this.secureToolManager.getMetrics();
      }
      return { overhead: performance.now() - startTime };
    } catch (error) {
      return { overhead: 100 };
    }
  }

  private async testFileOperationsConnectivity(): Promise<{ overhead: number }> {
    const startTime = performance.now();
    try {
      if (this.fileSecurityManager) {
        this.fileSecurityManager.getSecurityMetrics();
      }
      return { overhead: performance.now() - startTime };
    } catch (error) {
      return { overhead: 100 };
    }
  }

  private async testMcpValidationConnectivity(): Promise<{ overhead: number }> {
    const startTime = performance.now();
    try {
      if (this.mcpValidator) {
        this.mcpValidator.getMetrics();
      }
      return { overhead: performance.now() - startTime };
    } catch (error) {
      return { overhead: 100 };
    }
  }

  /**
   * Health check methods (simplified)
   */
  private async checkSecurityServicesHealth(): Promise<void> {
    try {
      if (this.securityServices) {
        const health = await this.securityServices.healthCheck();
        this.updateComponentHealth('securityServices', health.healthy ? 'healthy' : 'degraded');
      }
    } catch (error) {
      this.updateComponentHealth('securityServices', 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  private async checkToolManagementHealth(): Promise<void> {
    try {
      if (this.secureToolManager) {
        const metrics = this.secureToolManager.getMetrics();
        this.updateComponentHealth('toolManagement', metrics.successRate > 90 ? 'healthy' : 'degraded');
      }
    } catch (error) {
      this.updateComponentHealth('toolManagement', 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  private async checkFileOperationsHealth(): Promise<void> {
    try {
      if (this.fileSecurityManager) {
        const metrics = this.fileSecurityManager.getSecurityMetrics();
        this.updateComponentHealth('fileOperations', metrics.blockRate < 50 ? 'healthy' : 'degraded');
      }
    } catch (error) {
      this.updateComponentHealth('fileOperations', 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  private async checkMcpValidationHealth(): Promise<void> {
    try {
      if (this.mcpValidator) {
        const metrics = this.mcpValidator.getMetrics();
        this.updateComponentHealth('mcpValidation', metrics.performance.compliant ? 'healthy' : 'degraded');
      }
    } catch (error) {
      this.updateComponentHealth('mcpValidation', 'failed', error instanceof Error ? error.message : String(error));
    }
  }

  /**
   * Helper methods
   */
  private updateComponentHealth(
    component: string, 
    status: 'healthy' | 'degraded' | 'failed', 
    error?: string
  ): void {
    this.status.healthStatus.components[component] = {
      status,
      error,
      lastCheck: Date.now()
    };
  }

  private async logSecurityEvent(event: VesperaSecurityEvent, context: SecurityEventContext): Promise<void> {
    if (this.securityServices?.securityAuditLogger) {
      try {
        await this.securityServices.securityAuditLogger.logSecurityEvent(event, context);
      } catch (error) {
        console.warn('Failed to log security event:', error);
      }
    }
  }

  /**
   * Public API methods
   */
  public getStatus(): SecurityIntegrationStatus {
    return { ...this.status };
  }

  public getSecurityServices(): SecurityEnhancedVesperaCoreServices | null {
    return this.securityServices;
  }

  public getSecureToolManager(): SecureToolManager | null {
    return this.secureToolManager;
  }

  public getFileSecurityManager(): FileOperationsSecurityManager | null {
    return this.fileSecurityManager;
  }

  public getMcpSecureTools(): McpSecureFileTools | null {
    return this.mcpSecureTools;
  }

  public getMcpValidator(): McpMessageValidator | null {
    return this.mcpValidator;
  }

  public getBinderyService(): BinderyService | null {
    return this.binderyService;
  }

  public updateConfiguration(config: Partial<SecurityIntegrationConfig>): void {
    this.config = { ...this.config, ...config };
  }

  /**
   * Check if the manager is disposed
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose all resources
   */
  public dispose(): void {
    console.log('Disposing security integration...');
    
    // Dispose all security components
    const disposables = [
      this.securityServices,
      this.secureToolManager,
      this.toolSecurityManager,
      this.fileSecurityManager,
      this.rustSecurityWrapper,
      this.mcpSecureTools,
      this.mcpValidator
    ].filter(Boolean);

    disposables.forEach(disposable => {
      try {
        disposable?.dispose();
      } catch (error) {
        console.warn('Error disposing security component:', error);
      }
    });

    // Dispose VS Code disposables
    this.disposables.forEach(disposable => disposable.dispose());

    this._isDisposed = true;
    SecurityIntegrationManager.instance = null;
  }
}