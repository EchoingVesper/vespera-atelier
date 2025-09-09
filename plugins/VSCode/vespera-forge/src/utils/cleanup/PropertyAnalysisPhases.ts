/**
 * Property Analysis Phases
 * 
 * Manages the strategic phased approach for property analysis and categorization.
 * Implements the three-phase strategic analysis from Phase 2 planning:
 * - Phase 2A: Constructor refactoring (2 properties, LOW risk)
 * - Phase 2B: Service integration enhancement (7 properties, MEDIUM risk)  
 * - Phase 2C: System investigation and resolution (5 properties, HIGH complexity)
 * 
 * This module centralizes all phase-specific data and provides categorization
 * logic to maintain the sophisticated phased analysis approach.
 */

import { 
    UnusedVariable, 
    ProcessingPhase
} from './UnusedVariableClassifier';

export enum PropertyUsagePattern {
    CONSTRUCTOR_ONLY = 'constructor_only',      // Phase 2A: Safe removal
    STORED_NEVER_ACCESSED = 'stored_never_accessed', // Phase 2A: Safe removal
    SERVICE_INTEGRATION_GAP = 'service_integration_gap', // Phase 2B: Integration needed
    ERROR_HANDLER_GAP = 'error_handler_gap',    // Phase 2B: Integration needed
    FALSE_POSITIVE = 'false_positive',          // Phase 2C: Investigation needed
    INCOMPLETE_FEATURE = 'incomplete_feature',  // Phase 2C: Investigation needed
    ARCHITECTURAL_PREP = 'architectural_prep'   // Phase 2C: Investigation needed
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

export enum ConfidenceLevel {
    LOW = 'low',       // 0-60% confidence
    MEDIUM = 'medium', // 61-85% confidence  
    HIGH = 'high'      // 86-100% confidence
}

export interface PhasePropertyData {
    file: string;
    property: string;
    line: number;
    expectedPattern?: PropertyUsagePattern;
    confidence?: ConfidenceLevel;
    integrationType?: IntegrationType;
    similarPattern?: string;
    investigationType?: string;
    actualUsage?: string;
}

/**
 * Strategic property data organized by processing phase.
 * This data drives the phased analysis approach and ensures
 * consistent categorization across the analysis pipeline.
 */
export class PropertyAnalysisPhases {
    /**
     * Strategic property data from Phase 2 analysis.
     * Contains comprehensive mapping of all 14 unused properties
     * with their expected patterns and integration opportunities.
     */
    public static readonly STRATEGIC_PROPERTY_DATA = {
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
        ] as PhasePropertyData[],
        
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
        ] as PhasePropertyData[],
        
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
        ] as PhasePropertyData[]
    };

    /**
     * Gets all strategic property data as a flat array
     */
    public static getAllStrategicProperties(): PhasePropertyData[] {
        return [
            ...this.STRATEGIC_PROPERTY_DATA.constructorOnlyProperties,
            ...this.STRATEGIC_PROPERTY_DATA.serviceIntegrationGaps,
            ...this.STRATEGIC_PROPERTY_DATA.systemContextProperties
        ];
    }

    /**
     * Gets strategic property data for a specific processing phase
     */
    public static getPropertiesForPhase(phase: ProcessingPhase): PhasePropertyData[] {
        switch (phase) {
            case ProcessingPhase.PHASE_2A:
                return this.STRATEGIC_PROPERTY_DATA.constructorOnlyProperties;
            case ProcessingPhase.PHASE_2B:
                return this.STRATEGIC_PROPERTY_DATA.serviceIntegrationGaps;
            case ProcessingPhase.PHASE_2C:
                return this.STRATEGIC_PROPERTY_DATA.systemContextProperties;
            default:
                return [];
        }
    }

    /**
     * Finds strategic data for a specific property
     */
    public static findStrategicDataForProperty(property: UnusedVariable): PhasePropertyData | null {
        const allProperties = this.getAllStrategicProperties();
        
        return allProperties.find(data => 
            property.file.includes(data.file) && property.name === data.property
        ) ?? null;
    }

    /**
     * Determines the expected usage pattern based on phase and strategic data
     */
    public static determineExpectedUsagePattern(property: UnusedVariable): PropertyUsagePattern {
        const strategicData = this.findStrategicDataForProperty(property);
        
        if (strategicData?.expectedPattern) {
            return strategicData.expectedPattern;
        }

        // Default patterns based on phase
        switch (property.phase) {
            case ProcessingPhase.PHASE_2A:
                return PropertyUsagePattern.CONSTRUCTOR_ONLY;
            case ProcessingPhase.PHASE_2B:
                return property.name.includes('coreServices') 
                    ? PropertyUsagePattern.SERVICE_INTEGRATION_GAP
                    : PropertyUsagePattern.ERROR_HANDLER_GAP;
            case ProcessingPhase.PHASE_2C:
                return PropertyUsagePattern.INCOMPLETE_FEATURE;
            default:
                return PropertyUsagePattern.INCOMPLETE_FEATURE;
        }
    }

    /**
     * Gets integration type for Phase 2B properties
     */
    public static getIntegrationType(property: UnusedVariable): IntegrationType | null {
        const strategicData = this.findStrategicDataForProperty(property);
        return strategicData?.integrationType ?? null;
    }

    /**
     * Gets similar pattern for integration reference
     */
    public static getSimilarPattern(property: UnusedVariable): string | null {
        const strategicData = this.findStrategicDataForProperty(property);
        return strategicData?.similarPattern ?? null;
    }

    /**
     * Gets investigation type for Phase 2C properties
     */
    public static getInvestigationType(property: UnusedVariable): string | null {
        const strategicData = this.findStrategicDataForProperty(property);
        return strategicData?.investigationType ?? null;
    }

    /**
     * Gets expected confidence level for the property analysis
     */
    public static getExpectedConfidence(property: UnusedVariable): ConfidenceLevel {
        const strategicData = this.findStrategicDataForProperty(property);
        
        if (strategicData?.confidence) {
            return strategicData.confidence;
        }

        // Default confidence based on phase
        switch (property.phase) {
            case ProcessingPhase.PHASE_2A:
                return ConfidenceLevel.HIGH;
            case ProcessingPhase.PHASE_2B:
                return ConfidenceLevel.MEDIUM;
            case ProcessingPhase.PHASE_2C:
                return ConfidenceLevel.LOW;
            default:
                return ConfidenceLevel.LOW;
        }
    }

    /**
     * Validates if a property matches its expected phase categorization
     */
    public static validatePropertyPhaseMapping(property: UnusedVariable): boolean {
        const strategicData = this.findStrategicDataForProperty(property);
        return strategicData !== null;
    }

    /**
     * Gets phase statistics for reporting
     */
    public static getPhaseStatistics(): Partial<Record<ProcessingPhase, number>> {
        return {
            [ProcessingPhase.PHASE_2A]: this.STRATEGIC_PROPERTY_DATA.constructorOnlyProperties.length,
            [ProcessingPhase.PHASE_2B]: this.STRATEGIC_PROPERTY_DATA.serviceIntegrationGaps.length,
            [ProcessingPhase.PHASE_2C]: this.STRATEGIC_PROPERTY_DATA.systemContextProperties.length
        };
    }

    /**
     * Gets comprehensive phase summary for analysis reporting
     */
    public static getPhaseSummary(): {
        phase: ProcessingPhase;
        description: string;
        properties: number;
        risk: string;
        expectedPatterns: PropertyUsagePattern[];
    }[] {
        return [
            {
                phase: ProcessingPhase.PHASE_2A,
                description: 'Constructor refactoring opportunities',
                properties: this.STRATEGIC_PROPERTY_DATA.constructorOnlyProperties.length,
                risk: 'LOW',
                expectedPatterns: [PropertyUsagePattern.CONSTRUCTOR_ONLY, PropertyUsagePattern.STORED_NEVER_ACCESSED]
            },
            {
                phase: ProcessingPhase.PHASE_2B,
                description: 'Service integration enhancement',
                properties: this.STRATEGIC_PROPERTY_DATA.serviceIntegrationGaps.length,
                risk: 'MEDIUM',
                expectedPatterns: [PropertyUsagePattern.SERVICE_INTEGRATION_GAP, PropertyUsagePattern.ERROR_HANDLER_GAP]
            },
            {
                phase: ProcessingPhase.PHASE_2C,
                description: 'System investigation and resolution',
                properties: this.STRATEGIC_PROPERTY_DATA.systemContextProperties.length,
                risk: 'HIGH',
                expectedPatterns: [PropertyUsagePattern.FALSE_POSITIVE, PropertyUsagePattern.INCOMPLETE_FEATURE, PropertyUsagePattern.ARCHITECTURAL_PREP]
            }
        ];
    }
}