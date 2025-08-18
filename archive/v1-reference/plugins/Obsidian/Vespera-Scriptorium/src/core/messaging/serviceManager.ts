import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { Message, MessageType, RegistrationPayload, HeartbeatPayload, ErrorPayload } from './types';
import { natsClient, NatsClient } from './natsClient';

// Define service status constants
export const SERVICE_STATUS = {
  ONLINE: 'ONLINE',
  OFFLINE: 'OFFLINE',
  DEGRADED: 'DEGRADED',
  STARTING: 'STARTING',
  STOPPING: 'STOPPING',
  ACTIVE: 'ONLINE', // Alias for ONLINE for backward compatibility
} as const;

export type ServiceStatus = typeof SERVICE_STATUS[keyof typeof SERVICE_STATUS];

// Define event types for the service manager
export interface ServiceManagerEvents {
  statusChange: (serviceId: string, status: ServiceStatus) => void;
  error: (error: Error) => void;
  serviceDiscovered: (serviceInfo: ServiceInfo) => void;
  serviceRemoved: (serviceId: string) => void;
}

export interface ServiceInfo {
  serviceId: string;
  serviceType: string;
  capabilities: string[];
  lastSeen: number;
  metadata: Record<string, unknown>;
  status: ServiceStatus;
  version?: string;
  host?: {
    hostname?: string;
    ip?: string;
    pid?: number;
  };
  metrics?: {
    memory?: number;
    cpu?: number;
    uptime?: number;
    queueLength?: number;
  };
}

export interface ServiceManagerOptions {
  serviceType: string;
  capabilities: string[];
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  metadata?: Record<string, unknown>;
  natsClient?: NatsClient;
}

export class ServiceManager extends EventEmitter {
  /**
   * Register a callback for service status change events
   * 
   * @param callback - The callback function to call when a service status changes
   */
  onServiceStatusChange(callback: (serviceId: string, status: ServiceStatus) => void): void {
    this.on('statusChange', callback);
  }
  
  /**
   * Get all known services
   * 
   * @returns Array of all known services
   */
  getAllServices(): ServiceInfo[] {
    return Array.from(this.services.values());
  }
  private serviceId: string;
  private serviceType: string;
  private capabilities: string[];
  private metadata: Record<string, unknown>;
  private heartbeatInterval: number;
  private heartbeatTimeout: number;
  private heartbeatTimer: NodeJS.Timeout | null = null;
  private natsClient: NatsClient;
  private isConnected: boolean = false;
  private services: Map<string, ServiceInfo> = new Map();
  private serviceCheckTimer: NodeJS.Timeout | null = null;
  private subscriptions: string[] = [];

  constructor(options: ServiceManagerOptions) {
    super();
    this.serviceId = `svc-${uuidv4()}`;
    this.serviceType = options.serviceType;
    this.capabilities = options.capabilities;
    this.metadata = options.metadata || {};
    this.heartbeatInterval = options.heartbeatInterval || 30000; // 30 seconds
    this.heartbeatTimeout = options.heartbeatTimeout || 90000; // 90 seconds
    this.natsClient = options.natsClient || natsClient;
  }

  /**
   * Initialize the service manager
   */
  async initialize(): Promise<void> {
    try {
      // Connect to NATS if not already connected
      if (!this.natsClient) {
        throw new Error('NATS client is not available');
      }

      // Register this service
      await this.registerService();

      // Start sending heartbeats
      this.startHeartbeat();

      // Start checking service status
      this.startServiceChecker();

      // Subscribe to service discovery messages
      await this.setupSubscriptions();

      console.log(`Service ${this.serviceId} (${this.serviceType}) initialized`);
    } catch (error) {
      console.error('Failed to initialize service manager:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    // Stop timers
    this.stopHeartbeat();
    this.stopServiceChecker();

    // Unregister this service
    try {
      await this.unregisterService();
    } catch (error) {
      console.error('Error during service unregistration:', error);
    }

    // Unsubscribe from all subscriptions
    await Promise.all(
      this.subscriptions.map(subId => 
        this.natsClient.unsubscribe(subId).catch(console.error)
      )
    );

    console.log(`Service ${this.serviceId} (${this.serviceType}) shut down`);
  }

  /**
   * Register this service with the discovery system
   */
  private async registerService(): Promise<void> {
    const registration: Message<RegistrationPayload> = {
      type: MessageType.REGISTER,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId,
      },
      payload: {
        agentId: this.serviceId,
        capabilities: this.capabilities,
        metadata: this.metadata,
      },
    };

    await this.natsClient.publish('service.discovery.register', registration);
    console.log(`Service ${this.serviceId} registered`);
  }

  /**
   * Unregister this service
   */
  private async unregisterService(): Promise<void> {
    const unregister: Message<{ agentId: string }> = {
      type: MessageType.UNREGISTER,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId,
      },
      payload: {
        agentId: this.serviceId,
      },
    };

    await this.natsClient.publish('service.discovery.unregister', unregister);
    console.log(`Service ${this.serviceId} unregistered`);
  }

  /**
   * Start sending heartbeat messages
   */
  private startHeartbeat(): void {
    const sendHeartbeat = async () => {
      const heartbeat: Message<HeartbeatPayload> = {
        type: MessageType.HEARTBEAT,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
        },
        payload: {
          timestamp: new Date().toISOString(),
          status: SERVICE_STATUS.ONLINE,
          metrics: {
            memoryUsage: process.memoryUsage().heapUsed,
            uptime: process.uptime(),
          },
        },
      };

      try {
        await this.natsClient.publish('service.heartbeat', heartbeat);
      } catch (error) {
        console.error('Failed to send heartbeat:', error);
      }
    };

    // Send initial heartbeat
    sendHeartbeat().catch(console.error);

    // Set up interval for subsequent heartbeats
    this.heartbeatTimer = setInterval(sendHeartbeat, this.heartbeatInterval);
  }

  /**
   * Stop sending heartbeat messages
   */
  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }

  /**
   * Start checking service status
   */
  private startServiceChecker(): void {
    this.serviceCheckTimer = setInterval(() => {
      const now = Date.now();
      
      this.services.forEach((service, serviceId) => {
        if (now - service.lastSeen > this.heartbeatTimeout) {
          console.warn(`Service ${serviceId} (${service.serviceType}) is offline`);
          service.status = SERVICE_STATUS.OFFLINE;
          this.notifyServiceStatusChange(serviceId, SERVICE_STATUS.OFFLINE, 'Heartbeat timeout').catch(console.error);
        }
      });
    }, this.heartbeatInterval);
  }

  /**
   * Stop checking service status
   */
  private stopServiceChecker(): void {
    if (this.serviceCheckTimer) {
      clearInterval(this.serviceCheckTimer);
      this.serviceCheckTimer = null;
    }
  }

  /**
   * Set up message subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    // Subscribe to heartbeats from other services
    const heartbeatSubId = await this.natsClient.subscribe<HeartbeatPayload>(
      'service.heartbeat.>',
      this.handleHeartbeat.bind(this)
    );
    this.subscriptions.push(heartbeatSubId);

    // Subscribe to service registration events
    const registerSubId = await this.natsClient.subscribe<RegistrationPayload>(
      'service.discovery.register',
      this.handleServiceRegistration.bind(this)
    );
    this.subscriptions.push(registerSubId);

    // Subscribe to service unregistration events
    const unregisterSubId = await this.natsClient.subscribe<{ agentId: string }>(
      'service.discovery.unregister',
      this.handleServiceUnregistration.bind(this)
    );
    this.subscriptions.push(unregisterSubId);
  }

  /**
   * Handle incoming heartbeat messages
   */
  private handleHeartbeat(message: Message<HeartbeatPayload>): void {
    const { source } = message.headers;
    const { status, timestamp } = message.payload;
    
    if (source === this.serviceId) {
      return; // Ignore our own heartbeats
    }

    // Update or create service info
    const existingService = this.services.get(source);
    const now = Date.now();
    
    if (existingService) {
      // Update existing service
      const previousStatus = existingService.status;
      existingService.lastSeen = now;
      existingService.status = status as ServiceStatus;
      
      // Notify if status changed
      if (previousStatus !== status) {
        this.notifyServiceStatusChange(source, status as ServiceStatus).catch(console.error);
      }
    } else {
      // New service discovered via heartbeat
      this.services.set(source, {
        serviceId: source,
        serviceType: 'unknown', // We don't know the type from heartbeat alone
        capabilities: [],
        lastSeen: now,
        metadata: {},
        status: status as ServiceStatus
      });
      
      // Notify about new service
      this.emit('serviceDiscovered', this.services.get(source));
    }
  }
  
  /**
   * Handle service registration messages
   * @private
   */
  private handleServiceRegistration(message: Message<RegistrationPayload>): void {
    const { source } = message.headers;
    const { capabilities, metadata, agentId } = message.payload;
    
    if (source === this.serviceId) {
      return; // Ignore our own registration
    }
    
    // Update or create service info
    const now = Date.now();
    const existingService = this.services.get(agentId);
    
    if (existingService) {
      // Update existing service
      existingService.lastSeen = now;
      existingService.capabilities = capabilities;
      existingService.metadata = metadata || {};
      existingService.status = SERVICE_STATUS.ONLINE;
    } else {
      // New service
      this.services.set(agentId, {
        serviceId: agentId,
        serviceType: metadata && typeof metadata.serviceType === 'string' ? metadata.serviceType : 'unknown',
        capabilities,
        lastSeen: now,
        metadata: metadata || {},
        status: SERVICE_STATUS.ONLINE
      });
      
      // Notify about new service
      this.emit('serviceDiscovered', this.services.get(agentId));
    }
    
    // Notify status change
    this.notifyServiceStatusChange(agentId, SERVICE_STATUS.ONLINE, 'Service registered').catch(console.error);
  }
  
  /**
   * Handle service unregistration messages
   * @private
   */
  private handleServiceUnregistration(message: Message<{ agentId: string }>): void {
    const { source } = message.headers;
    const { agentId } = message.payload;
    
    if (source === this.serviceId) {
      return; // Ignore our own unregistration
    }
    
    // Check if we know this service
    if (this.services.has(agentId)) {
      // Update status before removing
      this.notifyServiceStatusChange(agentId, SERVICE_STATUS.OFFLINE, 'Service unregistered').catch(console.error);
      
      // Remove service
      this.services.delete(agentId);
      
      // Notify about service removal
      this.emit('serviceRemoved', agentId);
    }
  }
  /**
   * Notify about a service's status change
   * @private
   */
  private async notifyServiceStatusChange(serviceId: string, status: ServiceStatus, reason?: string): Promise<void> {
    try {
      // Emit local event
      this.emit('statusChange', serviceId, status);
      
      // Publish status change message to NATS
      const statusChangeMessage: Message<{ serviceId: string; status: ServiceStatus; reason?: string }> = {
        type: MessageType.SERVICE_STATUS_CHANGE,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
        },
        payload: {
          serviceId,
          status,
          reason,
        },
      };
      
      await this.natsClient.publish('service.status.change', statusChangeMessage);
    } catch (error) {
      console.error('Failed to notify service status change:', error);
    }
  }
  
  /**
   * Notify about this service's status change
   * @private
   */
  private async notifyStatusChange(status: ServiceStatus, error?: Error): Promise<void> {
    try {
      // Emit local event
      this.emit('statusChange', this.serviceId, status);
      
      // Publish status change message to NATS
      const statusChangeMessage: Message<{ serviceId: string; status: ServiceStatus; reason?: string }> = {
        type: MessageType.SERVICE_STATUS_CHANGE,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
        },
        payload: {
          serviceId: this.serviceId,
          status,
          reason: error?.message,
        },
      };
      
      await this.natsClient.publish('service.status.change', statusChangeMessage);
    } catch (error) {
      console.error('Failed to notify service status change:', error);
    }
  }

  /**
   * Get the ID of this service
   */
  getServiceId(): string {
    return this.serviceId;
  }

  /**
   * Get the type of this service
   */
  getServiceType(): string {
    return this.serviceType;
  }
}



// Create and export a default instance of the service manager
export const serviceManager = new ServiceManager({
  serviceType: 'default',
  capabilities: ['core'],
});
