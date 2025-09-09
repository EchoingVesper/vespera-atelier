/**
 * PropertyAnalysisPhases Tests
 * 
 * Comprehensive test coverage for the PropertyAnalysisPhases module focusing on:
 * - Phase categorization logic
 * - Strategic property data management
 * - Property mapping and validation
 * - Usage pattern determination
 * - Phase statistics and reporting
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { 
  PropertyAnalysisPhases,
  PropertyUsagePattern,
  IntegrationType,
  ConfidenceLevel
} from '../../utils/cleanup/PropertyAnalysisPhases';
import { 
  UnusedVariable,
  ProcessingPhase,
  UnusedVariableType,
  RiskLevel,
  ErrorCategory
} from '../../utils/cleanup/UnusedVariableClassifier';

suite('PropertyAnalysisPhases Tests', () => {

  // Test data setup
  const createTestProperty = (
    name: string, 
    file: string, 
    line: number, 
    phase: ProcessingPhase
  ): UnusedVariable => ({
    name,
    file,
    line,
    column: 1,
    type: UnusedVariableType.CLASS_PROPERTY,
    riskLevel: RiskLevel.MEDIUM,
    phase,
    category: ErrorCategory.SERVICE_INTEGRATION_GAP
  });

  suite('Strategic Property Data Validation', () => {
    test('Should have correct phase distribution', () => {
      const statistics = PropertyAnalysisPhases.getPhaseStatistics();
      
      assert.strictEqual(statistics[ProcessingPhase.PHASE_2A], 2, 'Phase 2A should have 2 properties');
      assert.strictEqual(statistics[ProcessingPhase.PHASE_2B], 7, 'Phase 2B should have 7 properties');
      assert.strictEqual(statistics[ProcessingPhase.PHASE_2C], 5, 'Phase 2C should have 5 properties');
    });

    test('Should have all required strategic data', () => {
      const allProperties = PropertyAnalysisPhases.getAllStrategicProperties();
      
      assert.strictEqual(allProperties.length, 14, 'Should have 14 strategic properties total');
      
      // Validate Phase 2A properties
      const phase2AProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2A);
      assert.strictEqual(phase2AProperties.length, 2);
      assert.ok(phase2AProperties.every(p => 
        p.expectedPattern === PropertyUsagePattern.CONSTRUCTOR_ONLY &&
        p.confidence === ConfidenceLevel.HIGH
      ), 'Phase 2A properties should have constructor-only pattern and high confidence');

      // Validate Phase 2B properties
      const phase2BProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2B);
      assert.strictEqual(phase2BProperties.length, 7);
      assert.ok(phase2BProperties.every(p => 
        p.integrationType !== undefined &&
        p.similarPattern !== undefined
      ), 'Phase 2B properties should have integration type and similar pattern');

      // Validate Phase 2C properties
      const phase2CProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2C);
      assert.strictEqual(phase2CProperties.length, 5);
      assert.ok(phase2CProperties.every(p => 
        p.investigationType !== undefined
      ), 'Phase 2C properties should have investigation type');
    });

    test('Should validate Phase 2A VesperaConsentManager properties', () => {
      const phase2AProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2A);
      
      const storageProperty = phase2AProperties.find(p => p.property === '_storage');
      assert.ok(storageProperty, '_storage property should exist');
      assert.strictEqual(storageProperty.file, 'VesperaConsentManager.ts');
      assert.strictEqual(storageProperty.line, 52);
      assert.strictEqual(storageProperty.expectedPattern, PropertyUsagePattern.CONSTRUCTOR_ONLY);
      
      const configProperty = phase2AProperties.find(p => p.property === '_config');
      assert.ok(configProperty, '_config property should exist');
      assert.strictEqual(configProperty.file, 'VesperaConsentManager.ts');
      assert.strictEqual(configProperty.line, 54);
    });

    test('Should validate Phase 2B service integration properties', () => {
      const phase2BProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2B);
      
      // Test coreServices properties
      const coreServicesProperties = phase2BProperties.filter(p => p.property === 'coreServices');
      assert.strictEqual(coreServicesProperties.length, 3, 'Should have 3 coreServices properties');
      
      coreServicesProperties.forEach(prop => {
        assert.ok([
          IntegrationType.INPUT_SANITIZATION,
          IntegrationType.SECURITY_AUDIT_LOGGING
        ].includes(prop.integrationType!), 'coreServices should have appropriate integration type');
        assert.ok(prop.similarPattern, 'Should have similar pattern reference');
      });

      // Test errorHandler properties
      const errorHandlerProperties = phase2BProperties.filter(p => p.property === 'errorHandler');
      assert.strictEqual(errorHandlerProperties.length, 4, 'Should have 4 errorHandler properties');
      
      errorHandlerProperties.forEach(prop => {
        assert.strictEqual(prop.integrationType, IntegrationType.ERROR_HANDLING);
        assert.ok(prop.similarPattern, 'Should have similar pattern reference');
      });
    });

    test('Should validate Phase 2C system context properties', () => {
      const phase2CProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2C);
      
      // Test status-bar context property
      const statusBarContext = phase2CProperties.find(p => 
        p.file === 'status-bar.ts' && p.property === 'context'
      );
      assert.ok(statusBarContext, 'status-bar context property should exist');
      assert.strictEqual(statusBarContext.investigationType, 'false_positive_analysis');
      assert.strictEqual(statusBarContext.actualUsage, 'line 58');
      assert.strictEqual(statusBarContext.confidence, ConfidenceLevel.MEDIUM);

      // Test index.ts incomplete feature properties
      const indexProperties = phase2CProperties.filter(p => p.file === 'index.ts');
      assert.strictEqual(indexProperties.length, 4, 'Should have 4 index.ts properties');
      
      indexProperties.forEach(prop => {
        if (prop.property === '_context') {
          assert.strictEqual(prop.investigationType, 'architectural_preparation');
        } else {
          assert.strictEqual(prop.investigationType, 'incomplete_feature');
        }
        assert.strictEqual(prop.confidence, ConfidenceLevel.LOW);
      });
    });
  });

  suite('Property Lookup and Mapping', () => {
    test('Should find strategic data for matching properties', () => {
      const testProperty = createTestProperty('_storage', 'VesperaConsentManager.ts', 52, ProcessingPhase.PHASE_2A);
      
      const strategicData = PropertyAnalysisPhases.findStrategicDataForProperty(testProperty);
      assert.ok(strategicData, 'Should find strategic data for _storage property');
      assert.strictEqual(strategicData.property, '_storage');
      assert.strictEqual(strategicData.expectedPattern, PropertyUsagePattern.CONSTRUCTOR_ONLY);
    });

    test('Should return null for non-matching properties', () => {
      const testProperty = createTestProperty('nonExistentProperty', 'UnknownFile.ts', 1, ProcessingPhase.PHASE_2A);
      
      const strategicData = PropertyAnalysisPhases.findStrategicDataForProperty(testProperty);
      assert.strictEqual(strategicData, null, 'Should return null for non-matching properties');
    });

    test('Should handle partial file name matching', () => {
      // Test that file matching works with partial paths
      const testProperty = createTestProperty('coreServices', 'src/components/AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      
      const strategicData = PropertyAnalysisPhases.findStrategicDataForProperty(testProperty);
      assert.ok(strategicData, 'Should find strategic data with partial file path matching');
      assert.strictEqual(strategicData.property, 'coreServices');
    });

    test('Should validate property phase mapping', () => {
      const phase2AProperty = createTestProperty('_storage', 'VesperaConsentManager.ts', 52, ProcessingPhase.PHASE_2A);
      const phase2BProperty = createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      const phase2CProperty = createTestProperty('context', 'status-bar.ts', 23, ProcessingPhase.PHASE_2C);
      const unknownProperty = createTestProperty('unknown', 'unknown.ts', 1, ProcessingPhase.PHASE_2A);

      assert.strictEqual(PropertyAnalysisPhases.validatePropertyPhaseMapping(phase2AProperty), true);
      assert.strictEqual(PropertyAnalysisPhases.validatePropertyPhaseMapping(phase2BProperty), true);
      assert.strictEqual(PropertyAnalysisPhases.validatePropertyPhaseMapping(phase2CProperty), true);
      assert.strictEqual(PropertyAnalysisPhases.validatePropertyPhaseMapping(unknownProperty), false);
    });
  });

  suite('Usage Pattern Determination', () => {
    test('Should determine expected usage patterns based on strategic data', () => {
      const phase2AProperty = createTestProperty('_storage', 'VesperaConsentManager.ts', 52, ProcessingPhase.PHASE_2A);
      const pattern = PropertyAnalysisPhases.determineExpectedUsagePattern(phase2AProperty);
      assert.strictEqual(pattern, PropertyUsagePattern.CONSTRUCTOR_ONLY);
    });

    test('Should fall back to phase-based patterns for unmatched properties', () => {
      const phase2AProperty = createTestProperty('unknown', 'unknown.ts', 1, ProcessingPhase.PHASE_2A);
      const phase2BProperty = createTestProperty('coreServices', 'unknown.ts', 1, ProcessingPhase.PHASE_2B);
      const phase2BErrorProperty = createTestProperty('errorHandler', 'unknown.ts', 1, ProcessingPhase.PHASE_2B);
      const phase2CProperty = createTestProperty('unknown', 'unknown.ts', 1, ProcessingPhase.PHASE_2C);

      assert.strictEqual(PropertyAnalysisPhases.determineExpectedUsagePattern(phase2AProperty), PropertyUsagePattern.CONSTRUCTOR_ONLY);
      assert.strictEqual(PropertyAnalysisPhases.determineExpectedUsagePattern(phase2BProperty), PropertyUsagePattern.SERVICE_INTEGRATION_GAP);
      assert.strictEqual(PropertyAnalysisPhases.determineExpectedUsagePattern(phase2BErrorProperty), PropertyUsagePattern.ERROR_HANDLER_GAP);
      assert.strictEqual(PropertyAnalysisPhases.determineExpectedUsagePattern(phase2CProperty), PropertyUsagePattern.INCOMPLETE_FEATURE);
    });

    test('Should get correct integration types for Phase 2B properties', () => {
      const coreServicesProperty = createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      const errorHandlerProperty = createTestProperty('errorHandler', 'MultiChatNotificationManager.ts', 180, ProcessingPhase.PHASE_2B);
      const unknownProperty = createTestProperty('unknown', 'unknown.ts', 1, ProcessingPhase.PHASE_2B);

      assert.strictEqual(PropertyAnalysisPhases.getIntegrationType(coreServicesProperty), IntegrationType.INPUT_SANITIZATION);
      assert.strictEqual(PropertyAnalysisPhases.getIntegrationType(errorHandlerProperty), IntegrationType.ERROR_HANDLING);
      assert.strictEqual(PropertyAnalysisPhases.getIntegrationType(unknownProperty), null);
    });

    test('Should get similar patterns for reference', () => {
      const testProperty = createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      const similarPattern = PropertyAnalysisPhases.getSimilarPattern(testProperty);
      assert.strictEqual(similarPattern, 'MultiChatNotificationManager');
    });

    test('Should get investigation types for Phase 2C properties', () => {
      const contextProperty = createTestProperty('context', 'status-bar.ts', 23, ProcessingPhase.PHASE_2C);
      const chatManagerProperty = createTestProperty('_chatManager', 'index.ts', 123, ProcessingPhase.PHASE_2C);

      assert.strictEqual(PropertyAnalysisPhases.getInvestigationType(contextProperty), 'false_positive_analysis');
      assert.strictEqual(PropertyAnalysisPhases.getInvestigationType(chatManagerProperty), 'incomplete_feature');
    });
  });

  suite('Confidence Level Assessment', () => {
    test('Should return strategic confidence when available', () => {
      const phase2AProperty = createTestProperty('_storage', 'VesperaConsentManager.ts', 52, ProcessingPhase.PHASE_2A);
      const confidence = PropertyAnalysisPhases.getExpectedConfidence(phase2AProperty);
      assert.strictEqual(confidence, ConfidenceLevel.HIGH);
    });

    test('Should fall back to phase-based confidence', () => {
      const unknownPhase2A = createTestProperty('unknown', 'unknown.ts', 1, ProcessingPhase.PHASE_2A);
      const unknownPhase2B = createTestProperty('unknown', 'unknown.ts', 1, ProcessingPhase.PHASE_2B);
      const unknownPhase2C = createTestProperty('unknown', 'unknown.ts', 1, ProcessingPhase.PHASE_2C);

      assert.strictEqual(PropertyAnalysisPhases.getExpectedConfidence(unknownPhase2A), ConfidenceLevel.HIGH);
      assert.strictEqual(PropertyAnalysisPhases.getExpectedConfidence(unknownPhase2B), ConfidenceLevel.MEDIUM);
      assert.strictEqual(PropertyAnalysisPhases.getExpectedConfidence(unknownPhase2C), ConfidenceLevel.LOW);
    });
  });

  suite('Phase Summary and Reporting', () => {
    test('Should generate comprehensive phase summary', () => {
      const summary = PropertyAnalysisPhases.getPhaseSummary();
      
      assert.strictEqual(summary.length, 3, 'Should have 3 phase summaries');
      
      // Validate Phase 2A summary
      const phase2A = summary.find(s => s.phase === ProcessingPhase.PHASE_2A);
      assert.ok(phase2A, 'Should have Phase 2A summary');
      assert.strictEqual(phase2A.description, 'Constructor refactoring opportunities');
      assert.strictEqual(phase2A.properties, 2);
      assert.strictEqual(phase2A.risk, 'LOW');
      assert.ok(phase2A.expectedPatterns.includes(PropertyUsagePattern.CONSTRUCTOR_ONLY));

      // Validate Phase 2B summary
      const phase2B = summary.find(s => s.phase === ProcessingPhase.PHASE_2B);
      assert.ok(phase2B, 'Should have Phase 2B summary');
      assert.strictEqual(phase2B.description, 'Service integration enhancement');
      assert.strictEqual(phase2B.properties, 7);
      assert.strictEqual(phase2B.risk, 'MEDIUM');
      assert.ok(phase2B.expectedPatterns.includes(PropertyUsagePattern.SERVICE_INTEGRATION_GAP));

      // Validate Phase 2C summary
      const phase2C = summary.find(s => s.phase === ProcessingPhase.PHASE_2C);
      assert.ok(phase2C, 'Should have Phase 2C summary');
      assert.strictEqual(phase2C.description, 'System investigation and resolution');
      assert.strictEqual(phase2C.properties, 5);
      assert.strictEqual(phase2C.risk, 'HIGH');
      assert.ok(phase2C.expectedPatterns.includes(PropertyUsagePattern.FALSE_POSITIVE));
      assert.ok(phase2C.expectedPatterns.includes(PropertyUsagePattern.INCOMPLETE_FEATURE));
    });

    test('Should handle edge cases in phase lookup', () => {
      const emptyPhaseProperties = PropertyAnalysisPhases.getPropertiesForPhase('invalid_phase' as ProcessingPhase);
      assert.strictEqual(emptyPhaseProperties.length, 0, 'Should return empty array for invalid phase');
    });
  });

  suite('Data Structure Validation', () => {
    test('Should validate all strategic properties have required fields', () => {
      const allProperties = PropertyAnalysisPhases.getAllStrategicProperties();
      
      allProperties.forEach(property => {
        assert.ok(typeof property.file === 'string' && property.file.length > 0, 'File should be non-empty string');
        assert.ok(typeof property.property === 'string' && property.property.length > 0, 'Property should be non-empty string');
        assert.ok(typeof property.line === 'number' && property.line > 0, 'Line should be positive number');
      });
    });

    test('Should validate Phase 2A properties have expected pattern and confidence', () => {
      const phase2AProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2A);
      
      phase2AProperties.forEach(property => {
        assert.strictEqual(property.expectedPattern, PropertyUsagePattern.CONSTRUCTOR_ONLY);
        assert.strictEqual(property.confidence, ConfidenceLevel.HIGH);
        assert.strictEqual(property.integrationType, undefined);
        assert.strictEqual(property.investigationType, undefined);
      });
    });

    test('Should validate Phase 2B properties have integration details', () => {
      const phase2BProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2B);
      
      phase2BProperties.forEach(property => {
        assert.ok(Object.values(IntegrationType).includes(property.integrationType!), 
          'Should have valid integration type');
        assert.ok(typeof property.similarPattern === 'string' && property.similarPattern.length > 0, 
          'Should have non-empty similar pattern');
        assert.strictEqual(property.expectedPattern, undefined);
        assert.strictEqual(property.investigationType, undefined);
      });
    });

    test('Should validate Phase 2C properties have investigation details', () => {
      const phase2CProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2C);
      
      phase2CProperties.forEach(property => {
        assert.ok(typeof property.investigationType === 'string' && property.investigationType.length > 0, 
          'Should have non-empty investigation type');
        assert.ok(Object.values(ConfidenceLevel).includes(property.confidence!), 
          'Should have valid confidence level');
        assert.strictEqual(property.integrationType, undefined);
        assert.strictEqual(property.similarPattern, undefined);
      });
    });
  });

  suite('Integration Type Coverage', () => {
    test('Should cover all integration types in Phase 2B', () => {
      const phase2BProperties = PropertyAnalysisPhases.getPropertiesForPhase(ProcessingPhase.PHASE_2B);
      const integrationTypes = phase2BProperties.map(p => p.integrationType);
      
      assert.ok(integrationTypes.includes(IntegrationType.INPUT_SANITIZATION), 
        'Should include input sanitization');
      assert.ok(integrationTypes.includes(IntegrationType.ERROR_HANDLING), 
        'Should include error handling');
      assert.ok(integrationTypes.includes(IntegrationType.SECURITY_AUDIT_LOGGING), 
        'Should include security audit logging');
      
      // Count occurrences
      const sanitizationCount = integrationTypes.filter(t => t === IntegrationType.INPUT_SANITIZATION).length;
      const errorHandlingCount = integrationTypes.filter(t => t === IntegrationType.ERROR_HANDLING).length;
      const securityAuditCount = integrationTypes.filter(t => t === IntegrationType.SECURITY_AUDIT_LOGGING).length;
      
      assert.strictEqual(sanitizationCount, 2, 'Should have 2 input sanitization opportunities');
      assert.strictEqual(errorHandlingCount, 4, 'Should have 4 error handling opportunities');
      assert.strictEqual(securityAuditCount, 1, 'Should have 1 security audit logging opportunity');
    });
  });
});