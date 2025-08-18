/**
 * @file Defines shared types and interfaces for the Workflow Orchestrator submodule.
 */

/**
 * Represents a single stage or node within a workflow.
 */
export interface WorkflowStage {
  /** Unique identifier for the stage. */
  id: string;
  /** Name of the stage. */
  name: string;
  /** Type of the stage, indicating the kind of operation it performs. */
  type: string; // e.g., 'extraction', 'classification', 'custom-script'
  /** Optional description of the stage. */
  description?: string;
  /** Configuration specific to this stage. */
  config?: Record<string, any>;
  /** IDs of the next stage(s) to execute. Can be conditional. */
  nextStages?: string[] | { condition: string; stageId: string }[]; // Simplified for now
  /** Input data mapping for this stage. Keys are input names, values are JSONPath-like strings referencing data in the workflow context. */
  inputs?: Record<string, string>;
  /** Output data mapping for this stage. Keys are output names, values are JSONPath-like strings indicating where to store the output in the workflow context. */
  outputs?: Record<string, string>;
}

/**
 * Defines the structure of a workflow.
 */
export interface WorkflowDefinition {
  /** Unique identifier for the workflow. */
  id: string;
  /** Name of the workflow. */
  name: string;
  /** Version of the workflow definition. */
  version: string;
  /** Description of the workflow. */
  description?: string;
  /** Optional initial context data for the workflow. */
  initialContext?: Record<string, any>;
  /** The ID of the initial stage to start the workflow. */
  startStageId: string;
  /** A map of stage IDs to their definitions. */
  stages: Record<string, WorkflowStage>;
}

/**
 * Represents the current state of an executing workflow instance.
 */
export interface WorkflowState {
  /** Unique identifier for this workflow instance. */
  instanceId: string;
  /** ID of the workflow definition being executed. */
  workflowDefinitionId: string;
  /** Current status of the workflow (e.g., 'running', 'completed', 'failed'). */
  status: 'pending' | 'running' | 'completed' | 'failed' | 'paused';
  /** ID of the current stage being processed or last processed. */
  currentStageId?: string;
  /** Stores intermediate data produced by workflow stages. Keyed by data identifier. */
  data: Record<string, any>;
  /** History of executed stages and their outcomes. */
  history: Array<{
    stageId: string;
    status: 'running' | 'success' | 'failure'; // Added 'running'
    startedAt: Date;
    completedAt?: Date;
    error?: string;
    outputs?: Record<string, any>;
  }>;
  /** Timestamp when the workflow instance was created. */
  createdAt: Date;
  /** Timestamp when the workflow instance was last updated. */
  updatedAt: Date;
  /** Optional error message if the workflow failed. */
  error?: string;
}

/**
 * Represents the result of a node/stage execution.
 */
export interface NodeExecutionResult {
  /** Indicates whether the execution was successful. */
  success: boolean;
  /** Data produced by the node/stage. */
  outputs?: Record<string, any>;
  /** Error message if execution failed. */
  error?: string;
  /** The next stage ID to transition to, if determined by the node. */
  nextStageId?: string;
}

/**
 * Represents the executable logic for a specific type of workflow node/stage.
 */
export interface IWorkflowNodeHandler {
  /**
   * Executes the logic for a workflow stage.
   * @param stage The definition of the stage to execute.
   * @param currentWorkflowData A read-only snapshot of the current workflow instance's data.
   * @param services Optional shared services (e.g., logger, API clients).
   * @returns A promise that resolves to the result of the node execution.
   */
  execute(
    stage: WorkflowStage,
    currentWorkflowData: Readonly<Record<string, any>>,
    services?: any // eslint-disable-line @typescript-eslint/no-explicit-any
  ): Promise<NodeExecutionResult>;
}

/**
 * Custom error class for errors occurring during node execution.
 */
export class NodeExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'NodeExecutionError';
    // Ensure the prototype chain is correctly set up for ES5+
    Object.setPrototypeOf(this, NodeExecutionError.prototype);
  }
}

/**
 * Custom error class for errors occurring during workflow execution.
 */
export class WorkflowExecutionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'WorkflowExecutionError';
    // Ensure the prototype chain is correctly set up for ES5+
    Object.setPrototypeOf(this, WorkflowExecutionError.prototype);
  }
}