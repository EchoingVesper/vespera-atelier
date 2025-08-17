/**
 * Message Persistence for A2A Messaging
 * 
 * Provides functionality to persist messages to storage and retrieve them later.
 * This ensures message delivery even when services are temporarily unavailable.
 */
import { v4 as uuidv4 } from 'uuid';
import { Message, MessageType } from './types';
import { natsClient } from './natsClient';
import { storageManager } from './storageManager';

// Constants
const PERSISTENCE_NAMESPACE = 'a2a.persistence';
const MAX_RETRY_ATTEMPTS = 5;
const RETRY_INTERVALS = [1000, 5000, 15000, 30000, 60000]; // Increasing intervals in ms

/**
 * Interface for persisted message data
 */
export interface PersistedMessage<T = unknown> {
  message: Message<T>;
  targetSubject: string;
  attempts: number;
  lastAttempt: string | null;
  nextAttempt: string | null;
  persistedAt: string;
  status: 'pending' | 'processing' | 'delivered' | 'failed';
  errorDetails?: string;
}

/**
 * Options for message persistence
 */
export interface PersistenceOptions {
  maxRetries?: number;
  retryIntervals?: number[];
  priority?: 'high' | 'normal' | 'low';
  ttl?: number; // Time to live in milliseconds
}

/**
 * Message Persistence Manager
 * 
 * Handles storing messages to persistent storage and managing retry attempts
 * for failed message deliveries.
 */
class MessagePersistenceManager {
  private initialized = false;
  private processingInterval: NodeJS.Timeout | null = null;
  private retryQueue: Map<string, PersistedMessage> = new Map();

  /**
   * Initialize the message persistence manager
   */
  async initialize(): Promise<void> {
    if (this.initialized) {
      return;
    }

    // Subscribe to message delivery acknowledgments
    await natsClient.subscribe('a2a.persistence.ack', this.handleAcknowledgment.bind(this));
    
    // Start processing the retry queue
    this.processingInterval = setInterval(
      this.processRetryQueue.bind(this), 
      5000 // Check every 5 seconds
    );

    this.initialized = true;
    console.log('Message Persistence Manager initialized');
  }

  /**
   * Shutdown the message persistence manager
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

    // Unsubscribe from acknowledgments
    await natsClient.unsubscribe('a2a.persistence.ack');

    this.initialized = false;
    console.log('Message Persistence Manager shut down');
  }

  /**
   * Persist a message to storage for reliable delivery
   * 
   * @param message - The message to persist
   * @param targetSubject - The subject to publish the message to
   * @param options - Options for persistence
   * @returns The ID of the persisted message
   */
  async persistMessage<T>(
    message: Message<T>, 
    targetSubject: string, 
    options: PersistenceOptions = {}
  ): Promise<string> {
    if (!this.initialized) {
      await this.initialize();
    }

    const persistenceId = uuidv4();
    const now = new Date().toISOString();
    
    const persistedMessage: PersistedMessage<T> = {
      message,
      targetSubject,
      attempts: 0,
      lastAttempt: null,
      nextAttempt: now, // Schedule for immediate delivery
      persistedAt: now,
      status: 'pending'
    };

    // Store the message in persistent storage
    await storageManager.setValue(
      persistenceId, 
      persistedMessage, 
      { 
        namespace: PERSISTENCE_NAMESPACE,
        metadata: {
          messageType: message.type,
          priority: options.priority || 'normal',
          ttl: options.ttl
        }
      }
    );

    // Add to in-memory queue for immediate processing
    this.retryQueue.set(persistenceId, persistedMessage);

    return persistenceId;
  }

  /**
   * Handle acknowledgment of message delivery
   * 
   * @param ack - The acknowledgment message
   */
  private async handleAcknowledgment(ack: any): Promise<void> {
    if (!ack || !ack.payload || !ack.payload.persistenceId) {
      console.warn('Received invalid acknowledgment', ack);
      return;
    }

    const { persistenceId, success, error } = ack.payload;
    
    try {
      // Get the persisted message
      const persistedMessage = await storageManager.getValue<PersistedMessage>(
        persistenceId, 
        { namespace: PERSISTENCE_NAMESPACE }
      );

      if (!persistedMessage) {
        console.warn(`No persisted message found for ID: ${persistenceId}`);
        return;
      }

      if (success) {
        // Mark as delivered and update storage
        persistedMessage.status = 'delivered';
        await storageManager.setValue(
          persistenceId, 
          persistedMessage, 
          { namespace: PERSISTENCE_NAMESPACE }
        );

        // Remove from retry queue if present
        this.retryQueue.delete(persistenceId);
        
        console.log(`Message ${persistenceId} successfully delivered after ${persistedMessage.attempts} attempts`);
      } else {
        // Update failure details
        persistedMessage.status = 'failed';
        persistedMessage.errorDetails = error || 'Unknown error';
        persistedMessage.lastAttempt = new Date().toISOString();
        
        // Determine if we should retry
        if (persistedMessage.attempts < (MAX_RETRY_ATTEMPTS - 1)) {
          // Schedule next retry
          const nextRetryDelay = RETRY_INTERVALS[persistedMessage.attempts] || RETRY_INTERVALS[RETRY_INTERVALS.length - 1];
          const nextRetryTime = new Date(Date.now() + nextRetryDelay);
          
          persistedMessage.nextAttempt = nextRetryTime.toISOString();
          persistedMessage.status = 'pending';
          
          console.log(`Will retry message ${persistenceId} at ${nextRetryTime.toISOString()}`);
        } else {
          console.error(`Message ${persistenceId} failed after ${persistedMessage.attempts} attempts: ${error}`);
        }

        // Update storage
        await storageManager.setValue(
          persistenceId, 
          persistedMessage, 
          { namespace: PERSISTENCE_NAMESPACE }
        );
      }
    } catch (err) {
      console.error('Error processing acknowledgment:', err);
    }
  }

  /**
   * Process the retry queue, attempting to deliver pending messages
   */
  private async processRetryQueue(): Promise<void> {
    if (!natsClient.isConnected) {
      console.log('NATS not connected, skipping retry queue processing');
      return;
    }

    const now = new Date();
    const pendingMessages = await this.getPendingMessages();
    
    console.log(`Processing ${pendingMessages.length} pending messages`);
    
    for (const { id, message } of pendingMessages) {
      try {
        // Skip messages that aren't due for retry yet
        if (message.nextAttempt && new Date(message.nextAttempt) > now) {
          continue;
        }

        // Update attempt count and timestamp
        message.attempts += 1;
        message.lastAttempt = now.toISOString();
        message.status = 'processing';
        
        // Update storage before attempting delivery
        await storageManager.setValue(id, message, { namespace: PERSISTENCE_NAMESPACE });
        
        // Add persistence metadata to headers
        const messageWithMetadata = {
          ...message.message,
          headers: {
            ...message.message.headers,
            persistenceId: id,
            persistenceAttempt: message.attempts
          }
        };
        
        // Attempt to publish the message
        await natsClient.publish(message.targetSubject, messageWithMetadata);
        
        console.log(`Retry attempt ${message.attempts} for message ${id}`);
      } catch (err) {
        console.error(`Error processing retry for message ${id}:`, err);
        
        // Update failure details in storage
        try {
          message.status = 'failed';
          message.errorDetails = err instanceof Error ? err.message : String(err);
          
          if (message.attempts < MAX_RETRY_ATTEMPTS) {
            // Schedule next retry
            const nextRetryDelay = RETRY_INTERVALS[message.attempts - 1] || RETRY_INTERVALS[RETRY_INTERVALS.length - 1];
            const nextRetryTime = new Date(Date.now() + nextRetryDelay);
            
            message.nextAttempt = nextRetryTime.toISOString();
            message.status = 'pending';
          }
          
          await storageManager.setValue(id, message, { namespace: PERSISTENCE_NAMESPACE });
        } catch (storageErr) {
          console.error(`Failed to update persisted message ${id}:`, storageErr);
        }
      }
    }
  }

  /**
   * Get all pending messages that need to be processed
   * 
   * @returns Array of pending messages with their IDs
   */
  private async getPendingMessages(): Promise<Array<{ id: string, message: PersistedMessage }>> {
    try {
      // First check the in-memory queue
      const pendingFromMemory = Array.from(this.retryQueue.entries())
        .filter(([_, msg]) => msg.status === 'pending')
        .map(([id, message]) => ({ id, message }));
      
      // Then check storage for any we might have missed
      // This is a simplified approach - in a real implementation, you'd use a more efficient query
      const keys = await storageManager.listKeys({ namespace: PERSISTENCE_NAMESPACE, pattern: '*' });
      
      const pendingFromStorage: Array<{ id: string, message: PersistedMessage }> = [];
      
      for (const key of keys) {
        // Skip if already in memory
        if (this.retryQueue.has(key)) {
          continue;
        }
        
        const message = await storageManager.getValue<PersistedMessage>(key, { namespace: PERSISTENCE_NAMESPACE });
        
        if (message && message.status === 'pending') {
          pendingFromStorage.push({ id: key, message });
          // Add to in-memory queue for future processing
          this.retryQueue.set(key, message);
        }
      }
      
      return [...pendingFromMemory, ...pendingFromStorage];
    } catch (err) {
      console.error('Error retrieving pending messages:', err);
      return [];
    }
  }

  /**
   * Acknowledge successful message delivery
   * 
   * @param persistenceId - The ID of the persisted message
   */
  async acknowledgeDelivery(persistenceId: string): Promise<void> {
    await natsClient.publish('a2a.persistence.ack', {
      type: MessageType.HEARTBEAT, // Reusing heartbeat type for simplicity
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: 'message-persistence'
      },
      payload: {
        persistenceId,
        success: true
      }
    });
  }

  /**
   * Report failed message delivery
   * 
   * @param persistenceId - The ID of the persisted message
   * @param error - The error that occurred
   */
  async reportDeliveryFailure(persistenceId: string, error: string): Promise<void> {
    await natsClient.publish('a2a.persistence.ack', {
      type: MessageType.ERROR,
      headers: {
        correlationId: uuidv4(),
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: 'message-persistence'
      },
      payload: {
        persistenceId,
        success: false,
        error
      }
    });
  }

  /**
   * Get statistics about persisted messages
   * 
   * @returns Statistics about message persistence
   */
  async getStatistics(): Promise<{
    total: number;
    pending: number;
    processing: number;
    delivered: number;
    failed: number;
  }> {
    try {
      const keys = await storageManager.listKeys({ namespace: PERSISTENCE_NAMESPACE });
      
      let pending = 0;
      let processing = 0;
      let delivered = 0;
      let failed = 0;
      
      for (const key of keys) {
        const message = await storageManager.getValue<PersistedMessage>(key, { namespace: PERSISTENCE_NAMESPACE });
        
        if (!message) continue;
        
        switch (message.status) {
          case 'pending': pending++; break;
          case 'processing': processing++; break;
          case 'delivered': delivered++; break;
          case 'failed': failed++; break;
        }
      }
      
      return {
        total: keys.length,
        pending,
        processing,
        delivered,
        failed
      };
    } catch (err) {
      console.error('Error retrieving persistence statistics:', err);
      return {
        total: 0,
        pending: 0,
        processing: 0,
        delivered: 0,
        failed: 0
      };
    }
  }
}

export const messagePersistence = new MessagePersistenceManager();
