import { describe, it, expect, beforeAll, afterAll, beforeEach, afterEach, vi } from 'vitest';
import { ServiceManager } from '../../../src/core/messaging/serviceManager';
import { natsClient } from '../../../src/core/messaging/natsClient';
import { MessageType } from '../../../src/core/messaging/types';
import { v4 as uuidv4 } from 'uuid';

describe('Service Discovery Integration', () => {
  let serviceManager1: ServiceManager;
  let serviceManager2: ServiceManager;
  
  const service1Options = {
    serviceType: 'test-service-1',
    capabilities: ['test-capability-1'],
    metadata: { version: '1.0.0' },
    heartbeatInterval: 100, // Shorter interval for testing
    heartbeatTimeout: 300,
  };
  
  const service2Options = {
    serviceType: 'test-service-2',
    capabilities: ['test-capability-2'],
    metadata: { version: '1.0.0' },
    heartbeatInterval: 100, // Shorter interval for testing
    heartbeatTimeout: 300,
  };

  beforeAll(() => {
    // Mock the NATS client methods
    vi.spyOn(natsClient, 'isConnected').mockImplementation(() => true);
    vi.spyOn(natsClient, 'connect').mockResolvedValue(undefined);
    vi.spyOn(natsClient, 'publish').mockResolvedValue(undefined);
    vi.spyOn(natsClient, 'subscribe').mockImplementation(() => 
      Promise.resolve('test-subscription-id')
    );
    vi.spyOn(natsClient, 'unsubscribe').mockResolvedValue(undefined);
    vi.spyOn(natsClient, 'close').mockResolvedValue(undefined);
  });

  beforeEach(async () => {
    // Create two service managers to test discovery
    serviceManager1 = new ServiceManager(service1Options);
    serviceManager2 = new ServiceManager(service2Options);
    
    // Initialize both services
    await Promise.all([
      serviceManager1.initialize(),
      serviceManager2.initialize(),
    ]);
    
    // Small delay to allow for initial heartbeats
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterEach(async () => {
    // Clean up after each test
    await Promise.all([
      serviceManager1.shutdown().catch(console.error),
      serviceManager2.shutdown().catch(console.error),
    ]);
    
    // Small delay to allow for cleanup
    await new Promise(resolve => setTimeout(resolve, 50));
  });

  afterAll(() => {
    // Clear all mocks
    vi.restoreAllMocks();
  });

  it('should discover other services', async () => {
    // Service 1 should discover Service 2 and vice versa
    const services1 = serviceManager1.getServices();
    const services2 = serviceManager2.getServices();
    
    // Each service should know about the other
    expect(services1.some(s => s.serviceType === service2Options.serviceType)).toBe(true);
    expect(services2.some(s => s.serviceType === service1Options.serviceType)).toBe(true);
  });

  it('should detect service going offline', async () => {
    // Shutdown service 2
    await serviceManager2.shutdown();
    
    // Wait for heartbeat timeout
    await new Promise(resolve => setTimeout(resolve, 350));
    
    // Service 1 should detect Service 2 is offline
    const services = serviceManager1.getServices();
    const service2 = services.find(s => s.serviceType === service2Options.serviceType);
    
    expect(service2).toBeDefined();
    expect(service2?.status).toBe('OFFLINE');
  }, 10000); // Increased timeout for this test

  it('should handle service capabilities', async () => {
    // Find services by capability
    const servicesWithCap1 = serviceManager1.findServicesByCapability('test-capability-2');
    const servicesWithCap2 = serviceManager2.findServicesByCapability('test-capability-1');
    
    expect(servicesWithCap1.length).toBeGreaterThan(0);
    expect(servicesWithCap2.length).toBeGreaterThan(0);
    
    // Verify the capabilities
    expect(servicesWithCap1[0].capabilities).toContain('test-capability-2');
    expect(servicesWithCap2[0].capabilities).toContain('test-capability-1');
  });

  it('should detect when a service goes offline', async () => {
    // This test verifies that a service can detect when another service goes offline
    const testServiceId = serviceManager2.getServiceId();
    
    // First, make sure service1 knows about service2
    const initialServices = serviceManager1.getServices();
    const initialService2 = initialServices.find(s => s.serviceId === testServiceId);
    expect(initialService2).toBeDefined();
    
    // Shutdown service 2
    await serviceManager2.shutdown().catch(console.error);
    
    // Wait a bit for the heartbeat timeout to detect offline status
    await new Promise(resolve => setTimeout(resolve, 350));
    
    // Check if service1 detected service2 as offline
    const services = serviceManager1.getServices();
    const service2 = services.find(s => s.serviceId === testServiceId);
    
    expect(service2).toBeDefined();
    expect(service2?.status).toBe('OFFLINE');
  }, { timeout: 10000 }); // Increased timeout for this test

  it('should handle service re-registration', async () => {
    // Get initial service count
    const initialCount = serviceManager1.getServices().length;
    
    // Shutdown and reinitialize service 2
    await serviceManager2.shutdown();
    await new Promise(resolve => setTimeout(resolve, 50));
    
    // Reinitialize with same options
    serviceManager2 = new ServiceManager(service2Options);
    await serviceManager2.initialize();
    
    // Wait for re-registration
    await new Promise(resolve => setTimeout(resolve, 150));
    
    // Should still have the same number of services (not duplicate)
    const services = serviceManager1.getServices();
    expect(services.length).toBe(initialCount);
    
    // The service should be back online
    const service2 = services.find(s => s.serviceType === service2Options.serviceType);
    expect(service2?.status).toBe('ONLINE');
  }, 10000); // Increased timeout for this test
});
