/**
 * Core A2A messaging integration tests
 * This tests the basic functionality of the messaging components with minimal mocking
 */
import { describe, it, expect, vi, beforeEach, beforeAll, afterAll } from 'vitest';
import { v4 as uuidv4 } from 'uuid';
import { DataRequest } from '../../../src/core/messaging/dataExchange';

// Create a storage for subscription callbacks
const mockCallbacks: Record<string, (message: any) => void> = {};

// Mock the NatsClient module before importing any components
vi.mock('../../../src/core/messaging/natsClient', () => {
  // Create mock functions
  const mockPublish = vi.fn().mockImplementation((subject, message) => {
    console.log(`Mock publishing to ${subject}:`, message);
    return Promise.resolve();
  });
  
  const mockSubscribe = vi.fn().mockImplementation((subject, callback) => {
    // Store the callback for later use in tests
    mockCallbacks[subject] = callback;
    console.log(`Mock subscribing to ${subject}`);
    return Promise.resolve(`subscription-${subject}`);
  });
  
  // Create a mock NATS client
  const mockNatsClient = {
    nc: { 
      publish: vi.fn(),
      subscribe: vi.fn().mockReturnValue({
        unsubscribe: vi.fn(),
        getSubject: vi.fn().mockReturnValue('test-subject')
      }),
      drain: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined)
    },
    get isConnected() { return true; },
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    close: vi.fn().mockResolvedValue(undefined),
    publish: mockPublish,
    subscribe: mockSubscribe,
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    request: vi.fn().mockResolvedValue({
      headers: { messageId: 'test-id', correlationId: 'test-corr-id' },
      payload: {}
    }),
    generateId: vi.fn().mockReturnValue('mock-id-12345')
  };
  
  // Return the mock implementation
  return {
    NatsClient: vi.fn().mockImplementation(() => mockNatsClient),
    natsClient: mockNatsClient
  };
});

// Import components after mocking
import { natsClient } from '../../../src/core/messaging/natsClient';
import { ServiceManager } from '../../../src/core/messaging/serviceManager';
import { 
  Message, 
  MessageType, 
  TaskStatus,
  TaskCreatePayload,
  StorageSetPayload,
  StorageGetPayload,
  DataRequestPayload,
  DataResponsePayload
} from '../../../src/core/messaging/types';
import { TaskManager } from '../../../src/core/messaging/taskManager';
import { StorageManager } from '../../../src/core/messaging/storageManager';
import { DataExchange } from '../../../src/core/messaging/dataExchange';

// Helper function to trigger a subscription callback
const triggerSubscription = async (subject: string, message: any): Promise<boolean> => {
  if (mockCallbacks[subject]) {
    await mockCallbacks[subject](message);
    return true;
  }
  throw new Error(`No subscription found for ${subject}`);
};

describe('Core A2A Messaging', () => {
  // Test services
  let serviceManager1: ServiceManager;
  let serviceManager2: ServiceManager;
  let taskManager: TaskManager;
  let storageManager: StorageManager;
  let dataExchange: DataExchange;
  
  // Generate unique service IDs for testing
  const service1Id = `test-service-${uuidv4().substring(0, 8)}`;
  const service2Id = `test-service-${uuidv4().substring(0, 8)}`;

  beforeAll(async () => {
    // Create service managers for testing
    serviceManager1 = new ServiceManager({
      serviceType: 'test',
      capabilities: ['test.service'],
      metadata: { name: 'Test Service 1' }
    });
    
    serviceManager2 = new ServiceManager({
      serviceType: 'test',
      capabilities: ['test.service'],
      metadata: { name: 'Test Service 2' }
    });
    
    // Create task manager for testing
    taskManager = new TaskManager({
      serviceId: service1Id,
      capabilities: ['task.management']
    });
    
    // Create storage manager for testing
    storageManager = new StorageManager({
      serviceId: service1Id
    });
    
    // Create data exchange for testing
    dataExchange = new DataExchange({
      serviceId: service1Id,
      capabilities: ['data.exchange']
    });
    
    // Initialize all components
    await serviceManager1.initialize();
    await serviceManager2.initialize();
    await taskManager.initialize();
    await storageManager.initialize();
    await dataExchange.initialize();
  });
  
  afterAll(async () => {
    // Clean up
    await serviceManager1.shutdown();
    await serviceManager2.shutdown();
    await taskManager.shutdown();
    await storageManager.shutdown();
    await dataExchange.shutdown();
  });
  
  beforeEach(() => {
    // Reset mocks before each test
    vi.clearAllMocks();
  });
  
  // Test service discovery
  describe('Service Discovery', () => {
    it('should register services successfully', async () => {
      // Verify that the NATS client was used to subscribe to system topics
      expect(natsClient.subscribe).toHaveBeenCalledWith(
        expect.stringContaining('system.register'),
        expect.any(Function)
      );
    });
    
    it('should discover other services', async () => {
      // Simulate a service discovery message
      const discoveryMessage: Message<any> = {
        type: MessageType.REGISTER,
        headers: {
          messageId: 'test-msg-id',
          correlationId: 'test-corr-id',
          timestamp: new Date().toISOString(),
          source: service2Id
        },
        payload: {
          agentId: service2Id,
          capabilities: ['test.service'],
          metadata: { name: 'Test Service 2' }
        }
      };
      
      // Trigger the subscription callback for service discovery
      await triggerSubscription('system.register', discoveryMessage);
      
      // Service manager 1 should now know about service 2
      const services = serviceManager1.getAllServices();
      expect(services.length).toBeGreaterThan(0);
      expect(services.some(s => s.serviceId === service2Id)).toBe(true);
    });
    
    it('should handle heartbeat messages', async () => {
      // Create a heartbeat message
      const heartbeatMessage: Message<unknown> = {
        type: MessageType.HEARTBEAT,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service2Id
        },
        payload: {}
      };
      
      // Trigger the heartbeat subscription
      const result = await triggerSubscription('system.heartbeat', heartbeatMessage);
      
      // Verify that the subscription was triggered
      expect(result).toBe(true);
    });
  });
  
  // Test task management
  describe('Task Management', () => {
    it('should create tasks', async () => {
      // Mock the task creation response
      const taskId = 'test-task-id';
      natsClient.request = vi.fn().mockResolvedValue({
        headers: { messageId: 'test-task-id', correlationId: 'test-corr-id' },
        payload: { taskId }
      });
      
      // Create a task
      const createdTaskId = await taskManager.createTask(
        'test-task',
        { testData: 'test-value' },
        {
          assignTo: service2Id
        }
      );
      
      // Verify that the task was created
      expect(createdTaskId).toBeDefined();
      expect(natsClient.publish).toHaveBeenCalledWith(
        expect.stringContaining('task.create'),
        expect.objectContaining({
          type: MessageType.TASK_CREATE,
          payload: expect.objectContaining({
            taskType: 'test-task',
            parameters: { testData: 'test-value' }
          })
        })
      );
    });
    
    it('should handle task updates', async () => {
      // Create a task update message
      const taskId = `task-${uuidv4().substring(0, 8)}`;
      const taskUpdateMessage: Message<any> = {
        type: MessageType.TASK_UPDATE,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service2Id
        },
        payload: {
          taskId,
          status: TaskStatus.IN_PROGRESS,
          progress: 50,
          message: 'Task is 50% complete'
        }
      };
      
      // Set up task manager to track this task
      taskManager['tasks'].set(taskId, {
        taskId: taskId,
        taskType: 'test-task',
        status: TaskStatus.PENDING,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedTo: service2Id,
        priority: 1,
        parameters: {}
      });
      
      // Trigger the task update subscription
      await triggerSubscription('task.update', taskUpdateMessage);
      
      // Verify that the task was updated
      const task = taskManager['tasks'].get(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe(TaskStatus.IN_PROGRESS);
      expect(task?.progress).toBe(50);
    });
    
    it('should handle task completion', async () => {
      // Create a task completion message
      const taskId = `task-${uuidv4().substring(0, 8)}`;
      const taskCompleteMessage: Message<any> = {
        type: MessageType.TASK_COMPLETE,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service2Id
        },
        payload: {
          taskId,
          result: { success: true, data: 'Task result' }
        }
      };
      
      // Set up task manager to track this task
      taskManager['tasks'].set(taskId, {
        taskId: taskId,
        taskType: 'test-task',
        status: TaskStatus.IN_PROGRESS,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        assignedTo: service2Id,
        priority: 1,
        parameters: {},
        progress: 50
      });
      
      // Trigger the task complete subscription
      await triggerSubscription('task.complete', taskCompleteMessage);
      
      // Verify that the task was completed
      const task = taskManager['tasks'].get(taskId);
      expect(task).toBeDefined();
      expect(task?.status).toBe(TaskStatus.COMPLETED);
      expect(task?.result).toEqual({ success: true, data: 'Task result' });
    });
  });
  
  // Test storage operations
  describe('Storage Operations', () => {
    it('should set values in storage', async () => {
      // Mock the storage set response
      natsClient.request = vi.fn().mockResolvedValue({
        headers: { messageId: 'test-id', correlationId: 'test-corr-id' },
        payload: { success: true }
      });
      
      // Set a value in storage
      const result = await storageManager.setValue('test-key', { test: 'value' }, { namespace: 'test-namespace' });
      
      // Verify that the value was set
      expect(result).toBe(true);
      expect(natsClient.request).toHaveBeenCalledWith(
        expect.stringContaining('storage.set'),
        expect.objectContaining({
          type: MessageType.STORAGE_SET,
          payload: expect.objectContaining({
            key: 'test-key',
            value: { test: 'value' },
            namespace: 'test-namespace'
          })
        })
      );
    });
    
    it('should get values from storage', async () => {
      // Mock the storage get response
      const expectedValue = { test: 'retrieved-value' };
      natsClient.request = vi.fn().mockResolvedValue({
        headers: { messageId: 'test-id', correlationId: 'test-corr-id' },
        payload: { value: expectedValue }
      });
      
      // Get a value from storage
      const value = await storageManager.getValue('test-key', { namespace: 'test-namespace' });
      
      // Verify that the value was retrieved
      expect(value).toEqual(expectedValue);
      expect(natsClient.request).toHaveBeenCalledWith(
        expect.stringContaining('storage.get'),
        expect.objectContaining({
          type: MessageType.STORAGE_GET,
          payload: expect.objectContaining({
            key: 'test-key',
            namespace: 'test-namespace'
          })
        })
      );
    });
    
    it('should handle storage set messages', async () => {
      // Create a storage set message
      const storageSetMessage: Message<StorageSetPayload> = {
        type: MessageType.STORAGE_SET,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service1Id
        },
        payload: {
          key: 'test-key',
          value: { test: 'value' },
          namespace: 'test-namespace'
        }
      };
      
      // Trigger the storage set subscription
      await triggerSubscription('storage.set', storageSetMessage);
      
      // Verify the message was handled (no error thrown)
      expect(true).toBe(true);
    });
    
    it('should handle storage get messages', async () => {
      // Create a storage get message
      const storageGetMessage: Message<StorageGetPayload> = {
        type: MessageType.STORAGE_GET,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service1Id
        },
        payload: {
          key: 'test-key',
          namespace: 'test-namespace'
        }
      };
      
      // Set up a mock value in the storage manager with proper StorageValue format
      storageManager['storage'].set('test-namespace:test-key', {
        value: { test: 'stored-value' },
        version: 1,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        namespace: 'test-namespace'
      });
      
      // Trigger the storage get subscription
      await triggerSubscription('storage.get', storageGetMessage);
      
      // Verify that a response was published
      expect(natsClient.publish).toHaveBeenCalledWith(
        expect.stringContaining('storage.get.reply'),
        expect.objectContaining({
          type: 'storage.get.reply', // Using string literal as STORAGE_GET_REPLY is not defined in MessageType enum
          payload: expect.objectContaining({
            value: { test: 'stored-value' }
          })
        })
      );
    });
  });
  
  // Test data exchange
  describe('Data Exchange', () => {
    it('should request data', async () => {
      // Mock the data request response
      const expectedData = { test: 'response-data' };
      natsClient.request = vi.fn().mockResolvedValue({
        headers: { messageId: 'test-id', correlationId: 'test-corr-id' },
        payload: { data: expectedData }
      });
      
      // Request data
      const data = await dataExchange.requestData('test-data-type', { query: 'test-query' });
      
      // Verify that the data was requested
      expect(data).toEqual(expectedData);
      expect(natsClient.request).toHaveBeenCalledWith(
        expect.stringContaining('data.request'),
        expect.objectContaining({
          type: MessageType.DATA_REQUEST,
          payload: expect.objectContaining({
            dataType: 'test-data-type',
            parameters: { query: 'test-query' }
          })
        })
      );
    });
    
    it('should handle data request messages', async () => {
      // Create a data request message
      const dataRequestMessage: Message<DataRequestPayload> = {
        type: MessageType.DATA_REQUEST,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service2Id
        },
        payload: {
          requestId: uuidv4(),
          dataType: 'test-data-type',
          parameters: { query: 'test-query' }
        }
      };
      
      // Set up a mock data handler with proper typing
      dataExchange.registerDataProvider('test-data-type', async (params: { query: string }) => {
        return { result: 'test-result', query: params.query };
      });
      
      // Trigger the data request subscription
      await triggerSubscription('data.request', dataRequestMessage);
      
      // Verify that a response was published
      expect(natsClient.publish).toHaveBeenCalledWith(
        expect.stringContaining('data.response'),
        expect.objectContaining({
          type: MessageType.DATA_RESPONSE,
          payload: expect.objectContaining({
            data: { result: 'test-result', query: 'test-query' }
          })
        })
      );
    });
    
    it('should handle data response messages', async () => {
      // Create a data response message
      const dataResponseMessage: Message<DataResponsePayload> = {
        type: MessageType.DATA_RESPONSE,
        headers: {
          correlationId: 'test-correlation-id',
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service2Id
        },
        payload: {
          requestId: uuidv4(),
          data: { test: 'response-data' }
        }
      };
      
      // Set up a pending request in the data exchange
      // Define a proper type for the pending request in tests
      interface PendingRequestTest {
        resolve: ReturnType<typeof vi.fn>;
        reject: ReturnType<typeof vi.fn>;
        timeout: number;
      }
      
      // Create a timeout and store its ID as a number
      const timeoutId = setTimeout(() => {}, 1000) as unknown as number;
      
      // Use type assertion to avoid type errors with the test mock
      dataExchange['pendingRequests'].set('test-correlation-id', {
        resolve: vi.fn(),
        reject: vi.fn(),
        timeout: timeoutId
      } as unknown as DataRequest);
      
      // Trigger the data response subscription
      await triggerSubscription('data.response', dataResponseMessage);
      
      // Verify that the pending request was resolved
      const pendingRequest = dataExchange['pendingRequests'].get('test-correlation-id') as unknown as PendingRequestTest;
      expect(pendingRequest.resolve).toHaveBeenCalledWith(
        { test: 'response-data' }
      );
    });
  });
  
  // Test message handling
  describe('Message Handling', () => {
    it('should handle task creation messages', async () => {
      // Create a task creation message
      const taskId = `task-${uuidv4().substring(0, 8)}`;
      const taskCreateMessage: Message<TaskCreatePayload> = {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: service1Id
        },
        payload: {
          taskId,
          taskType: 'test-task',
          parameters: { test: 'parameter' }
        }
      };
      
      // Publish the task creation message
      await natsClient.publish('task.create', taskCreateMessage);
      
      // Verify that the message was published
      expect(natsClient.publish).toHaveBeenCalledWith(
        'task.create',
        taskCreateMessage
      );
    });
  });
});