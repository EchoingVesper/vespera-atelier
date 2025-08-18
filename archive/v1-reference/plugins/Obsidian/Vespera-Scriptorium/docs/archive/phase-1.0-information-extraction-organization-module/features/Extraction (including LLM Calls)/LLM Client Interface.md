# LLM Client Interface

**Architectural Role:** The LLM Client Interface provides a standardized way for other components in the system to interact with Large Language Models, abstracting away the details of specific LLM providers. It defines the common operations (e.g., generating completions, streaming responses) that can be performed, regardless of the underlying LLM service.

**Codebase Comparison Findings:**

The `src/LLMClient.ts` file implements the `LLMClient` class and the `LLMProvider` interface, which together form the LLM Client Interface.

*   **Implementation:** The `LLMClient` class acts as the main interface, routing requests to the appropriate `LLMProvider` based on the configuration. The `LLMProvider` interface defines the contract for different LLM integrations (Ollama, LM Studio). This aligns well with the architectural role.
*   **Discrepancies/Required Updates:**
    *   The current `LLMProvider` interface defines core methods (`listModels`, `generateCompletion`, `streamCompletion`, `getTokenUsage`, `loadModel`, `isModelReady`, `testConnection`), which cover the basic interactions. However, as LLM capabilities expand (e.g., function calling, vision), the interface may need to be extended.
    *   Error handling is partially standardized through the `LLMError` interface and `ErrorType` enum, but provider-specific error details might need more structured handling.
    *   The interface is primarily focused on text completion. Support for other LLM tasks (e.g., embeddings, chat) might require additions to the interface.

## Langchain Integration Plan

Integrating `langchain` into the LLM Client Interface will involve leveraging its robust model I/O capabilities to standardize and simplify interactions with various LLM providers. This will replace or augment parts of the custom `LLMProvider` interface.

**Key Integration Points:**

*   **Model Abstraction**: Utilize `langchain`'s base LLM and ChatModel classes (e.g., `BaseLLM`, `BaseChatModel`) as the foundation for interacting with different providers. This provides a consistent API (e.g., `invoke`, `stream`, `batch`) across all supported models.
*   **Provider-Specific Wrappers**: Employ `langchain`'s existing integrations for providers like Ollama, OpenAI, Anthropic, etc. (e.g., `ChatOllama`, `ChatOpenAI`). This reduces the need for custom provider adapters (`LLMProvider` implementations) and ensures access to the latest features and optimizations from `langchain`.
*   **Configuration**: Adapt the configuration management to specify `langchain` model identifiers and their respective parameters (e.g., model name, temperature, API keys).
*   **Error Handling**: Leverage `langchain`'s error handling mechanisms, which often provide more detailed and standardized error information from LLM providers.
*   **Feature Support**: Inherit support for advanced features like function calling, tool usage, and structured output directly from `langchain`'s model interfaces, reducing the need to extend the custom interface for these.

**Impact on Current Implementation:**

*   The custom `LLMProvider` interface has been effectively deprecated. The `LLMClient` now directly utilizes `langchain`'s `BaseChatModel` and its provider-specific implementations (e.g., `ChatOllama`, `ChatOpenAI`).
*   The `LLMClient` class now acts as a factory for `langchain` model instances (`BaseChatModel`), configured based on system settings. It wraps the `invoke` and `stream` calls to these Langchain models, providing a consistent interface to the rest of the application.
*   Methods like `generateCompletion` and `streamCompletion` in `LLMClient` now map directly to `langchain`'s `invoke` and `stream` methods on the configured `BaseChatModel`.
*   The `ProviderConfig` interface has been updated to include `modelName` (for Langchain model identifiers like `gpt-3.5-turbo` or `ollama/llama2`) and provider-specific details like `apiKey` or `endpoint`.
*   The `ProviderType` enum has been updated with `OLLAMA_LANGCHAIN` and `OPENAI_LANGCHAIN`.
*   Error handling has been adapted to catch errors from Langchain and map them to the existing `LLMError` structure.
*   Methods like `loadModel`, `isModelReady`, and the original `LLMProvider` interface have been removed as Langchain handles model management. `getTokenUsage` has a placeholder implementation as this is typically part of Langchain's response metadata.

**Checklist for Updates (Langchain Integration):**

*   [x] **Langchain**: Define strategy for replacing or augmenting the custom `LLMProvider` interface with `langchain`'s model abstractions (e.g., `BaseLLM`, `BaseChatModel`). (Strategy: Replaced with direct `BaseChatModel` usage in `LLMClient`)
*   [x] **Langchain**: Implement wrappers or direct usage of `langchain`'s provider-specific classes (e.g., `ChatOllama`, `ChatOpenAI`, `ChatAnthropic`) for configured LLMs. (Implemented for `ChatOllama` and `ChatOpenAI` in `LLMClient.createLangchainModel`)
*   [x] **Langchain**: Adapt the system's configuration management to specify `langchain` model identifiers, provider details, and their respective parameters (e.g., model name, temperature, API keys). (Done via updates to `ProviderConfig` and `ProviderType`)
*   [x] **Langchain**: Integrate `langchain`'s error handling mechanisms, ensuring that errors from LLM providers are caught, standardized, and propagated appropriately. (Implemented via `handleLangchainError` method in `LLMClient`)
*   [ ] **Langchain**: Verify and document how advanced LLM features (e.g., function calling, tool usage, structured output) will be accessed and utilized through `langchain`'s model interfaces. (Further investigation needed for full feature parity/enhancement)
*   [x] **Langchain**: Refactor the `LLMClient` class to act as a factory, registry, or manager for `langchain` model instances, based on the system's configuration. (`LLMClient` constructor and `createLangchainModel` method fulfill this)
*   [x] **Langchain**: Map existing `LLMClient` methods (e.g., `generateCompletion`, `streamCompletion`) to their `langchain` equivalents (e.g., `invoke`, `stream`, `batch`). (Done for `generateCompletion` and `streamCompletion`)
*   [x] **Langchain**: Test the integrated LLM client with various `langchain`-supported models and providers. (Unit tests created in `tests/unit/LLMClient.langchain.spec.ts` with mocks for `ChatOllama` and `ChatOpenAI`)
*   [ ] Document the updated LLM Client Interface, detailing its architecture with `langchain`, configuration, and how to use its methods for LLM interactions. (This document is being updated. Further updates to `docs/developers/modules/LLMClient.md` are pending)

## Technical Implementation Details (Post-Langchain Integration)

The `LLMClient` ([`src/LLMClient.ts`](../../../../src/LLMClient.ts:1)) has been refactored to integrate `langchain`.

*   **Core Abstraction**: It now uses `BaseChatModel` from `@langchain/core` as the primary interface for interacting with LLMs.
*   **Provider Instantiation**: The `createLangchainModel` private method within `LLMClient` is responsible for instantiating specific Langchain provider models (e.g., `ChatOllama` from `@langchain/community/chat_models/ollama`, `ChatOpenAI` from `@langchain/openai`) based on the `ProviderConfig`.
    *   `ProviderType` enum now includes `OLLAMA_LANGCHAIN` and `OPENAI_LANGCHAIN`.
    *   `ProviderConfig` has been updated to include `modelName` (Langchain model ID), `apiKey` (for services like OpenAI), and uses the existing `endpoint` for services like Ollama.
*   **Key Method Mapping**:
    *   `generateCompletion(prompt, options)`: Internally calls `this.langchainModel.invoke(new HumanMessage(prompt))` with appropriate options bound to the model.
    *   `streamCompletion(prompt, options, callback)`: Internally calls `this.langchainModel.stream(new HumanMessage(prompt))` and processes the async iterable stream, invoking the callback with chunks.
*   **Error Handling**: A `handleLangchainError` method has been added to convert errors from Langchain operations into the system's standard `LLMError` format.
*   **Removed Components**: The previous `LLMProvider` interface and its direct implementations (`OllamaProvider`, `LMStudioProvider`) are no longer used by `LLMClient` for Langchain-based providers. The `ensureModelReady` logic has also been removed as Langchain models typically handle their readiness internally or upon instantiation.
*   **Configuration**:
    *   `ProviderType` now includes `OLLAMA_LANGCHAIN`, `OPENAI_LANGCHAIN`.
    *   `ProviderConfig` expects `modelName` for the Langchain model identifier (e.g., "llama2" for Ollama, "gpt-3.5-turbo" for OpenAI). It also uses `endpoint` for Ollama's base URL and `apiKey` for OpenAI.
*   **Unit Tests**: New unit tests specific to the Langchain integration are located in [`tests/unit/LLMClient.langchain.spec.ts`](../../../../tests/unit/LLMClient.langchain.spec.ts:1), mocking Langchain's `ChatOllama` and `ChatOpenAI` models.