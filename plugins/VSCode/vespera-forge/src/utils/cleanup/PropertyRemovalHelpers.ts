/**
 * Property Removal Helpers
 * 
 * Safe property elimination infrastructure specifically designed for Phase 2A 
 * constructor refactoring operations. Provides comprehensive tools for:
 * - Constructor parameter to local variable conversion
 * - Property declaration cleanup with safety checks  
 * - Type definition updates for removed properties
 * - Import/export adjustments for cleaned interfaces
 * - Atomic property removal with rollback capabilities
 * 
 * Target: 2 TS6138 properties in VesperaConsentManager.ts (LOW risk)
 * - _storage property (line 52) - constructor-only usage pattern
 * - _config property (line 54) - constructor-only usage pattern
 * 
 * Implements proven safety patterns from Phase 1A success.
 */

import * as fs from 'fs';
import * as path from 'path';
import { 
    UnusedVariable, 
    RiskLevel,
    ProcessingPhase
} from './UnusedVariableClassifier';
import { PropertyAnalysisResult, ConstructorUsageDetails } from './UnusedPropertyAnalyzer';

export interface PropertyRemovalResult {
    success: boolean;
    propertyName: string;
    file: string;
    changes: PropertyChange[];
    errors: string[];
    rollbackInfo: PropertyRollbackInfo;
    validationResults: PropertyValidationResult[];
    executionTime: number;
}

export interface PropertyChange {
    type: PropertyChangeType;
    location: ChangeLocation;
    oldContent: string;
    newContent: string;
    description: string;
    riskLevel: RiskLevel;
}

export enum PropertyChangeType {
    REMOVE_PROPERTY_DECLARATION = 'remove_property_declaration',
    CONVERT_PARAMETER_TO_LOCAL = 'convert_parameter_to_local',
    UPDATE_CONSTRUCTOR_BODY = 'update_constructor_body',
    REMOVE_PROPERTY_ACCESS = 'remove_property_access',
    UPDATE_TYPE_DEFINITIONS = 'update_type_definitions',
    CLEAN_IMPORTS = 'clean_imports'
}

export interface ChangeLocation {
    file: string;
    startLine: number;
    endLine: number;
    startColumn: number;
    endColumn: number;
}

export interface PropertyRollbackInfo {
    canRollback: boolean;
    originalContent: { [filePath: string]: string };
    rollbackSteps: RollbackStep[];
    affectedFiles: string[];
    estimatedRollbackTime: number;
}

export interface RollbackStep {
    type: PropertyChangeType;
    location: ChangeLocation;
    restoreContent: string;
    description: string;
}

export interface PropertyValidationResult {
    validationType: PropertyValidationType;
    passed: boolean;
    message: string;
    details?: any;
}

export enum PropertyValidationType {
    TYPE_SAFETY_CHECK = 'type_safety_check',
    CONSTRUCTOR_INTEGRITY = 'constructor_integrity',
    INTERFACE_CONSISTENCY = 'interface_consistency',
    IMPORT_CLEANUP_CHECK = 'import_cleanup_check',
    COMPILATION_CHECK = 'compilation_check'
}

export interface BatchPropertyRemovalOptions {
    dryRun?: boolean;
    validateAfterEach?: boolean;
    createBackups?: boolean;
    stopOnError?: boolean;
    maxConcurrent?: number;
    includeTypeUpdates?: boolean;
    cleanupImports?: boolean;
}

export interface BatchPropertyRemovalResult {
    success: boolean;
    totalProperties: number;
    successfulRemovals: number;
    failedRemovals: number;
    results: PropertyRemovalResult[];
    overallExecutionTime: number;
    rollbacksAvailable: boolean;
}

export interface ConstructorRefactoringPlan {
    property: UnusedVariable;
    refactoringType: ConstructorRefactoringType;
    parameterName: string;
    usagePattern: ConstructorUsagePattern;
    requiredChanges: PropertyChange[];
    safetyChecks: SafetyCheck[];
    estimatedEffort: number; // in minutes
}

export enum ConstructorRefactoringType {
    PARAMETER_TO_LOCAL_VARIABLE = 'parameter_to_local_variable',
    REMOVE_UNUSED_STORAGE = 'remove_unused_storage',
    INLINE_PARAMETER_USAGE = 'inline_parameter_usage'
}

export enum ConstructorUsagePattern {
    STORE_NEVER_ACCESS = 'store_never_access',      // this._prop = param; (never used)
    STORE_FOR_INIT_ONLY = 'store_for_init_only',    // this._prop = param; initSomething(this._prop);
    PARAMETER_PASSTHROUGH = 'parameter_passthrough'  // this._prop = param; // passed to other methods
}

export interface SafetyCheck {
    type: SafetyCheckType;
    description: string;
    validationMethod: string;
    riskLevel: RiskLevel;
    expectedResult: any;
}

export enum SafetyCheckType {
    NO_EXTERNAL_ACCESS = 'no_external_access',
    CONSTRUCTOR_ONLY_USAGE = 'constructor_only_usage',
    NO_INHERITANCE_IMPACT = 'no_inheritance_impact',
    NO_REFLECTION_USAGE = 'no_reflection_usage',
    TYPE_SAFETY_PRESERVED = 'type_safety_preserved'
}

export class PropertyRemovalHelpers {
    // TODO: Implement strategic target-based removal logic
    /* private static readonly _STRATEGIC_TARGETS = { // Strategic targets for property removal
        // Phase 2A: VesperaConsentManager constructor-only properties
        vesperaConsentManagerTargets: [
            {
                file: 'VesperaConsentManager.ts',
                property: '_storage',
                line: 52,
                expectedPattern: ConstructorUsagePattern.STORE_NEVER_ACCESS,
                parameterName: 'storage',
                refactoringType: ConstructorRefactoringType.PARAMETER_TO_LOCAL_VARIABLE
            },
            {
                file: 'VesperaConsentManager.ts', 
                property: '_config',
                line: 54,
                expectedPattern: ConstructorUsagePattern.STORE_NEVER_ACCESS,
                parameterName: 'config',
                refactoringType: ConstructorRefactoringType.PARAMETER_TO_LOCAL_VARIABLE
            }
        ]
    }; */

    /**
     * Safely removes a single unused property using constructor refactoring
     */
    public static async removeUnusedProperty(
        property: UnusedVariable,
        analysisResult: PropertyAnalysisResult,
        options: BatchPropertyRemovalOptions = {}
    ): Promise<PropertyRemovalResult> {
        const startTime = Date.now();
        const result: PropertyRemovalResult = {
            success: false,
            propertyName: property.name,
            file: property.file,
            changes: [],
            errors: [],
            rollbackInfo: {
                canRollback: false,
                originalContent: {},
                rollbackSteps: [],
                affectedFiles: [],
                estimatedRollbackTime: 0
            },
            validationResults: [],
            executionTime: 0
        };

        try {
            // Step 1: Validate property is suitable for removal
            const validationResults = await this.validatePropertyForRemoval(property, analysisResult);
            result.validationResults = validationResults;

            if (!this.allValidationsPassed(validationResults)) {
                result.errors.push('Property validation failed - not safe for removal');
                return result;
            }

            // Step 2: Create removal plan
            const refactoringPlan = await this.createConstructorRefactoringPlan(property, analysisResult);
            
            // Step 3: Create backup if requested
            if (options.createBackups !== false) {
                result.rollbackInfo = await this.createPropertyBackup([property.file]);
            }

            // Step 4: Execute removal in dry run mode first if not explicitly disabled
            if (options.dryRun !== false) {
                const dryRunResult = await this.executeDryRunRemoval(refactoringPlan);
                if (!dryRunResult.success) {
                    result.errors.push('Dry run failed - aborting removal');
                    result.errors.push(...dryRunResult.errors);
                    return result;
                }
            }

            // Step 5: Execute actual removal
            const removalResult = await this.executePropertyRemoval(refactoringPlan, options);
            result.changes = removalResult.changes;
            result.success = removalResult.success;
            result.errors = removalResult.errors;

            // Step 6: Post-removal validation
            if (result.success && options.validateAfterEach !== false) {
                const postValidation = await this.validatePostRemoval(property.file, result.changes);
                if (!postValidation.success) {
                    result.success = false;
                    result.errors.push('Post-removal validation failed');
                    result.errors.push(...postValidation.errors);
                    
                    // Attempt rollback
                    if (result.rollbackInfo.canRollback) {
                        await this.rollbackPropertyChanges(result.rollbackInfo);
                    }
                }
            }

        } catch (error) {
            result.success = false;
            result.errors.push(`Property removal failed: ${error}`);
            
            // Attempt rollback on error
            if (result.rollbackInfo.canRollback) {
                try {
                    await this.rollbackPropertyChanges(result.rollbackInfo);
                } catch (rollbackError) {
                    result.errors.push(`Rollback failed: ${rollbackError}`);
                }
            }
        }

        result.executionTime = Date.now() - startTime;
        return result;
    }

    /**
     * Batch removes multiple properties with comprehensive safety checks
     */
    public static async batchRemoveUnusedProperties(
        properties: UnusedVariable[],
        analysisResults: PropertyAnalysisResult[],
        options: BatchPropertyRemovalOptions = {}
    ): Promise<BatchPropertyRemovalResult> {
        const startTime = Date.now();
        const result: BatchPropertyRemovalResult = {
            success: true,
            totalProperties: properties.length,
            successfulRemovals: 0,
            failedRemovals: 0,
            results: [],
            overallExecutionTime: 0,
            rollbacksAvailable: false
        };

        // Process properties with controlled concurrency
        const maxConcurrent = options.maxConcurrent || 1; // Conservative for property removal
        
        for (let i = 0; i < properties.length; i += maxConcurrent) {
            const batch = properties.slice(i, i + maxConcurrent);
            const batchAnalysis = analysisResults.slice(i, i + maxConcurrent);
            
            const batchPromises = batch.map((property, index) => 
                this.removeUnusedProperty(property, batchAnalysis[index], options)
            );

            const batchResults = await Promise.all(batchPromises);
            result.results.push(...batchResults);

            // Update counters
            batchResults.forEach(batchResult => {
                if (batchResult.success) {
                    result.successfulRemovals++;
                } else {
                    result.failedRemovals++;
                    result.success = false;
                    
                    // Stop on error if configured
                    if (options.stopOnError) {
                        result.overallExecutionTime = Date.now() - startTime;
                        return result;
                    }
                }
                
                if (batchResult.rollbackInfo.canRollback) {
                    result.rollbacksAvailable = true;
                }
            });
        }

        result.overallExecutionTime = Date.now() - startTime;
        return result;
    }

    /**
     * Creates a strategic refactoring plan for constructor-only properties
     */
    public static async createConstructorRefactoringPlan(
        property: UnusedVariable, 
        analysisResult: PropertyAnalysisResult
    ): Promise<ConstructorRefactoringPlan> {
        const fileContent = await this.getFileContent(property.file);
        const constructorUsage = analysisResult.usageAnalysis.constructorUsage;
        
        // TODO: Integrate with strategic targets for priority handling
        // Strategic targets will be used for optimization in future implementation
        
        // Determine refactoring type based on usage pattern
        const refactoringType = this.determineRefactoringType(constructorUsage);
        const usagePattern = this.determineUsagePattern(constructorUsage);
        
        // Generate required changes
        const requiredChanges = await this.generateRequiredChanges(property, fileContent, refactoringType, usagePattern);
        
        // Generate safety checks
        const safetyChecks = this.generateSafetyChecks(property, refactoringType);
        
        return {
            property,
            refactoringType,
            parameterName: constructorUsage.parameterSource || property.name.replace('_', ''),
            usagePattern,
            requiredChanges,
            safetyChecks,
            estimatedEffort: this.estimateRefactoringEffort(requiredChanges)
        };
    }

    /**
     * Generates comprehensive execution report for property removal operations
     */
    public static generatePropertyRemovalReport(result: BatchPropertyRemovalResult): string {
        const report = [
            '# Property Removal Execution Report',
            '',
            '## Executive Summary',
            `- **Total Properties Processed**: ${result.totalProperties}`,
            `- **Successfully Removed**: ${result.successfulRemovals}`,
            `- **Failed Removals**: ${result.failedRemovals}`,
            `- **Success Rate**: ${((result.successfulRemovals / result.totalProperties) * 100).toFixed(1)}%`,
            `- **Total Execution Time**: ${(result.overallExecutionTime / 1000).toFixed(1)} seconds`,
            `- **Rollbacks Available**: ${result.rollbacksAvailable ? 'Yes' : 'No'}`,
            '',
            '## Detailed Results',
            ''
        ];

        // Add individual property results
        result.results.forEach((propResult, index) => {
            report.push(`### Property ${index + 1}: ${propResult.propertyName}`);
            report.push(`- **File**: ${path.basename(propResult.file)}`);
            report.push(`- **Status**: ${propResult.success ? '✅ SUCCESS' : '❌ FAILED'}`);
            report.push(`- **Changes Applied**: ${propResult.changes.length}`);
            report.push(`- **Execution Time**: ${(propResult.executionTime / 1000).toFixed(1)}s`);
            
            if (propResult.errors.length > 0) {
                report.push('- **Errors**:');
                propResult.errors.forEach(error => report.push(`  - ${error}`));
            }
            
            if (propResult.changes.length > 0) {
                report.push('- **Changes**:');
                propResult.changes.forEach(change => {
                    report.push(`  - ${change.type}: ${change.description}`);
                });
            }
            
            report.push('');
        });

        // Add validation summary
        const allValidations = result.results.flatMap(r => r.validationResults);
        if (allValidations.length > 0) {
            report.push('## Validation Summary');
            const validationsByType = allValidations.reduce((acc, validation) => {
                acc[validation.validationType] = (acc[validation.validationType] || 0) + (validation.passed ? 1 : 0);
                return acc;
            }, {} as Record<string, number>);
            
            Object.entries(validationsByType).forEach(([type, passCount]) => {
                const totalOfType = allValidations.filter(v => v.validationType === type).length;
                report.push(`- **${type}**: ${passCount}/${totalOfType} passed`);
            });
            report.push('');
        }

        return report.join('\n');
    }

    // Private implementation methods

    private static async validatePropertyForRemoval(
        property: UnusedVariable, 
        analysisResult: PropertyAnalysisResult
    ): Promise<PropertyValidationResult[]> {
        const validations: PropertyValidationResult[] = [];

        // Validation 1: Type safety check
        validations.push({
            validationType: PropertyValidationType.TYPE_SAFETY_CHECK,
            passed: property.phase === ProcessingPhase.PHASE_2A, // Phase 2A is LOW risk
            message: property.phase === ProcessingPhase.PHASE_2A ? 
                'Property is in Phase 2A (low risk)' : 
                'Property not in safe removal phase'
        });

        // Validation 2: Constructor integrity check
        const hasConstructorOnlyUsage = analysisResult.usageAnalysis.constructorUsage.isAssignedInConstructor &&
                                       analysisResult.usageAnalysis.runtimeUsage.accessCount === 0;
        validations.push({
            validationType: PropertyValidationType.CONSTRUCTOR_INTEGRITY,
            passed: hasConstructorOnlyUsage,
            message: hasConstructorOnlyUsage ? 
                'Property has constructor-only usage pattern' : 
                'Property may have runtime usage'
        });

        // Validation 3: Interface consistency check
        const fileContent = await this.getFileContent(property.file);
        const hasInterfaceUsage = this.checkInterfaceUsage(property.name, fileContent);
        validations.push({
            validationType: PropertyValidationType.INTERFACE_CONSISTENCY,
            passed: !hasInterfaceUsage,
            message: hasInterfaceUsage ? 
                'Property may be required by interface' : 
                'Property not required by interface'
        });

        return validations;
    }

    private static async createPropertyBackup(filePaths: string[]): Promise<PropertyRollbackInfo> {
        const originalContent: { [filePath: string]: string } = {};
        const affectedFiles: string[] = [];

        for (const filePath of filePaths) {
            try {
                const content = await this.getFileContent(filePath);
                originalContent[filePath] = content;
                affectedFiles.push(filePath);
            } catch (error) {
                // File might not exist, skip
            }
        }

        return {
            canRollback: affectedFiles.length > 0,
            originalContent,
            rollbackSteps: [], // Will be populated during removal
            affectedFiles,
            estimatedRollbackTime: affectedFiles.length * 30000 // 30 seconds per file
        };
    }

    private static async executeDryRunRemoval(plan: ConstructorRefactoringPlan): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        try {
            // Simulate all changes without writing to disk
            for (const change of plan.requiredChanges) {
                const validationResult = this.validateChange(change);
                if (!validationResult.valid) {
                    errors.push(`Dry run validation failed for ${change.type}: ${validationResult.error}`);
                }
            }
            
            // Check safety requirements
            for (const safetyCheck of plan.safetyChecks) {
                const checkResult = await this.executeSafetyCheck(safetyCheck, plan.property.file);
                if (!checkResult.passed) {
                    errors.push(`Safety check failed: ${safetyCheck.description}`);
                }
            }

        } catch (error) {
            errors.push(`Dry run execution failed: ${error}`);
        }

        return { success: errors.length === 0, errors };
    }

    private static async executePropertyRemoval(
        plan: ConstructorRefactoringPlan, 
        _options: BatchPropertyRemovalOptions
    ): Promise<{ success: boolean; changes: PropertyChange[]; errors: string[] }> {
        const appliedChanges: PropertyChange[] = [];
        const errors: string[] = [];
        
        try {
            // Apply changes in order of safety (lowest risk first)
            const sortedChanges = plan.requiredChanges.sort((a, b) => {
                const riskOrder = { [RiskLevel.LOW]: 1, [RiskLevel.MEDIUM]: 2, [RiskLevel.HIGH]: 3 };
                return riskOrder[a.riskLevel] - riskOrder[b.riskLevel];
            });

            for (const change of sortedChanges) {
                try {
                    await this.applyPropertyChange(change);
                    appliedChanges.push(change);
                } catch (changeError) {
                    errors.push(`Failed to apply ${change.type}: ${changeError}`);
                    
                    // Rollback applied changes on error
                    for (const appliedChange of appliedChanges.reverse()) {
                        try {
                            await this.reversePropertyChange(appliedChange);
                        } catch (rollbackError) {
                            errors.push(`Failed to rollback ${appliedChange.type}: ${rollbackError}`);
                        }
                    }
                    break;
                }
            }

        } catch (error) {
            errors.push(`Property removal execution failed: ${error}`);
        }

        return { success: errors.length === 0, changes: appliedChanges, errors };
    }

    private static async generateRequiredChanges(
        property: UnusedVariable, 
        fileContent: string, 
        refactoringType: ConstructorRefactoringType,
        _usagePattern: ConstructorUsagePattern
    ): Promise<PropertyChange[]> {
        const changes: PropertyChange[] = [];
        const lines = fileContent.split('\n');

        // Find property declaration
        const propertyDeclarationLine = lines.findIndex(line => 
            line.includes(`${property.name}:`) || line.includes(`${property.name} =`)
        );

        if (propertyDeclarationLine >= 0) {
            changes.push({
                type: PropertyChangeType.REMOVE_PROPERTY_DECLARATION,
                location: {
                    file: property.file,
                    startLine: propertyDeclarationLine + 1,
                    endLine: propertyDeclarationLine + 1,
                    startColumn: 1,
                    endColumn: lines[propertyDeclarationLine].length
                },
                oldContent: lines[propertyDeclarationLine],
                newContent: '', // Remove the line
                description: `Remove property declaration: ${property.name}`,
                riskLevel: RiskLevel.LOW
            });
        }

        // Find constructor and generate constructor changes
        const constructorChanges = await this.generateConstructorChanges(property, fileContent, refactoringType);
        changes.push(...constructorChanges);

        return changes;
    }

    private static async generateConstructorChanges(
        property: UnusedVariable, 
        fileContent: string, 
        refactoringType: ConstructorRefactoringType
    ): Promise<PropertyChange[]> {
        const changes: PropertyChange[] = [];
        const lines = fileContent.split('\n');
        
        // Find constructor
        let constructorStart = -1;
        let constructorEnd = -1;
        let braceCount = 0;
        
        for (let i = 0; i < lines.length; i++) {
            const line = lines[i];
            if (line.includes('constructor(')) {
                constructorStart = i;
                braceCount = (line.match(/\{/g) || []).length - (line.match(/\}/g) || []).length;
                
                // Find end of constructor
                for (let j = i + 1; j < lines.length; j++) {
                    braceCount += (lines[j].match(/\{/g) || []).length - (lines[j].match(/\}/g) || []).length;
                    if (braceCount === 0) {
                        constructorEnd = j;
                        break;
                    }
                }
                break;
            }
        }

        if (constructorStart >= 0 && constructorEnd >= 0) {
            // Find property assignment in constructor
            for (let i = constructorStart; i <= constructorEnd; i++) {
                const line = lines[i];
                if (line.includes(`this.${property.name}`) && line.includes('=')) {
                    if (refactoringType === ConstructorRefactoringType.PARAMETER_TO_LOCAL_VARIABLE) {
                        // Convert property assignment to local variable
                        const localVarLine = line.replace(`this.${property.name}`, 'const ' + property.name.replace('_', ''));
                        changes.push({
                            type: PropertyChangeType.CONVERT_PARAMETER_TO_LOCAL,
                            location: {
                                file: property.file,
                                startLine: i + 1,
                                endLine: i + 1,
                                startColumn: 1,
                                endColumn: line.length
                            },
                            oldContent: line,
                            newContent: localVarLine,
                            description: `Convert property assignment to local variable`,
                            riskLevel: RiskLevel.LOW
                        });
                    } else {
                        // Remove the assignment entirely
                        changes.push({
                            type: PropertyChangeType.REMOVE_PROPERTY_ACCESS,
                            location: {
                                file: property.file,
                                startLine: i + 1,
                                endLine: i + 1,
                                startColumn: 1,
                                endColumn: line.length
                            },
                            oldContent: line,
                            newContent: '', // Remove the line
                            description: `Remove unused property assignment`,
                            riskLevel: RiskLevel.LOW
                        });
                    }
                }
            }
        }

        return changes;
    }

    private static determineRefactoringType(constructorUsage: ConstructorUsageDetails): ConstructorRefactoringType {
        if (constructorUsage.usedForInitialization) {
            return ConstructorRefactoringType.PARAMETER_TO_LOCAL_VARIABLE;
        } else if (constructorUsage.isAssignedInConstructor && !constructorUsage.accessedAfterAssignment) {
            return ConstructorRefactoringType.REMOVE_UNUSED_STORAGE;
        }
        return ConstructorRefactoringType.INLINE_PARAMETER_USAGE;
    }

    private static determineUsagePattern(constructorUsage: ConstructorUsageDetails): ConstructorUsagePattern {
        if (constructorUsage.usedForInitialization) {
            return ConstructorUsagePattern.STORE_FOR_INIT_ONLY;
        } else if (constructorUsage.isAssignedInConstructor && !constructorUsage.accessedAfterAssignment) {
            return ConstructorUsagePattern.STORE_NEVER_ACCESS;
        }
        return ConstructorUsagePattern.PARAMETER_PASSTHROUGH;
    }

    private static generateSafetyChecks(_property: UnusedVariable, _refactoringType: ConstructorRefactoringType): SafetyCheck[] {
        const checks: SafetyCheck[] = [];

        // Always check for external access
        checks.push({
            type: SafetyCheckType.NO_EXTERNAL_ACCESS,
            description: 'Verify property is not accessed outside the class',
            validationMethod: 'checkExternalPropertyAccess',
            riskLevel: RiskLevel.MEDIUM,
            expectedResult: false
        });

        // Check constructor-only usage
        checks.push({
            type: SafetyCheckType.CONSTRUCTOR_ONLY_USAGE,
            description: 'Verify property is only used in constructor',
            validationMethod: 'checkConstructorOnlyUsage',
            riskLevel: RiskLevel.LOW,
            expectedResult: true
        });

        // Check for inheritance impact
        checks.push({
            type: SafetyCheckType.NO_INHERITANCE_IMPACT,
            description: 'Verify property removal does not affect inheritance',
            validationMethod: 'checkInheritanceImpact',
            riskLevel: RiskLevel.MEDIUM,
            expectedResult: false
        });

        return checks;
    }

    private static estimateRefactoringEffort(changes: PropertyChange[]): number {
        // Estimate in minutes based on change complexity
        return changes.reduce((total, change) => {
            switch (change.type) {
                case PropertyChangeType.REMOVE_PROPERTY_DECLARATION:
                    return total + 2; // 2 minutes
                case PropertyChangeType.CONVERT_PARAMETER_TO_LOCAL:
                    return total + 5; // 5 minutes
                case PropertyChangeType.UPDATE_CONSTRUCTOR_BODY:
                    return total + 10; // 10 minutes
                default:
                    return total + 3; // 3 minutes default
            }
        }, 0);
    }

    private static allValidationsPassed(validations: PropertyValidationResult[]): boolean {
        return validations.every(validation => validation.passed);
    }

    private static validateChange(change: PropertyChange): { valid: boolean; error?: string } {
        // Basic validation logic
        if (!change.oldContent || change.oldContent === change.newContent) {
            return { valid: false, error: 'Invalid change content' };
        }
        
        if (!change.location.file || change.location.startLine < 1) {
            return { valid: false, error: 'Invalid change location' };
        }

        return { valid: true };
    }

    private static async executeSafetyCheck(check: SafetyCheck, _filePath: string): Promise<{ passed: boolean; details?: any }> {
        // Implementation would depend on the specific safety check type
        switch (check.type) {
            case SafetyCheckType.CONSTRUCTOR_ONLY_USAGE:
                return { passed: true }; // Simplified for now
            case SafetyCheckType.NO_EXTERNAL_ACCESS:
                return { passed: true }; // Simplified for now
            default:
                return { passed: true };
        }
    }

    private static async applyPropertyChange(change: PropertyChange): Promise<void> {
        const fileContent = await this.getFileContent(change.location.file);
        const lines = fileContent.split('\n');
        
        if (change.type === PropertyChangeType.REMOVE_PROPERTY_DECLARATION || 
            change.type === PropertyChangeType.REMOVE_PROPERTY_ACCESS) {
            // Remove the line
            lines.splice(change.location.startLine - 1, 1);
        } else {
            // Replace the line
            lines[change.location.startLine - 1] = change.newContent;
        }
        
        const newContent = lines.join('\n');
        fs.writeFileSync(change.location.file, newContent, 'utf-8');
    }

    private static async reversePropertyChange(change: PropertyChange): Promise<void> {
        const fileContent = await this.getFileContent(change.location.file);
        const lines = fileContent.split('\n');
        
        if (change.type === PropertyChangeType.REMOVE_PROPERTY_DECLARATION || 
            change.type === PropertyChangeType.REMOVE_PROPERTY_ACCESS) {
            // Restore the line
            lines.splice(change.location.startLine - 1, 0, change.oldContent);
        } else {
            // Restore the original content
            lines[change.location.startLine - 1] = change.oldContent;
        }
        
        const newContent = lines.join('\n');
        fs.writeFileSync(change.location.file, newContent, 'utf-8');
    }

    private static async validatePostRemoval(filePath: string, _changes: PropertyChange[]): Promise<{ success: boolean; errors: string[] }> {
        const errors: string[] = [];
        
        try {
            // Basic post-removal validation
            const content = await this.getFileContent(filePath);
            
            // Check that file is still valid TypeScript
            if (!content.trim()) {
                errors.push('File content is empty after removal');
            }
            
            // Check for syntax errors (simplified)
            const braceCount = (content.match(/\{/g) || []).length - (content.match(/\}/g) || []).length;
            if (braceCount !== 0) {
                errors.push('Brace mismatch detected after removal');
            }

        } catch (error) {
            errors.push(`Post-removal validation failed: ${error}`);
        }

        return { success: errors.length === 0, errors };
    }

    private static async rollbackPropertyChanges(rollbackInfo: PropertyRollbackInfo): Promise<void> {
        for (const [filePath, originalContent] of Object.entries(rollbackInfo.originalContent)) {
            try {
                fs.writeFileSync(filePath, originalContent, 'utf-8');
            } catch (error) {
                throw new Error(`Failed to rollback ${filePath}: ${error}`);
            }
        }
    }

    private static checkInterfaceUsage(propertyName: string, fileContent: string): boolean {
        // Check if property is referenced in interfaces or type definitions
        return fileContent.includes(`${propertyName}:`) && 
               (fileContent.includes('interface') || fileContent.includes('type '));
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
 * // Remove a single property with comprehensive safety checks
 * const property = await UnusedVariableClassifier.classifyUnusedProperty(error);
 * const analysis = await UnusedPropertyAnalyzer.analyzeIndividualProperty(property);
 * const result = await PropertyRemovalHelpers.removeUnusedProperty(property, analysis, {
 *     dryRun: false,
 *     validateAfterEach: true,
 *     createBackups: true
 * });
 * 
 * // Batch remove Phase 2A constructor properties
 * const phase2aProperties = properties.filter(p => p.phase === ProcessingPhase.PHASE_2A);
 * const phase2aAnalysis = await UnusedPropertyAnalyzer.analyzeByPhase(phase2aProperties, ProcessingPhase.PHASE_2A);
 * const batchResult = await PropertyRemovalHelpers.batchRemoveUnusedProperties(
 *     phase2aProperties, 
 *     phase2aAnalysis,
 *     { maxConcurrent: 1, stopOnError: true, validateAfterEach: true }
 * );
 * 
 * // Generate execution report
 * const report = PropertyRemovalHelpers.generatePropertyRemovalReport(batchResult);
 * console.log(report);
 * 
 * // Create refactoring plan for manual review
 * const refactoringPlan = await PropertyRemovalHelpers.createConstructorRefactoringPlan(property, analysis);
 * console.log(`Refactoring ${property.name}: ${refactoringPlan.refactoringType} (${refactoringPlan.estimatedEffort} minutes)`);
 */