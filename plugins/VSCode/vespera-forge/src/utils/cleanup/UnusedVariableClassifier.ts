/**
 * Unused Variable Classifier
 * 
 * Automatically classifies the 188 TS6133 unused variables into phases based on
 * strategic analysis patterns from the comprehensive strategy.
 * 
 * This utility enables systematic processing of unused variables with proper
 * risk assessment and implementation prioritization.
 */

import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';

export interface UnusedVariable {
    name: string;
    file: string;
    line: number;
    column: number;
    type: UnusedVariableType;
    riskLevel: RiskLevel;
    phase: ProcessingPhase;
    category: ErrorCategory;
    context?: string;
    relatedCode?: string;
}

export enum UnusedVariableType {
    IMPORT_DECLARATION = 'import',
    FUNCTION_PARAMETER = 'parameter',
    LOCAL_VARIABLE = 'variable',
    FUNCTION_DECLARATION = 'function',
    CONSTANT_CONFIGURATION = 'constant'
}

export enum RiskLevel {
    LOW = 'low',           // Safe removal - imports, unused parameters
    MEDIUM = 'medium',     // Integration needed - incomplete features
    HIGH = 'high'          // Architectural - security, core systems
}

export enum ProcessingPhase {
    PHASE_1A = '1a',       // Safe Removals (113 errors - 60%)
    PHASE_1B = '1b',       // Integration Connections (56 errors - 30%) 
    PHASE_1C = '1c'        // Architectural Improvements (19 errors - 10%)
}

export enum ErrorCategory {
    // Phase 1A Categories
    UNUSED_IMPORTS = 'unused_imports',
    SAFE_PARAMETERS = 'safe_parameters', 
    SIMPLE_VARIABLES = 'simple_variables',
    
    // Phase 1B Categories
    INCOMPLETE_FEATURES = 'incomplete_features',
    CONFIG_INTEGRATION = 'config_integration',
    MONITORING_TIMING = 'monitoring_timing',
    
    // Phase 1C Categories
    SECURITY_INTEGRATION = 'security_integration',
    ERROR_HANDLING = 'error_handling',
    CORE_SYSTEM = 'core_system'
}

export class UnusedVariableClassifier {
    private static readonly CLASSIFICATION_RULES = {
        // Phase 1A: Safe Removals - Pattern Matching
        imports: {
            safeImportPatterns: [
                'StreamEvent', 'SecurityConfiguration', 'ThreatType',
                'VesperaSecurityErrorCode', 'ChatSession', 'TaskServerState',
                'FileContextState', 'SecurityEnhanced.*'
            ],
            phase: ProcessingPhase.PHASE_1A,
            risk: RiskLevel.LOW,
            category: ErrorCategory.UNUSED_IMPORTS
        },
        
        parameters: {
            safeParameterPatterns: [
                'message', 'context', 'index', 'params', 'webview',
                'extensionUri', 'reject', 'stdout', 'stderr', 'promise',
                '_.*' // Underscore prefixed parameters
            ],
            phase: ProcessingPhase.PHASE_1A,
            risk: RiskLevel.LOW,
            category: ErrorCategory.SAFE_PARAMETERS
        },
        
        // Phase 1B: Integration Connections
        incompleteFeatures: {
            functionPatterns: [
                'formatContextForLLM', 'migrateLegacyCredential',
                'getChatWebViewContent', 'saveConfiguration'
            ],
            phase: ProcessingPhase.PHASE_1B,
            risk: RiskLevel.MEDIUM,
            category: ErrorCategory.INCOMPLETE_FEATURES
        },
        
        configurationConstants: {
            constantPatterns: [
                'TEMPLATE_EXTENSIONS', 'CACHE_DURATION', 'CODEX_TEMPLATE_PATTERN',
                'BATCH_SIZE', 'BATCH_TIMEOUT', '.*_CONFIG'
            ],
            phase: ProcessingPhase.PHASE_1B,
            risk: RiskLevel.MEDIUM,
            category: ErrorCategory.CONFIG_INTEGRATION
        },
        
        timingVariables: {
            variablePatterns: [
                'startTime', 'requestStart', 'lastSyncTime', 
                '.*Time$', '.*Timestamp$'
            ],
            phase: ProcessingPhase.PHASE_1B,
            risk: RiskLevel.MEDIUM,
            category: ErrorCategory.MONITORING_TIMING
        },
        
        // Phase 1C: Architectural Improvements
        securityIntegration: {
            securityPatterns: [
                'VesperaSecurityAuditLogger', 'SecurityConfiguration',
                'audit.*', 'security.*', 'threat.*'
            ],
            phase: ProcessingPhase.PHASE_1C,
            risk: RiskLevel.HIGH,
            category: ErrorCategory.SECURITY_INTEGRATION
        },
        
        errorHandling: {
            errorPatterns: [
                'unhandledRejectionHandler', '.*ErrorHandler',
                'sanitizationError', '.*Exception.*'
            ],
            phase: ProcessingPhase.PHASE_1C,
            risk: RiskLevel.HIGH,
            category: ErrorCategory.ERROR_HANDLING
        }
    };

    /**
     * Classifies all unused variables from TypeScript compiler diagnostics
     */
    public static async classifyFromDiagnostics(): Promise<UnusedVariable[]> {
        const workspaceRoot = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
        if (!workspaceRoot) {
            throw new Error('No workspace found');
        }

        // Read current TypeScript errors
        const errorLogPath = path.join(workspaceRoot, 'current_errors.log');
        const errors = await this.parseTypeScriptErrors(errorLogPath);
        
        // Classify each unused variable
        const classifiedVariables: UnusedVariable[] = [];
        
        for (const error of errors) {
            if (error.code === 'TS6133') {
                const classified = await this.classifyUnusedVariable(error);
                if (classified) {
                    classifiedVariables.push(classified);
                }
            }
        }
        
        return classifiedVariables;
    }

    /**
     * Classifies a single unused variable based on patterns
     */
    public static async classifyUnusedVariable(error: any): Promise<UnusedVariable | null> {
        const variableName = this.extractVariableName(error.message);
        if (!variableName) return null;

        const fileContent = await this.getFileContent(error.file);
        const context = this.extractContext(fileContent, error.line);
        
        const classification = this.determineClassification(variableName, context, error.file);
        
        return {
            name: variableName,
            file: error.file,
            line: error.line,
            column: error.column,
            type: classification.type,
            riskLevel: classification.riskLevel,
            phase: classification.phase,
            category: classification.category,
            context,
            relatedCode: this.extractRelatedCode(fileContent, error.line)
        };
    }

    /**
     * Groups classified variables by phase for systematic processing
     */
    public static groupByPhase(variables: UnusedVariable[]): Record<ProcessingPhase, UnusedVariable[]> {
        const grouped = {
            [ProcessingPhase.PHASE_1A]: [],
            [ProcessingPhase.PHASE_1B]: [],
            [ProcessingPhase.PHASE_1C]: []
        } as Record<ProcessingPhase, UnusedVariable[]>;

        variables.forEach(variable => {
            grouped[variable.phase].push(variable);
        });

        return grouped;
    }

    /**
     * Generates processing statistics
     */
    public static generateStatistics(variables: UnusedVariable[]): ClassificationStatistics {
        const byPhase = this.groupByPhase(variables);
        const byRisk = this.groupByRisk(variables);
        const byCategory = this.groupByCategory(variables);
        
        return {
            total: variables.length,
            byPhase: {
                [ProcessingPhase.PHASE_1A]: byPhase[ProcessingPhase.PHASE_1A].length,
                [ProcessingPhase.PHASE_1B]: byPhase[ProcessingPhase.PHASE_1B].length,
                [ProcessingPhase.PHASE_1C]: byPhase[ProcessingPhase.PHASE_1C].length
            },
            byRisk: {
                [RiskLevel.LOW]: byRisk[RiskLevel.LOW].length,
                [RiskLevel.MEDIUM]: byRisk[RiskLevel.MEDIUM].length,
                [RiskLevel.HIGH]: byRisk[RiskLevel.HIGH].length
            },
            byCategory: Object.entries(byCategory).reduce((acc, [key, value]) => {
                acc[key as ErrorCategory] = value.length;
                return acc;
            }, {} as Record<ErrorCategory, number>)
        };
    }

    // Private helper methods

    private static async parseTypeScriptErrors(errorLogPath: string): Promise<any[]> {
        if (!fs.existsSync(errorLogPath)) {
            throw new Error(`Error log not found: ${errorLogPath}`);
        }

        const content = fs.readFileSync(errorLogPath, 'utf-8');
        const lines = content.split('\n');
        const errors: any[] = [];

        for (const line of lines) {
            const match = line.match(/^(.+?)\((\d+),(\d+)\):\s+error\s+(\w+):\s+(.+)$/);
            if (match && match[4] === 'TS6133') {
                errors.push({
                    file: match[1],
                    line: parseInt(match[2]),
                    column: parseInt(match[3]),
                    code: match[4],
                    message: match[5]
                });
            }
        }

        return errors;
    }

    private static extractVariableName(message: string): string | null {
        const match = message.match(/'([^']+)' is declared but its value is never read/);
        return match ? match[1] : null;
    }

    private static async getFileContent(filePath: string): Promise<string> {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return '';
        }
    }

    private static extractContext(content: string, lineNumber: number): string {
        const lines = content.split('\n');
        const contextStart = Math.max(0, lineNumber - 3);
        const contextEnd = Math.min(lines.length, lineNumber + 2);
        return lines.slice(contextStart, contextEnd).join('\n');
    }

    private static extractRelatedCode(content: string, lineNumber: number): string {
        const lines = content.split('\n');
        return lines[lineNumber - 1] || '';
    }

    private static determineClassification(
        variableName: string, 
        context: string, 
        filePath: string
    ): {
        type: UnusedVariableType,
        riskLevel: RiskLevel,
        phase: ProcessingPhase,
        category: ErrorCategory
    } {
        // Check imports
        if (context.includes('import') || context.includes('from')) {
            return this.classifyImport(variableName);
        }

        // Check function parameters  
        if (context.includes('function') || context.includes('=>') || context.includes('(')) {
            return this.classifyParameter(variableName, context);
        }

        // Check function declarations
        if (context.includes('function ' + variableName) || 
            context.includes('const ' + variableName + ' = ')) {
            return this.classifyFunction(variableName);
        }

        // Check constants/configuration
        if (context.includes('const ' + variableName) || 
            context.includes('CACHE') || context.includes('CONFIG')) {
            return this.classifyConstant(variableName);
        }

        // Default to variable classification
        return this.classifyVariable(variableName, context, filePath);
    }

    private static classifyImport(variableName: string): any {
        const rules = this.CLASSIFICATION_RULES.imports;
        const isKnownSafeImport = rules.safeImportPatterns.some(pattern =>
            new RegExp(pattern).test(variableName)
        );

        if (isKnownSafeImport) {
            return {
                type: UnusedVariableType.IMPORT_DECLARATION,
                riskLevel: rules.risk,
                phase: rules.phase,
                category: rules.category
            };
        }

        // Unknown imports get medium risk
        return {
            type: UnusedVariableType.IMPORT_DECLARATION,
            riskLevel: RiskLevel.MEDIUM,
            phase: ProcessingPhase.PHASE_1B,
            category: ErrorCategory.CONFIG_INTEGRATION
        };
    }

    private static classifyParameter(variableName: string, _context: string): any {
        const rules = this.CLASSIFICATION_RULES.parameters;
        const isSafeParameter = rules.safeParameterPatterns.some(pattern =>
            new RegExp(pattern).test(variableName)
        );

        if (isSafeParameter || variableName.startsWith('_')) {
            return {
                type: UnusedVariableType.FUNCTION_PARAMETER,
                riskLevel: rules.risk,
                phase: rules.phase,
                category: rules.category
            };
        }

        return {
            type: UnusedVariableType.FUNCTION_PARAMETER,
            riskLevel: RiskLevel.MEDIUM,
            phase: ProcessingPhase.PHASE_1B,
            category: ErrorCategory.INCOMPLETE_FEATURES
        };
    }

    private static classifyFunction(variableName: string): any {
        const rules = this.CLASSIFICATION_RULES.incompleteFeatures;
        const isIncompleteFeature = rules.functionPatterns.some(pattern =>
            new RegExp(pattern).test(variableName)
        );

        if (isIncompleteFeature) {
            return {
                type: UnusedVariableType.FUNCTION_DECLARATION,
                riskLevel: rules.risk,
                phase: rules.phase,
                category: rules.category
            };
        }

        // Check if security-related
        if (variableName.toLowerCase().includes('security') || 
            variableName.toLowerCase().includes('audit')) {
            return {
                type: UnusedVariableType.FUNCTION_DECLARATION,
                riskLevel: RiskLevel.HIGH,
                phase: ProcessingPhase.PHASE_1C,
                category: ErrorCategory.SECURITY_INTEGRATION
            };
        }

        return {
            type: UnusedVariableType.FUNCTION_DECLARATION,
            riskLevel: RiskLevel.MEDIUM,
            phase: ProcessingPhase.PHASE_1B,
            category: ErrorCategory.INCOMPLETE_FEATURES
        };
    }

    private static classifyConstant(variableName: string): any {
        const rules = this.CLASSIFICATION_RULES.configurationConstants;
        const isConfigConstant = rules.constantPatterns.some(pattern =>
            new RegExp(pattern).test(variableName)
        );

        if (isConfigConstant) {
            return {
                type: UnusedVariableType.CONSTANT_CONFIGURATION,
                riskLevel: rules.risk,
                phase: rules.phase,
                category: rules.category
            };
        }

        return {
            type: UnusedVariableType.CONSTANT_CONFIGURATION,
            riskLevel: RiskLevel.LOW,
            phase: ProcessingPhase.PHASE_1A,
            category: ErrorCategory.SIMPLE_VARIABLES
        };
    }

    private static classifyVariable(variableName: string, _context: string, filePath: string): any {
        // Check timing variables
        const timingRules = this.CLASSIFICATION_RULES.timingVariables;
        const isTimingVariable = timingRules.variablePatterns.some(pattern =>
            new RegExp(pattern).test(variableName)
        );

        if (isTimingVariable) {
            return {
                type: UnusedVariableType.LOCAL_VARIABLE,
                riskLevel: timingRules.risk,
                phase: timingRules.phase,
                category: timingRules.category
            };
        }

        // Check security variables
        const securityRules = this.CLASSIFICATION_RULES.securityIntegration;
        const isSecurityVariable = securityRules.securityPatterns.some(pattern =>
            new RegExp(pattern).test(variableName)
        );

        if (isSecurityVariable || filePath.includes('security')) {
            return {
                type: UnusedVariableType.LOCAL_VARIABLE,
                riskLevel: securityRules.risk,
                phase: securityRules.phase,
                category: securityRules.category
            };
        }

        // Default classification
        return {
            type: UnusedVariableType.LOCAL_VARIABLE,
            riskLevel: RiskLevel.LOW,
            phase: ProcessingPhase.PHASE_1A,
            category: ErrorCategory.SIMPLE_VARIABLES
        };
    }

    private static groupByRisk(variables: UnusedVariable[]): Record<RiskLevel, UnusedVariable[]> {
        const grouped = {
            [RiskLevel.LOW]: [],
            [RiskLevel.MEDIUM]: [],
            [RiskLevel.HIGH]: []
        } as Record<RiskLevel, UnusedVariable[]>;

        variables.forEach(variable => {
            grouped[variable.riskLevel].push(variable);
        });

        return grouped;
    }

    private static groupByCategory(variables: UnusedVariable[]): Record<ErrorCategory, UnusedVariable[]> {
        const grouped = {} as Record<ErrorCategory, UnusedVariable[]>;
        
        Object.values(ErrorCategory).forEach(category => {
            grouped[category] = [];
        });

        variables.forEach(variable => {
            if (!grouped[variable.category]) {
                grouped[variable.category] = [];
            }
            grouped[variable.category].push(variable);
        });

        return grouped;
    }
}

export interface ClassificationStatistics {
    total: number;
    byPhase: Record<ProcessingPhase, number>;
    byRisk: Record<RiskLevel, number>;
    byCategory: Record<ErrorCategory, number>;
}

/**
 * Usage Examples:
 * 
 * // Classify all unused variables
 * const variables = await UnusedVariableClassifier.classifyFromDiagnostics();
 * 
 * // Group by phase for systematic processing
 * const grouped = UnusedVariableClassifier.groupByPhase(variables);
 * const phase1a = grouped[ProcessingPhase.PHASE_1A]; // Safe removals
 * 
 * // Generate statistics
 * const stats = UnusedVariableClassifier.generateStatistics(variables);
 * console.log(`Phase 1A: ${stats.byPhase[ProcessingPhase.PHASE_1A]} errors`);
 */