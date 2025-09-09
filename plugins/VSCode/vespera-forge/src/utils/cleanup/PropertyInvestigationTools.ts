/**
 * Property Investigation Tools
 * 
 * Main orchestration module for advanced investigation of complex property scenarios.
 * Provides comprehensive tools through specialized analysis modules:
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
 * Implements systematic investigation methodology through modular architecture.
 */

import * as path from 'path';
import { 
    UnusedVariable
} from './UnusedVariableClassifier';
import { PropertyAnalysisResult } from './UnusedPropertyAnalyzer';

// Import specialized analysis modules
import { 
    FalsePositiveDetector,
    FalsePositiveEvidence,
    FalsePositiveEvidenceType,
    EvidenceStrength,
    ActualUsageLocation,
    ActualUsageType,
    UsageConfidence,
    CompilerDetectionStatus,
    DynamicAccessPattern,
    DynamicAccessMethod,
    CompilerLimitation,
    CompilerLimitationType,
    CompilerImpact
} from './FalsePositiveDetector';

import {
    ConstructorUsageAnalyzer,
    ArchitecturalContext,
    ImplementationStatus,
    FutureUsagePlan,
    FeaturePriority,
    CrossFileReference,
    ReferenceType,
    GitHistoryInsight,
    GitChangeType
} from './ConstructorUsageAnalyzer';

import {
    ServiceIntegrationAnalyzer,
    InvestigationResolution,
    ResolutionType,
    InvestigationConfidence,
    RecommendedAction,
    ActionType,
    AlternativeAction
} from './ServiceIntegrationAnalyzer';

import {
    IncompleteFeatureAnalyzer,
    IncompleteFeatureAnalysis,
    ImplementationBarrier,
    BarrierType,
    BarrierSeverity,
    CompletionEffort,
    EffortComplexity,
    BusinessValue
} from './IncompleteFeatureAnalyzer';

// Re-export types from specialized modules for public API compatibility
export {
    FalsePositiveEvidence,
    FalsePositiveEvidenceType,
    EvidenceStrength,
    ActualUsageLocation,
    ActualUsageType,
    UsageConfidence,
    CompilerDetectionStatus,
    DynamicAccessPattern,
    DynamicAccessMethod,
    CompilerLimitation,
    CompilerLimitationType,
    CompilerImpact,
    ArchitecturalContext,
    ImplementationStatus,
    FutureUsagePlan,
    FeaturePriority,
    CrossFileReference,
    ReferenceType,
    GitHistoryInsight,
    GitChangeType,
    IncompleteFeatureAnalysis,
    ImplementationBarrier,
    BarrierType,
    BarrierSeverity,
    CompletionEffort,
    EffortComplexity,
    BusinessValue,
    InvestigationResolution,
    ResolutionType,
    InvestigationConfidence,
    RecommendedAction,
    ActionType,
    AlternativeAction
};

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
        _analysisResult: PropertyAnalysisResult
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
            if (!property) continue;
            
            const analysisResult = analysisResults.find(r => r?.property?.name === property.name);
            
            if (analysisResult) {
                const investigationResult = await this.investigateProperty(property, analysisResult);
                results.push(investigationResult);
            }
        }
        
        return results;
    }

    /**
     * Specializes in false positive detection using advanced analysis
     * Delegates to FalsePositiveDetector module
     */
    public static async investigateFalsePositive(property: UnusedVariable): Promise<FalsePositiveEvidence[]> {
        return FalsePositiveDetector.investigateFalsePositive(property);
    }

    /**
     * Analyzes incomplete features and provides completion guidance  
     * Delegates to IncompleteFeatureAnalyzer module
     */
    public static async analyzeIncompleteFeature(property: UnusedVariable): Promise<IncompleteFeatureAnalysis> {
        return IncompleteFeatureAnalyzer.analyzeIncompleteFeature(property);
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
        const fileContent = await FalsePositiveDetector.getFileContent(property.file);
        
        // Delegate base investigations to specialized modules
        const actualUsageFound = await FalsePositiveDetector.searchForActualUsage(property, fileContent);
        const usageLocations = await FalsePositiveDetector.findUsageLocations(property, fileContent);
        const falsePositiveEvidence = await FalsePositiveDetector.investigateFalsePositive(property);
        const compilerLimitations = FalsePositiveDetector.identifyCompilerLimitations(property, fileContent);
        const dynamicAccessPatterns = FalsePositiveDetector.findDynamicAccessPatterns(property, fileContent);
        
        // Type-specific investigations using specialized modules
        let architecturalContext: ArchitecturalContext;
        let incompleteFeatureAnalysis: IncompleteFeatureAnalysis;
        
        switch (investigationType) {
            case InvestigationType.ARCHITECTURAL_PREPARATION_ANALYSIS:
                architecturalContext = await ConstructorUsageAnalyzer.analyzeArchitecturalContext(property);
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
                incompleteFeatureAnalysis = await IncompleteFeatureAnalyzer.analyzeIncompleteFeature(property);
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
        
        // Cross-file analysis using constructor analyzer
        const crossFileReferences = await ConstructorUsageAnalyzer.findCrossFileReferences(property);
        const gitHistoryInsights = await ConstructorUsageAnalyzer.analyzeGitHistory(property);
        
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
        return ServiceIntegrationAnalyzer.determineResolution(findings, investigationType);
    }

    private static assessInvestigationConfidence(findings: DetailedInvestigationFindings, resolution: InvestigationResolution): InvestigationConfidence {
        return ServiceIntegrationAnalyzer.assessInvestigationConfidence(findings, resolution);
    }

    private static generateRecommendedAction(resolution: InvestigationResolution, findings: DetailedInvestigationFindings): RecommendedAction {
        return ServiceIntegrationAnalyzer.generateRecommendedAction(resolution, findings);
    }

    // Utility methods - delegate to specialized modules

    private static prioritizeInvestigations(properties: UnusedVariable[]): UnusedVariable[] {
        return ConstructorUsageAnalyzer.prioritizeInvestigations(properties);
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