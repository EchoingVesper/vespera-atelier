/**
 * Unit tests for the circuit breaker pattern implementation
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { CircuitBreaker, CircuitBreakerRegistry, CircuitState, CircuitBreakerOptions } from '../../../src/core/messaging/circuitBreaker';

describe('CircuitBreaker', () => {
  let circuitBreaker: CircuitBreaker;
  let options: CircuitBreakerOptions;
  
  beforeEach(() => {
    // Create default options for testing
    options = {
      failureThreshold: 3,
      resetTimeout: 1000, // 1 second for faster tests
      halfOpenSuccessThreshold: 2,
      monitorInterval: 100, // 100ms for faster tests
      timeout: 500, // 500ms for faster tests
      enableLogging: false
    };
    
    circuitBreaker = new CircuitBreaker('test-circuit', options);
  });
  
  afterEach(() => {
    // Clean up
    circuitBreaker.stopMonitoring();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Construction and Basic Properties', () => {
    it('should create a circuit breaker with correct initial state', () => {
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(circuitBreaker.getId()).toBe('test-circuit');
    });

    it('should have correct default options', () => {
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.state).toBe(CircuitState.CLOSED);
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
    });
  });

  describe('Circuit State Management', () => {
    it('should force state changes correctly', () => {
      const stateChangeSpy = vi.fn();
      circuitBreaker.on('stateChanged', stateChangeSpy);

      circuitBreaker.forceState(CircuitState.OPEN);
      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(stateChangeSpy).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN, 'test-circuit');

      circuitBreaker.forceState(CircuitState.HALF_OPEN);
      expect(circuitBreaker.getState()).toBe(CircuitState.HALF_OPEN);
      expect(stateChangeSpy).toHaveBeenCalledWith(CircuitState.OPEN, CircuitState.HALF_OPEN, 'test-circuit');
    });

    it('should not emit state change events when forcing to the same state', () => {
      const stateChangeSpy = vi.fn();
      circuitBreaker.on('stateChanged', stateChangeSpy);

      circuitBreaker.forceState(CircuitState.CLOSED);
      expect(stateChangeSpy).not.toHaveBeenCalled();
    });

    it('should reset circuit to closed state correctly', () => {
      // First, force to open state and add some failures
      circuitBreaker.forceState(CircuitState.OPEN);
      
      const stateChangeSpy = vi.fn();
      circuitBreaker.on('stateChanged', stateChangeSpy);

      circuitBreaker.reset();
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      
      const metrics = circuitBreaker.getMetrics();
      expect(metrics.failures).toBe(0);
      expect(metrics.successes).toBe(0);
      expect(stateChangeSpy).toHaveBeenCalledWith(CircuitState.OPEN, CircuitState.CLOSED, 'test-circuit');
    });
  });

  describe('Function Execution - Success Cases', () => {
    it('should execute function successfully in closed state', async () => {
      const mockFn = vi.fn().mockResolvedValue('success');
      const successSpy = vi.fn();
      circuitBreaker.on('success', successSpy);

      const result = await circuitBreaker.execute(mockFn);
      
      expect(result).toBe('success');
      expect(mockFn).toHaveBeenCalledTimes(1);
      expect(successSpy).toHaveBeenCalledWith('test-circuit');
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should transition from half-open to closed after enough successes', async () => {
      // Force to half-open state
      circuitBreaker.forceState(CircuitState.HALF_OPEN);
      
      const mockFn = vi.fn().mockResolvedValue('success');
      const stateChangeSpy = vi.fn();
      circuitBreaker.on('stateChanged', stateChangeSpy);

      // Execute enough successful operations to close the circuit
      for (let i = 0; i < options.halfOpenSuccessThreshold; i++) {
        await circuitBreaker.execute(mockFn);
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
      expect(stateChangeSpy).toHaveBeenCalledWith(CircuitState.HALF_OPEN, CircuitState.CLOSED, 'test-circuit');
    });
  });

  describe('Function Execution - Failure Cases', () => {
    it('should handle function failures and track failure count', async () => {
      const mockError = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(mockError);
      const failureSpy = vi.fn();
      circuitBreaker.on('failure', failureSpy);

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
      
      expect(failureSpy).toHaveBeenCalledWith(mockError, 'test-circuit');
      expect(circuitBreaker.getMetrics().failures).toBe(1);
      expect(circuitBreaker.getState()).toBe(CircuitState.CLOSED);
    });

    it('should open circuit after reaching failure threshold', async () => {
      const mockError = new Error('Test error');
      const mockFn = vi.fn().mockRejectedValue(mockError);
      const stateChangeSpy = vi.fn();
      circuitBreaker.on('stateChanged', stateChangeSpy);

      // Execute enough failures to open the circuit
      for (let i = 0; i < options.failureThreshold; i++) {
        await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Test error');
      }

      expect(circuitBreaker.getState()).toBe(CircuitState.OPEN);
      expect(stateChangeSpy).toHaveBeenCalledWith(CircuitState.CLOSED, CircuitState.OPEN, 'test-circuit');
    });

    it('should fail fast when circuit is open', async () => {
      // Force circuit to open state
      circuitBreaker.forceState(CircuitState.OPEN);
      
      const mockFn = vi.fn().mockResolvedValue('success');
      const rejectedSpy = vi.fn();
      circuitBreaker.on('rejected', rejectedSpy);

      await expect(circuitBreaker.execute(mockFn)).rejects.toThrow('Circuit test-circuit is OPEN');
      
      expect(mockFn).not.toHaveBeenCalled();
      expect(rejectedSpy).toHaveBeenCalledWith('test-circuit');
    });
  });
});

describe('CircuitBreakerRegistry', () => {
  let registry: CircuitBreakerRegistry;
  let defaultOptions: CircuitBreakerOptions;

  beforeEach(() => {
    defaultOptions = {
      failureThreshold: 5,
      resetTimeout: 30000,
      halfOpenSuccessThreshold: 3,
      enableLogging: false
    };
    registry = new CircuitBreakerRegistry(defaultOptions);
  });

  afterEach(() => {
    // Clean up all circuits
    const allIds = registry.getAllIds();
    allIds.forEach(id => registry.remove(id));
    vi.clearAllMocks();
  });

  describe('Circuit Management', () => {
    it('should create and retrieve circuit breakers', () => {
      const circuit = registry.getOrCreate('test-circuit');
      
      expect(circuit).toBeInstanceOf(CircuitBreaker);
      expect(circuit.getId()).toBe('test-circuit');
      expect(registry.exists('test-circuit')).toBe(true);
    });

    it('should return existing circuit on subsequent calls', () => {
      const circuit1 = registry.getOrCreate('test-circuit');
      const circuit2 = registry.getOrCreate('test-circuit');
      
      expect(circuit1).toBe(circuit2);
    });

    it('should create circuit with custom options', () => {
      const customOptions = {
        failureThreshold: 10,
        resetTimeout: 60000
      };
      
      const circuit = registry.getOrCreate('custom-circuit', customOptions);
      expect(circuit.getId()).toBe('custom-circuit');
    });
  });
});
