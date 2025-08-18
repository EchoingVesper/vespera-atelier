import { connect, NatsConnection, JSONCodec, NatsError, Subscription, Msg, ConnectionOptions } from 'nats';
import { Message, MessageHeaders, MessageType } from './types';

const JSON_CODEC = JSONCodec();

export interface NatsClientOptions {
  servers: string | string[];
  name?: string;
  timeout?: number;
  maxReconnectAttempts?: number;
  pingInterval?: number;
  debug?: boolean;
}

export interface SubscriptionOptions {
  queue?: string;
  maxMessages?: number;
  timeout?: number;
}

export class NatsClient {
  private nc: NatsConnection | null = null;
  private subscriptions: Map<string, Subscription> = new Map();
  private _isConnected = false;
  private options: Required<NatsClientOptions>;
  private reconnectAttempts = 0;
  private reconnectTimer: NodeJS.Timeout | null = null;
  private readonly defaultTimeout: number;
  private readonly maxReconnectAttempts: number;
  private readonly pingInterval: number;
  private readonly debug: boolean;

  constructor(options: NatsClientOptions) {
    this.options = {
      name: 'vespera-agent',
      timeout: 5000,
      maxReconnectAttempts: 10,
      pingInterval: 30000,
      debug: false,
      ...options,
    };

    this.defaultTimeout = this.options.timeout;
    this.maxReconnectAttempts = this.options.maxReconnectAttempts;
    this.pingInterval = this.options.pingInterval;
    this.debug = this.options.debug;
  }

  /**
   * Check if the client is connected to NATS
   * @returns True if connected, false otherwise
   */
  get isConnected(): boolean {
    return this._isConnected;
  }

  set isConnected(value: boolean) {
    this._isConnected = value;
  }

  /**
   * Connect to NATS server
   */
  async connect(): Promise<void> {
    if (this.isConnected) {
      this.log('Already connected to NATS');
      return;
    }

    try {
      this.log(`Connecting to NATS at ${this.options.servers}`);
      
      this.nc = await connect({
        servers: this.options.servers,
        name: this.options.name,
        timeout: this.options.timeout,
        maxReconnectAttempts: -1, // We'll handle reconnection ourselves
        reconnect: true,
        reconnectTimeWait: 1000,
        pingInterval: this.pingInterval,
      });

      this.setupEventHandlers();
      this.isConnected = true;
      this.reconnectAttempts = 0;
      
      this.log('Successfully connected to NATS');
    } catch (error) {
      this.logError('Failed to connect to NATS', error);
      this.isConnected = false;
      throw new Error('Connection failed');
    }
  }

  /**
   * Disconnect from NATS server
   */
  async disconnect(): Promise<void> {
    if (!this.nc) return;

    this.log('Disconnecting from NATS...');
    
    // Clear any pending reconnection
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }

    // Unsubscribe from all subscriptions
    for (const [subject, sub] of this.subscriptions.entries()) {
      try {
        sub.unsubscribe();
        this.subscriptions.delete(subject);
      } catch (error) {
        this.logError(`Error unsubscribing from ${subject}`, error);
      }
    }

    // Close the connection
    try {
      await this.nc.drain();
      await this.nc.close();
      this.nc = null;
      this.isConnected = false;
      this.log('Successfully disconnected from NATS');
    } catch (error) {
      this.logError('Error disconnecting from NATS', error);
      throw error;
    }
  }

  /**
   * Close the NATS connection
   * Alias for disconnect() for compatibility with tests
   */
  async close(): Promise<void> {
    return this.disconnect();
  }
  
  /**
   * Set up event handlers for NATS connection
   */
  private setupEventHandlers(): void {
    if (!this.nc) return;
    
    // Set up connection monitoring
    (async () => {
      for await (const status of this.nc!.status()) {
        if (this.debug) {
          console.log(`NATS connection status: ${status.type}`);
        }
        
        if (status.type === 'disconnect' || status.type === 'error') {
          this.isConnected = false;
          // Attempt to reconnect
          this.attemptReconnect();
        }
      }
    })().catch(error => {
      console.error('Error monitoring NATS connection status:', error);
    });
  }

  /**
   * Attempt to reconnect to NATS
   * @private
   */
  private attemptReconnect(): void {
    if (this.reconnectTimer || this.reconnectAttempts >= this.maxReconnectAttempts) {
      if (this.reconnectAttempts >= this.maxReconnectAttempts) {
        this.logError('Max reconnection attempts reached. Giving up.');
      }
      return;
    }

    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);
    this.reconnectAttempts++;
    
    this.log(`Attempting to reconnect (${this.reconnectAttempts}/${this.maxReconnectAttempts}) in ${delay}ms`);
    
    this.reconnectTimer = setTimeout(async () => {
      try {
        await this.connect();
      } catch (error) {
        this.logError('Reconnection attempt failed', error);
        this.attemptReconnect();
      }
    }, delay);
  }

  /**
   * Generate a unique ID
   */
  private generateId(): string {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  /**
   * Log a message
   */
  private log(message: string, data?: unknown): void {
    if (this.debug) {
      console.log(`[NATS] ${message}`, data ? data : '');
    }
  }

  /**
   * Log an error
   */
  private logError(message: string, error: unknown = ''): void {
    console.error(`[NATS] ${message}`, error);
  }

  /**
   * Publish a message to a subject
   */
  async publish<T>(
    subject: string,
    message: Omit<Message<T>, 'headers'> & { headers?: Partial<MessageHeaders> }
  ): Promise<void> {
    if (!this.nc) {
      throw new Error('Not connected to NATS');
    }

    try {
      const headers: MessageHeaders = {
        correlationId: this.generateId(),
        messageId: this.generateId(),
        timestamp: new Date().toISOString(),
        source: this.options.name || 'unknown',
        ...message.headers,
      };

      const fullMessage: Message<T> = {
        ...message,
        headers,
      };

      this.log(`Publishing to ${subject}`, { messageId: headers.messageId });
      this.nc.publish(subject, JSON_CODEC.encode(fullMessage));
    } catch (error) {
      this.logError(`Failed to publish message to ${subject}`, error);
      throw error;
    }
  }

  /**
   * Subscribe to a subject
   */
  async subscribe<T>(
    subject: string,
    handler: (message: Message<T>) => Promise<void> | void,
    options: SubscriptionOptions = {}
  ): Promise<string> {
    if (!this.nc) {
      throw new Error('Not connected to NATS');
    }

    const sub = this.nc.subscribe(subject, {
      queue: options.queue,
      max: options.maxMessages,
      timeout: options.timeout,
    });

    const subscriptionId = this.generateId();
    this.subscriptions.set(subscriptionId, sub);

    // Start processing messages
    this.processMessages(sub, handler).catch(error => {
      this.logError(`Error in message processor for ${subject}`, error);
    });

    this.log(`Subscribed to ${subject} [${subscriptionId}]`);
    return subscriptionId;
  }

  /**
   * Unsubscribe from a subscription
   */
  async unsubscribe(subscriptionId: string): Promise<void> {
    const sub = this.subscriptions.get(subscriptionId);
    if (!sub) {
      this.log(`No subscription found with ID: ${subscriptionId}`, 'warn');
      return;
    }

    try {
      sub.unsubscribe();
      this.subscriptions.delete(subscriptionId);
      this.log(`Unsubscribed from ${subscriptionId}`);
    } catch (error) {
      this.logError(`Error unsubscribing from ${subscriptionId}`, error);
      throw error;
    }
  }

  /**
   * Request/Reply pattern
   */
  async request<T, R>(
    subject: string,
    message: Omit<Message<T>, 'headers'> & { headers?: Partial<MessageHeaders> },
    timeout = this.defaultTimeout
  ): Promise<Message<R>> {
    if (!this.nc) {
      throw new Error('Not connected to NATS');
    }

    const headers: MessageHeaders = {
      correlationId: this.generateId(),
      messageId: this.generateId(),
      timestamp: new Date().toISOString(),
      source: this.options.name || 'unknown',
      ...message.headers,
    };

    const fullMessage: Message<T> = {
      ...message,
      headers,
    };

    try {
      this.log(`Sending request to ${subject}`, { messageId: headers.messageId });
      
      const response = await this.nc.request(
        subject,
        JSON_CODEC.encode(fullMessage),
        { timeout, noMux: true }
      );

      return JSON_CODEC.decode(response.data) as Message<R>;
    } catch (error) {
      this.logError(`Request to ${subject} failed`, error);
      throw error;
    }
  }

  /**
   * Process incoming messages for a subscription
   */
  private async processMessages<T>(
    sub: Subscription,
    handler: (message: Message<T>) => Promise<void> | void
  ): Promise<void> {
    for await (const msg of sub) {
      try {
        const message = JSON_CODEC.decode(msg.data) as Message<T>;
        this.log(`Received message on ${msg.subject}`, {
          messageId: message.headers.messageId,
          type: message.type,
        });
        await handler(message);
      } catch (error) {
        this.logError('Error processing message', error);
      }
    }
  }
}

// Singleton instance
export const natsClient = new NatsClient({
  servers: process.env.NATS_URL || 'nats://localhost:4222',
  name: `vespera-${process.env.NODE_ENV || 'development'}-${Math.random().toString(36).substr(2, 4)}`,
  debug: process.env.NODE_ENV !== 'production',
});
