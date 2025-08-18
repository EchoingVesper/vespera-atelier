# Response Parser

**Architectural Role:** The Response Parser is responsible for processing and interpreting the output received from LLMs or other extraction mechanisms. It takes the raw response data and transforms it into a structured format that can be easily used by subsequent processing stages or for generating the final output. This is particularly important when LLMs return information in a less structured format.

**Codebase Comparison Findings:**

Based on the examination of the `src/` directory and `ProcessingOrchestrator.ts`, there is no explicit implementation of a dedicated "Response Parser" component.

*   **Implementation:** The `processChunk` method in `ProcessingOrchestrator` receives the raw string output from the LLM (`processedContent`). There is no clear, dedicated logic for parsing or structuring this raw string into a more usable format based on the expected output of an extraction task.
*   **Discrepancies/Required Updates:**
    *   The "Response Parser" component is not implemented in the current codebase.
    *   A centralized and extensible mechanism for parsing and structuring LLM responses (or other extraction outputs) is missing.
    *   The ability to handle different response formats (e.g., JSON, structured text) and validate the parsed data is not present.

## Langchain Integration Plan

Integrating `langchain` into the Response Parser component will involve utilizing its extensive suite of output parsers to transform raw LLM responses into structured, usable data. This will be a new implementation, as a dedicated Response Parser does not currently exist.

**Key Integration Points:**

*   **Structured Output Parsers**: Employ `langchain`'s `StructuredOutputParser` to define a schema for the desired output and parse LLM responses that conform to this schema. This is useful when you can instruct the LLM to generate output in a specific format with named fields.
*   **Pydantic (JSON) Output Parser**: Use the `PydanticOutputParser` (or `JsonOutputParser`) when the LLM is expected to return JSON. This parser leverages Pydantic models to validate and parse the JSON output, ensuring data integrity and providing typed objects.
*   **Retry and Correction Parsers**: Implement `RetryWithErrorOutputParser` or `RetryOutputParser` to handle cases where the LLM fails to produce output in the correct format. These parsers can re-prompt the LLM with the error and instructions for correction.
*   **List Parsers**: Utilize parsers like `CommaSeparatedListOutputParser` or `MarkdownListOutputParser` when the LLM is expected to return lists of items.
*   **Custom Output Parsers**: For highly specific or complex parsing needs, create custom output parsers by extending `langchain`'s `BaseOutputParser` class.
*   **Combining with Prompts**: Design prompts (using `langchain`'s templating) to explicitly instruct the LLM on the desired output format, making it easier for the chosen output parser to process the response. The `get_format_instructions` method of many parsers can be directly included in prompts.
*   **Streaming Support**: Ensure that parsing logic can handle streamed responses where applicable, potentially parsing chunks of data as they arrive.

**Impact on Current Implementation:**

*   This will be a new component. The `processChunk` method in `ProcessingOrchestrator` will delegate raw LLM output to this new Response Parser module.
*   The Response Parser will be responsible for taking the string output from the `langchain` model (obtained via the LLM Client Interface) and converting it into a structured JavaScript/TypeScript object or a Pydantic model instance.

**Checklist for Updates (Langchain Integration):**

*   [ ] **Langchain**: Design and implement a dedicated module/class for the "Response Parser" that leverages `langchain` output parsers.
*   [ ] **Langchain**: Evaluate and select appropriate `langchain` output parser types (e.g., `StructuredOutputParser`, `PydanticOutputParser`, `JsonOutputParser`, `CommaSeparatedListOutputParser`) for different extraction tasks and expected LLM response formats.
*   [ ] **Langchain**: For `PydanticOutputParser` or `JsonOutputParser`, define Pydantic models or JSON schemas that represent the desired structured output.
*   [ ] **Langchain**: Implement logic to instantiate and use the chosen `langchain` output parsers to process raw LLM responses received from the `langchain`-integrated LLM Client Interface.
*   [ ] **Langchain**: Integrate `RetryWithErrorOutputParser` or `RetryOutputParser` to handle LLM responses that are not in the expected format, allowing for re-prompting with correction instructions.
*   [ ] **Langchain**: Ensure that prompts (created by the Prompt Builder) include format instructions obtained from `langchain` parsers (e.g., `parser.get_format_instructions()`) to guide the LLM.
*   [ ] **Langchain**: Develop custom output parsers (by extending `BaseOutputParser`) if highly specific or complex parsing logic is required beyond standard `langchain` parsers.
*   [ ] **Langchain**: Implement mechanisms for validating parsed data, potentially using Pydantic model validation or custom validation logic.
*   [ ] **Langchain**: Ensure the Response Parser can handle streamed LLM responses if applicable, parsing data as it arrives.
*   [ ] **Langchain**: Integrate the Response Parser with the `ProcessingOrchestrator` (or equivalent), so that `processChunk` delegates raw LLM output to this parser and receives structured data back.
*   [ ] **Langchain**: Test the `langchain`-based response parsing with various LLM outputs and expected structures.
*   [ ] Document the Response Parser's architecture with `langchain`, its supported parsing strategies, how to configure it for different output types, and its integration points.