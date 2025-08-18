# Error Handler

**Architectural Role:** The Error Handler is responsible for implementing the logic to respond to detected errors during the workflow execution. This can involve various strategies depending on the error type and severity, such as logging the error, notifying the user, attempting to retry the failed operation, pausing the workflow, or terminating the process.

**Codebase Comparison Findings:**

Error handling logic is present in various parts of the codebase, particularly within the `ProcessingOrchestrator` and `LLMClient`, rather than being centralized in a dedicated "Error Handler" component. The `ErrorHandler` class in `src/utils/ErrorHandler.ts` primarily focuses on reporting and history, not active handling logic.

*   **Implementation:** The `processChunk` method in `ProcessingOrchestrator` contains `catch` blocks that implement retry logic with exponential backoff for certain error types (`ErrorType.TIMEOUT`, `ErrorType.RATE_LIMIT`, retryable `ErrorType.INVALID_REQUEST`, and other retryable errors). The `LLMClient`'s `withRetry` method also implements a general retry mechanism. The `ErrorHandler` class logs errors and shows notices but doesn't contain logic for retrying or other recovery actions.
*   **Discrepancies/Required Updates:**
    *   The "Error Handler" component is not implemented as a distinct, centralized entity that receives errors and applies handling strategies. Error handling logic is scattered and duplicated.
    *   A consistent and standardized mechanism for applying different handling strategies based on error type, severity, or workflow context is missing.
    *   Integration with the "Recovery Manager" for more complex recovery scenarios is needed.

**Checklist for Updates:**

*   [ ] Design and implement a dedicated module/class for the "Error Handler".
*   [ ] Define how the Error Handler receives errors from the "Error Detector".
*   [ ] Implement a mechanism for defining and applying different error handling strategies based on error characteristics.
*   [ ] Consolidate retry logic from `ProcessingOrchestrator` and `LLMClient` into the Error Handler or a related "Retry Mechanism" component.
*   [ ] Ensure the Error Handler can interact with the "Recovery Manager" for more advanced recovery actions.
*   [ ] Document the Error Handler's role, handling strategies, and implementation details.