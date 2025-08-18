// src/workflow-orchestrator/StateManager.ts
import { WorkflowState, WorkflowDefinition } from './types'; // Using WorkflowState from types.ts
import { v4 as uuidv4 } from 'uuid';
import { DataAdapter } from 'obsidian'; // For file system operations

// Custom Error Classes
export class StateNotFoundError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'StateNotFoundError';
  }
}

export class StatePersistenceError extends Error {
  constructor(message: string, public originalError?: any) {
    super(message);
    this.name = 'StatePersistenceError';
  }
}

export interface IStateManager {
  /**
   * Creates a new workflow state instance.
   * @param workflowDefinitionId The ID of the workflow definition.
   * @param initialData Optional initial data for the workflow context.
   * @returns A Promise that resolves to the newly created WorkflowState.
   */
  createWorkflowInstance(workflowDefinitionId: string, initialData?: Record<string, any>): Promise<WorkflowState>; // Renamed

  /**
   * Retrieves the state of a specific workflow instance.
   * @param instanceId The ID of the workflow instance.
   * @returns A Promise that resolves to the WorkflowState or undefined if not found.
   */
  getWorkflowState(instanceId: string): Promise<WorkflowState | undefined>;

  /**
   * Saves or updates the entire state of a workflow instance.
   * @param state The WorkflowState object to save.
   * @returns A Promise that resolves when the state is saved.
   */
  saveWorkflowState(state: WorkflowState): Promise<void>;

  /**
   * Partially updates the state of a workflow instance.
   * @param instanceId The ID of the workflow instance to update.
   * @param updates An object containing the properties of WorkflowState to update.
   * @returns A Promise that resolves to the updated WorkflowState.
   * @throws {StateNotFoundError} If the workflow instance state is not found.
   */
  updateWorkflowState(instanceId: string, updates: Partial<WorkflowState>): Promise<WorkflowState>;

  /**
   * Deletes the state of a specific workflow instance.
   * @param instanceId The ID of the workflow instance to delete.
   * @returns A Promise that resolves when the state is deleted.
   */
  deleteWorkflowInstance(instanceId: string): Promise<void>; // Renamed

  /**
   * Adds a new entry to the history of a workflow instance.
   * @param instanceId The ID of the workflow instance.
   * @param historyEntry The history entry to add.
   * @returns A Promise that resolves to the updated WorkflowState.
   * @throws {StateNotFoundError} If the workflow instance state is not found.
   */
  addHistoryEntry(instanceId: string, historyEntry: WorkflowState['history'][0]): Promise<WorkflowState>;
}

export class StateManager implements IStateManager {
  private adapter: DataAdapter;
  private basePath: string; // e.g., '.obsidian/plugins/your-plugin-id/workflow-states'

  constructor(adapter: DataAdapter, basePath: string) {
    this.adapter = adapter;
    this.basePath = basePath;
    this.ensureBasePathExists();
  }

  private async ensureBasePathExists(): Promise<void> {
    try {
      // Check if directory exists, create if not.
      // Obsidian's DataAdapter doesn't have a direct 'exists' or 'mkdir' for directories in a cross-platform way for plugins.
      // This often needs to be handled by trying to write a dummy file or checking for a known file.
      // For simplicity, we'll assume the path needs to be manually created or exists.
      // A more robust solution might involve checking for a marker file or attempting a read/write.
      console.log(`StateManager: Base path for workflow states: ${this.basePath}`);
      // Example: await this.adapter.write(`${this.basePath}/.initialized`, "");
      // This is a simplification. Real directory creation might need more robust handling
      // or rely on plugin's onEnable to set up directories.
    } catch (error) {
      console.error(`StateManager: Error ensuring base path ${this.basePath} exists. Please ensure the directory is created.`, error);
      // Depending on requirements, might throw an error or log.
    }
  }

  private getFilePath(instanceId: string): string {
    return `${this.basePath}/${instanceId}.json`;
  }

  // Renamed from createWorkflowState
  public async createWorkflowInstance(workflowDefinitionId: string, initialData: Record<string, any> = {}): Promise<WorkflowState> {
    const instanceId = uuidv4();
    const now = new Date();
    const newState: WorkflowState = {
      instanceId,
      workflowDefinitionId,
      status: 'pending', // Initial status
      currentStageId: undefined, // Will be set when execution starts
      data: initialData, // Changed from context to data
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    await this.saveWorkflowState(newState);
    console.log(`StateManager: Created new workflow instance ${instanceId}`);
    return newState;
  }

  public async getWorkflowState(instanceId: string): Promise<WorkflowState | undefined> {
    const filePath = this.getFilePath(instanceId);
    console.log(`StateManager: Getting state for workflow instance ${instanceId} from ${filePath}`);
    try {
      const fileExists = await this.adapter.exists(filePath);
      if (!fileExists) {
        console.warn(`StateManager: State file not found for instance ${instanceId} at ${filePath}`);
        return undefined;
      }
      const fileContent = await this.adapter.read(filePath);
      const state = JSON.parse(fileContent) as WorkflowState;
      // Convert date strings back to Date objects
      state.createdAt = new Date(state.createdAt);
      state.updatedAt = new Date(state.updatedAt);
      state.history.forEach(h => {
        h.startedAt = new Date(h.startedAt);
        if (h.completedAt) {
          h.completedAt = new Date(h.completedAt);
        }
      });
      return state;
    } catch (error: any) {
      throw new StatePersistenceError(`Failed to read state for instance ${instanceId} from ${filePath}: ${error.message}`, error);
    }
  }

  public async saveWorkflowState(state: WorkflowState): Promise<void> {
    const filePath = this.getFilePath(state.instanceId);
    state.updatedAt = new Date(); // Update timestamp before saving
    console.log(`StateManager: Saving state for workflow instance ${state.instanceId} to ${filePath}`, state);
    try {
      // Ensure base path exists before writing.
      // This is a simplified check. A more robust solution would be to ensure the directory exists.
      const dirPath = this.basePath;
      if (!(await this.adapter.exists(dirPath))) {
        // Attempt to create directory - Obsidian API for plugins might not directly support this.
        // Plugins usually create their data folder structure on load.
        // For now, we'll log a warning if the base path doesn't exist.
        // A real implementation would need a more robust way to handle this,
        // possibly by calling a method on the plugin instance to ensure its data directory is set up.
        console.warn(`StateManager: Base directory ${dirPath} does not exist. Attempting to write file anyway.`);
        // await this.adapter.mkdir(dirPath); // This method doesn't exist on DataAdapter
      }

      await this.adapter.write(filePath, JSON.stringify(state, null, 2));
    } catch (error: any) {
      throw new StatePersistenceError(`Failed to save state for instance ${state.instanceId} to ${filePath}: ${error.message}`, error);
    }
  }

  public async updateWorkflowState(instanceId: string, updates: Partial<WorkflowState>): Promise<WorkflowState> {
    console.log(`StateManager: Updating state for workflow instance ${instanceId} with updates:`, updates);
    const currentState = await this.getWorkflowState(instanceId);
    if (!currentState) {
      throw new StateNotFoundError(`State for workflow instance ${instanceId} not found. Cannot update.`);
    }
    // Prevent instanceId and createdAt from being updated
    const { instanceId: _instanceId, createdAt: _createdAt, ...restOfUpdates } = updates;
    const newState: WorkflowState = { 
      ...currentState, 
      ...restOfUpdates,
      updatedAt: new Date() // Always update the timestamp
    };
    await this.saveWorkflowState(newState);
    return newState;
  }

  // Renamed from deleteWorkflowState
  public async deleteWorkflowInstance(instanceId: string): Promise<void> {
    const filePath = this.getFilePath(instanceId);
    console.log(`StateManager: Deleting state for workflow instance ${instanceId} from ${filePath}`);
    try {
      const fileExists = await this.adapter.exists(filePath);
      if (fileExists) {
        await this.adapter.remove(filePath);
      } else {
        console.warn(`StateManager: State file not found for instance ${instanceId} at ${filePath}. Nothing to delete.`);
      }
    } catch (error: any) {
      throw new StatePersistenceError(`Failed to delete state for instance ${instanceId} from ${filePath}: ${error.message}`, error);
    }
  }

  public async addHistoryEntry(instanceId: string, historyEntry: WorkflowState['history'][0]): Promise<WorkflowState> {
    console.log(`StateManager: Adding history entry to workflow instance ${instanceId}:`, historyEntry);
    const currentState = await this.getWorkflowState(instanceId);
    if (!currentState) {
      // As per test "should not throw when adding history to a non-existent instance (logs warning)"
      // However, throwing an error might be more robust in a real scenario unless specifically designed to fail silently.
      // For now, let's match the test's implied behavior by logging and not throwing for this specific case.
      // The test actually expects updateWorkflowState to be called, which would throw if state not found.
      // Let's make it throw for consistency with updateWorkflowState.
      console.warn(`StateManager: Attempted to add history to non-existent workflow instance ${instanceId}. This will throw.`);
      throw new StateNotFoundError(`State for workflow instance ${instanceId} not found. Cannot add history.`);
    }
    
    const newHistory = [...currentState.history, historyEntry];
    const newState: WorkflowState = {
      ...currentState,
      history: newHistory,
      updatedAt: new Date(),
    };
    
    await this.saveWorkflowState(newState);
    return newState;
  }
}