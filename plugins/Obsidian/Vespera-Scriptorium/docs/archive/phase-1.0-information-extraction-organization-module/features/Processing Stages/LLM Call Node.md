# LLM Call Node

**Architectural Role:** The LLM Call Node is a specialized processing stage responsible for interacting with Large Language Models (LLMs). It receives processed chunks (or other data) and sends them to a configured LLM provider for tasks such as text generation, analysis, or transformation. It handles the communication with the LLM service, including managing API calls, handling responses, and potentially dealing with provider-specific requirements.

**Codebase Comparison Findings:**

The `src/LLMClient.ts` file implements the core functionality for interacting with LLM providers, which aligns well with the role of the LLM Call Node.

*   **Implementation:** The `LLMClient` class provides an interface for generating and streaming completions from configured LLM providers (Ollama and LM Studio). It manages provider-specific configurations and uses internal methods (`withRetry`, `withTimeout`) for handling transient errors and request timeouts. The `processChunk` method in `ProcessingOrchestrator.ts` utilizes the `LLMClient` to send chunk content to the LLM.
*   **Discrepancies/Required Updates:**
    *   Similar to the Processing Node, the "LLM Call Node" is not a distinct, pluggable node type within a workflow framework. Its functionality is primarily represented by the `LLMClient` class and its usage within the `ProcessingOrchestrator`. Formalizing it as a distinct node type would enhance modularity.
    *   While `LLMClient` handles retries and timeouts internally, the architectural decomposition suggests these should be part of dedicated "Error Handling/Recovery" components. There is some overlap and potential for centralizing this logic.
    *   The `LLMClient` focuses on the communication layer. The architectural role of the LLM Call Node might also encompass aspects like prompt construction and response parsing, which are currently handled elsewhere (`createPrompt` in `ProcessingOrchestrator.ts` for prompt building, response parsing logic is not clearly located as a distinct component).

**Checklist for Updates:**

*   [x] Define the "LLM Call Node" as a distinct, potentially configurable node type within the processing workflow framework. (`src/robust-processing/LLMCallNode.ts` created as a specialized `ProcessingNode`).
*   [x] Ensure the LLM Call Node utilizes the `LLMClient` but abstracts the direct client calls within its execution logic. (Implemented in `LLMCallNode.ts` by passing an `LLMClient` instance and using it in the internal processing function).
*   [~] Review and potentially refactor error handling and retry logic to align with dedicated "Error Handling/Recovery" components. (Basic error handling via `LLMClient` and `ProcessingNode` base class; full integration pending Error Handling component. `LLMClient` itself has retry/timeout logic).
*   [~] Clarify the responsibilities of the LLM Call Node regarding prompt building and response parsing, potentially integrating or coordinating with the "Prompt Builder" and "Response Parser" components. (Initial `LLMCallNode` allows prompt to be passed in options or uses chunk content; explicit prompt building/parsing is noted as a future enhancement or responsibility of coordinating components).
*   [~] Document the LLM Call Node's role, configuration, and integration within the workflow. (Initial JSDoc comments added to `LLMCallNode.ts`).