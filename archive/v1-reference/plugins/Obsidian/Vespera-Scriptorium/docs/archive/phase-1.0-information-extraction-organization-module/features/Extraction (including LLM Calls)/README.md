# Extraction (including LLM Calls)

**Last Updated:** 2025-05-20

This section tracks the progress of comparing the Extraction (including LLM Calls) subcomponents against the codebase.

## Langchain Integration Plan

This section details the plan to deeply integrate `langchain` into the extraction process, enhancing capabilities and streamlining development. The integration will focus on leveraging `langchain`'s core components for model interaction, prompt management, and output processing.

Key areas for `langchain` integration within the Extraction module include:

*   **LLM Client Interface**: Refactoring to use `langchain`'s model I/O abstractions for seamless interaction with various LLM providers.
*   **Prompt Builder**: Transitioning to `langchain`'s powerful prompt templating system for dynamic and structured prompt generation.
*   **Response Parser**: Implementing `langchain`'s output parsers for robust and flexible parsing of LLM responses.
*   **Workflow Orchestration**: Exploring LangChain Expression Language (LCEL) for more complex extraction chains and workflows.

Each subcomponent's integration plan and progress will be detailed in its respective document.

## Subcomponents

*   [Extraction Processor](./Extraction%20Processor.md) - **Status:** To Do
*   [Extraction Rules/Templates](./Extraction%20Rules%20Templates.md) - **Status:** To Do
*   [LLM Client Interface](./LLM%20Client%20Interface.md) - **Status:** Pending Langchain Integration
*   [LLM Provider Adapters](./LLM%20Provider%20Adapters.md) - **Status:** To Do
*   [Prompt Builder](./Prompt%20Builder.md) - **Status:** ✅ Implemented and Integrated with Langchain
*   [Response Parser](./Response%20Parser.md) - **Status:** Pending Langchain Integration
*   [Content Chunking](./Content%20Chunking.md) - **Status:** To Do
*   [Context Window Management](./Context%20Window%20Management.md) - **Status:** To Do