# Prompt Builder Module

**Architectural Role:** The Prompt Builder is responsible for constructing prompts for LLM interactions based on input data (e.g., document chunks, metadata, user instructions) and predefined templates or rules. It ensures that prompts are correctly formatted and include all necessary context and instructions for the LLM to perform the desired task. This module is integrated with Langchain for advanced prompt templating and management.

**Location:** [`src/PromptBuilder.ts`](../../src/PromptBuilder.ts)

## Core Components

### 1. `PromptConfig` Interface
This interface defines the structure for a prompt template configuration. It allows for flexible definition of different types of prompts (string, chat, few-shot) and their specific requirements.

```typescript
export interface PromptConfig {
  id: string; // Unique identifier for the prompt configuration
  name: string; // Human-readable name for the prompt
  description: string; // Description of what the prompt does
  templateType: "string" | "chat"; // Type of prompt: simple string or chat messages
  templateString?: string; // For 'string' type: the template with {variables}
  messages?: { role: "system" | "user" | "ai"; content: string }[]; // For 'chat' type: array of message templates
  inputVariables: string[]; // Array of expected input variable names (e.g., "document_chunk", "user_instructions")
  fewShotExamples?: Record<string, any>[]; // Optional: Array of examples for few-shot prompting
  outputParser?: BaseOutputParser<any>; // Optional: Langchain output parser to include format instructions
}
```

### 2. `PromptBuilderInput` Interface
Defines the structure for data passed to the `buildPrompt` method. It's designed to be flexible.

```typescript
export interface PromptBuilderInput {
  documentChunk?: DocumentChunk; // Optional: A chunk of a document
  userInstructions?: string; // Optional: Specific instructions from the user
  metadata?: Record<string, any>; // Optional: Any other relevant metadata
  [key: string]: any; // Allows for additional dynamic variables
}
```

### 3. `FormattedPrompt` Interface
The output structure of the `buildPrompt` method.

```typescript
export interface FormattedPrompt {
  prompt: string; // The fully formatted prompt string ready for the LLM
  inputVariables: Record<string, any>; // The actual variables used to format the prompt
}
```

### 4. `PromptBuilder` Class
The main class for managing and building prompts.

*   **`constructor(initialConfigs?: PromptConfig[])`**: Initializes the builder, optionally with an array of `PromptConfig` objects.
*   **`registerPromptConfig(config: PromptConfig): void`**: Adds a new prompt configuration or overwrites an existing one.
*   **`getPromptConfig(id: string): PromptConfig | undefined`**: Retrieves a prompt configuration by its ID.
*   **`async buildPrompt(configId: string, input: PromptBuilderInput): Promise<FormattedPrompt>`**:
    *   Takes a `configId` and a `PromptBuilderInput` object.
    *   Retrieves the corresponding `PromptConfig`.
    *   Maps input data to the `inputVariables` defined in the config.
    *   If an `outputParser` is present in the `PromptConfig`, it calls `parser.getFormatInstructions()` and makes these available as `format_instructions` in the template.
    *   Uses Langchain's `PromptTemplate`, `ChatPromptTemplate`, or `FewShotPromptTemplate` to format the prompt.
    *   Returns a `FormattedPrompt` object containing the final prompt string.

## Usage

### Initialization

```typescript
import { PromptBuilder, PromptConfig } from './PromptBuilder'; // Adjust path
import { StringOutputParser } from "@langchain/core/output_parsers";

// Example configurations
const summaryConfig: PromptConfig = {
  id: 'doc_summary',
  name: 'Document Summary Prompt',
  description: 'Generates a summary of a document chunk.',
  templateType: 'string',
  templateString: 'Please summarize the following document chunk:\n\n{document_chunk}\n\nFocus on: {focus_points}\n{format_instructions}',
  inputVariables: ['document_chunk', 'focus_points', 'format_instructions'],
  outputParser: new StringOutputParser(), // For including format instructions
};

const qaConfig: PromptConfig = {
  id: 'doc_qa',
  name: 'Document Q&A Prompt',
  description: 'Answers a question based on a document chunk.',
  templateType: 'chat',
  messages: [
    { role: 'system', content: 'You are a helpful AI assistant. Answer the question based on the provided context. {format_instructions}' },
    { role: 'user', content: 'Context:\n{document_chunk}\n\nQuestion: {user_question}' },
  ],
  inputVariables: ['document_chunk', 'user_question', 'format_instructions'],
  outputParser: new StringOutputParser(),
};

const promptBuilder = new PromptBuilder([summaryConfig, qaConfig]);
```

### Building a Prompt

```typescript
async function generateSummary() {
  const input: PromptBuilderInput = {
    documentChunk: { // Assuming DocumentChunk structure
      id: 'chunk1',
      content: "This is the content of the first document chunk. It discusses various topics.",
      metadata: { /* ... */ } as any,
    },
    focus_points: "key arguments and conclusions",
  };

  try {
    const formattedPrompt = await promptBuilder.buildPrompt('doc_summary', input);
    console.log("Formatted Prompt:", formattedPrompt.prompt);
    // Send formattedPrompt.prompt to the LLM
  } catch (error) {
    console.error("Error building prompt:", error);
  }
}

generateSummary();
```

## Integration with `ProcessingOrchestrator`

The `ProcessingOrchestrator` (located in `src/robust-processing/ProcessingOrchestrator.ts`) now utilizes the `PromptBuilder`.
*   It initializes `PromptBuilder` in its constructor.
*   A default `PromptConfig` named `default_processing_prompt` is registered to ensure backward compatibility and handle basic chunk processing. This default prompt template is designed to replicate the functionality of the previous hardcoded prompt generation logic within the orchestrator.
    ```
    Base Instructions: {base_prompt_instructions}

    --- DOCUMENT INFORMATION ---
    Document: {sourceDocument}
    Chunk: {chunkIndex} of {totalChunks}

    --- PRECEDING CONTEXT ---
    {precedingContext}

    --- FOLLOWING CONTEXT ---
    {followingContext}

    --- CONTENT TO PROCESS ---
    {document_chunk}

    --- INSTRUCTIONS ---
    Process the content above according to the instructions.
    If this is not the first chunk, ensure your response maintains continuity with previous chunks.
    If this is not the last chunk, ensure your response can be continued in subsequent chunks.
    Format Instructions (if any): {format_instructions}
    ```
*   When processing a chunk, the `ProcessingOrchestrator` calls `promptBuilder.buildPrompt('default_processing_prompt', inputForBuilder)` where `inputForBuilder` contains the `documentChunk` and the original `options.prompt` (as `base_prompt_instructions`), along with other necessary metadata.
*   This allows for centralized and more flexible prompt management while maintaining the existing processing flow. More specific `PromptConfig` IDs can be used if different processing tasks require different prompt structures.

## Langchain Features
The `PromptBuilder` leverages several Langchain features:
*   **Prompt Templates**: `PromptTemplate`, `ChatPromptTemplate`, `FewShotPromptTemplate` from `@langchain/core/prompts`.
*   **Message Templates**: `SystemMessagePromptTemplate`, `HumanMessagePromptTemplate` for chat prompts.
*   **Output Parsers**: Integration with `BaseOutputParser` (e.g., `StringOutputParser` from `@langchain/core/output_parsers`) to automatically include formatting instructions in prompts. This is crucial for guiding the LLM to produce output in a structure that the "Response Parser" module can easily handle.

## Deprecated Modules
*   The previous `src/templates/PromptTemplateManager.ts` is now deprecated. All prompt templating and management should be handled through this `PromptBuilder` module.