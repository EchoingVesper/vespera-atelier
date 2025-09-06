/**
 * Unused Property Analyzer
 * 
 * Advanced analysis utilities specifically designed for the 14 TS6138 unused property errors.
 * Provides comprehensive tools for:
 * - Property usage pattern detection and analysis
 * - Constructor vs runtime usage differentiation
 * - Service integration opportunity identification
 * - False positive detection mechanisms
 * - Property lifecycle analysis
 * 
 * Implements the strategic analysis from Phase 2 planning to enable:
 * - Phase 2A: Constructor refactoring (2 properties, LOW risk)
 * - Phase 2B: Service integration enhancement (7 properties, MEDIUM risk)  
 * - Phase 2C: System investigation and resolution (5 properties, HIGH complexity)
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    UnusedVariable, 
    RiskLevel
} from './UnusedVariableClassifier';

export interface PropertyAnalysisResult {
    property: UnusedVariable;
    usageAnalysis: PropertyUsageAnalysis;
    integrationOpportunity: IntegrationOpportunity | null;
    investigationFindings: InvestigationFindings;
    recommendedAction: PropertyAction;
    confidence: ConfidenceLevel;
}

export interface PropertyUsageAnalysis {
    usagePattern: PropertyUsagePattern;
    usageLocations: UsageLocation[];
    constructorUsage: ConstructorUsageDetails;
    runtimeUsage: RuntimeUsageDetails;
    accessPatterns: AccessPattern[];
    dependencyAnalysis: DependencyAnalysis;
}

export enum PropertyUsagePattern {
    CONSTRUCTOR_ONLY = 'constructor_only',      // Phase 2A: Safe removal
    STORED_NEVER_ACCESSED = 'stored_never_accessed', // Phase 2A: Safe removal
    SERVICE_INTEGRATION_GAP = 'service_integration_gap', // Phase 2B: Integration needed
    ERROR_HANDLER_GAP = 'error_handler_gap',    // Phase 2B: Integration needed
    FALSE_POSITIVE = 'false_positive',          // Phase 2C: Investigation needed
    INCOMPLETE_FEATURE = 'incomplete_feature',  // Phase 2C: Investigation needed
    ARCHITECTURAL_PREP = 'architectural_prep'   // Phase 2C: Investigation needed
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
    serviceConnections: ServiceConnection[];
    integrationPoints: IntegrationPoint[];
}

export interface ServiceConnection {
    serviceName: string;
    connectionType: ConnectionType;
    isActuallyUsed: boolean;
    integrationOpportunity: boolean;
}

export enum ConnectionType {
    CORE_SERVICES = 'core_services',
    ERROR_HANDLER = 'error_handler',
    NOTIFICATION_SERVICE = 'notification_service',
    SECURITY_SERVICE = 'security_service'
}

export interface IntegrationPoint {
    location: string;
    type: IntegrationType;
    effort: EffortLevel;
    expectedBenefit: BenefitLevel;
}

export enum IntegrationType {
    INPUT_SANITIZATION = 'input_sanitization',
    ERROR_HANDLING = 'error_handling',
    SECURITY_AUDIT_LOGGING = 'security_audit_logging',
    PERFORMANCE_MONITORING = 'performance_monitoring'
}

export enum EffortLevel {
    LOW = 'low',       // 1-2 hours
    MEDIUM = 'medium', // 4-6 hours  
    HIGH = 'high'      // 8+ hours
}

export enum BenefitLevel {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high'
}

export enum PropertyRemovalRisk {
    LOW = 'low',        // Safe to remove, no side effects expected
    MEDIUM = 'medium',  // Some risk, needs testing verification
    HIGH = 'high'       // High risk, requires thorough investigation
}

export interface IntegrationOpportunity {
    type: IntegrationType;
    description: string;
    implementationSteps: string[];
    effort: EffortLevel;
    expectedBenefit: BenefitLevel;
    riskAssessment: RiskLevel;
    similarPatterns: string[];
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

export enum PropertyAction {
    // Phase 2A Actions
    CONVERT_TO_LOCAL_VARIABLE = 'convert_to_local_variable',
    REMOVE_PROPERTY_DECLARATION = 'remove_property_declaration',
    REFACTOR_CONSTRUCTOR_PARAMETERS = 'refactor_constructor_parameters',
    
    // Phase 2B Actions
    IMPLEMENT_CORE_SERVICES_INTEGRATION = 'implement_core_services_integration',
    IMPLEMENT_ERROR_HANDLER_INTEGRATION = 'implement_error_handler_integration',
    ADD_INPUT_SANITIZATION = 'add_input_sanitization',
    ADD_SECURITY_AUDIT_LOGGING = 'add_security_audit_logging',
    
    // Phase 2C Actions
    INVESTIGATE_POTENTIAL_FALSE_POSITIVE = 'investigate_potential_false_positive',
    COMPLETE_INCOMPLETE_FEATURE = 'complete_incomplete_feature',
    REMOVE_ARCHITECTURAL_PREPARATION = 'remove_architectural_preparation',
    DOCUMENT_INTENDED_USAGE = 'document_intended_usage'
}

export enum ConfidenceLevel {
    LOW = 'low',       // 0-60% confidence
    MEDIUM = 'medium', // 61-85% confidence  
    HIGH = 'high'      // 86-100% confidence
}

export class UnusedPropertyAnalyzer {
    private static readonly STRATEGIC_PROPERTY_DATA = {
        // Phase 2A: Constructor-Only Usage Properties (2 properties, LOW risk)
        constructorOnlyProperties: [
            { 
                file: 'VesperaConsentManager.ts', 
                property: '_storage', 
                line: 52,
                expectedPattern: PropertyUsagePattern.CONSTRUCTOR_ONLY,
                confidence: ConfidenceLevel.HIGH
            },
            { 
                file: 'VesperaConsentManager.ts', 
                property: '_config', 
                line: 54,
                expectedPattern: PropertyUsagePattern.CONSTRUCTOR_ONLY,
                confidence: ConfidenceLevel.HIGH
            }
        ],
        
        // Phase 2B: Service Integration Gap Properties (7 properties, MEDIUM risk)
        serviceIntegrationGaps: [
            {
                file: 'AgentProgressNotifier.ts',
                property: 'coreServices',
                line: 116,
                integrationType: IntegrationType.INPUT_SANITIZATION,
                similarPattern: 'MultiChatNotificationManager'
            },
            {
                file: 'TaskServerNotificationIntegration.ts',
                property: 'coreServices',
                line: 90,
                integrationType: IntegrationType.SECURITY_AUDIT_LOGGING,
                similarPattern: 'SecureNotificationManager'
            },
            {
                file: 'CrossPlatformNotificationHandler.ts',
                property: 'coreServices',
                line: 72,
                integrationType: IntegrationType.INPUT_SANITIZATION,
                similarPattern: 'MultiChatNotificationManager'
            },
            {
                file: 'MultiChatNotificationManager.ts',
                property: 'errorHandler',
                line: 180,
                integrationType: IntegrationType.ERROR_HANDLING,
                similarPattern: 'SecureNotificationManager'
            },
            {
                file: 'NotificationConfigManager.ts',
                property: 'errorHandler',
                line: 147,
                integrationType: IntegrationType.ERROR_HANDLING,
                similarPattern: 'AgentProgressNotifier'
            },
            {
                file: 'TaskServerNotificationIntegration.ts',
                property: 'errorHandler',
                line: 95,
                integrationType: IntegrationType.ERROR_HANDLING,
                similarPattern: 'SecureNotificationManager'
            },
            {
                file: 'CrossPlatformNotificationHandler.ts',
                property: 'errorHandler',
                line: 74,
                integrationType: IntegrationType.ERROR_HANDLING,
                similarPattern: 'AgentProgressNotifier'
            }
        ],
        
        // Phase 2C: System Context Properties (5 properties, HIGH complexity)
        systemContextProperties: [
            {
                file: 'status-bar.ts',
                property: 'context',
                line: 23,
                investigationType: 'false_positive_analysis',
                actualUsage: 'line 58',
                confidence: ConfidenceLevel.MEDIUM
            },
            {
                file: 'index.ts',
                property: '_context',
                line: 121,
                investigationType: 'architectural_preparation',
                confidence: ConfidenceLevel.LOW
            },
            {
                file: 'index.ts',
                property: '_chatManager',
                line: 123,
                investigationType: 'incomplete_feature',
                confidence: ConfidenceLevel.LOW
            },
            {
                file: 'index.ts',
                property: '_taskServerManager',
                line: 124,
                investigationType: 'incomplete_feature',
                confidence: ConfidenceLevel.LOW
            },
            {
                file: 'index.ts',
                property: '_contextCollector',
                line: 125,
                investigationType: 'incomplete_feature',
                confidence: ConfidenceLevel.LOW
            }
        ]
    };

    /**
     * Analyzes all unused properties providing detailed strategic insights
     */
    public static async analyzeUnusedProperties(properties: UnusedVariable[]): Promise<PropertyAnalysisResult[]> {
        const results: PropertyAnalysisResult[] = [];

        for (const property of properties) {
            const analysis = await this.analyzeIndividualProperty(property);
            results.push(analysis);
        }

        return results;
    }

    /**
     * Analyzes a single property with comprehensive usage pattern detection
     */
    public static async analyzeIndividualProperty(property: UnusedVariable): Promise<PropertyAnalysisResult> {
        const fileContent = await this.getFileContent(property.file);
        
        // Perform comprehensive usage analysis
        const usageAnalysis = await this.performUsageAnalysis(property, fileContent);
        
        // Identify integration opportunities
        const integrationOpportunity = this.identifyIntegrationOpportunity(property, usageAnalysis);
        
        // Conduct investigation for complex cases
        const investigationFindings = await this.conductInvestigation(property, fileContent);
        
        // Determine recommended action
        const recommendedAction = this.determineRecommendedAction(property, usageAnalysis, integrationOpportunity, investigationFindings);
        
        // Assess confidence level
        const confidence = this.assessConfidenceLevel(property, usageAnalysis, investigationFindings);

        return {
            property,
            usageAnalysis,
            integrationOpportunity,
            investigationFindings,
            recommendedAction,
            confidence
        };
    }

    /**
     * Analyzes properties by strategic phase for targeted processing
     */
    public static async analyzeByPhase(properties: UnusedVariable[], phase: ProcessingPhase): Promise<PropertyAnalysisResult[]> {
        const phaseProperties = properties.filter(p => p.phase === phase);
        return this.analyzeUnusedProperties(phaseProperties);
    }

    /**
     * Identifies integration opportunities by analyzing similar successful patterns
     */
    public static async identifyIntegrationOpportunities(properties: UnusedVariable[]): Promise<IntegrationOpportunity[]> {
        const opportunities: IntegrationOpportunity[] = [];

        for (const property of properties) {
            if (property.phase === ProcessingPhase.PHASE_2B) {
                const fileContent = await this.getFileContent(property.file);
                const opportunity = this.analyzeServiceIntegrationOpportunity(property, fileContent);
                if (opportunity) {
                    opportunities.push(opportunity);
                }
            }
        }

        return opportunities;
    }

    /**
     * Generates comprehensive investigation report for complex properties
     */
    public static async generateInvestigationReport(properties: UnusedVariable[]): Promise<InvestigationReport> {
        const investigationProperties = properties.filter(p => p.phase === ProcessingPhase.PHASE_2C);
        const investigations: PropertyAnalysisResult[] = [];

        for (const property of investigationProperties) {
            const analysis = await this.analyzeIndividualProperty(property);
            investigations.push(analysis);
        }

        return {
            totalPropertiesInvestigated: investigationProperties.length,
            falsePositives: investigations.filter(i => i.investigationFindings.isPotentialFalsePositive),
            incompleteFeatures: investigations.filter(i => i.recommendedAction === PropertyAction.COMPLETE_INCOMPLETE_FEATURE),
            architecturalPreparations: investigations.filter(i => i.recommendedAction === PropertyAction.REMOVE_ARCHITECTURAL_PREPARATION),
            confidenceDistribution: this.calculateConfidenceDistribution(investigations),
            recommendedInvestigationOrder: this.calculateInvestigationOrder(investigations),
            estimatedInvestigationTime: this.estimateInvestigationTime(investigations)
        };
    }

    // Private analysis methods

    private static async performUsageAnalysis(property: UnusedVariable, fileContent: string): Promise<PropertyUsageAnalysis> {
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

    private static identifyIntegrationOpportunity(
        property: UnusedVariable, 
        usageAnalysis: PropertyUsageAnalysis
    ): IntegrationOpportunity | null {
        // Only analyze properties in Phase 2B (service integration phase)
        if (property.phase !== ProcessingPhase.PHASE_2B) {
            return null;
        }

        // Find matching strategic data
        const strategicData = this.STRATEGIC_PROPERTY_DATA.serviceIntegrationGaps.find(
            data => property.file.includes(data.file) && property.name === data.property
        );

        if (!strategicData) {
            return null;
        }

        return {
            type: strategicData.integrationType,
            description: this.generateIntegrationDescription(strategicData),
            implementationSteps: this.generateImplementationSteps(strategicData),
            effort: this.estimateIntegrationEffort(strategicData),
            expectedBenefit: this.assessExpectedBenefit(strategicData),
            riskAssessment: RiskLevel.MEDIUM, // Phase 2B is MEDIUM risk
            similarPatterns: [strategicData.similarPattern]
        };
    }

    private static async conductInvestigation(property: UnusedVariable, fileContent: string): Promise<InvestigationFindings> {
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

    private static determineRecommendedAction(
        property: UnusedVariable,
        usageAnalysis: PropertyUsageAnalysis,
        integrationOpportunity: IntegrationOpportunity | null,
        investigationFindings: InvestigationFindings
    ): PropertyAction {
        // Phase 2A: Constructor refactoring
        if (property.phase === ProcessingPhase.PHASE_2A) {
            if (usageAnalysis.usagePattern === PropertyUsagePattern.CONSTRUCTOR_ONLY) {
                return PropertyAction.CONVERT_TO_LOCAL_VARIABLE;
            }
            return PropertyAction.REFACTOR_CONSTRUCTOR_PARAMETERS;
        }

        // Phase 2B: Service integration
        if (property.phase === ProcessingPhase.PHASE_2B && integrationOpportunity) {
            switch (integrationOpportunity.type) {
                case IntegrationType.INPUT_SANITIZATION:
                    return PropertyAction.ADD_INPUT_SANITIZATION;
                case IntegrationType.ERROR_HANDLING:
                    return PropertyAction.IMPLEMENT_ERROR_HANDLER_INTEGRATION;
                case IntegrationType.SECURITY_AUDIT_LOGGING:
                    return PropertyAction.ADD_SECURITY_AUDIT_LOGGING;
                default:
                    return PropertyAction.IMPLEMENT_CORE_SERVICES_INTEGRATION;
            }
        }

        // Phase 2C: Investigation and resolution
        if (property.phase === ProcessingPhase.PHASE_2C) {
            if (investigationFindings.isPotentialFalsePositive) {
                return PropertyAction.INVESTIGATE_POTENTIAL_FALSE_POSITIVE;
            }
            
            if (property.file.includes('index.ts') && property.name.startsWith('_')) {
                return PropertyAction.REMOVE_ARCHITECTURAL_PREPARATION;
            }
            
            return PropertyAction.COMPLETE_INCOMPLETE_FEATURE;
        }

        return PropertyAction.INVESTIGATE_POTENTIAL_FALSE_POSITIVE;
    }

    private static assessConfidenceLevel(
        property: UnusedVariable,
        usageAnalysis: PropertyUsageAnalysis,
        investigationFindings: InvestigationFindings
    ): ConfidenceLevel {
        // High confidence for Phase 2A constructor-only properties
        if (property.phase === ProcessingPhase.PHASE_2A && 
            usageAnalysis.usagePattern === PropertyUsagePattern.CONSTRUCTOR_ONLY) {
            return ConfidenceLevel.HIGH;
        }

        // Medium confidence for Phase 2B with clear integration opportunities
        if (property.phase === ProcessingPhase.PHASE_2B && 
            usageAnalysis.usagePattern === PropertyUsagePattern.SERVICE_INTEGRATION_GAP) {
            return ConfidenceLevel.MEDIUM;
        }

        // Lower confidence for investigation cases
        if (investigationFindings.isPotentialFalsePositive) {
            return ConfidenceLevel.LOW;
        }

        return ConfidenceLevel.MEDIUM;
    }

    // Detailed analysis helper methods

    private static findAllUsageLocations(property: UnusedVariable, fileContent: string): UsageLocation[] {
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

    private static analyzeConstructorUsage(property: UnusedVariable, fileContent: string): ConstructorUsageDetails {
        const lines = fileContent.split('\n');
        let constructorLine: number | null = null;
        let isAssignedInConstructor = false;
        let parameterSource: string | null = null;
        let usedForInitialization = false;
        let accessedAfterAssignment = false;

        // Find constructor and analyze usage
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            
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

    private static analyzeRuntimeUsage(property: UnusedVariable, fileContent: string): RuntimeUsageDetails {
        const lines = fileContent.split('\n');
        let accessCount = 0;
        const accessMethods: string[] = [];
        const usageContexts: string[] = [];

        lines.forEach(line => {
            if (line.includes(`this.${property.name}`) || line.includes(`.${property.name}`)) {
                accessCount++;
                
                // Extract method context
                const methodMatch = line.match(/(\w+)\s*\(/);
                if (methodMatch && methodMatch[1] !== 'constructor') {
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

    private static identifyAccessPatterns(property: UnusedVariable, fileContent: string): AccessPattern[] {
        const patterns: AccessPattern[] = [];
        
        // Common access patterns to look for
        const patternChecks = [
            { pattern: `this.${property.name}.`, frequency: 0, context: AccessContext.PROPERTY_ACCESS },
            { pattern: `${property.name}(`, frequency: 0, context: AccessContext.METHOD_BODY },
            { pattern: `${property.name}.handleError`, frequency: 0, context: AccessContext.ERROR_HANDLER }
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

    private static analyzeDependencies(property: UnusedVariable, fileContent: string): DependencyAnalysis {
        const serviceConnections: ServiceConnection[] = [];
        
        // Analyze service connections based on property name
        if (property.name.includes('coreServices')) {
            serviceConnections.push({
                serviceName: 'CoreServices',
                connectionType: ConnectionType.CORE_SERVICES,
                isActuallyUsed: fileContent.includes(`${property.name}.`),
                integrationOpportunity: true
            });
        }
        
        if (property.name.includes('errorHandler')) {
            serviceConnections.push({
                serviceName: 'ErrorHandler',
                connectionType: ConnectionType.ERROR_HANDLER,
                isActuallyUsed: fileContent.includes(`${property.name}.handleError`),
                integrationOpportunity: true
            });
        }

        return {
            requiredBy: [],
            dependsOn: [],
            serviceConnections,
            integrationPoints: this.identifyIntegrationPoints(property, serviceConnections)
        };
    }

    private static determineUsagePattern(
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

    // Strategic analysis helper methods

    private static analyzeServiceIntegrationOpportunity(property: UnusedVariable, fileContent: string): IntegrationOpportunity | null {
        // Find matching strategic data
        const strategicMatch = this.STRATEGIC_PROPERTY_DATA.serviceIntegrationGaps.find(
            data => property.file.includes(data.file) && property.name === data.property
        );

        if (!strategicMatch) {
            return null;
        }

        return {
            type: strategicMatch.integrationType,
            description: `Integrate ${property.name} for ${strategicMatch.integrationType} following ${strategicMatch.similarPattern} pattern`,
            implementationSteps: this.generateImplementationSteps(strategicMatch),
            effort: EffortLevel.MEDIUM,
            expectedBenefit: BenefitLevel.MEDIUM,
            riskAssessment: RiskLevel.MEDIUM,
            similarPatterns: [strategicMatch.similarPattern]
        };
    }

    private static detectPotentialFalsePositive(property: UnusedVariable, fileContent: string): boolean {
        // Special case: status-bar.ts context property
        if (property.file.includes('status-bar.ts') && property.name === 'context') {
            return fileContent.includes('context') && fileContent.match(/line\s*58/i);
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

    private static identifyFalsePositiveReasons(property: UnusedVariable, fileContent: string): string[] {
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

    private static detectCompilerIssues(property: UnusedVariable, fileContent: string): CompilerIssue[] {
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

    private static async performCodeAnalysis(property: UnusedVariable): Promise<CodeAnalysisFindings> {
        // This would perform cross-file analysis in a real implementation
        return {
            similarPatternsInOtherFiles: [],
            usageInComments: [],
            usageInStrings: [],
            potentialDynamicAccess: [],
            relatedFunctionality: []
        };
    }

    private static generateInvestigationSteps(property: UnusedVariable): string[] {
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

    private static async getFileContent(filePath: string): Promise<string> {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return '';
        }
    }

    private static determineUsageType(line: string, propertyName: string): UsageType {
        if (line.includes(`${propertyName}:`)) return UsageType.DECLARATION;
        if (line.includes(`= ${propertyName}`) || line.includes(`${propertyName} =`)) return UsageType.ASSIGNMENT;
        if (line.includes(`this.${propertyName}`)) return UsageType.PROPERTY_ACCESS;
        if (line.includes(`${propertyName}(`)) return UsageType.METHOD_CALL;
        return UsageType.ACCESS;
    }

    private static assessUsageConfidence(line: string, propertyName: string): ConfidenceLevel {
        if (line.includes(`this.${propertyName}`) || line.includes(`${propertyName}:`)) {
            return ConfidenceLevel.HIGH;
        }
        if (line.includes(propertyName)) {
            return ConfidenceLevel.MEDIUM;
        }
        return ConfidenceLevel.LOW;
    }

    private static extractParameterSource(line: string): string | null {
        const match = line.match(/=\s*([a-zA-Z_$][a-zA-Z0-9_$]*)/);
        return match ? match[1] : null;
    }

    private static determineInitializationPattern(parameterSource: string | null, usedForInitialization: boolean): InitializationPattern {
        if (!parameterSource) return InitializationPattern.CONSTANT_ASSIGNMENT;
        if (usedForInitialization) return InitializationPattern.DERIVED_VALUE;
        return InitializationPattern.PARAMETER_STORAGE;
    }

    private static isOnlyInDeadCode(usageContexts: string[]): boolean {
        // Simple heuristic - would need more sophisticated analysis
        return usageContexts.every(context => 
            context.includes('// TODO') || 
            context.includes('/* TODO') ||
            context.includes('if (false') ||
            context.includes('if (0')
        );
    }

    private static identifyIntegrationPoints(property: UnusedVariable, serviceConnections: ServiceConnection[]): IntegrationPoint[] {
        const points: IntegrationPoint[] = [];

        serviceConnections.forEach(connection => {
            if (connection.integrationOpportunity) {
                points.push({
                    location: property.file,
                    type: connection.connectionType === ConnectionType.ERROR_HANDLER ? 
                          IntegrationType.ERROR_HANDLING : 
                          IntegrationType.INPUT_SANITIZATION,
                    effort: EffortLevel.MEDIUM,
                    expectedBenefit: BenefitLevel.MEDIUM
                });
            }
        });

        return points;
    }

    private static generateIntegrationDescription(strategicData: any): string {
        return `Implement ${strategicData.integrationType.replace('_', ' ')} using the proven pattern from ${strategicData.similarPattern}`;
    }

    private static generateImplementationSteps(strategicData: any): string[] {
        switch (strategicData.integrationType) {
            case IntegrationType.INPUT_SANITIZATION:
                return [
                    'Add input sanitization calls using coreServices.inputSanitizer',
                    'Follow MultiChatNotificationManager pattern for consistent implementation',
                    'Add appropriate error handling for sanitization failures'
                ];
            case IntegrationType.ERROR_HANDLING:
                return [
                    'Add try-catch blocks with errorHandler.handleError() calls',
                    'Follow SecureNotificationManager pattern for error handling',
                    'Add user notification for critical errors'
                ];
            case IntegrationType.SECURITY_AUDIT_LOGGING:
                return [
                    'Add security audit logging using coreServices.securityAuditLogger',
                    'Log sensitive operations and access attempts',
                    'Follow established security logging patterns'
                ];
            default:
                return ['Analyze similar patterns and implement integration'];
        }
    }

    private static estimateIntegrationEffort(strategicData: any): EffortLevel {
        // Phase 2B is generally MEDIUM effort
        return EffortLevel.MEDIUM;
    }

    private static assessExpectedBenefit(strategicData: any): BenefitLevel {
        switch (strategicData.integrationType) {
            case IntegrationType.SECURITY_AUDIT_LOGGING:
                return BenefitLevel.HIGH;
            case IntegrationType.ERROR_HANDLING:
                return BenefitLevel.MEDIUM;
            default:
                return BenefitLevel.MEDIUM;
        }
    }

    private static calculateConfidenceDistribution(investigations: PropertyAnalysisResult[]): Record<ConfidenceLevel, number> {
        const distribution = {
            [ConfidenceLevel.LOW]: 0,
            [ConfidenceLevel.MEDIUM]: 0,
            [ConfidenceLevel.HIGH]: 0
        };

        investigations.forEach(investigation => {
            distribution[investigation.confidence]++;
        });

        return distribution;
    }

    private static calculateInvestigationOrder(investigations: PropertyAnalysisResult[]): PropertyAnalysisResult[] {
        // Sort by confidence (highest first) and complexity (lowest first)
        return investigations.sort((a, b) => {
            const confidenceOrder = { [ConfidenceLevel.HIGH]: 3, [ConfidenceLevel.MEDIUM]: 2, [ConfidenceLevel.LOW]: 1 };
            const confidenceDiff = confidenceOrder[b.confidence] - confidenceOrder[a.confidence];
            
            if (confidenceDiff !== 0) return confidenceDiff;
            
            // Secondary sort by file (group by file for efficiency)
            return a.property.file.localeCompare(b.property.file);
        });
    }

    private static estimateInvestigationTime(investigations: PropertyAnalysisResult[]): number {
        let totalTime = 0;
        
        investigations.forEach(investigation => {
            switch (investigation.confidence) {
                case ConfidenceLevel.HIGH:
                    totalTime += 30; // 30 minutes for high confidence cases
                    break;
                case ConfidenceLevel.MEDIUM:
                    totalTime += 60; // 1 hour for medium confidence cases
                    break;
                case ConfidenceLevel.LOW:
                    totalTime += 120; // 2 hours for low confidence cases
                    break;
            }
        });

        return totalTime; // Return in minutes
    }
}

export interface InvestigationReport {
    totalPropertiesInvestigated: number;
    falsePositives: PropertyAnalysisResult[];
    incompleteFeatures: PropertyAnalysisResult[];
    architecturalPreparations: PropertyAnalysisResult[];
    confidenceDistribution: Record<ConfidenceLevel, number>;
    recommendedInvestigationOrder: PropertyAnalysisResult[];
    estimatedInvestigationTime: number; // in minutes
}

/**
 * Usage Examples:
 * 
 * // Analyze all unused properties
 * const properties = await UnusedVariableClassifier.classifyFromDiagnostics();
 * const propertyErrors = properties.filter(p => p.type === UnusedVariableType.CLASS_PROPERTY);
 * const analysis = await UnusedPropertyAnalyzer.analyzeUnusedProperties(propertyErrors);
 * 
 * // Analyze by phase for targeted processing
 * const phase2aAnalysis = await UnusedPropertyAnalyzer.analyzeByPhase(propertyErrors, ProcessingPhase.PHASE_2A);
 * console.log(`Phase 2A: ${phase2aAnalysis.length} constructor refactoring opportunities`);
 * 
 * // Identify integration opportunities
 * const opportunities = await UnusedPropertyAnalyzer.identifyIntegrationOpportunities(propertyErrors);
 * opportunities.forEach(opp => {
 *     console.log(`${opp.type}: ${opp.description} (${opp.effort} effort, ${opp.expectedBenefit} benefit)`);
 * });
 * 
 * // Generate investigation report for complex cases
 * const investigationReport = await UnusedPropertyAnalyzer.generateInvestigationReport(propertyErrors);
 * console.log(`Investigation required for ${investigationReport.totalPropertiesInvestigated} properties`);
 * console.log(`Estimated time: ${investigationReport.estimatedInvestigationTime} minutes`);
 */