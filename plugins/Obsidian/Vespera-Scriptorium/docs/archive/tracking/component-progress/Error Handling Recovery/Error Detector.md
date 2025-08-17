# Error Detector

**Architectural Role:** The Error Detector is responsible for identifying and capturing errors that occur during the document processing workflow. This includes errors from LLM calls, file system operations, parsing issues, or any other exceptions that may arise during the execution of processing nodes or workflow logic.

**Codebase Comparison Findings:**

Error detection is implemented in various places throughout the codebase, particularly within the `ProcessingOrchestrator` and `LLMClient`, rather than being centralized in a dedicated "Error Detector" component.

*   **Implementation:** The `processChunk` method in `ProcessingOrchestrator` includes `try...catch` blocks to catch errors during chunk processing and categorizes them using the `ErrorType` enum from `LLMClient`. The `LLMClient` also has internal error handling and defines the `LLMError` interface. The `ErrorHandler` class in `src/utils/ErrorHandler.ts` receives errors but doesn't actively detect them from the processing flow.
*   **Discrepancies/Required Updates:**
    *   The "Error Detector" component is not implemented as a distinct, centralized entity. Error detection logic is scattered across different parts of the codebase.
    *   A consistent and standardized mechanism for detecting all types of errors across the entire workflow is missing.
    *   The process of transforming raw errors into a standardized format (like `VesperaError` or `LLMError`) is handled ad-hoc.

**Checklist for Updates:**

*   [x] Design and implement a dedicated module/class for the "Error Detector". (`src/error-handling/ErrorDetector.ts` created with initial class structure).
*   [x] Define how the Error Detector integrates with different parts of the workflow to capture errors. (Integrated into `ProcessingOrchestrator.ts` within the `processChunk` method).
*   [x] Implement logic for identifying various types of errors and transforming them into a standardized error format (e.g., `VesperaError`). (The `ErrorDetector.detect()` method in `src/error-handling/ErrorDetector.ts` handles this, and is now utilized by `ProcessingOrchestrator.ts`).
*   [x] Ensure the Error Detector (via `ProcessingOrchestrator`) provides captured `VesperaError` instances to the `ErrorHandler` (which currently serves as the primary Error Reporter and logs errors).
*   [x] Document the Error Detector's role, integration points, and implementation details.

## Documentation

### Role
The `ErrorDetector` (`src/error-handling/ErrorDetector.ts`) is a dedicated component responsible for:
1.  **Identifying** errors that occur within various parts of the application, particularly during the document processing workflow.
2.  **Capturing** these raw errors, regardless of their origin (e.g., LLM calls, file system operations, internal logic).
3.  **Standardizing** captured errors by transforming them into a consistent `VesperaError` format. This ensures that all errors within the system have a common structure, including type, severity, and contextual details.

### Integration Points

1.  **`ProcessingOrchestrator.ts`:**
    *   An instance of `ErrorDetector` is created in the constructor of `ProcessingOrchestrator`.
    *   Within the `processChunk` method, specifically in the `catch` block that handles errors from `this.llmClient.generateCompletion`, the `errorDetector.detect()` method is called. This takes the raw error, an `ErrorSource` object detailing the context (component, operation, chunk ID), a default `ErrorType`, and `ErrorSeverity`.
    *   A similar pattern is used in the final `catch` block of the `processChunk`'s retry loop to capture any unexpected errors during the retry mechanism itself.

2.  **`ErrorHandler.ts`:**
    *   After an error is detected and standardized into a `VesperaError` by the `ErrorDetector` within `ProcessingOrchestrator`, the resulting `VesperaError` object is passed to `ErrorHandler.getInstance().handleError(error, false)`.
    *   The `ErrorHandler` then logs this standardized error and adds it to its history, effectively acting as the primary error reporting mechanism at this stage.

### Implementation Details

*   **`ErrorDetector.ts` Class:** Contains the core logic for error detection and standardization.
    *   **`ErrorSource` Interface:** Defines a structure (`{ operation: string; component: string; details?: unknown; }`) to provide context about where an error originated. This is crucial for debugging and understanding the error's path.
    *   **`detect(error: unknown, source: ErrorSource, defaultType: ErrorType, defaultSeverity: ErrorSeverity): VesperaError` Method:**
        *   This is the primary method for processing a raw error.
        *   If the input `error` is already a `VesperaError`, it simply adds the new `source` information to its details.
        *   If it's a native `Error` object, it extracts the message and attempts basic type inference (e.g., `TimeoutError`, `NetworkError`).
        *   If it's a string, it uses the string as the message.
        *   It then constructs and returns a new `VesperaError` instance, populating it with the determined message, type, severity, the original error, and the provided `source`.
    *   **`tryDetect<T>(fn: () => Promise<T> | T, source: ErrorSource, defaultType: ErrorType, defaultSeverity: ErrorSeverity): Promise<T>` Method:**
        *   A utility wrapper that executes a given function (`fn`).
        *   If the function throws an error, `tryDetect` automatically calls `this.detect()` to standardize it before re-throwing the `VesperaError`.
        *   This simplifies error handling for function calls where standardized error detection is desired.

*   **`VesperaError` (`src/utils/ErrorHandler.ts`):** The standardized error format used throughout the plugin. It includes properties like `message`, `type` (enum `ErrorType`), `severity` (enum `ErrorSeverity`), `details` (object for custom context), and `timestamp`.