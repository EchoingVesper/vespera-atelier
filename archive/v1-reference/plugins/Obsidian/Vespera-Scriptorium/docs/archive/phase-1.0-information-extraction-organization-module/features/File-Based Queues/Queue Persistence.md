# Queue Persistence

**Architectural Role:** Queue Persistence is responsible for ensuring the durability of items within the file-based queues. This involves saving the state of the queues and the items they contain to disk, allowing processing to be paused, interrupted, and resumed without losing data. It acts as the storage layer for the queue system.

**Codebase Comparison Findings:**

The `src/robust-processing/PersistenceManager.ts` file implements functionality related to persisting processing state, which is relevant to Queue Persistence, although it's focused on checkpointing rather than a generic queue.

*   **Implementation:** The `PersistenceManager` class handles saving and loading `ProcessingCheckpoint` objects and partial results for individual chunks. It uses atomic writes to ensure data integrity when writing to files in the Obsidian vault. It manages a working directory for storing these persistence files.
*   **Discrepancies/Required Updates:**
    *   The current implementation in `PersistenceManager` is specifically designed for saving and loading processing checkpoints and partial results related to the `ProcessingOrchestrator`. It does not represent a generic persistence layer for arbitrary file-based queues as described in the architectural decomposition.
    *   There are no explicit "Queue" structures (like a queue file format or directory structure) that `PersistenceManager` interacts with directly for enqueueing or dequeuing items.
    *   The persistence mechanism is tied to the processing state (`ProcessingCheckpoint`) rather than the state of a file-based queue.

**Checklist for Updates:**

*   [x] Design and implement a generic persistence mechanism for file-based queues.
*   [ ] Define the file format and directory structure for storing queue items and queue state on disk.
*   [ ] Ensure the persistence layer can handle atomic writes and reads for queue operations (enqueue, dequeue, peek).
*   [ ] Integrate the persistence mechanism with the planned "Queue Manager", "Queue Reader", and "Queue Writer" components.
*   [ ] Document the file-based queue persistence strategy, file formats, and implementation details.