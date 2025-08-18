/**
 * Load Balancer for A2A Messaging
 * 
 * Provides functionality to distribute tasks and messages across multiple services
 * based on their capabilities and current load.
 */
import { v4 as uuidv4 } from 'uuid';
import { natsClient } from './natsClient';
import { serviceManager, ServiceInfo, ServiceStatus, SERVICE_STATUS } from './serviceManager';
import { Message, MessageType, TaskCreatePayload, TaskAssignPayload } from './types';

/**
 * Load balancing strategies
 */
export enum LoadBalancingStrategy {
  ROUND_ROBIN = 'round_robin',
  LEAST_BUSY = 'least_busy',
  RANDOM = 'random',
  CONSISTENT_HASH = 'consistent_hash',
  CAPABILITY_MATCH = 'capability_match'
}

/**
 * Options for load balancing
 */
export interface LoadBalancingOptions {
  strategy?: LoadBalancingStrategy;
  preferredServices?: string[];
  requiredCapabilities?: string[];
  excludedServices?: string[];
  taskType?: string;
  timeout?: number;
  maxRetries?: number;
}

/**
 * Interface for service load metrics
 */
export interface ServiceLoadMetrics {
  queueLength: number;
  cpu: number;
  memory: number;
  taskCompletionRate: number;
  averageResponseTime: number;
  errorRate: number;
  lastUpdated: string;
}

/**
 * Load Balancer Manager
 * 
 * Handles distributing tasks and messages across multiple services
 * based on their capabilities and current load.
 */
class LoadBalancerManager {
  private initialized = false;
  private serviceLoads: Map<string, ServiceLoadMetrics> = new Map();
  private roundRobinCounters: Map<string, number> = new Map();
  private serviceCapabilityIndex: Map<string, Set<string>> = new Map();

  /**
   * Initialize the load balancer
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Subscribe to load metrics updates
    await natsClient.subscribe('system.load', this.handleLoadMetricsUpdate.bind(this));
    
    // Build initial capability index from service manager
    this.rebuildCapabilityIndex();
    
    // Subscribe to service status changes to update capability index
    serviceManager.onServiceStatusChange((serviceId: string, status: ServiceStatus) => {
      this.rebuildCapabilityIndex();
    });

    this.initialized = true;
    console.log('Load Balancer initialized');
  }

  /**
   * Shutdown the load balancer
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Unsubscribe from load metrics updates
    await natsClient.unsubscribe('system.load');

    this.initialized = false;
    console.log('Load Balancer shut down');
  }

  /**
   * Handle load metrics update from a service
   * 
   * @param message - The load metrics message
   */
  private async handleLoadMetricsUpdate(message: any): Promise<void> {
    if (!message || !message.payload || !message.payload.serviceId) {
      console.warn('Received invalid load metrics update', message);
      return;
    }

    const { serviceId, metrics } = message.payload;
    
    // Update service load metrics
    this.serviceLoads.set(serviceId, {
      ...metrics,
      lastUpdated: new Date().toISOString()
    });
  }

  /**
   * Rebuild the capability index from the service manager
   */
  private rebuildCapabilityIndex(): void {
    // Clear the current index
    this.serviceCapabilityIndex.clear();
    
    // Get all active services
    const services = serviceManager.getAllServices();
    
    // Build capability index
    for (const service of services) {
      // Skip services that are not active
      if (service.status !== SERVICE_STATUS.ONLINE) {
        continue;
      }
      
      // Add service to capability index
      for (const capability of service.capabilities) {
        if (!this.serviceCapabilityIndex.has(capability)) {
          this.serviceCapabilityIndex.set(capability, new Set());
        }
        
        this.serviceCapabilityIndex.get(capability)?.add(service.serviceId);
      }
    }
  }

  /**
   * Select a service for a task based on load balancing strategy
   * 
   * @param options - Load balancing options
   * @returns The selected service ID or null if no suitable service is found
   */
  async selectServiceForTask(options: LoadBalancingOptions = {}): Promise<string | null> {
    if (!this.initialized) {
      await this.initialize();
    }

    const strategy = options.strategy || LoadBalancingStrategy.LEAST_BUSY;
    
    // Get eligible services based on capabilities and exclusions
    const eligibleServices = this.getEligibleServices(options);
    
    if (eligibleServices.length === 0) {
      console.warn('No eligible services found for task', options);
      return null;
    }
    
    // If only one service is eligible, return it
    if (eligibleServices.length === 1) {
      return eligibleServices[0].serviceId;
    }
    
    // Select service based on strategy
    switch (strategy) {
      case LoadBalancingStrategy.ROUND_ROBIN:
        return this.selectUsingRoundRobin(eligibleServices, options.taskType);
      
      case LoadBalancingStrategy.LEAST_BUSY:
        return this.selectUsingLeastBusy(eligibleServices);
      
      case LoadBalancingStrategy.RANDOM:
        return this.selectUsingRandom(eligibleServices);
      
      case LoadBalancingStrategy.CONSISTENT_HASH:
        return this.selectUsingConsistentHash(eligibleServices, options.taskType || '');
      
      case LoadBalancingStrategy.CAPABILITY_MATCH:
        return this.selectUsingCapabilityMatch(eligibleServices, options.requiredCapabilities || []);
      
      default:
        return this.selectUsingLeastBusy(eligibleServices);
    }
  }

  /**
   * Get eligible services based on capabilities and exclusions
   * 
   * @param options - Load balancing options
   * @returns Array of eligible services
   */
  private getEligibleServices(options: LoadBalancingOptions): ServiceInfo[] {
    const allServices = serviceManager.getAllServices();
    
    return allServices.filter((service: ServiceInfo) => {
      // Filter by status
      if (service.status !== SERVICE_STATUS.ONLINE) {
        return false;
      }
      
      // Filter by excluded services
      if (options.excludedServices && options.excludedServices.includes(service.serviceId)) {
        return false;
      }
      
      // Filter by required capabilities
      if (options.requiredCapabilities && options.requiredCapabilities.length > 0) {
        // Check if service has all required capabilities
        const hasAllCapabilities = options.requiredCapabilities.every(
          capability => service.capabilities.includes(capability)
        );
        
        if (!hasAllCapabilities) {
          return false;
        }
      }
      
      // Filter by task type if specified
      if (options.taskType) {
        // Check if service can handle this task type
        // This assumes task types are registered as capabilities in the format "task.{type}"
        const taskCapability = `task.${options.taskType}`;
        if (!service.capabilities.includes(taskCapability)) {
          return false;
        }
      }
      
      return true;
    });
  }

  /**
   * Select service using round robin strategy
   * 
   * @param services - Array of eligible services
   * @param taskType - Optional task type for separate counters
   * @returns The selected service ID
   */
  private selectUsingRoundRobin(services: ServiceInfo[], taskType?: string): string {
    const counterKey = taskType || 'default';
    
    // Get or initialize counter
    let counter = this.roundRobinCounters.get(counterKey) || 0;
    
    // Select service
    const selectedService = services[counter % services.length];
    
    // Update counter
    counter = (counter + 1) % services.length;
    this.roundRobinCounters.set(counterKey, counter);
    
    return selectedService.serviceId;
  }

  /**
   * Select service with the least load
   * 
   * @param services - Array of eligible services
   * @returns The selected service ID
   */
  private selectUsingLeastBusy(services: ServiceInfo[]): string {
    // Default to first service if no load metrics available
    if (this.serviceLoads.size === 0) {
      return services[0].serviceId;
    }
    
    let leastBusyService = services[0];
    let lowestLoad = Number.MAX_VALUE;
    
    for (const service of services) {
      const loadMetrics = this.serviceLoads.get(service.serviceId);
      
      if (!loadMetrics) {
        // If no metrics, assume low load
        return service.serviceId;
      }
      
      // Calculate load score (lower is better)
      // This is a simple heuristic that can be adjusted based on your needs
      const loadScore = (
        (loadMetrics.queueLength * 10) + 
        (loadMetrics.cpu * 0.5) + 
        (loadMetrics.memory * 0.3) + 
        (loadMetrics.errorRate * 20)
      );
      
      if (loadScore < lowestLoad) {
        lowestLoad = loadScore;
        leastBusyService = service;
      }
    }
    
    return leastBusyService.serviceId;
  }

  /**
   * Select service randomly
   * 
   * @param services - Array of eligible services
   * @returns The selected service ID
   */
  private selectUsingRandom(services: ServiceInfo[]): string {
    const randomIndex = Math.floor(Math.random() * services.length);
    return services[randomIndex].serviceId;
  }

  /**
   * Select service using consistent hashing
   * 
   * @param services - Array of eligible services
   * @param key - The key to hash
   * @returns The selected service ID
   */
  private selectUsingConsistentHash(services: ServiceInfo[], key: string): string {
    // Simple hash function
    const hash = (str: string): number => {
      let hash = 0;
      for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32bit integer
      }
      return Math.abs(hash);
    };
    
    const keyHash = hash(key);
    const serviceIndex = keyHash % services.length;
    
    return services[serviceIndex].serviceId;
  }

  /**
   * Select service based on capability match score
   * 
   * @param services - Array of eligible services
   * @param requiredCapabilities - Array of required capabilities
   * @returns The selected service ID
   */
  private selectUsingCapabilityMatch(services: ServiceInfo[], requiredCapabilities: string[]): string {
    if (requiredCapabilities.length === 0) {
      // Fall back to least busy if no capabilities specified
      return this.selectUsingLeastBusy(services);
    }
    
    let bestService = services[0];
    let bestScore = -1;
    
    for (const service of services) {
      // Calculate capability match score
      let score = 0;
      
      // Count matching capabilities
      for (const capability of requiredCapabilities) {
        if (service.capabilities.includes(capability)) {
          score++;
        }
      }
      
      // Prefer services with fewer total capabilities (more specialized)
      score = score * 1000 - service.capabilities.length;
      
      if (score > bestScore) {
        bestScore = score;
        bestService = service;
      }
    }
    
    return bestService.serviceId;
  }

  /**
   * Assign a task to a service using load balancing
   * 
   * @param taskId - The ID of the task to assign
   * @param taskType - The type of the task
   * @param options - Load balancing options
   * @returns The ID of the service the task was assigned to, or null if assignment failed
   */
  async assignTask(
    taskId: string,
    taskType: string,
    options: LoadBalancingOptions = {}
  ): Promise<string | null> {
    // Select a service for the task
    const serviceId = await this.selectServiceForTask({
      ...options,
      taskType
    });
    
    if (!serviceId) {
      console.warn(`No suitable service found for task ${taskId} of type ${taskType}`);
      return null;
    }
    
    try {
      // Create task assignment message
      const assignMessage: Message<TaskAssignPayload> = {
        type: MessageType.TASK_ASSIGN,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: 'load-balancer'
        },
        payload: {
          taskId,
          taskType,
          assignedTo: serviceId,
          assignedBy: 'load-balancer',
          reason: `Selected using ${options.strategy || LoadBalancingStrategy.LEAST_BUSY} strategy`
        }
      };
      
      // Publish task assignment message
      await natsClient.publish('task.assign', assignMessage);
      
      console.log(`Task ${taskId} assigned to service ${serviceId}`);
      return serviceId;
    } catch (err) {
      console.error(`Failed to assign task ${taskId} to service ${serviceId}:`, err);
      return null;
    }
  }

  /**
   * Report load metrics for the current service
   * 
   * @param metrics - The load metrics to report
   */
  async reportLoadMetrics(metrics: Partial<ServiceLoadMetrics>): Promise<void> {
    if (!natsClient.isConnected) {
      console.warn('NATS not connected, cannot report load metrics');
      return;
    }
    
    try {
      const serviceId = serviceManager.getServiceId();
      
      if (!serviceId) {
        console.warn('No service ID available, cannot report load metrics');
        return;
      }
      
      await natsClient.publish('system.load', {
        type: MessageType.HEARTBEAT, // Reusing heartbeat type for simplicity
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: serviceId
        },
        payload: {
          serviceId,
          metrics: {
            queueLength: metrics.queueLength || 0,
            cpu: metrics.cpu || 0,
            memory: metrics.memory || 0,
            taskCompletionRate: metrics.taskCompletionRate || 0,
            averageResponseTime: metrics.averageResponseTime || 0,
            errorRate: metrics.errorRate || 0,
            lastUpdated: new Date().toISOString()
          }
        }
      });
    } catch (err) {
      console.error('Failed to report load metrics:', err);
    }
  }

  /**
   * Get the current load metrics for all services
   * 
   * @returns Map of service IDs to load metrics
   */
  getServiceLoadMetrics(): Map<string, ServiceLoadMetrics> {
    return new Map(this.serviceLoads);
  }

  /**
   * Get services that can handle a specific capability
   * 
   * @param capability - The capability to look for
   * @returns Array of service IDs that have the capability
   */
  getServicesWithCapability(capability: string): string[] {
    const services = this.serviceCapabilityIndex.get(capability);
    return services ? Array.from(services) : [];
  }
}

export const loadBalancer = new LoadBalancerManager();
