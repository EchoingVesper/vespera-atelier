# LLMClient Module

**Responsibility:** Orchestrates communication with local LLMs (Ollama/LM Studio) via CLI or HTTP.

## Exports

- LLM invocation utilities
- Streaming and aggregation helpers
- Provider implementations for different LLM backends
- Prompt template integration

## Supported LLM Backends

### Ollama

The Ollama provider communicates with the Ollama API to:
- List available models via the `/api/tags` endpoint
- Generate completions via the `/api/generate` endpoint
- Stream completions using the same endpoint with streaming enabled
- Count tokens using the `/api/tokenize` endpoint

Configuration options:
- `endpoint`: Ollama API endpoint (default: http://localhost:11434)
- `timeout`: Request timeout in milliseconds (default: 30000)
- `maxRetries`: Maximum number of retry attempts (default: 3)

### LM Studio

The LM Studio provider communicates with the LM Studio API (which follows the OpenAI API format) to:
- List available models via the `/v1/models` endpoint
- Generate completions via the `/v1/completions` endpoint
- Stream completions using the same endpoint with streaming enabled
- Estimate token usage based on API responses or text length

Configuration options:
- `endpoint`: LM Studio API endpoint (default: http://localhost:1234/v1)
- `timeout`: Request timeout in milliseconds (default: 30000)
- `maxRetries`: Maximum number of retry attempts (default: 3)

## Error Handling

The LLMClient module provides robust error handling with the following features:

- **Error Types**: Errors are categorized into specific types:
  - `CONNECTION`: Connection issues with the LLM provider
  - `TIMEOUT`: Request timeout
  - `RATE_LIMIT`: Rate limiting by the provider
  - `INVALID_REQUEST`: Invalid request parameters
  - `PROVIDER_ERROR`: Internal provider errors
  - `UNKNOWN`: Unclassified errors

- **Retry Logic**: Automatic retry for transient errors with exponential backoff
  - Configurable maximum retry attempts
  - Only retries errors marked as `retryable`

- **Timeout Handling**: Configurable request timeouts with automatic cancellation

## Streaming Details

The streaming implementation:
- Uses the Fetch API's streaming capabilities
- Processes JSON chunks from the stream
- Provides real-time updates via callback function
- Handles partial JSON objects in the stream buffer
- Properly signals completion when the stream ends

## Prompt Template System

The LLMClient integrates with the PromptTemplateManager to provide a flexible template system for generating prompts:

- **Template Variables**: Substitute variables in templates using `{{variable}}` syntax
- **Conditional Sections**: Include or exclude content based on variable values using `{{#if variable}}...{{else}}...{{/if}}` syntax
- **Default Templates**: Includes pre-defined templates for common tasks like summarization and question answering
- **Custom Templates**: Register your own templates with custom variables and logic

The LLMClient provides methods to:
- Apply templates: `client.applyTemplate(templateId, variables)`
- Register templates: `client.registerTemplate(template)`
- Get templates: `client.getTemplate(id)` and `client.getAllTemplates()`

## Integration with Module Architecture

The LLMClient module serves as a central component in the Vespera-Scriptorium architecture:

- **Parser Integration**: Works with the Parser module to process and understand content
- **Chunker Integration**: Processes chunks of content to stay within model context limits
- **Writer Integration**: Generates content that can be formatted and saved by the Writer module
- **UI Integration**: Provides feedback on LLM operations through the UI components

## Usage Examples

### Basic Completion

```typescript
import { createLLMClient, ProviderType } from './LLMClient';

// Create an LLMClient with Ollama provider
const client = createLLMClient({
  type: ProviderType.OLLAMA,
  endpoint: 'http://localhost:11434'
});

// Generate a completion
const completion = await client.generateCompletion(
  "What is the capital of France?",
  {
    model: "llama2",
    temperature: 0.7,
    maxTokens: 100
  }
);

console.log(completion);
```

### Streaming Completion

```typescript
import { createLLMClient, ProviderType } from './LLMClient';

// Create an LLMClient with LM Studio provider
const client = createLLMClient({
  type: ProviderType.LM_STUDIO,
  endpoint: 'http://localhost:1234/v1'
});

// Stream a completion
await client.streamCompletion(
  "Explain quantum computing in simple terms.",
  {
    model: "mistral-7b-instruct",
    temperature: 0.5,
    maxTokens: 500,
    stream: true
  },
  (chunk, done) => {
    process.stdout.write(chunk);
    if (done) {
      process.stdout.write('\n');
    }
  }
);
```

### Using Templates

```typescript
import { createLLMClient, ProviderType } from './LLMClient';

// Create an LLMClient
const client = createLLMClient({
  type: ProviderType.OLLAMA
});

// Apply a template
const prompt = client.applyTemplate('general_summary', {
  content: 'Long text to summarize...',
  max_length: '100',
  focus_points: 'key concepts and conclusions'
});

// Generate completion with the templated prompt
const summary = await client.generateCompletion(prompt, {
  model: "llama2",
  temperature: 0.3,
  maxTokens: 200
});

console.log(summary);
```

### Custom Template Registration

```typescript
import { createLLMClient, ProviderType, PromptTemplate } from './LLMClient';

// Create an LLMClient
const client = createLLMClient({
  type: ProviderType.OLLAMA
});

// Define a custom template
const customTemplate: PromptTemplate = {
  id: 'code_explanation',
  name: 'Code Explanation',
  template: `Please explain the following {{language}} code:

{{code}}

{{#if technical_level}}Explain at a {{technical_level}} technical level.{{/if}}

Explanation:`,
  variables: ['code', 'language', 'technical_level'],
  description: 'Template for explaining code snippets',
  tags: ['code', 'explanation']
};

// Register the template
client.registerTemplate(customTemplate);

// Use the template
const prompt = client.applyTemplate('code_explanation', {
  code: 'function hello() { console.log("Hello, world!"); }',
  language: 'JavaScript',
  technical_level: 'beginner'
});

// Generate completion
const explanation = await client.generateCompletion(prompt, {
  model: "llama2",
  temperature: 0.5,
  maxTokens: 300
});

console.log(explanation);
```

---
