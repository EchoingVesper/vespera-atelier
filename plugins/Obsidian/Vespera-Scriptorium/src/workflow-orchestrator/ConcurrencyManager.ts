// src/workflow-orchestrator/ConcurrencyManager.ts

export interface IConcurrencyManager {
  // TODO: Define interface methods and properties
  getMaxConcurrentWorkflows(): number;
  setMaxConcurrentWorkflows(limit: number): void;
  canStartNewWorkflow(): boolean;
  registerWorkflowStart(): void;
  registerWorkflowEnd(): void;

  getMaxConcurrentNodesPerWorkflow(): number;
  setMaxConcurrentNodesPerWorkflow(limit: number): void;
  canStartNewNode(workflowInstanceId: string): boolean;
  registerNodeStart(workflowInstanceId: string): void;
  registerNodeEnd(workflowInstanceId: string): void;
}

export class ConcurrencyManager implements IConcurrencyManager {
  private maxConcurrentWorkflows: number;
  private activeWorkflows: number;
  private maxConcurrentNodesPerWorkflow: number;
  private activeNodesPerWorkflow: Map<string, number>; // Key: workflowInstanceId

  constructor(maxWorkflows: number = 5, maxNodesPerWorkflow: number = 3) {
    // TODO: Initialize class properties, potentially load from config
    this.maxConcurrentWorkflows = maxWorkflows;
    this.activeWorkflows = 0;
    this.maxConcurrentNodesPerWorkflow = maxNodesPerWorkflow;
    this.activeNodesPerWorkflow = new Map<string, number>();
  }

  public getMaxConcurrentWorkflows(): number {
    return this.maxConcurrentWorkflows;
  }

  public setMaxConcurrentWorkflows(limit: number): void {
    if (limit > 0) {
      this.maxConcurrentWorkflows = limit;
      console.log(`ConcurrencyManager: Max concurrent workflows set to ${limit}`);
    }
  }

  public canStartNewWorkflow(): boolean {
    return this.activeWorkflows < this.maxConcurrentWorkflows;
  }

  public registerWorkflowStart(): void {
    if (this.canStartNewWorkflow()) {
      this.activeWorkflows++;
      console.log(`ConcurrencyManager: Workflow started. Active workflows: ${this.activeWorkflows}`);
    } else {
      console.warn('ConcurrencyManager: Cannot start new workflow, limit reached.');
      // Optionally throw an error or queue the request
    }
  }

  public registerWorkflowEnd(): void {
    if (this.activeWorkflows > 0) {
      this.activeWorkflows--;
      console.log(`ConcurrencyManager: Workflow ended. Active workflows: ${this.activeWorkflows}`);
    }
  }

  public getMaxConcurrentNodesPerWorkflow(): number {
    return this.maxConcurrentNodesPerWorkflow;
  }

  public setMaxConcurrentNodesPerWorkflow(limit: number): void {
     if (limit > 0) {
      this.maxConcurrentNodesPerWorkflow = limit;
      console.log(`ConcurrencyManager: Max concurrent nodes per workflow set to ${limit}`);
    }
  }

  public canStartNewNode(workflowInstanceId: string): boolean {
    const activeNodes = this.activeNodesPerWorkflow.get(workflowInstanceId) || 0;
    return activeNodes < this.maxConcurrentNodesPerWorkflow;
  }

  public registerNodeStart(workflowInstanceId: string): void {
    if (this.canStartNewNode(workflowInstanceId)) {
      const currentActive = this.activeNodesPerWorkflow.get(workflowInstanceId) || 0;
      this.activeNodesPerWorkflow.set(workflowInstanceId, currentActive + 1);
      console.log(`ConcurrencyManager: Node started for workflow ${workflowInstanceId}. Active nodes for this workflow: ${currentActive + 1}`);
    } else {
      console.warn(`ConcurrencyManager: Cannot start new node for workflow ${workflowInstanceId}, limit reached.`);
      // Optionally throw an error or queue the node execution
    }
  }

  public registerNodeEnd(workflowInstanceId: string): void {
    const currentActive = this.activeNodesPerWorkflow.get(workflowInstanceId);
    if (currentActive && currentActive > 0) {
      this.activeNodesPerWorkflow.set(workflowInstanceId, currentActive - 1);
       console.log(`ConcurrencyManager: Node ended for workflow ${workflowInstanceId}. Active nodes for this workflow: ${currentActive - 1}`);
    }
    if (currentActive === 1) { // Last node for this workflow instance
        this.activeNodesPerWorkflow.delete(workflowInstanceId);
    }
  }

  // TODO: Add other class methods for more sophisticated concurrency control
}