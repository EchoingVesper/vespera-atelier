/**
 * Constructor Usage Analyzer
 * 
 * Specialized module for analyzing constructor patterns and initialization sequences
 * in TypeScript code. Focuses on understanding how properties are initialized
 * and used during object construction and setup phases.
 * 
 * Responsibilities:
 * - Constructor pattern analysis
 * - Property initialization sequence tracking
 * - Dependency injection pattern recognition
 * - Lazy initialization detection
 * - Architectural context assessment
 */

import * as fs from 'fs';
import { UnusedVariable } from './UnusedVariableClassifier';

// Re-export types needed for constructor analysis
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

export interface ConstructorAnalysisResult {
    hasConstructor: boolean;
    initializationPatterns: InitializationPattern[];
    dependencyInjectionUsed: boolean;
    lazyInitializationDetected: boolean;
    architecturalPreparation: boolean;
    setupMethods: string[];
    relatedProperties: string[];
}

export interface InitializationPattern {
    pattern: string;
    description: string;
    confidence: PatternConfidence;
    examples: string[];
}

export enum PatternConfidence {
    HIGH = 'high',
    MEDIUM = 'medium',
    LOW = 'low'
}

/**
 * Constructor Usage Analyzer - Specialized analysis of constructor patterns and initialization
 */
export class ConstructorUsageAnalyzer {

    /**
     * Analyze architectural context for properties that appear to be preparation infrastructure
     */
    public static async analyzeArchitecturalContext(property: UnusedVariable): Promise<ArchitecturalContext> {
        const fileContent = await this.getFileContent(property.file);
        const constructorAnalysis = await this.analyzeConstructorPatterns(property, fileContent);
        
        // Check if this appears to be architectural preparation
        const isArchitecturalPreparation = this.detectArchitecturalPreparation(property, constructorAnalysis);
        
        return {
            isArchitecturalPreparation,
            intendedPurpose: isArchitecturalPreparation 
                ? 'Prepared infrastructure for future feature development'
                : 'Standard property implementation',
            relatedFeatures: this.identifyRelatedFeatures(property, fileContent),
            implementationStatus: this.assessImplementationStatus(constructorAnalysis),
            futureUsagePlan: isArchitecturalPreparation ? {
                plannedFeature: this.inferPlannedFeature(property),
                estimatedImplementation: 'No concrete timeline',
                priority: FeaturePriority.LOW,
                dependencies: ['Extension API updates'],
                blockers: ['Unclear requirements']
            } : null
        };
    }

    /**
     * Analyze constructor patterns and initialization sequences
     */
    public static async analyzeConstructorPatterns(property: UnusedVariable, fileContent: string): Promise<ConstructorAnalysisResult> {
        const hasConstructor = fileContent.includes('constructor(');
        const initializationPatterns = this.identifyInitializationPatterns(property, fileContent);
        const dependencyInjectionUsed = this.detectDependencyInjection(fileContent);
        const lazyInitializationDetected = this.detectLazyInitialization(property, fileContent);
        const architecturalPreparation = this.detectArchitecturalPreparation(property, null);
        const setupMethods = this.findSetupMethods(fileContent);
        const relatedProperties = this.findRelatedProperties(property, fileContent);
        
        return {
            hasConstructor,
            initializationPatterns,
            dependencyInjectionUsed,
            lazyInitializationDetected,
            architecturalPreparation,
            setupMethods,
            relatedProperties
        };
    }

    /**
     * Calculate feature completion percentage based on implementation indicators
     */
    public static calculateFeatureCompletionPercentage(_property: UnusedVariable, fileContent: string): number {
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

    /**
     * Find cross-file references that might indicate property usage
     */
    public static async findCrossFileReferences(_property: UnusedVariable): Promise<CrossFileReference[]> {
        // In a real implementation, this would search across the codebase
        // For now, return empty array as placeholder
        return [];
    }

    /**
     * Analyze Git history for insights about property lifecycle
     */
    public static async analyzeGitHistory(_property: UnusedVariable): Promise<GitHistoryInsight[]> {
        // In a real implementation, this would use git commands to analyze history
        // For now, return empty array as placeholder
        return [];
    }

    /**
     * Prioritize properties for investigation based on architectural significance
     */
    public static prioritizeInvestigations(properties: UnusedVariable[]): UnusedVariable[] {
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

    // Private helper methods

    private static identifyInitializationPatterns(property: UnusedVariable, fileContent: string): InitializationPattern[] {
        const patterns: InitializationPattern[] = [];
        
        // Check for constructor initialization
        if (fileContent.includes(`this.${property.name} =`)) {
            patterns.push({
                pattern: 'Constructor Assignment',
                description: `Property ${property.name} is assigned in constructor`,
                confidence: PatternConfidence.HIGH,
                examples: [`this.${property.name} = ...`]
            });
        }
        
        // Check for lazy initialization
        if (fileContent.includes(`if (!this.${property.name})`) || fileContent.includes(`this.${property.name} = this.${property.name} ||`)) {
            patterns.push({
                pattern: 'Lazy Initialization',
                description: `Property ${property.name} uses lazy initialization pattern`,
                confidence: PatternConfidence.MEDIUM,
                examples: [`if (!this.${property.name}) { ... }`]
            });
        }
        
        // Check for factory pattern
        if (fileContent.includes('create') && fileContent.includes(property.name)) {
            patterns.push({
                pattern: 'Factory Creation',
                description: `Property ${property.name} appears to use factory pattern`,
                confidence: PatternConfidence.LOW,
                examples: ['Factory-related code detected']
            });
        }
        
        return patterns;
    }

    private static detectDependencyInjection(fileContent: string): boolean {
        const diPatterns = [
            'constructor(',
            'inject',
            '@Injectable',
            'Container',
            'provide'
        ];
        
        return diPatterns.some(pattern => fileContent.includes(pattern));
    }

    private static detectLazyInitialization(property: UnusedVariable, fileContent: string): boolean {
        const lazyPatterns = [
            `if (!this.${property.name})`,
            `this.${property.name} = this.${property.name} ||`,
            `get ${property.name}()`,
            'lazy'
        ];
        
        return lazyPatterns.some(pattern => fileContent.includes(pattern));
    }

    private static detectArchitecturalPreparation(property: UnusedVariable, _constructorAnalysis: ConstructorAnalysisResult | null): boolean {
        // Properties starting with underscore often indicate preparation
        if (property.name.startsWith('_')) {
            return true;
        }
        
        // Manager/Service suffix suggests architectural component
        if (property.name.includes('Manager') || property.name.includes('Service')) {
            return true;
        }
        
        return false;
    }

    private static identifyRelatedFeatures(property: UnusedVariable, fileContent: string): string[] {
        const features: string[] = [];
        
        if (property.name.includes('context')) {
            features.push('Extension context management');
        }
        
        if (property.name.includes('chat')) {
            features.push('Multi-server chat management');
        }
        
        if (property.name.includes('task')) {
            features.push('Task server integration');
        }
        
        if (property.name.includes('collector')) {
            features.push('Context collection system');
        }
        
        if (fileContent.includes('vscode') || fileContent.includes('extension')) {
            features.push('VS Code extension integration');
        }
        
        return features;
    }

    private static assessImplementationStatus(constructorAnalysis: ConstructorAnalysisResult): ImplementationStatus {
        if (constructorAnalysis.architecturalPreparation && !constructorAnalysis.hasConstructor) {
            return ImplementationStatus.INFRASTRUCTURE_ONLY;
        }
        
        if (constructorAnalysis.initializationPatterns.length > 0) {
            return ImplementationStatus.PARTIALLY_IMPLEMENTED;
        }
        
        return ImplementationStatus.NOT_STARTED;
    }

    private static inferPlannedFeature(property: UnusedVariable): string {
        if (property.name.includes('context')) {
            return 'Context management system';
        }
        
        if (property.name.includes('chat')) {
            return 'Multi-server chat management';
        }
        
        if (property.name.includes('task')) {
            return 'Task server integration';
        }
        
        if (property.name.includes('collector')) {
            return 'Context collection system';
        }
        
        return 'Unknown feature';
    }

    private static findSetupMethods(fileContent: string): string[] {
        const setupMethods: string[] = [];
        const methodPatterns = [
            'initialize',
            'setup',
            'init',
            'start',
            'connect',
            'configure'
        ];
        
        methodPatterns.forEach(method => {
            if (fileContent.includes(`${method}(`)) {
                setupMethods.push(method);
            }
        });
        
        return setupMethods;
    }

    private static findRelatedProperties(property: UnusedVariable, fileContent: string): string[] {
        const relatedProperties: string[] = [];
        
        // Look for properties with similar naming patterns
        const propertyMatches = fileContent.match(/private\s+_?\w+:/g) || [];
        
        propertyMatches.forEach(match => {
            const propName = match.replace(/private\s+/, '').replace(':', '');
            if (propName !== property.name && (
                propName.startsWith('_') === property.name.startsWith('_') ||
                propName.includes('Manager') || 
                propName.includes('Service')
            )) {
                relatedProperties.push(propName);
            }
        });
        
        return relatedProperties;
    }

    private static async getFileContent(filePath: string): Promise<string> {
        try {
            const content = await fs.promises.readFile(filePath, 'utf-8');
            return content;
        } catch (error) {
            console.warn(`Failed to read file ${filePath}:`, error);
            return '';
        }
    }
}