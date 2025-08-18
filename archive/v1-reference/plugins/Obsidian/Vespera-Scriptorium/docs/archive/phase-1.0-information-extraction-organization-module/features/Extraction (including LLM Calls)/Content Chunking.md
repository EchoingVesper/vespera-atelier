# Content Chunking

**Architectural Role:** Content Chunking is responsible for breaking down large documents into smaller, manageable pieces (chunks) that can be processed individually. This is particularly important for LLM-based processing due to context window limitations. The chunking process should be adaptive and content-aware to preserve the meaning and context of the original document.

**Codebase Comparison Findings:**

The `src/robust-processing/AdaptiveChunker.ts` file implements the core functionality for content chunking.

*   **Implementation:** The `AdaptiveChunker` class provides the `splitDocument` method, which uses a `RecursiveCharacterTextSplitter` and various options (context window, safety margin, separators) to create `DocumentChunk` objects with associated metadata. It includes logic for calculating optimal chunk size and overlap and extracting preceding and following context.
*   **Discrepancies/Required Updates:**
    *   The current implementation relies on the `langchain/text_splitter`. While functional, a deeper integration or a custom implementation might be needed for more fine-grained control over content-aware splitting or handling of specific document structures (e.g., tables, code blocks).
    *   The estimation of token count is currently a rough approximation (`Math.ceil(rawChunk.length / 4)`). More accurate token counting based on the specific LLM model being used would be beneficial.
    *   The handling of different document formats (PDF, DOCX) before chunking is not explicitly part of this component and would need to be addressed in the Ingestion stage.

**Checklist for Updates:**

*   [ ] Evaluate the current chunking implementation for its effectiveness with various document structures and content types.
*   [ ] Consider implementing more accurate, model-specific token counting.
*   [ ] Ensure seamless integration with the Ingestion stage for handling different document formats before chunking.
*   [ ] Document the Content Chunking process, configuration options, and any limitations.