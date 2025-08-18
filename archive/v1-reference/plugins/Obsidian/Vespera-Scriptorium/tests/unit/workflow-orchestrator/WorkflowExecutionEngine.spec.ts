import { describe, it, expect, beforeEach, vi, afterEach } from 'vitest';
import { WorkflowExecutionEngine } from '../../../src/workflow-orchestrator/WorkflowExecutionEngine';
import { WorkflowDefinitionLoader } from '../../../src/workflow-orchestrator/WorkflowDefinitionLoader';
import { StateManager } from '../../../src/workflow-orchestrator/StateManager';
import { NodeExecutor } from '../../../src/workflow-orchestrator/NodeExecutor';
import { WorkflowDefinition, WorkflowState, NodeExecutionResult, WorkflowStage } from '../../../src/workflow-orchestrator/types';

// Mock uuid for StateManager
vi.mock('uuid', () => ({
  v4: () => 'engine-test-uuid-1234',
}));

describe('WorkflowExecutionEngine', () => {
  let engine: WorkflowExecutionEngine;
  let mockLoader: WorkflowDefinitionLoader;
  let mockStateManager: StateManager;
  let mockNodeExecutor: NodeExecutor;

  const simpleWorkflow: WorkflowDefinition = {
    id: 'simple-wf',
    name: 'Simple Test Workflow',
    version: '1.0',
    startStageId: 's1',
    stages: {
      s1: { id: 's1', name: 'Stage 1', type: 'input', outputs: ['data1'], nextStages: ['s2'] },
      s2: { id: 's2', name: 'Stage 2', type: 'process', inputs: ['data1'], outputs: ['data2'], nextStages: ['s3'] },
      s3: { id: 's3', name: 'Stage 3', type: 'output', inputs: ['data2'] },
    },
  };

  const workflowWithBranch: WorkflowDefinition = {
    id: 'branch-wf',
    name: 'Branching Test Workflow',
    version: '1.0',
    startStageId: 's1',
    stages: {
      s1: { id: 's1', name: 'Stage 1', type: 'input', outputs: ['conditionData'], nextStages: ['decision'] },
      decision: { 
        id: 'decision', 
        name: 'Decision Node', 
        type: 'decision', 
        inputs: ['conditionData'], 
        // nextStages logic will be handled by NodeExecutor mock for this test
      },
      s2a: { id: 's2a', name: 'Stage 2a', type: 'process', nextStages: ['s3'] },
      s2b: { id: 's2b', name: 'Stage 2b', type: 'process', nextStages: ['s3'] },
      s3: { id: 's3', name: 'Stage 3 (merge/output)', type: 'output' },
    },
  };
  
  beforeEach(() => {
    mockLoader = new WorkflowDefinitionLoader(); // Real loader, but we'll control its content
    mockStateManager = new StateManager(); // Real StateManager
    mockNodeExecutor = new NodeExecutor(); // Real NodeExecutor, but we'll spy on executeNode

    // Ensure the loader has our test workflow
    mockLoader.loadDefinition(simpleWorkflow);
    mockLoader.loadDefinition(workflowWithBranch);
    
    engine = new WorkflowExecutionEngine(mockLoader, mockStateManager, mockNodeExecutor);

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2024-01-01T10:00:00.000Z'));

    // Suppress console logs for cleaner test output
    vi.spyOn(console, 'log').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.useRealTimers();
  });

  it('should run a simple workflow to completion', async () => {
    const executeNodeSpy = vi.spyOn(mockNodeExecutor, 'executeNode')
      .mockImplementation(async (stage: WorkflowStage, state: WorkflowState): Promise<NodeExecutionResult> => {
        let nextStageId: string | undefined;
        const outputs: Record<string, any> = {};
        if (stage.id === 's1') {
          outputs['data1'] = 's1_output';
          nextStageId = 's2';
        } else if (stage.id === 's2') {
          outputs['data2'] = 's2_output_from_' + state.data['data1'];
          nextStageId = 's3';
        } else if (stage.id === 's3') {
          // No next stage from s3
        }
        return { success: true, outputs, nextStageId };
      });

    const initialData = { initial: 'start' };
    const finalState = await engine.runWorkflow('simple-wf', initialData);

    expect(finalState.status).toBe('completed');
    expect(finalState.currentStageId).toBeUndefined(); // Or last stage id depending on exact logic
    expect(finalState.data.initial).toBe('start');
    expect(finalState.data.data1).toBe('s1_output');
    expect(finalState.data.data2).toBe('s2_output_from_s1_output');
    expect(finalState.history.length).toBe(3);
    expect(finalState.history[0]).toMatchObject({ stageId: 's1', status: 'success' });
    expect(finalState.history[1]).toMatchObject({ stageId: 's2', status: 'success' });
    expect(finalState.history[2]).toMatchObject({ stageId: 's3', status: 'success' });
    expect(executeNodeSpy).toHaveBeenCalledTimes(3);
  });

  it('should handle a workflow that fails at a stage', async () => {
    vi.spyOn(mockNodeExecutor, 'executeNode')
      .mockImplementationOnce(async (stage: WorkflowStage, state: WorkflowState): Promise<NodeExecutionResult> => {
        return { success: true, outputs: { data1: 's1_output' }, nextStageId: 's2' };
      })
      .mockImplementationOnce(async (stage: WorkflowStage, state: WorkflowState): Promise<NodeExecutionResult> => {
        return { success: false, error: 'Stage 2 failed deliberately' };
      }); // s3 should not be called

    const finalState = await engine.runWorkflow('simple-wf');

    expect(finalState.status).toBe('failed');
    expect(finalState.currentStageId).toBeUndefined(); // Execution stopped
    expect(finalState.data.data1).toBe('s1_output'); // Data from successful stage
    expect(finalState.history.length).toBe(2);
    expect(finalState.history[0]).toMatchObject({ stageId: 's1', status: 'success' });
    expect(finalState.history[1]).toMatchObject({ stageId: 's2', status: 'failure', error: 'Stage 2 failed deliberately' });
  });

  it('should throw an error if workflow definition is not found', async () => {
    await expect(engine.runWorkflow('non-existent-wf')).rejects.toThrowError(
      "Workflow definition with ID 'non-existent-wf' not found."
    );
  });

  it('should throw an error if a stage in the definition is not found', async () => {
    const brokenWorkflow: WorkflowDefinition = {
      id: 'broken-wf', name: 'Broken WF', version: '1.0', startStageId: 's1',
      stages: { s1: { id: 's1', name: 'Stage 1', type: 'input', nextStages: ['s_non_existent'] } } // s_non_existent is not defined
    };
    mockLoader.loadDefinition(brokenWorkflow);
    
    vi.spyOn(mockNodeExecutor, 'executeNode') // s1 will succeed
      .mockResolvedValueOnce({ success: true, outputs: {}, nextStageId: 's_non_existent' });

    await expect(engine.runWorkflow('broken-wf')).rejects.toThrowError(
      "Stage with ID 's_non_existent' not found in workflow definition 'broken-wf'."
    );
    const instanceState = mockStateManager.getWorkflowState('engine-test-uuid-1234'); // Assuming this ID is used
    expect(instanceState?.status).toBe('failed');
  });

  it('should handle branching logic based on NodeExecutor result', async () => {
    const executeNodeSpy = vi.spyOn(mockNodeExecutor, 'executeNode')
      .mockImplementation(async (stage: WorkflowStage, state: WorkflowState): Promise<NodeExecutionResult> => {
        if (stage.id === 's1') {
          return { success: true, outputs: { conditionData: 'go_to_s2a' }, nextStageId: 'decision' };
        } else if (stage.id === 'decision') {
          // Simulate decision logic: NodeExecutor determines the next stage
          if (state.data.conditionData === 'go_to_s2a') {
            return { success: true, nextStageId: 's2a' };
          } else {
            return { success: true, nextStageId: 's2b' };
          }
        } else if (stage.id === 's2a') {
          return { success: true, outputs: { path: 'a' }, nextStageId: 's3' };
        } else if (stage.id === 's2b') {
          // This path should not be taken in this test
          return { success: true, outputs: { path: 'b' }, nextStageId: 's3' };
        } else if (stage.id === 's3') {
          return { success: true, outputs: { final: 'done' } };
        }
        return { success: false, error: 'Unknown stage in mock' };
      });

    const finalState = await engine.runWorkflow('branch-wf');
    expect(finalState.status).toBe('completed');
    expect(finalState.data.conditionData).toBe('go_to_s2a');
    expect(finalState.data.path).toBe('a'); // s2a was executed
    expect(finalState.history.map(h => h.stageId)).toEqual(['s1', 'decision', 's2a', 's3']);
    expect(executeNodeSpy).toHaveBeenCalledTimes(4);
  });
  
  it('should prevent infinite loops using maxIterations', async () => {
    const loopyWorkflow: WorkflowDefinition = {
      id: 'loopy-wf', name: 'Loopy WF', version: '1.0', startStageId: 'loop_start',
      stages: { 
        loop_start: { id: 'loop_start', name: 'Loop Start', type: 'process', nextStages: ['loop_start'] } 
      }
    };
    mockLoader.loadDefinition(loopyWorkflow);

    vi.spyOn(mockNodeExecutor, 'executeNode').mockImplementation(async (stage, state) => {
      return { success: true, nextStageId: 'loop_start' }; // Always go back to loop_start
    });

    const finalState = await engine.runWorkflow('loopy-wf');
    expect(finalState.status).toBe('failed');
    expect(finalState.history.length).toBeGreaterThanOrEqual(100); // Max iterations + initial stage
    const lastHistoryEntry = finalState.history[finalState.history.length -1];
    expect(lastHistoryEntry.error).toContain('exceeded maximum iterations');
  });
});