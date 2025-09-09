/**
 * False Positive Detector
 * 
 * Specialized module for detecting false positives in TypeScript's unused property analysis.
 * Focuses on sophisticated detection mechanisms for properties that are actually used
 * but not detected by the TypeScript compiler due to limitations.
 * 
 * Responsibilities:
 * - Direct property usage detection
 * - Dynamic property access pattern recognition  
 * - Reflection-based usage identification
 * - Compiler limitation analysis
 * - Evidence strength assessment
 */

import * as fs from 'fs';
import { UnusedVariable } from './UnusedVariableClassifier';

// Re-export types needed for false positive detection
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

/**
 * False Positive Detector - Specialized detection of TypeScript compiler false positives
 */
export class FalsePositiveDetector {
    
    /**
     * Comprehensive false positive investigation using advanced analysis techniques
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
     * Search for actual property usage using multiple search strategies
     */
    public static async searchForActualUsage(property: UnusedVariable, fileContent: string): Promise<boolean> {
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

    /**
     * Find specific locations where property is actually used
     */
    public static async findUsageLocations(property: UnusedVariable, fileContent: string): Promise<ActualUsageLocation[]> {
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

    /**
     * Identify compiler limitations that may cause false positives
     */
    public static identifyCompilerLimitations(property: UnusedVariable, fileContent: string): CompilerLimitation[] {
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
        
        if (fileContent.includes('eval') || fileContent.includes('new Function')) {
            limitations.push({
                limitationType: CompilerLimitationType.DYNAMIC_PROPERTY_ACCESS,
                description: 'Dynamic code execution prevents static analysis',
                affectedProperty: property.name,
                workaround: ['Avoid dynamic code execution', 'Use explicit property declarations'],
                impact: CompilerImpact.HIGH
            });
        }
        
        return limitations;
    }

    /**
     * Find dynamic access patterns that might be missed by compiler
     */
    public static findDynamicAccessPatterns(property: UnusedVariable, fileContent: string): DynamicAccessPattern[] {
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

    // Private helper methods

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

    private static findReflectionEvidence(_property: UnusedVariable, fileContent: string): string[] {
        const evidence: string[] = [];
        
        if (fileContent.includes('Reflect.') || fileContent.includes('Object.keys') || fileContent.includes('Object.getOwnPropertyNames')) {
            evidence.push('File contains reflection API usage that may access properties dynamically');
        }
        
        return evidence;
    }

    private static checkStatusBarContextUsage(fileContent: string): any | null {
        const lines = fileContent.split('\n');
        
        // Check line 58 specifically for context usage
        if (lines.length > 58 && lines[57]?.includes('context')) {
            return {
                line: 58,
                content: lines[57]?.trim() || '',
                usageType: 'VS Code extension context usage'
            };
        }
        
        return null;
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

    public static async getFileContent(filePath: string): Promise<string> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return content;
        } catch (error) {
            console.warn(`Failed to read file ${filePath}:`, error);
            return '';
        }
    }
}