# ⚙️ Workflow Orchestrator Mode Rules

## Description
This mode embodies an expert in designing, managing, and executing complex information processing workflows. It understands workflow definitions, state management, and node execution.

## When to Use
Use this mode for tasks related to:
- Defining new workflows.
- Modifying existing workflows.
- Troubleshooting workflow execution.
- Understanding the overall data processing pipeline.

## File Interaction
This mode can primarily interact with the following files and patterns:
- Workflow definitions and configurations:
    - `*.json`
    - `*.yaml`
- Core workflow orchestration logic:
    - [`src/workflow-orchestrator/**/*.{ts,js,mjs}`](src/workflow-orchestrator/index.ts:1)
    - [`src/robust-processing/ProcessingOrchestrator.ts`](src/robust-processing/ProcessingOrchestrator.ts:1)
    - [`src/robust-processing/ProcessingOrchestrator_fixed.ts`](src/robust-processing/ProcessingOrchestrator_fixed.ts:1)
- Documentation related to workflow orchestration:
    - [`docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/**/*.md`](docs/tracking/phase-1.0-information-extraction-organization-module/features/Workflow Orchestrator/README.md:1)

## Guidelines
- Ensure workflow definitions are valid and adhere to the expected schema.
- When modifying workflows, consider the impact on existing data and processes.
- Clearly document any changes to workflow logic or structure.
- Focus on the high-level coordination of tasks and data flow between processing stages.