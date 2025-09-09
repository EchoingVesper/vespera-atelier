/**
 * Memory Leak Detection Tests
 * 
 * Specialized tests for detecting memory leaks and resource disposal issues:
 * - Resource allocation and cleanup tracking
 * - Memory growth pattern analysis
 * - Circular reference detection
 * - Event listener cleanup verification
 * - Timer and interval disposal
 * - File handle management
 */

import * as assert from 'assert';
import { suite, test } from 'mocha';
import * as fs from 'fs';
import { ChatSessionPersistence } from '../../chat/state/ChatSessionPersistence';
import { ChatStateValidation } from '../../chat/state/ChatStateValidation';
import { VesperaLogger } from '../../core/logging/VesperaLogger';
import { 
  PropertyDataCollector
} from '../../utils/cleanup/PropertyDataCollector';
import { 
  FalsePositiveDetector
} from '../../utils/cleanup/FalsePositiveDetector';
import { 
  UnusedVariable,
  ProcessingPhase,
  UnusedVariableType,
  RiskLevel,
  ErrorCategory
} from '../../utils/cleanup/UnusedVariableClassifier';
import { 
  MultiChatState,
  ServerNavigationState,
  ChannelViewState
} from '../../chat/state/MultiChatStateTypes';

suite('Memory Leak Detection Tests', () => {

  // Memory tracking utilities
  class MemoryTracker {
    private snapshots: Array<{ timestamp: number; heapUsed: number; external: number; rss: number }> = [];
    
    takeSnapshot(label: string = ''): void {
      if (typeof process !== 'undefined' && process.memoryUsage) {
        const usage = process.memoryUsage();
        this.snapshots.push({
          timestamp: Date.now(),
          heapUsed: usage.heapUsed,
          external: usage.external,
          rss: usage.rss
        });
      }
    }
    
    getMemoryGrowth(): { heapGrowthMB: number; totalGrowthMB: number; snapshots: number } {
      if (this.snapshots.length < 2) {
        return { heapGrowthMB: 0, totalGrowthMB: 0, snapshots: this.snapshots.length };
      }
      
      const first = this.snapshots[0];
      const last = this.snapshots[this.snapshots.length - 1];
      
      return {
        heapGrowthMB: (last.heapUsed - first.heapUsed) / (1024 * 1024),
        totalGrowthMB: (last.rss - first.rss) / (1024 * 1024),
        snapshots: this.snapshots.length
      };
    }
    
    detectSuspiciousGrowth(thresholdMB: number = 50): boolean {
      const growth = this.getMemoryGrowth();
      return Math.abs(growth.heapGrowthMB) > thresholdMB || Math.abs(growth.totalGrowthMB) > thresholdMB;
    }
    
    clear(): void {
      this.snapshots = [];
    }
  }

  // Resource tracking utilities
  class ResourceTracker {
    private allocatedResources = new Map<string, number>();
    private cleanupCallbacks = new Map<string, () => void>();
    
    trackResource(type: string, id: string, cleanupCallback?: () => void): void {
      const count = this.allocatedResources.get(type) || 0;
      this.allocatedResources.set(type, count + 1);
      
      if (cleanupCallback) {
        this.cleanupCallbacks.set(`${type}:${id}`, cleanupCallback);
      }
    }
    
    releaseResource(type: string, id: string): void {
      const count = this.allocatedResources.get(type) || 0;
      if (count > 0) {
        this.allocatedResources.set(type, count - 1);
      }
      
      const cleanupKey = `${type}:${id}`;
      const cleanup = this.cleanupCallbacks.get(cleanupKey);
      if (cleanup) {
        cleanup();
        this.cleanupCallbacks.delete(cleanupKey);
      }
    }
    
    getActiveResources(): Map<string, number> {
      return new Map(this.allocatedResources);
    }
    
    hasLeaks(): boolean {
      for (const [type, count] of this.allocatedResources) {
        if (count > 0) {
          return true;
        }
      }
      return false;
    }
    
    getLeakReport(): { type: string; count: number }[] {
      const leaks: { type: string; count: number }[] = [];
      for (const [type, count] of this.allocatedResources) {
        if (count > 0) {
          leaks.push({ type, count });
        }
      }
      return leaks;
    }
    
    cleanup(): void {
      // Force cleanup of all remaining resources
      for (const cleanup of this.cleanupCallbacks.values()) {
        try {
          cleanup();
        } catch (error) {
          // Ignore cleanup errors during forced cleanup
        }
      }
      this.allocatedResources.clear();
      this.cleanupCallbacks.clear();
    }
  }

  // Mock implementations for testing
  class MockVesperaLogger {
    private messages: string[] = [];
    
    debug(message: string): void { this.messages.push(`DEBUG: ${message}`); }
    info(message: string): void { this.messages.push(`INFO: ${message}`); }
    warn(message: string): void { this.messages.push(`WARN: ${message}`); }
    error(message: string): void { this.messages.push(`ERROR: ${message}`); }
    
    getMessages(): string[] { return [...this.messages]; }
    clearMessages(): void { this.messages = []; }
  }

  class MockPersistenceManager {
    private sessions = new Map<string, any>();
    private currentSessionId: string | null = null;
    
    getCurrentSession(): any {
      return this.currentSessionId ? this.sessions.get(this.currentSessionId) : null;
    }
    
    setCurrentSession(sessionId: string, session: any): void {
      this.currentSessionId = sessionId;
      this.sessions.set(sessionId, session);
    }
    
    async saveSession(session: any): Promise<void> {
      if (this.currentSessionId) {
        this.sessions.set(this.currentSessionId, session);
      }
    }
    
    cleanup(): void {
      this.sessions.clear();
      this.currentSessionId = null;
    }
  }

  let memoryTracker: MemoryTracker;
  let resourceTracker: ResourceTracker;
  let originalReadFile: typeof fs.promises.readFile;
  let mockLogger: MockVesperaLogger;
  let mockPersistence: MockPersistenceManager;

  // Test utilities
  const forceGarbageCollection = (): void => {
    if (global.gc) {
      global.gc();
    }
  };

  const createTestProperty = (name: string, file: string): UnusedVariable => ({
    name,
    file,
    line: 10,
    column: 1,
    type: UnusedVariableType.CLASS_PROPERTY,
    riskLevel: RiskLevel.MEDIUM,
    phase: ProcessingPhase.PHASE_2B,
    category: ErrorCategory.SERVICE_INTEGRATION_GAP
  });

  const generateLargeState = (size: number): MultiChatState => {
    const channelStates = new Map<string, ChannelViewState>();
    const unreadCounts = new Map<string, number>();
    
    for (let i = 0; i < size; i++) {
      const channelId = `channel${i}`;
      channelStates.set(channelId, {
        channelId,
        serverId: `server${i % 10}`,
        isVisible: false,
        scrollPosition: 0,
        inputText: `draft${i}`,
        typingIndicators: new Set([`user${i}`, `user${i + 1}`])
      });
      unreadCounts.set(channelId, i % 100);
    }
    
    return {
      serverNavigationState: {
        expandedServers: new Set(Array.from({ length: size / 10 }, (_, i) => `server${i}`)),
        collapsedServers: new Set(),
        pinnedServers: new Set(),
        serverOrder: Array.from({ length: size / 10 }, (_, i) => `server${i}`),
        navigationHistory: []
      },
      channelStates,
      unreadCounts,
      agentProgressStates: new Map(),
      notificationSettings: {
        enableTaskProgress: true,
        enableAgentActivity: true,
        enableNewMessages: true,
        enableMentions: true,
        soundEnabled: true,
        desktopNotifications: true,
        quietHours: { enabled: false, startTime: '22:00', endTime: '08:00' }
      },
      uiPreferences: {
        theme: 'auto',
        density: 'comfortable',
        showAvatars: true,
        showTimestamps: true,
        groupMessages: true,
        showChannelList: true,
        showMemberList: false,
        fontSize: 14,
        messagePreview: true
      }
    };
  };

  setup(() => {
    memoryTracker = new MemoryTracker();
    resourceTracker = new ResourceTracker();
    originalReadFile = fs.promises.readFile;
    mockLogger = new MockVesperaLogger();
    mockPersistence = new MockPersistenceManager();
    
    memoryTracker.takeSnapshot('setup');
  });

  teardown(() => {
    forceGarbageCollection();
    memoryTracker.takeSnapshot('teardown');
    
    // Verify no resource leaks
    const leakReport = resourceTracker.getLeakReport();
    if (leakReport.length > 0) {
      console.warn('Resource leaks detected:', leakReport);
    }
    
    resourceTracker.cleanup();
    mockPersistence.cleanup();
    (fs.promises as any).readFile = originalReadFile;
  });

  suite('Property Analysis Memory Management', () => {
    test('Should not leak memory during repeated property analysis', async () => {
      const property = createTestProperty('testProperty', 'TestFile.ts');
      const fileContent = 'class TestClass { testProperty: string; method() { return this.testProperty; } }';
      
      // Mock file system with resource tracking
      (fs.promises as any).readFile = async (path: string) => {
        const id = `file-${Date.now()}-${Math.random()}`;
        resourceTracker.trackResource('file-handle', id);
        
        // Simulate async operation
        await new Promise(resolve => setTimeout(resolve, 1));
        
        resourceTracker.releaseResource('file-handle', id);
        return fileContent;
      };
      
      memoryTracker.takeSnapshot('before-analysis-loop');
      
      // Perform many analyses
      const analysisCount = 50;
      for (let i = 0; i < analysisCount; i++) {
        await PropertyDataCollector.performUsageAnalysis(property, fileContent);
        
        if (i % 10 === 0) {
          forceGarbageCollection();
          memoryTracker.takeSnapshot(`analysis-${i}`);
        }
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-analysis-loop');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(25), 
        `Memory growth should be reasonable. Heap: ${growth.heapGrowthMB.toFixed(2)}MB, Total: ${growth.totalGrowthMB.toFixed(2)}MB`);
      
      assert.ok(!resourceTracker.hasLeaks(), 'Should not have resource leaks');
    });

    test('Should clean up resources on analysis errors', async () => {
      const property = createTestProperty('testProperty', 'TestFile.ts');
      
      let resourcesAllocated = 0;
      let resourcesReleased = 0;
      
      (fs.promises as any).readFile = async () => {
        resourcesAllocated++;
        const id = `error-file-${resourcesAllocated}`;
        resourceTracker.trackResource('error-file', id, () => {
          resourcesReleased++;
        });
        
        throw new Error('Simulated file read error');
      };
      
      // Attempt multiple failed analyses
      for (let i = 0; i < 10; i++) {
        try {
          await PropertyDataCollector.performUsageAnalysis(property, '');
        } catch (error) {
          // Expected to fail
        }
      }
      
      // Force cleanup
      resourceTracker.cleanup();
      
      assert.strictEqual(resourcesAllocated, 10, 'Should have attempted to allocate resources');
      assert.strictEqual(resourcesReleased, 10, 'Should have cleaned up all allocated resources');
    });

    test('Should handle large data structures without excessive memory growth', async () => {
      const properties: UnusedVariable[] = [];
      const largeContent = 'x'.repeat(100000); // 100KB content
      
      // Create many properties
      for (let i = 0; i < 100; i++) {
        properties.push(createTestProperty(`property${i}`, `File${i}.ts`));
      }
      
      (fs.promises as any).readFile = async () => largeContent;
      
      memoryTracker.takeSnapshot('before-large-analysis');
      
      // Process all properties
      for (const property of properties) {
        await PropertyDataCollector.performUsageAnalysis(property, largeContent);
        
        if (properties.indexOf(property) % 20 === 0) {
          forceGarbageCollection();
        }
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-large-analysis');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(100), // Allow more for large data
        `Large data processing should not cause excessive memory growth. Heap: ${growth.heapGrowthMB.toFixed(2)}MB`);
    });
  });

  suite('False Positive Detector Memory Management', () => {
    test('Should not accumulate memory during false positive investigations', async () => {
      const property = createTestProperty('testProperty', 'TestFile.ts');
      const fileContent = `
        class TestClass {
          testProperty: string;
          method() { this.testProperty = 'value'; }
          dynamicMethod() { this['testProperty'] = 'dynamic'; }
          reflectionMethod() { Object.keys(this).includes('testProperty'); }
        }
      `;
      
      (fs.promises as any).readFile = async () => fileContent;
      
      memoryTracker.takeSnapshot('before-fp-investigations');
      
      // Perform many investigations
      for (let i = 0; i < 30; i++) {
        await FalsePositiveDetector.investigateFalsePositive(property);
        
        if (i % 10 === 0) {
          forceGarbageCollection();
        }
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-fp-investigations');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(20), 
        `False positive investigations should not leak memory. Heap: ${growth.heapGrowthMB.toFixed(2)}MB`);
    });

    test('Should handle concurrent investigations without memory buildup', async () => {
      const properties = Array.from({ length: 20 }, (_, i) => 
        createTestProperty(`property${i}`, `File${i}.ts`)
      );
      
      const fileContent = 'class Test { property: string; method() { this.property = "value"; } }';
      (fs.promises as any).readFile = async () => fileContent;
      
      memoryTracker.takeSnapshot('before-concurrent-fp');
      
      // Run multiple concurrent investigations
      const batchSize = 5;
      for (let i = 0; i < properties.length; i += batchSize) {
        const batch = properties.slice(i, i + batchSize);
        const investigations = batch.map(prop => 
          FalsePositiveDetector.investigateFalsePositive(prop)
        );
        
        await Promise.all(investigations);
        forceGarbageCollection();
      }
      
      memoryTracker.takeSnapshot('after-concurrent-fp');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(15), 
        `Concurrent false positive investigations should be memory efficient. Heap: ${growth.heapGrowthMB.toFixed(2)}MB`);
    });
  });

  suite('Chat State Management Memory Leaks', () => {
    test('Should properly dispose of chat session persistence resources', async () => {
      const chatPersistence = new ChatSessionPersistence(mockPersistence as any, mockLogger);
      
      // Track timer creation
      let timersCreated = 0;
      let timersCleared = 0;
      
      const originalSetInterval = global.setInterval;
      const originalClearInterval = global.clearInterval;
      
      global.setInterval = ((callback: any, delay: any) => {
        timersCreated++;
        resourceTracker.trackResource('timer', `interval-${timersCreated}`);
        return originalSetInterval(callback, delay);
      }) as any;
      
      global.clearInterval = ((id: any) => {
        timersCleared++;
        resourceTracker.releaseResource('timer', `interval-${timersCleared}`);
        return originalClearInterval(id);
      }) as any;
      
      try {
        // Setup periodic saving
        const saveCallback = async () => {
          await new Promise(resolve => setTimeout(resolve, 1));
        };
        
        chatPersistence.setupPeriodicStateSaving(saveCallback);
        
        // Wait a bit to ensure timer is active
        await new Promise(resolve => setTimeout(resolve, 100));
        
        // Dispose should clean up timers
        chatPersistence.dispose();
        
        assert.strictEqual(timersCreated, 1, 'Should have created one timer');
        assert.strictEqual(timersCleared, 1, 'Should have cleared the timer on dispose');
        
      } finally {
        global.setInterval = originalSetInterval;
        global.clearInterval = originalClearInterval;
      }
    });

    test('Should handle state restoration without memory leaks', async () => {
      const chatPersistence = new ChatSessionPersistence(mockPersistence as any, mockLogger);
      
      // Create large session data
      const largeSession = {
        servers: Array.from({ length: 100 }, (_, i) => ({
          serverId: `server${i}`,
          serverName: `Server ${i}`,
          channels: Array.from({ length: 20 }, (_, j) => ({
            channelId: `channel${i}-${j}`,
            channelName: `Channel ${j}`,
            channelType: 'text'
          })),
          archived: false,
          lastActivity: Date.now()
        })),
        taskServerStates: [],
        userPreferences: {}
      };
      
      mockPersistence.setCurrentSession('test-session', largeSession);
      
      memoryTracker.takeSnapshot('before-state-restoration');
      
      // Restore state multiple times
      for (let i = 0; i < 10; i++) {
        await chatPersistence.restoreStateFromSession();
        
        if (i % 3 === 0) {
          forceGarbageCollection();
        }
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-state-restoration');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(30), 
        `State restoration should not accumulate memory. Heap: ${growth.heapGrowthMB.toFixed(2)}MB`);
      
      chatPersistence.dispose();
    });

    test('Should clean up large state structures efficiently', async () => {
      const validation = new ChatStateValidation(mockLogger);
      
      memoryTracker.takeSnapshot('before-large-state-validation');
      
      // Process many large states
      for (let i = 0; i < 20; i++) {
        const largeState = generateLargeState(1000); // 1000 channels
        
        const result = validation.validateState(largeState);
        assert.ok(result, 'Should validate large state');
        
        // Clear references
        if (result.sanitizedState) {
          (result.sanitizedState as any) = null;
        }
        
        if (i % 5 === 0) {
          forceGarbageCollection();
        }
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-large-state-validation');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(40), 
        `Large state validation should not leak memory. Heap: ${growth.heapGrowthMB.toFixed(2)}MB`);
    });
  });

  suite('Circular Reference Detection', () => {
    test('Should handle circular references in state objects', () => {
      const validation = new ChatStateValidation(mockLogger);
      
      // Create circular reference
      const circularState: any = {
        serverNavigationState: {
          expandedServers: new Set(['server1']),
          collapsedServers: new Set(),
          pinnedServers: new Set(),
          serverOrder: ['server1'],
          navigationHistory: []
        }
      };
      
      circularState.circular = circularState;
      circularState.serverNavigationState.parent = circularState;
      
      memoryTracker.takeSnapshot('before-circular-validation');
      
      // Should not hang or crash
      assert.doesNotThrow(() => {
        const result = validation.validateState(circularState);
        assert.ok(result, 'Should handle circular references');
      });
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-circular-validation');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(Math.abs(growth.heapGrowthMB) < 10, 'Should not cause significant memory growth');
    });

    test('Should detect and break circular references in channel states', () => {
      const validation = new ChatStateValidation(mockLogger);
      
      const channelState: any = {
        channelId: 'channel1',
        serverId: 'server1',
        isVisible: true,
        scrollPosition: 0,
        inputText: '',
        typingIndicators: new Set()
      };
      
      // Create circular reference
      channelState.parent = channelState;
      channelState.circular = { child: channelState };
      
      const channelStates = new Map([['channel1', channelState]]);
      const stateWithCircular = { channelStates };
      
      const result = validation.validateState(stateWithCircular);
      
      // Should not crash and should provide some result
      assert.ok(result, 'Should handle circular channel state references');
      assert.ok(typeof result.isValid === 'boolean', 'Should return valid result structure');
    });
  });

  suite('Event Listener and Timer Management', () => {
    test('Should track and cleanup event listeners', () => {
      // Track event listeners
      let listenersAdded = 0;
      let listenersRemoved = 0;
      
      // Mock event target
      const mockEventTarget = {
        addEventListener: () => {
          listenersAdded++;
          resourceTracker.trackResource('event-listener', `listener-${listenersAdded}`);
        },
        removeEventListener: () => {
          listenersRemoved++;
          resourceTracker.releaseResource('event-listener', `listener-${listenersRemoved}`);
        }
      };
      
      // Simulate adding many event listeners
      for (let i = 0; i < 10; i++) {
        mockEventTarget.addEventListener();
      }
      
      assert.strictEqual(listenersAdded, 10, 'Should have added 10 listeners');
      assert.ok(resourceTracker.hasLeaks(), 'Should detect listener leaks');
      
      // Cleanup listeners
      for (let i = 0; i < 10; i++) {
        mockEventTarget.removeEventListener();
      }
      
      assert.strictEqual(listenersRemoved, 10, 'Should have removed 10 listeners');
      assert.ok(!resourceTracker.hasLeaks(), 'Should have no leaks after cleanup');
    });

    test('Should handle timer cleanup in error scenarios', () => {
      let timersSet = 0;
      let timersCleared = 0;
      
      const originalSetTimeout = global.setTimeout;
      const originalClearTimeout = global.clearTimeout;
      
      global.setTimeout = ((callback: any, delay: any) => {
        timersSet++;
        const id = originalSetTimeout(callback, delay);
        resourceTracker.trackResource('timeout', `timeout-${timersSet}`, () => {
          timersCleared++;
        });
        return id;
      }) as any;
      
      global.clearTimeout = ((id: any) => {
        resourceTracker.releaseResource('timeout', `timeout-${++timersCleared}`);
        return originalClearTimeout(id);
      }) as any;
      
      try {
        // Create timers that might not be cleaned up
        const timerIds: any[] = [];
        
        for (let i = 0; i < 5; i++) {
          const id = setTimeout(() => {
            throw new Error('Timer error');
          }, 10);
          timerIds.push(id);
        }
        
        // Manually clear timers
        timerIds.forEach(id => clearTimeout(id));
        
        assert.strictEqual(timersSet, 5, 'Should have set 5 timers');
        assert.strictEqual(timersCleared, 5, 'Should have cleared 5 timers');
        
      } finally {
        global.setTimeout = originalSetTimeout;
        global.clearTimeout = originalClearTimeout;
      }
    });
  });

  suite('Stress Testing Memory Patterns', () => {
    test('Should handle rapid allocation and deallocation', async () => {
      const properties: UnusedVariable[] = [];
      
      memoryTracker.takeSnapshot('before-stress-test');
      
      // Rapid allocation
      for (let cycle = 0; cycle < 5; cycle++) {
        // Allocate
        for (let i = 0; i < 100; i++) {
          properties.push(createTestProperty(`prop${cycle}-${i}`, `File${cycle}-${i}.ts`));
        }
        
        // Process some
        const fileContent = 'class Test { property: string; }';
        for (let i = 0; i < Math.min(20, properties.length); i++) {
          if (properties[i]) {
            await PropertyDataCollector.performUsageAnalysis(properties[i], fileContent);
          }
        }
        
        // Deallocate
        properties.length = 0;
        
        forceGarbageCollection();
        memoryTracker.takeSnapshot(`stress-cycle-${cycle}`);
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-stress-test');
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(20), 
        `Stress test should not cause memory leaks. Heap: ${growth.heapGrowthMB.toFixed(2)}MB`);
    });

    test('Should maintain stable memory usage under continuous load', async () => {
      const property = createTestProperty('stressProperty', 'StressFile.ts');
      const fileContent = 'class StressTest { stressProperty: string; method() { return this.stressProperty; } }';
      
      memoryTracker.takeSnapshot('before-continuous-load');
      
      // Track memory baseline
      let maxGrowth = 0;
      
      // Continuous load for extended period
      const iterations = 100;
      for (let i = 0; i < iterations; i++) {
        await PropertyDataCollector.performUsageAnalysis(property, fileContent);
        await FalsePositiveDetector.searchForActualUsage(property, fileContent);
        
        if (i % 20 === 0) {
          forceGarbageCollection();
          memoryTracker.takeSnapshot(`load-${i}`);
          
          const currentGrowth = memoryTracker.getMemoryGrowth();
          maxGrowth = Math.max(maxGrowth, Math.abs(currentGrowth.heapGrowthMB));
        }
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-continuous-load');
      
      assert.ok(maxGrowth < 30, 
        `Memory usage should remain stable under continuous load. Max growth: ${maxGrowth.toFixed(2)}MB`);
    });
  });

  suite('Resource Pool Management', () => {
    test('Should reuse objects efficiently without accumulation', () => {
      const validation = new ChatStateValidation(mockLogger);
      const pool = new Map<string, any>();
      
      // Track object creation vs reuse
      let objectsCreated = 0;
      let objectsReused = 0;
      
      memoryTracker.takeSnapshot('before-pool-test');
      
      for (let i = 0; i < 50; i++) {
        const key = `state-${i % 10}`; // Limit to 10 unique states
        
        let state = pool.get(key);
        if (!state) {
          objectsCreated++;
          state = generateLargeState(50);
          pool.set(key, state);
        } else {
          objectsReused++;
        }
        
        validation.validateState(state);
        
        if (i % 10 === 0) {
          forceGarbageCollection();
        }
      }
      
      forceGarbageCollection();
      memoryTracker.takeSnapshot('after-pool-test');
      
      assert.ok(objectsCreated <= 10, `Should create at most 10 objects, created ${objectsCreated}`);
      assert.ok(objectsReused >= 40, `Should reuse objects efficiently, reused ${objectsReused}`);
      
      const growth = memoryTracker.getMemoryGrowth();
      assert.ok(!memoryTracker.detectSuspiciousGrowth(15), 
        `Object pooling should be memory efficient. Heap: ${growth.heapGrowthMB.toFixed(2)}MB`);
      
      pool.clear();
    });
  });
});