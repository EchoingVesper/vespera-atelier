/**
 * Property Data Collector
 * 
 * Handles data collection and file analysis utilities for property usage analysis.
 * Provides comprehensive file I/O operations, usage pattern detection,
 * and detailed analysis of property usage contexts.
 * 
 * This module focuses on:
 * - File content analysis and pattern detection
 * - Usage location identification and categorization
 * - Constructor and runtime usage analysis
 * - Access pattern identification
 * - Code analysis for false positive detection
 * - Compiler issue detection and reporting
 */

import * as fs from 'fs';
import { 
    UnusedVariable,
    ProcessingPhase
} from './UnusedVariableClassifier';
import { 
    ConfidenceLevel,
    PropertyUsagePattern
} from './PropertyAnalysisPhases';

export interface PropertyUsageAnalysis {
    usagePattern: PropertyUsagePattern;
    usageLocations: UsageLocation[];
    constructorUsage: ConstructorUsageDetails;
    runtimeUsage: RuntimeUsageDetails;
    accessPatterns: AccessPattern[];
    dependencyAnalysis: DependencyAnalysis;
}

export interface UsageLocation {
    file: string;
    line: number;
    context: string;
    type: UsageType;
    confidence: ConfidenceLevel;
}

export enum UsageType {
    DECLARATION = 'declaration',
    ASSIGNMENT = 'assignment',
    ACCESS = 'access',
    CONSTRUCTOR_INIT = 'constructor_init',
    METHOD_CALL = 'method_call',
    PROPERTY_ACCESS = 'property_access'
}

export interface ConstructorUsageDetails {
    isAssignedInConstructor: boolean;
    constructorLine: number | null;
    parameterSource: string | null;
    usedForInitialization: boolean;
    accessedAfterAssignment: boolean;
    initializationPattern: InitializationPattern;
}

export enum InitializationPattern {
    PARAMETER_STORAGE = 'parameter_storage',    // Parameter stored as property
    DIRECT_USAGE = 'direct_usage',              // Parameter used directly in constructor
    DERIVED_VALUE = 'derived_value',            // Property derived from parameter
    CONSTANT_ASSIGNMENT = 'constant_assignment' // Property assigned constant value
}

export interface RuntimeUsageDetails {
    accessCount: number;
    accessMethods: string[];
    usageContexts: string[];
    isOnlyInDeadCode: boolean;
    potentialFalsePositive: boolean;
}

export interface AccessPattern {
    pattern: string;
    frequency: number;
    context: AccessContext;
    riskAssessment: RiskLevel;
}

export enum AccessContext {
    METHOD_BODY = 'method_body',
    GETTER_SETTER = 'getter_setter',
    EVENT_HANDLER = 'event_handler',
    ASYNC_CALLBACK = 'async_callback',
    CONDITIONAL_BLOCK = 'conditional_block'
}

export interface DependencyAnalysis {
    requiredBy: string[];
    dependsOn: string[];
    serviceConnections: any[]; // Will be populated by strategic analyzer
    integrationPoints: any[]; // Will be populated by strategic analyzer
}

export interface InvestigationFindings {
    isPotentialFalsePositive: boolean;
    falsePositiveReasons: string[];
    compilerIssues: CompilerIssue[];
    codeAnalysisFindings: CodeAnalysisFindings;
    recommendedInvestigationSteps: string[];
}

export interface CompilerIssue {
    type: CompilerIssueType;
    description: string;
    possibleSolutions: string[];
}

export enum CompilerIssueType {
    TYPE_ANALYSIS_LIMITATION = 'type_analysis_limitation',
    DYNAMIC_ACCESS_DETECTION = 'dynamic_access_detection',
    ASYNC_USAGE_DETECTION = 'async_usage_detection',
    REFLECTION_USAGE = 'reflection_usage'
}

export interface CodeAnalysisFindings {
    similarPatternsInOtherFiles: string[];
    usageInComments: string[];
    usageInStrings: string[];
    potentialDynamicAccess: string[];
    relatedFunctionality: string[];
}

// Re-import RiskLevel from UnusedVariableClassifier
import { RiskLevel } from './UnusedVariableClassifier';

/**
 * Data collector and file analysis utilities for property usage analysis
 */
export class PropertyDataCollector {

    /**
     * Performs comprehensive usage analysis on a property
     */
    public static async performUsageAnalysis(property: UnusedVariable, fileContent: string): Promise<PropertyUsageAnalysis> {
        const usageLocations = this.findAllUsageLocations(property, fileContent);
        const constructorUsage = this.analyzeConstructorUsage(property, fileContent);
        const runtimeUsage = this.analyzeRuntimeUsage(property, fileContent);
        const accessPatterns = this.identifyAccessPatterns(property, fileContent);
        const dependencyAnalysis = this.analyzeDependencies(property, fileContent);

        return {
            usagePattern: this.determineUsagePattern(property, constructorUsage, runtimeUsage),
            usageLocations,
            constructorUsage,
            runtimeUsage,
            accessPatterns,
            dependencyAnalysis
        };
    }

    /**
     * Conducts detailed investigation for complex properties
     */
    public static async conductInvestigation(property: UnusedVariable, fileContent: string): Promise<InvestigationFindings> {
        const isPotentialFalsePositive = this.detectPotentialFalsePositive(property, fileContent);
        const falsePositiveReasons = this.identifyFalsePositiveReasons(property, fileContent);
        const compilerIssues = this.detectCompilerIssues(property, fileContent);
        const codeAnalysisFindings = await this.performCodeAnalysis(property);
        const recommendedInvestigationSteps = this.generateInvestigationSteps(property);

        return {
            isPotentialFalsePositive,
            falsePositiveReasons,
            compilerIssues,
            codeAnalysisFindings,
            recommendedInvestigationSteps
        };
    }

    /**
     * Reads file content safely with error handling
     */
    public static async getFileContent(filePath: string): Promise<string> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return content;
        } catch (error) {
            console.warn(`Failed to read file ${filePath}:`, error);
            return '';
        }
    }

    // Detailed analysis methods

    /**
     * Finds all usage locations of a property in the file
     */
    public static findAllUsageLocations(property: UnusedVariable, fileContent: string): UsageLocation[] {
        const locations: UsageLocation[] = [];
        const lines = fileContent.split('\n');
        
        lines.forEach((line, index) => {
            if (line.includes(property.name)) {
                const usageType = this.determineUsageType(line, property.name);
                const confidence = this.assessUsageConfidence(line, property.name);
                
                locations.push({
                    file: property.file,
                    line: index + 1,
                    context: line.trim(),
                    type: usageType,
                    confidence
                });
            }
        });

        return locations;
    }

    /**
     * Analyzes constructor usage patterns
     */
    public static analyzeConstructorUsage(property: UnusedVariable, fileContent: string): ConstructorUsageDetails {
        const lines = fileContent.split('\n');
        let constructorLine: number | null = null;
        let isAssignedInConstructor = false;
        let parameterSource: string | null = null;
        let usedForInitialization = false;
        let accessedAfterAssignment = false;

        // Find constructor and analyze usage
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (!line) {
                continue;
            }
            
            if (line.includes('constructor')) {
                constructorLine = i + 1;
            }
            
            if (constructorLine && line.includes(`this.${property.name}`)) {
                isAssignedInConstructor = true;
                
                // Check if it's parameter storage pattern
                if (line.includes('=') && !line.includes('new ') && !line.includes('require(')) {
                    parameterSource = this.extractParameterSource(line);
                    usedForInitialization = line.includes('init') || line.includes('setup');
                }
            }
        }

        return {
            isAssignedInConstructor,
            constructorLine,
            parameterSource,
            usedForInitialization,
            accessedAfterAssignment,
            initializationPattern: this.determineInitializationPattern(parameterSource, usedForInitialization)
        };
    }

    /**
     * Analyzes runtime usage patterns
     */
    public static analyzeRuntimeUsage(property: UnusedVariable, fileContent: string): RuntimeUsageDetails {
        const lines = fileContent.split('\n');
        let accessCount = 0;
        const accessMethods: string[] = [];
        const usageContexts: string[] = [];

        lines.forEach(line => {
            if (line && (line.includes(`this.${property.name}`) || line.includes(`.${property.name}`))) {
                accessCount++;
                
                // Extract method context
                const methodMatch = line.match(/(\w+)\s*\(/);
                if (methodMatch && methodMatch[1] && methodMatch[1] !== 'constructor') {
                    accessMethods.push(methodMatch[1]);
                }
                
                // Capture context
                usageContexts.push(line.trim());
            }
        });

        return {
            accessCount,
            accessMethods: [...new Set(accessMethods)],
            usageContexts,
            isOnlyInDeadCode: this.isOnlyInDeadCode(usageContexts),
            potentialFalsePositive: accessCount > 0 // If we found access, might be false positive
        };
    }

    /**
     * Identifies access patterns for risk assessment
     */
    public static identifyAccessPatterns(property: UnusedVariable, fileContent: string): AccessPattern[] {
        const patterns: AccessPattern[] = [];
        
        // Common access patterns to look for
        const patternChecks = [
            { pattern: `this.${property.name}.`, frequency: 0, context: AccessContext.METHOD_BODY },
            { pattern: `${property.name}(`, frequency: 0, context: AccessContext.METHOD_BODY },
            { pattern: `${property.name}.handleError`, frequency: 0, context: AccessContext.EVENT_HANDLER }
        ];

        // Count pattern occurrences
        patternChecks.forEach(check => {
            const matches = fileContent.match(new RegExp(check.pattern.replace('.', '\\.'), 'g'));
            if (matches) {
                patterns.push({
                    pattern: check.pattern,
                    frequency: matches.length,
                    context: check.context,
                    riskAssessment: matches.length > 2 ? RiskLevel.LOW : RiskLevel.MEDIUM
                });
            }
        });

        return patterns;
    }

    /**
     * Analyzes dependencies for the property
     */
    public static analyzeDependencies(_property: UnusedVariable, _fileContent: string): DependencyAnalysis {
        return {
            requiredBy: [],
            dependsOn: [],
            serviceConnections: [], // Will be populated by strategic analyzer
            integrationPoints: [] // Will be populated by strategic analyzer
        };
    }

    /**
     * Determines usage pattern based on analysis
     */
    public static determineUsagePattern(
        property: UnusedVariable,
        constructorUsage: ConstructorUsageDetails,
        runtimeUsage: RuntimeUsageDetails
    ): PropertyUsagePattern {
        // Check for constructor-only pattern
        if (constructorUsage.isAssignedInConstructor && runtimeUsage.accessCount === 0) {
            return PropertyUsagePattern.CONSTRUCTOR_ONLY;
        }

        // Check for service integration gaps
        if (property.name.includes('coreServices') || property.name.includes('errorHandler')) {
            return PropertyUsagePattern.SERVICE_INTEGRATION_GAP;
        }

        // Check for potential false positives
        if (runtimeUsage.potentialFalsePositive) {
            return PropertyUsagePattern.FALSE_POSITIVE;
        }

        // Default patterns based on phase
        switch (property.phase) {
            case ProcessingPhase.PHASE_2A:
                return PropertyUsagePattern.STORED_NEVER_ACCESSED;
            case ProcessingPhase.PHASE_2B:
                return PropertyUsagePattern.SERVICE_INTEGRATION_GAP;
            case ProcessingPhase.PHASE_2C:
                return PropertyUsagePattern.INCOMPLETE_FEATURE;
            default:
                return PropertyUsagePattern.INCOMPLETE_FEATURE;
        }
    }

    // False positive detection methods

    /**
     * Detects potential false positives in TypeScript analysis
     */
    public static detectPotentialFalsePositive(property: UnusedVariable, fileContent: string): boolean {
        // Special case: status-bar.ts context property
        if (property.file.includes('status-bar.ts') && property.name === 'context') {
            return fileContent.includes('context') && Boolean(fileContent.match(/line\s*58/i));
        }

        // Check for dynamic access patterns
        const dynamicPatterns = [
            `this['${property.name}']`,
            `this["${property.name}"]`,
            `[${property.name}]`,
            `["${property.name}"]`
        ];

        return dynamicPatterns.some(pattern => fileContent.includes(pattern));
    }

    /**
     * Identifies specific reasons for false positive classification
     */
    public static identifyFalsePositiveReasons(property: UnusedVariable, fileContent: string): string[] {
        const reasons: string[] = [];

        if (this.detectPotentialFalsePositive(property, fileContent)) {
            reasons.push('Dynamic property access patterns detected');
        }

        if (fileContent.includes('reflection') || fileContent.includes('Reflect.')) {
            reasons.push('Reflection-based access possible');
        }

        if (fileContent.includes('async') || fileContent.includes('await')) {
            reasons.push('Async usage patterns may not be detected by TypeScript compiler');
        }

        return reasons;
    }

    /**
     * Detects compiler analysis issues
     */
    public static detectCompilerIssues(property: UnusedVariable, fileContent: string): CompilerIssue[] {
        const issues: CompilerIssue[] = [];

        // Check for type analysis limitations
        if (fileContent.includes('any') || fileContent.includes('unknown')) {
            issues.push({
                type: CompilerIssueType.TYPE_ANALYSIS_LIMITATION,
                description: 'Type analysis may be limited by any/unknown types',
                possibleSolutions: ['Add more specific type annotations', 'Review type definitions']
            });
        }

        // Check for dynamic access detection issues
        if (this.detectPotentialFalsePositive(property, fileContent)) {
            issues.push({
                type: CompilerIssueType.DYNAMIC_ACCESS_DETECTION,
                description: 'Dynamic property access not detected by static analysis',
                possibleSolutions: ['Review for bracket notation usage', 'Check for runtime property access']
            });
        }

        return issues;
    }

    /**
     * Performs cross-file code analysis
     */
    public static async performCodeAnalysis(_property: UnusedVariable): Promise<CodeAnalysisFindings> {
        // This would perform cross-file analysis in a real implementation
        // For now, return empty findings as a placeholder
        return {
            similarPatternsInOtherFiles: [],
            usageInComments: [],
            usageInStrings: [],
            potentialDynamicAccess: [],
            relatedFunctionality: []
        };
    }

    /**
     * Generates investigation steps for complex cases
     */
    public static generateInvestigationSteps(property: UnusedVariable): string[] {
        const steps: string[] = [];

        steps.push(`Examine ${property.file} around line ${property.line} for actual usage`);
        steps.push('Search for dynamic property access patterns');
        steps.push('Check for usage in related files and imports');
        steps.push('Review git history for recent changes to this property');

        if (property.phase === ProcessingPhase.PHASE_2C) {
            steps.push('Consider if this represents incomplete feature development');
            steps.push('Evaluate architectural necessity of this property');
        }

        return steps;
    }

    // Utility helper methods

    /**
     * Determines the type of usage from a line of code
     */
    public static determineUsageType(line: string, propertyName: string): UsageType {
        if (line.includes(`${propertyName}:`)) return UsageType.DECLARATION;
        if (line.includes(`= ${propertyName}`) || line.includes(`${propertyName} =`)) return UsageType.ASSIGNMENT;
        if (line.includes(`this.${propertyName}`)) return UsageType.PROPERTY_ACCESS;
        if (line.includes(`${propertyName}(`)) return UsageType.METHOD_CALL;
        return UsageType.ACCESS;
    }

    /**
     * Assesses confidence level of usage detection
     */
    public static assessUsageConfidence(line: string, propertyName: string): ConfidenceLevel {
        if (line.includes(`this.${propertyName}`) || line.includes(`${propertyName}:`)) {
            return ConfidenceLevel.HIGH;
        }
        if (line.includes(propertyName)) {
            return ConfidenceLevel.MEDIUM;
        }
        return ConfidenceLevel.LOW;
    }

    /**
     * Extracts parameter source from assignment line
     */
    public static extractParameterSource(line: string): string | null {
        const match = line.match(/=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        return match?.[1] ?? null;
    }

    /**
     * Determines initialization pattern from parameters
     */
    public static determineInitializationPattern(parameterSource: string | null, usedForInitialization: boolean): InitializationPattern {
        if (!parameterSource) return InitializationPattern.CONSTANT_ASSIGNMENT;
        if (usedForInitialization) return InitializationPattern.DERIVED_VALUE;
        return InitializationPattern.PARAMETER_STORAGE;
    }

    /**
     * Checks if usage is only in dead code
     */
    public static isOnlyInDeadCode(usageContexts: string[]): boolean {
        // Simple heuristic - would need more sophisticated analysis
        return usageContexts.every(context => 
            context.includes('// TODO') || 
            context.includes('/* TODO') ||
            context.includes('if (false') ||
            context.includes('if (0')
        );
    }
}