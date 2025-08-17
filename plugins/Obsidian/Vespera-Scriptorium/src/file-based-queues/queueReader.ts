// src/file-based-queues/queueReader.ts

import { QueuePersistence } from './queuePersistence';
import { IQueueItem, QueueItemSerializerDeserializer } from './queueItemSerializerDeserializer';

/**
 * Responsible for reading and deserializing items from the queue.
 */
export class QueueReader<T extends IQueueItem> {
  private persistence: QueuePersistence;
  private serializerDeserializer: QueueItemSerializerDeserializer<T>;

  constructor(persistence: QueuePersistence, serializerDeserializer?: QueueItemSerializerDeserializer<T>) {
    this.persistence = persistence;
    this.serializerDeserializer = serializerDeserializer || new QueueItemSerializerDeserializer<T>();
    // console.log(`QueueReader initialized for persistence layer at: ${this.persistence.getQueuePath()}`);
  }

  /**
   * Dequeues an item from the queue.
   * Retrieves the raw item, deserializes it, and then removes it from persistence.
   * @returns The deserialized item, or null if the queue is empty.
   */
  public async dequeue(): Promise<T | null> {
    try {
      const rawItemData = await this.persistence.getNextItem();
      if (!rawItemData) {
        return null; // Queue is empty
      }

      const item = this.serializerDeserializer.deserialize(rawItemData.data);
      
      // Attempt to remove the item from persistence, marking as processed
      // If removal fails, the item might be re-processed later, or moved to a failed queue by another mechanism.
      // For critical tasks, a more robust two-phase commit (lease/confirm) might be needed.
      try {
        await this.persistence.removeItem(rawItemData.id, 'processed');
      } catch (removeError) {
        console.error(`QueueReader: Failed to remove item ${rawItemData.id} after dequeue. It might be re-processed. Error:`, removeError);
        // Depending on strategy, might re-throw or handle (e.g., move to a specific "failed_removal" state)
        // For now, we proceed with returning the item, assuming it was successfully read.
      }
      
      return item;
    } catch (error) {
      console.error(`QueueReader: Error during dequeue from ${this.persistence.getQueuePath()}:`, error);
      // Potentially move the problematic raw item to a failed/quarantine area if identifiable
      return null; // Or re-throw, depending on desired error handling for the consumer
    }
  }

  /**
   * Peeks at the next item in the queue without removing it.
   * @returns The deserialized item, or null if the queue is empty.
   */
  public async peek(): Promise<T | null> {
    try {
      const rawItemData = await this.persistence.getNextItem(); // getNextItem should not remove
      if (!rawItemData) {
        return null; // Queue is empty
      }
      return this.serializerDeserializer.deserialize(rawItemData.data);
    } catch (error) {
      console.error(`QueueReader: Error during peek from ${this.persistence.getQueuePath()}:`, error);
      return null;
    }
  }

  /**
   * Checks if the queue is empty.
   * @returns True if the queue is empty, false otherwise.
   */
  public async isEmpty(): Promise<boolean> {
    try {
      const count = await this.persistence.getItemCount();
      return count === 0;
    } catch (error) {
      console.error(`QueueReader: Error checking if queue is empty for ${this.persistence.getQueuePath()}:`, error);
      // Assume not empty or throw, depending on desired behavior on error
      return false; 
    }
  }

  /**
   * Gets the current number of items in the queue.
   * @returns The number of items in the queue.
   */
  public async getCount(): Promise<number> {
    try {
      return await this.persistence.getItemCount();
    } catch (error) {
      console.error(`QueueReader: Error getting item count for ${this.persistence.getQueuePath()}:`, error);
      return 0; // Or throw
    }
  }
}