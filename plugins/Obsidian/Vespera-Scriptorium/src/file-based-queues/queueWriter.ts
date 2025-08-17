// src/file-based-queues/queueWriter.ts

import { QueuePersistence } from './queuePersistence';
import { IQueueItem, QueueItemSerializerDeserializer } from './queueItemSerializerDeserializer';
import { v4 as uuidv4 } from 'uuid'; // For generating unique item IDs

/**
 * Responsible for serializing and writing items to the queue.
 */
export class QueueWriter<T extends IQueueItem> {
  private persistence: QueuePersistence;
  private serializerDeserializer: QueueItemSerializerDeserializer<T>;

  constructor(persistence: QueuePersistence, serializerDeserializer?: QueueItemSerializerDeserializer<T>) {
    this.persistence = persistence;
    this.serializerDeserializer = serializerDeserializer || new QueueItemSerializerDeserializer<T>();
    // console.log(`QueueWriter initialized for persistence layer at: ${this.persistence.getQueuePath()}`);
  }

  /**
   * Enqueues an item into the queue.
   * The item ID will be automatically generated if not provided.
   * @param item The item to enqueue. If it lacks an 'id', one will be generated.
   * @returns The ID of the enqueued item.
   */
  public async enqueue(item: Omit<T, 'id'> & Partial<Pick<T, 'id'>>): Promise<string> {
    const itemId = item.id || uuidv4();
    const fullItem = { ...item, id: itemId } as T;

    try {
      const serializedItem = this.serializerDeserializer.serialize(fullItem);
      await this.persistence.saveItem(itemId, serializedItem);
      // console.log(`Writer: Enqueued item ${itemId} to ${this.persistence.getQueuePath()}`);
      return itemId;
    } catch (error) {
      console.error(`QueueWriter: Error during enqueue to ${this.persistence.getQueuePath()}:`, error);
      // Depending on strategy, might throw a specific error or return failure indicator
      const message = error instanceof Error ? error.message : String(error);
      throw new Error(`Failed to enqueue item ${itemId}: ${message}`);
    }
  }

  /**
   * Enqueues multiple items into the queue.
   * @param items An array of items to enqueue.
   * @returns An array of IDs of the enqueued items.
   */
  public async enqueueBatch(items: (Omit<T, 'id'> & Partial<Pick<T, 'id'>>)[]): Promise<string[]> {
    const itemIds: string[] = [];
    // For now, enqueuing one by one. Batch operations could be optimized at persistence layer.
    for (const item of items) {
      try {
        const itemId = await this.enqueue(item);
        itemIds.push(itemId);
      } catch (error) {
        console.error(`QueueWriter: Error enqueuing item in batch:`, item, error);
        // Decide on batch error strategy: stop all, collect errors, or skip failed
        // For now, we'll log and continue, returning IDs of successfully enqueued items.
      }
    }
    return itemIds;
  }
}