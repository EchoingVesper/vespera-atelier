/**
 * Property Strategic Analyzer
 * 
 * Provides strategic analysis and scoring logic for unused property evaluation.
 * Focuses on integration opportunities, risk assessment, and strategic decision-making
 * based on proven patterns and architectural requirements.
 * 
 * This module handles:
 * - Integration opportunity identification
 * - Strategic scoring and benefit assessment
 * - Pattern-based recommendation generation
 * - Cross-component analysis for service integration
 * - Risk and effort estimation for implementation planning
 */

import { 
    UnusedVariable,
    RiskLevel,
    ProcessingPhase
} from './UnusedVariableClassifier';
import { 
    PropertyAnalysisPhases,
    IntegrationType,
    EffortLevel,
    BenefitLevel,
    PhasePropertyData
} from './PropertyAnalysisPhases';

export interface IntegrationOpportunity {
    type: IntegrationType;
    description: string;
    implementationSteps: string[];
    effort: EffortLevel;
    expectedBenefit: BenefitLevel;
    riskAssessment: RiskLevel;
    similarPatterns: string[];
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

export interface PropertyStrategicAssessment {
    integrationOpportunity: IntegrationOpportunity | null;
    serviceConnections: ServiceConnection[];
    integrationPoints: IntegrationPoint[];
    strategicScore: number;
    implementationPriority: 'HIGH' | 'MEDIUM' | 'LOW';
}

/**
 * Strategic analyzer for property integration opportunities and implementation planning
 */
export class PropertyStrategicAnalyzer {
    
    /**
     * Analyzes integration opportunities for service-related properties
     */
    public static identifyIntegrationOpportunity(
        property: UnusedVariable, 
        _fileContent: string
    ): IntegrationOpportunity | null {
        // Only analyze properties in Phase 2B (service integration phase)
        if (property.phase !== ProcessingPhase.PHASE_2B) {
            return null;
        }

        const strategicData = PropertyAnalysisPhases.findStrategicDataForProperty(property);
        if (!strategicData) {
            return null;
        }

        return {
            type: strategicData.integrationType!,
            description: this.generateIntegrationDescription(strategicData),
            implementationSteps: this.generateImplementationSteps(strategicData),
            effort: this.estimateIntegrationEffort(strategicData),
            expectedBenefit: this.assessExpectedBenefit(strategicData),
            riskAssessment: RiskLevel.MEDIUM, // Phase 2B is MEDIUM risk
            similarPatterns: [strategicData.similarPattern!]
        };
    }

    /**
     * Analyzes service integration opportunity with comprehensive assessment
     */
    public static analyzeServiceIntegrationOpportunity(
        property: UnusedVariable, 
        _fileContent: string
    ): IntegrationOpportunity | null {
        const strategicMatch = PropertyAnalysisPhases.findStrategicDataForProperty(property);
        if (!strategicMatch) {
            return null;
        }

        return {
            type: strategicMatch.integrationType!,
            description: `Integrate ${property.name} for ${strategicMatch.integrationType} following ${strategicMatch.similarPattern} pattern`,
            implementationSteps: this.generateImplementationSteps(strategicMatch),
            effort: EffortLevel.MEDIUM,
            expectedBenefit: BenefitLevel.MEDIUM,
            riskAssessment: RiskLevel.MEDIUM,
            similarPatterns: [strategicMatch.similarPattern!]
        };
    }

    /**
     * Performs comprehensive strategic assessment of a property
     */
    public static performStrategicAssessment(
        property: UnusedVariable,
        fileContent: string
    ): PropertyStrategicAssessment {
        const integrationOpportunity = this.identifyIntegrationOpportunity(property, fileContent);
        const serviceConnections = this.analyzeServiceConnections(property, fileContent);
        const integrationPoints = this.identifyIntegrationPoints(property, serviceConnections);
        const strategicScore = this.calculateStrategicScore(property, integrationOpportunity, serviceConnections);
        const implementationPriority = this.determineImplementationPriority(strategicScore, property.phase);

        return {
            integrationOpportunity,
            serviceConnections,
            integrationPoints,
            strategicScore,
            implementationPriority
        };
    }

    /**
     * Analyzes service connections for dependency analysis
     */
    public static analyzeServiceConnections(property: UnusedVariable, fileContent: string): ServiceConnection[] {
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

        if (property.name.includes('notificationService')) {
            serviceConnections.push({
                serviceName: 'NotificationService',
                connectionType: ConnectionType.NOTIFICATION_SERVICE,
                isActuallyUsed: fileContent.includes(`${property.name}.notify`),
                integrationOpportunity: true
            });
        }

        if (property.name.includes('securityService')) {
            serviceConnections.push({
                serviceName: 'SecurityService',
                connectionType: ConnectionType.SECURITY_SERVICE,
                isActuallyUsed: fileContent.includes(`${property.name}.audit`),
                integrationOpportunity: true
            });
        }

        return serviceConnections;
    }

    /**
     * Identifies specific integration points for implementation
     */
    public static identifyIntegrationPoints(property: UnusedVariable, serviceConnections: ServiceConnection[]): IntegrationPoint[] {
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

    /**
     * Calculates strategic score for prioritization (0-100)
     */
    public static calculateStrategicScore(
        property: UnusedVariable,
        integrationOpportunity: IntegrationOpportunity | null,
        serviceConnections: ServiceConnection[]
    ): number {
        let score = 0;

        // Base score by phase
        switch (property.phase) {
            case ProcessingPhase.PHASE_2A:
                score += 20; // Lower priority, but easy wins
                break;
            case ProcessingPhase.PHASE_2B:
                score += 60; // High priority for service integration
                break;
            case ProcessingPhase.PHASE_2C:
                score += 30; // Medium priority, requires investigation
                break;
        }

        // Bonus for clear integration opportunities
        if (integrationOpportunity) {
            score += 25;
            
            // Additional bonus based on benefit level
            switch (integrationOpportunity.expectedBenefit) {
                case BenefitLevel.HIGH:
                    score += 15;
                    break;
                case BenefitLevel.MEDIUM:
                    score += 10;
                    break;
                case BenefitLevel.LOW:
                    score += 5;
                    break;
            }
        }

        // Bonus for active service connections
        const activeConnections = serviceConnections.filter(conn => conn.integrationOpportunity);
        score += activeConnections.length * 5;

        // Penalty for high effort requirements
        if (integrationOpportunity?.effort === EffortLevel.HIGH) {
            score -= 10;
        }

        return Math.min(100, Math.max(0, score));
    }

    /**
     * Determines implementation priority based on strategic score and phase
     */
    public static determineImplementationPriority(score: number, phase: ProcessingPhase): 'HIGH' | 'MEDIUM' | 'LOW' {
        // Phase 2B gets priority boost for service integration
        if (phase === ProcessingPhase.PHASE_2B) {
            return score >= 70 ? 'HIGH' : 'MEDIUM';
        }

        // Phase 2A is generally low priority but high confidence
        if (phase === ProcessingPhase.PHASE_2A) {
            return score >= 80 ? 'MEDIUM' : 'LOW';
        }

        // Phase 2C depends heavily on investigation findings
        if (phase === ProcessingPhase.PHASE_2C) {
            return score >= 75 ? 'MEDIUM' : 'LOW';
        }

        return 'LOW';
    }

    /**
     * Generates comprehensive integration opportunity assessment
     */
    public static assessIntegrationOpportunities(properties: UnusedVariable[]): {
        highPriority: IntegrationOpportunity[];
        mediumPriority: IntegrationOpportunity[];
        lowPriority: IntegrationOpportunity[];
        totalOpportunities: number;
        estimatedTotalEffort: number; // in hours
    } {
        const opportunities = properties
            .map(property => this.identifyIntegrationOpportunity(property, ''))
            .filter(opp => opp !== null) as IntegrationOpportunity[];

        const highPriority = opportunities.filter(opp => 
            opp.expectedBenefit === BenefitLevel.HIGH || 
            opp.type === IntegrationType.SECURITY_AUDIT_LOGGING
        );

        const mediumPriority = opportunities.filter(opp => 
            opp.expectedBenefit === BenefitLevel.MEDIUM && 
            !highPriority.includes(opp)
        );

        const lowPriority = opportunities.filter(opp => 
            !highPriority.includes(opp) && !mediumPriority.includes(opp)
        );

        const estimatedTotalEffort = opportunities.reduce((total, opp) => {
            switch (opp.effort) {
                case EffortLevel.LOW: return total + 1.5; // 1.5 hours
                case EffortLevel.MEDIUM: return total + 5; // 5 hours
                case EffortLevel.HIGH: return total + 10; // 10 hours
                default: return total;
            }
        }, 0);

        return {
            highPriority,
            mediumPriority,
            lowPriority,
            totalOpportunities: opportunities.length,
            estimatedTotalEffort
        };
    }

    // Private helper methods for strategic analysis

    private static generateIntegrationDescription(strategicData: PhasePropertyData): string {
        return `Implement ${strategicData.integrationType?.replace('_', ' ')} using the proven pattern from ${strategicData.similarPattern}`;
    }

    private static generateImplementationSteps(strategicData: PhasePropertyData): string[] {
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
            case IntegrationType.PERFORMANCE_MONITORING:
                return [
                    'Add performance monitoring calls using coreServices.performanceMonitor',
                    'Track key operations and response times',
                    'Follow established monitoring patterns'
                ];
            default:
                return ['Analyze similar patterns and implement integration'];
        }
    }

    private static estimateIntegrationEffort(strategicData: PhasePropertyData): EffortLevel {
        // Security audit logging typically requires more careful implementation
        if (strategicData.integrationType === IntegrationType.SECURITY_AUDIT_LOGGING) {
            return EffortLevel.HIGH;
        }
        
        // Error handling and input sanitization are generally medium effort
        if (strategicData.integrationType === IntegrationType.ERROR_HANDLING ||
            strategicData.integrationType === IntegrationType.INPUT_SANITIZATION) {
            return EffortLevel.MEDIUM;
        }
        
        // Performance monitoring can vary, default to medium
        return EffortLevel.MEDIUM;
    }

    private static assessExpectedBenefit(strategicData: PhasePropertyData): BenefitLevel {
        switch (strategicData.integrationType) {
            case IntegrationType.SECURITY_AUDIT_LOGGING:
                return BenefitLevel.HIGH;
            case IntegrationType.ERROR_HANDLING:
                return BenefitLevel.MEDIUM;
            case IntegrationType.INPUT_SANITIZATION:
                return BenefitLevel.MEDIUM;
            case IntegrationType.PERFORMANCE_MONITORING:
                return BenefitLevel.LOW;
            default:
                return BenefitLevel.MEDIUM;
        }
    }
}