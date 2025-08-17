# Chunker Module

**Responsibility:** Splits text into manageable chunks for LLM processing.

## Overview

The Chunker module is responsible for dividing text into appropriately sized chunks for processing by Large Language Models (LLMs). It uses LangChain.js's RecursiveCharacterTextSplitter to intelligently split text along natural boundaries like paragraphs, sentences, and words.

## Exports

- `splitTextIntoChunks`: Primary function that uses LangChain's RecursiveCharacterTextSplitter
- `chunkText`: Legacy function for simple character-based chunking (deprecated)
- `ChunkingOptions` interface for configuring chunking behavior
- `DEFAULT_CHUNKING_OPTIONS` constant with sensible defaults

## Chunking Algorithm

The module uses a recursive text splitting algorithm that:

1. Attempts to split text at the most semantically meaningful boundaries first (paragraphs)
2. If chunks are still too large, splits at the next level (sentences)
3. Continues down to character-level splitting if necessary
4. Maintains specified overlap between chunks to preserve context

This approach preserves the semantic coherence of the text while ensuring chunks fit within the token limits of the LLM.

## Configuration Options

The chunking behavior can be customized with the following options:

- **chunkSize**: The target size of each chunk in tokens (default: 1000)
- **chunkOverlap**: The number of tokens to overlap between chunks (default: 50)
- **separators**: An array of string separators to use for splitting, in order of preference

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

The chunking parameters are configurable through the plugin's settings UI, allowing users to:

- Adjust chunk size to fit their specific LLM's context window
- Modify overlap to balance context preservation with token efficiency
- Set model-specific parameters when working with different LLMs

---
