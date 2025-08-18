/**
 * Centralized mock setup for integration tests
 */
import { vi } from 'vitest';
import { Message, MessageType } from '../../../src/core/messaging/types';
import { PersistedMessage } from '../../../src/core/messaging/messagePersistence';

// Create mock implementations
export const createMocks = () => {
  // Track subscriptions and callbacks
  const subscriptions: Record<string, (message: Message<unknown>) => void> = {};
  
  // NATS client mock
  const natsClientMock = {
    get isConnected() { return true; },
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockImplementation((subject, message) => {
      console.log(`Mock publishing to ${subject}:`, message);
      return Promise.resolve();
    }),
    subscribe: vi.fn().mockImplementation((subject, callback) => {
      console.log(`Mock subscribing to ${subject}`);
      subscriptions[subject] = callback;
      return Promise.resolve(`subscription-${subject}`);
    }),
    unsubscribe: vi.fn().mockResolvedValue(undefined),
  };
  
  // Helper to trigger a subscription callback
  const triggerSubscription = async (subject: string, message: Message<unknown>) => {
    console.log(`Triggering subscription for ${subject}:`, message);
    if (subscriptions[subject]) {
      await subscriptions[subject](message);
      return true;
    }
    console.log(`No subscription found for ${subject}`);
    return false;
  };

  // Task manager mock
  const taskManagerMock = {
    initialize: vi.fn().mockImplementation(async () => {
      console.log('Mock taskManager.initialize called');
      // Subscribe to task-related subjects
      await natsClientMock.subscribe('task.complete', vi.fn());
      return Promise.resolve();
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    createTask: vi.fn().mockImplementation(async (taskId, taskType, parameters) => {
      console.log('Mock taskManager.createTask called:', { taskId, taskType, parameters });
      // Publish task creation message
      await natsClientMock.publish('task.create', {
        type: MessageType.TASK_CREATE,
        headers: {
          correlationId: `task-${taskId}`,
          messageId: `msg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: { taskId, taskType, parameters }
      });
      return Promise.resolve({ taskId });
    }),
    completeTask: vi.fn().mockResolvedValue(undefined),
    getTaskStatus: vi.fn().mockResolvedValue({ status: 'pending' }),
    cancelTask: vi.fn().mockResolvedValue(undefined),
  };

  // Storage manager mock
  const storageManagerMock = {
    initialize: vi.fn().mockImplementation(async () => {
      console.log('Mock storageManager.initialize called');
      // Subscribe to storage-related subjects
      await natsClientMock.subscribe('storage.set.reply', vi.fn());
      await natsClientMock.subscribe('storage.get.reply', vi.fn());
      return Promise.resolve();
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    setValue: vi.fn().mockImplementation(async (key, value, options = {}) => {
      console.log('Mock storageManager.setValue called:', { key, value, options });
      // Publish storage set message
      await natsClientMock.publish('storage.set', {
        type: MessageType.STORAGE_SET,
        headers: {
          correlationId: `storage-${key}`,
          messageId: `msg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: { key, value, namespace: options.namespace }
      });
      return Promise.resolve();
    }),
    getValue: vi.fn().mockImplementation(async (key, options = {}) => {
      console.log('Mock storageManager.getValue called:', { key, options });
      // Publish storage get message
      await natsClientMock.publish('storage.get', {
        type: MessageType.STORAGE_GET,
        headers: {
          correlationId: `storage-${key}`,
          messageId: `msg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: { key, namespace: options.namespace }
      });
      return Promise.resolve({ data: 'test-value' });
    }),
    deleteValue: vi.fn().mockResolvedValue(undefined),
    listKeys: vi.fn().mockResolvedValue(['key1', 'key2']),
  };

  // Data exchange mock
  const dataExchangeMock = {
    initialize: vi.fn().mockImplementation(async () => {
      console.log('Mock dataExchange.initialize called');
      // Subscribe to data-related subjects
      await natsClientMock.subscribe('data.response', vi.fn());
      return Promise.resolve();
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    requestData: vi.fn().mockImplementation(async (dataType, parameters) => {
      console.log('Mock dataExchange.requestData called:', { dataType, parameters });
      // Publish data request message
      await natsClientMock.publish('data.request', {
        type: MessageType.DATA_REQUEST,
        headers: {
          correlationId: `data-${dataType}`,
          messageId: `msg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: { dataType, parameters, requestId: 'data-request-id' }
      });
      return Promise.resolve({ result: 'test-data' });
    }),
    respondToRequest: vi.fn().mockResolvedValue(undefined),
    streamData: vi.fn().mockResolvedValue(undefined),
    subscribeToStream: vi.fn().mockResolvedValue('stream-subscription-id'),
  };

  // Service manager mock
  const serviceManagerMock = {
    initialize: vi.fn().mockImplementation(async () => {
      console.log('Mock serviceManager.initialize called');
      // Subscribe to service-related subjects
      await natsClientMock.subscribe('service.register', vi.fn());
      await natsClientMock.subscribe('service.heartbeat', vi.fn());
      return Promise.resolve();
    }),
    shutdown: vi.fn().mockResolvedValue(undefined),
    registerService: vi.fn().mockImplementation(async (serviceId, serviceType, capabilities) => {
      console.log('Mock serviceManager.registerService called:', { serviceId, serviceType, capabilities });
      // Publish service register message
      await natsClientMock.publish('service.register', {
        type: MessageType.SERVICE_REGISTER,
        headers: {
          correlationId: `service-${serviceId}`,
          messageId: `msg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: serviceId
        },
        payload: { serviceId, serviceType, capabilities }
      });
      return Promise.resolve();
    }),
    unregisterService: vi.fn().mockResolvedValue(undefined),
    getServiceStatus: vi.fn().mockReturnValue('online'),
    discoverServices: vi.fn().mockResolvedValue([
      { serviceId: 'service-1', serviceType: 'type-1', capabilities: ['cap1'] },
      { serviceId: 'service-2', serviceType: 'type-2', capabilities: ['cap2'] },
    ]),
  };

  // Message persistence mock
  const messagePersistenceMock = {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    persistMessage: vi.fn().mockImplementation((message: Message<unknown>) => {
      return Promise.resolve({
        id: `persisted-${Math.random().toString(36).substring(2, 9)}`,
        message,
        timestamp: new Date().toISOString(),
        status: 'persisted'
      } as unknown as PersistedMessage<unknown>);
    }),
    getPersistedMessages: vi.fn().mockResolvedValue([]),
    deletePersistedMessage: vi.fn().mockResolvedValue(true),
    markMessageAsProcessed: vi.fn().mockResolvedValue(true),
  };

  // Load balancer mock
  const loadBalancerMock = {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    registerService: vi.fn().mockResolvedValue(undefined),
    unregisterService: vi.fn().mockResolvedValue(undefined),
    selectService: vi.fn().mockImplementation(() => 'service-1'),
  };

  // Message prioritization mock
  const messagePrioritizationMock = {
    initialize: vi.fn().mockResolvedValue(undefined),
    shutdown: vi.fn().mockResolvedValue(undefined),
    registerRule: vi.fn().mockResolvedValue(undefined),
    unregisterRule: vi.fn().mockResolvedValue(undefined),
    prioritizeMessage: vi.fn().mockImplementation((message) => message),
  };

  return {
    natsClientMock,
    taskManagerMock,
    storageManagerMock,
    dataExchangeMock,
    serviceManagerMock,
    messagePersistenceMock,
    loadBalancerMock,
    messagePrioritizationMock,
    triggerSubscription,
    subscriptions,
  };
};

// Export the mocks
export const mocks = createMocks();