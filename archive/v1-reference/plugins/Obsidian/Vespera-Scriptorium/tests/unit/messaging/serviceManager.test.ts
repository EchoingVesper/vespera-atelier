import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { ServiceManager, ServiceManagerOptions } from '../../../src/core/messaging/serviceManager';
import { natsClient } from '../../../src/core/messaging/natsClient';
import { Message, MessageType } from '../../../src/core/messaging/types';

// Mock the NATS client
vi.mock('../../../src/core/messaging/natsClient', () => {
  return {
    natsClient: {
      get isConnected() { return true; },
      connect: vi.fn().mockResolvedValue(undefined),
      close: vi.fn().mockResolvedValue(undefined),
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockImplementation((subject, callback) => {
        // Return a subscription ID
        return Promise.resolve('test-subscription-id');
      }),
      unsubscribe: vi.fn().mockImplementation(() => {
        return Promise.resolve();
      }),
    }
  };
});

describe('ServiceManager', () => {
  let serviceManager: ServiceManager;
  const mockOptions: ServiceManagerOptions = {
    serviceType: 'test-service',
    capabilities: ['test-capability'],
    metadata: { version: '1.0.0' },
  };

  beforeEach(() => {
    vi.clearAllMocks();
    serviceManager = new ServiceManager(mockOptions);
  });

  afterEach(async () => {
    await serviceManager.shutdown().catch(console.error);
  });

  describe('initialization', () => {
    it('should initialize with default values', () => {
      expect(serviceManager.getServiceType()).toBe('test-service');
      expect(serviceManager.getServiceId()).toMatch(/^svc-[a-f0-9-]+$/);
    });

    it('should register the service on initialization', async () => {
      const publishSpy = vi.spyOn(natsClient, 'publish');
      await serviceManager.initialize();
      
      expect(publishSpy).toHaveBeenCalledWith(
        'service.discovery.register',
        expect.objectContaining({
          type: MessageType.REGISTER,
          payload: {
            agentId: expect.any(String),
            capabilities: ['test-capability'],
            metadata: { version: '1.0.0' },
          },
        })
      );
    });
  });

  describe('heartbeat', () => {
    beforeEach(() => {
      vi.useFakeTimers();
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('should send periodic heartbeats', async () => {
      const publishSpy = vi.spyOn(natsClient, 'publish');
      await serviceManager.initialize();
      
      // Clear initial calls (registration)
      publishSpy.mockClear();
      
      // Advance time to trigger heartbeat
      vi.advanceTimersByTime(30000);
      
      // Allow any pending promises to resolve
      await vi.runAllTimersAsync();
      
      // Verify a heartbeat was sent
      expect(publishSpy).toHaveBeenCalledWith(
        'service.heartbeat',
        expect.objectContaining({
          type: MessageType.HEARTBEAT,
        })
      );
    });
  });

  describe('service discovery', () => {
    it('should track discovered services', async () => {
      await serviceManager.initialize();
      
      // Simulate a service registration
      const testMessage: Message<any> = {
        type: MessageType.REGISTER,
        headers: {
          correlationId: 'test-correlation-id',
          messageId: 'test-message-id',
          timestamp: new Date().toISOString(),
          source: 'test-service.123',
        },
        payload: {
          agentId: 'test-service-123',
          capabilities: ['test-capability'],
          metadata: { version: '1.0.0' },
        },
      };
      
      // Get the mock implementation
      const mockSubscribe = vi.mocked(natsClient.subscribe);
      
      // Find the callback that was registered for service registration
      const registerCallback = mockSubscribe.mock.calls.find(
        call => call[0] === 'service.discovery.register'
      )?.[1];
      
      // Call the callback with our test message
      if (registerCallback) {
        registerCallback(testMessage);
      }
      
      // Verify service is tracked
      const services = serviceManager.getAllServices();
      expect(services).toHaveLength(1);
      expect(services[0].serviceId).toBe('test-service-123');
      expect(services[0].status).toBe('ONLINE');
    });
  });

  describe('shutdown', () => {
    it('should unregister the service on shutdown', async () => {
      await serviceManager.initialize();
      const publishSpy = vi.spyOn(natsClient, 'publish');
      
      await serviceManager.shutdown();
      
      expect(publishSpy).toHaveBeenCalledWith(
        'service.discovery.unregister',
        expect.objectContaining({
          type: MessageType.UNREGISTER,
          payload: {
            agentId: expect.any(String),
          },
        })
      );
    });
  });
});
