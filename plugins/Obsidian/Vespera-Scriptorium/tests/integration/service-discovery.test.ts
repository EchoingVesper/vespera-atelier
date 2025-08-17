import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
// Using path alias configured in tsconfig.json
import { ServiceManager, natsClient, MessageType } from '@/core/messaging';
import type { ServiceInfo } from '@/core/messaging';
import { createTestService, waitForCondition } from './__mocks__/service-utils';
import { mockConnection } from './setup';

describe('Service Discovery and Message Flow', () => {
  let serviceA: ReturnType<typeof createTestService>;
  let serviceB: ReturnType<typeof createTestService>;
  let serviceManager: ServiceManager;

  beforeEach(async () => {
    // Create two test services with different capabilities
    serviceA = createTestService({
      serviceType: 'worker',
      capabilities: ['task-processing', 'data-analysis'],
      metadata: { version: '1.0.0' },
      heartbeatInterval: 1000,
    });

    serviceB = createTestService({
      serviceType: 'storage',
      capabilities: ['file-storage', 'data-persistence'],
      metadata: { version: '1.0.0' },
      heartbeatInterval: 1000,
    });

    // Create a service manager to test service discovery
    serviceManager = new ServiceManager({
      serviceType: 'test-manager',
      capabilities: ['service-discovery'],
      heartbeatInterval: 1000,
    });

    // Start all services
    await Promise.all([
      serviceA.start(),
      serviceB.start(),
      serviceManager.initialize(),
    ]);

    // Give services time to register and discover each other
    await new Promise(resolve => setTimeout(resolve, 1500));
  });

  afterEach(async () => {
    // Clean up all services
    await Promise.all([
      serviceA.stop(),
      serviceB.stop(),
      serviceManager.shutdown(),
    ]);
  });

  it('should discover registered services', async () => {
    // Get all services
    const services = serviceManager.getServices();
    
    // Should find both services (they should be registered in the beforeEach hook)
    expect(services.length).toBeGreaterThanOrEqual(2);
    
    // Check that we have both worker and storage services
    const serviceTypes = services.map(s => s.serviceType);
    expect(serviceTypes).toContain('worker');
    expect(serviceTypes).toContain('storage');
    
    // Verify that all services are online
    services.forEach(service => {
      expect(service.status).toBe('ONLINE');
    });
  });

  it('should detect service capabilities', async () => {
    // Test finding services by capability
    const taskServices = serviceManager.findServicesByCapability('task-processing');
    const storageServices = serviceManager.findServicesByCapability('file-storage');
    
    // Should find one service for each capability
    expect(taskServices.length).toBe(1);
    expect(taskServices[0].serviceType).toBe('worker');
    
    expect(storageServices.length).toBe(1);
    expect(storageServices[0].serviceType).toBe('storage');
    
    // Test with a non-existent capability
    const unknownServices = serviceManager.findServicesByCapability('non-existent-capability');
    expect(unknownServices).toHaveLength(0);
  });

  it('should handle service heartbeats and detect offline services', async () => {
    // Get initial service count
    const initialCount = serviceManager.getServices().length;
    
    // Stop one service
    await serviceA.stop();
    
    // Wait for the service manager to detect the service is offline
    // This is a bit tricky since we're testing timing-dependent behavior
    // In a real test, we might want to mock the Date or use fake timers
    await new Promise(resolve => setTimeout(resolve, 1500));
    
    // Get updated services
    const updatedServices = serviceManager.getServices();
    
    // The stopped service should still be in the list but marked as offline
    const stoppedService = updatedServices.find(s => s.serviceType === 'worker');
    expect(stoppedService).toBeDefined();
    expect(stoppedService?.status).toBe('OFFLINE');
    
    // Service count should remain the same (services are kept in the registry)
    expect(updatedServices.length).toBe(initialCount);
  });

  it('should support service-to-service communication', async () => {
    // Test direct messaging between services
    const testMessage = { task: 'process-data', data: 'test-data' };
    const testSubject = 'test.direct.message';
    
    // Mock the subscription
    const mockSubscription = {
      unsubscribe: vi.fn().mockResolvedValue(undefined)
    };
    
    // Set up the mock subscription
    mockConnection.subscribe.mockImplementation((subject: string) => {
      if (subject === testSubject) {
        // Simulate message delivery after a short delay
        setTimeout(() => {
          const message = {
            data: Buffer.from(JSON.stringify({
              type: MessageType.DATA_REQUEST,
              headers: {
                messageId: 'test-message-id',
                correlationId: 'test-correlation-id',
                timestamp: new Date().toISOString(),
                source: 'test-service-a',
              },
              payload: testMessage
            })),
            subject: testSubject,
            respond: vi.fn().mockResolvedValue(undefined)
          };
          // Call the message handler if it exists
          const messageHandler = mockConnection.subscribe.mock.calls
            .find(([s]) => s === testSubject)?.[1]?.bind(mockSubscription);
          if (messageHandler) {
            messageHandler(message);
          }
        }, 10);
      }
      return Promise.resolve(mockSubscription);
    });
    
    // Subscribe to test subject on service B
    await serviceB.subscribe(testSubject);
    
    // Send message from service A to service B
    await serviceA.sendMessage(testSubject, testMessage);
    
    // Check that publish was called with the correct arguments
    expect(mockConnection.publish).toHaveBeenCalledWith(
      testSubject,
      expect.any(Uint8Array)
    );
    
    // Wait for the message to be processed
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Check that service B received the message
    const receivedMessages = serviceB.getMessagesForSubject(testSubject);
    expect(receivedMessages).toHaveLength(1);
    expect(receivedMessages[0].message.payload).toEqual(testMessage);
  });

  it('should handle request/response pattern', async () => {
    // Mock the request/response pattern
    const testRequest = {
      type: MessageType.DATA_REQUEST,
      headers: {
        messageId: 'test-message-1',
        correlationId: 'test-correlation-1',
        timestamp: new Date().toISOString(),
        source: 'test-client',
      },
      payload: {
        fileId: 'test-file-123',
      },
    };

    const mockResponse = {
      type: MessageType.DATA_RESPONSE,
      headers: {
        ...testRequest.headers,
        timestamp: new Date().toISOString(),
      },
      payload: {
        fileId: 'test-file-123',
        content: 'File content',
        status: 'success',
      },
    };

    // Mock the request to return our test response
    mockConnection.request.mockResolvedValue({
      data: Buffer.from(JSON.stringify(mockResponse)),
      json: () => Promise.resolve(mockResponse)
    });

    // Send a request
    const response = await natsClient.request('service.storage.get', testRequest);

    // Verify the response
    expect(response.type).toBe(MessageType.DATA_RESPONSE);
    expect(response.payload).toEqual({
      fileId: 'test-file-123',
      content: 'File content',
      status: 'success',
    });
    
    // Verify the request was made with the correct arguments
    expect(mockConnection.request).toHaveBeenCalledWith(
      'service.storage.get',
      expect.any(Uint8Array)
    );
  });
});
