# Workflow Execution Engine

- **Status**: In Progress
- **Last Updated**: May 20, 2025
- **Architectural Role**: Core component that manages the lifecycle and execution flow of a workflow.

## Development Log

- **May 20, 2025**: Basic class structure `WorkflowExecutionEngine.ts` created in `src/workflow-orchestrator/`. Status set to Scaffolded.
- **May 20, 2025**: Initial implementation of `WorkflowExecutionEngine` class.
    - Added `IWorkflowExecutionEngine` interface with methods: `startWorkflow`, `pauseWorkflow`, `resumeWorkflow`, `getWorkflowStatus`, `runWorkflowInstance`.
    - Constructor now accepts `IWorkflowDefinitionLoader`, `IStateManager`, and `INodeExecutor`.
    - `startWorkflow` implemented to:
        - Create initial workflow state via `StateManager`.
        - Set initial `currentStageId` from `WorkflowDefinition.startStageId`.
        - Invoke `runWorkflowInstance`.
    - `runWorkflowInstance` implemented with a core loop to:
        - Fetch current `WorkflowState` and `WorkflowDefinition`.
        - Handle terminal states ('completed', 'failed').
        - Set workflow status to 'running'.
        - Iterate while status is 'running' and `currentStageId` is valid:
            - Retrieve current `WorkflowStage`.
            - Log stage execution and update history.
            - Execute stage via `NodeExecutor`.
            - Process `NodeExecutionResult`:
                - Merge outputs to `WorkflowState.data`.
                - Update history entry.
                - Handle success: determine `nextStageId` (linear for now) or mark as 'completed'.
                - Handle failure: set `WorkflowState.status` to 'failed', store error.
            - Save `WorkflowState` after each step/change.
    - Basic `pauseWorkflow`, `resumeWorkflow`, and `getWorkflowStatus` methods implemented.
    - Added `WorkflowExecutionError` to `types.ts` and updated `WorkflowState` history and error property.

## Checklist for Updates

- [x] Design and implement the `WorkflowExecutionEngine` class (Initial phase: core execution loop, start, basic pause/resume/status).
- [x] Define interfaces for workflow instances and execution context (Covered by `IWorkflowExecutionEngine` and usage of `WorkflowState`, `WorkflowDefinition`).
- [x] Implement logic to start, pause, resume, and stop workflow instances (Initial `startWorkflow`, `pauseWorkflow`, `resumeWorkflow`, `getWorkflowStatus`. `stopWorkflow` is pending).
- [x] Integrate with `NodeExecutor` to run individual workflow nodes.
- [x] Integrate with `StateManager` to persist and retrieve workflow state.
- [ ] Integrate with `ConcurrencyManager` to control workflow and node execution.
- [x] Implement error handling and recovery mechanisms (e.g., retries, fallbacks) (Basic error handling implemented, setting state to 'failed', using `WorkflowExecutionError`. Retries/fallbacks are pending).
- [ ] Write unit tests for various workflow execution scenarios.
- [ ] Document the component's API, state transitions, and interactions (Initial internal comments added. Full external documentation pending).
- [ ] Refine `runWorkflowInstance` to robustly load `WorkflowDefinition` if not passed.
- [ ] Implement conditional logic for `nextStages` determination.
- [ ] Implement robust `stopWorkflow` functionality.