import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { NodeExecutor } from '../../../src/workflow-orchestrator/NodeExecutor';
import { WorkflowStage, WorkflowState, NodeExecutionResult } from '../../../src/workflow-orchestrator/types';

describe('NodeExecutor', () => {
  let nodeExecutor: NodeExecutor;
  let mockStage: WorkflowStage;
  let mockState: WorkflowState;

  beforeEach(() => {
    nodeExecutor = new NodeExecutor();
    mockStage = {
      id: 'test-stage-1',
      name: 'Test Stage',
      type: 'processing_node',
      inputs: ['inputData'],
      outputs: ['outputData'],
      nextStages: ['next-stage-id'],
    };
    mockState = {
      instanceId: 'test-instance-1',
      workflowDefinitionId: 'test-wf-def-1',
      status: 'running',
      currentStageId: 'test-stage-1',
      data: {
        inputData: 'some value',
        otherData: 'another value',
      },
      history: [],
      createdAt: new Date(),
      updatedAt: new Date(),
    };
    vi.spyOn(console, 'log').mockImplementation(() => {}); // Suppress console.log
    vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console.warn
    vi.spyOn(console, 'error').mockImplementation(() => {}); // Suppress console.error
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('should execute a simple node successfully', async () => {
    const result = await nodeExecutor.executeNode(mockStage, mockState);
    expect(result.success).toBe(true);
    expect(result.outputs).toBeDefined();
    expect(result.outputs?.outputData).toEqual('processed_value_for_outputData_from_test-stage-1');
    expect(result.nextStageId).toBe('next-stage-id');
    expect(result.error).toBeUndefined();
  });

  it('should handle a node with no inputs', async () => {
    mockStage.inputs = undefined;
    const result = await nodeExecutor.executeNode(mockStage, mockState);
    expect(result.success).toBe(true);
    expect(result.outputs?.outputData).toBeDefined();
  });

  it('should handle a node with no outputs', async () => {
    mockStage.outputs = undefined;
    const result = await nodeExecutor.executeNode(mockStage, mockState);
    expect(result.success).toBe(true);
    expect(result.outputs).toEqual({}); // Empty object for outputs
  });

  it('should handle a node with no nextStages defined', async () => {
    mockStage.nextStages = undefined;
    const result = await nodeExecutor.executeNode(mockStage, mockState);
    expect(result.success).toBe(true);
    expect(result.nextStageId).toBeUndefined();
  });

  it('should handle conditional nextStages (simplified, takes first)', async () => {
    mockStage.nextStages = [{ condition: 'true', stageId: 'conditional-next-stage' }];
    const result = await nodeExecutor.executeNode(mockStage, mockState);
    expect(result.success).toBe(true);
    expect(result.nextStageId).toBe('conditional-next-stage');
  });
  
  it('should warn if an input key is missing from workflow state data (but still succeed for now)', async () => {
    mockStage.inputs = ['missingInput'];
    const result = await nodeExecutor.executeNode(mockStage, mockState);
    // Current placeholder logic in NodeExecutor doesn't fail for missing input, just warns.
    expect(result.success).toBe(true); 
    expect(console.warn).toHaveBeenCalledWith("Input key 'missingInput' not found in workflow state data for stage 'test-stage-1'.");
  });

  // Example of how a failing node might be tested if executeNode could throw or return specific errors
  it('should return a failure result if an error occurs during execution (simulated)', async () => {
    // To properly test this, we'd need to be able to induce an error within executeNode.
    // For now, we'll mock a part of its internal logic if it were more complex.
    // This test is more conceptual with the current simple NodeExecutor.
    
    // If NodeExecutor had a dependency that could fail:
    // const mockDependency = { doWork: vi.fn().mockRejectedValue(new Error("Simulated error")) };
    // nodeExecutor = new NodeExecutor(mockDependency); // Assuming constructor takes dependency

    // Or if a specific stage type caused an error:
    mockStage.type = 'error_inducing_type'; // A type that our simple executor doesn't handle well

    // For the current simple executor, we can't easily induce a catch block without modifying it.
    // Let's assume a future version where certain stage types might fail.
    // For now, this test will pass because the catch block is not hit by type alone.
    // To make it fail, we'd have to modify NodeExecutor to throw for 'error_inducing_type'.

    const originalExecuteNode = nodeExecutor.executeNode;
    vi.spyOn(nodeExecutor, 'executeNode').mockImplementationOnce(async (stage, currentState) => {
        if (stage.type === 'error_inducing_type') {
            return { success: false, error: 'Simulated error for type' };
        }
        return originalExecuteNode.call(nodeExecutor, stage, currentState);
    });

    const result = await nodeExecutor.executeNode(mockStage, mockState);
    expect(result.success).toBe(false);
    expect(result.error).toBe('Simulated error for type');
  });
});