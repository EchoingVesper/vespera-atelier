// src/file-based-queues/queueManager.ts

import * as path from 'path';
import { QueuePersistence } from './queuePersistence.js';
import { QueueReader } from './queueReader.js';
import { QueueWriter } from './queueWriter.js';
import { IQueueItem, QueueItemSerializerDeserializer } from './queueItemSerializerDeserializer.js';

interface Queue<T extends IQueueItem> {
  name: string;
  persistence: QueuePersistence;
  reader: QueueReader<T>;
  writer: QueueWriter<T>;
  serializer: QueueItemSerializerDeserializer<T>;
  // Add other queue-specific configurations or state
}

/**
 * Manages the overall administration and coordination of file-based queues.
 */
export class QueueManager {
  private queues: Map<string, Queue<IQueueItem>> = new Map();
  private baseQueuePath: string;

  /**
   * Initializes the QueueManager.
   * @param baseQueuePath The base directory path where all queues will be stored.
   */
  constructor(baseQueuePath: string) {
    this.baseQueuePath = baseQueuePath;
    // Potentially load existing queue configurations from persistence
  }

  /**
   * Creates a new queue or retrieves an existing one.
   * @param queueName The name of the queue.
   * @param options Optional configuration for the queue.
   * @returns The managed queue instance.
   */
  public async getOrCreateQueue<T extends IQueueItem>(
    queueName: string,
    // options?: Partial<QueueOptions> // Define QueueOptions interface later
  ): Promise<Queue<T>> {
    if (this.queues.has(queueName)) {
      return this.queues.get(queueName) as Queue<T>;
    }

    const queuePath = path.join(this.baseQueuePath, queueName);
    
    const persistence = new QueuePersistence(queuePath);
    await persistence.initialize(); // Ensure queue directory and metadata are ready

    const serializer = new QueueItemSerializerDeserializer<T>();
    const reader = new QueueReader<T>(persistence, serializer);
    const writer = new QueueWriter<T>(persistence, serializer);

    const newQueue: Queue<T> = {
      name: queueName,
      persistence,
      reader,
      writer,
      serializer,
    };

    this.queues.set(queueName, newQueue);
    console.log(`Queue "${queueName}" created/retrieved at path: ${queuePath}`);
    return newQueue;
  }

  /**
   * Lists all managed queues.
   * @returns An array of queue names.
   */
  public listQueues(): string[] {
    return Array.from(this.queues.keys());
  }

  /**
   * Gets the status of a specific queue.
   * @param queueName The name of the queue.
   * @returns Queue status information (e.g., size, number of items).
   */
  public async getQueueStatus(queueName: string): Promise<Record<string, unknown> | undefined> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      console.warn(`Queue "${queueName}" not found.`);
      return undefined;
    }
    
    const itemCount = await queue.persistence.getItemCount();
    
    return {
      name: queue.name,
      path: queue.persistence.getQueuePath(),
      itemCount: itemCount,
      // Potentially add more status details, e.g., last accessed, error count
    };
  }

  /**
   * Clears all items from a specific queue.
   * @param queueName The name of the queue.
   */
  public async clearQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      console.warn(`Queue "${queueName}" not found. Cannot clear.`);
      return;
    }
    await queue.persistence.clear(); // Assuming clear method in QueuePersistence
    console.log(`Queue "${queueName}" cleared.`);
  }

  /**
   * Deletes a queue entirely.
   * @param queueName The name of the queue.
   */
  public async deleteQueue(queueName: string): Promise<void> {
    const queue = this.queues.get(queueName);
    if (!queue) {
      console.warn(`Queue "${queueName}" not found. Cannot delete.`);
      return;
    }
    await queue.persistence.deleteQueue(); // Assuming deleteQueue method in QueuePersistence
    this.queues.delete(queueName);
    console.log(`Queue "${queueName}" deleted.`);
  }

  // Further methods for monitoring, coordination, etc. can be added here.
}

// Example Usage (for testing purposes, will be removed/refactored)
// async function main() {
//   // This requires 'fs' and 'path' which are Node.js modules. 
//   // For browser/Obsidian environment, different file system access will be needed.
//   // For now, we'll assume a base path.
//   const manager = new QueueManager('./.obsidian/queues'); 

//   const myTaskQueue = manager.getOrCreateQueue<{ id: string; data: string }>('myTasks');
//   console.log('Managed Queues:', manager.listQueues());
//   console.log('Status of myTasks:', manager.getQueueStatus('myTasks'));

//   // await myTaskQueue.writer.enqueue({ id: '1', data: 'Task 1 details' });
//   // const item = await myTaskQueue.reader.dequeue();
//   // console.log('Dequeued item:', item);

//   // await manager.clearQueue('myTasks');
//   // await manager.deleteQueue('myTasks');
//   // console.log('Managed Queues after deletion:', manager.listQueues());
// }

// main().catch(console.error);