// src/file-based-queues/queueItemSerializerDeserializer.ts

/**
 * Base interface for items that can be stored in the queue.
 * Ensures items have an ID for potential tracking or specific operations.
 */
export interface IQueueItem {
  id: string; // Unique identifier for the queue item
  // Add other common properties if needed, e.g., timestamp, priority
}

/**
 * Placeholder for QueueItemSerializerDeserializer.
 * Handles the serialization of queue items to a string format (e.g., JSON)
 * and deserialization from the string format back to a queue item object.
 */
export class QueueItemSerializerDeserializer<T extends IQueueItem> {
  constructor() {
    // Initialization, if any, for the serializer/deserializer
    console.log('QueueItemSerializerDeserializer initialized.');
  }

  /**
   * Serializes a queue item into a string.
   * @param item The queue item to serialize.
   * @returns The string representation of the item.
   */
  public serialize(item: T): string {
    try {
      return JSON.stringify(item);
    } catch (error) {
      console.error('Error serializing queue item:', error);
      // Handle or throw error as appropriate for the application
      throw new Error('Failed to serialize queue item.');
    }
  }

  /**
   * Deserializes a string back into a queue item.
   * @param data The string data to deserialize.
   * @returns The deserialized queue item.
   */
  public deserialize(data: string): T {
    try {
      return JSON.parse(data) as T;
    } catch (error) {
      console.error('Error deserializing queue item:', error);
      // Handle or throw error as appropriate for the application
      throw new Error('Failed to deserialize queue item.');
    }
  }
}