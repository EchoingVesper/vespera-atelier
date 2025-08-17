# Implementation Plan: N8n-Inspired Document Processing Pipeline

## Context

This document outlines the implementation plan for refactoring the Vespera Scriptorium document processing pipeline to an n8n-inspired architecture. This plan is based on the architecture detailed in `docs/developers/architecture/RobustDocumentProcessingSystem.md` and follows the completion of the research phase. The goal is to build a modular, robust, and extensible system for story extraction.

## Implementation Phases

The implementation will be broken down into the following phases:

1.  **Core Infrastructure Setup:**
    *   Implement the basic structure for File-Based Queues.
    *   Develop the initial version of the Workflow Orchestrator capable of reading a simple workflow definition and managing queue interactions.
    *   Set up basic Configuration Management for pipeline parameters.

2.  **Basic Pipeline Stages Implementation:**
    *   Implement the initial Ingestion Stage.
    *   Implement a basic Output Stage.
    *   Integrate these stages with the Orchestrator and File-Based Queues.

3.  **Classification and Extraction Stages (including LLM Nodes):**
    *   Develop the Classification Stage.
    *   Develop the Extraction Stage, focusing on integrating LLM Calls as distinct nodes within this stage.
    *   Refine the Orchestrator to handle branching or conditional logic based on Classification results.

4.  **Error Handling and Recovery:**
    *   Implement node-level error handling mechanisms.
    *   Integrate queue-based error management (error queues).
    *   Develop Orchestrator-level recovery logic, including retries and resuming from state.

5.  **Advanced Features and Refinements:**
    *   Enhance Configuration Management for more complex workflow definitions.
    *   Implement monitoring and logging capabilities for queues and stage execution.
    *   Develop initial UI components for monitoring pipeline progress (as outlined in future enhancements).

## Required Code Changes

Significant changes will be required across several parts of the codebase:

*   **New Modules:** Introduction of new modules for the Workflow Orchestrator, File-Based Queues, and potentially base classes/interfaces for Processing Stages and LLM Nodes.
*   **Processing Logic:** The existing document processing logic will need to be refactored and broken down into the new modular Processing Stages (Ingestion, Classification, Extraction, Output).
*   **LLM Integration:** Existing LLM calls will need to be encapsulated within dedicated LLM Node implementations.
*   **Configuration:** A new configuration loading and management system will be needed.
*   **Error Handling:** Implementation of new error handling patterns and recovery logic throughout the pipeline components.
*   **UI Integration:** Updates to the UI to interact with the new Orchestrator for starting/monitoring workflows.

## Integration Points

Key integration points include:

*   **File System:** Interaction with the file system for queue operations.
*   **LLM Client:** The Extraction and Classification stages (specifically LLM nodes) will integrate with the existing LLM Client module.
*   **UI:** The Workflow Orchestrator and potentially queue/stage monitoring components will integrate with the UI module.
*   **Configuration Files:** The Configuration Manager will read from dedicated configuration files.
*   **Existing Modules:** Integration with existing modules like `FileManager`, `Parser`, and `Writer` will need to be redefined based on the new stage-based flow.

## Testing Strategy

A multi-layered testing strategy will be employed:

*   **Unit Tests:** Comprehensive unit tests for individual components (Orchestrator logic, Queue operations, Stage logic, LLM Nodes, Configuration Manager).
*   **Integration Tests:** Tests to verify the interaction between components, such as data flow through queues between stages, and Orchestrator managing stage execution.
*   **End-to-End Tests:** Tests simulating a full document processing workflow from input to output, verifying the overall pipeline functionality and error recovery.
*   **Performance Tests:** Measure the performance of the pipeline, especially queue operations and LLM node execution.

## Dependencies

*   Completion and finalization of the architecture design documented in `docs/developers/architecture/RobustDocumentProcessingSystem.md`.
*   Availability of the LLM Client module and configured LLM providers.
*   File system access for queue operations.
*   Configuration parsing library (if a dedicated one is needed).

This plan provides a roadmap for implementing the new n8n-inspired processing pipeline, focusing on modularity, robustness, and extensibility.
