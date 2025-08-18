// src/workflow-orchestrator/WorkflowExecutionEngine.ts

import {
  WorkflowDefinition,
  WorkflowState,
  WorkflowStage,
  NodeExecutionResult,
  WorkflowExecutionError,
} from './types';
import { IWorkflowDefinitionLoader } from './WorkflowDefinitionLoader';
import { IStateManager } from './StateManager';
import { INodeExecutor } from './NodeExecutor';

export interface IWorkflowExecutionEngine {
  startWorkflow(
    definition: WorkflowDefinition,
    initialData: Record<string, any>
  ): Promise<WorkflowState>;
  pauseWorkflow(instanceId: string): Promise<void>;
  resumeWorkflow(instanceId: string): Promise<void>;
  getWorkflowStatus(instanceId: string): Promise<WorkflowState['status'] | undefined>;
  runWorkflowInstance(instanceId: string, workflowDefinition?: WorkflowDefinition): Promise<WorkflowState>;
}

export class WorkflowExecutionEngine implements IWorkflowExecutionEngine {
  private readonly workflowDefinitionLoader: IWorkflowDefinitionLoader;
  private readonly stateManager: IStateManager;
  private readonly nodeExecutor: INodeExecutor;

  constructor(
    workflowDefinitionLoader: IWorkflowDefinitionLoader,
    stateManager: IStateManager,
    nodeExecutor: INodeExecutor
  ) {
    this.workflowDefinitionLoader = workflowDefinitionLoader;
    this.stateManager = stateManager;
    this.nodeExecutor = nodeExecutor;
  }

  public async startWorkflow(
    definition: WorkflowDefinition,
    initialData: Record<string, any>
  ): Promise<WorkflowState> {
    console.log(
      `WorkflowExecutionEngine: Starting workflow ${definition.id} (${definition.name}) with data:`,
      initialData
    );
    try {
      const newState = await this.stateManager.createWorkflowState(
        definition.id,
        { initialContext: { ...initialData }, stagesOutput: {} } // Initialize context structure
      );

      if (definition.stages.length > 0) {
        newState.currentStageId = definition.stages[0].id;
      } else {
        newState.status = 'completed';
        console.warn(`WorkflowExecutionEngine: Workflow ${definition.id} has no stages. Marking as ${newState.status}.`);
      }
      await this.stateManager.saveWorkflowState(newState);

      console.log(
        `WorkflowExecutionEngine: Created workflow instance ${newState.instanceId}`
      );
      if (newState.status === 'completed' || newState.status === 'failed') {
        return newState;
      }
      return this.runWorkflowInstance(newState.instanceId, definition);
    } catch (error) {
      console.error('WorkflowExecutionEngine: Error starting workflow', error);
      throw new WorkflowExecutionError(
        `Failed to start workflow ${definition.id}: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }

  public async runWorkflowInstance(
    instanceId: string,
    workflowDefinition?: WorkflowDefinition
  ): Promise<WorkflowState> {
    let currentWorkflowState: WorkflowState;
    let loadedDefinition: WorkflowDefinition | undefined = workflowDefinition;

    try {
      const retrievedState = await this.stateManager.getWorkflowState(instanceId);
      if (!retrievedState) {
        throw new WorkflowExecutionError(
          `Workflow instance ${instanceId} not found.`
        );
      }
      currentWorkflowState = retrievedState;

      if (!loadedDefinition) {
        console.warn(
          `WorkflowExecutionEngine: WorkflowDefinition not passed to runWorkflowInstance for ${instanceId}. Attempting to load.`
        );
        if (currentWorkflowState.workflowDefinitionId) {
             throw new WorkflowExecutionError(`Dynamic workflow definition loading by ID (${currentWorkflowState.workflowDefinitionId}) in runWorkflowInstance is not fully implemented if not pre-passed. Pass the definition to startWorkflow or runWorkflowInstance.`);
        }
        if (!loadedDefinition) {
            throw new WorkflowExecutionError(`Could not obtain workflow definition for instance ${instanceId}`);
        }
      }

      if (currentWorkflowState.status === 'completed' || currentWorkflowState.status === 'failed') {
        console.log(`WorkflowExecutionEngine: Workflow instance ${instanceId} is already in a terminal state: ${currentWorkflowState.status}`);
        return currentWorkflowState;
      }
      
      if (currentWorkflowState.status !== 'running') {
        currentWorkflowState.status = 'running';
        currentWorkflowState.updatedAt = new Date();
        await this.stateManager.saveWorkflowState(currentWorkflowState);
      }

      let currentStageIndex = -1;
      if (currentWorkflowState.currentStageId) {
        currentStageIndex = loadedDefinition.stages.findIndex(s => s.id === currentWorkflowState.currentStageId);
      } else if (loadedDefinition.stages.length > 0) {
        currentStageIndex = 0;
        currentWorkflowState.currentStageId = loadedDefinition.stages[0].id;
      }

      while (
        currentWorkflowState.status === 'running' &&
        currentWorkflowState.currentStageId &&
        currentStageIndex >= 0 && 
        currentStageIndex < loadedDefinition.stages.length
      ) {
        const stageId = currentWorkflowState.currentStageId;
        const currentStage: WorkflowStage | undefined = loadedDefinition.stages[currentStageIndex];

        if (!currentStage || currentStage.id !== stageId) {
          currentWorkflowState.status = 'failed';
          currentWorkflowState.error = `Stage mismatch or not found: expected ${stageId}, but current index ${currentStageIndex} points to a different/invalid stage in workflow definition ${loadedDefinition.id}.`;
          await this.stateManager.saveWorkflowState(currentWorkflowState);
          throw new WorkflowExecutionError(currentWorkflowState.error, instanceId, stageId);
        }

        console.log(
          `WorkflowExecutionEngine: Executing stage ${stageId} (${currentStage.name || 'Unnamed Stage'}) for instance ${instanceId}`
        );
        
        let currentHistoryEntry = currentWorkflowState.history.find(h => h.stageId === stageId && h.status === 'running');
        if (!currentHistoryEntry) {
            currentHistoryEntry = {
                stageId: stageId,
                status: 'running',
                startedAt: new Date(),
            };
            currentWorkflowState.history.push(currentHistoryEntry);
        } else {
            currentHistoryEntry.startedAt = new Date();
            currentHistoryEntry.completedAt = undefined;
            currentHistoryEntry.error = undefined;
        }
        
        currentWorkflowState.updatedAt = new Date();
        await this.stateManager.updateWorkflowState(instanceId, { 
            history: currentWorkflowState.history, 
            updatedAt: currentWorkflowState.updatedAt, 
            status: 'running', 
            currentStageId: currentWorkflowState.currentStageId 
        });

        try {
          // NodeExecutor is responsible for resolving inputs/params based on its own logic using stage definition and full workflow context
          const executionResult: NodeExecutionResult =
            await this.nodeExecutor.executeNode( // This is the corrected call
              currentStage,
              currentWorkflowState 
            );

          currentHistoryEntry.outputs = executionResult.data || {}; // Store raw output
          
          // Map raw outputs to workflow context.stagesOutput according to stage.outputs definition
          if (executionResult.success && executionResult.data && currentStage.outputs) {
            if (!currentWorkflowState.context.stagesOutput) {
                currentWorkflowState.context.stagesOutput = {};
            }
            if (!currentWorkflowState.context.stagesOutput[stageId]) {
                currentWorkflowState.context.stagesOutput[stageId] = {};
            }
            for (const outKey in currentStage.outputs) {
                const sourcePath: string = currentStage.outputs[outKey];
                if (typeof sourcePath === 'string' && sourcePath.startsWith('$.')) {
                    const propName: string = sourcePath.substring('$.'.length);
                    // Ensure executionResult.data is not null or undefined before accessing propName
                    if (executionResult.data && typeof executionResult.data === 'object' && propName in executionResult.data) {
                         currentWorkflowState.context.stagesOutput[stageId][outKey] = executionResult.data[propName];
                    } else {
                        console.warn(`Output mapping warning: Property '${propName}' not found in execution data for stage '${stageId}', output key '${outKey}'.`);
                        currentWorkflowState.context.stagesOutput[stageId][outKey] = undefined;
                    }
                } else {
                     console.warn(`Invalid output mapping source path for ${outKey} in stage ${stageId}: ${sourcePath}. Must be a JSONPath string like '$.propertyName'.`);
                }
            }
          }

          if (!executionResult.success) {
            currentWorkflowState.status = 'failed';
            currentWorkflowState.error = executionResult.error || `Stage ${stageId} failed.`;
            currentHistoryEntry.status = 'failure';
            currentHistoryEntry.error = currentWorkflowState.error;
            console.error(
              `WorkflowExecutionEngine: Stage ${stageId} failed for instance ${instanceId}: ${currentWorkflowState.error}`
            );
            break; 
          }

          currentHistoryEntry.status = 'success';
          
          currentStageIndex++;
          if (currentStageIndex < loadedDefinition.stages.length) {
            currentWorkflowState.currentStageId = loadedDefinition.stages[currentStageIndex].id;
          } else {
            currentWorkflowState.status = 'completed';
            currentWorkflowState.currentStageId = undefined; 
            console.log(
              `WorkflowExecutionEngine: Workflow instance ${instanceId} completed.`
            );
          }

        } catch (stageError) {
          const errorMessage = stageError instanceof Error ? stageError.message : String(stageError);
          console.error(
            `WorkflowExecutionEngine: Error executing stage ${stageId} for instance ${instanceId}`,
            stageError
          );
          currentWorkflowState.status = 'failed';
          currentWorkflowState.error = `Error during stage ${stageId} execution: ${errorMessage}`;
          currentHistoryEntry.status = 'failure';
          currentHistoryEntry.error = currentWorkflowState.error;
          break; 
        } finally {
            currentHistoryEntry.completedAt = new Date();
            currentWorkflowState.updatedAt = new Date();
            await this.stateManager.updateWorkflowState(instanceId, { 
                status: currentWorkflowState.status, 
                currentStageId: currentWorkflowState.currentStageId,
                context: currentWorkflowState.context, 
                history: currentWorkflowState.history, 
                error: currentWorkflowState.error,
                updatedAt: currentWorkflowState.updatedAt 
            });
        }
      }
      return currentWorkflowState;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `WorkflowExecutionEngine: Critical error in runWorkflowInstance for ${instanceId}`,
        error
      );
      try {
        const stateToFail = await this.stateManager.getWorkflowState(instanceId);
        if (stateToFail) {
          stateToFail.status = 'failed';
          stateToFail.error = `Critical engine error: ${errorMessage}`;
          stateToFail.updatedAt = new Date();
          await this.stateManager.saveWorkflowState(stateToFail);
          return stateToFail;
        }
      } catch (stateSaveError) {
        console.error(
          `WorkflowExecutionEngine: Failed to save error state for instance ${instanceId}`,
          stateSaveError
        );
      }
      throw new WorkflowExecutionError(
        `Critical error processing workflow instance ${instanceId}: ${errorMessage}`,
        instanceId
      );
    }
  }

  public async pauseWorkflow(instanceId: string): Promise<void> {
    console.log(`WorkflowExecutionEngine: Pausing workflow instance ${instanceId}`);
    try {
      const workflowState = await this.stateManager.getWorkflowState(instanceId);
      if (!workflowState) {
        throw new WorkflowExecutionError(
          `Workflow instance ${instanceId} not found for pausing.`
        );
      }
      if (workflowState.status === 'running') {
        workflowState.status = 'paused';
        workflowState.updatedAt = new Date();
        await this.stateManager.saveWorkflowState(workflowState);
        console.log(
          `WorkflowExecutionEngine: Workflow instance ${instanceId} paused.`
        );
      } else {
        console.warn(
          `WorkflowExecutionEngine: Workflow instance ${instanceId} cannot be paused. Status: ${workflowState.status}`
        );
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error(
        `WorkflowExecutionEngine: Error pausing workflow instance ${instanceId}`,
        error
      );
      throw new WorkflowExecutionError(
        `Failed to pause workflow instance ${instanceId}: ${errorMessage}`
      );
    }
  }

  public async resumeWorkflow(instanceId: string): Promise<void> {
    console.log(`WorkflowExecutionEngine: Resuming workflow instance ${instanceId}`);
    let workflowState: WorkflowState | null = null;
    try {
      const retrievedStateForResume = await this.stateManager.getWorkflowState(instanceId);
      if (!retrievedStateForResume) {
        throw new WorkflowExecutionError(
          `Workflow instance ${instanceId} not found for resuming.`
        );
      }
      workflowState = retrievedStateForResume;

      if (workflowState.status === 'paused') {
        workflowState.status = 'running'; // Set to running to re-trigger run
        workflowState.updatedAt = new Date();
        await this.stateManager.saveWorkflowState(workflowState);
        console.log(
          `WorkflowExecutionEngine: Workflow instance ${instanceId} status set to running for resume.`
        );
        
        // Need to load the definition to pass to runWorkflowInstance
        // This is a simplification. A robust solution would fetch the definition based on workflowState.workflowDefinitionId
        // For now, this will fail if the definition isn't available through some other means or if runWorkflowInstance can't load it.
        // const definition = await this.workflowDefinitionLoader.loadDefinitionById(workflowState.workflowDefinitionId); // Placeholder
        // if (!definition) {
        //     throw new WorkflowExecutionError(`Could not load definition ${workflowState.workflowDefinitionId} for resuming instance ${instanceId}`);
        // }
        // this.runWorkflowInstance(instanceId, definition).catch(runError => {
        
        // Assuming runWorkflowInstance can handle definition loading if not passed, or it's cached/available
        this.runWorkflowInstance(instanceId).catch(runError => {
            console.error(`WorkflowExecutionEngine: Error during async resume of ${instanceId}`, runError);
        });
      } else {
        console.warn(
          `WorkflowExecutionEngine: Workflow instance ${instanceId} cannot be resumed. Status: ${workflowState.status}`
        );
      }
    } catch (error) {
        const errorMessage = error instanceof Error ? error.message : String(error);
        console.error(
            `WorkflowExecutionEngine: Error resuming workflow instance ${instanceId}`,
            error
        );
        if (workflowState) { 
            try {
                workflowState.status = 'failed';
                workflowState.error = `Failed to resume: ${errorMessage}`;
                workflowState.updatedAt = new Date();
                await this.stateManager.saveWorkflowState(workflowState);
            } catch (saveError) {
                console.error(`WorkflowExecutionEngine: Could not save failed state on resume error for ${instanceId}`, saveError);
            }
        }
        throw new WorkflowExecutionError(
            `Failed to resume workflow instance ${instanceId}: ${errorMessage}`
        );
    }
  }

  public async getWorkflowStatus(
    instanceId: string
  ): Promise<WorkflowState['status'] | undefined> {
    console.log(
      `WorkflowExecutionEngine: Getting status for workflow instance ${instanceId}`
    );
    try {
      const workflowState = await this.stateManager.getWorkflowState(instanceId);
      return workflowState?.status;
    } catch (error) {
      console.error(
        `WorkflowExecutionEngine: Error getting status for workflow instance ${instanceId}`,
        error
      );
      return undefined;
    }
  }
}