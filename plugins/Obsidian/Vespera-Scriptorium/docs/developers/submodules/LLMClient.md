# LLMClient Module (Langchain Integrated)

**Role in Processing Pipeline:** Functions as a core processing node responsible for interacting with Large Language Models (LLMs) via the Langchain library.

## Overview

The `LLMClient` module ([`src/LLMClient.ts`](../../../src/LLMClient.ts:1)) provides a standardized interface for interacting with various Large Language Models. It has been refactored to leverage the **Langchain** library, abstracting the complexities of different LLM providers and offering a unified approach to model interaction.

In the processing pipeline, `LLMClient` acts as a crucial node. It receives input data (e.g., text chunks), applies prompt templates if necessary, and then uses configured Langchain chat models (like `ChatOllama` or `ChatOpenAI`) to generate text completions or stream responses. This integration simplifies provider management and allows the system to benefit from Langchain's extensive features and community support.

## Exports

- `LLMClient` class: The main interface for LLM interactions.
- `createLLMClient`: Factory function to instantiate `LLMClient`.
- `ProviderType`: Enum for specifying LLM providers (e.g., `OLLAMA_LANGCHAIN`, `OPENAI_LANGCHAIN`).
- `ProviderConfig`: Interface for configuring providers, including Langchain-specific parameters.
- `CompletionOptions`: Interface for specifying options for LLM requests.
- `StreamingCallback`: Type for handling streamed responses.
- `LLMError`, `ErrorType`: For standardized error handling.
- `PromptTemplateManager` related types and functions for prompt management.

## Pipeline Integration

The `LLMClient` node is central to workflows requiring LLM processing. It typically:
1.  Receives input from a preceding node (e.g., Chunker) via a file-based queue.
2.  Prepares the prompt, potentially using the `PromptTemplateManager`.
3.  Uses the configured Langchain model (e.g., `ChatOllama`, `ChatOpenAI`) to communicate with the LLM backend.
4.  Processes the response (either a full completion or a stream).
5.  Makes the output available to subsequent nodes in the pipeline.

The pipeline orchestrator manages the flow of data to and from the `LLMClient` node.

## Supported LLM Backends (via Langchain)

`LLMClient` now primarily interacts with LLMs through Langchain's model abstractions. This means any LLM provider supported by Langchain can potentially be integrated. The initial implementation focuses on:

### Langchain `ChatOllama`

-   **Integration**: Uses `@langchain/community/chat_models/ollama`.
-   **Functionality**: Enables interaction with an Ollama server for listing models (if supported by a direct Ollama client, not directly via `ChatOllama` instance), generating text completions, and streaming responses.
-   **Configuration (`ProviderConfig`)**:
    -   `type`: `ProviderType.OLLAMA_LANGCHAIN`
    -   `endpoint`: (Required) The network address of the Ollama API (e.g., `http://localhost:11434`).
    -   `modelName`: (Required) The Ollama model to use (e.g., `llama2`, `mistral`).
    -   `temperature`: (Optional) Default temperature for requests.
    -   `timeout`: (Optional) Default request timeout.

### Langchain `ChatOpenAI`

-   **Integration**: Uses `@langchain/openai`.
-   **Functionality**: Enables interaction with OpenAI's API for models like GPT-3.5, GPT-4, etc.
-   **Configuration (`ProviderConfig`)**:
    -   `type`: `ProviderType.OPENAI_LANGCHAIN`
    -   `apiKey`: (Required) Your OpenAI API key.
    -   `modelName`: (Required) The OpenAI model identifier (e.g., `gpt-3.5-turbo`, `gpt-4`).
    -   `temperature`: (Optional) Default temperature for requests.
    -   `timeout`: (Optional) Default request timeout.

Other Langchain providers (e.g., for Anthropic, Hugging Face) can be added by extending `ProviderType` and the `createLangchainModel` method in `LLMClient.ts`.

## Error Handling

`LLMClient` includes robust error handling:
- It catches errors from Langchain operations.
- A `handleLangchainError` method standardizes these errors into the `LLMError` format, categorizing them (e.g., `CONNECTION`, `TIMEOUT`, `PROVIDER_ERROR`).
- Retry logic with exponential backoff is implemented for transient, retryable errors.

## Streaming Details

Streaming responses are handled using the `stream()` method of Langchain's `BaseChatModel`.
- The `LLMClient.streamCompletion` method sets up the stream.
- It provides chunks of data to a `StreamingCallback` function.
- Timeout handling is implemented per-chunk to prevent indefinite hangs.

## Prompt Template System

The `LLMClient` continues to use the `PromptTemplateManager` for dynamic prompt construction. This system is independent of the Langchain model interaction layer but provides the prompts that are then sent to the Langchain models.
- **Features**: Template variables, conditional sections, and template registration remain available.

## Usage Examples

### Basic Completion with Langchain (Ollama)

```typescript
import { createLLMClient, ProviderType, CompletionOptions } from './LLMClient'; // Adjust path

async function main() {
  // Create an LLMClient with Langchain Ollama provider
  const client = createLLMClient({
    type: ProviderType.OLLAMA_LANGCHAIN,
    endpoint: 'http://localhost:11434', // Your Ollama endpoint
    modelName: 'llama2' // The Ollama model you want to use
  });

  const options: CompletionOptions = {
    model: 'llama2', // Corresponds to config.modelName, can be omitted if same
    prompt: "What is the capital of France?",
    temperature: 0.7,
    maxTokens: 100
  };

  try {
    const completion = await client.generateCompletion(options.prompt, options);
    console.log("Completion:", completion);

    // Test connection
    const isConnected = await client.testConnection();
    console.log("Connected:", isConnected);

  } catch (error) {
    console.error("Error:", error);
  }
}

main();
```

### Streaming Completion with Langchain (OpenAI)

```typescript
import { createLLMClient, ProviderType, CompletionOptions, StreamingCallback } from './LLMClient'; // Adjust path

async function main() {
  // Create an LLMClient with Langchain OpenAI provider
  const client = createLLMClient({
    type: ProviderType.OPENAI_LANGCHAIN,
    apiKey: 'YOUR_OPENAI_API_KEY', // Replace with your API key
    modelName: 'gpt-3.5-turbo'
  });

  const options: CompletionOptions = {
    model: 'gpt-3.5-turbo',
    prompt: "Explain quantum computing in simple terms.",
    temperature: 0.5,
    maxTokens: 500,
    stream: true
  };

  const callback: StreamingCallback = (chunk, done) => {
    process.stdout.write(chunk);
    if (done) {
      process.stdout.write('\n[STREAM COMPLETE]\n');
    }
  };

  try {
    await client.streamCompletion(options.prompt, options, callback);
  } catch (error) {
    console.error("Streaming Error:", error);
  }
}

main();
```

### Using Templates (Remains the Same Conceptually)

The template application logic itself doesn't change, but the provider configuration for `createLLMClient` will use Langchain types.

```typescript
import { createLLMClient, ProviderType, PromptTemplate } from './LLMClient'; // Adjust path

async function main() {
  const client = createLLMClient({
    type: ProviderType.OLLAMA_LANGCHAIN, // Using Langchain Ollama
    endpoint: 'http://localhost:11434',
    modelName: 'mistral'
  });

  // Register a template (or use pre-registered ones)
  const summaryTemplate: PromptTemplate = {
    id: 'custom_summary',
    name: 'Custom Summary',
    template: 'Summarize the following text concisely: {{text_to_summarize}}',
    variables: ['text_to_summarize']
  };
  client.registerTemplate(summaryTemplate);

  const longText = "Langchain is a framework for developing applications powered by language models. It enables applications that are data-aware, agentic, and can connect language models to other sources of data and allow language models to interact with their environment..."; // (truncated for brevity)

  const prompt = client.applyTemplate('custom_summary', {
    text_to_summarize: longText
  });

  console.log("Generated Prompt:", prompt);

  try {
    const summary = await client.generateCompletion(prompt, {
      model: 'mistral', // Ensure this matches a model available to your Ollama instance
      temperature: 0.3,
      maxTokens: 150
    });
    console.log("\nSummary:", summary);
  } catch (error) {
    console.error("Error generating summary:", error);
  }
}

main();
```

---
