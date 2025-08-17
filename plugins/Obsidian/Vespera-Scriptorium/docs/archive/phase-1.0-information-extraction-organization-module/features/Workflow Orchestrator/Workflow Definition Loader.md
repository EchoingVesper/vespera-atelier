# Workflow Definition Loader

- **Status**: In Progress
- **Last Updated**: May 20, 2025
- **Architectural Role**: Responsible for loading and parsing workflow definitions from various sources.

## Development Log

- **May 20, 2025**: Basic class structure `WorkflowDefinitionLoader.ts` created in `src/workflow-orchestrator/`. Status set to Scaffolded.
- **May 20, 2025**: Implemented core logic for loading and parsing JSON/YAML workflow definitions. Added basic validation and custom error handling. Updated `loadDefinition` method signature to accept `filePath` and `fileContent`. Added `js-yaml` dependency.

## Checklist for Updates

- [x] Design and implement the `WorkflowDefinitionLoader` class. (Core logic implemented)
- [x] Define interfaces and data structures for workflow definitions. (Utilizing existing types from `src/workflow-orchestrator/types.ts`)
- [x] Implement logic to load definitions from JSON, YAML, or other formats. (JSON and YAML implemented)
- [x] Add validation for loaded workflow definitions. (Basic validation implemented)
- [x] Implement error handling for loading and parsing issues. (Custom error classes and handling implemented)
- [ ] Write unit tests for various definition sources and formats.
- [ ] Document the component's API and usage. (Method signature updated in code comments)