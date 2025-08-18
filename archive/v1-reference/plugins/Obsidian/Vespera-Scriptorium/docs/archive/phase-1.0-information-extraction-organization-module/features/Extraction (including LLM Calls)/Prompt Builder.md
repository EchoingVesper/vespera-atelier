# Prompt Builder

**Architectural Role:** The Prompt Builder is responsible for constructing prompts for LLM interactions based on input data (e.g., document chunks, metadata, user instructions) and predefined templates or rules. It ensures that prompts are correctly formatted and include all necessary context and instructions for the LLM to perform the desired task.

**Codebase Comparison Findings:**

The `src/templates/PromptTemplateManager.ts` file implements functionality for managing prompt templates, and the `createPrompt` method in `src/robust-processing/ProcessingOrchestrator.ts` uses this to build prompts for chunk processing.

*   **Implementation:** The `PromptTemplateManager` provides the ability to define and apply templates. The `createPrompt` method in `ProcessingOrchestrator` combines a base prompt with chunk content to create the final prompt sent to the LLM.
*   **Discrepancies/Required Updates:**
    *   A dedicated "Prompt Builder" component that encapsulates all prompt construction logic, potentially handling more complex prompt building scenarios (e.g., few-shot examples, dynamic context inclusion), is not explicitly defined.
    *   The prompt building logic is currently split between `PromptTemplateManager` (template management) and `ProcessingOrchestrator` (template application with chunk content). Consolidating this into a dedicated component would improve modularity.
    *   Mechanisms for dynamically selecting or modifying prompt templates based on workflow context or document characteristics are not clearly present.

## Langchain Integration Plan

Integrating `langchain` into the Prompt Builder will involve adopting its sophisticated prompt templating and management features. This will replace or significantly enhance the current `PromptTemplateManager` and the prompt creation logic in `ProcessingOrchestrator`.

**Key Integration Points:**

*   **Prompt Templates**: Utilize `langchain`'s `PromptTemplate` for basic string prompts and `ChatPromptTemplate` for structured chat messages (system, human, AI). This allows for clear separation of roles and easier construction of complex conversational prompts.
*   **Input Variables**: Define and use input variables within `langchain` templates (e.g., `{document_chunk}`, `{user_instructions}`, `{metadata}`) to dynamically insert data into prompts.
*   **Few-Shot Learning**: Leverage `FewShotPromptTemplate` or `FewShotChatMessagePromptTemplate` to easily incorporate examples into prompts, improving LLM performance on specific tasks.
*   **Partial Prompts**: Use partial formatting to pre-fill parts of a prompt template, simplifying the creation of specialized prompts from a common base.
*   **Composition**: Combine multiple prompt templates or components using LangChain Expression Language (LCEL) or by composing template objects, allowing for modular and reusable prompt structures.
*   **Example Selectors**: For few-shot prompting, use `langchain`'s example selectors (e.g., `SemanticSimilarityExampleSelector`) to dynamically choose the most relevant examples based on the current input.
*   **Output Parsers (in conjunction with prompts)**: While primarily part of the Response Parser, prompts can be designed to instruct the LLM to produce output in a specific format that `langchain`'s output parsers can then easily process (e.g., JSON, CSV).

**Impact on Current Implementation:**

*   The `src/templates/PromptTemplateManager.ts` will likely be deprecated or refactored to manage `langchain` prompt template configurations rather than custom template strings.
*   The `createPrompt` method in `src/robust-processing/ProcessingOrchestrator.ts` will be replaced by logic that instantiates and formats `langchain` prompt templates.
*   A dedicated "Prompt Builder" component will be more clearly realized as a module that centralizes the creation and management of `langchain` prompt objects.

**Checklist for Updates (Langchain Integration):**

*   [x] **Langchain**: Evaluate and select appropriate `langchain` prompt template types (`PromptTemplate`, `ChatPromptTemplate`, `FewShotPromptTemplate`, etc.) for different extraction scenarios. (Utilized `PromptTemplate`, `ChatPromptTemplate`, `FewShotPromptTemplate` from `@langchain/core/prompts`)
*   [x] **Langchain**: Design and implement the structure for managing `langchain` prompt templates, potentially refactoring or replacing `src/templates/PromptTemplateManager.ts`. (New `PromptBuilder` class in `src/PromptBuilder.ts` manages `PromptConfig` objects. `src/templates/PromptTemplateManager.ts` has been deprecated.)
*   [x] **Langchain**: Define input variables for `langchain` templates to handle dynamic data like document chunks, metadata, and user instructions. (Handled via `PromptBuilderInput` interface and dynamic mapping in `PromptBuilder.buildPrompt`.)
*   [x] **Langchain**: Implement logic to instantiate and format `langchain` prompt templates with the necessary input variables, replacing the current `createPrompt` logic in `ProcessingOrchestrator`. (`ProcessingOrchestrator.processChunk` now uses `PromptBuilder.buildPrompt`. The old `createPrompt` method in `ProcessingOrchestrator` has been removed.)
*   [x] **Langchain**: Explore and implement strategies for few-shot prompting using `FewShotPromptTemplate` and appropriate example selectors (e.g., `SemanticSimilarityExampleSelector`) if beneficial. (Basic `FewShotPromptTemplate` support added in `PromptBuilder`.)
*   [ ] **Langchain**: Investigate the use of partial prompts for creating specialized prompts from base templates. (Further investigation can be done as needed.)
*   [ ] **Langchain**: Consider how prompt composition (e.g., using LCEL or direct template object composition) can be used for modular and reusable prompt structures. (Further investigation can be done as needed.)
*   [x] **Langchain**: Ensure prompts are designed to instruct LLMs for specific output formats that align with `langchain` output parsers (e.g., including `parser.get_format_instructions()`). (`PromptBuilder` includes logic to add `format_instructions` if an `outputParser` is provided in `PromptConfig`.)
*   [x] **Langchain**: Create a dedicated "Prompt Builder" module/class that centralizes the creation, management, and formatting of `langchain` prompt objects. (Implemented as `src/PromptBuilder.ts`.)
*   [x] **Langchain**: Test the `langchain`-based prompt building with various input data and LLM models. (Initial unit tests created in `tests/unit/PromptBuilder.spec.ts`.)
*   [ ] Document the updated Prompt Builder, its use of `langchain` templates, configuration, and how to create and manage prompts. (This document serves as the primary update. Further detailed module documentation can be added to `docs/modules/PromptBuilder.md`.)

## Technical Implementation Details (Post-Langchain Integration)

The `PromptBuilder` module is implemented in [`src/PromptBuilder.ts`](../../../../src/PromptBuilder.ts).

**Core Components:**

*   **`PromptConfig` Interface**: Defines the structure for a prompt template configuration, including:
    *   `id`, `name`, `description`
    *   `templateType`: `"string"` or `"chat"`
    *   `templateString` (for string prompts)
    *   `messages` (for chat prompts, an array of objects with `role` and `content`)
    *   `inputVariables`: An array of strings listing expected input variables.
    *   `fewShotExamples` (optional): An array of example objects for few-shot prompting.
    *   `outputParser` (optional): An instance of a Langchain `BaseOutputParser` to automatically include formatting instructions.
*   **`PromptBuilderInput` Interface**: Defines the expected input structure when building a prompt. It can include `documentChunk`, `userInstructions`, `metadata`, and other dynamic variables.
*   **`FormattedPrompt` Interface**: Defines the output of the `buildPrompt` method, containing the formatted `prompt` (string) and the `inputVariables` used.
*   **`PromptBuilder` Class**:
    *   Manages a collection of `PromptConfig` objects.
    *   `registerPromptConfig(config: PromptConfig)`: Adds or overwrites a prompt configuration.
    *   `getPromptConfig(id: string)`: Retrieves a prompt configuration by its ID.
    *   `buildPrompt(configId: string, input: PromptBuilderInput)`:
        *   Retrieves the specified `PromptConfig`.
        *   Dynamically populates template variables from the `PromptBuilderInput`.
        *   If an `outputParser` is defined in the config, its `getFormatInstructions()` method is called, and the result is added to the template variables as `format_instructions`.
        *   Constructs the appropriate Langchain prompt object (`PromptTemplate`, `ChatPromptTemplate`, or `FewShotPromptTemplate`).
        *   Formats the prompt using the input variables.
        *   Returns a `FormattedPrompt` object containing the final prompt string and the variables used.

**Integration with `ProcessingOrchestrator`:**

*   The `ProcessingOrchestrator` (in [`src/robust-processing/ProcessingOrchestrator.ts`](../../../../src/robust-processing/ProcessingOrchestrator.ts)) now initializes an instance of `PromptBuilder`.
*   A default `PromptConfig` (`default_processing_prompt`) is registered in the `ProcessingOrchestrator`'s constructor to maintain basic functionality. This default config replicates the structure of the old hardcoded prompt.
*   The `processChunk` method in `ProcessingOrchestrator` now calls `this.promptBuilder.buildPrompt()` to generate prompts, passing necessary data from the `DocumentChunk` and `ProcessingOptions`.
*   The old `createPrompt` method within `ProcessingOrchestrator` has been removed.

**Key Langchain Features Used:**

*   `@langchain/core/prompts`: `PromptTemplate`, `ChatPromptTemplate`, `FewShotPromptTemplate`, `HumanMessagePromptTemplate`, `SystemMessagePromptTemplate`.
*   `@langchain/core/output_parsers`: `BaseOutputParser` (and specific implementations like `StringOutputParser` in tests) for format instructions.

**Deprecated Modules:**

*   [`src/templates/PromptTemplateManager.ts`](../../../../src/templates/PromptTemplateManager.ts) is now deprecated. Its functionality is superseded by the new `PromptBuilder`.

**Unit Tests:**

*   Basic unit tests for the `PromptBuilder` are located in [`tests/unit/PromptBuilder.spec.ts`](../../../../tests/unit/PromptBuilder.spec.ts). These tests cover:
    *   Registering prompt configurations.
    *   Building string, chat, and few-shot prompts.
    *   Handling of `format_instructions` via `outputParser`.
    *   Error handling for missing configurations.
    *   Graceful handling of missing optional input variables.