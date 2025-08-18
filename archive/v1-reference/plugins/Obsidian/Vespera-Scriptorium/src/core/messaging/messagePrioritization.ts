/**
 * Message Prioritization for A2A Messaging
 * 
 * Provides functionality to prioritize messages based on their importance and urgency.
 * This ensures critical messages are processed before less important ones.
 */
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageType } from './types';
import { natsClient } from './natsClient';

/**
 * Message priority levels
 */
export enum MessagePriority {
  CRITICAL = 'critical',   // Highest priority, processed immediately
  HIGH = 'high',           // High priority, processed before normal
  NORMAL = 'normal',       // Default priority
  LOW = 'low',             // Low priority, processed after normal
  BACKGROUND = 'background' // Lowest priority, processed when system is idle
}

/**
 * Interface for prioritized message
 */
export interface PrioritizedMessage<T = unknown> {
  message: Message<T>;
  priority: MessagePriority;
  timestamp: string;
  expiresAt?: string;
  processingAttempts: number;
}

/**
 * Options for message prioritization
 */
export interface PrioritizationOptions {
  priority?: MessagePriority;
  timeToLive?: number; // Time to live in milliseconds
  expirationStrategy?: 'discard' | 'downgrade' | 'persist';
  maxProcessingAttempts?: number;
}

/**
 * Message Prioritization Manager
 * 
 * Handles prioritizing messages and ensuring they are processed in the appropriate order.
 */
class MessagePrioritizationManager {
  private initialized = false;
  private priorityQueues: Map<string, PrioritizedMessage[]> = new Map();
  private processingInterval: NodeJS.Timeout | null = null;
  private subjectHandlers: Map<string, (message: any) => Promise<void>> = new Map();
  private priorityThrottles: Map<MessagePriority, number> = new Map();

  /**
   * Initialize the message prioritization manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Initialize priority queues for different subjects
    this.priorityQueues.clear();
    
    // Set up default throttling limits (messages per second)
    this.priorityThrottles.set(MessagePriority.CRITICAL, Infinity); // No limit
    this.priorityThrottles.set(MessagePriority.HIGH, 100);
    this.priorityThrottles.set(MessagePriority.NORMAL, 50);
    this.priorityThrottles.set(MessagePriority.LOW, 20);
    this.priorityThrottles.set(MessagePriority.BACKGROUND, 5);
    
    // Start processing queues
    this.processingInterval = setInterval(
      this.processQueues.bind(this), 
      50 // Process every 50ms
    );

    this.initialized = true;
    console.log('Message Prioritization Manager initialized');
  }

  /**
   * Shutdown the message prioritization manager
   */
  async shutdown(): Promise<void> {
    if (!this.initialized) {
      return;
    }

    // Clear the processing interval
    if (this.processingInterval) {
      clearInterval(this.processingInterval);
      this.processingInterval = null;
    }

    // Unsubscribe from all subjects
    for (const subject of this.subjectHandlers.keys()) {
      await natsClient.unsubscribe(subject);
    }

    this.initialized = false;
    console.log('Message Prioritization Manager shut down');
  }

  /**
   * Subscribe to a subject with prioritization
   * 
   * @param subject - The subject to subscribe to
   * @param handler - The handler function for messages
   * @param defaultPriority - Default priority for messages on this subject
   * @returns Subscription ID
   */
  async subscribePrioritized(
    subject: string,
    handler: (message: any) => Promise<void>,
    defaultPriority: MessagePriority = MessagePriority.NORMAL
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Initialize queue for this subject if it doesn't exist
    if (!this.priorityQueues.has(subject)) {
      this.priorityQueues.set(subject, []);
    }

    // Store the handler
    this.subjectHandlers.set(subject, handler);
    
    // Subscribe to the subject
    const subscription = await natsClient.subscribe(subject, async (message: any) => {
      // Determine message priority
      let priority = defaultPriority;
      
      // Check if message has priority in headers
      if (message.headers && message.headers.priority) {
        priority = message.headers.priority as MessagePriority;
      }
      
      // Create prioritized message
      const prioritizedMessage: PrioritizedMessage = {
        message,
        priority,
        timestamp: new Date().toISOString(),
        processingAttempts: 0
      };
      
      // Add expiration if TTL is specified
      if (message.headers && message.headers.ttl) {
        const ttl = parseInt(message.headers.ttl as string, 10);
        if (!isNaN(ttl) && ttl > 0) {
          prioritizedMessage.expiresAt = new Date(Date.now() + ttl).toISOString();
        }
      }
      
      // Add to priority queue
      const queue = this.priorityQueues.get(subject) || [];
      queue.push(prioritizedMessage);
      
      // Sort queue by priority (highest first) and then by timestamp (oldest first)
      queue.sort((a, b) => {
        // First sort by priority
        const priorityOrder = this.getPriorityValue(a.priority) - this.getPriorityValue(b.priority);
        if (priorityOrder !== 0) {
          return priorityOrder;
        }
        
        // Then sort by timestamp (oldest first)
        return new Date(a.timestamp).getTime() - new Date(b.timestamp).getTime();
      });
      
      this.priorityQueues.set(subject, queue);
    });

    return subscription;
  }

  /**
   * Get numeric value for priority (lower is higher priority)
   * 
   * @param priority - The priority to get value for
   * @returns Numeric value for sorting
   */
  private getPriorityValue(priority: MessagePriority): number {
    switch (priority) {
      case MessagePriority.CRITICAL: return 0;
      case MessagePriority.HIGH: return 1;
      case MessagePriority.NORMAL: return 2;
      case MessagePriority.LOW: return 3;
      case MessagePriority.BACKGROUND: return 4;
      default: return 2; // Default to NORMAL
    }
  }

  /**
   * Process all priority queues
   */
  private async processQueues(): Promise<void> {
    const now = new Date();
    const processedCounts: Map<MessagePriority, number> = new Map();
    
    // Initialize processed counts
    for (const priority of Object.values(MessagePriority)) {
      processedCounts.set(priority as MessagePriority, 0);
    }
    
    // Process each subject queue
    for (const [subject, queue] of this.priorityQueues.entries()) {
      if (queue.length === 0) {
        continue;
      }
      
      const handler = this.subjectHandlers.get(subject);
      if (!handler) {
        console.warn(`No handler found for subject ${subject}`);
        continue;
      }
      
      // Get throttle limits
      const throttleLimits = new Map(this.priorityThrottles);
      
      // Process messages in priority order
      const remainingMessages: PrioritizedMessage[] = [];
      
      for (const prioritizedMessage of queue) {
        // Check if message has expired
        if (prioritizedMessage.expiresAt && new Date(prioritizedMessage.expiresAt) < now) {
          // Message has expired, skip it
          console.log(`Message expired: ${subject} (Priority: ${prioritizedMessage.priority})`);
          continue;
        }
        
        // Check throttle limit for this priority
        const priority = prioritizedMessage.priority;
        const processedCount = processedCounts.get(priority) || 0;
        const throttleLimit = throttleLimits.get(priority) || 0;
        
        if (processedCount >= throttleLimit) {
          // Throttle limit reached, keep message in queue
          remainingMessages.push(prioritizedMessage);
          continue;
        }
        
        // Process the message
        try {
          prioritizedMessage.processingAttempts++;
          await handler(prioritizedMessage.message);
          
          // Update processed count
          processedCounts.set(priority, processedCount + 1);
        } catch (err) {
          console.error(`Error processing prioritized message for ${subject}:`, err);
          
          // If max attempts not reached, keep in queue
          if (prioritizedMessage.processingAttempts < 3) {
            remainingMessages.push(prioritizedMessage);
          } else {
            console.warn(`Dropping message after ${prioritizedMessage.processingAttempts} failed attempts`);
          }
        }
      }
      
      // Update queue with remaining messages
      this.priorityQueues.set(subject, remainingMessages);
    }
  }

  /**
   * Publish a message with priority
   * 
   * @param subject - The subject to publish to
   * @param message - The message to publish
   * @param options - Prioritization options
   */
  async publishWithPriority<T>(
    subject: string,
    message: Message<T>,
    options: PrioritizationOptions = {}
  ): Promise<void> {
    if (!this.initialized) {
      await this.initialize();
    }

    // Add priority to message headers
    const priority = options.priority || MessagePriority.NORMAL;
    const enhancedMessage = {
      ...message,
      headers: {
        ...message.headers,
        priority,
      }
    };
    
    // Add TTL if specified
    if (options.timeToLive) {
      enhancedMessage.headers.ttl = options.timeToLive;
    }
    
    // Add expiration strategy if specified
    if (options.expirationStrategy) {
      (enhancedMessage.headers as any).expirationStrategy = options.expirationStrategy;
    }
    
    // Add max processing attempts if specified
    if (options.maxProcessingAttempts) {
      (enhancedMessage.headers as any).maxProcessingAttempts = options.maxProcessingAttempts.toString();
    }
    
    // Publish the message
    await natsClient.publish(subject, enhancedMessage);
  }

  /**
   * Set throttle limit for a priority level
   * 
   * @param priority - The priority level
   * @param messagesPerSecond - Maximum messages per second to process
   */
  setThrottleLimit(priority: MessagePriority, messagesPerSecond: number): void {
    this.priorityThrottles.set(priority, messagesPerSecond);
  }

  /**
   * Get the current queue lengths for all subjects
   * 
   * @returns Map of subjects to queue lengths
   */
  getQueueLengths(): Map<string, number> {
    const queueLengths = new Map<string, number>();
    
    for (const [subject, queue] of this.priorityQueues.entries()) {
      queueLengths.set(subject, queue.length);
    }
    
    return queueLengths;
  }

  /**
   * Get detailed queue statistics
   * 
   * @returns Detailed queue statistics
   */
  getQueueStatistics(): {
    totalMessages: number;
    byPriority: Record<MessagePriority, number>;
    bySubject: Record<string, number>;
    oldestMessage: string | null;
  } {
    const stats = {
      totalMessages: 0,
      byPriority: {
        [MessagePriority.CRITICAL]: 0,
        [MessagePriority.HIGH]: 0,
        [MessagePriority.NORMAL]: 0,
        [MessagePriority.LOW]: 0,
        [MessagePriority.BACKGROUND]: 0
      },
      bySubject: {} as Record<string, number>,
      oldestMessage: null as string | null
    };
    
    let oldestTimestamp: Date | null = null;
    
    for (const [subject, queue] of this.priorityQueues.entries()) {
      const subjectCount = queue.length;
      stats.totalMessages += subjectCount;
      stats.bySubject[subject] = subjectCount;
      
      for (const message of queue) {
        // Count by priority
        stats.byPriority[message.priority]++;
        
        // Track oldest message
        const messageTimestamp = new Date(message.timestamp);
        if (!oldestTimestamp || messageTimestamp < oldestTimestamp) {
          oldestTimestamp = messageTimestamp;
        }
      }
    }
    
    stats.oldestMessage = oldestTimestamp ? oldestTimestamp.toISOString() : null;
    
    return stats;
  }
}

export const messagePrioritization = new MessagePrioritizationManager();
