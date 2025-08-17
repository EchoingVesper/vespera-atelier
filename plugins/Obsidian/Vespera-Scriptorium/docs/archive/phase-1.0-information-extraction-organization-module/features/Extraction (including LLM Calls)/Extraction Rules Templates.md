# Extraction Rules/Templates

**Architectural Role:** Extraction Rules/Templates define the specific instructions and structure for extracting information from document content. This can include prompt templates for LLMs, regex patterns, or other rules that guide the extraction process and specify the desired output format.

**Codebase Comparison Findings:**

The `src/templates/PromptTemplateManager.ts` file implements functionality for managing prompt templates, which is relevant to Extraction Rules/Templates, specifically for LLM-based extraction.

*   **Implementation:** The `PromptTemplateManager` class allows for registering, retrieving, and applying prompt templates with variable substitution. This provides a mechanism for defining reusable prompts for LLM interactions, which can be used for extraction.
*   **Discrepancies/Required Updates:**
    *   The current implementation focuses solely on prompt templates for LLM calls. The broader concept of "Extraction Rules/Templates" could encompass other methods like regex patterns or structured extraction rules, which are not explicitly managed by a dedicated component.
    *   There is no centralized component for managing all types of extraction rules and templates beyond LLM prompts.
    *   Integration with an "Extraction Processor" to apply these rules/templates is needed.

**Checklist for Updates:**

*   [ ] Design a format or structure for defining various types of extraction rules and templates (including but not limited to LLM prompts).
*   [ ] Design and implement a dedicated module/component for managing "Extraction Rules/Templates".
*   [ ] Consider how these rules/templates will be loaded and made available to the Extraction Processor.
*   [ ] Document the format for extraction rules/templates and the implementation of their management.