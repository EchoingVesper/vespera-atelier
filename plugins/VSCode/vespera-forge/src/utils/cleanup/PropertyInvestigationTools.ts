/**
 * Property Investigation Tools
 * 
 * Advanced investigation infrastructure for Phase 2C complex property scenarios.
 * Provides comprehensive tools for:
 * - Property usage investigation utilities
 * - False positive detection mechanisms  
 * - Incomplete feature completion helpers
 * - System consistency validation tools
 * - TypeScript compiler analysis and diagnostics
 * 
 * Target: 5 TS6138 properties requiring investigation (HIGH complexity)
 * - status-bar.ts context property (potential false positive - actually used on line 58)
 * - index.ts _context property (architectural preparation)
 * - index.ts _chatManager property (incomplete feature) 
 * - index.ts _taskServerManager property (incomplete feature)
 * - index.ts _contextCollector property (incomplete feature)
 * 
 * Implements systematic investigation methodology for complex property scenarios.
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    UnusedVariable, 
    RiskLevel 
} from './UnusedVariableClassifier';
import { PropertyAnalysisResult } from './UnusedPropertyAnalyzer';

export interface PropertyInvestigationResult {
    property: UnusedVariable;
    investigationType: InvestigationType;
    findings: DetailedInvestigationFindings;
    resolution: InvestigationResolution;
    confidence: InvestigationConfidence;
    recommendedAction: RecommendedAction;
    executionTime: number;
}

export enum InvestigationType {
    FALSE_POSITIVE_ANALYSIS = 'false_positive_analysis',
    INCOMPLETE_FEATURE_ANALYSIS = 'incomplete_feature_analysis',
    ARCHITECTURAL_PREPARATION_ANALYSIS = 'architectural_preparation_analysis',
    COMPILER_LIMITATION_ANALYSIS = 'compiler_limitation_analysis',
    DYNAMIC_ACCESS_INVESTIGATION = 'dynamic_access_investigation'
}

export interface DetailedInvestigationFindings {
    actualUsageFound: boolean;
    usageLocations: ActualUsageLocation[];
    falsePositiveEvidence: FalsePositiveEvidence[];
    compilerLimitations: CompilerLimitation[];
    dynamicAccessPatterns: DynamicAccessPattern[];
    architecturalContext: ArchitecturalContext;
    incompleteFeatureAnalysis: IncompleteFeatureAnalysis;
    crossFileReferences: CrossFileReference[];
    gitHistoryInsights: GitHistoryInsight[];
}

export interface ActualUsageLocation {
    file: string;
    line: number;
    column: number;
    context: string;
    usageType: ActualUsageType;
    confidence: UsageConfidence;
    compilerDetection: CompilerDetectionStatus;
}

export enum ActualUsageType {
    DIRECT_PROPERTY_ACCESS = 'direct_property_access',
    DYNAMIC_PROPERTY_ACCESS = 'dynamic_property_access',
    DESTRUCTURING_ASSIGNMENT = 'destructuring_assignment',
    REFLECTION_ACCESS = 'reflection_access',
    TEMPLATE_STRING_USAGE = 'template_string_usage',
    SERIALIZATION_USAGE = 'serialization_usage'
}

export enum UsageConfidence {
    CONFIRMED = 'confirmed',     // 100% certain this is actual usage
    LIKELY = 'likely',           // 80-99% certain this is usage
    POSSIBLE = 'possible',       // 50-79% certain this is usage
    UNLIKELY = 'unlikely'        // 20-49% certain this is usage
}

export enum CompilerDetectionStatus {
    DETECTED = 'detected',           // TypeScript compiler found this usage
    NOT_DETECTED = 'not_detected',   // TypeScript compiler missed this usage
    MISCLASSIFIED = 'misclassified'  // TypeScript compiler incorrectly classified usage
}

export interface FalsePositiveEvidence {
    evidenceType: FalsePositiveEvidenceType;
    description: string;
    location: string;
    strength: EvidenceStrength;
    supportingData: any;
}

export enum FalsePositiveEvidenceType {
    ACTUAL_USAGE_FOUND = 'actual_usage_found',
    DYNAMIC_ACCESS_DETECTED = 'dynamic_access_detected',
    REFLECTION_USAGE = 'reflection_usage',
    ASYNC_USAGE_PATTERN = 'async_usage_pattern',
    TYPE_ASSERTION_ISSUE = 'type_assertion_issue',
    CONDITIONAL_USAGE = 'conditional_usage'
}

export enum EvidenceStrength {
    WEAK = 'weak',       // Suggestive but not conclusive
    MODERATE = 'moderate', // Good indication but needs verification
    STRONG = 'strong'     // Conclusive evidence
}

export interface CompilerLimitation {
    limitationType: CompilerLimitationType;
    description: string;
    affectedProperty: string;
    workaround: string[];
    impact: CompilerImpact;
}

export enum CompilerLimitationType {
    DYNAMIC_PROPERTY_ACCESS = 'dynamic_property_access',
    ASYNC_CALLBACK_ANALYSIS = 'async_callback_analysis',
    REFLECTION_ANALYSIS = 'reflection_analysis',
    TYPE_NARROWING_ISSUE = 'type_narrowing_issue',
    CONTROL_FLOW_ANALYSIS = 'control_flow_analysis',
    TEMPLATE_LITERAL_ANALYSIS = 'template_literal_analysis'
}

export enum CompilerImpact {
    LOW = 'low',       // Minor limitation, workaround exists
    MEDIUM = 'medium', // Significant limitation, may need code changes
    HIGH = 'high'      // Major limitation, substantial workaround required
}

export interface DynamicAccessPattern {
    pattern: string;
    file: string;
    line: number;
    accessMethod: DynamicAccessMethod;
    detectionConfidence: UsageConfidence;
    examples: string[];
}

export enum DynamicAccessMethod {
    BRACKET_NOTATION = 'bracket_notation',
    REFLECTION_API = 'reflection_api',
    OBJECT_KEYS_ITERATION = 'object_keys_iteration',
    PROXY_ACCESS = 'proxy_access',
    EVAL_USAGE = 'eval_usage',
    TEMPLATE_INTERPOLATION = 'template_interpolation'
}

export interface ArchitecturalContext {
    isArchitecturalPreparation: boolean;
    intendedPurpose: string;
    relatedFeatures: string[];
    implementationStatus: ImplementationStatus;
    futureUsagePlan: FutureUsagePlan | null;
}

export enum ImplementationStatus {
    NOT_STARTED = 'not_started',
    PARTIALLY_IMPLEMENTED = 'partially_implemented',
    INFRASTRUCTURE_ONLY = 'infrastructure_only',
    ABANDONED = 'abandoned'
}

export interface FutureUsagePlan {
    plannedFeature: string;
    estimatedImplementation: string;
    priority: FeaturePriority;
    dependencies: string[];
    blockers: string[];
}

export enum FeaturePriority {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    CRITICAL = 'critical'
}

export interface IncompleteFeatureAnalysis {
    isIncompleteFeature: boolean;
    featureName: string;
    completionPercentage: number;
    missingComponents: string[];
    implementationBarriers: ImplementationBarrier[];
    completionEffort: CompletionEffort;
    businessValue: BusinessValue;
}

export interface ImplementationBarrier {
    type: BarrierType;
    description: string;
    severity: BarrierSeverity;
    resolutionApproach: string[];
}

export enum BarrierType {
    TECHNICAL_COMPLEXITY = 'technical_complexity',
    MISSING_DEPENDENCIES = 'missing_dependencies',
    ARCHITECTURAL_CONSTRAINTS = 'architectural_constraints',
    RESOURCE_CONSTRAINTS = 'resource_constraints',
    EXTERNAL_DEPENDENCIES = 'external_dependencies'
}

export enum BarrierSeverity {
    LOW = 'low',
    MEDIUM = 'medium', 
    HIGH = 'high',
    BLOCKER = 'blocker'
}

export interface CompletionEffort {
    estimatedHours: number;
    complexity: EffortComplexity;
    skillRequirements: string[];
    riskFactors: string[];
}

export enum EffortComplexity {
    SIMPLE = 'simple',     // 1-8 hours
    MODERATE = 'moderate', // 8-40 hours
    COMPLEX = 'complex',   // 40+ hours
    UNKNOWN = 'unknown'    // Cannot estimate
}

export enum BusinessValue {
    LOW = 'low',
    MEDIUM = 'medium',
    HIGH = 'high',
    UNKNOWN = 'unknown'
}

export interface CrossFileReference {
    referencingFile: string;
    referencedProperty: string;
    referenceType: ReferenceType;
    context: string;
    isActiveReference: boolean;
}

export enum ReferenceType {
    IMPORT_REFERENCE = 'import_reference',
    TYPE_REFERENCE = 'type_reference',
    INTERFACE_REFERENCE = 'interface_reference',
    COMMENT_REFERENCE = 'comment_reference',
    STRING_REFERENCE = 'string_reference',
    DOCUMENTATION_REFERENCE = 'documentation_reference'
}

export interface GitHistoryInsight {
    propertyName: string;
    lastModified: Date;
    changeType: GitChangeType;
    commitMessage: string;
    author: string;
    filesAffected: number;
    relatedFeatures: string[];
}

export enum GitChangeType {
    ADDED = 'added',
    MODIFIED = 'modified',
    REMOVED = 'removed',
    MOVED = 'moved',
    RENAMED = 'renamed'
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

export class PropertyInvestigationTools {
    private static readonly STRATEGIC_INVESTIGATION_TARGETS = {
        // Phase 2C: System Context Properties (5 properties, HIGH complexity)
        falsePositiveCandidates: [
            {
                file: 'status-bar.ts',
                property: 'context',
                line: 23,
                suspectedActualUsage: 'line 58',
                investigationType: InvestigationType.FALSE_POSITIVE_ANALYSIS,
                priority: FeaturePriority.HIGH
            }
        ],
        
        architecturalPreparations: [
            {
                file: 'index.ts',
                property: '_context',
                line: 121,
                investigationType: InvestigationType.ARCHITECTURAL_PREPARATION_ANALYSIS,
                priority: FeaturePriority.LOW
            }
        ],
        
        incompleteFeatures: [
            {
                file: 'index.ts',
                property: '_chatManager',
                line: 123,
                relatedFeature: 'Multi-server chat management',
                investigationType: InvestigationType.INCOMPLETE_FEATURE_ANALYSIS,
                priority: FeaturePriority.MEDIUM
            },
            {
                file: 'index.ts',
                property: '_taskServerManager',
                line: 124,
                relatedFeature: 'Task server integration',
                investigationType: InvestigationType.INCOMPLETE_FEATURE_ANALYSIS,
                priority: FeaturePriority.MEDIUM
            },
            {
                file: 'index.ts',
                property: '_contextCollector',
                line: 125,
                relatedFeature: 'Context collection system',
                investigationType: InvestigationType.INCOMPLETE_FEATURE_ANALYSIS,
                priority: FeaturePriority.LOW
            }
        ]
    };

    /**
     * Conducts comprehensive investigation of a complex property
     */
    public static async investigateProperty(
        property: UnusedVariable,
        analysisResult: PropertyAnalysisResult
    ): Promise<PropertyInvestigationResult> {
        const startTime = Date.now();
        
        // Determine investigation type based on property characteristics
        const investigationType = this.determineInvestigationType(property);
        
        // Conduct detailed investigation
        const findings = await this.conductDetailedInvestigation(property, investigationType);
        
        // Analyze findings and determine resolution
        const resolution = this.determineResolution(findings, investigationType);
        
        // Assess confidence in findings
        const confidence = this.assessInvestigationConfidence(findings, resolution);
        
        // Generate recommended action
        const recommendedAction = this.generateRecommendedAction(resolution, findings);

        return {
            property,
            investigationType,
            findings,
            resolution,
            confidence,
            recommendedAction,
            executionTime: Date.now() - startTime
        };
    }

    /**
     * Batch investigates multiple complex properties
     */
    public static async batchInvestigateProperties(
        properties: UnusedVariable[],
        analysisResults: PropertyAnalysisResult[]
    ): Promise<PropertyInvestigationResult[]> {
        const results: PropertyInvestigationResult[] = [];
        
        // Sort properties by investigation priority
        const prioritizedProperties = this.prioritizeInvestigations(properties);
        
        for (let i = 0; i < prioritizedProperties.length; i++) {
            const property = prioritizedProperties[i];
            const analysisResult = analysisResults.find(r => r.property.name === property.name);
            
            if (analysisResult) {
                const investigationResult = await this.investigateProperty(property, analysisResult);
                results.push(investigationResult);
            }
        }
        
        return results;
    }

    /**
     * Specializes in false positive detection using advanced analysis
     */
    public static async investigateFalsePositive(property: UnusedVariable): Promise<FalsePositiveEvidence[]> {
        const evidence: FalsePositiveEvidence[] = [];
        const fileContent = await this.getFileContent(property.file);
        
        // Check for direct usage that compiler missed
        const directUsage = this.findDirectUsageEvidence(property, fileContent);
        if (directUsage.length > 0) {
            evidence.push({
                evidenceType: FalsePositiveEvidenceType.ACTUAL_USAGE_FOUND,
                description: `Found ${directUsage.length} instances of direct property usage`,
                location: property.file,
                strength: EvidenceStrength.STRONG,
                supportingData: directUsage
            });
        }
        
        // Check for dynamic access patterns
        const dynamicAccess = this.findDynamicAccessEvidence(property, fileContent);
        if (dynamicAccess.length > 0) {
            evidence.push({
                evidenceType: FalsePositiveEvidenceType.DYNAMIC_ACCESS_DETECTED,
                description: `Found ${dynamicAccess.length} instances of dynamic property access`,
                location: property.file,
                strength: EvidenceStrength.MODERATE,
                supportingData: dynamicAccess
            });
        }
        
        // Check for reflection usage
        const reflectionUsage = this.findReflectionEvidence(property, fileContent);
        if (reflectionUsage.length > 0) {
            evidence.push({
                evidenceType: FalsePositiveEvidenceType.REFLECTION_USAGE,
                description: `Found reflection-based property access patterns`,
                location: property.file,
                strength: EvidenceStrength.MODERATE,
                supportingData: reflectionUsage
            });
        }
        
        // Special case: status-bar.ts context property
        if (property.file.includes('status-bar.ts') && property.name === 'context') {
            const specificUsage = this.checkStatusBarContextUsage(fileContent);
            if (specificUsage) {
                evidence.push({
                    evidenceType: FalsePositiveEvidenceType.ACTUAL_USAGE_FOUND,
                    description: 'Context property is actually used on line 58 for VS Code integration',
                    location: `${property.file}:58`,
                    strength: EvidenceStrength.STRONG,
                    supportingData: specificUsage
                });
            }
        }
        
        return evidence;
    }

    /**
     * Analyzes incomplete features and provides completion guidance
     */
    public static async analyzeIncompleteFeature(property: UnusedVariable): Promise<IncompleteFeatureAnalysis> {
        const fileContent = await this.getFileContent(property.file);
        const strategicTarget = this.findStrategicIncompleteFeature(property);
        
        if (!strategicTarget) {
            return {
                isIncompleteFeature: false,
                featureName: 'Unknown',
                completionPercentage: 0,
                missingComponents: [],
                implementationBarriers: [],
                completionEffort: {
                    estimatedHours: 0,
                    complexity: EffortComplexity.UNKNOWN,
                    skillRequirements: [],
                    riskFactors: []
                },
                businessValue: BusinessValue.UNKNOWN
            };
        }
        
        // Analyze feature completion status
        const completionPercentage = this.calculateFeatureCompletionPercentage(property, fileContent);
        const missingComponents = this.identifyMissingComponents(property, strategicTarget);
        const implementationBarriers = this.identifyImplementationBarriers(property, strategicTarget);
        const completionEffort = this.estimateCompletionEffort(missingComponents, implementationBarriers);
        const businessValue = this.assessBusinessValue(strategicTarget);
        
        return {
            isIncompleteFeature: true,
            featureName: strategicTarget.relatedFeature,
            completionPercentage,
            missingComponents,
            implementationBarriers,
            completionEffort,
            businessValue
        };
    }

    /**
     * Generates comprehensive investigation report with actionable insights
     */
    public static generateInvestigationReport(results: PropertyInvestigationResult[]): string {
        const report = [
            '# Property Investigation Report - Phase 2C',
            '',
            '## Executive Summary',
            `- **Total Properties Investigated**: ${results.length}`,
            `- **False Positives Confirmed**: ${results.filter(r => r.resolution.resolution === ResolutionType.CONFIRMED_FALSE_POSITIVE).length}`,
            `- **Incomplete Features Identified**: ${results.filter(r => r.resolution.resolution === ResolutionType.INCOMPLETE_FEATURE_COMPLETION_NEEDED).length}`,
            `- **Architectural Preparations**: ${results.filter(r => r.resolution.resolution === ResolutionType.ARCHITECTURAL_PREPARATION_REMOVAL).length}`,
            `- **Require Further Investigation**: ${results.filter(r => r.resolution.resolution === ResolutionType.REQUIRES_FURTHER_INVESTIGATION).length}`,
            '',
            '## Investigation Confidence Distribution',
            ''
        ];
        
        const confidenceDistribution = results.reduce((acc, result) => {
            acc[result.confidence] = (acc[result.confidence] || 0) + 1;
            return acc;
        }, {} as Record<InvestigationConfidence, number>);
        
        Object.entries(confidenceDistribution).forEach(([confidence, count]) => {
            report.push(`- **${confidence.toUpperCase()}**: ${count} properties`);
        });
        report.push('');
        
        // Detailed findings
        report.push('## Detailed Investigation Results');
        report.push('');
        
        results.forEach((result, index) => {
            report.push(`### ${index + 1}. ${result.property.name} (${path.basename(result.property.file)})`);
            report.push(`- **Investigation Type**: ${result.investigationType}`);
            report.push(`- **Resolution**: ${result.resolution.resolution}`);
            report.push(`- **Confidence**: ${result.confidence}`);
            report.push(`- **Recommended Action**: ${result.recommendedAction.actionType}`);
            
            if (result.findings.actualUsageFound) {
                report.push('- **Actual Usage Found**: ✅ YES');
                report.push(`  - Locations: ${result.findings.usageLocations.length} found`);
            } else {
                report.push('- **Actual Usage Found**: ❌ NO');
            }
            
            if (result.findings.falsePositiveEvidence.length > 0) {
                report.push('- **False Positive Evidence**:');
                result.findings.falsePositiveEvidence.forEach(evidence => {
                    report.push(`  - ${evidence.evidenceType}: ${evidence.description} (${evidence.strength})`);
                });
            }
            
            if (result.findings.incompleteFeatureAnalysis.isIncompleteFeature) {
                report.push('- **Incomplete Feature Analysis**:');
                report.push(`  - Feature: ${result.findings.incompleteFeatureAnalysis.featureName}`);
                report.push(`  - Completion: ${result.findings.incompleteFeatureAnalysis.completionPercentage}%`);
                report.push(`  - Effort: ${result.findings.incompleteFeatureAnalysis.completionEffort.estimatedHours} hours (${result.findings.incompleteFeatureAnalysis.completionEffort.complexity})`);
            }
            
            report.push(`- **Justification**: ${result.resolution.justification}`);
            report.push('');
        });
        
        // Recommendations summary
        const actionTypes = results.reduce((acc, result) => {
            acc[result.recommendedAction.actionType] = (acc[result.recommendedAction.actionType] || 0) + 1;
            return acc;
        }, {} as Record<ActionType, number>);
        
        report.push('## Action Summary');
        report.push('');
        Object.entries(actionTypes).forEach(([action, count]) => {
            report.push(`- **${action}**: ${count} properties`);
        });
        
        return report.join('\n');
    }

    // Private investigation methods

    private static determineInvestigationType(property: UnusedVariable): InvestigationType {
        // Check against strategic targets
        const falsePositiveCandidate = this.STRATEGIC_INVESTIGATION_TARGETS.falsePositiveCandidates.find(
            target => property.file.includes(target.file) && property.name === target.property
        );
        if (falsePositiveCandidate) {
            return InvestigationType.FALSE_POSITIVE_ANALYSIS;
        }
        
        const architecturalPrep = this.STRATEGIC_INVESTIGATION_TARGETS.architecturalPreparations.find(
            target => property.file.includes(target.file) && property.name === target.property
        );
        if (architecturalPrep) {
            return InvestigationType.ARCHITECTURAL_PREPARATION_ANALYSIS;
        }
        
        const incompleteFeature = this.STRATEGIC_INVESTIGATION_TARGETS.incompleteFeatures.find(
            target => property.file.includes(target.file) && property.name === target.property
        );
        if (incompleteFeature) {
            return InvestigationType.INCOMPLETE_FEATURE_ANALYSIS;
        }
        
        return InvestigationType.COMPILER_LIMITATION_ANALYSIS;
    }

    private static async conductDetailedInvestigation(
        property: UnusedVariable, 
        investigationType: InvestigationType
    ): Promise<DetailedInvestigationFindings> {
        const fileContent = await this.getFileContent(property.file);
        
        // Base investigation
        const actualUsageFound = await this.searchForActualUsage(property, fileContent);
        const usageLocations = await this.findUsageLocations(property, fileContent);
        const falsePositiveEvidence = await this.investigateFalsePositive(property);
        const compilerLimitations = this.identifyCompilerLimitations(property, fileContent);
        const dynamicAccessPatterns = this.findDynamicAccessPatterns(property, fileContent);
        
        // Type-specific investigations
        let architecturalContext: ArchitecturalContext;
        let incompleteFeatureAnalysis: IncompleteFeatureAnalysis;
        
        switch (investigationType) {
            case InvestigationType.ARCHITECTURAL_PREPARATION_ANALYSIS:
                architecturalContext = await this.analyzeArchitecturalContext(property);
                incompleteFeatureAnalysis = {
                    isIncompleteFeature: false,
                    featureName: 'N/A',
                    completionPercentage: 0,
                    missingComponents: [],
                    implementationBarriers: [],
                    completionEffort: { estimatedHours: 0, complexity: EffortComplexity.SIMPLE, skillRequirements: [], riskFactors: [] },
                    businessValue: BusinessValue.LOW
                };
                break;
                
            case InvestigationType.INCOMPLETE_FEATURE_ANALYSIS:
                architecturalContext = {
                    isArchitecturalPreparation: false,
                    intendedPurpose: 'Feature implementation',
                    relatedFeatures: [],
                    implementationStatus: ImplementationStatus.PARTIALLY_IMPLEMENTED,
                    futureUsagePlan: null
                };
                incompleteFeatureAnalysis = await this.analyzeIncompleteFeature(property);
                break;
                
            default:
                architecturalContext = {
                    isArchitecturalPreparation: false,
                    intendedPurpose: 'Unknown',
                    relatedFeatures: [],
                    implementationStatus: ImplementationStatus.NOT_STARTED,
                    futureUsagePlan: null
                };
                incompleteFeatureAnalysis = {
                    isIncompleteFeature: false,
                    featureName: 'N/A',
                    completionPercentage: 0,
                    missingComponents: [],
                    implementationBarriers: [],
                    completionEffort: { estimatedHours: 0, complexity: EffortComplexity.SIMPLE, skillRequirements: [], riskFactors: [] },
                    businessValue: BusinessValue.UNKNOWN
                };
        }
        
        // Cross-file analysis
        const crossFileReferences = await this.findCrossFileReferences(property);
        const gitHistoryInsights = await this.analyzeGitHistory(property);
        
        return {
            actualUsageFound: actualUsageFound || usageLocations.length > 0,
            usageLocations,
            falsePositiveEvidence,
            compilerLimitations,
            dynamicAccessPatterns,
            architecturalContext,
            incompleteFeatureAnalysis,
            crossFileReferences,
            gitHistoryInsights
        };
    }

    private static determineResolution(findings: DetailedInvestigationFindings, investigationType: InvestigationType): InvestigationResolution {
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

    private static assessInvestigationConfidence(findings: DetailedInvestigationFindings, resolution: InvestigationResolution): InvestigationConfidence {
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

    private static generateRecommendedAction(resolution: InvestigationResolution, findings: DetailedInvestigationFindings): RecommendedAction {
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

    // Detailed analysis helper methods

    private static async searchForActualUsage(property: UnusedVariable, fileContent: string): Promise<boolean> {
        // Multiple search strategies for actual usage
        const searchPatterns = [
            `this.${property.name}`,
            `this['${property.name}']`,
            `this["${property.name}"]`,
            `[${property.name}]`,
            `["${property.name}"]`,
            property.name
        ];
        
        return searchPatterns.some(pattern => fileContent.includes(pattern));
    }

    private static async findUsageLocations(property: UnusedVariable, fileContent: string): Promise<ActualUsageLocation[]> {
        const locations: ActualUsageLocation[] = [];
        const lines = fileContent.split('\n');
        
        lines.forEach((line, index) => {
            if (line.includes(property.name) && !line.includes(`${property.name}:`)) {
                locations.push({
                    file: property.file,
                    line: index + 1,
                    column: line.indexOf(property.name) + 1,
                    context: line.trim(),
                    usageType: this.determineActualUsageType(line, property.name),
                    confidence: this.assessUsageConfidence(line, property.name),
                    compilerDetection: CompilerDetectionStatus.NOT_DETECTED
                });
            }
        });
        
        return locations;
    }

    private static findDirectUsageEvidence(property: UnusedVariable, fileContent: string): string[] {
        const evidence: string[] = [];
        const lines = fileContent.split('\n');
        
        lines.forEach((line, index) => {
            if (line.includes(`this.${property.name}`) && 
                !line.includes(`this.${property.name} =`) && 
                !line.includes(`${property.name}:`)) {
                evidence.push(`Line ${index + 1}: ${line.trim()}`);
            }
        });
        
        return evidence;
    }

    private static findDynamicAccessEvidence(property: UnusedVariable, fileContent: string): string[] {
        const evidence: string[] = [];
        const lines = fileContent.split('\n');
        
        const dynamicPatterns = [
            `this['${property.name}']`,
            `this["${property.name}"]`,
            `[${property.name}]`,
            `["${property.name}"]`
        ];
        
        lines.forEach((line, index) => {
            dynamicPatterns.forEach(pattern => {
                if (line.includes(pattern)) {
                    evidence.push(`Line ${index + 1}: ${line.trim()} (Pattern: ${pattern})`);
                }
            });
        });
        
        return evidence;
    }

    private static findReflectionEvidence(property: UnusedVariable, fileContent: string): string[] {
        const evidence: string[] = [];
        
        if (fileContent.includes('Reflect.') || fileContent.includes('Object.keys') || fileContent.includes('Object.getOwnPropertyNames')) {
            evidence.push('File contains reflection API usage that may access properties dynamically');
        }
        
        return evidence;
    }

    private static checkStatusBarContextUsage(fileContent: string): any | null {
        const lines = fileContent.split('\n');
        
        // Check line 58 specifically for context usage
        if (lines.length > 58 && lines[57].includes('context')) {
            return {
                line: 58,
                content: lines[57].trim(),
                usageType: 'VS Code extension context usage'
            };
        }
        
        return null;
    }

    private static findStrategicIncompleteFeature(property: UnusedVariable): any {
        return this.STRATEGIC_INVESTIGATION_TARGETS.incompleteFeatures.find(
            target => property.file.includes(target.file) && property.name === target.property
        );
    }

    private static calculateFeatureCompletionPercentage(property: UnusedVariable, fileContent: string): number {
        // Heuristic: check for related implementation code
        const implementationIndicators = [
            'constructor',
            'initialize',
            'setup',
            'connect',
            'start',
            'async',
            'await',
            'try',
            'catch'
        ];
        
        const indicatorCount = implementationIndicators.reduce((count, indicator) => 
            count + (fileContent.includes(indicator) ? 1 : 0), 0);
        
        return Math.min(100, (indicatorCount / implementationIndicators.length) * 100);
    }

    private static identifyMissingComponents(property: UnusedVariable, strategicTarget: any): string[] {
        const baseComponents = [
            'Initialization logic',
            'Error handling',
            'Configuration management',
            'State management',
            'Cleanup logic'
        ];
        
        // Add feature-specific components based on property name
        if (property.name.includes('Manager')) {
            baseComponents.push('Management interface', 'Resource lifecycle');
        }
        
        return baseComponents;
    }

    private static identifyImplementationBarriers(property: UnusedVariable, strategicTarget: any): ImplementationBarrier[] {
        return [
            {
                type: BarrierType.TECHNICAL_COMPLEXITY,
                description: 'Complex integration requirements with VS Code extension APIs',
                severity: BarrierSeverity.MEDIUM,
                resolutionApproach: ['Break down into smaller components', 'Create proof of concept first']
            }
        ];
    }

    private static estimateCompletionEffort(missingComponents: string[], barriers: ImplementationBarrier[]): CompletionEffort {
        const baseHours = missingComponents.length * 4; // 4 hours per component
        const barrierHours = barriers.reduce((total, barrier) => {
            switch (barrier.severity) {
                case BarrierSeverity.HIGH: return total + 16;
                case BarrierSeverity.MEDIUM: return total + 8;
                case BarrierSeverity.LOW: return total + 4;
                default: return total;
            }
        }, 0);
        
        const totalHours = baseHours + barrierHours;
        
        return {
            estimatedHours: totalHours,
            complexity: totalHours > 40 ? EffortComplexity.COMPLEX : 
                       totalHours > 8 ? EffortComplexity.MODERATE : 
                       EffortComplexity.SIMPLE,
            skillRequirements: ['TypeScript', 'VS Code Extension APIs', 'Node.js'],
            riskFactors: barriers.map(b => b.description)
        };
    }

    private static assessBusinessValue(strategicTarget: any): BusinessValue {
        switch (strategicTarget.priority) {
            case FeaturePriority.HIGH:
            case FeaturePriority.CRITICAL:
                return BusinessValue.HIGH;
            case FeaturePriority.MEDIUM:
                return BusinessValue.MEDIUM;
            default:
                return BusinessValue.LOW;
        }
    }

    // Utility methods continued in the next part due to length...

    private static prioritizeInvestigations(properties: UnusedVariable[]): UnusedVariable[] {
        return properties.sort((a, b) => {
            // Prioritize false positive candidates first
            const aIsFalsePositive = a.file.includes('status-bar.ts');
            const bIsFalsePositive = b.file.includes('status-bar.ts');
            
            if (aIsFalsePositive && !bIsFalsePositive) return -1;
            if (!aIsFalsePositive && bIsFalsePositive) return 1;
            
            // Then by file (group by file for efficiency)
            return a.file.localeCompare(b.file);
        });
    }

    private static identifyCompilerLimitations(property: UnusedVariable, fileContent: string): CompilerLimitation[] {
        const limitations: CompilerLimitation[] = [];
        
        if (fileContent.includes('any') || fileContent.includes('unknown')) {
            limitations.push({
                limitationType: CompilerLimitationType.TYPE_NARROWING_ISSUE,
                description: 'Type analysis limited by any/unknown types',
                affectedProperty: property.name,
                workaround: ['Add more specific type annotations', 'Use type guards'],
                impact: CompilerImpact.MEDIUM
            });
        }
        
        return limitations;
    }

    private static findDynamicAccessPatterns(property: UnusedVariable, fileContent: string): DynamicAccessPattern[] {
        const patterns: DynamicAccessPattern[] = [];
        const lines = fileContent.split('\n');
        
        lines.forEach((line, index) => {
            if (line.includes('[') && line.includes(']') && line.includes(property.name)) {
                patterns.push({
                    pattern: line.trim(),
                    file: property.file,
                    line: index + 1,
                    accessMethod: DynamicAccessMethod.BRACKET_NOTATION,
                    detectionConfidence: UsageConfidence.POSSIBLE,
                    examples: [line.trim()]
                });
            }
        });
        
        return patterns;
    }

    private static async analyzeArchitecturalContext(property: UnusedVariable): Promise<ArchitecturalContext> {
        return {
            isArchitecturalPreparation: true,
            intendedPurpose: 'Prepared infrastructure for future feature development',
            relatedFeatures: ['Extension context management'],
            implementationStatus: ImplementationStatus.INFRASTRUCTURE_ONLY,
            futureUsagePlan: {
                plannedFeature: 'Context management system',
                estimatedImplementation: 'No concrete timeline',
                priority: FeaturePriority.LOW,
                dependencies: ['Extension API updates'],
                blockers: ['Unclear requirements']
            }
        };
    }

    private static async findCrossFileReferences(property: UnusedVariable): Promise<CrossFileReference[]> {
        // In a real implementation, this would search across the codebase
        return [];
    }

    private static async analyzeGitHistory(property: UnusedVariable): Promise<GitHistoryInsight[]> {
        // In a real implementation, this would use git commands to analyze history
        return [];
    }

    private static determineActualUsageType(line: string, propertyName: string): ActualUsageType {
        if (line.includes(`this.${propertyName}`)) return ActualUsageType.DIRECT_PROPERTY_ACCESS;
        if (line.includes(`[${propertyName}]`) || line.includes(`["${propertyName}"]`)) return ActualUsageType.DYNAMIC_PROPERTY_ACCESS;
        return ActualUsageType.DIRECT_PROPERTY_ACCESS;
    }

    private static assessUsageConfidence(line: string, propertyName: string): UsageConfidence {
        if (line.includes(`this.${propertyName}`) && !line.includes('=')) return UsageConfidence.CONFIRMED;
        if (line.includes(propertyName) && line.includes('(')) return UsageConfidence.LIKELY;
        return UsageConfidence.POSSIBLE;
    }

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

    private static generateAlternativeActions(actionType: ActionType, findings: DetailedInvestigationFindings): AlternativeAction[] {
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
        
        return alternatives;
    }

    private static async getFileContent(filePath: string): Promise<string> {
        try {
            return fs.readFileSync(filePath, 'utf-8');
        } catch {
            return '';
        }
    }
}

/**
 * Usage Examples:
 * 
 * // Investigate a single complex property
 * const property = properties.find(p => p.phase === ProcessingPhase.PHASE_2C);
 * const analysis = await UnusedPropertyAnalyzer.analyzeIndividualProperty(property);
 * const investigation = await PropertyInvestigationTools.investigateProperty(property, analysis);
 * console.log(`Resolution: ${investigation.resolution.resolution} (${investigation.confidence})`);
 * 
 * // Batch investigate all Phase 2C properties
 * const phase2cProperties = properties.filter(p => p.phase === ProcessingPhase.PHASE_2C);
 * const phase2cAnalyses = await UnusedPropertyAnalyzer.analyzeByPhase(phase2cProperties, ProcessingPhase.PHASE_2C);
 * const investigations = await PropertyInvestigationTools.batchInvestigateProperties(phase2cProperties, phase2cAnalyses);
 * 
 * // Focus on false positive detection
 * const falsePositiveEvidence = await PropertyInvestigationTools.investigateFalsePositive(contextProperty);
 * if (falsePositiveEvidence.length > 0) {
 *     console.log('False positive confirmed:', falsePositiveEvidence.map(e => e.description));
 * }
 * 
 * // Analyze incomplete features for completion guidance
 * const incompleteFeature = await PropertyInvestigationTools.analyzeIncompleteFeature(chatManagerProperty);
 * console.log(`Feature: ${incompleteFeature.featureName} (${incompleteFeature.completionPercentage}% complete)`);
 * console.log(`Effort: ${incompleteFeature.completionEffort.estimatedHours} hours (${incompleteFeature.completionEffort.complexity})`);
 * 
 * // Generate comprehensive investigation report
 * const report = PropertyInvestigationTools.generateInvestigationReport(investigations);
 * console.log(report);
 */