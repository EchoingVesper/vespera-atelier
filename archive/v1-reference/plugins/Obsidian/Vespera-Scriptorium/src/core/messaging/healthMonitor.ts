/**
 * Health monitoring system for A2A messaging components
 * 
 * Provides health status tracking, periodic health checks, and degraded state handling
 * for all A2A messaging components.
 */
import { EventEmitter } from 'events';
import { natsClient, NatsClient } from './natsClient';
import { ServiceStatus, SERVICE_STATUS } from './serviceManager';
import { CircuitState } from './circuitBreaker';
import { MetricType, metricsCollector } from './metricsCollector';

/**
 * Health status levels
 */
export enum HealthStatus {
  HEALTHY = 'HEALTHY',
  DEGRADED = 'DEGRADED',
  UNHEALTHY = 'UNHEALTHY',
  UNKNOWN = 'UNKNOWN'
}

/**
 * Component types that can be health checked
 */
export enum ComponentType {
  NATS_CLIENT = 'NATS_CLIENT',
  SERVICE_MANAGER = 'SERVICE_MANAGER',
  TASK_MANAGER = 'TASK_MANAGER',
  STORAGE_MANAGER = 'STORAGE_MANAGER',
  DATA_EXCHANGE = 'DATA_EXCHANGE',
  MESSAGE_FILTER = 'MESSAGE_FILTER',
  CIRCUIT_BREAKER = 'CIRCUIT_BREAKER',
  METRICS_COLLECTOR = 'METRICS_COLLECTOR',
  HEALTH_MONITOR = 'HEALTH_MONITOR',
  ALERT_MANAGER = 'ALERT_MANAGER',
  CUSTOM = 'CUSTOM'
}

/**
 * Health check result
 */
export interface HealthCheckResult {
  componentId: string;
  componentType: ComponentType | string;
  status: HealthStatus;
  details?: Record<string, any>;
  lastChecked: number;
  message?: string;
  metrics?: Record<string, number>;
}

/**
 * Health check function type
 */
export type HealthCheckFn = () => Promise<HealthCheckResult>;

/**
 * Component health check configuration
 */
export interface ComponentHealthCheck {
  componentId: string;
  componentType: ComponentType | string;
  checkFn: HealthCheckFn;
  interval: number; // How often to check in milliseconds
  timeout: number; // Timeout for the check in milliseconds
  retryCount: number; // Number of retries before marking as unhealthy
  retryDelay: number; // Delay between retries in milliseconds
  dependencies?: string[]; // Component IDs that this component depends on
}

/**
 * System health status
 */
export interface SystemHealthStatus {
  overallStatus: HealthStatus;
  components: Record<string, HealthCheckResult>;
  timestamp: number;
  degradedComponents: string[];
  unhealthyComponents: string[];
  unknownComponents: string[];
}

/**
 * Health monitor options
 */
export interface HealthMonitorOptions {
  natsClient?: NatsClient;
  checkInterval?: number; // Default interval for health checks in milliseconds
  reportInterval?: number; // How often to report overall health in milliseconds
  enableReporting?: boolean; // Whether to enable periodic reporting
  enableLogging?: boolean; // Whether to log health status changes
}

/**
 * Health monitor events
 */
export interface HealthMonitorEvents {
  statusChanged: (componentId: string, oldStatus: HealthStatus, newStatus: HealthStatus) => void;
  componentAdded: (componentId: string, componentType: ComponentType | string) => void;
  componentRemoved: (componentId: string) => void;
  healthCheckCompleted: (result: HealthCheckResult) => void;
  systemStatusChanged: (oldStatus: HealthStatus, newStatus: HealthStatus) => void;
  systemStatusReported: (status: SystemHealthStatus) => void;
  error: (error: Error, componentId?: string) => void;
}

/**
 * Health monitor for tracking component health status
 */
export class HealthMonitor extends EventEmitter {
  private components: Map<string, ComponentHealthCheck> = new Map();
  private healthStatus: Map<string, HealthCheckResult> = new Map();
  private checkTimers: Map<string, NodeJS.Timeout> = new Map();
  private retryCounters: Map<string, number> = new Map();
  private reportTimer: NodeJS.Timeout | null = null;
  private natsClient: NatsClient;
  private systemStatus: HealthStatus = HealthStatus.UNKNOWN;
  private readonly options: Required<HealthMonitorOptions>;

  constructor(options: HealthMonitorOptions = {}) {
    super();
    this.natsClient = options.natsClient || natsClient;
    
    // Set default options with proper merging to avoid type errors
    const defaultOptions = {
      natsClient: this.natsClient, // Ensure natsClient is included in options
      checkInterval: 60000, // 1 minute
      reportInterval: 300000, // 5 minutes
      enableReporting: true,
      enableLogging: false
    };
    
    // Merge defaults with provided options, ensuring natsClient is properly set
    this.options = { ...defaultOptions, ...options, natsClient: this.natsClient } as Required<HealthMonitorOptions>;

    // Start reporting timer if enabled
    if (this.options.enableReporting) {
      this.startReporting();
    }
  }

  /**
   * Register a component for health monitoring
   * 
   * @param component - The component health check configuration
   * @returns The component ID
   */
  registerComponent(component: ComponentHealthCheck): string {
    if (this.components.has(component.componentId)) {
      throw new Error(`Component with ID ${component.componentId} is already registered`);
    }

    this.components.set(component.componentId, component);
    this.retryCounters.set(component.componentId, 0);
    
    // Initialize health status as UNKNOWN
    this.healthStatus.set(component.componentId, {
      componentId: component.componentId,
      componentType: component.componentType,
      status: HealthStatus.UNKNOWN,
      lastChecked: Date.now(),
      message: 'Initial state, not yet checked'
    });

    // Start health check timer
    this.startHealthCheck(component.componentId);

    // Emit event
    this.emit('componentAdded', component.componentId, component.componentType);
    
    if (this.options.enableLogging) {
      console.log(`[HealthMonitor] Registered component ${component.componentId} of type ${component.componentType}`);
    }
    
    return component.componentId;
  }

  /**
   * Unregister a component from health monitoring
   * 
   * @param componentId - The component ID to unregister
   * @returns True if the component was unregistered
   */
  unregisterComponent(componentId: string): boolean {
    if (!this.components.has(componentId)) {
      return false;
    }

    // Stop health check timer
    this.stopHealthCheck(componentId);

    // Remove component
    this.components.delete(componentId);
    this.healthStatus.delete(componentId);
    this.retryCounters.delete(componentId);

    // Emit event
    this.emit('componentRemoved', componentId);
    
    if (this.options.enableLogging) {
      console.log(`[HealthMonitor] Unregistered component ${componentId}`);
    }
    
    return true;
  }

  /**
   * Start health check for a component
   * 
   * @param componentId - The component ID to check
   * @private
   */
  private startHealthCheck(componentId: string): void {
    // Stop existing timer if any
    this.stopHealthCheck(componentId);

    const component = this.components.get(componentId);
    if (!component) {
      return;
    }

    // Start new timer
    const timer = setInterval(() => {
      this.checkComponentHealth(componentId);
    }, component.interval);

    this.checkTimers.set(componentId, timer);

    // Run initial check
    this.checkComponentHealth(componentId);
  }

  /**
   * Stop health check for a component
   * 
   * @param componentId - The component ID to stop checking
   * @private
   */
  private stopHealthCheck(componentId: string): void {
    const timer = this.checkTimers.get(componentId);
    if (timer) {
      clearInterval(timer);
      this.checkTimers.delete(componentId);
    }
  }

  /**
   * Check health of a component
   * 
   * @param componentId - The component ID to check
   * @private
   */
  private async checkComponentHealth(componentId: string): Promise<void> {
    const component = this.components.get(componentId);
    if (!component) {
      return;
    }

    try {
      // Create a timeout promise
      const timeoutPromise = new Promise<never>((_, reject) => {
        setTimeout(() => {
          reject(new Error(`Health check for ${componentId} timed out after ${component.timeout}ms`));
        }, component.timeout);
      });

      // Race between the health check and the timeout
      const result = await Promise.race([
        component.checkFn(),
        timeoutPromise
      ]) as HealthCheckResult;

      // Update health status
      this.updateComponentHealth(componentId, result);
      
      // Reset retry counter
      this.retryCounters.set(componentId, 0);
      
    } catch (error) {
      // Increment retry counter
      const retryCount = (this.retryCounters.get(componentId) || 0) + 1;
      this.retryCounters.set(componentId, retryCount);
      
      if (this.options.enableLogging) {
        console.error(`[HealthMonitor] Health check failed for ${componentId} (retry ${retryCount}/${component.retryCount}):`, error);
      }

      // Emit error event
      this.emit('error', error instanceof Error ? error : new Error(String(error)), componentId);

      // If we've reached the retry limit, mark as unhealthy
      if (retryCount >= component.retryCount) {
        const currentStatus = this.healthStatus.get(componentId);
        const newStatus: HealthCheckResult = {
          componentId,
          componentType: component.componentType,
          status: HealthStatus.UNHEALTHY,
          lastChecked: Date.now(),
          message: `Health check failed after ${retryCount} retries: ${error instanceof Error ? error.message : String(error)}`
        };

        this.updateComponentHealth(componentId, newStatus);
        
        // Reset retry counter
        this.retryCounters.set(componentId, 0);
      } else {
        // Schedule a retry
        setTimeout(() => {
          this.checkComponentHealth(componentId);
        }, component.retryDelay);
      }
    }
  }

  /**
   * Update component health status
   * 
   * @param componentId - The component ID
   * @param result - The health check result
   * @private
   */
  private updateComponentHealth(componentId: string, result: HealthCheckResult): void {
    const oldStatus = this.healthStatus.get(componentId);
    this.healthStatus.set(componentId, result);

    // Emit event if status changed
    if (oldStatus && oldStatus.status !== result.status) {
      this.emit('statusChanged', componentId, oldStatus.status, result.status);
      
      if (this.options.enableLogging) {
        console.log(`[HealthMonitor] Component ${componentId} status changed from ${oldStatus.status} to ${result.status}`);
      }
      
      // Record metric
      metricsCollector.recordCustomMetric('health.status.change', 1, {
        componentId,
        componentType: result.componentType,
        oldStatus: oldStatus.status,
        newStatus: result.status
      });
    }

    // Emit health check completed event
    this.emit('healthCheckCompleted', result);

    // Update system status
    this.updateSystemStatus();
  }

  /**
   * Update overall system status based on component health
   * 
   * @private
   */
  private updateSystemStatus(): void {
    const oldStatus = this.systemStatus;
    
    // Calculate new status based on component health
    let newStatus = HealthStatus.HEALTHY;
    
    // If no components, status is UNKNOWN
    if (this.healthStatus.size === 0) {
      newStatus = HealthStatus.UNKNOWN;
    } else {
      // Check if any components are unhealthy or degraded
      let hasUnhealthy = false;
      let hasDegraded = false;
      let hasUnknown = false;
      
      for (const status of this.healthStatus.values()) {
        if (status.status === HealthStatus.UNHEALTHY) {
          hasUnhealthy = true;
        } else if (status.status === HealthStatus.DEGRADED) {
          hasDegraded = true;
        } else if (status.status === HealthStatus.UNKNOWN) {
          hasUnknown = true;
        }
      }
      
      // Determine overall status
      if (hasUnhealthy) {
        newStatus = HealthStatus.UNHEALTHY;
      } else if (hasDegraded) {
        newStatus = HealthStatus.DEGRADED;
      } else if (hasUnknown) {
        // Only set to UNKNOWN if all components are UNKNOWN
        const allUnknown = Array.from(this.healthStatus.values()).every(
          status => status.status === HealthStatus.UNKNOWN
        );
        
        if (allUnknown) {
          newStatus = HealthStatus.UNKNOWN;
        }
      }
    }
    
    // Update system status if changed
    if (newStatus !== oldStatus) {
      this.systemStatus = newStatus;
      this.emit('systemStatusChanged', oldStatus, newStatus);
      
      if (this.options.enableLogging) {
        console.log(`[HealthMonitor] System status changed from ${oldStatus} to ${newStatus}`);
      }
      
      // Record metric
      metricsCollector.recordCustomMetric('health.system.status.change', 1, {
        oldStatus,
        newStatus
      });
    }
  }

  /**
   * Start periodic health status reporting
   */
  startReporting(): void {
    // Stop existing timer if any
    this.stopReporting();

    // Start new timer
    this.reportTimer = setInterval(() => {
      this.reportHealthStatus();
    }, this.options.reportInterval);

    // Run initial report
    this.reportHealthStatus();
  }

  /**
   * Stop periodic health status reporting
   */
  stopReporting(): void {
    if (this.reportTimer) {
      clearInterval(this.reportTimer);
      this.reportTimer = null;
    }
  }

  /**
   * Report current health status
   */
  reportHealthStatus(): void {
    const status = this.getSystemHealthStatus();
    this.emit('systemStatusReported', status);
    
    if (this.options.enableLogging) {
      console.log(`[HealthMonitor] System health status: ${status.overallStatus}`);
      console.log(`[HealthMonitor] Healthy: ${Object.keys(status.components).length - status.degradedComponents.length - status.unhealthyComponents.length - status.unknownComponents.length}`);
      console.log(`[HealthMonitor] Degraded: ${status.degradedComponents.length}`);
      console.log(`[HealthMonitor] Unhealthy: ${status.unhealthyComponents.length}`);
      console.log(`[HealthMonitor] Unknown: ${status.unknownComponents.length}`);
    }
  }

  /**
   * Get health status for a specific component
   * 
   * @param componentId - The component ID
   * @returns The health check result or undefined if not found
   */
  getComponentHealth(componentId: string): HealthCheckResult | undefined {
    return this.healthStatus.get(componentId);
  }

  /**
   * Get health status for all components
   * 
   * @returns Record of component health status
   */
  getAllComponentHealth(): Record<string, HealthCheckResult> {
    return Object.fromEntries(this.healthStatus);
  }

  /**
   * Get overall system health status
   * 
   * @returns System health status
   */
  getSystemHealthStatus(): SystemHealthStatus {
    const components = this.getAllComponentHealth();
    
    // Categorize components by status
    const degradedComponents: string[] = [];
    const unhealthyComponents: string[] = [];
    const unknownComponents: string[] = [];
    
    for (const [id, status] of Object.entries(components)) {
      if (status.status === HealthStatus.DEGRADED) {
        degradedComponents.push(id);
      } else if (status.status === HealthStatus.UNHEALTHY) {
        unhealthyComponents.push(id);
      } else if (status.status === HealthStatus.UNKNOWN) {
        unknownComponents.push(id);
      }
    }
    
    return {
      overallStatus: this.systemStatus,
      components,
      timestamp: Date.now(),
      degradedComponents,
      unhealthyComponents,
      unknownComponents
    };
  }

  /**
   * Force a health check for a component
   * 
   * @param componentId - The component ID to check
   * @returns Promise that resolves when the check is complete
   */
  async forceHealthCheck(componentId: string): Promise<HealthCheckResult> {
    const component = this.components.get(componentId);
    if (!component) {
      throw new Error(`Component with ID ${componentId} is not registered`);
    }

    try {
      const result = await component.checkFn();
      this.updateComponentHealth(componentId, result);
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      
      // Create unhealthy result
      const result: HealthCheckResult = {
        componentId,
        componentType: component.componentType,
        status: HealthStatus.UNHEALTHY,
        lastChecked: Date.now(),
        message: `Forced health check failed: ${errorMessage}`
      };
      
      this.updateComponentHealth(componentId, result);
      
      // Emit error event
      this.emit('error', error instanceof Error ? error : new Error(errorMessage), componentId);
      
      return result;
    }
  }

  /**
   * Create a health check function for the NATS client
   * 
   * @returns Health check function
   */
  static createNatsHealthCheck(natsClient: NatsClient): HealthCheckFn {
    return async () => {
      const isConnected = natsClient.isConnected;
      
      return {
        componentId: 'nats-client',
        componentType: ComponentType.NATS_CLIENT,
        status: isConnected ? HealthStatus.HEALTHY : HealthStatus.UNHEALTHY,
        lastChecked: Date.now(),
        message: isConnected ? 'Connected to NATS server' : 'Not connected to NATS server',
        details: {
          connected: isConnected
        }
      };
    };
  }

  /**
   * Create a health check function for a circuit breaker
   * 
   * @param circuitId - The circuit ID
   * @param getState - Function to get the circuit state
   * @returns Health check function
   */
  static createCircuitBreakerHealthCheck(
    circuitId: string,
    getState: () => CircuitState
  ): HealthCheckFn {
    return async () => {
      const state = getState();
      
      let status: HealthStatus;
      let message: string;
      
      switch (state) {
        case CircuitState.CLOSED:
          status = HealthStatus.HEALTHY;
          message = 'Circuit is closed (normal operation)';
          break;
        case CircuitState.HALF_OPEN:
          status = HealthStatus.DEGRADED;
          message = 'Circuit is half-open (testing recovery)';
          break;
        case CircuitState.OPEN:
          status = HealthStatus.UNHEALTHY;
          message = 'Circuit is open (failing fast)';
          break;
        default:
          status = HealthStatus.UNKNOWN;
          message = `Unknown circuit state: ${state}`;
      }
      
      return {
        componentId: `circuit-${circuitId}`,
        componentType: ComponentType.CIRCUIT_BREAKER,
        status,
        lastChecked: Date.now(),
        message,
        details: {
          circuitId,
          state
        }
      };
    };
  }

  /**
   * Create a health check function for a service
   * 
   * @param serviceId - The service ID
   * @param getStatus - Function to get the service status
   * @returns Health check function
   */
  static createServiceHealthCheck(
    serviceId: string,
    getStatus: () => ServiceStatus
  ): HealthCheckFn {
    return async () => {
      const status = getStatus();
      
      let healthStatus: HealthStatus;
      let message: string;
      
      switch (status) {
        case SERVICE_STATUS.ONLINE:
        case SERVICE_STATUS.ACTIVE:
          healthStatus = HealthStatus.HEALTHY;
          message = 'Service is online';
          break;
        case SERVICE_STATUS.DEGRADED:
          healthStatus = HealthStatus.DEGRADED;
          message = 'Service is in degraded state';
          break;
        case SERVICE_STATUS.OFFLINE:
        case SERVICE_STATUS.STOPPING:
          healthStatus = HealthStatus.UNHEALTHY;
          message = `Service is ${status.toLowerCase()}`;
          break;
        case SERVICE_STATUS.STARTING:
          healthStatus = HealthStatus.DEGRADED;
          message = 'Service is starting';
          break;
        default:
          healthStatus = HealthStatus.UNKNOWN;
          message = `Unknown service status: ${status}`;
      }
      
      return {
        componentId: `service-${serviceId}`,
        componentType: ComponentType.SERVICE_MANAGER,
        status: healthStatus,
        lastChecked: Date.now(),
        message,
        details: {
          serviceId,
          serviceStatus: status
        }
      };
    };
  }
}

// Create and export a singleton instance
export const healthMonitor = new HealthMonitor();
