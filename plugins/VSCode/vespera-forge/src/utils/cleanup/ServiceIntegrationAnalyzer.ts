/**
 * Service Integration Analyzer
 * 
 * Specialized module for analyzing service integration patterns and system consistency
 * in TypeScript applications. Focuses on understanding how services, managers,
 * and other architectural components integrate within the broader system.
 * 
 * Responsibilities:
 * - Service integration pattern analysis
 * - System consistency validation  
 * - Architectural decision resolution
 * - Action recommendation generation
 * - Alternative action assessment
 */

import { UnusedVariable, RiskLevel } from './UnusedVariableClassifier';
import { 
    CompletionEffort,
    EffortComplexity,
    BusinessValue
} from './IncompleteFeatureAnalyzer';
import {
    EvidenceStrength
} from './FalsePositiveDetector';

// Define types needed for service integration analysis
export interface DetailedInvestigationFindings {
    actualUsageFound: boolean;
    usageLocations: any[];
    falsePositiveEvidence: any[];
    compilerLimitations: any[];
    dynamicAccessPatterns: any[];
    architecturalContext: any;
    incompleteFeatureAnalysis: any;
    crossFileReferences: any[];
    gitHistoryInsights: any[];
}

export interface InvestigationResolution {
    resolution: ResolutionType;
    confidence: InvestigationConfidence;
    justification: string;
    evidence: string[];
    recommendedActions: string[];
    futureMonitoring: string[];
}

export enum ResolutionType {
    CONFIRMED_FALSE_POSITIVE = 'confirmed_false_positive',
    CONFIRMED_UNUSED = 'confirmed_unused',
    INCOMPLETE_FEATURE_COMPLETION_NEEDED = 'incomplete_feature_completion_needed',
    ARCHITECTURAL_PREPARATION_REMOVAL = 'architectural_preparation_removal',
    REQUIRES_FURTHER_INVESTIGATION = 'requires_further_investigation',
    COMPILER_LIMITATION_WORKAROUND = 'compiler_limitation_workaround'
}

export enum InvestigationConfidence {
    LOW = 'low',       // 0-60% confidence in findings
    MEDIUM = 'medium', // 61-85% confidence in findings
    HIGH = 'high'      // 86-100% confidence in findings
}

export interface RecommendedAction {
    actionType: ActionType;
    description: string;
    implementationSteps: string[];
    riskLevel: RiskLevel;
    effort: CompletionEffort;
    alternatives: AlternativeAction[];
}

export enum ActionType {
    LEAVE_AS_IS = 'leave_as_is',
    REMOVE_PROPERTY = 'remove_property',
    COMPLETE_FEATURE = 'complete_feature',
    ADD_COMPILER_DIRECTIVE = 'add_compiler_directive',
    REFACTOR_FOR_CLARITY = 'refactor_for_clarity',
    DOCUMENT_INTENDED_USAGE = 'document_intended_usage'
}

export interface AlternativeAction {
    actionType: ActionType;
    description: string;
    pros: string[];
    cons: string[];
    effort: CompletionEffort;
}

export enum InvestigationType {
    FALSE_POSITIVE_ANALYSIS = 'false_positive_analysis',
    INCOMPLETE_FEATURE_ANALYSIS = 'incomplete_feature_analysis',
    ARCHITECTURAL_PREPARATION_ANALYSIS = 'architectural_preparation_analysis',
    COMPILER_LIMITATION_ANALYSIS = 'compiler_limitation_analysis',
    DYNAMIC_ACCESS_INVESTIGATION = 'dynamic_access_investigation'
}

// Re-export types for service integration analysis
export interface ServiceIntegrationAnalysis {
    hasServiceIntegration: boolean;
    integrationPatterns: IntegrationPattern[];
    systemConsistency: SystemConsistencyCheck;
    architecturalAlignment: ArchitecturalAlignment;
    recommendedResolution: ServiceResolution;
}

export interface IntegrationPattern {
    patternType: IntegrationPatternType;
    description: string;
    confidence: PatternConfidence;
    relatedServices: string[];
}

export enum IntegrationPatternType {
    DEPENDENCY_INJECTION = 'dependency_injection',
    SERVICE_LOCATOR = 'service_locator',
    EVENT_DRIVEN = 'event_driven',
    FACADE_PATTERN = 'facade_pattern',
    MANAGER_PATTERN = 'manager_pattern'
}

export enum PatternConfidence {
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

export interface SystemConsistencyCheck {
    isConsistent: boolean;
    inconsistencies: string[];
    consistencyScore: number;
    recommendations: string[];
}

export interface ArchitecturalAlignment {
    alignsWithArchitecture: boolean;
    architecturalConcerns: string[];
    alignmentScore: number;
    improvementSuggestions: string[];
}

export interface ServiceResolution {
    resolutionType: ServiceResolutionType;
    justification: string;
    effort: CompletionEffort;
    risks: string[];
}

export enum ServiceResolutionType {
    INTEGRATE_SERVICE = 'integrate_service',
    REFACTOR_PATTERN = 'refactor_pattern',
    REMOVE_UNUSED = 'remove_unused',
    DOCUMENT_INTENTION = 'document_intention'
}

/**
 * Service Integration Analyzer - Specialized analysis of service patterns and system integration
 */
export class ServiceIntegrationAnalyzer {

    /**
     * Determine investigation resolution based on findings and evidence
     */
    public static determineResolution(
        findings: DetailedInvestigationFindings, 
        _investigationType: import('./PropertyInvestigationTools').InvestigationType
    ): InvestigationResolution {
        let resolution: ResolutionType;
        let confidence: InvestigationConfidence;
        let justification: string;
        let evidence: string[] = [];
        
        // Determine resolution based on findings
        if (findings.actualUsageFound && findings.falsePositiveEvidence.length > 0) {
            resolution = ResolutionType.CONFIRMED_FALSE_POSITIVE;
            confidence = InvestigationConfidence.HIGH;
            justification = 'Property is actually used but not detected by TypeScript compiler';
            evidence = findings.falsePositiveEvidence.map(e => e.description);
        } else if (findings.incompleteFeatureAnalysis.isIncompleteFeature) {
            if (findings.incompleteFeatureAnalysis.businessValue === BusinessValue.HIGH) {
                resolution = ResolutionType.INCOMPLETE_FEATURE_COMPLETION_NEEDED;
                confidence = InvestigationConfidence.MEDIUM;
                justification = 'Property is part of valuable incomplete feature worth completing';
            } else {
                resolution = ResolutionType.CONFIRMED_UNUSED;
                confidence = InvestigationConfidence.MEDIUM;
                justification = 'Property is part of low-value incomplete feature - safe to remove';
            }
            evidence.push(`Feature completion: ${findings.incompleteFeatureAnalysis.completionPercentage}%`);
        } else if (findings.architecturalContext.isArchitecturalPreparation) {
            resolution = ResolutionType.ARCHITECTURAL_PREPARATION_REMOVAL;
            confidence = InvestigationConfidence.MEDIUM;
            justification = 'Property is architectural preparation with no concrete implementation plan';
            evidence.push(`Implementation status: ${findings.architecturalContext.implementationStatus}`);
        } else if (findings.compilerLimitations.length > 0) {
            resolution = ResolutionType.COMPILER_LIMITATION_WORKAROUND;
            confidence = InvestigationConfidence.LOW;
            justification = 'Property may be affected by TypeScript compiler limitations';
            evidence = findings.compilerLimitations.map(l => l.description);
        } else {
            resolution = ResolutionType.REQUIRES_FURTHER_INVESTIGATION;
            confidence = InvestigationConfidence.LOW;
            justification = 'Investigation inconclusive - requires manual review';
        }
        
        return {
            resolution,
            confidence,
            justification,
            evidence,
            recommendedActions: this.generateRecommendedActions(resolution),
            futureMonitoring: this.generateMonitoringRecommendations(resolution)
        };
    }

    /**
     * Assess investigation confidence based on evidence strength and cross-references
     */
    public static assessInvestigationConfidence(
        findings: DetailedInvestigationFindings, 
        resolution: InvestigationResolution
    ): InvestigationConfidence {
        // Base confidence from resolution
        let confidence = resolution.confidence;
        
        // Adjust based on evidence strength
        if (findings.falsePositiveEvidence.some(e => e.strength === EvidenceStrength.STRONG)) {
            confidence = InvestigationConfidence.HIGH;
        } else if (findings.crossFileReferences.length > 0 || findings.gitHistoryInsights.length > 0) {
            confidence = confidence === InvestigationConfidence.LOW ? InvestigationConfidence.MEDIUM : confidence;
        }
        
        return confidence;
    }

    /**
     * Generate comprehensive recommended action based on resolution and findings
     */
    public static generateRecommendedAction(
        resolution: InvestigationResolution, 
        findings: DetailedInvestigationFindings
    ): RecommendedAction {
        let actionType: ActionType;
        let description: string;
        let implementationSteps: string[];
        let riskLevel: RiskLevel;
        
        switch (resolution.resolution) {
            case ResolutionType.CONFIRMED_FALSE_POSITIVE:
                actionType = ActionType.LEAVE_AS_IS;
                description = 'Property is actually used - leave unchanged and potentially improve TypeScript detection';
                implementationSteps = [
                    'Document the actual usage for future reference',
                    'Consider adding TypeScript directive if compiler detection improves',
                    'Monitor for future compiler updates that might resolve detection'
                ];
                riskLevel = RiskLevel.LOW;
                break;
                
            case ResolutionType.INCOMPLETE_FEATURE_COMPLETION_NEEDED:
                actionType = ActionType.COMPLETE_FEATURE;
                description = `Complete the ${findings.incompleteFeatureAnalysis.featureName} feature`;
                implementationSteps = [
                    'Analyze missing components and dependencies',
                    'Create implementation plan with timeline',
                    'Implement missing functionality',
                    'Add comprehensive tests for the feature'
                ];
                riskLevel = RiskLevel.MEDIUM;
                break;
                
            case ResolutionType.ARCHITECTURAL_PREPARATION_REMOVAL:
                actionType = ActionType.REMOVE_PROPERTY;
                description = 'Remove unused architectural preparation property';
                implementationSteps = [
                    'Verify no dependent code exists',
                    'Remove property declaration',
                    'Clean up any related imports or types',
                    'Update documentation if necessary'
                ];
                riskLevel = RiskLevel.LOW;
                break;
                
            default:
                actionType = ActionType.DOCUMENT_INTENDED_USAGE;
                description = 'Document the intended usage and monitor for future development';
                implementationSteps = [
                    'Add comprehensive code comments explaining purpose',
                    'Document in architectural decision records',
                    'Set up monitoring for future changes',
                    'Schedule periodic review'
                ];
                riskLevel = RiskLevel.LOW;
        }
        
        return {
            actionType,
            description,
            implementationSteps,
            riskLevel,
            effort: this.estimateActionEffort(actionType, findings),
            alternatives: this.generateAlternativeActions(actionType, findings)
        };
    }

    /**
     * Analyze service integration patterns in the codebase
     */
    public static analyzeServiceIntegration(property: UnusedVariable, fileContent: string): ServiceIntegrationAnalysis {
        const integrationPatterns = this.identifyIntegrationPatterns(property, fileContent);
        const systemConsistency = this.checkSystemConsistency(property, fileContent);
        const architecturalAlignment = this.assessArchitecturalAlignment(property, integrationPatterns);
        
        return {
            hasServiceIntegration: integrationPatterns.length > 0,
            integrationPatterns,
            systemConsistency,
            architecturalAlignment,
            recommendedResolution: this.determineServiceResolution(property, integrationPatterns, systemConsistency)
        };
    }

    // Private helper methods

    private static generateRecommendedActions(resolution: ResolutionType): string[] {
        switch (resolution) {
            case ResolutionType.CONFIRMED_FALSE_POSITIVE:
                return ['Document actual usage', 'Consider compiler directive', 'Monitor compiler updates'];
            case ResolutionType.INCOMPLETE_FEATURE_COMPLETION_NEEDED:
                return ['Create implementation plan', 'Estimate effort', 'Prioritize in backlog'];
            case ResolutionType.ARCHITECTURAL_PREPARATION_REMOVAL:
                return ['Verify no dependencies', 'Remove property safely', 'Clean up related code'];
            default:
                return ['Schedule manual review', 'Gather additional context', 'Document findings'];
        }
    }

    private static generateMonitoringRecommendations(resolution: ResolutionType): string[] {
        switch (resolution) {
            case ResolutionType.CONFIRMED_FALSE_POSITIVE:
                return ['Monitor TypeScript compiler updates', 'Watch for usage pattern changes'];
            case ResolutionType.INCOMPLETE_FEATURE_COMPLETION_NEEDED:
                return ['Track feature development progress', 'Monitor business value assessment'];
            default:
                return ['Periodic review of decision', 'Monitor for new usage patterns'];
        }
    }

    private static estimateActionEffort(actionType: ActionType, findings: DetailedInvestigationFindings): CompletionEffort {
        let estimatedHours = 0;
        let complexity = EffortComplexity.SIMPLE;
        
        switch (actionType) {
            case ActionType.COMPLETE_FEATURE:
                estimatedHours = findings.incompleteFeatureAnalysis.completionEffort.estimatedHours;
                complexity = findings.incompleteFeatureAnalysis.completionEffort.complexity;
                break;
            case ActionType.REMOVE_PROPERTY:
                estimatedHours = 1;
                complexity = EffortComplexity.SIMPLE;
                break;
            default:
                estimatedHours = 0.5;
                complexity = EffortComplexity.SIMPLE;
        }
        
        return {
            estimatedHours,
            complexity,
            skillRequirements: actionType === ActionType.COMPLETE_FEATURE ? 
                ['TypeScript', 'VS Code APIs'] : ['TypeScript'],
            riskFactors: actionType === ActionType.COMPLETE_FEATURE ? 
                ['Incomplete requirements', 'API dependencies'] : []
        };
    }

    private static generateAlternativeActions(actionType: ActionType, _findings: DetailedInvestigationFindings): AlternativeAction[] {
        const alternatives: AlternativeAction[] = [];
        
        if (actionType === ActionType.COMPLETE_FEATURE) {
            alternatives.push({
                actionType: ActionType.REMOVE_PROPERTY,
                description: 'Remove incomplete feature instead of completing it',
                pros: ['Immediate cleanup', 'No implementation effort'],
                cons: ['Loss of potential future value', 'Wasted preparation effort'],
                effort: {
                    estimatedHours: 1,
                    complexity: EffortComplexity.SIMPLE,
                    skillRequirements: ['TypeScript'],
                    riskFactors: []
                }
            });
        }
        
        if (actionType === ActionType.REMOVE_PROPERTY) {
            alternatives.push({
                actionType: ActionType.DOCUMENT_INTENDED_USAGE,
                description: 'Document the property instead of removing it',
                pros: ['Preserves future options', 'Low risk'],
                cons: ['Continues to generate warnings', 'Clutters codebase'],
                effort: {
                    estimatedHours: 0.25,
                    complexity: EffortComplexity.SIMPLE,
                    skillRequirements: ['Documentation'],
                    riskFactors: []
                }
            });
        }
        
        return alternatives;
    }

    private static identifyIntegrationPatterns(property: UnusedVariable, fileContent: string): IntegrationPattern[] {
        const patterns: IntegrationPattern[] = [];
        
        // Check for dependency injection pattern
        if (fileContent.includes('constructor(') && fileContent.includes(property.name)) {
            patterns.push({
                patternType: IntegrationPatternType.DEPENDENCY_INJECTION,
                description: 'Property appears to use dependency injection pattern',
                confidence: PatternConfidence.HIGH,
                relatedServices: this.extractServiceReferences(fileContent)
            });
        }
        
        // Check for manager pattern
        if (property.name.includes('Manager') || property.name.includes('manager')) {
            patterns.push({
                patternType: IntegrationPatternType.MANAGER_PATTERN,
                description: 'Property follows manager pattern naming',
                confidence: PatternConfidence.MEDIUM,
                relatedServices: []
            });
        }
        
        // Check for service locator pattern
        if (fileContent.includes('getService') || fileContent.includes('locate')) {
            patterns.push({
                patternType: IntegrationPatternType.SERVICE_LOCATOR,
                description: 'Service locator pattern detected',
                confidence: PatternConfidence.MEDIUM,
                relatedServices: this.extractServiceReferences(fileContent)
            });
        }
        
        return patterns;
    }

    private static checkSystemConsistency(property: UnusedVariable, fileContent: string): SystemConsistencyCheck {
        const inconsistencies: string[] = [];
        let consistencyScore = 100;
        
        // Check for naming consistency
        if (property.name.startsWith('_') && !fileContent.includes('private')) {
            inconsistencies.push('Private property naming convention not followed');
            consistencyScore -= 20;
        }
        
        // Check for type consistency
        if (fileContent.includes('any') && property.name.includes('Manager')) {
            inconsistencies.push('Manager property should have specific type, not any');
            consistencyScore -= 30;
        }
        
        return {
            isConsistent: inconsistencies.length === 0,
            inconsistencies,
            consistencyScore: Math.max(0, consistencyScore),
            recommendations: inconsistencies.map(issue => `Fix: ${issue}`)
        };
    }

    private static assessArchitecturalAlignment(property: UnusedVariable, patterns: IntegrationPattern[]): ArchitecturalAlignment {
        const concerns: string[] = [];
        let alignmentScore = 80; // Start with good alignment
        
        // Check if property aligns with detected patterns
        if (patterns.length === 0 && property.name.includes('Manager')) {
            concerns.push('Manager property without clear integration pattern');
            alignmentScore -= 30;
        }
        
        // Check for architectural anti-patterns
        if (property.name.includes('_') && patterns.some(p => p.patternType === IntegrationPatternType.DEPENDENCY_INJECTION)) {
            concerns.push('Private property in DI context may indicate design issue');
            alignmentScore -= 20;
        }
        
        return {
            alignsWithArchitecture: concerns.length === 0,
            architecturalConcerns: concerns,
            alignmentScore: Math.max(0, alignmentScore),
            improvementSuggestions: concerns.map(concern => `Consider refactoring: ${concern}`)
        };
    }

    private static determineServiceResolution(
        _property: UnusedVariable, 
        patterns: IntegrationPattern[], 
        consistency: SystemConsistencyCheck
    ): ServiceResolution {
        if (patterns.length > 0 && consistency.isConsistent) {
            return {
                resolutionType: ServiceResolutionType.INTEGRATE_SERVICE,
                justification: 'Property shows good integration patterns and system consistency',
                effort: {
                    estimatedHours: 8,
                    complexity: EffortComplexity.MODERATE,
                    skillRequirements: ['TypeScript', 'System Architecture'],
                    riskFactors: ['Integration complexity']
                },
                risks: ['Breaking changes to dependent services']
            };
        } else if (patterns.length > 0 && !consistency.isConsistent) {
            return {
                resolutionType: ServiceResolutionType.REFACTOR_PATTERN,
                justification: 'Property has integration patterns but consistency issues need addressing',
                effort: {
                    estimatedHours: 4,
                    complexity: EffortComplexity.MODERATE,
                    skillRequirements: ['TypeScript', 'Refactoring'],
                    riskFactors: ['Pattern migration complexity']
                },
                risks: ['Temporary inconsistency during refactoring']
            };
        } else {
            return {
                resolutionType: ServiceResolutionType.REMOVE_UNUSED,
                justification: 'Property lacks clear integration patterns and purpose',
                effort: {
                    estimatedHours: 1,
                    complexity: EffortComplexity.SIMPLE,
                    skillRequirements: ['TypeScript'],
                    riskFactors: []
                },
                risks: ['Potential loss of future functionality']
            };
        }
    }

    private static extractServiceReferences(fileContent: string): string[] {
        const servicePattern = /(\w+Service|\w+Manager|\w+Provider)/g;
        const matches = fileContent.match(servicePattern) || [];
        return [...new Set(matches)]; // Remove duplicates
    }
}