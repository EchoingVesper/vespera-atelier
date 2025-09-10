Feature: Error Handling and Edge Cases
  As a developer using the vespera-file-ops library
  I want comprehensive and predictable error handling
  So that I can build reliable applications with clear error recovery

Background:
  Given the library uses structured error types for programmatic handling
  And all errors include context information for debugging
  And error messages are clear and actionable

Scenario: Empty pattern string error
  Given any file with content
  When I try to replace "" with "replacement"
  Then the operation should return EditError::EmptyPattern
  And the error message should explain that patterns cannot be empty
  And the file should remain unchanged

Scenario: Pattern too large error
  Given a file with small content
  When I try to replace a pattern larger than MAX_PATTERN_SIZE
  Then the operation should return EditError::PatternTooLarge
  And the error should include the maximum allowed size
  And the file should remain unchanged

Scenario: File size exceeds limit
  Given a file larger than MAX_FILE_SIZE (100MB)
  When I try to edit it
  Then the operation should return EditError::FileTooLarge
  And the error should include the actual size and limit
  And no memory should be allocated for the large file

Scenario: File encoding is not UTF-8
  Given a file with binary content or non-UTF-8 encoding
  When I try to edit it
  Then the operation should return EditError::InvalidUtf8
  And the error should include the position of the invalid sequence
  And no partial modifications should occur

Scenario: File does not exist
  Given a non-existent file path
  When I try to edit the file
  Then the operation should return EditError::FileNotFound
  And the error should include the attempted file path
  And no file should be created

Scenario: File permission denied (read)
  Given a file that exists but is not readable
  When I try to edit it
  Then the operation should return EditError::PermissionDenied
  And the error should indicate whether read or write access failed
  And the file should remain unchanged

Scenario: File permission denied (write)
  Given a read-only file
  When I try to edit it
  Then the operation should return EditError::PermissionDenied
  And the error should indicate write access was denied
  And the original content should remain unchanged

Scenario: Disk space insufficient
  Given a file system with insufficient free space
  When I try to perform an edit that would increase file size significantly
  Then the operation should return EditError::InsufficientSpace
  And the error should include available vs required space
  And the original file should remain unchanged

Scenario: Concurrent file modification detected
  Given a file that is modified by another process during editing
  When the edit operation is in progress
  Then the operation should return EditError::ConcurrentModification
  And the error should include file modification timestamps
  And data integrity should be preserved

Scenario: System interruption during write
  Given an edit operation in progress
  When the system is interrupted (simulated)
  Then the operation should return EditError::WriteInterrupted
  And either the original content or complete new content should be present
  And no partially written state should exist

Scenario: Invalid UTF-8 in replacement string
  Given a file with valid UTF-8 content
  When I try to replace with a string containing invalid UTF-8 bytes
  Then the operation should return EditError::InvalidReplacementUtf8
  And the error should identify the invalid bytes
  And the file should remain unchanged

Scenario: Pattern contains null bytes
  Given a file with text content
  When I try to replace a pattern containing "\0" bytes
  Then the operation should return EditError::NullByteInPattern
  And the error should indicate null bytes are not supported in text mode
  And the file should remain unchanged

Scenario: Replacement would create extremely large file
  Given a small file with repeatable pattern
  When I try to replace pattern with a very large string that would exceed memory limits
  Then the operation should return EditError::ReplacementTooLarge
  And the error should indicate the potential result size
  And no memory allocation should occur

Scenario: Circular replacement pattern
  Given a file with content "abc"
  When I try to perform edits that create infinite recursion:
    | old_string | new_string |
    | a          | ab         |
  And apply the same edit multiple times
  Then the system should detect potential infinite growth
  And return EditError::PotentialInfiniteLoop after reasonable iterations

Scenario: Multi-edit with invalid operation
  Given a valid file
  When I try to apply a multi-edit containing an invalid operation
  Then the operation should return EditError::InvalidEditOperation
  And the error should include which operation failed and why
  And no edits should be applied (atomic failure)

Scenario: Memory allocation failure
  Given a system with limited available memory
  When I try to edit a file that would require more memory than available
  Then the operation should return EditError::InsufficientMemory
  And the error should be detected before corrupting the file
  And cleanup should occur properly

Scenario: Invalid character positions
  Given a file with Unicode content
  When I try to specify edit positions that are not on character boundaries
  Then the operation should return EditError::InvalidCharacterBoundary
  And the error should include the invalid position
  And suggest the nearest valid boundary

Scenario: Filesystem I/O error
  Given a file on a failing storage device
  When I try to read the file for editing
  Then the operation should return EditError::IoError
  And the error should wrap the underlying system error
  And include context about what operation failed

Scenario: File locks and exclusive access
  Given a file that is locked by another process
  When I try to edit it
  Then the operation should return EditError::FileLocked
  And the error should indicate the file is in use
  And suggest retry mechanisms

Scenario: Pattern matching timeout
  Given a file with content designed to cause pathological regex behavior
  When pattern matching exceeds reasonable time limits
  Then the operation should return EditError::OperationTimeout
  And the timeout duration should be included in the error
  And the operation should be cleanly cancelled

Scenario: Unicode normalization failure
  Given a file with malformed Unicode that cannot be normalized
  When I try to edit it with normalization enabled
  Then the operation should return EditError::NormalizationFailed
  And the error should include the problematic character position
  And offer options to proceed without normalization

Scenario: Backup creation failure
  Given editing with backup enabled
  When backup file creation fails due to permissions or space
  Then the operation should return EditError::BackupFailed
  And the original edit should not proceed
  And the original file should remain unchanged

Scenario: Path validation errors
  Given a file path containing invalid characters for the filesystem
  When I try to edit the file
  Then the operation should return EditError::InvalidPath
  And the error should indicate which part of the path is invalid
  And suggest path correction if possible

Scenario: Multiple error conditions
  Given a file that has multiple issues (permissions, encoding, size)
  When I try to edit it
  Then the operation should return the most relevant error first
  And error priority should be logical (existence > permissions > encoding > size)
  And each error check should be efficient

Scenario: Error recovery and retry
  Given an edit operation that fails with a transient error
  When the underlying condition is resolved
  Then a retry should succeed
  And the error state should not persist between operations
  And no partial state should affect the retry

Scenario: Structured error information
  Given any error condition
  When an error is returned
  Then the error should implement standard traits (Debug, Display, Error)
  And include structured fields for programmatic access
  And provide human-readable descriptions
  And include error codes for internationalization

Scenario: Error logging and diagnostics
  Given debug mode is enabled
  When any error occurs
  Then diagnostic information should be available
  And include operation parameters, file state, and system context
  And sensitive information should be redacted
  And logs should be structured for analysis

Scenario: Graceful degradation
  Given a system under resource pressure
  When edit operations are attempted
  Then the system should fail gracefully rather than crash
  And provide clear feedback about resource constraints
  And suggest alternatives where possible (smaller operations, etc.)

Scenario: Version compatibility errors
  Given a file created by a newer version of the library
  When an older version tries to edit it
  Then the operation should return EditError::VersionMismatch
  And the error should indicate required vs available versions
  And suggest upgrade paths

Scenario: Configuration validation errors
  Given invalid library configuration (buffer sizes, limits, etc.)
  When initializing the library
  Then initialization should return ConfigError::InvalidConfiguration
  And specify which configuration values are invalid
  And provide valid ranges for each parameter

Scenario: Thread safety error detection
  Given the library is used incorrectly in multi-threaded context
  When thread safety violations would occur
  Then the operation should return EditError::ThreadSafetyViolation
  And indicate what constraint was violated
  And suggest correct usage patterns