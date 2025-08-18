# Extraction Processor

**Architectural Role:** The Extraction Processor is responsible for applying extraction logic to document content, often utilizing LLMs. It takes processed chunks or document sections as input and extracts specific information based on predefined rules, templates, or prompts. This extracted information can then be structured and passed to subsequent stages or used for output generation.

**Codebase Comparison Findings:**

Based on the examination of the `src/` directory and `ProcessingOrchestrator.ts`, the `processChunk` method within `ProcessingOrchestrator` performs a role similar to an Extraction Processor when the processing involves an LLM call for extraction.

*   **Implementation:** The `processChunk` method sends chunk content to the LLM via the `LLMClient` with a prompt. The prompt likely guides the LLM to perform extraction. The result of the LLM call is treated as the processed content for that chunk.
*   **Discrepancies/Required Updates:**
    *   The "Extraction Processor" is not a distinct, generalized component. The extraction logic is embedded within the chunk processing logic in `ProcessingOrchestrator`.
    *   There is no clear separation between the generic "Processing Node" and a specialized "Extraction Processor" that applies extraction-specific logic.
    *   Mechanisms for applying different extraction rules or templates (beyond just the prompt) are not explicitly defined within a dedicated component.
    *   Parsing of the LLM response to structure the extracted data is not clearly handled by a dedicated component.

**Checklist for Updates:**

*   [ ] Design and implement a dedicated module/class for the "Extraction Processor".
*   [ ] Define how the Extraction Processor receives input (processed chunks or content).
*   [ ] Implement logic for applying extraction rules, templates, or prompts, potentially utilizing the "LLM Client Interface".
*   [ ] Define the output format for extracted data.
*   [ ] Integrate the Extraction Processor with the workflow and potentially the "Response Parser".
*   [ ] Document the Extraction Processor's role, configuration, and implementation details.