/**
 * Unit tests for the health monitoring system
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { HealthMonitor, HealthStatus, ComponentType, ComponentHealthCheck, HealthMonitorOptions } from '../../../src/core/messaging/healthMonitor';
import { CircuitState } from '../../../src/core/messaging/circuitBreaker';
import { ServiceStatus, SERVICE_STATUS } from '../../../src/core/messaging/serviceManager';

describe('HealthMonitor', () => {
  let healthMonitor: HealthMonitor;
  let options: HealthMonitorOptions;
  
  beforeEach(() => {
    // Create options for testing with faster intervals
    options = {
      checkInterval: 100, // 100ms for faster tests
      reportInterval: 1000, // 1 second for faster tests
      enableReporting: false, // Disable automatic reporting for tests
      enableLogging: false
    };
    
    healthMonitor = new HealthMonitor(options);
  });
  
  afterEach(() => {
    // Clean up
    healthMonitor.stopReporting();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Component Registration', () => {
    it('should register a component for health monitoring', () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        componentId: 'test-component',
        componentType: ComponentType.CUSTOM,
        status: HealthStatus.HEALTHY,
        lastChecked: Date.now(),
        message: 'Component is healthy'
      });

      const component: ComponentHealthCheck = {
        componentId: 'test-component',
        componentType: ComponentType.CUSTOM,
        checkFn: mockHealthCheck,
        interval: 1000,
        timeout: 500,
        retryCount: 3,
        retryDelay: 100
      };

      const registeredId = healthMonitor.registerComponent(component);
      expect(registeredId).toBe('test-component');
    });

    it('should unregister a component', () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        componentId: 'test-component',
        componentType: ComponentType.CUSTOM,
        status: HealthStatus.HEALTHY,
        lastChecked: Date.now()
      });

      const component: ComponentHealthCheck = {
        componentId: 'test-component',
        componentType: ComponentType.CUSTOM,
        checkFn: mockHealthCheck,
        interval: 1000,
        timeout: 500,
        retryCount: 3,
        retryDelay: 100
      };

      healthMonitor.registerComponent(component);
      const unregistered = healthMonitor.unregisterComponent('test-component');
      expect(unregistered).toBe(true);
    });
  });

  describe('Health Status Management', () => {
    it('should get component health status', async () => {
      const mockHealthCheck = vi.fn().mockResolvedValue({
        componentId: 'test-component',
        componentType: ComponentType.CUSTOM,
        status: HealthStatus.HEALTHY,
        lastChecked: Date.now(),
        message: 'Component is healthy'
      });

      const component: ComponentHealthCheck = {
        componentId: 'test-component',
        componentType: ComponentType.CUSTOM,
        checkFn: mockHealthCheck,
        interval: 1000,
        timeout: 500,
        retryCount: 3,
        retryDelay: 100
      };

      healthMonitor.registerComponent(component);
      
      // Wait a bit for initial health check
      await new Promise(resolve => setTimeout(resolve, 200));
      
      const health = healthMonitor.getComponentHealth('test-component');
      expect(health).toBeDefined();
      expect(health?.componentId).toBe('test-component');
    });

    it('should get system health status', () => {
      const systemHealth = healthMonitor.getSystemHealthStatus();
      expect(systemHealth).toBeDefined();
      expect(systemHealth.overallStatus).toBeDefined();
      expect(systemHealth.components).toBeDefined();
    });
  });

  describe('Health Check Factories', () => {
    it('should create NATS health check', async () => {
      const mockNatsClient = {
        isConnected: vi.fn().mockReturnValue(true)
      };

      const healthCheckFn = HealthMonitor.createNatsHealthCheck(mockNatsClient as any);
      const result = await healthCheckFn();

      expect(result.componentId).toBe('nats-client');
      expect(result.componentType).toBe(ComponentType.NATS_CLIENT);
      expect(result.status).toBe(HealthStatus.HEALTHY);
    });

    it('should create circuit breaker health check', async () => {
      const getStateFn = vi.fn().mockReturnValue(CircuitState.CLOSED);
      
      const healthCheckFn = HealthMonitor.createCircuitBreakerHealthCheck('test-circuit', getStateFn);
      const result = await healthCheckFn();

      expect(result.componentId).toBe('circuit-test-circuit');
      expect(result.componentType).toBe(ComponentType.CIRCUIT_BREAKER);
      expect(result.status).toBe(HealthStatus.HEALTHY);
    });

    it('should create service health check', async () => {
      const getStatusFn = vi.fn().mockReturnValue(SERVICE_STATUS.ONLINE);
      
      const healthCheckFn = HealthMonitor.createServiceHealthCheck('test-service', getStatusFn);
      const result = await healthCheckFn();

      expect(result.componentId).toBe('service-test-service');
      expect(result.componentType).toBe(ComponentType.SERVICE_MANAGER);
      expect(result.status).toBe(HealthStatus.HEALTHY);
    });
  });
});
