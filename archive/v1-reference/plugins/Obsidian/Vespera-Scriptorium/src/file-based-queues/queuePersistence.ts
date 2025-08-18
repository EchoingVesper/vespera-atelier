// src/file-based-queues/queuePersistence.ts

// Node.js specific imports. For Obsidian plugins, ensure paths are correctly resolved
// within the plugin's data directory. Obsidian's VaultAdapter API is an alternative for file ops.
import * as fs from 'fs/promises'; // For async file operations
import * as path from 'path';

// Configuration for queue storage
const QUEUE_METADATA_FILE = 'metadata.json';
const QUEUE_ITEMS_DIR = 'items';
const PROCESSED_ITEMS_DIR = 'processed'; // Optional: for archiving processed items
const FAILED_ITEMS_DIR = 'failed'; // Optional: for items that failed processing

interface QueueMetadata {
  queueName: string;
  createdAt: string;
  itemCount: number;
  // Potentially add head/tail pointers if not inferring from file listing
  // lastProcessedId?: string; 
}

/**
 * Manages the physical storage of queue items and their metadata.
 * This implementation aims for a directory-per-queue structure,
 * with each item as a separate file for simplicity in listing/deletion.
 * More advanced strategies (e.g., append-only log file) can be considered for performance.
 */
export class QueuePersistence {
  private queueBasePath: string; // e.g., .obsidian/plugins/your-plugin/queues/myQueueName
  private itemsPath: string;
  private processedPath: string;
  private failedPath: string;
  private metadataFilePath: string;

  constructor(queueBasePath: string) {
    this.queueBasePath = queueBasePath;
    this.itemsPath = path.join(this.queueBasePath, QUEUE_ITEMS_DIR);
    this.processedPath = path.join(this.queueBasePath, PROCESSED_ITEMS_DIR);
    this.failedPath = path.join(this.queueBasePath, FAILED_ITEMS_DIR);
    this.metadataFilePath = path.join(this.queueBasePath, QUEUE_METADATA_FILE);

    // Initialization logic will be called by an async factory or init method
    // console.log(`QueuePersistence initialized for base path: ${this.queueBasePath}`);
  }

  /**
   * Asynchronously initializes the persistence layer.
   * Creates necessary directories and metadata file if they don't exist.
   */
  public async initialize(): Promise<void> {
    try {
      await fs.mkdir(this.queueBasePath, { recursive: true });
      await fs.mkdir(this.itemsPath, { recursive: true });
      await fs.mkdir(this.processedPath, { recursive: true });
      await fs.mkdir(this.failedPath, { recursive: true });

      try {
        await fs.access(this.metadataFilePath);
        // Metadata file exists, load it (or validate it)
        // For now, just log. Actual loading would be more complex.
        console.log(`Metadata file found at ${this.metadataFilePath}`);
      } catch {
        // Metadata file does not exist, create it
        const initialMetadata: QueueMetadata = {
          queueName: path.basename(this.queueBasePath),
          createdAt: new Date().toISOString(),
          itemCount: 0,
        };
        await fs.writeFile(this.metadataFilePath, JSON.stringify(initialMetadata, null, 2));
        console.log(`Metadata file created at ${this.metadataFilePath}`);
      }
    } catch (error) {
      console.error(`Error initializing queue persistence at ${this.queueBasePath}:`, error);
      throw new Error(`Failed to initialize queue at ${this.queueBasePath}`);
    }
  }
  
  private async readMetadata(): Promise<QueueMetadata> {
    try {
      const data = await fs.readFile(this.metadataFilePath, 'utf-8');
      return JSON.parse(data) as QueueMetadata;
    } catch (error) {
      console.error(`Error reading metadata file ${this.metadataFilePath}:`, error);
      // May need to re-initialize or handle corruption
      throw new Error('Failed to read queue metadata.');
    }
  }

  private async writeMetadata(metadata: QueueMetadata): Promise<void> {
    try {
      await fs.writeFile(this.metadataFilePath, JSON.stringify(metadata, null, 2));
    } catch (error) {
      console.error(`Error writing metadata file ${this.metadataFilePath}:`, error);
      throw new Error('Failed to write queue metadata.');
    }
  }

  public getQueuePath(): string {
    return this.queueBasePath;
  }

  /**
   * Saves a serialized item to the queue.
   * @param itemId The ID of the item (used as filename).
   * @param serializedItem The string representation of the item.
   */
  public async saveItem(itemId: string, serializedItem: string): Promise<void> {
    const finalItemPath = path.join(this.itemsPath, `${itemId}.json`); // Assuming JSON for items
    const tempItemPath = path.join(this.itemsPath, `${itemId}.${Date.now()}.tmp`);

    try {
      // Atomic write: write to temp file first, then rename
      await fs.writeFile(tempItemPath, serializedItem);
      await fs.rename(tempItemPath, finalItemPath);

      const metadata = await this.readMetadata();
      metadata.itemCount++;
      await this.writeMetadata(metadata);
      console.log(`Persistence: Item ${itemId} saved to ${finalItemPath}`);
    } catch (error) {
      console.error(`Error saving item ${itemId} to ${finalItemPath}:`, error);
      // Clean up temp file if rename failed or initial write failed
      try {
        await fs.access(tempItemPath); // Check if temp file exists
        await fs.unlink(tempItemPath); // Attempt to delete it
        console.log(`Persistence: Cleaned up temporary file ${tempItemPath}`);
      } catch (cleanupError) {
        // Log cleanup error but don't overshadow the original error
        console.error(`Error cleaning up temporary file ${tempItemPath}:`, cleanupError);
      }
      throw new Error(`Failed to save item ${itemId}.`);
    }
  }

  /**
   * Retrieves the next available item's raw data.
   * This basic version just picks the first file alphabetically.
   * A more robust version would use timestamps or a dedicated index.
   * @returns The raw string data of the item and its ID, or null if queue is empty.
   */
  public async getNextItem(): Promise<{ id: string; data: string } | null> {
    try {
      const files = await fs.readdir(this.itemsPath);
      if (files.length === 0) {
        return null;
      }
      files.sort(); // Simple FIFO based on filename (e.g., timestamp-based or counter)
      const nextItemId = files[0].replace('.json', ''); // Assuming .json extension
      const itemPath = path.join(this.itemsPath, files[0]);
      const data = await fs.readFile(itemPath, 'utf-8');
      return { id: nextItemId, data };
    } catch (error) {
      console.error(`Error getting next item from ${this.itemsPath}:`, error);
      return null; // Or throw, depending on desired error handling
    }
  }

  /**
   * Removes an item from the queue, typically after it's been processed.
   * Optionally moves it to a 'processed' or 'failed' directory.
   * @param itemId The ID of the item to remove.
   * @param status 'processed' or 'failed', or undefined to just delete.
   */
  public async removeItem(itemId: string, status?: 'processed' | 'failed'): Promise<void> {
    const itemPath = path.join(this.itemsPath, `${itemId}.json`);
    try {
      if (status === 'processed') {
        const destPath = path.join(this.processedPath, `${itemId}.json`);
        await fs.rename(itemPath, destPath); // Move to processed
        console.log(`Persistence: Item ${itemId} moved to processed.`);
      } else if (status === 'failed') {
        const destPath = path.join(this.failedPath, `${itemId}.json`);
        await fs.rename(itemPath, destPath); // Move to failed
        console.log(`Persistence: Item ${itemId} moved to failed.`);
      } else {
        await fs.unlink(itemPath); // Delete
        console.log(`Persistence: Item ${itemId} deleted.`);
      }
      const metadata = await this.readMetadata();
      metadata.itemCount = Math.max(0, metadata.itemCount - 1); // Ensure not negative
      await this.writeMetadata(metadata);
    } catch (error) {
      // If file not found, it might have been processed by another instance or already removed.
      if (error instanceof Error && 'code' in error && (error as { code?: string }).code === 'ENOENT') {
        console.warn(`Persistence: Item ${itemId} not found for removal. It might have been processed already.`);
        // Adjust item count if we are sure it was ours and is now gone.
        // This part is tricky without a proper distributed lock or transactional system.
        // For now, we assume if it's gone, the count was decremented by whoever took it.
        return;
      }
      console.error(`Error removing item ${itemId} from ${itemPath}:`, error);
      throw new Error(`Failed to remove item ${itemId}.`);
    }
  }
  
  /**
   * Gets the current number of items in the queue.
   * @returns The number of items.
   */
  public async getItemCount(): Promise<number> {
    try {
      const metadata = await this.readMetadata();
      return metadata.itemCount;
    } catch (error) {
      // Fallback if metadata is corrupt, count files (less accurate)
      console.warn('Metadata read failed for getItemCount, falling back to file count.');
      try {
        const files = await fs.readdir(this.itemsPath);
        return files.length;
      } catch (fsError) {
        console.error(`Error counting files in ${this.itemsPath}:`, fsError);
        return 0;
      }
    }
  }


  public async clear(): Promise<void> {
    console.log(`Persistence: Clearing queue at ${this.queueBasePath}`);
    try {
      const files = await fs.readdir(this.itemsPath);
      for (const file of files) {
        await fs.unlink(path.join(this.itemsPath, file));
      }
      // Optionally clear processed and failed directories too
      // await fs.rm(this.processedPath, { recursive: true, force: true });
      // await fs.mkdir(this.processedPath, { recursive: true });
      // await fs.rm(this.failedPath, { recursive: true, force: true });
      // await fs.mkdir(this.failedPath, { recursive: true });

      const metadata = await this.readMetadata();
      metadata.itemCount = 0;
      await this.writeMetadata(metadata);
      console.log(`Persistence: Queue ${this.queueBasePath} cleared. All items removed.`);
    } catch (error) {
      console.error(`Error clearing queue ${this.queueBasePath}:`, error);
      throw new Error(`Failed to clear queue ${this.queueBasePath}.`);
    }
  }

  public async deleteQueue(): Promise<void> {
    console.log(`Persistence: Deleting queue at ${this.queueBasePath}`);
    try {
      await fs.rm(this.queueBasePath, { recursive: true, force: true });
      console.log(`Persistence: Queue directory ${this.queueBasePath} deleted.`);
    } catch (error) {
      console.error(`Error deleting queue directory ${this.queueBasePath}:`, error);
      throw new Error(`Failed to delete queue ${this.queueBasePath}.`);
    }
  }
}