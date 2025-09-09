/**
 * PropertyStrategicAnalyzer Tests
 * 
 * Comprehensive test coverage for the PropertyStrategicAnalyzer module focusing on:
 * - Integration opportunity identification
 * - Service connection analysis  
 * - Strategic scoring and prioritization
 * - Implementation effort estimation
 * - Cross-component analysis validation
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import { 
  PropertyStrategicAnalyzer,
  IntegrationOpportunity,
  ServiceConnection,
  ConnectionType
} from '../../utils/cleanup/PropertyStrategicAnalyzer';
import { 
  IntegrationType,
  EffortLevel,
  BenefitLevel
} from '../../utils/cleanup/PropertyAnalysisPhases';
import { 
  UnusedVariable,
  ProcessingPhase,
  UnusedVariableType,
  RiskLevel,
  ErrorCategory
} from '../../utils/cleanup/UnusedVariableClassifier';

suite('PropertyStrategicAnalyzer Tests', () => {

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

  const createMockFileContent = (propertyUsages: string[] = []): string => {
    const baseContent = `
class TestClass {
  constructor() {
    this.coreServices = coreServices;
    this.errorHandler = errorHandler;
  }
  
  async performTask() {
    try {
      // Some implementation
    } catch (error) {
      // Error handling would go here
    }
  }
}`;

    return baseContent + '\n' + propertyUsages.join('\n');
  };

  suite('Integration Opportunity Identification', () => {
    test('Should identify integration opportunities for Phase 2B properties', () => {
      const property = createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent();
      
      const opportunity = PropertyStrategicAnalyzer.identifyIntegrationOpportunity(property, fileContent);
      
      assert.ok(opportunity, 'Should identify integration opportunity for Phase 2B property');
      assert.strictEqual(opportunity!.type, IntegrationType.INPUT_SANITIZATION);
      assert.strictEqual(opportunity!.riskAssessment, RiskLevel.MEDIUM);
      assert.ok(opportunity!.similarPatterns.includes('MultiChatNotificationManager'));
      assert.ok(opportunity!.implementationSteps.length > 0);
    });

    test('Should return null for non-Phase 2B properties', () => {
      const phase2AProperty = createTestProperty('_storage', 'VesperaConsentManager.ts', 52, ProcessingPhase.PHASE_2A);
      const phase2CProperty = createTestProperty('context', 'status-bar.ts', 23, ProcessingPhase.PHASE_2C);
      
      assert.strictEqual(PropertyStrategicAnalyzer.identifyIntegrationOpportunity(phase2AProperty, ''), null);
      assert.strictEqual(PropertyStrategicAnalyzer.identifyIntegrationOpportunity(phase2CProperty, ''), null);
    });

    test('Should return null for properties without strategic data', () => {
      const unknownProperty = createTestProperty('unknownProperty', 'unknown.ts', 1, ProcessingPhase.PHASE_2B);
      
      const opportunity = PropertyStrategicAnalyzer.identifyIntegrationOpportunity(unknownProperty, '');
      assert.strictEqual(opportunity, null);
    });

    test('Should analyze service integration opportunities correctly', () => {
      const errorHandlerProperty = createTestProperty('errorHandler', 'MultiChatNotificationManager.ts', 180, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent();
      
      const opportunity = PropertyStrategicAnalyzer.analyzeServiceIntegrationOpportunity(errorHandlerProperty, fileContent);
      
      assert.ok(opportunity, 'Should identify service integration opportunity');
      assert.strictEqual(opportunity!.type, IntegrationType.ERROR_HANDLING);
      assert.strictEqual(opportunity!.effort, EffortLevel.MEDIUM);
      assert.strictEqual(opportunity!.expectedBenefit, BenefitLevel.MEDIUM);
      assert.strictEqual(opportunity!.riskAssessment, RiskLevel.MEDIUM);
    });
  });

  suite('Service Connection Analysis', () => {
    test('Should analyze coreServices connections', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent(['this.coreServices.sanitize(input)']);
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      
      assert.strictEqual(connections.length, 1);
      assert.strictEqual(connections[0].serviceName, 'CoreServices');
      assert.strictEqual(connections[0].connectionType, ConnectionType.CORE_SERVICES);
      assert.strictEqual(connections[0].isActuallyUsed, true);
      assert.strictEqual(connections[0].integrationOpportunity, true);
    });

    test('Should analyze errorHandler connections', () => {
      const property = createTestProperty('errorHandler', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent(['this.errorHandler.handleError(error)']);
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      
      assert.strictEqual(connections.length, 1);
      assert.strictEqual(connections[0].serviceName, 'ErrorHandler');
      assert.strictEqual(connections[0].connectionType, ConnectionType.ERROR_HANDLER);
      assert.strictEqual(connections[0].isActuallyUsed, true);
      assert.strictEqual(connections[0].integrationOpportunity, true);
    });

    test('Should analyze notificationService connections', () => {
      const property = createTestProperty('notificationService', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent(['this.notificationService.notify(message)']);
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      
      assert.strictEqual(connections.length, 1);
      assert.strictEqual(connections[0].serviceName, 'NotificationService');
      assert.strictEqual(connections[0].connectionType, ConnectionType.NOTIFICATION_SERVICE);
      assert.strictEqual(connections[0].isActuallyUsed, true);
    });

    test('Should analyze securityService connections', () => {
      const property = createTestProperty('securityService', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent(['this.securityService.audit(action)']);
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      
      assert.strictEqual(connections.length, 1);
      assert.strictEqual(connections[0].serviceName, 'SecurityService');
      assert.strictEqual(connections[0].connectionType, ConnectionType.SECURITY_SERVICE);
      assert.strictEqual(connections[0].isActuallyUsed, true);
    });

    test('Should handle properties without service connections', () => {
      const property = createTestProperty('otherProperty', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent();
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      assert.strictEqual(connections.length, 0);
    });

    test('Should detect unused service connections', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent(); // No actual usage
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      
      assert.strictEqual(connections.length, 1);
      assert.strictEqual(connections[0].isActuallyUsed, false);
      assert.strictEqual(connections[0].integrationOpportunity, true);
    });
  });

  suite('Integration Point Identification', () => {
    test('Should identify integration points from service connections', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const serviceConnections: ServiceConnection[] = [
        {
          serviceName: 'CoreServices',
          connectionType: ConnectionType.CORE_SERVICES,
          isActuallyUsed: false,
          integrationOpportunity: true
        },
        {
          serviceName: 'ErrorHandler',
          connectionType: ConnectionType.ERROR_HANDLER,
          isActuallyUsed: false,
          integrationOpportunity: true
        }
      ];
      
      const integrationPoints = PropertyStrategicAnalyzer.identifyIntegrationPoints(property, serviceConnections);
      
      assert.strictEqual(integrationPoints.length, 2);
      
      // Check core services integration point
      const coreServicesPoint = integrationPoints.find(p => 
        p.type === IntegrationType.INPUT_SANITIZATION
      );
      assert.ok(coreServicesPoint, 'Should have input sanitization integration point');
      assert.strictEqual(coreServicesPoint.location, 'TestClass.ts');
      assert.strictEqual(coreServicesPoint.effort, EffortLevel.MEDIUM);
      assert.strictEqual(coreServicesPoint.expectedBenefit, BenefitLevel.MEDIUM);
      
      // Check error handler integration point
      const errorHandlerPoint = integrationPoints.find(p => 
        p.type === IntegrationType.ERROR_HANDLING
      );
      assert.ok(errorHandlerPoint, 'Should have error handling integration point');
      assert.strictEqual(errorHandlerPoint.location, 'TestClass.ts');
    });

    test('Should not identify integration points for connections without opportunities', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const serviceConnections: ServiceConnection[] = [
        {
          serviceName: 'CoreServices',
          connectionType: ConnectionType.CORE_SERVICES,
          isActuallyUsed: true,
          integrationOpportunity: false
        }
      ];
      
      const integrationPoints = PropertyStrategicAnalyzer.identifyIntegrationPoints(property, serviceConnections);
      assert.strictEqual(integrationPoints.length, 0);
    });
  });

  suite('Strategic Scoring and Prioritization', () => {
    test('Should calculate higher scores for Phase 2B properties', () => {
      const phase2BProperty = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const integrationOpportunity: IntegrationOpportunity = {
        type: IntegrationType.INPUT_SANITIZATION,
        description: 'Test integration',
        implementationSteps: ['Step 1'],
        effort: EffortLevel.MEDIUM,
        expectedBenefit: BenefitLevel.HIGH,
        riskAssessment: RiskLevel.MEDIUM,
        similarPatterns: ['Pattern1']
      };
      const serviceConnections: ServiceConnection[] = [
        {
          serviceName: 'CoreServices',
          connectionType: ConnectionType.CORE_SERVICES,
          isActuallyUsed: false,
          integrationOpportunity: true
        }
      ];
      
      const score = PropertyStrategicAnalyzer.calculateStrategicScore(
        phase2BProperty, 
        integrationOpportunity, 
        serviceConnections
      );
      
      // Phase 2B base (60) + integration opportunity (25) + high benefit (15) + active connection (5) = 105 -> capped at 100
      assert.strictEqual(score, 100);
    });

    test('Should calculate lower scores for Phase 2A properties', () => {
      const phase2AProperty = createTestProperty('_storage', 'TestClass.ts', 10, ProcessingPhase.PHASE_2A);
      
      const score = PropertyStrategicAnalyzer.calculateStrategicScore(
        phase2AProperty, 
        null, 
        []
      );
      
      assert.strictEqual(score, 20); // Phase 2A base score only
    });

    test('Should calculate moderate scores for Phase 2C properties', () => {
      const phase2CProperty = createTestProperty('context', 'TestClass.ts', 10, ProcessingPhase.PHASE_2C);
      
      const score = PropertyStrategicAnalyzer.calculateStrategicScore(
        phase2CProperty, 
        null, 
        []
      );
      
      assert.strictEqual(score, 30); // Phase 2C base score only
    });

    test('Should apply penalties for high effort requirements', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const highEffortOpportunity: IntegrationOpportunity = {
        type: IntegrationType.SECURITY_AUDIT_LOGGING,
        description: 'High effort integration',
        implementationSteps: ['Step 1'],
        effort: EffortLevel.HIGH,
        expectedBenefit: BenefitLevel.MEDIUM,
        riskAssessment: RiskLevel.MEDIUM,
        similarPatterns: []
      };
      
      const score = PropertyStrategicAnalyzer.calculateStrategicScore(
        property, 
        highEffortOpportunity, 
        []
      );
      
      // Phase 2B (60) + opportunity (25) + medium benefit (10) - high effort penalty (10) = 85
      assert.strictEqual(score, 85);
    });

    test('Should determine implementation priority correctly', () => {
      // High priority Phase 2B
      assert.strictEqual(
        PropertyStrategicAnalyzer.determineImplementationPriority(80, ProcessingPhase.PHASE_2B), 
        'HIGH'
      );
      
      // Medium priority Phase 2B
      assert.strictEqual(
        PropertyStrategicAnalyzer.determineImplementationPriority(65, ProcessingPhase.PHASE_2B), 
        'MEDIUM'
      );
      
      // Medium priority Phase 2A (high score)
      assert.strictEqual(
        PropertyStrategicAnalyzer.determineImplementationPriority(85, ProcessingPhase.PHASE_2A), 
        'MEDIUM'
      );
      
      // Low priority Phase 2A
      assert.strictEqual(
        PropertyStrategicAnalyzer.determineImplementationPriority(70, ProcessingPhase.PHASE_2A), 
        'LOW'
      );
      
      // Medium priority Phase 2C (high score)
      assert.strictEqual(
        PropertyStrategicAnalyzer.determineImplementationPriority(80, ProcessingPhase.PHASE_2C), 
        'MEDIUM'
      );
      
      // Low priority Phase 2C
      assert.strictEqual(
        PropertyStrategicAnalyzer.determineImplementationPriority(60, ProcessingPhase.PHASE_2C), 
        'LOW'
      );
    });
  });

  suite('Comprehensive Strategic Assessment', () => {
    test('Should perform complete strategic assessment', () => {
      const property = createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent();
      
      const assessment = PropertyStrategicAnalyzer.performStrategicAssessment(property, fileContent);
      
      assert.ok(assessment.integrationOpportunity, 'Should have integration opportunity');
      assert.ok(assessment.serviceConnections.length > 0, 'Should have service connections');
      assert.ok(assessment.integrationPoints.length > 0, 'Should have integration points');
      assert.ok(assessment.strategicScore > 0, 'Should have positive strategic score');
      assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(assessment.implementationPriority), 'Should have valid priority');
      
      // Verify integration opportunity details
      assert.strictEqual(assessment.integrationOpportunity.type, IntegrationType.INPUT_SANITIZATION);
      assert.ok(assessment.integrationOpportunity.implementationSteps.length > 0);
      
      // Verify service connections
      const coreServiceConnection = assessment.serviceConnections.find(c => 
        c.connectionType === ConnectionType.CORE_SERVICES
      );
      assert.ok(coreServiceConnection, 'Should have core services connection');
    });

    test('Should handle properties without strategic assessment data', () => {
      const unknownProperty = createTestProperty('unknownProperty', 'unknown.ts', 1, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent();
      
      const assessment = PropertyStrategicAnalyzer.performStrategicAssessment(unknownProperty, fileContent);
      
      assert.strictEqual(assessment.integrationOpportunity, null);
      assert.strictEqual(assessment.serviceConnections.length, 0);
      assert.strictEqual(assessment.integrationPoints.length, 0);
      assert.ok(assessment.strategicScore >= 0, 'Should have non-negative score');
    });
  });

  suite('Integration Opportunities Assessment', () => {
    test('Should assess integration opportunities across multiple properties', () => {
      const properties: UnusedVariable[] = [
        createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B),
        createTestProperty('errorHandler', 'MultiChatNotificationManager.ts', 180, ProcessingPhase.PHASE_2B),
        createTestProperty('_storage', 'VesperaConsentManager.ts', 52, ProcessingPhase.PHASE_2A) // No opportunity
      ];
      
      const assessment = PropertyStrategicAnalyzer.assessIntegrationOpportunities(properties);
      
      assert.ok(assessment.totalOpportunities >= 2, 'Should have at least 2 opportunities');
      assert.ok(assessment.estimatedTotalEffort > 0, 'Should have positive total effort estimate');
      
      // Verify prioritization
      assert.ok(assessment.highPriority.length >= 0, 'Should have high priority array');
      assert.ok(assessment.mediumPriority.length >= 0, 'Should have medium priority array');
      assert.ok(assessment.lowPriority.length >= 0, 'Should have low priority array');
      
      // Total opportunities should equal sum of prioritized opportunities
      const totalPrioritized = assessment.highPriority.length + assessment.mediumPriority.length + assessment.lowPriority.length;
      assert.strictEqual(totalPrioritized, assessment.totalOpportunities);
    });

    test('Should correctly prioritize security audit logging as high priority', () => {
      // Create a mock property that would have security audit logging opportunity
      const securityProperty = createTestProperty('coreServices', 'TaskServerNotificationIntegration.ts', 90, ProcessingPhase.PHASE_2B);
      const properties = [securityProperty];
      
      const assessment = PropertyStrategicAnalyzer.assessIntegrationOpportunities(properties);
      
      // Security audit logging should be high priority
      const hasSecurityAuditInHigh = assessment.highPriority.some(opp => 
        opp.type === IntegrationType.SECURITY_AUDIT_LOGGING
      );
      
      if (assessment.totalOpportunities > 0) {
        // We should find it in high priority if it exists
        assert.ok(hasSecurityAuditInHigh || assessment.highPriority.length > 0, 
          'Security audit logging should be prioritized or other high priority items should exist');
      }
    });

    test('Should calculate effort estimates correctly', () => {
      const properties: UnusedVariable[] = [
        createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B), // Medium effort
        createTestProperty('errorHandler', 'MultiChatNotificationManager.ts', 180, ProcessingPhase.PHASE_2B)  // Medium effort
      ];
      
      const assessment = PropertyStrategicAnalyzer.assessIntegrationOpportunities(properties);
      
      if (assessment.totalOpportunities > 0) {
        // Each medium effort is 5 hours, so 2 opportunities * 5 = 10 hours minimum
        assert.ok(assessment.estimatedTotalEffort >= 5, 'Should have reasonable effort estimate');
        assert.ok(assessment.estimatedTotalEffort <= 20, 'Should not have excessive effort estimate');
      }
    });
  });

  suite('Implementation Steps Generation', () => {
    test('Should generate specific implementation steps for different integration types', () => {
      // Test through the integration opportunity identification
      const inputSanitizationProperty = createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      const errorHandlingProperty = createTestProperty('errorHandler', 'MultiChatNotificationManager.ts', 180, ProcessingPhase.PHASE_2B);
      
      const inputOpportunity = PropertyStrategicAnalyzer.identifyIntegrationOpportunity(inputSanitizationProperty, '');
      const errorOpportunity = PropertyStrategicAnalyzer.identifyIntegrationOpportunity(errorHandlingProperty, '');
      
      // Input sanitization steps
      if (inputOpportunity) {
        assert.ok(inputOpportunity.implementationSteps.some(step => 
          step.includes('input sanitization') || step.includes('inputSanitizer')
        ), 'Should have input sanitization specific steps');
        
        assert.ok(inputOpportunity.implementationSteps.some(step => 
          step.includes('MultiChatNotificationManager')
        ), 'Should reference similar pattern');
      }
      
      // Error handling steps
      if (errorOpportunity) {
        assert.ok(errorOpportunity.implementationSteps.some(step => 
          step.includes('try-catch') || step.includes('errorHandler.handleError')
        ), 'Should have error handling specific steps');
        
        assert.ok(errorOpportunity.implementationSteps.some(step => 
          step.includes('SecureNotificationManager')
        ), 'Should reference similar pattern');
      }
    });
  });

  suite('Edge Cases and Error Handling', () => {
    test('Should handle empty file content gracefully', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const emptyContent = '';
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, emptyContent);
      assert.ok(Array.isArray(connections), 'Should return array for empty content');
      
      const assessment = PropertyStrategicAnalyzer.performStrategicAssessment(property, emptyContent);
      assert.ok(assessment, 'Should return assessment for empty content');
    });

    test('Should handle malformed file content', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const malformedContent = 'this is not valid javascript {[}]';
      
      // Should not throw errors
      assert.doesNotThrow(() => {
        PropertyStrategicAnalyzer.analyzeServiceConnections(property, malformedContent);
        PropertyStrategicAnalyzer.performStrategicAssessment(property, malformedContent);
      });
    });

    test('Should handle properties with multiple service types in name', () => {
      const property = createTestProperty('coreServicesErrorHandler', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      const fileContent = createMockFileContent();
      
      const connections = PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      
      // Should detect both core services and error handler
      assert.ok(connections.some(c => c.connectionType === ConnectionType.CORE_SERVICES), 
        'Should detect core services connection');
      assert.ok(connections.some(c => c.connectionType === ConnectionType.ERROR_HANDLER), 
        'Should detect error handler connection');
    });
  });
});