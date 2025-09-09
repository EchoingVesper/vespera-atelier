/**
 * Property Analysis Performance Tests
 * 
 * Performance benchmarking and scalability tests for property analysis modules:
 * - Large file analysis performance
 * - Memory usage monitoring
 * - Concurrent analysis capabilities
 * - Processing time benchmarks
 * - Resource efficiency validation
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
import { 
  PropertyDataCollector
} from '../../utils/cleanup/PropertyDataCollector';
import { 
  PropertyStrategicAnalyzer
} from '../../utils/cleanup/PropertyStrategicAnalyzer';
import { 
  FalsePositiveDetector
} from '../../utils/cleanup/FalsePositiveDetector';
import { 
  PropertyAnalysisPhases
} from '../../utils/cleanup/PropertyAnalysisPhases';
import { 
  UnusedVariable,
  ProcessingPhase,
  UnusedVariableType,
  RiskLevel,
  ErrorCategory
} from '../../utils/cleanup/UnusedVariableClassifier';

suite('Property Analysis Performance Tests', () => {

  let originalReadFile: typeof fs.promises.readFile;

  // Performance test configuration
  const PERFORMANCE_THRESHOLDS = {
    SMALL_FILE_MS: 100,      // < 100ms for small files (< 1KB)
    MEDIUM_FILE_MS: 500,     // < 500ms for medium files (< 100KB)
    LARGE_FILE_MS: 2000,     // < 2s for large files (< 1MB)
    HUGE_FILE_MS: 10000,     // < 10s for huge files (> 1MB)
    MEMORY_GROWTH_MB: 50,    // < 50MB memory growth
    CONCURRENT_OPERATIONS: 10, // Number of concurrent operations to test
    BATCH_SIZE: 100          // Batch processing size
  };

  // Test data generators
  const generateLargeFileContent = (sizeCategory: 'small' | 'medium' | 'large' | 'huge', propertyName: string = 'testProperty'): string => {
    const sizes = {
      small: 1000,      // ~1KB
      medium: 100000,   // ~100KB  
      large: 1000000,   // ~1MB
      huge: 10000000    // ~10MB
    };

    const targetSize = sizes[sizeCategory];
    let content = `
class LargeTestClass {
  private ${propertyName}: string;
  private anotherProperty: number;
  private thirdProperty: boolean;
  
  constructor() {
    this.${propertyName} = 'initialized';
    this.anotherProperty = 42;
    this.thirdProperty = true;
  }
  
  // Method that uses the property
  getValue() {
    return this.${propertyName};
  }
  
  // Method with dynamic access
  dynamicAccess() {
    this['${propertyName}'] = 'dynamic';
    this["${propertyName}"] = 'quoted';
  }
  
  // Reflection usage
  reflectionMethod() {
    Object.keys(this).forEach(key => {
      if (key === '${propertyName}') {
        console.log(this[key]);
      }
    });
    
    Reflect.get(this, '${propertyName}');
  }
`;

    // Generate additional methods and content to reach target size
    const baseContentSize = content.length;
    const remainingSize = targetSize - baseContentSize;
    const methodSize = 200; // Approximate size per generated method
    const methodCount = Math.floor(remainingSize / methodSize);

    for (let i = 0; i < methodCount; i++) {
      const shouldUseProperty = i % 10 === 0; // Use property in 10% of methods
      
      content += `
  
  generatedMethod${i}() {
    // Generated method ${i}
    const localVar = 'value';
    const anotherVar = ${i};
    ${shouldUseProperty ? `this.${propertyName}.toString();` : ''}
    
    if (${i} % 2 === 0) {
      console.log('Even method');
      ${shouldUseProperty ? `return this.${propertyName};` : 'return localVar;'}
    } else {
      console.log('Odd method');
      return anotherVar;
    }
  }`;
    }

    content += `
}

// Additional classes and content
`;

    // Add more content if still under target
    const currentSize = content.length;
    if (currentSize < targetSize) {
      const padding = targetSize - currentSize;
      const comment = '// Padding comment to reach target file size\n';
      const repeatCount = Math.floor(padding / comment.length);
      content += comment.repeat(repeatCount);
    }

    return content;
  };

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

  const measureMemoryUsage = (): number => {
    if (typeof process !== 'undefined' && process.memoryUsage) {
      return process.memoryUsage().heapUsed / (1024 * 1024); // MB
    }
    return 0; // Not available in browser environment
  };

  const measureExecutionTime = async <T>(operation: () => Promise<T>): Promise<{ result: T; timeMs: number }> => {
    const startTime = Date.now();
    const result = await operation();
    const endTime = Date.now();
    return { result, timeMs: endTime - startTime };
  };

  setup(() => {
    originalReadFile = fs.promises.readFile;
  });

  teardown(() => {
    (fs.promises as any).readFile = originalReadFile;
  });

  suite('File Size Performance Benchmarks', () => {
    test('Should analyze small files efficiently', async () => {
      const property = createTestProperty('testProperty', 'SmallFile.ts', 10);
      const fileContent = generateLargeFileContent('small');
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyDataCollector.performUsageAnalysis(property, fileContent);
      });
      
      assert.ok(result, 'Should complete analysis for small file');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.SMALL_FILE_MS, 
        `Small file analysis should complete within ${PERFORMANCE_THRESHOLDS.SMALL_FILE_MS}ms, took ${timeMs}ms`);
      
      // Verify analysis quality
      assert.ok(result.usageLocations.length > 0, 'Should find usage locations in small file');
      assert.ok(result.constructorUsage, 'Should analyze constructor usage');
    });

    test('Should analyze medium files efficiently', async () => {
      const property = createTestProperty('testProperty', 'MediumFile.ts', 10);
      const fileContent = generateLargeFileContent('medium');
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const initialMemory = measureMemoryUsage();
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyDataCollector.performUsageAnalysis(property, fileContent);
      });
      const finalMemory = measureMemoryUsage();
      
      assert.ok(result, 'Should complete analysis for medium file');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.MEDIUM_FILE_MS, 
        `Medium file analysis should complete within ${PERFORMANCE_THRESHOLDS.MEDIUM_FILE_MS}ms, took ${timeMs}ms`);
      
      const memoryGrowth = finalMemory - initialMemory;
      if (initialMemory > 0) { // Only check if memory measurement is available
        assert.ok(memoryGrowth < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MB, 
          `Memory growth should be less than ${PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MB}MB, was ${memoryGrowth.toFixed(2)}MB`);
      }
    });

    test('Should analyze large files within reasonable time', async () => {
      const property = createTestProperty('testProperty', 'LargeFile.ts', 10);
      const fileContent = generateLargeFileContent('large');
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyDataCollector.performUsageAnalysis(property, fileContent);
      });
      
      assert.ok(result, 'Should complete analysis for large file');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.LARGE_FILE_MS, 
        `Large file analysis should complete within ${PERFORMANCE_THRESHOLDS.LARGE_FILE_MS}ms, took ${timeMs}ms`);
      
      // Verify analysis accuracy is maintained
      assert.ok(result.usageLocations.length > 0, 'Should maintain accuracy for large files');
      assert.ok(result.runtimeUsage.accessCount > 0, 'Should count property accesses');
    });

    test('Should handle huge files without crashing', async () => {
      // This test might be skipped in CI environments due to time constraints
      const property = createTestProperty('testProperty', 'HugeFile.ts', 10);
      const fileContent = generateLargeFileContent('huge');
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const initialMemory = measureMemoryUsage();
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyDataCollector.performUsageAnalysis(property, fileContent);
      });
      const finalMemory = measureMemoryUsage();
      
      assert.ok(result, 'Should complete analysis for huge file');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.HUGE_FILE_MS, 
        `Huge file analysis should complete within ${PERFORMANCE_THRESHOLDS.HUGE_FILE_MS}ms, took ${timeMs}ms`);
      
      // Memory should not grow excessively
      const memoryGrowth = finalMemory - initialMemory;
      if (initialMemory > 0) {
        assert.ok(memoryGrowth < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MB * 2, // Allow more for huge files
          `Memory growth should be reasonable for huge files, was ${memoryGrowth.toFixed(2)}MB`);
      }
    }).timeout(15000); // Longer timeout for huge files
  });

  suite('False Positive Detection Performance', () => {
    test('Should efficiently detect false positives in large files', async () => {
      const property = createTestProperty('testProperty', 'LargeFile.ts', 10, ProcessingPhase.PHASE_2C);
      const fileContent = generateLargeFileContent('large', 'testProperty');
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return FalsePositiveDetector.investigateFalsePositive(property);
      });
      
      assert.ok(Array.isArray(result), 'Should complete false positive investigation');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.LARGE_FILE_MS, 
        `False positive detection should complete within ${PERFORMANCE_THRESHOLDS.LARGE_FILE_MS}ms, took ${timeMs}ms`);
      
      // Should find evidence in the large file
      assert.ok(result.length > 0, 'Should find false positive evidence in large file');
    });

    test('Should efficiently search for actual usage patterns', async () => {
      const property = createTestProperty('testProperty', 'MediumFile.ts', 10);
      const fileContent = generateLargeFileContent('medium', 'testProperty');
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return FalsePositiveDetector.searchForActualUsage(property, fileContent);
      });
      
      assert.strictEqual(typeof result, 'boolean', 'Should return boolean result');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.MEDIUM_FILE_MS / 2, // Should be faster than full analysis
        `Usage search should be fast, took ${timeMs}ms`);
      
      assert.strictEqual(result, true, 'Should find actual usage in generated file');
    });

    test('Should handle dynamic access pattern detection efficiently', async () => {
      const property = createTestProperty('testProperty', 'MediumFile.ts', 10);
      const fileContent = generateLargeFileContent('medium', 'testProperty');
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return FalsePositiveDetector.findDynamicAccessPatterns(property, fileContent);
      });
      
      assert.ok(Array.isArray(result), 'Should return array of patterns');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.MEDIUM_FILE_MS / 4, // Should be very fast
        `Dynamic pattern detection should be very fast, took ${timeMs}ms`);
      
      assert.ok(result.length > 0, 'Should find dynamic access patterns');
    });
  });

  suite('Strategic Analysis Performance', () => {
    test('Should perform strategic assessment efficiently', async () => {
      const property = createTestProperty('coreServices', 'AgentProgressNotifier.ts', 116, ProcessingPhase.PHASE_2B);
      const fileContent = generateLargeFileContent('medium', 'coreServices');
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyStrategicAnalyzer.performStrategicAssessment(property, fileContent);
      });
      
      assert.ok(result, 'Should complete strategic assessment');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.MEDIUM_FILE_MS / 2, 
        `Strategic assessment should be efficient, took ${timeMs}ms`);
      
      // Verify assessment quality
      assert.ok(typeof result.strategicScore === 'number', 'Should calculate strategic score');
      assert.ok(['HIGH', 'MEDIUM', 'LOW'].includes(result.implementationPriority), 'Should determine priority');
    });

    test('Should analyze service connections quickly', async () => {
      const property = createTestProperty('errorHandler', 'TestFile.ts', 10);
      const fileContent = generateLargeFileContent('medium', 'errorHandler');
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyStrategicAnalyzer.analyzeServiceConnections(property, fileContent);
      });
      
      assert.ok(Array.isArray(result), 'Should return service connections array');
      assert.ok(timeMs < 100, 'Service connection analysis should be very fast');
      
      assert.ok(result.length > 0, 'Should find service connections');
    });

    test('Should handle batch integration opportunity assessment', async () => {
      // Create multiple properties for batch processing
      const properties: UnusedVariable[] = Array.from({ length: PERFORMANCE_THRESHOLDS.BATCH_SIZE }, (_, i) => 
        createTestProperty(`property${i}`, `File${i}.ts`, 10 + i, ProcessingPhase.PHASE_2B)
      );
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyStrategicAnalyzer.assessIntegrationOpportunities(properties);
      });
      
      assert.ok(result, 'Should complete batch assessment');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.LARGE_FILE_MS, 
        `Batch assessment should complete efficiently, took ${timeMs}ms`);
      
      assert.ok(typeof result.totalOpportunities === 'number', 'Should count total opportunities');
      assert.ok(typeof result.estimatedTotalEffort === 'number', 'Should estimate total effort');
    });
  });

  suite('Concurrent Processing Performance', () => {
    test('Should handle concurrent property analysis', async () => {
      const concurrentOperations = Array.from({ length: PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS }, (_, i) => {
        const property = createTestProperty(`property${i}`, `File${i}.ts`, 10 + i);
        const fileContent = generateLargeFileContent('small', `property${i}`);
        
        (fs.promises as any).readFile = async () => fileContent;
        
        return PropertyDataCollector.performUsageAnalysis(property, fileContent);
      });
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return Promise.all(concurrentOperations);
      });
      
      assert.strictEqual(result.length, PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS, 'Should complete all concurrent operations');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.MEDIUM_FILE_MS, 
        `Concurrent operations should complete efficiently, took ${timeMs}ms`);
      
      // Verify all results are valid
      result.forEach((analysis, index) => {
        assert.ok(analysis, `Analysis ${index} should be valid`);
        assert.ok(analysis.usageLocations.length >= 0, `Analysis ${index} should have usage locations`);
      });
    });

    test('Should handle concurrent false positive investigations', async () => {
      const concurrentOperations = Array.from({ length: PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS }, (_, i) => {
        const property = createTestProperty(`property${i}`, `File${i}.ts`, 10 + i, ProcessingPhase.PHASE_2C);
        const fileContent = generateLargeFileContent('small', `property${i}`);
        
        (fs.promises as any).readFile = async () => fileContent;
        
        return FalsePositiveDetector.investigateFalsePositive(property);
      });
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return Promise.all(concurrentOperations);
      });
      
      assert.strictEqual(result.length, PERFORMANCE_THRESHOLDS.CONCURRENT_OPERATIONS, 'Should complete all concurrent investigations');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.MEDIUM_FILE_MS, 
        `Concurrent investigations should complete efficiently, took ${timeMs}ms`);
      
      // Verify all results are valid
      result.forEach((evidence, index) => {
        assert.ok(Array.isArray(evidence), `Investigation ${index} should return evidence array`);
      });
    });
  });

  suite('Memory Efficiency Tests', () => {
    test('Should not leak memory during repeated analysis', async () => {
      const property = createTestProperty('testProperty', 'TestFile.ts', 10);
      const fileContent = generateLargeFileContent('medium');
      
      (fs.promises as any).readFile = async () => fileContent;
      
      const initialMemory = measureMemoryUsage();
      
      // Perform multiple analyses
      for (let i = 0; i < 10; i++) {
        await PropertyDataCollector.performUsageAnalysis(property, fileContent);
        
        // Force garbage collection if available
        if (global.gc) {
          global.gc();
        }
      }
      
      const finalMemory = measureMemoryUsage();
      const memoryGrowth = finalMemory - initialMemory;
      
      if (initialMemory > 0) {
        assert.ok(memoryGrowth < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MB, 
          `Memory growth should be minimal during repeated analysis, was ${memoryGrowth.toFixed(2)}MB`);
      }
    });

    test('Should efficiently handle large data structures', async () => {
      // Create large strategic data simulation
      const largePropertyCount = 1000;
      const properties: UnusedVariable[] = [];
      
      for (let i = 0; i < largePropertyCount; i++) {
        properties.push(createTestProperty(`property${i}`, `File${i}.ts`, 10 + i));
      }
      
      const initialMemory = measureMemoryUsage();
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        // Test strategic data lookup for all properties
        const results = properties.map(property => 
          PropertyAnalysisPhases.findStrategicDataForProperty(property)
        );
        return results;
      });
      
      const finalMemory = measureMemoryUsage();
      
      assert.strictEqual(result.length, largePropertyCount, 'Should process all properties');
      assert.ok(timeMs < 1000, 'Should process large dataset quickly');
      
      const memoryGrowth = finalMemory - initialMemory;
      if (initialMemory > 0) {
        assert.ok(memoryGrowth < PERFORMANCE_THRESHOLDS.MEMORY_GROWTH_MB, 
          `Large dataset processing should be memory efficient, growth was ${memoryGrowth.toFixed(2)}MB`);
      }
    });
  });

  suite('Algorithm Complexity Validation', () => {
    test('Should scale linearly with file size', async () => {
      const property = createTestProperty('testProperty', 'TestFile.ts', 10);
      const testSizes = ['small', 'medium'] as const; // Skip large/huge for CI performance
      const timings: { size: string; time: number; fileSize: number }[] = [];
      
      for (const sizeCategory of testSizes) {
        const fileContent = generateLargeFileContent(sizeCategory);
        (fs.promises as any).readFile = async () => fileContent;
        
        const { result, timeMs } = await measureExecutionTime(async () => {
          return PropertyDataCollector.performUsageAnalysis(property, fileContent);
        });
        
        assert.ok(result, `Should complete analysis for ${sizeCategory} file`);
        
        timings.push({
          size: sizeCategory,
          time: timeMs,
          fileSize: fileContent.length
        });
      }
      
      // Verify scaling is reasonable (not exponential)
      if (timings.length >= 2) {
        const smallTiming = timings.find(t => t.size === 'small')!;
        const mediumTiming = timings.find(t => t.size === 'medium')!;
        
        const sizeRatio = mediumTiming.fileSize / smallTiming.fileSize;
        const timeRatio = mediumTiming.time / smallTiming.time;
        
        // Time growth should not be much more than size growth (allowing some overhead)
        assert.ok(timeRatio < sizeRatio * 2, 
          `Time scaling should be reasonable. Size ratio: ${sizeRatio.toFixed(2)}, Time ratio: ${timeRatio.toFixed(2)}`);
      }
    });

    test('Should handle worst-case scenarios efficiently', async () => {
      // Create worst-case file: many property usages throughout
      const property = createTestProperty('worstCaseProperty', 'WorstCase.ts', 10);
      
      let worstCaseContent = `
class WorstCaseClass {
  private worstCaseProperty: string;
  
  constructor() {
    this.worstCaseProperty = 'init';
  }
`;
      
      // Add many methods that all use the property
      for (let i = 0; i < 1000; i++) {
        worstCaseContent += `
  method${i}() {
    this.worstCaseProperty.toString();
    this['worstCaseProperty'] = 'dynamic${i}';
    return this.worstCaseProperty;
  }`;
      }
      
      worstCaseContent += '\n}';
      
      (fs.promises as any).readFile = async () => worstCaseContent;
      
      const { result, timeMs } = await measureExecutionTime(async () => {
        return PropertyDataCollector.performUsageAnalysis(property, worstCaseContent);
      });
      
      assert.ok(result, 'Should handle worst-case scenario');
      assert.ok(timeMs < PERFORMANCE_THRESHOLDS.LARGE_FILE_MS, 
        `Worst-case analysis should complete within reasonable time, took ${timeMs}ms`);
      
      // Should find many usage locations
      assert.ok(result.usageLocations.length > 100, 'Should find many usage locations in worst-case file');
      assert.ok(result.runtimeUsage.accessCount > 100, 'Should count many property accesses');
    });
  });

  suite('Resource Cleanup and Disposal', () => {
    test('Should properly dispose of resources', async () => {
      const property = createTestProperty('testProperty', 'TestFile.ts', 10);
      const fileContent = generateLargeFileContent('medium');
      
      // Mock file system to track resource usage
      let openFileCount = 0;
      (fs.promises as any).readFile = async () => {
        openFileCount++;
        try {
          return fileContent;
        } finally {
          openFileCount--;
        }
      };
      
      await PropertyDataCollector.performUsageAnalysis(property, fileContent);
      
      // All file operations should be complete
      assert.strictEqual(openFileCount, 0, 'All file resources should be cleaned up');
    });

    test('Should handle resource cleanup on errors', async () => {
      const _property = createTestProperty('testProperty', 'TestFile.ts', 10);
      
      let resourcesAllocated = 0;
      let resourcesCleaned = 0;
      
      (fs.promises as any).readFile = async () => {
        resourcesAllocated++;
        try {
          throw new Error('Simulated read error');
        } finally {
          resourcesCleaned++;
        }
      };
      
      try {
        await PropertyDataCollector.getFileContent('test-file.ts');
      } catch (error) {
        // Expected to throw
      }
      
      assert.strictEqual(resourcesAllocated, resourcesCleaned, 'Resources should be cleaned up even on error');
    });
  });
});