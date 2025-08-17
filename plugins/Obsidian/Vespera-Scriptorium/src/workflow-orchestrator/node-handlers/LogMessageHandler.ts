// src/workflow-orchestrator/node-handlers/LogMessageHandler.ts

import {
  WorkflowStage,
  NodeExecutionResult,
  IWorkflowNodeHandler,
} from '../types';

/**
 * A simple node handler that logs a message to the console.
 * Expects 'message' and optionally 'level' (e.g., 'info', 'warn', 'error') in stage.config.
 */
export class LogMessageHandler implements IWorkflowNodeHandler {
  /**
   * Executes the log message node.
   * @param stage The workflow stage definition, containing config for the log message.
   * @param currentWorkflowData A read-only snapshot of the current workflow instance's data.
   * @param _services Optional shared services (not used by this handler).
   * @returns A promise that resolves to the result of the node execution.
   */
  public async execute(
    stage: WorkflowStage,
    _currentWorkflowData: Readonly<Record<string, any>>, // eslint-disable-line @typescript-eslint/no-unused-vars
    _services?: any // eslint-disable-line @typescript-eslint/no-unused-vars, @typescript-eslint/no-explicit-any
  ): Promise<NodeExecutionResult> {
    const message = stage.config?.message || `LogMessageHandler: Default message for stage ${stage.id}`;
    const level = stage.config?.level || 'info'; // Default to 'info'

    const logPrefix = `LogNode[${stage.id}] (${level}):`;

    switch (level.toLowerCase()) {
      case 'warn':
        console.warn(`${logPrefix} ${message}`);
        break;
      case 'error':
        console.error(`${logPrefix} ${message}`);
        break;
      case 'info':
      default:
        console.log(`${logPrefix} ${message}`);
        break;
    }

    return {
      success: true,
      outputs: {
        logTimestamp: new Date().toISOString(),
        messageLogged: message,
        logLevel: level,
      },
    };
  }
}