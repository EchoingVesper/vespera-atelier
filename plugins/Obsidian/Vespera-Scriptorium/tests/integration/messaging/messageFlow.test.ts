import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { natsClient } from '../../../src/core/messaging/natsClient';
import { taskManager } from '../../../src/core/messaging/taskManager';
import { storageManager } from '../../../src/core/messaging/storageManager';
import { dataExchange } from '../../../src/core/messaging/dataExchange';
import { 
  MessageType, 
  TaskStatus,
  TaskCreatePayload,
  StorageSetPayload,
  DataRequestPayload,
  Message
} from '../../../src/core/messaging/types';

// Mock the NATS client
vi.mock('../../../src/core/messaging/natsClient', () => {
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  const mockSubscribe = vi.fn().mockImplementation((subject, callback) => {
    // Store the callback for later use in tests
    subscriptionCallbacks.set(subject, callback);
    return Promise.resolve(`subscription-${subject}`);
  });
  const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
  const mockWaitForMessage = vi.fn().mockImplementation((subscription, timeout) => {
    // This will be mocked in individual tests
    return Promise.resolve(null);
  });

  const subscriptionCallbacks = new Map();

  return {
    natsClient: {
      publish: mockPublish,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      waitForMessage: mockWaitForMessage,
      isConnected: () => true,
      connect: vi.fn().mockResolvedValue(undefined),
      disconnect: vi.fn().mockResolvedValue(undefined),
      request: vi.fn().mockImplementation((subject, message, options) => {
        // Simulate a request/reply by calling the appropriate callback
        const callback = subscriptionCallbacks.get(subject);
        if (callback) {
          setTimeout(() => callback(message), 10);
        }
        return Promise.resolve({
          data: { result: 'test-response' }
        });
      }),
      __subscriptionCallbacks: subscriptionCallbacks,
      __triggerSubscription: (subject, message) => {
        const callback = subscriptionCallbacks.get(subject);
        if (callback) {
          return callback(message);
        }
        return Promise.resolve();
      }
    },
    __subscriptionCallbacks: subscriptionCallbacks
  };
});

// Access the mock functions and helpers
const mockPublish = vi.mocked(natsClient.publish);
const mockSubscribe = vi.mocked(natsClient.subscribe);
const mockUnsubscribe = vi.mocked(natsClient.unsubscribe);
const mockWaitForMessage = vi.mocked(natsClient.waitForMessage);
const subscriptionCallbacks = (natsClient as any).__subscriptionCallbacks;
const triggerSubscription = (natsClient as any).__triggerSubscription;

describe('Message Flow Integration', () => {
  beforeEach(async () => {
    // Clear all mocks
    vi.clearAllMocks();
    subscriptionCallbacks.clear();
    
    // Initialize components
    await taskManager.initialize();
    await storageManager.initialize();
    await dataExchange.initialize();
  });
  
  afterEach(async () => {
    // Clean up
    await taskManager.shutdown();
    await storageManager.shutdown();
    await dataExchange.shutdown();
  });
  
  describe('Task Management Flow', () => {
    it('should handle task creation and completion', async () => {
      // Register a task handler
      const taskHandler = vi.fn().mockResolvedValue({ result: 'success' });
      taskManager.registerTaskHandler('test.task', taskHandler);
      
      // Create a task
      const taskId = await taskManager.createTask('test.task', { test: 'param' });
      
      // Verify task creation message was published
      expect(mockPublish).toHaveBeenCalledWith(
        'task.create',
        expect.objectContaining({
          type: MessageType.TASK_CREATE,
          payload: expect.objectContaining({
            taskId,
            taskType: 'test.task',
            parameters: { test: 'param' }
          })
        })
      );
      
      // Simulate the task create message being received
      const taskCreateMsg: Message<TaskCreatePayload> = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId,
          taskType: 'test.task',
          parameters: { test: 'param' }
        }
      };
      
      await triggerSubscription('task.create', taskCreateMsg);
      
      // Verify task handler was called
      expect(taskHandler).toHaveBeenCalledWith(
        expect.objectContaining({
          taskId,
          taskType: 'test.task',
          parameters: { test: 'param' }
        })
      );
      
      // Verify task update message was published (task moved to IN_PROGRESS)
      expect(mockPublish).toHaveBeenCalledWith(
        'task.update',
        expect.objectContaining({
          type: MessageType.TASK_UPDATE,
          payload: expect.objectContaining({
            taskId,
            status: TaskStatus.IN_PROGRESS
          })
        })
      );
      
      // Verify task complete message was published
      expect(mockPublish).toHaveBeenCalledWith(
        'task.complete',
        expect.objectContaining({
          type: MessageType.TASK_COMPLETE,
          payload: expect.objectContaining({
            taskId,
            result: { result: 'success' }
          })
        })
      );
    });
    
    it('should handle task failure and retry', async () => {
      // Register a task handler that fails on first call but succeeds on second
      let attemptCount = 0;
      const taskHandler = vi.fn().mockImplementation(async () => {
        attemptCount++;
        if (attemptCount === 1) {
          throw new Error('Test error');
        }
        return { result: 'success after retry' };
      });
      
      taskManager.registerTaskHandler('test.retry.task', taskHandler);
      
      // Create a task
      const taskId = await taskManager.createTask('test.retry.task', { test: 'retry' });
      
      // Simulate the task create message being received
      const taskCreateMsg: Message<TaskCreatePayload> = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId,
          taskType: 'test.retry.task',
          parameters: { test: 'retry' }
        }
      };
      
      await triggerSubscription('task.create', taskCreateMsg);
      
      // Verify task handler was called
      expect(taskHandler).toHaveBeenCalledTimes(1);
      
      // Verify task fail message was published
      expect(mockPublish).toHaveBeenCalledWith(
        'task.fail',
        expect.objectContaining({
          type: MessageType.TASK_FAIL,
          payload: expect.objectContaining({
            taskId,
            error: expect.objectContaining({
              message: 'Test error'
            }),
            retryable: true
          })
        })
      );
      
      // Fast-forward time to trigger retry (mock setTimeout)
      vi.advanceTimersByTime(1000);
      
      // Verify task handler was called again
      expect(taskHandler).toHaveBeenCalledTimes(2);
      
      // Verify task complete message was published after retry
      expect(mockPublish).toHaveBeenCalledWith(
        'task.complete',
        expect.objectContaining({
          type: MessageType.TASK_COMPLETE,
          payload: expect.objectContaining({
            taskId,
            result: { result: 'success after retry' }
          })
        })
      );
    });
  });
  
  describe('Storage Operations Flow', () => {
    it('should handle setting and getting values', async () => {
      // Set a value
      await storageManager.setValue('test-key', { data: 'test-value' }, { namespace: 'test-ns' });
      
      // Verify storage set message was published
      expect(mockPublish).toHaveBeenCalledWith(
        'storage.set',
        expect.objectContaining({
          type: MessageType.STORAGE_SET,
          payload: expect.objectContaining({
            key: 'test-key',
            namespace: 'test-ns',
            value: { data: 'test-value' }
          })
        })
      );
      
      // Get the value
      const value = await storageManager.getValue('test-key', { namespace: 'test-ns' });
      
      // Verify the value was retrieved
      expect(value).toEqual({ data: 'test-value' });
      
      // Verify storage get message was published
      expect(mockPublish).toHaveBeenCalledWith(
        'storage.get',
        expect.objectContaining({
          type: MessageType.STORAGE_GET,
          payload: expect.objectContaining({
            key: 'test-key',
            namespace: 'test-ns'
          })
        })
      );
    });
    
    it('should handle requesting values from other services', async () => {
      // Mock waitForMessage to return a response
      mockWaitForMessage.mockImplementationOnce((subscription, timeout) => {
        return Promise.resolve({
          payload: {
            value: {
              value: { data: 'remote-value' },
              version: 1,
              createdAt: new Date().toISOString(),
              updatedAt: new Date().toISOString()
            }
          }
        });
      });
      
      // Request a value that's not in local cache
      const value = await storageManager.getValue('remote-key', { namespace: 'remote-ns' });
      
      // Verify storage request message was published
      expect(mockPublish).toHaveBeenCalledWith(
        'storage.request',
        expect.objectContaining({
          type: MessageType.STORAGE_REQUEST,
          payload: expect.objectContaining({
            key: 'remote-key',
            namespace: 'remote-ns',
            requesterId: expect.any(String)
          })
        })
      );
      
      // Verify the value was retrieved from the remote service
      expect(value).toEqual({ data: 'remote-value' });
    });
  });
  
  describe('Data Exchange Flow', () => {
    it('should handle data requests and responses', async () => {
      // Register a data provider
      const dataProvider = vi.fn().mockResolvedValue({ result: 'test-data' });
      dataExchange.registerDataProvider('test.data', dataProvider);
      
      // Set up a mock response callback
      const responseCallback = vi.fn();
      (dataExchange as any).requestCallbacks.set('test-req-123', responseCallback);
      
      // Simulate a data request message
      const dataRequestMsg: Message<DataRequestPayload> = {
        type: MessageType.DATA_REQUEST,
        headers: {
          correlationId: 'test-corr-id',
          messageId: 'test-msg-id',
          timestamp: new Date().toISOString(),
          source: 'requester-service',
          replyTo: 'requester.response.test-req-123'
        },
        payload: {
          requestId: 'test-req-123',
          dataType: 'test.data',
          parameters: { query: 'test' }
        }
      };
      
      await triggerSubscription('data.request', dataRequestMsg);
      
      // Verify data provider was called
      expect(dataProvider).toHaveBeenCalledWith(
        { query: 'test' },
        'test-req-123'
      );
      
      // Verify response was published
      expect(mockPublish).toHaveBeenCalledWith(
        'requester.response.test-req-123',
        expect.objectContaining({
          type: MessageType.DATA_RESPONSE,
          payload: expect.objectContaining({
            requestId: 'test-req-123',
            data: { result: 'test-data' }
          })
        })
      );
    });
  });
});
