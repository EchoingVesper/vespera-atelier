import { describe, it, expect, beforeEach } from 'vitest';
import { WorkflowDefinitionLoader } from '../../../src/workflow-orchestrator/WorkflowDefinitionLoader';
import { WorkflowDefinition } from '../../../src/workflow-orchestrator/types';

describe('WorkflowDefinitionLoader', () => {
  let loader: WorkflowDefinitionLoader;

  const demoWorkflow: WorkflowDefinition = {
    id: 'test-workflow-1',
    name: 'Test Workflow 1',
    version: '1.0.0',
    startStageId: 'start',
    stages: {
      start: { id: 'start', name: 'Start', type: 'input', nextStages: ['end'] },
      end: { id: 'end', name: 'End', type: 'output' },
    },
  };

  const demoWorkflow2: WorkflowDefinition = {
    id: 'test-workflow-2',
    name: 'Test Workflow 2',
    version: '1.0.0',
    startStageId: 'init',
    stages: {
      init: { id: 'init', name: 'Initialize', type: 'input', nextStages: ['finish'] },
      finish: { id: 'finish', name: 'Finish', type: 'output' },
    },
  };

  beforeEach(() => {
    // The constructor loads a default 'demo-workflow-v1'.
    // For clean tests, we instantiate a new loader each time.
    loader = new WorkflowDefinitionLoader(); 
  });

  it('should be initialized with a default demo workflow', () => {
    const defaultDemo = loader.getDefinition('demo-workflow-v1');
    expect(defaultDemo).toBeDefined();
    expect(defaultDemo?.name).toEqual('Demonstration Workflow');
  });

  it('should load a new workflow definition', () => {
    // Use registerDefinitionObject for pre-defined objects
    loader.registerDefinitionObject(demoWorkflow, 'test-workflow-1-object');
    const definition = loader.getDefinition('test-workflow-1');
    expect(definition).toBeDefined();
    expect(definition?.name).toEqual('Test Workflow 1');
  });

  it('should throw an error if loading a definition with an existing ID', () => {
    loader.registerDefinitionObject(demoWorkflow, 'test-workflow-1-object');
    // Attempting to register the same object (or one with the same ID) should throw
    expect(() => loader.registerDefinitionObject(demoWorkflow, 'test-workflow-1-duplicate')).toThrowError(
      "Workflow definition with ID 'test-workflow-1' already exists (loaded from test-workflow-1-duplicate). Cannot overwrite."
    );
  });
  
  it('should throw an error if loading a definition with the default demo ID after it was loaded by constructor', () => {
    const defaultDemoDef = loader.getDefinition('demo-workflow-v1') as WorkflowDefinition;
    // Attempting to register an object with the same ID as the constructor-loaded one
    expect(() => loader.registerDefinitionObject(defaultDemoDef, 'demo-workflow-v1-duplicate')).toThrowError(
      "Workflow definition with ID 'demo-workflow-v1' already exists (loaded from demo-workflow-v1-duplicate). Cannot overwrite."
    );
  });

  it('should retrieve a specific workflow definition by ID', () => {
    loader.registerDefinitionObject(demoWorkflow, 'test-workflow-1-object');
    const definition = loader.getDefinition('test-workflow-1');
    expect(definition).toEqual(demoWorkflow);
  });

  it('should return undefined if a definition with the given ID does not exist', () => {
    const definition = loader.getDefinition('non-existent-workflow');
    expect(definition).toBeUndefined();
  });

  it('should retrieve all loaded workflow definitions', () => {
    // Constructor loads one ('demo-workflow-v1'), then we add two more
    loader.registerDefinitionObject(demoWorkflow, 'test-workflow-1-object');
    loader.registerDefinitionObject(demoWorkflow2, 'test-workflow-2-object');
    const definitions = loader.getAllDefinitions();
    expect(definitions.length).toBe(3); // demo-workflow-v1, test-workflow-1, test-workflow-2
    expect(definitions).toContainEqual(expect.objectContaining({id: 'demo-workflow-v1'}));
    expect(definitions).toContainEqual(demoWorkflow);
    expect(definitions).toContainEqual(demoWorkflow2);
  });
});