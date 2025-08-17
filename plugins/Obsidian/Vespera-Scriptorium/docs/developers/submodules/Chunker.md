# Chunker Module

**Role in Processing Pipeline:** Acts as an initial processing node, splitting raw document text into manageable chunks.

## Overview

Within the new n8n-inspired processing pipeline, the Chunker module functions as a dedicated node responsible for the crucial first step of preparing raw text data for subsequent stages, particularly those involving Large Language Models (LLMs). It receives raw text input, applies a sophisticated chunking algorithm, and outputs a series of smaller text segments (chunks) that are suitable for processing by downstream nodes.

## Exports

- `splitTextIntoChunks`: Primary function that uses LangChain's RecursiveCharacterTextSplitter
- `chunkText`: Legacy function for simple character-based chunking (deprecated)
- `ChunkingOptions` interface for configuring chunking behavior
- `DEFAULT_CHUNKING_OPTIONS` constant with sensible defaults

## Pipeline Integration

The Chunker node typically operates early in the processing workflow. It receives raw text, potentially from a preceding node responsible for file reading or content extraction. After processing, the generated chunks are then made available for the next stage of the pipeline, often by being placed into a file-based queue. This allows the orchestration layer to manage the flow of data and distribute chunks to subsequent processing nodes (like the LLMClient node) as resources become available.

## Chunking Algorithm

The module utilizes a recursive text splitting algorithm, often based on libraries like LangChain.js's RecursiveCharacterTextSplitter. This algorithm intelligently divides text by attempting to split along natural boundaries (paragraphs, sentences) before resorting to character-level splitting if necessary. It also maintains configurable overlap between chunks to preserve context across segment boundaries, which is vital for maintaining coherence during LLM processing.

## Configuration Options

The behavior of the Chunker node can be customized via configuration options, influencing how it processes input and generates chunks for the pipeline:

- **chunkSize**: The target size of each output chunk, typically measured in tokens, aligned with the context window limitations of target LLMs.
- **chunkOverlap**: The amount of text overlap between consecutive chunks, helping to maintain context.
- **separators**: A prioritized list of characters or strings used as potential splitting points.

These options are managed externally by the pipeline's configuration or orchestration layer, allowing for flexible adaptation to different document types and processing requirements.

## Usage Example

```typescript
import { splitTextIntoChunks } from './Chunker';

// Using default options (1000 tokens, 50 token overlap)
const chunks = await splitTextIntoChunks(longText);

// With custom options
const customChunks = await splitTextIntoChunks(longText, {
  chunkSize: 500,
  chunkOverlap: 100
});
```

## Integration with Settings

Chunking parameters are integrated with the plugin's overall settings, enabling users or the orchestration system to configure the Chunker node's behavior. This allows for dynamic adjustment of chunk size and overlap based on the specific LLM being used in downstream nodes and the nature of the input document, optimizing the balance between processing efficiency and contextual integrity within the pipeline.

---
