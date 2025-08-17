// src/workflow-orchestrator/NodeExecutor.ts

import {
  WorkflowStage,
  WorkflowState,
  NodeExecutionResult,
  IWorkflowNodeHandler,
  NodeExecutionError,
} from './types';
import { FileManager } from '../FileManager'; // Adjust path as needed
import { FileReadHandler } from './node-handlers/FileReadHandler';
import { FileWriteHandler } from './node-handlers/FileWriteHandler';
import { ObsidianNoteReadHandler } from './node-handlers/ObsidianNoteReadHandler';
import { ObsidianNoteWriteHandler } from './node-handlers/ObsidianNoteWriteHandler';

/**
 * Defines the interface for the NodeExecutor.
 * The NodeExecutor is responsible for executing individual workflow stages (nodes)
 * by dispatching them to registered handlers based on the node type.
 */
export interface INodeExecutor {
  /**
   * Registers a handler for a specific node type.
   * @param nodeType The type of the node (e.g., 'task', 'decision').
   * @param handler The handler instance that implements IWorkflowNodeHandler.
   */
  registerNodeHandler(nodeType: string, handler: IWorkflowNodeHandler): void;

  /**
   * Unregisters a handler for a specific node type.
   * @param nodeType The type of the node to unregister.
   * @returns True if a handler was found and removed, false otherwise.
   */
  unregisterNodeHandler(nodeType: string): boolean;

  /**
   * Executes a given workflow stage using the appropriate registered handler.
   * @param stage The workflow stage definition to execute.
   * @param workflowState The current state of the workflow instance.
   * @returns A promise that resolves to the result of the node execution.
   */
  executeNode(stage: WorkflowStage, workflowState: WorkflowState): Promise<NodeExecutionResult>;
}

/**
 * Implements the INodeExecutor interface.
 * Manages a collection of node handlers and delegates execution accordingly.
 */
export class NodeExecutor implements INodeExecutor {
  private nodeHandlers: Map<string, IWorkflowNodeHandler>;
  private readonly fileManager: FileManager;

  /**
   * Initializes a new instance of the NodeExecutor class.
   * @param fileManager An instance of FileManager for vault-aware path resolution.
   */
  constructor(fileManager: FileManager) {
    this.nodeHandlers = new Map<string, IWorkflowNodeHandler>();
    this.fileManager = fileManager;
    this.registerCoreNodeHandlers();
  }

  private registerCoreNodeHandlers(): void {
    this.registerNodeHandler('fileRead', new FileReadHandler(this.fileManager));
    this.registerNodeHandler('fileWrite', new FileWriteHandler(this.fileManager));
    this.registerNodeHandler('obsidianNoteRead', new ObsidianNoteReadHandler(this.fileManager));
    this.registerNodeHandler('obsidianNoteWrite', new ObsidianNoteWriteHandler(this.fileManager));
    // TODO: Register other core node handlers here
  }

  /**
   * Registers a handler for a specific node type.
   * If a handler for the given nodeType already exists, it will be overwritten.
   * @param nodeType The type of the node (e.g., 'task', 'decision', 'llm-call').
   * @param handler The handler instance that implements IWorkflowNodeHandler.
   */
  public registerNodeHandler(nodeType: string, handler: IWorkflowNodeHandler): void {
    if (!nodeType || !handler) {
      console.warn('NodeExecutor: Attempted to register a handler with invalid nodeType or handler.');
      // Or throw an error, depending on desired strictness
      // throw new Error('Node type and handler cannot be null or undefined.');
      return;
    }
    console.log(`NodeExecutor: Registering handler for node type '${nodeType}'.`);
    this.nodeHandlers.set(nodeType, handler);
  }

  /**
   * Unregisters a handler for a specific node type.
   * @param nodeType The type of the node to unregister.
   * @returns True if a handler was found and removed, false otherwise.
   */
  public unregisterNodeHandler(nodeType: string): boolean {
    if (!nodeType) {
      console.warn('NodeExecutor: Attempted to unregister a handler with invalid nodeType.');
      return false;
    }
    const success = this.nodeHandlers.delete(nodeType);
    if (success) {
      console.log(`NodeExecutor: Unregistered handler for node type '${nodeType}'.`);
    } else {
      console.warn(`NodeExecutor: No handler found for node type '${nodeType}' to unregister.`);
    }
    return success;
  }

  /**
   * Executes a given workflow stage using the appropriate registered handler.
   * @param stage The workflow stage definition to execute.
   * @param workflowState The current state of the workflow instance.
   * @returns A promise that resolves to the result of the node execution.
   * @throws {NodeExecutionError} If no handler is registered for the stage's type, or if the handler itself throws an unhandled error.
   */
  public async executeNode(stage: WorkflowStage, workflowState: WorkflowState): Promise<NodeExecutionResult> {
    console.log(`NodeExecutor: Attempting to execute node '${stage.id}' of type '${stage.nodeType}'.`);
    console.log(`NodeExecutor: Current workflow context for node '${stage.id}':`, JSON.stringify(workflowState.context, null, 2));

    // TODO: Implement proper input resolution based on stage.inputs and workflowState.context
    // For now, passing an empty object for inputs if not defined, and stage.params directly.
    const resolvedInputs = stage.inputs || {};
    const resolvedParams = stage.params || {};

    const handler = this.nodeHandlers.get(stage.nodeType);

    if (!handler) {
      const errorMessage = `NodeExecutor: No handler registered for node type '${stage.nodeType}' (node ID: '${stage.id}').`;
      console.error(errorMessage);
      throw new NodeExecutionError(errorMessage, stage.id);
    }

    try {
      const result = await handler.execute(
        stage,
        resolvedInputs,
        resolvedParams,
        workflowState.context
        /* services can be added here */
      );
      console.log(`NodeExecutor: Node '${stage.id}' executed. Success: ${result.success}. Data:`, result.data);
      return result;
    } catch (error: any) {
      const errorMessage = `NodeExecutor: Error during execution of node '${stage.id}' (type: '${stage.nodeType}'). Error: ${error.message}`;
      console.error(errorMessage, error);
      // Wrap the error in NodeExecutionError
      // For now, return a standard error result.
      return {
        success: false,
        error: error.message || 'Unknown error during node execution.',
      };
    }
  }
}