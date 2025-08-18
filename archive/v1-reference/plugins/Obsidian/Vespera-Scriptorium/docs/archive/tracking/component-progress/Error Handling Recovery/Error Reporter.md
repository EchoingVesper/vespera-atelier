# Error Reporter

**Architectural Role:** The Error Reporter is responsible for presenting detected errors to the user or logging them for debugging and monitoring purposes. It formats error information in a user-friendly way (e.g., notices, logs, dedicated error views) and provides details that can help diagnose and resolve issues.

**Codebase Comparison Findings:**

The error reporting functionality has been significantly enhanced with a dedicated `ErrorReporter` class in `src/error-handling/ErrorReporter.ts` that works alongside the existing `ErrorHandler` class.

*   **Implementation:** 
    *   The `ErrorReporter` class implements a channel-based architecture for error reporting, with each channel representing a different reporting mechanism (console, notices, UI).
    *   The original `ErrorHandler` class has been updated to delegate reporting responsibilities to the `ErrorReporter` while maintaining backward compatibility.
    *   A dedicated `ErrorView` class provides a UI-based error reporting view within Obsidian.
    *   Each reporting channel can be individually enabled/disabled and configured.

*   **Discrepancies/Required Updates:**
    *   ✅ Clear separation between error reporting (presentation) and error handling (storage, recovery) has been implemented.
    *   ✅ Multiple reporting channels are now available (console, notices, UI).
    *   ✅ Enhanced error message formatting with context-specific details is implemented in each channel.
    *   ✅ The Error Reporter properly integrates with the Error Detector to receive standardized `VesperaError` objects.
    *   ✅ Configuration options for different reporting channels are available.

**Checklist for Updates:**

*   [x] Review the responsibilities of `ErrorHandler` and consider if a clearer separation between reporting and handling is needed.
*   [x] Implement additional error reporting mechanisms (e.g., dedicated UI view, logging to a file).
*   [x] Enhance the formatting of error messages for different reporting channels, providing more detailed context where available.
*   [x] Ensure the Error Reporter receives errors from the "Error Detector" and provides information to the "Error Handler" for recovery actions.
*   [x] Document the Error Reporter's role, reporting mechanisms, and configuration options.

## Documentation

### Role

The `ErrorReporter` (`src/error-handling/ErrorReporter.ts`) is a dedicated component responsible for:

1. **Presenting** errors to users and developers through various channels (console, notices, UI).
2. **Formatting** error information in a user-friendly and context-aware manner.
3. **Managing** different reporting channels with individual configuration options.
4. **Providing** a consistent interface for error reporting across the application.

### Integration Points

1. **`ErrorHandler.ts`:**
   * The `ErrorHandler` now delegates reporting responsibilities to the `ErrorReporter`.
   * When `handleError()` is called, it adds the error to its history and then calls `errorReporter.reportError()`.
   * Configuration methods like `setShowNotices()` now also update the corresponding channel in the `ErrorReporter`.

2. **`ErrorDetector.ts`:**
   * The `ErrorDetector` standardizes errors into `VesperaError` objects.
   * These standardized errors are then passed to the `ErrorHandler`, which in turn passes them to the `ErrorReporter`.

3. **`VesperaPlugin.ts` (Core Plugin):**
   * The plugin should register the `ErrorView` using the `registerErrorView()` function.
   * This adds a dedicated error log view to Obsidian's UI and registers the necessary commands.

### Implementation Details

#### Channel-Based Architecture

The `ErrorReporter` uses a channel-based architecture where each reporting mechanism is implemented as a separate channel:

* **`ErrorReportingChannel` Interface:** Defines the contract for all reporting channels with methods for reporting errors and enabling/disabling the channel.

* **`ConsoleReportingChannel`:** Reports errors to the browser console with severity-appropriate formatting.

* **`NoticeReportingChannel`:** Displays errors as Obsidian notices with configurable durations based on severity.

* **`UIReportingChannel`:** Reports errors to a dedicated UI view in Obsidian, providing a persistent error log.

#### Error View

The `ErrorView` (`src/error-handling/ErrorView.ts`) provides a dedicated UI for viewing errors:

* Displays errors in a list with newest first.
* Shows error details including timestamp, severity, type, message, and source.
* Provides collapsible stack traces for debugging.
* Allows clearing the error log.
* Can be opened via command or ribbon icon.

### Configuration Options

* **Channel Enabling/Disabling:** Each channel can be individually enabled or disabled via `errorReporter.setChannelEnabled(channelName, enabled)`.

* **Notice Duration:** The duration of notice displays can be configured by severity via `noticeChannel.setDuration(severity, durationMs)`.

* **UI View Max Errors:** The maximum number of errors to display in the UI view can be set via `errorView.setMaxErrors(max)`.

### Usage Examples

```typescript
// Get the ErrorReporter instance
const reporter = ErrorReporter.getInstance();

// Report an error through all enabled channels
reporter.reportError(vesperaError);

// Report with channel-specific options
reporter.reportError(vesperaError, {
  notice: { duration: 10000 } // 10 seconds
});

// Disable console reporting
reporter.setChannelEnabled('console', false);

// Configure notice durations
const noticeChannel = reporter.getChannel('notice') as NoticeReportingChannel;
noticeChannel.setDuration(ErrorSeverity.CRITICAL, 15000); // 15 seconds for critical errors
```