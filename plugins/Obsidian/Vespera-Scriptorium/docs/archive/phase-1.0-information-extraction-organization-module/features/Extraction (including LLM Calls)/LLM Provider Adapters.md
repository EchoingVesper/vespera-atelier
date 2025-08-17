# LLM Provider Adapters

**Architectural Role:** LLM Provider Adapters are concrete implementations of the LLM Client Interface for specific LLM providers (e.g., Ollama, LM Studio, OpenAI). They translate the standardized requests from the LLM Client Interface into provider-specific API calls or commands and handle the provider's responses, converting them back into a standardized format.

**Codebase Comparison Findings:**

The `src/providers/OllamaProvider.ts` and `src/providers/LMStudioProvider.ts` files implement adapters for the Ollama and LM Studio LLM providers, respectively.

*   **Implementation:** The `OllamaProvider` and `LMStudioProvider` classes implement the `LLMProvider` interface, providing concrete implementations for interacting with these specific LLM services. They handle connection details, model listing, completion generation (including streaming), and token usage estimation for their respective providers.
*   **Discrepancies/Required Updates:**
    *   The existing adapters cover Ollama and LM Studio. Adapters for other potential LLM providers (e.g., OpenAI, local models via different APIs) would need to be implemented to extend the system's compatibility.
    *   As the `LLMProvider` interface evolves to support more features (e.g., function calling, vision), the existing adapters will need to be updated to implement these new methods.
    *   Standardized error handling within the adapters, mapping provider-specific errors to the generic `LLMError` type, is important and should be consistently applied.

**Checklist for Updates:**

*   [ ] Implement adapters for additional LLM providers as needed.
*   [ ] Update existing adapters to support new methods or features added to the `LLMProvider` interface.
*   [ ] Ensure consistent and comprehensive mapping of provider-specific errors to the standardized `LLMError` type.
*   [ ] Document each LLM Provider Adapter, its supported features, configuration options, and any provider-specific considerations.