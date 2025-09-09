/**
 * Unused Property Analyzer (Main Orchestrator)
 * 
 * Main orchestration module for unused property analysis.
 * Provides the public API and coordinates between specialized analysis modules:
 * - PropertyAnalysisPhases: Phase management and categorization
 * - PropertyStrategicAnalyzer: Strategic analysis and scoring
 * - PropertyDataCollector: Data collection and file analysis
 * 
 * Implements the strategic analysis from Phase 2 planning to enable:
 * - Phase 2A: Constructor refactoring (2 properties, LOW risk)
 * - Phase 2B: Service integration enhancement (7 properties, MEDIUM risk)  
 * - Phase 2C: System investigation and resolution (5 properties, HIGH complexity)
 */

import { 
    UnusedVariable, 
    ProcessingPhase
} from './UnusedVariableClassifier';
import { 
    PropertyAnalysisPhases,
    PropertyUsagePattern,
    ConfidenceLevel,
    IntegrationType
} from './PropertyAnalysisPhases';
import { 
    PropertyStrategicAnalyzer,
    IntegrationOpportunity
} from './PropertyStrategicAnalyzer';
import { 
    PropertyDataCollector,
    PropertyUsageAnalysis,
    InvestigationFindings
} from './PropertyDataCollector';

// Re-export key interfaces and types from specialized modules
export { 
    PropertyUsageAnalysis,
    UsageLocation,
    UsageType,
    ConstructorUsageDetails,
    InitializationPattern,
    RuntimeUsageDetails,
    AccessPattern,
    AccessContext,
    DependencyAnalysis,
    InvestigationFindings,
    CompilerIssue,
    CompilerIssueType,
    CodeAnalysisFindings
} from './PropertyDataCollector';

export { 
    IntegrationOpportunity,
    ServiceConnection,
    ConnectionType,
    IntegrationPoint
} from './PropertyStrategicAnalyzer';

export { 
    PropertyUsagePattern,
    IntegrationType,
    EffortLevel,
    BenefitLevel,
    ConfidenceLevel
} from './PropertyAnalysisPhases';

export interface PropertyAnalysisResult {
    property: UnusedVariable;
    usageAnalysis: PropertyUsageAnalysis;
    integrationOpportunity: IntegrationOpportunity | null;
    investigationFindings: InvestigationFindings;
    recommendedAction: PropertyAction;
    confidence: ConfidenceLevel;
}

export enum PropertyRemovalRisk {
    LOW = 'low',        // Safe to remove, no side effects expected
    MEDIUM = 'medium',  // Some risk, needs testing verification
    HIGH = 'high'       // High risk, requires thorough investigation
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

/**
 * Main orchestrator class for unused property analysis.
 * Coordinates between specialized analysis modules to provide comprehensive property evaluation.
 */
export class UnusedPropertyAnalyzer {

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
        const fileContent = await PropertyDataCollector.getFileContent(property.file);
        
        // Perform comprehensive usage analysis
        const usageAnalysis = await PropertyDataCollector.performUsageAnalysis(property, fileContent);
        
        // Identify integration opportunities
        const integrationOpportunity = PropertyStrategicAnalyzer.identifyIntegrationOpportunity(property, fileContent);
        
        // Conduct investigation for complex cases
        const investigationFindings = await PropertyDataCollector.conductInvestigation(property, fileContent);
        
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
                const fileContent = await PropertyDataCollector.getFileContent(property.file);
                const opportunity = PropertyStrategicAnalyzer.analyzeServiceIntegrationOpportunity(property, fileContent);
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

    // Private orchestration methods

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
        // Use phase-based confidence from PropertyAnalysisPhases
        const expectedConfidence = PropertyAnalysisPhases.getExpectedConfidence(property);
        
        // Adjust based on analysis findings
        if (property.phase === ProcessingPhase.PHASE_2A && 
            usageAnalysis.usagePattern === PropertyUsagePattern.CONSTRUCTOR_ONLY) {
            return ConfidenceLevel.HIGH;
        }

        if (property.phase === ProcessingPhase.PHASE_2B && 
            usageAnalysis.usagePattern === PropertyUsagePattern.SERVICE_INTEGRATION_GAP) {
            return ConfidenceLevel.MEDIUM;
        }

        // Lower confidence for potential false positives
        if (investigationFindings.isPotentialFalsePositive) {
            return ConfidenceLevel.LOW;
        }

        return expectedConfidence;
    }

    // Report calculation helper methods
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
 * // Analyze all unused properties using the refactored modular approach
 * const properties = await UnusedVariableClassifier.classifyFromDiagnostics();
 * const propertyErrors = properties.filter(p => p.type === UnusedVariableType.CLASS_PROPERTY);
 * const analysis = await UnusedPropertyAnalyzer.analyzeUnusedProperties(propertyErrors);
 * 
 * // Analyze by phase for targeted processing
 * const phase2aAnalysis = await UnusedPropertyAnalyzer.analyzeByPhase(propertyErrors, ProcessingPhase.PHASE_2A);
 * console.log(`Phase 2A: ${phase2aAnalysis.length} constructor refactoring opportunities`);
 * 
 * // Identify integration opportunities (Phase 2B focus)
 * const opportunities = await UnusedPropertyAnalyzer.identifyIntegrationOpportunities(propertyErrors);
 * opportunities.forEach(opp => {
 *     console.log(`${opp.type}: ${opp.description} (${opp.effort} effort, ${opp.expectedBenefit} benefit)`);
 * });
 * 
 * // Generate investigation report for complex cases (Phase 2C)
 * const investigationReport = await UnusedPropertyAnalyzer.generateInvestigationReport(propertyErrors);
 * console.log(`Investigation required for ${investigationReport.totalPropertiesInvestigated} properties`);
 * console.log(`Estimated time: ${investigationReport.estimatedInvestigationTime} minutes`);
 */