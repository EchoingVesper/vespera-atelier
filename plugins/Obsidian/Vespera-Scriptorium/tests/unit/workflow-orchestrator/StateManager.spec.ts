import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { StateManager, StateNotFoundError } from '../../../src/workflow-orchestrator/StateManager';
import { WorkflowDefinition, WorkflowState } from '../../../src/workflow-orchestrator/types';
import { DataAdapter } from 'obsidian';

// Mock the uuidv4 function
vi.mock('uuid', () => ({
  v4: () => 'test-uuid-1234',
}));

// Define mock adapter and base path
const MOCK_BASE_PATH = '/test/workflow-states';
const mockAdapter = {
  exists: vi.fn(),
  read: vi.fn(),
  write: vi.fn(),
  remove: vi.fn()
} as unknown as DataAdapter;

describe('StateManager', () => {
  let stateManager: StateManager;
  const mockWorkflowDefinition: WorkflowDefinition = {
    id: 'wf-def-1',
    name: 'Test Workflow Definition',
    version: '1.0',
    startStageId: 'stage1',
    stages: {
      stage1: { id: 'stage1', name: 'Stage 1', type: 'input', nextStages: ['stage2'] },
      stage2: { id: 'stage2', name: 'Stage 2', type: 'process' },
    },
  };

  beforeEach(() => {
    stateManager = new StateManager(mockAdapter, MOCK_BASE_PATH);
    vi.useFakeTimers(); // Use fake timers for date-sensitive tests
    
    // Reset mock functions
    vi.resetAllMocks();
  });

  afterEach(() => {
    vi.useRealTimers(); // Restore real timers
  });

  it('should create a new workflow instance with correct initial state', async () => {
    const now = new Date();
    vi.setSystemTime(now); // Set a fixed time

    const initialData = { input1: 'value1' };
    const instance = await stateManager.createWorkflowInstance(mockWorkflowDefinition.id, initialData);

    expect(instance.instanceId).toBe('test-uuid-1234');
    expect(instance.workflowDefinitionId).toBe('wf-def-1');
    expect(instance.status).toBe('pending');
    // currentStageId is not set at creation by StateManager, but by WorkflowExecutionEngine
    expect(instance.currentStageId).toBeUndefined();
    expect(instance.data).toEqual(initialData);
    expect(instance.history).toEqual([]);
    expect(instance.createdAt).toEqual(now);
    expect(instance.updatedAt).toEqual(now);
    expect(mockAdapter.write).toHaveBeenCalledWith(`${MOCK_BASE_PATH}/test-uuid-1234.json`, expect.any(String));
  });

  it('should retrieve a workflow state by instance ID', async () => {
    const now = new Date();
    const mockState: WorkflowState = {
      instanceId: 'test-uuid-1234',
      workflowDefinitionId: 'wf-def-1',
      status: 'running',
      currentStageId: 'stage1',
      data: { key: 'value' },
      history: [],
      createdAt: now,
      updatedAt: now,
    };
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockAdapter.read as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(mockState));

    const retrievedState = await stateManager.getWorkflowState('test-uuid-1234');
    expect(retrievedState).toEqual(mockState);
    expect(mockAdapter.exists).toHaveBeenCalledWith(`${MOCK_BASE_PATH}/test-uuid-1234.json`);
    expect(mockAdapter.read).toHaveBeenCalledWith(`${MOCK_BASE_PATH}/test-uuid-1234.json`);
  });

  it('should return undefined when retrieving a non-existent workflow state', async () => {
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const retrievedState = await stateManager.getWorkflowState('non-existent-id');
    expect(retrievedState).toBeUndefined();
  });

  it('should update a workflow state', async () => {
    const createTime = new Date();
    vi.setSystemTime(createTime);
    const initialInstance = await stateManager.createWorkflowInstance(mockWorkflowDefinition.id, { original: 'data' });
    
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockAdapter.read as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(initialInstance));

    const updateTime = new Date(Date.now() + 1000);
    vi.setSystemTime(updateTime);

    const updates: Partial<Omit<WorkflowState, 'instanceId' | 'workflowDefinitionId' | 'createdAt'>> = {
      status: 'running',
      currentStageId: 'stage2',
      data: { ...initialInstance.data, newData: 'value2' },
    };
    const updatedState = await stateManager.updateWorkflowState(initialInstance.instanceId, updates);

    expect(updatedState).toBeDefined();
    expect(updatedState?.status).toBe('running');
    expect(updatedState?.currentStageId).toBe('stage2');
    expect(updatedState?.data).toEqual({ original: 'data', newData: 'value2' });
    expect(updatedState?.updatedAt.toISOString()).toEqual(updateTime.toISOString());
    expect(mockAdapter.write).toHaveBeenCalledWith(`${MOCK_BASE_PATH}/${initialInstance.instanceId}.json`, expect.stringContaining('"status":"running"'));
  });

  it('should throw an error when updating a non-existent workflow state', async () => {
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false); // Ensure getWorkflowState returns undefined
    await expect(
      stateManager.updateWorkflowState('non-existent-id', { status: 'completed' })
    ).rejects.toThrow(StateNotFoundError); // This is sufficient, the specific message can vary
    // ).rejects.toThrowError("State for workflow instance non-existent-id not found. Cannot update.");
  });

  it('should add a history entry to a workflow state', async () => {
    const instance = await stateManager.createWorkflowInstance(mockWorkflowDefinition.id);
    
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValue(true);
    (mockAdapter.read as ReturnType<typeof vi.fn>).mockResolvedValue(JSON.stringify(instance));

    const historyEntry: WorkflowState['history'][0] = {
      stageId: 'stage1',
      status: 'success',
      startedAt: new Date(),
      completedAt: new Date(),
      outputs: { result: 'ok' },
    };
    const updateTime = new Date(Date.now() + 2000);
    vi.setSystemTime(updateTime);

    await stateManager.addHistoryEntry(instance.instanceId, historyEntry);
    
    // Verify write was called with the new history
    const writeCallArgs = (mockAdapter.write as ReturnType<typeof vi.fn>).mock.calls.pop();
    expect(writeCallArgs).toBeDefined();
    const writtenState = writeCallArgs ? JSON.parse(writeCallArgs[1]) : null;
    expect(writtenState.history).toContainEqual(expect.objectContaining(historyEntry));
    expect(writtenState.history.length).toBe(1);
    expect(new Date(writtenState.updatedAt).toISOString()).toEqual(updateTime.toISOString());
  });

  it('should throw StateNotFoundError when adding history to a non-existent instance', async () => {
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console output for this test
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false); // Simulate non-existent state

    const historyEntry: WorkflowState['history'][0] = {
      stageId: 'stage1',
      status: 'success',
      startedAt: new Date(),
    };
    await expect(stateManager.addHistoryEntry('non-existent-id', historyEntry)).rejects.toThrow(StateNotFoundError);
    // The actual warning log is now inside the addHistoryEntry method itself before throwing.
    // We can check if console.warn was called if needed, but the important part is the error.
    expect(consoleWarnSpy).toHaveBeenCalledWith('StateManager: Attempted to add history to non-existent workflow instance non-existent-id. This will throw.');
    consoleWarnSpy.mockRestore();
  });

  it('should delete a workflow instance state', async () => {
    const instance = await stateManager.createWorkflowInstance(mockWorkflowDefinition.id);
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(true); // For the delete call itself
    
    await stateManager.deleteWorkflowInstance(instance.instanceId);
    expect(mockAdapter.remove).toHaveBeenCalledWith(`${MOCK_BASE_PATH}/${instance.instanceId}.json`);

    // For the subsequent getWorkflowState check
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValueOnce(false);
    const retrievedState = await stateManager.getWorkflowState(instance.instanceId);
    expect(retrievedState).toBeUndefined();
  });

  it('should not throw when deleting a non-existent workflow instance state (and log warning)', async () => {
    (mockAdapter.exists as ReturnType<typeof vi.fn>).mockResolvedValue(false);
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    
    await expect(stateManager.deleteWorkflowInstance('non-existent-id')).resolves.toBeUndefined();
    expect(mockAdapter.remove).not.toHaveBeenCalled();
    expect(consoleWarnSpy).toHaveBeenCalledWith(`StateManager: State file not found for instance non-existent-id at ${MOCK_BASE_PATH}/non-existent-id.json. Nothing to delete.`);
    consoleWarnSpy.mockRestore();
  });

  // The listWorkflowInstances method was not part of the original IStateManager or implementation.
  // If it's added, tests would go here. For now, this test is removed/commented.
  // it('should list all workflow instances', async () => {
  //   // This test would require a more complex mock for adapter.list() or similar
  // });
});