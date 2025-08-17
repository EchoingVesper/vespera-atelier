# Input Node

**Architectural Role:** The Input Node is the initial stage in the document processing workflow. Its primary responsibility is to ingest raw document content and transform it into a structured format suitable for subsequent processing stages. This typically involves tasks such as loading the document, extracting text, and splitting the text into smaller, manageable chunks.

**Codebase Comparison Findings:**

The `src/robust-processing/AdaptiveChunker.ts` file implements the chunking functionality, which is a core part of the Input Node's role.

*   **Implementation:** The `AdaptiveChunker` class provides methods for splitting document content based on various options like context window size, safety margins, and content-aware boundaries. It generates `DocumentChunk` objects with metadata.
*   **Discrepancies/Required Updates:**
    *   The current implementation focuses solely on chunking. The broader responsibilities of the Input Node, such as document loading and initial text extraction from various file types (e.g., Markdown, PDF, DOCX), do not appear to be fully consolidated or explicitly defined within a single "Input Node" component in the current `src/` structure.
    *   There is no explicit "Input Node" class or module that orchestrates the loading, extraction, and chunking steps as a unified stage.
    *   Integration with a File Watcher or Manual Ingestion Trigger (from the Ingestion architectural area) is implied but not explicitly managed by this component.

**Checklist for Updates:**

*   [x] Create a dedicated module/class for the "Input Node" (`src/robust-processing/InputNode.ts` created) that encapsulates document loading, text extraction, and chunking. (Initial implementation with placeholders for specific file types).
*   [x] Integrate or define mechanisms for handling different document types (Markdown, PDF, DOCX, etc.). (Placeholders and `sourceType` in `RawDocument` interface added in `InputNode.ts`).
*   [x] Define clear interfaces for input (`RawDocument`) and output (`InputNodeOutput` as `DocumentChunk[]`) in `InputNode.ts`.
*   [~] Ensure robust error handling for file reading and text extraction. (Basic `try/catch` implemented in `processDocument`; further refinement may be needed for specific loaders/extractors).
*   [~] Document the InputNode's role and implementation clearly in the codebase and architecture documentation. (Initial JSDoc comments added to `InputNode.ts`).