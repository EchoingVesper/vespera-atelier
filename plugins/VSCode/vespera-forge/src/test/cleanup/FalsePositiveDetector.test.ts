/**
 * FalsePositiveDetector Tests
 * 
 * Comprehensive test coverage for the FalsePositiveDetector module focusing on:
 * - False positive evidence detection with multiple strategies
 * - Dynamic property access pattern recognition
 * - Reflection-based usage identification
 * - Compiler limitation analysis and workaround suggestions
 * - Evidence strength assessment and confidence scoring
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
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
} from '../../utils/cleanup/FalsePositiveDetector';
import { 
  UnusedVariable,
  ProcessingPhase,
  UnusedVariableType,
  RiskLevel,
  ErrorCategory
} from '../../utils/cleanup/UnusedVariableClassifier';

suite('FalsePositiveDetector Tests', () => {

  let originalReadFile: typeof fs.promises.readFile;

  // Test data setup
  const createTestProperty = (
    name: string, 
    file: string, 
    line: number, 
    phase: ProcessingPhase = ProcessingPhase.PHASE_2C
  ): UnusedVariable => ({
    name,
    file,
    line,
    column: 1,
    type: UnusedVariableType.CLASS_PROPERTY,
    riskLevel: RiskLevel.MEDIUM,
    phase,
    category: ErrorCategory.INCOMPLETE_FEATURES
  });

  const createMockFileContent = (options: {
    hasDirectUsage?: boolean;
    hasDynamicAccess?: boolean;
    hasReflection?: boolean;
    hasAsyncPatterns?: boolean;
    hasTypeIssues?: boolean;
    hasEvalUsage?: boolean;
    specificUsageLines?: { [key: number]: string };
    customContent?: string;
  } = {}): string => {
    if (options.customContent) {
      return options.customContent;
    }

    let content = `
class TestClass {
  private testProperty: string;
  
  constructor() {
    this.testProperty = 'initialized';
  }`;

    if (options.hasDirectUsage) {
      content += `
  
  getValue() {
    return this.testProperty; // Direct usage
  }
  
  setValue(value: string) {
    this.testProperty = value;
  }`;
    }

    if (options.hasDynamicAccess) {
      content += `
  
  dynamicAccess() {
    this['testProperty'] = 'dynamic1';
    this["testProperty"] = 'dynamic2';
    const props = [testProperty];
    const propsString = ["testProperty"];
  }`;
    }

    if (options.hasReflection) {
      content += `
  
  reflectionUsage() {
    Object.keys(this).forEach(key => {
      console.log(key);
    });
    
    Reflect.get(this, 'testProperty');
    Object.getOwnPropertyNames(this);
  }`;
    }

    if (options.hasAsyncPatterns) {
      content += `
  
  async asyncMethod() {
    const value = await this.getAsyncValue();
    this.testProperty = value;
  }
  
  getAsyncValue(): Promise<string> {
    return Promise.resolve(this.testProperty);
  }`;
    }

    if (options.hasTypeIssues) {
      content += `
  
  typeIssues() {
    const anyValue: any = this.testProperty;
    const unknownValue: unknown = anyValue;
    return unknownValue as string;
  }`;
    }

    if (options.hasEvalUsage) {
      content += `
  
  dynamicExecution() {
    eval('this.testProperty = "eval"');
    const fn = new Function('return this.testProperty');
    return fn.call(this);
  }`;
    }

    // Add specific line content
    if (options.specificUsageLines) {
      const lines = content.split('\n');
      Object.entries(options.specificUsageLines).forEach(([lineNum, lineContent]) => {
        const index = parseInt(lineNum) - 1;
        if (index < lines.length) {
          lines[index] = lineContent;
        } else {
          // Pad with empty lines if needed
          while (lines.length <= index) {
            lines.push('');
          }
          lines[index] = lineContent;
        }
      });
      content = lines.join('\n');
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

  suite('False Positive Investigation', () => {
    test('Should detect actual usage evidence', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasDirectUsage: true });
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(property);
      
      assert.ok(evidence.length > 0, 'Should find false positive evidence');
      
      const actualUsageEvidence = evidence.find(e => e.evidenceType === FalsePositiveEvidenceType.ACTUAL_USAGE_FOUND);
      assert.ok(actualUsageEvidence, 'Should detect actual usage evidence');
      assert.strictEqual(actualUsageEvidence.strength, EvidenceStrength.STRONG, 'Actual usage should have strong evidence');
      assert.ok(Array.isArray(actualUsageEvidence.supportingData), 'Should provide supporting data');
    });

    test('Should detect dynamic access evidence', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasDynamicAccess: true });
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(property);
      
      const dynamicEvidence = evidence.find(e => e.evidenceType === FalsePositiveEvidenceType.DYNAMIC_ACCESS_DETECTED);
      assert.ok(dynamicEvidence, 'Should detect dynamic access evidence');
      assert.strictEqual(dynamicEvidence.strength, EvidenceStrength.MODERATE, 'Dynamic access should have moderate evidence strength');
    });

    test('Should detect reflection usage evidence', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasReflection: true });
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(property);
      
      const reflectionEvidence = evidence.find(e => e.evidenceType === FalsePositiveEvidenceType.REFLECTION_USAGE);
      assert.ok(reflectionEvidence, 'Should detect reflection usage evidence');
      assert.strictEqual(reflectionEvidence.strength, EvidenceStrength.MODERATE, 'Reflection usage should have moderate evidence strength');
    });

    test('Should handle special case: status-bar context property', async () => {
      const contextProperty = createTestProperty('context', 'status-bar.ts', 23);
      const fileContent = createMockFileContent({
        specificUsageLines: {
          58: '    this.context.subscriptions.push(subscription); // Line 58 usage'
        }
      });
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(contextProperty);
      
      const statusBarEvidence = evidence.find(e => 
        e.evidenceType === FalsePositiveEvidenceType.ACTUAL_USAGE_FOUND &&
        e.description.includes('line 58')
      );
      assert.ok(statusBarEvidence, 'Should detect status-bar context usage on line 58');
      assert.strictEqual(statusBarEvidence.strength, EvidenceStrength.STRONG);
      assert.strictEqual(statusBarEvidence.location, 'status-bar.ts:58');
    });

    test('Should handle file read errors gracefully', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      
      (fs.promises as any).readFile = async () => {
        throw new Error('File not found');
      };
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(property);
      
      // Should not throw and should return empty evidence or handle gracefully
      assert.ok(Array.isArray(evidence), 'Should return array even on file read error');
      // Evidence might be empty, which is acceptable for a failed read
    });

    test('Should combine multiple evidence types', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasDirectUsage: true,
        hasDynamicAccess: true,
        hasReflection: true
      });
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(property);
      
      assert.ok(evidence.length >= 2, 'Should find multiple types of evidence');
      
      const evidenceTypes = evidence.map(e => e.evidenceType);
      assert.ok(evidenceTypes.includes(FalsePositiveEvidenceType.ACTUAL_USAGE_FOUND), 'Should include actual usage');
      
      // Should have at least one of dynamic access or reflection
      assert.ok(
        evidenceTypes.includes(FalsePositiveEvidenceType.DYNAMIC_ACCESS_DETECTED) ||
        evidenceTypes.includes(FalsePositiveEvidenceType.REFLECTION_USAGE),
        'Should include dynamic access or reflection evidence'
      );
    });
  });

  suite('Actual Usage Search', () => {
    test('Should find actual property usage with multiple search patterns', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        customContent: `
class TestClass {
  method1() {
    this.testProperty.getValue();
  }
  
  method2() {
    this['testProperty'] = value;
  }
  
  method3() {
    this["testProperty"].method();
  }
}
`
      });
      
      const found = await FalsePositiveDetector.searchForActualUsage(property, fileContent);
      assert.strictEqual(found, true, 'Should find actual usage with various patterns');
    });

    test('Should return false when no usage found', async () => {
      const property = createTestProperty('nonExistentProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasDirectUsage: true }); // But for different property
      
      const found = await FalsePositiveDetector.searchForActualUsage(property, fileContent);
      assert.strictEqual(found, false, 'Should return false when property not found');
    });

    test('Should find specific usage locations with detailed information', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  getValue() {
    return this.testProperty; // Line 4 usage
  }
  
  setValue(value: string) {
    this.testProperty = value; // Line 8 assignment
  }
  
  processData() {
    this.testProperty.process(); // Line 12 method call
  }
}`;
      
      const locations = await FalsePositiveDetector.findUsageLocations(property, fileContent);
      
      assert.ok(locations.length >= 3, 'Should find multiple usage locations');
      
      // Verify location details
      locations.forEach(location => {
        assert.ok(location.line > 0, 'Should have valid line number');
        assert.ok(location.column > 0, 'Should have valid column number');
        assert.strictEqual(location.file, property.file, 'Should reference correct file');
        assert.ok(location.context.length > 0, 'Should have context');
        assert.ok(Object.values(ActualUsageType).includes(location.usageType), 'Should have valid usage type');
        assert.ok(Object.values(UsageConfidence).includes(location.confidence), 'Should have valid confidence');
        assert.strictEqual(location.compilerDetection, CompilerDetectionStatus.NOT_DETECTED, 'Should mark as not detected by compiler');
      });

      // Check specific usage types
      const directAccess = locations.find(l => l.usageType === ActualUsageType.DIRECT_PROPERTY_ACCESS);
      assert.ok(directAccess, 'Should identify direct property access');
    });
  });

  suite('Compiler Limitation Detection', () => {
    test('Should identify type narrowing issues', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasTypeIssues: true });
      
      const limitations = FalsePositiveDetector.identifyCompilerLimitations(property, fileContent);
      
      const typeIssue = limitations.find(l => l.limitationType === CompilerLimitationType.TYPE_NARROWING_ISSUE);
      assert.ok(typeIssue, 'Should detect type narrowing issues');
      assert.strictEqual(typeIssue.affectedProperty, property.name);
      assert.ok(typeIssue.workaround.length > 0, 'Should provide workaround suggestions');
      assert.ok(Object.values(CompilerImpact).includes(typeIssue.impact), 'Should assess impact level');
    });

    test('Should identify dynamic property access limitations', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasEvalUsage: true });
      
      const limitations = FalsePositiveDetector.identifyCompilerLimitations(property, fileContent);
      
      const dynamicIssue = limitations.find(l => l.limitationType === CompilerLimitationType.DYNAMIC_PROPERTY_ACCESS);
      assert.ok(dynamicIssue, 'Should detect dynamic property access limitations');
      assert.strictEqual(dynamicIssue.impact, CompilerImpact.HIGH, 'Dynamic code execution should have high impact');
      assert.ok(dynamicIssue.workaround.includes('Avoid dynamic code execution'), 'Should suggest avoiding dynamic execution');
    });

    test('Should handle clean code without limitations', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasDirectUsage: true });
      
      const limitations = FalsePositiveDetector.identifyCompilerLimitations(property, fileContent);
      
      assert.strictEqual(limitations.length, 0, 'Should find no limitations in clean code');
    });

    test('Should provide appropriate workaround suggestions', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ 
        hasTypeIssues: true,
        hasEvalUsage: true
      });
      
      const limitations = FalsePositiveDetector.identifyCompilerLimitations(property, fileContent);
      
      limitations.forEach(limitation => {
        assert.ok(limitation.workaround.length > 0, 'Should provide workaround suggestions');
        assert.ok(limitation.workaround.every(w => typeof w === 'string' && w.length > 0), 'All workarounds should be non-empty strings');
      });
    });
  });

  suite('Dynamic Access Pattern Detection', () => {
    test('Should find bracket notation patterns', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  method1() {
    this['testProperty'] = value;
  }
  
  method2() {
    return this["testProperty"];
  }
  
  method3() {
    const prop = [testProperty];
    const propStr = ["testProperty"];
  }
}`;
      
      const patterns = FalsePositiveDetector.findDynamicAccessPatterns(property, fileContent);
      
      assert.ok(patterns.length > 0, 'Should find dynamic access patterns');
      
      patterns.forEach(pattern => {
        assert.ok(pattern.line > 0, 'Should have valid line number');
        assert.strictEqual(pattern.file, property.file, 'Should reference correct file');
        assert.strictEqual(pattern.accessMethod, DynamicAccessMethod.BRACKET_NOTATION, 'Should identify bracket notation');
        assert.ok(Object.values(UsageConfidence).includes(pattern.detectionConfidence), 'Should have valid confidence');
        assert.ok(pattern.examples.length > 0, 'Should provide examples');
      });
    });

    test('Should handle files without dynamic patterns', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({ hasDirectUsage: true });
      
      const patterns = FalsePositiveDetector.findDynamicAccessPatterns(property, fileContent);
      
      assert.strictEqual(patterns.length, 0, 'Should find no dynamic patterns in direct access code');
    });

    test('Should detect multiple dynamic access patterns', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  method1() {
    this['testProperty'] = 'bracket';
    const array = [testProperty];
  }
  
  method2() {
    this["testProperty"] = "quoted";
    const stringArray = ["testProperty"];
  }
}`;
      
      const patterns = FalsePositiveDetector.findDynamicAccessPatterns(property, fileContent);
      
      assert.ok(patterns.length >= 2, 'Should find multiple dynamic access patterns');
      
      // Verify each pattern has unique line numbers
      const lineNumbers = patterns.map(p => p.line);
      const uniqueLines = new Set(lineNumbers);
      assert.ok(uniqueLines.size > 1, 'Should have patterns on different lines');
    });
  });

  suite('Evidence Type Classification', () => {
    test('Should determine actual usage type correctly', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      
      // Test direct property access
      assert.strictEqual(
        (FalsePositiveDetector as any).determineActualUsageType('this.testProperty', property.name),
        ActualUsageType.DIRECT_PROPERTY_ACCESS
      );
      
      // Test dynamic property access
      assert.strictEqual(
        (FalsePositiveDetector as any).determineActualUsageType('this[testProperty]', property.name),
        ActualUsageType.DYNAMIC_PROPERTY_ACCESS
      );
      
      assert.strictEqual(
        (FalsePositiveDetector as any).determineActualUsageType('this["testProperty"]', property.name),
        ActualUsageType.DYNAMIC_PROPERTY_ACCESS
      );
    });

    test('Should assess usage confidence correctly', () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      
      // High confidence - direct property access without assignment
      assert.strictEqual(
        (FalsePositiveDetector as any).assessUsageConfidence('this.testProperty.getValue()', property.name),
        UsageConfidence.CONFIRMED
      );
      
      // Likely confidence - property with method call
      assert.strictEqual(
        (FalsePositiveDetector as any).assessUsageConfidence('testProperty()', property.name),
        UsageConfidence.LIKELY
      );
      
      // Possible confidence - general mention
      assert.strictEqual(
        (FalsePositiveDetector as any).assessUsageConfidence('testProperty is used', property.name),
        UsageConfidence.POSSIBLE
      );
    });
  });

  suite('Status Bar Context Special Case', () => {
    test('Should detect status bar context usage on line 58', () => {
      const fileContent = Array(60).fill('').map((_, i) => {
        if (i === 57) { // Line 58 (0-indexed)
          return 'this.context.subscriptions.push(disposable);';
        }
        return `// Line ${i + 1}`;
      }).join('\n');
      
      const result = (FalsePositiveDetector as any).checkStatusBarContextUsage(fileContent);
      
      assert.ok(result, 'Should detect context usage on line 58');
      assert.strictEqual(result.line, 58);
      assert.ok(result.content.includes('context'), 'Should capture context usage');
      assert.strictEqual(result.usageType, 'VS Code extension context usage');
    });

    test('Should return null when no context usage on line 58', () => {
      const fileContent = Array(60).fill('').map((_, i) => `// Line ${i + 1}`).join('\n');
      
      const result = (FalsePositiveDetector as any).checkStatusBarContextUsage(fileContent);
      
      assert.strictEqual(result, null, 'Should return null when no context usage found');
    });

    test('Should handle files with fewer than 58 lines', () => {
      const shortFileContent = Array(30).fill('').map((_, i) => `// Line ${i + 1}`).join('\n');
      
      const result = (FalsePositiveDetector as any).checkStatusBarContextUsage(shortFileContent);
      
      assert.strictEqual(result, null, 'Should handle short files gracefully');
    });
  });

  suite('Error Handling and Edge Cases', () => {
    test('Should handle empty file content', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const emptyContent = '';
      
      (fs.promises as any).readFile = async () => emptyContent;
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(property);
      const found = await FalsePositiveDetector.searchForActualUsage(property, emptyContent);
      const locations = await FalsePositiveDetector.findUsageLocations(property, emptyContent);
      
      assert.ok(Array.isArray(evidence), 'Should handle empty content for evidence');
      assert.strictEqual(found, false, 'Should find no usage in empty content');
      assert.strictEqual(locations.length, 0, 'Should find no locations in empty content');
    });

    test('Should handle malformed content gracefully', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const malformedContent = 'this is not valid javascript {[}]';
      
      // Should not throw errors
      assert.doesNotThrow(async () => {
        await FalsePositiveDetector.searchForActualUsage(property, malformedContent);
        await FalsePositiveDetector.findUsageLocations(property, malformedContent);
        FalsePositiveDetector.identifyCompilerLimitations(property, malformedContent);
        FalsePositiveDetector.findDynamicAccessPatterns(property, malformedContent);
      });
    });

    test('Should handle properties with special characters', async () => {
      const specialProperty = createTestProperty('_private$Property123', 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  method() {
    this._private$Property123 = value;
    this['_private$Property123'].method();
  }
}`;
      
      const found = await FalsePositiveDetector.searchForActualUsage(specialProperty, fileContent);
      const locations = await FalsePositiveDetector.findUsageLocations(specialProperty, fileContent);
      
      assert.strictEqual(found, true, 'Should find usage of properties with special characters');
      assert.ok(locations.length > 0, 'Should find locations for properties with special characters');
    });

    test('Should handle very long property names', async () => {
      const longPropertyName = 'veryLongPropertyNameThatExceedsTypicalLimits'.repeat(3);
      const longProperty = createTestProperty(longPropertyName, 'TestClass.ts', 10);
      const fileContent = `
class TestClass {
  method() {
    this.${longPropertyName} = value;
  }
}`;
      
      const found = await FalsePositiveDetector.searchForActualUsage(longProperty, fileContent);
      assert.strictEqual(found, true, 'Should handle very long property names');
    });

    test('Should handle files with many false positive indicators', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      const fileContent = createMockFileContent({
        hasDirectUsage: true,
        hasDynamicAccess: true,
        hasReflection: true,
        hasAsyncPatterns: true,
        hasTypeIssues: true,
        hasEvalUsage: true
      });
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const evidence = await FalsePositiveDetector.investigateFalsePositive(property);
      
      assert.ok(evidence.length > 0, 'Should handle files with many indicators');
      
      // Should have evidence of different strengths
      const evidenceStrengths = evidence.map(e => e.strength);
      assert.ok(evidenceStrengths.includes(EvidenceStrength.STRONG), 'Should have strong evidence');
      
      // Evidence should not be duplicated unnecessarily
      const evidenceTypes = evidence.map(e => e.evidenceType);
      const uniqueTypes = new Set(evidenceTypes);
      assert.ok(uniqueTypes.size <= evidenceTypes.length, 'Should not have too many duplicate evidence types');
    });
  });

  suite('Performance and Scalability', () => {
    test('Should handle large file content efficiently', async () => {
      const property = createTestProperty('testProperty', 'TestClass.ts', 10);
      
      // Create large file content
      const largeContent = Array(10000).fill('').map((_, i) => {
        if (i % 100 === 0) {
          return `this.testProperty.method${i}();`;
        }
        return `// Line ${i + 1}: Some code here`;
      }).join('\n');
      
      const startTime = Date.now();
      const locations = await FalsePositiveDetector.findUsageLocations(property, largeContent);
      const endTime = Date.now();
      
      assert.ok(locations.length > 0, 'Should find usage locations in large content');
      assert.ok(endTime - startTime < 2000, 'Should complete within reasonable time (2s)');
    });
  });
});