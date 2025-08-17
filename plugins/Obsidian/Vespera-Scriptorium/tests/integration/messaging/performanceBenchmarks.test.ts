import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { natsClient } from '../../../src/core/messaging/natsClient';
import { taskManager } from '../../../src/core/messaging/taskManager';
import { storageManager } from '../../../src/core/messaging/storageManager';
import { dataExchange } from '../../../src/core/messaging/dataExchange';
import { messagePersistence } from '../../../src/core/messaging/messagePersistence';
import { loadBalancer } from '../../../src/core/messaging/loadBalancer';
import { messagePrioritization } from '../../../src/core/messaging/messagePrioritization';
import { 
  MessageType, 
  TaskStatus,
  TaskCreatePayload,
  StorageSetPayload,
  DataRequestPayload,
  Message
} from '../../../src/core/messaging/types';

// Subscription callbacks map for testing
const subscriptionCallbacks = new Map<string, (message: any) => void>();

// Helper function to trigger a subscription callback
const triggerSubscription = async (subject: string, message: any): Promise<boolean> => {
  const callback = subscriptionCallbacks.get(subject);
  if (callback) {
    await callback(message);
    return true;
  }
  return false;
};

// Mock the NATS client
vi.mock('../../../src/core/messaging/natsClient', () => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  const mockSubscribe = vi.fn().mockImplementation((subject: string, callback: (message: any) => void) => {
    // Store the callback for later use in tests
    subscriptionCallbacks.set(subject, callback);
    return Promise.resolve(`subscription-${subject}`);
  });
  const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
  const mockWaitForMessage = vi.fn().mockImplementation((subscription: string, timeout: number) => {
    // This will be mocked in individual tests
    return Promise.resolve(null);
  });

  return {
    natsClient: {
      publish: mockPublish,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      waitForMessage: mockWaitForMessage,
      isConnected: () => true,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockImplementation((subject: string, message: any, options?: any) => {
        // Simulate a request/reply by calling the appropriate callback
        const callback = subscriptionCallbacks.get(subject);
        if (callback) {
          setTimeout(() => callback(message), 10);
        }
        return Promise.resolve({
          data: { result: 'test-response' }
        });
      })
    }
  };
});

// Mock the message persistence manager
vi.mock('../../../src/core/messaging/messagePersistence', () => {
  const persistedMessages = new Map<string, { message: Message<unknown>, subject: string }>();
  
  return {
    messagePersistence: {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      persistMessage: vi.fn().mockImplementation((subject: string, message: Message<unknown>) => {
        const id = `msg-id-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
        persistedMessages.set(id, { message, subject });
        return Promise.resolve(id);
      }),
      retrieveMessage: vi.fn().mockImplementation((messageId: string) => {
        const data = persistedMessages.get(messageId);
        return Promise.resolve(data ? data.message : null);
      }),
      getPendingMessages: vi.fn().mockImplementation(() => {
        const result: Array<{ id: string, message: Message<unknown>, targetSubject: string, attempts: number, lastAttempt: string | null, nextAttempt: string | null, persistedAt: string, status: string }> = [];
        persistedMessages.forEach((value, key) => {
          result.push({
            id: key,
            message: value.message,
            targetSubject: value.subject,
            attempts: 0,
            lastAttempt: null,
            nextAttempt: null,
            persistedAt: new Date().toISOString(),
            status: 'pending'
          });
        });
        return Promise.resolve(result);
      }),
      attemptDelivery: vi.fn().mockImplementation((messageId: string, targetService: string) => {
        return Promise.resolve({ delivered: true, deferred: false });
      })
    }
  };
});

// Mock the load balancer
vi.mock('../../../src/core/messaging/loadBalancer', () => {
  const services = new Map<string, Set<string>>();
  
  return {
    loadBalancer: {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      registerService: vi.fn().mockImplementation((serviceId: string, taskTypes: string[]) => {
        taskTypes.forEach(taskType => {
          if (!services.has(taskType)) {
            services.set(taskType, new Set());
          }
          services.get(taskType)?.add(serviceId);
        });
        return Promise.resolve();
      }),
      unregisterService: vi.fn().mockImplementation((serviceId: string) => {
        services.forEach((serviceIds, taskType) => {
          serviceIds.delete(serviceId);
        });
        return Promise.resolve();
      }),
      selectService: vi.fn().mockImplementation((taskType: string, options?: { priority?: number }) => {
        const serviceIds = services.get(taskType);
        if (!serviceIds || serviceIds.size === 0) {
          return Promise.resolve(null);
        }
        const servicesArray = Array.from(serviceIds);
        const randomIndex = Math.floor(Math.random() * servicesArray.length);
        return Promise.resolve(servicesArray[randomIndex]);
      })
    }
  };
});

// Mock the message prioritization manager
vi.mock('../../../src/core/messaging/messagePrioritization', () => {
  const rules = new Map<string, (message: Message<unknown>) => number>();
  
  return {
    messagePrioritization: {
      initialize: vi.fn().mockResolvedValue(undefined),
      shutdown: vi.fn().mockResolvedValue(undefined),
      registerRule: vi.fn().mockImplementation((ruleId: string, ruleFn: (message: Message<unknown>) => number) => {
        rules.set(ruleId, ruleFn);
        return Promise.resolve();
      }),
      unregisterRule: vi.fn().mockImplementation((ruleId: string) => {
        rules.delete(ruleId);
        return Promise.resolve();
      }),
      getPriority: vi.fn().mockImplementation((message: Message<unknown>) => {
        let highestPriority = 0;
        rules.forEach(rule => {
          const priority = rule(message);
          if (priority > highestPriority) {
            highestPriority = priority;
          }
        });
        return Promise.resolve(highestPriority);
      })
    }
  };
});

// Access the mock functions and helpers
const mockPublish = vi.mocked(natsClient.publish);
const mockSubscribe = vi.mocked(natsClient.subscribe);
const mockUnsubscribe = vi.mocked(natsClient.unsubscribe);
// Note: waitForMessage is not part of the NatsClient interface but used in mocks

/**
 * Helper function to measure execution time
 */
async function measureExecutionTime(fn: () => Promise<any>): Promise<number> {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
}

/**
 * Helper function to generate a large payload
 */
function generateLargePayload(sizeInKB: number): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      source: 'performance-test'
    }
  };
  
  // Generate a string of approximately sizeInKB
  const charsPerKB = 1024;
  const dataString = 'x'.repeat(sizeInKB * charsPerKB);
  
  // Split into chunks to make it more realistic
  const chunks: string[] = [];
  const chunkSize = 100;
  for (let i = 0; i < dataString.length; i += chunkSize) {
    chunks.push(dataString.substring(i, i + chunkSize));
  }
  
  payload.data = chunks;
  return payload;
}

describe('Performance Benchmarks', () => {
  beforeAll(async () => {
    // Initialize all components
    await taskManager.initialize();
    await storageManager.initialize();
    await dataExchange.initialize();
    await messagePersistence.initialize();
    await loadBalancer.initialize();
    await messagePrioritization.initialize();
    
    // Set up fake timers
    vi.useFakeTimers();
  });
  
  afterAll(async () => {
    // Clean up
    await taskManager.shutdown();
    await storageManager.shutdown();
    await dataExchange.shutdown();
    await messagePersistence.shutdown();
    await loadBalancer.shutdown();
    await messagePrioritization.shutdown();
    
    // Restore timers
    vi.useRealTimers();
  });
  
  beforeEach(() => {
    // Clear all mocks
    vi.clearAllMocks();
    subscriptionCallbacks.clear();
  });
  
  describe('Message Throughput', () => {
    it('should handle high volume of task messages', async () => {
      // Register a task handler
      const taskHandler = vi.fn().mockResolvedValue({ result: 'success' });
      taskManager.registerTaskHandler('benchmark.task', taskHandler);
      
      // Number of tasks to create
      const numTasks = 1000;
      const taskIds: string[] = [];
      
      // Measure time to create tasks
      const createTime = await measureExecutionTime(async () => {
        for (let i = 0; i < numTasks; i++) {
          const taskId = await taskManager.createTask('benchmark.task', { index: i });
          taskIds.push(taskId);
        }
      });
      
      // Log performance metrics
      console.log(`Created ${numTasks} tasks in ${createTime.toFixed(2)}ms`);
      console.log(`Average task creation time: ${(createTime / numTasks).toFixed(2)}ms`);
      
      // Verify task creation messages were published
      expect(mockPublish).toHaveBeenCalledTimes(numTasks);
      
      // Simulate processing all tasks
      const processTime = await measureExecutionTime(async () => {
        for (let i = 0; i < numTasks; i++) {
          const taskCreateMsg: Message<TaskCreatePayload> = {
            type: MessageType.TASK_CREATE,
            headers: {
              correlationId: `bench-corr-id-${i}`,
              messageId: `bench-msg-id-${i}`,
              timestamp: new Date().toISOString(),
              source: 'benchmark-service'
            },
            payload: {
              taskId: taskIds[i],
              taskType: 'benchmark.task',
              parameters: { index: i }
            }
          };
          
          await triggerSubscription('task.create', taskCreateMsg);
        }
      });
      
      // Log performance metrics
      console.log(`Processed ${numTasks} tasks in ${processTime.toFixed(2)}ms`);
      console.log(`Average task processing time: ${(processTime / numTasks).toFixed(2)}ms`);
      
      // Verify task handler was called for each task
      expect(taskHandler).toHaveBeenCalledTimes(numTasks);
      
      // Verify task complete messages were published
      expect(mockPublish).toHaveBeenCalledWith(
        'task.complete',
        expect.objectContaining({
          type: MessageType.TASK_COMPLETE
        })
      );
      
      // Assertions for performance thresholds
      expect(createTime / numTasks).toBeLessThan(5); // Average task creation under 5ms
      expect(processTime / numTasks).toBeLessThan(10); // Average task processing under 10ms
    });
  });
  
  describe('Message Persistence Performance', () => {
    it('should efficiently store and retrieve persisted messages', async () => {
      // Number of messages to persist
      const numMessages = 500;
      const messageIds: string[] = [];
      
      // Measure time to persist messages
      const persistTime = await measureExecutionTime(async () => {
        for (let i = 0; i < numMessages; i++) {
          const message: Message<any> = {
            type: MessageType.TASK_CREATE,
            headers: {
              correlationId: `persist-corr-id-${i}`,
              messageId: `persist-msg-id-${i}`,
              timestamp: new Date().toISOString(),
              source: 'benchmark-service'
            },
            payload: {
              taskId: `task-${i}`,
              taskType: 'benchmark.task',
              parameters: { index: i }
            }
          };
          
          const persistenceId = await (messagePersistence as any).persistMessage('benchmark.subject', message);
          messageIds.push(persistenceId);
        }
      });
      
      // Log performance metrics
      console.log(`Persisted ${numMessages} messages in ${persistTime.toFixed(2)}ms`);
      console.log(`Average message persistence time: ${(persistTime / numMessages).toFixed(2)}ms`);
      
      // Measure time to retrieve messages
      const retrieveTime = await measureExecutionTime(async () => {
        for (let i = 0; i < numMessages; i++) {
          await (messagePersistence as any).retrieveMessage(messageIds[i]);
        }
      });
      
      // Log performance metrics
      console.log(`Retrieved ${numMessages} messages in ${retrieveTime.toFixed(2)}ms`);
      console.log(`Average message retrieval time: ${(retrieveTime / numMessages).toFixed(2)}ms`);
      
      // Assertions for performance thresholds
      expect(persistTime / numMessages).toBeLessThan(3); // Average persistence under 3ms
      expect(retrieveTime / numMessages).toBeLessThan(2); // Average retrieval under 2ms
    });
  });
  
  describe('Load Balancer Performance', () => {
    it('should efficiently distribute tasks across services', async () => {
      // Register multiple services with the load balancer
      const numServices = 10;
      
      for (let i = 0; i < numServices; i++) {
        await (loadBalancer as any).registerService(`service-${i}`, ['benchmark.task']);
      }
      
      // Number of task assignments to make
      const numAssignments = 1000;
      
      // Measure time to select services
      const selectionTime = await measureExecutionTime(async () => {
        for (let i = 0; i < numAssignments; i++) {
          await (loadBalancer as any).selectService('benchmark.task', { priority: i % 5 });
        }
      });
      
      // Log performance metrics
      console.log(`Assigned ${numAssignments} tasks in ${selectionTime.toFixed(2)}ms`);
      console.log(`Average task assignment time: ${(selectionTime / numAssignments).toFixed(2)}ms`);
      
      // Assertions for performance thresholds
      expect(selectionTime / numAssignments).toBeLessThan(1); // Average assignment under 1ms
    });
  });
  
  describe('Message Prioritization Performance', () => {
    it('should efficiently prioritize messages based on rules', async () => {
      // Number of messages to prioritize
      const numMessages = 1000;
      const messages: Message<any>[] = [];
      
      // Create messages with different characteristics
      for (let i = 0; i < numMessages; i++) {
        const message: Message<any> = {
          type: i % 5 === 0 ? MessageType.TASK_CREATE :
                i % 5 === 1 ? MessageType.STORAGE_SET :
                i % 5 === 2 ? MessageType.DATA_REQUEST :
                i % 5 === 3 ? MessageType.HEARTBEAT :
                MessageType.SERVICE_STATUS_CHANGE,
          headers: {
            correlationId: `priority-corr-id-${i}`,
            messageId: `priority-msg-id-${i}`,
            timestamp: new Date().toISOString(),
            source: `service-${i % 10}`,
            priority: i % 3 // Different priorities (0, 1, 2)
          },
          payload: {
            // Different payload based on message type
            ...(i % 5 === 0 ? { taskType: 'benchmark.task', parameters: { index: i } } :
               i % 5 === 1 ? { key: `key-${i}`, value: { data: `value-${i}` } } :
               i % 5 === 2 ? { dataType: 'benchmark.data', parameters: { query: `query-${i}` } } :
               i % 5 === 3 ? { timestamp: new Date().toISOString() } :
               { status: 'ONLINE' })
          }
        };
        
        messages.push(message);
      }
      
      // Register prioritization rules
      (messagePrioritization as any).registerRule('high-priority', (message: Message<unknown>) => {
        return message.type === MessageType.TASK_CREATE ? 10 : 0;
      });
      
      (messagePrioritization as any).registerRule('medium-priority', (message: Message<unknown>) => {
        return message.type === MessageType.STORAGE_SET ? 5 : 0;
      });
      
      // Measure time to prioritize messages
      const prioritizeTime = await measureExecutionTime(async () => {
        for (const message of messages) {
          await (messagePrioritization as any).getPriority(message);
        }
      });
      
      // Log performance metrics
      console.log(`Prioritized ${numMessages} messages in ${prioritizeTime.toFixed(2)}ms`);
      console.log(`Average message prioritization time: ${(prioritizeTime / numMessages).toFixed(2)}ms`);
      
      // Assertions for performance thresholds
      expect(prioritizeTime / numMessages).toBeLessThan(0.5); // Average prioritization under 0.5ms
    });
  });
  
  describe('Large Payload Performance', () => {
    it('should handle large message payloads efficiently', async () => {
      // Test with increasing payload sizes
      const payloadSizes = [10, 100, 500, 1000]; // KB
      
      for (const size of payloadSizes) {
        const payload = generateLargePayload(size);
        
        // Measure time to publish message with large payload
        const publishTime = await measureExecutionTime(async () => {
          await natsClient.publish('benchmark.large-payload', {
            type: MessageType.DATA_REQUEST,
            headers: {
              correlationId: `large-payload-${size}`,
              messageId: `large-msg-id-${size}`,
              timestamp: new Date().toISOString(),
              source: 'benchmark-service'
            },
            payload
          });
        });
        
        // Log performance metrics
        console.log(`Published ${size}KB payload in ${publishTime.toFixed(2)}ms`);
        
        // Assertions for performance thresholds (scales with payload size)
        expect(publishTime).toBeLessThan(size * 0.5); // Scales with payload size
      }
    });
  });
});
