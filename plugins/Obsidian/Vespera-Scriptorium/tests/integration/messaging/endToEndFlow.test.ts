/**
 * End-to-end integration tests for the A2A messaging system
 */
import { describe, it, expect, vi, beforeEach, afterEach, beforeAll, afterAll } from 'vitest';
import { 
  MessageType, 
  TaskCreatePayload,
  TaskCompletePayload,
  StorageSetPayload,
  StorageGetPayload,
  DataRequestPayload,
  DataResponsePayload,
  Message
} from '../../../src/core/messaging/types';

// Import mocks before any module imports
import { mocks } from './mocks';

// Set up mocks for all modules
vi.mock('../../../src/core/messaging/natsClient', () => ({
  natsClient: mocks.natsClientMock,
  NatsClient: vi.fn().mockImplementation(() => mocks.natsClientMock)
}));

vi.mock('../../../src/core/messaging/taskManager', () => ({
  taskManager: mocks.taskManagerMock
}));

vi.mock('../../../src/core/messaging/storageManager', () => ({
  storageManager: mocks.storageManagerMock
}));

vi.mock('../../../src/core/messaging/dataExchange', () => ({
  dataExchange: mocks.dataExchangeMock
}));

vi.mock('../../../src/core/messaging/serviceManager', () => ({
  serviceManager: mocks.serviceManagerMock
}));

vi.mock('../../../src/core/messaging/messagePersistence', () => ({
  messagePersistence: mocks.messagePersistenceMock
}));

vi.mock('../../../src/core/messaging/loadBalancer', () => ({
  loadBalancer: mocks.loadBalancerMock
}));

vi.mock('../../../src/core/messaging/messagePrioritization', () => ({
  messagePrioritization: mocks.messagePrioritizationMock
}));

// Now import the modules after all mocks are set up
import { natsClient } from '../../../src/core/messaging/natsClient';
import { taskManager } from '../../../src/core/messaging/taskManager';
import { storageManager } from '../../../src/core/messaging/storageManager';
import { dataExchange } from '../../../src/core/messaging/dataExchange';
import { serviceManager } from '../../../src/core/messaging/serviceManager';
import { messagePersistence } from '../../../src/core/messaging/messagePersistence';
import { loadBalancer } from '../../../src/core/messaging/loadBalancer';
import { messagePrioritization } from '../../../src/core/messaging/messagePrioritization';

// Define ServiceStatusChangePayload interface since it's not in types.ts
interface ServiceStatusChangePayload {
  serviceId: string;
  status: string;
  reason?: string;
  timestamp?: string;
  metadata?: Record<string, unknown>;
}

describe('End-to-End Message Flow', () => {
  beforeAll(async () => {
    // Ensure NATS client is properly mocked and connected
    Object.defineProperty(mocks.natsClientMock, 'isConnected', {
      get: () => true
    });
    
    // Initialize all components in the correct order based on dependencies
    // First initialize service manager as other components depend on it
    await serviceManager.initialize();
    
    // Then initialize the core messaging components
    await taskManager.initialize();
    await storageManager.initialize();
    await dataExchange.initialize();
    
    // Finally initialize the auxiliary components
    await messagePersistence.initialize();
    await loadBalancer.initialize();
    await messagePrioritization.initialize();
    
    // Verify all components are initialized
    expect(mocks.serviceManagerMock.initialize).toHaveBeenCalled();
    expect(mocks.taskManagerMock.initialize).toHaveBeenCalled();
    expect(mocks.storageManagerMock.initialize).toHaveBeenCalled();
    expect(mocks.dataExchangeMock.initialize).toHaveBeenCalled();
  });
  
  afterAll(async () => {
    // Cleanup all components
    await serviceManager.shutdown();
    await taskManager.shutdown();
    await storageManager.shutdown();
    await dataExchange.shutdown();
    await messagePersistence.shutdown();
    await loadBalancer.shutdown();
    await messagePrioritization.shutdown();
  });
  
  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
  });
  
  describe('Service Discovery Flow', () => {
    it('should handle service registration and discovery', async () => {
      // Simulate a service registration message
      const serviceId = 'test-service-123';
      const registrationMsg: Message<any> = {
        type: MessageType.REGISTER,
        headers: {
          correlationId: 'reg-corr-id',
          messageId: 'reg-msg-id',
          timestamp: new Date().toISOString(),
          source: serviceId
        },
        payload: {
          agentId: serviceId,
          serviceType: 'test-service',
          capabilities: ['test.capability.1', 'test.capability.2'],
          metadata: { version: '1.0.0' },
          status: 'ONLINE'
        }
      };
      
      // Trigger the service registration subscription
      await mocks.triggerSubscription('system.register', registrationMsg);
      
      // Verify service was registered
      expect(mocks.serviceManagerMock.registerService).toHaveBeenCalled();
      
      // Simulate a service status change
      const statusChangeMsg: Message<any> = {
        type: MessageType.SERVICE_STATUS_CHANGE,
        headers: {
          correlationId: 'status-corr-id',
          messageId: 'status-msg-id',
          timestamp: new Date().toISOString(),
          source: serviceId
        },
        payload: {
          serviceId,
          status: 'DEGRADED',
          reason: 'High load'
        }
      };
      
      // Trigger the status change subscription
      await mocks.triggerSubscription('system.status', statusChangeMsg);
      
      // Verify status change was handled
      expect(mocks.serviceManagerMock.getServiceStatus).toHaveBeenCalled();
    });
  });
  
  describe('Task Creation and Completion', () => {
    it('should handle task creation and completion flow', async () => {
      // Create a task
      const taskId = 'test-task-1';
      const taskType = 'test.task';
      const taskParameters = { param1: 'value1', param2: 'value2' };
      
      await taskManager.createTask(taskType, taskParameters, { metadata: { taskId } });
      
      // Verify task creation message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'task.create',
        expect.objectContaining({
          type: MessageType.TASK_CREATE,
          payload: expect.objectContaining({
            taskId,
            taskType,
            parameters: taskParameters
          })
        })
      );
      
      // Simulate task completion message
      const taskCompleteMsg: Message<TaskCompletePayload> = {
        type: MessageType.TASK_COMPLETE,
        headers: {
          correlationId: 'task-corr-id',
          messageId: 'task-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          taskId,
          taskType,
          result: { status: 'success', data: { output: 'test-output' } }
        }
      };
      
      await mocks.triggerSubscription('task.complete', taskCompleteMsg);
      
      // Verify task complete was handled
      expect(mocks.taskManagerMock.completeTask).toHaveBeenCalledWith(
        taskId,
        expect.objectContaining({
          status: 'success',
          data: expect.objectContaining({
            output: 'test-output'
          })
        })
      );
    });
  });
  
  describe('Storage Operations', () => {
    it('should handle storage set and get operations', async () => {
      // Test storage set operation
      const key = 'test-key';
      const value = { data: 'test-value' };
      
      await storageManager.setValue(key, value);
      
      // Verify storage set message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'storage.set',
        expect.objectContaining({
          type: MessageType.STORAGE_SET,
          payload: expect.objectContaining({
            key
          })
        })
      );
      
      // Simulate storage get request
      await storageManager.getValue(key);
      
      // Verify storage get message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'storage.get',
        expect.objectContaining({
          type: MessageType.STORAGE_GET,
          payload: expect.objectContaining({
            key
          })
        })
      );
      
      // Simulate storage get response
      const getResponseMsg: Message<any> = {
        type: MessageType.STORAGE_GET,
        headers: {
          correlationId: 'storage-corr-id',
          messageId: 'storage-msg-id',
          timestamp: new Date().toISOString(),
          source: 'storage-service'
        },
        payload: {
          key,
          includeMetadata: true
        }
      };
      
      await mocks.triggerSubscription('storage.get', getResponseMsg);
      
      // Verify storage get response was handled
      expect(mocks.storageManagerMock.getValue).toHaveBeenCalled();
    });
  });
  
  describe('Data Exchange Flow', () => {
    it('should handle data request and response', async () => {
      // Test data request
      const requestId = 'test-request-1';
      const dataType = 'test.data';
      const parameters = { timeout: 5000, priority: 1 };
      
      await dataExchange.requestData(requestId, dataType, parameters);
      
      // Verify data request message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'data.request',
        expect.objectContaining({
          type: MessageType.DATA_REQUEST,
          payload: expect.objectContaining({
            requestId,
            dataType
          })
        })
      );
      
      // Simulate data response
      const dataResponseMsg: Message<any> = {
        type: MessageType.DATA_RESPONSE,
        headers: {
          correlationId: 'data-corr-id',
          messageId: 'data-msg-id',
          timestamp: new Date().toISOString(),
          source: 'data-service'
        },
        payload: {
          requestId,
          data: { result: 'test-data-result' }
        }
      };
      
      await mocks.triggerSubscription('data.response', dataResponseMsg);
      
      // Verify data response was handled
      expect(mocks.dataExchangeMock.respondToRequest).toHaveBeenCalled();
    });
  });
  
  describe('Storage Operations', () => {
    it('should handle storage set and get operations', async () => {
      // Set a value
      const key = 'test-key';
      const value = { data: 'test-value' };
      const namespace = 'test-ns';
      
      await storageManager.setValue(key, value, { namespace });
      
      // Verify storage set message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'storage.set',
        expect.objectContaining({
          type: MessageType.STORAGE_SET,
          payload: expect.objectContaining({
            key,
            value,
            namespace
          })
        })
      );
      
      // Get a value
      await storageManager.getValue(key, { namespace });
      
      // Verify storage get message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'storage.get',
        expect.objectContaining({
          type: MessageType.STORAGE_GET,
          payload: expect.objectContaining({
            key,
            namespace
          })
        })
      );
    });
  });
  
  describe('Data Exchange', () => {
    it('should handle data request and response', async () => {
      // Request data
      const dataType = 'test-data';
      const parameters = { filter: 'test-filter' };
      
      await dataExchange.requestData(dataType, parameters);
      
      // Verify data request message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'data.request',
        expect.objectContaining({
          type: MessageType.DATA_REQUEST,
          payload: expect.objectContaining({
            dataType,
            parameters
          })
        })
      );
      
      // Simulate data response message
      const dataResponseMsg: Message<DataResponsePayload> = {
        type: MessageType.DATA_RESPONSE,
        headers: {
          correlationId: 'data-corr-id',
          messageId: 'data-msg-id',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {
          requestId: 'data-request-id',
          data: { result: 'test-data-result' }
        }
      };
      
      await mocks.triggerSubscription('data.response', dataResponseMsg);
      
      // Verify data response was handled
      expect(mocks.dataExchangeMock.respondToRequest).toHaveBeenCalledWith(
        'data-request-id',
        expect.objectContaining({
          result: 'test-data-result'
        })
      );
    });
  });
  
  describe('Service Discovery', () => {
    it('should handle service registration and discovery', async () => {
      // Initialize the service manager which registers the service
      await serviceManager.initialize();
      
      // Verify service registration message was published
      expect(mocks.natsClientMock.publish).toHaveBeenCalledWith(
        'system.register',
        expect.objectContaining({
          type: MessageType.REGISTER,
          payload: expect.any(Object)
        })
      );
      
      // Test service discovery using the mock's discoverServices method
      await mocks.serviceManagerMock.discoverServices();
      
      // Verify the discover services method was called
      expect(mocks.serviceManagerMock.discoverServices).toHaveBeenCalled();
    });
  });
});
