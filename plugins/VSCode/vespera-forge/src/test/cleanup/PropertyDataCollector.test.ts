/**
 * PropertyDataCollector Tests
 * 
 * Comprehensive test coverage for the PropertyDataCollector module focusing on:
 * - File content analysis and pattern detection
 * - Usage location identification and categorization
 * - Constructor and runtime usage analysis
 * - False positive detection mechanisms
 * - Code analysis and investigation findings
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
import { 
  PropertyDataCollector,
  UsageType,
  ConstructorUsageDetails,
  RuntimeUsageDetails,
  CompilerIssueType,
  InitializationPattern,
  AccessContext
} from '../../utils/cleanup/PropertyDataCollector';
import { 
  PropertyUsagePattern,
  ConfidenceLevel
} from '../../utils/cleanup/PropertyAnalysisPhases';
import { 
  UnusedVariable,
  ProcessingPhase,
  UnusedVariableType,
  RiskLevel,
  ErrorCategory
} from '../../utils/cleanup/UnusedVariableClassifier';

suite('PropertyDataCollector Tests', () => {

  let originalReadFile: typeof fs.promises.readFile;

  // Test data setup
  const createTestProperty = (
    name: string, 
    file: string, 
    line: number, 
    phase: ProcessingPhase = ProcessingPhase.PHASE_2B
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

  const createMockFileContent = (options: {
    hasConstructor?: boolean;
    constructorAssignment?: string;
    propertyUsages?: string[];
    hasErrorHandling?: boolean;
    hasAsyncCode?: boolean;
    hasReflection?: boolean;
    hasTypeAssertions?: boolean;
  } = {}): string => {
    let content = `
class TestClass {`;

    if (options.hasConstructor) {
      content += `
  constructor(param: any) {
    ${options.constructorAssignment || 'this.testProperty = param;'}
  }`;
    }

    content += `
  
  async performTask() {`;

    if (options.hasErrorHandling) {
      content += `
    try {
      // Some implementation
    } catch (error) {
      this.errorHandler.handleError(error);
    }`;
    }

    if (options.hasAsyncCode) {
      content += `
    await this.asyncOperation();`;
    }

    if (options.propertyUsages) {
      content += '\n    ' + options.propertyUsages.join('\n    ');
    }

    content += `
  }`;

    if (options.hasReflection) {
      content += `
  
  reflectionMethod() {
    return Object.keys(this);
    Reflect.get(this, 'testProperty');
  }`;
    }

    if (options.hasTypeAssertions) {
      content += `
  
  typeAssertionMethod() {
    const value: any = this.testProperty;
    const typedValue: unknown = value;
  }`;
    }

    content += `
}`;

    return content;
  };

  setup(() => {
    originalReadFile = fs.promises.readFile;
  });

  teardown(() => {
    (fs.promises as any).readFile = originalReadFile;
  });

  suite('File Content Analysis', () => {
    test('Should safely read file content', async () => {
      const expectedContent = 'file content';
      (fs.promises as any).readFile = async () => expectedContent;
      
      const content = await PropertyDataCollector.getFileContent('/test/path.ts');
      assert.strictEqual(content, expectedContent);
    });

    test('Should handle file read errors gracefully', async () => {
      (fs.promises as any).readFile = async () => {
        throw new Error('File not found');
      };
      
      const content = await PropertyDataCollector.getFileContent('/nonexistent/path.ts');
      assert.strictEqual(content, '', 'Should return empty string for file read errors');
    });

    test('Should perform comprehensive usage analysis', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasConstructor: true,
        constructorAssignment: 'this.testProperty = param;',
        propertyUsages: ['this.testProperty.method()', 'const value = this.testProperty;'],
        hasErrorHandling: true
      });
      
      const analysis = await PropertyDataCollector.performUsageAnalysis(property, fileContent);
      
      assert.ok(analysis, 'Should return usage analysis');
      assert.ok(analysis.usageLocations.length > 0, 'Should find usage locations');
      assert.ok(analysis.constructorUsage, 'Should analyze constructor usage');
      assert.ok(analysis.runtimeUsage, 'Should analyze runtime usage');
      assert.ok(analysis.accessPatterns, 'Should identify access patterns');
      assert.ok(analysis.dependencyAnalysis, 'Should analyze dependencies');
      assert.ok(Object.values(PropertyUsagePattern).includes(analysis.usagePattern), 'Should determine valid usage pattern');
    });
  });

  suite('Usage Location Detection', () => {
    test('Should find all usage locations in file', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  testProperty: string;
  
  constructor() {
    this.testProperty = 'value';
  }
  
  method() {
    return this.testProperty;
  }
  
  anotherMethod() {
    this.testProperty.toLowerCase();
  }
}`;
      
      const locations = PropertyDataCollector.findAllUsageLocations(property, fileContent);
      
      assert.ok(locations.length >= 3, 'Should find multiple usage locations');
      
      // Verify different usage types are detected
      const declarationUsage = locations.find(l => l.type === UsageType.DECLARATION);
      const assignmentUsage = locations.find(l => l.type === UsageType.ASSIGNMENT);
      const accessUsage = locations.find(l => l.type === UsageType.PROPERTY_ACCESS);
      
      assert.ok(declarationUsage, 'Should detect declaration usage');
      assert.ok(assignmentUsage, 'Should detect assignment usage');
      assert.ok(accessUsage, 'Should detect property access usage');
      
      // Verify confidence levels
      locations.forEach(location => {
        assert.ok(Object.values(ConfidenceLevel).includes(location.confidence), 
          'Should have valid confidence level');
        assert.ok(location.line > 0, 'Should have valid line number');
        assert.ok(location.context.length > 0, 'Should have context');
      });
    });

    test('Should determine usage types correctly', () => {
      assert.strictEqual(PropertyDataCollector.determineUsageType('testProperty:', 'testProperty'), UsageType.DECLARATION);
      assert.strictEqual(PropertyDataCollector.determineUsageType('= testProperty', 'testProperty'), UsageType.ASSIGNMENT);
      assert.strictEqual(PropertyDataCollector.determineUsageType('testProperty =', 'testProperty'), UsageType.ASSIGNMENT);
      assert.strictEqual(PropertyDataCollector.determineUsageType('this.testProperty', 'testProperty'), UsageType.PROPERTY_ACCESS);
      assert.strictEqual(PropertyDataCollector.determineUsageType('testProperty()', 'testProperty'), UsageType.METHOD_CALL);
      assert.strictEqual(PropertyDataCollector.determineUsageType('some testProperty usage', 'testProperty'), UsageType.ACCESS);
    });

    test('Should assess usage confidence correctly', () => {
      assert.strictEqual(PropertyDataCollector.assessUsageConfidence('this.testProperty', 'testProperty'), ConfidenceLevel.HIGH);
      assert.strictEqual(PropertyDataCollector.assessUsageConfidence('testProperty:', 'testProperty'), ConfidenceLevel.HIGH);
      assert.strictEqual(PropertyDataCollector.assessUsageConfidence('testProperty usage', 'testProperty'), ConfidenceLevel.MEDIUM);
      assert.strictEqual(PropertyDataCollector.assessUsageConfidence('some other text', 'testProperty'), ConfidenceLevel.LOW);
    });
  });

  suite('Constructor Usage Analysis', () => {
    test('Should analyze constructor parameter storage pattern', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasConstructor: true,
        constructorAssignment: 'this.testProperty = parameter;'
      });
      
      const constructorUsage = PropertyDataCollector.analyzeConstructorUsage(property, fileContent);
      
      assert.strictEqual(constructorUsage.isAssignedInConstructor, true, 'Should detect constructor assignment');
      assert.ok(constructorUsage.constructorLine !== null, 'Should find constructor line');
      assert.strictEqual(constructorUsage.parameterSource, 'parameter', 'Should extract parameter source');
      assert.strictEqual(constructorUsage.initializationPattern, InitializationPattern.PARAMETER_STORAGE, 'Should identify parameter storage pattern');
    });

    test('Should analyze constructor initialization pattern', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasConstructor: true,
        constructorAssignment: 'this.testProperty = initializeService();'
      });
      
      const constructorUsage = PropertyDataCollector.analyzeConstructorUsage(property, fileContent);
      
      assert.strictEqual(constructorUsage.isAssignedInConstructor, true);
      assert.strictEqual(constructorUsage.usedForInitialization, true);
      assert.strictEqual(constructorUsage.initializationPattern, InitializationPattern.DERIVED_VALUE);
    });

    test('Should handle missing constructor', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasConstructor: false });
      
      const constructorUsage = PropertyDataCollector.analyzeConstructorUsage(property, fileContent);
      
      assert.strictEqual(constructorUsage.isAssignedInConstructor, false);
      assert.strictEqual(constructorUsage.constructorLine, null);
      assert.strictEqual(constructorUsage.parameterSource, null);
    });

    test('Should extract parameter source correctly', () => {
      assert.strictEqual(PropertyDataCollector.extractParameterSource('this.prop = param'), 'param');
      assert.strictEqual(PropertyDataCollector.extractParameterSource('this.prop = someVariable'), 'someVariable');
      assert.strictEqual(PropertyDataCollector.extractParameterSource('this.prop = 123'), '123');
      assert.strictEqual(PropertyDataCollector.extractParameterSource('this.prop = '), null);
    });

    test('Should determine initialization patterns correctly', () => {
      assert.strictEqual(PropertyDataCollector.determineInitializationPattern(null, false), InitializationPattern.CONSTANT_ASSIGNMENT);
      assert.strictEqual(PropertyDataCollector.determineInitializationPattern('param', true), InitializationPattern.DERIVED_VALUE);
      assert.strictEqual(PropertyDataCollector.determineInitializationPattern('param', false), InitializationPattern.PARAMETER_STORAGE);
    });
  });

  suite('Runtime Usage Analysis', () => {
    test('Should analyze runtime property access patterns', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasConstructor: true,
        propertyUsages: [
          'this.testProperty.method()',
          'const value = this.testProperty;',
          'this.testProperty.length'
        ]
      });
      
      const runtimeUsage = PropertyDataCollector.analyzeRuntimeUsage(property, fileContent);
      
      assert.ok(runtimeUsage.accessCount >= 3, 'Should count property accesses');
      assert.ok(runtimeUsage.usageContexts.length >= 3, 'Should capture usage contexts');
      assert.strictEqual(runtimeUsage.potentialFalsePositive, true, 'Should detect potential false positive when usage found');
    });

    test('Should detect no runtime usage', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasConstructor: true,
        constructorAssignment: 'this.testProperty = param;'
        // No runtime usage
      });
      
      const runtimeUsage = PropertyDataCollector.analyzeRuntimeUsage(property, fileContent);
      
      assert.strictEqual(runtimeUsage.accessCount, 1, 'Should only count constructor assignment'); // Constructor assignment counts
      assert.strictEqual(runtimeUsage.potentialFalsePositive, true, 'Constructor usage still indicates potential false positive');
    });

    test('Should identify access methods', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  getValue() {
    return this.testProperty;
  }
  
  setValue() {
    this.testProperty = 'value';
  }
  
  processData() {
    this.testProperty.process();
  }
}`;
      
      const runtimeUsage = PropertyDataCollector.analyzeRuntimeUsage(property, fileContent);
      
      assert.ok(runtimeUsage.accessMethods.includes('getValue'), 'Should identify getValue method');
      assert.ok(runtimeUsage.accessMethods.includes('setValue'), 'Should identify setValue method');
      assert.ok(runtimeUsage.accessMethods.includes('processData'), 'Should identify processData method');
    });

    test('Should detect dead code usage', () => {
      const deadCodeContexts = [
        '// TODO: implement this.testProperty',
        '/* TODO: use this.testProperty */',
        'if (false) { this.testProperty }',
        'if (0) { this.testProperty }'
      ];
      
      assert.strictEqual(PropertyDataCollector.isOnlyInDeadCode(deadCodeContexts), true, 'Should detect dead code usage');
      
      const liveCodeContexts = [
        'this.testProperty.method()',
        'return this.testProperty;'
      ];
      
      assert.strictEqual(PropertyDataCollector.isOnlyInDeadCode(liveCodeContexts), false, 'Should detect live code usage');
    });
  });

  suite('Access Pattern Identification', () => {
    test('Should identify common access patterns', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  method1() {
    this.testProperty.getValue();
    this.testProperty.getValue();
  }
  
  method2() {
    this.testProperty.handleError();
  }
}`;
      
      const accessPatterns = PropertyDataCollector.identifyAccessPatterns(property, fileContent);
      
      assert.ok(accessPatterns.length > 0, 'Should identify access patterns');
      
      const propertyAccessPattern = accessPatterns.find(p => p.pattern.includes('this.testProperty.'));
      assert.ok(propertyAccessPattern, 'Should identify property access pattern');
      assert.ok(propertyAccessPattern.frequency > 0, 'Should count pattern frequency');
      assert.ok(propertyAccessPattern.context === AccessContext.METHOD_BODY, 'Should identify correct context');
      assert.ok(Object.values(RiskLevel).includes(propertyAccessPattern.riskAssessment), 'Should assess risk level');
    });

    test('Should handle patterns with no matches', () => {
      const property = createTestProperty('nonExistentProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        propertyUsages: ['this.testProperty.method()']
      });
      
      const accessPatterns = PropertyDataCollector.identifyAccessPatterns(property, fileContent);
      
      // Should return empty array or patterns with 0 frequency - either is acceptable
      if (accessPatterns.length > 0) {
        accessPatterns.forEach(pattern => {
          assert.strictEqual(pattern.frequency, 0, 'Should have 0 frequency for non-matching patterns');
        });
      }
    });
  });

  suite('False Positive Detection', () => {
    test('Should detect status-bar context false positive', () => {
      const contextProperty = createTestProperty('context', 'status-bar.ts', 23);
      const fileContent = `
// Line 58 context usage
class StatusBar {
  method() {
    // Some usage of context on line 58
    this.context.something();
  }
}`;
      
      const isPotentialFalsePositive = PropertyDataCollector.detectPotentialFalsePositive(contextProperty, fileContent);
      assert.strictEqual(isPotentialFalsePositive, true, 'Should detect status-bar context false positive');
    });

    test('Should detect dynamic access patterns', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  dynamicAccess() {
    this['testProperty'] = value;
    this["testProperty"] = value;
    const prop = [testProperty];
    const prop2 = ["testProperty"];
  }
}`;
      
      const isPotentialFalsePositive = PropertyDataCollector.detectPotentialFalsePositive(property, fileContent);
      assert.strictEqual(isPotentialFalsePositive, true, 'Should detect dynamic access patterns');
    });

    test('Should identify false positive reasons', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasReflection: true,
        hasAsyncCode: true,
        propertyUsages: ['this["testProperty"] = value;']
      });
      
      const reasons = PropertyDataCollector.identifyFalsePositiveReasons(property, fileContent);
      
      assert.ok(reasons.includes('Dynamic property access patterns detected'), 'Should detect dynamic access');
      assert.ok(reasons.includes('Reflection-based access possible'), 'Should detect reflection usage');
      assert.ok(reasons.includes('Async usage patterns may not be detected by TypeScript compiler'), 'Should detect async patterns');
    });
  });

  suite('Compiler Issue Detection', () => {
    test('Should detect type analysis limitations', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasTypeAssertions: true,
        propertyUsages: ['const value: any = this.testProperty;', 'const unknown: unknown = value;']
      });
      
      const issues = PropertyDataCollector.detectCompilerIssues(property, fileContent);
      
      const typeAnalysisIssue = issues.find(i => i.type === CompilerIssueType.TYPE_ANALYSIS_LIMITATION);
      assert.ok(typeAnalysisIssue, 'Should detect type analysis limitation');
      assert.ok(typeAnalysisIssue.possibleSolutions.length > 0, 'Should provide possible solutions');
    });

    test('Should detect dynamic access detection issues', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  dynamicMethod() {
    this['testProperty'] = value;
  }
}`;
      
      const issues = PropertyDataCollector.detectCompilerIssues(property, fileContent);
      
      const dynamicAccessIssue = issues.find(i => i.type === CompilerIssueType.DYNAMIC_ACCESS_DETECTION);
      assert.ok(dynamicAccessIssue, 'Should detect dynamic access detection issue');
    });

    test('Should detect dynamic code execution limitations', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  method() {
    eval('this.testProperty = value');
    const fn = new Function('return this.testProperty');
  }
}`;
      
      const issues = PropertyDataCollector.detectCompilerIssues(property, fileContent);
      
      const dynamicIssue = issues.find(i => i.type === CompilerIssueType.DYNAMIC_ACCESS_DETECTION);
      assert.ok(dynamicIssue, 'Should detect dynamic code execution issue');
      if (dynamicIssue) {
        assert.ok(dynamicIssue.possibleSolutions.includes('Avoid dynamic code execution'), 'Should suggest avoiding dynamic execution');
      }
    });
  });

  suite('Investigation Workflow', () => {
    test('Should conduct comprehensive investigation', async () => {
      const property = createTestProperty('context', 'status-bar.ts', 23, ProcessingPhase.PHASE_2C);
      const fileContent = createMockFileContent({
        hasReflection: true,
        hasAsyncCode: true,
        propertyUsages: ['// Line 58 usage', 'this.context.getValue()']
      });
      
      const findings = await PropertyDataCollector.conductInvestigation(property, fileContent);
      
      assert.ok(typeof findings.isPotentialFalsePositive === 'boolean', 'Should determine false positive status');
      assert.ok(Array.isArray(findings.falsePositiveReasons), 'Should provide false positive reasons');
      assert.ok(Array.isArray(findings.compilerIssues), 'Should identify compiler issues');
      assert.ok(findings.codeAnalysisFindings, 'Should provide code analysis findings');
      assert.ok(Array.isArray(findings.recommendedInvestigationSteps), 'Should provide investigation steps');
      
      // Verify investigation steps are relevant
      assert.ok(findings.recommendedInvestigationSteps.some(step => 
        step.includes(property.file) && step.includes(property.line.toString())
      ), 'Should include file-specific investigation steps');
      
      if (property.phase === ProcessingPhase.PHASE_2C) {
        assert.ok(findings.recommendedInvestigationSteps.some(step => 
          step.includes('incomplete feature') || step.includes('architectural necessity')
        ), 'Should include Phase 2C-specific investigation steps');
      }
    });

    test('Should generate appropriate investigation steps', () => {
      const phase2CProperty = createTestProperty('_context', 'index.ts', 121, ProcessingPhase.PHASE_2C);
      const phase2BProperty = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      
      const phase2CSteps = PropertyDataCollector.generateInvestigationSteps(phase2CProperty);
      const phase2BSteps = PropertyDataCollector.generateInvestigationSteps(phase2BProperty);
      
      // Common steps
      assert.ok(phase2CSteps.includes('Examine index.ts around line 121 for actual usage'), 'Should include file examination step');
      assert.ok(phase2CSteps.includes('Search for dynamic property access patterns'), 'Should include dynamic access search');
      
      // Phase 2C specific steps
      assert.ok(phase2CSteps.some(step => step.includes('incomplete feature')), 'Should include incomplete feature investigation for Phase 2C');
      assert.ok(phase2CSteps.some(step => step.includes('architectural necessity')), 'Should include architectural evaluation for Phase 2C');
      
      // Phase 2B should not have these specific steps
      assert.ok(!phase2BSteps.some(step => step.includes('incomplete feature')), 'Phase 2B should not have incomplete feature steps');
    });
  });

  suite('Usage Pattern Determination', () => {
    test('Should determine constructor-only pattern', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10, ProcessingPhase.PHASE_2A);
      
      const constructorUsage: ConstructorUsageDetails = {
        isAssignedInConstructor: true,
        constructorLine: 5,
        parameterSource: 'param',
        usedForInitialization: false,
        accessedAfterAssignment: false,
        initializationPattern: InitializationPattern.PARAMETER_STORAGE
      };
      
      const runtimeUsage: RuntimeUsageDetails = {
        accessCount: 0,
        accessMethods: [],
        usageContexts: [],
        isOnlyInDeadCode: false,
        potentialFalsePositive: false
      };
      
      const pattern = PropertyDataCollector.determineUsagePattern(property, constructorUsage, runtimeUsage);
      assert.strictEqual(pattern, PropertyUsagePattern.CONSTRUCTOR_ONLY);
    });

    test('Should determine service integration gap pattern', () => {
      const property = createTestProperty('coreServices', 'TestClass.ts', 10, ProcessingPhase.PHASE_2B);
      
      const constructorUsage: ConstructorUsageDetails = {
        isAssignedInConstructor: true,
        constructorLine: 5,
        parameterSource: 'services',
        usedForInitialization: false,
        accessedAfterAssignment: false,
        initializationPattern: InitializationPattern.PARAMETER_STORAGE
      };
      
      const runtimeUsage: RuntimeUsageDetails = {
        accessCount: 1,
        accessMethods: [],
        usageContexts: ['this.coreServices = services;'],
        isOnlyInDeadCode: false,
        potentialFalsePositive: true
      };
      
      const pattern = PropertyDataCollector.determineUsagePattern(property, constructorUsage, runtimeUsage);
      assert.strictEqual(pattern, PropertyUsagePattern.SERVICE_INTEGRATION_GAP);
    });

    test('Should determine false positive pattern', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10, ProcessingPhase.PHASE_2C);
      
      const constructorUsage: ConstructorUsageDetails = {
        isAssignedInConstructor: false,
        constructorLine: null,
        parameterSource: null,
        usedForInitialization: false,
        accessedAfterAssignment: false,
        initializationPattern: InitializationPattern.CONSTANT_ASSIGNMENT
      };
      
      const runtimeUsage: RuntimeUsageDetails = {
        accessCount: 2,
        accessMethods: ['getValue'],
        usageContexts: ['this.testProperty.getValue()'],
        isOnlyInDeadCode: false,
        potentialFalsePositive: true
      };
      
      const pattern = PropertyDataCollector.determineUsagePattern(property, constructorUsage, runtimeUsage);
      assert.strictEqual(pattern, PropertyUsagePattern.FALSE_POSITIVE);
    });
  });

  suite('Edge Cases and Error Handling', () => {
    test('Should handle empty file content', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const emptyContent = '';
      
      const analysis = await PropertyDataCollector.performUsageAnalysis(property, emptyContent);
      assert.ok(analysis, 'Should handle empty file content');
      assert.strictEqual(analysis.usageLocations.length, 0, 'Should find no usage locations in empty content');
    });

    test('Should handle malformed file content', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const malformedContent = 'this is not valid code {[}]';
      
      // Should not throw errors
      assert.doesNotThrow(() => {
        PropertyDataCollector.findAllUsageLocations(property, malformedContent);
        PropertyDataCollector.analyzeConstructorUsage(property, malformedContent);
        PropertyDataCollector.analyzeRuntimeUsage(property, malformedContent);
      });
    });

    test('Should handle properties with special characters', () => {
      const property = createTestProperty('_private$Property', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasConstructor: true,
        constructorAssignment: 'this._private$Property = value;',
        propertyUsages: ['this._private$Property.method()']
      });
      
      const locations = PropertyDataCollector.findAllUsageLocations(property, fileContent);
      assert.ok(locations.length > 0, 'Should handle properties with special characters');
    });

    test('Should handle very long file content', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      
      // Create a large file content (simulate performance test)
      const largeContent = createMockFileContent({
        hasConstructor: true,
        propertyUsages: Array(1000).fill('this.testProperty.method();')
      });
      
      const startTime = Date.now();
      const analysis = await PropertyDataCollector.performUsageAnalysis(property, largeContent);
      const endTime = Date.now();
      
      assert.ok(analysis, 'Should handle large file content');
      assert.ok(endTime - startTime < 5000, 'Should complete analysis within reasonable time (5s)');
    });
  });
});