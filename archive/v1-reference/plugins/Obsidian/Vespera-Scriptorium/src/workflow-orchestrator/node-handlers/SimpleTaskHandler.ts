// src/workflow-orchestrator/node-handlers/SimpleTaskHandler.ts

import {
  WorkflowStage,
  NodeExecutionResult,
  IWorkflowNodeHandler,
} from '../types';

/**
 * A simple node handler for executing a generic task.
 * Expects 'taskName' in stage.config.
 */
export class SimpleTaskHandler implements IWorkflowNodeHandler {
  /**
   * Executes the simple task node.
   * @param stage The workflow stage definition, containing config for the task.
   * @param currentWorkflowData A read-only snapshot of the current workflow instance's data.
   * @param _services Optional shared services (not used by this handler).
   * @returns A promise that resolves to the result of the node execution.
   */
  public async execute(
    stage: WorkflowStage,
    currentWorkflowData: Readonly<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-unused-vars
    _services?: any // eslint-disable-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  ): Promise<NodeExecutionResult> {
    const taskName = stage.config?.taskName || `Unnamed Task for stage ${stage.id}`;

    console.log(`SimpleTaskHandler[${stage.id}]: Executing task '${taskName}'.`);
    // Simulate some work
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate async work

    // Example: Accessing some data from the workflow context
    const inputDataExample = currentWorkflowData['previous_step_output'] || 'No input from previous step';
    console.log(`SimpleTaskHandler[${stage.id}]: Input from context: ${inputDataExample}`);

    return {
      success: true,
      outputs: {
        taskNameExecuted: taskName,
        status: 'completed',
        resultData: `Output from ${taskName}`,
        processedTimestamp: new Date().toISOString(),
      },
    };
  }
}