Feature: Edge Cases and Boundary Conditions
  As a developer using the vespera-file-ops library
  I want the library to handle edge cases predictably
  So that my applications remain robust under unusual conditions

Background:
  Given the library handles all edge cases gracefully
  And performance remains reasonable under extreme conditions
  And memory usage is bounded and predictable

Scenario: Empty file editing
  Given an empty file (0 bytes)
  When I try to replace "anything" with "something"
  Then the operation should return EditResult with 0 replacements
  And the file should remain empty
  And no error should occur

Scenario: Single character file
  Given a file with content "a"
  When I replace "a" with "b"
  Then the file should contain "b"
  And when I replace "b" with ""
  Then the file should become empty

Scenario: Only whitespace content
  Given a file with content "   \t\n   "
  When I replace " " with "_"
  Then the file should contain "___\t\n___"
  And whitespace should be treated as regular characters

Scenario: Only line endings content
  Given a file with content "\n\r\n\r"
  When I replace "\n" with "|"
  Then the file should contain "|\r|\r"
  And line endings should be replaceable like any other character

Scenario: Very large file handling
  Given a file with 500MB of content
  When I replace a pattern that occurs once
  Then the operation should complete successfully
  And memory usage should not exceed 2x file size
  And progress should be reasonable (< 30 seconds)

Scenario: Pattern at exact file boundaries
  Given a file with content "pattern"
  When I replace "pattern" with "replacement"
  Then the file should contain "replacement"
  And boundary detection should work correctly

Scenario: Pattern spans entire file
  Given a file with content "entire content"
  When I replace "entire content" with "new content"
  Then the file should contain "new content"
  And the entire file replacement should work

Scenario: Maximum pattern length
  Given a file containing a pattern of MAX_PATTERN_SIZE characters
  When I replace that entire pattern
  Then the operation should succeed
  And memory allocation should be efficient

Scenario: Pattern that appears consecutively
  Given a file with content "aaaaaaaaaa"
  When I replace "aa" with "b" (first occurrence only)
  Then the file should contain "baaaaaaaa"
  And only the first occurrence should be replaced

Scenario: Pattern that appears consecutively with replace_all
  Given a file with content "aaaaaaaaaa"
  When I replace all "aa" with "b"
  Then the file should contain "bbbbb"
  And all non-overlapping occurrences should be replaced

Scenario: Pattern replacement creates new instances of the pattern
  Given a file with content "ab"
  When I replace "a" with "aa"
  Then the file should contain "aab"
  And the replacement should not create recursive matches

Scenario: Very long line handling
  Given a file with a single line of 1,000,000 characters
  When I replace a pattern in the middle of the line
  Then the operation should complete successfully
  And line structure should be preserved

Scenario: Many small patterns
  Given a file with 100,000 instances of a single character
  When I replace all instances with a different character
  Then all instances should be replaced
  And the operation should complete in reasonable time

Scenario: Deeply nested quotes and escapes
  Given a file with content containing nested quotes:
    """
    "He said \"She said \\\"Hello\\\" to me\" yesterday"
    """
  When I replace "Hello" with "Hi"
  Then the file should contain:
    """
    "He said \"She said \\\"Hi\\\" to me\" yesterday"
    """
  And escape sequences should be preserved

Scenario: Binary-like patterns in text
  Given a file with content containing sequences that look binary:
    """
    \x00\x01\x02\xFF\xAB\xCD
    """
  When I replace "\xFF" with "replacement"
  Then only the literal string "\xFF" should be replaced
  And actual binary bytes should not be affected

Scenario: Extremely long replacement text
  Given a file with content "x"
  When I replace "x" with a string of 10,000,000 characters
  Then the operation should succeed if memory permits
  And should return EditError::ReplacementTooLarge if memory insufficient
  And should fail gracefully without corruption

Scenario: File with no line endings
  Given a file with content "no line endings here" (no \n at end)
  When I perform any replacement
  Then the lack of final newline should be preserved
  And file structure should remain identical

Scenario: File with only line endings
  Given a file with content "\n\n\n\n\n"
  When I replace "\n" with "\r\n"
  Then the file should contain "\r\n\r\n\r\n\r\n\r\n"
  And line ending conversions should work correctly

Scenario: Mixed line endings in single file
  Given a file with content "line1\nline2\r\nline3\r"
  When I replace "line" with "row"
  Then the file should contain "row1\nrow2\r\nrow3\r"
  And all line endings should be preserved exactly

Scenario: Pattern occurs at power-of-2 boundaries
  Given a file where pattern occurs at byte positions 1024, 2048, 4096
  When I replace all occurrences
  Then all boundary cases should work correctly
  And no off-by-one errors should occur

Scenario: Unicode character boundaries near buffer boundaries
  Given a file where multi-byte Unicode characters span internal buffer boundaries
  When I perform any edit operation
  Then character integrity should be maintained
  And no Unicode corruption should occur

Scenario: File path with Unicode characters
  Given a file with Unicode characters in the filename
  When I edit the file content
  Then the operation should work regardless of filename encoding
  And path handling should be robust

Scenario: Symlink handling
  Given a symbolic link pointing to a real file
  When I edit through the symlink
  Then the target file should be edited
  And the symlink itself should remain unchanged

Scenario: Extremely nested directory structure
  Given a file in a deeply nested directory (200+ levels)
  When I edit the file
  Then path length limits should be handled appropriately
  And should work or fail gracefully based on system limits

Scenario: File on network filesystem
  Given a file on a slow or unreliable network filesystem
  When I edit the file
  Then network delays should be handled appropriately
  And transient network errors should be detectable

Scenario: File with special filesystem attributes
  Given a file with special attributes (hidden, system, compressed)
  When I edit the file
  Then the content should be edited
  And filesystem attributes should be preserved

Scenario: Case-insensitive filesystem edge cases
  Given a case-insensitive filesystem
  When I edit a file with mixed case in its path
  Then the edit should work correctly
  And case sensitivity should not affect content editing

Scenario: Pattern contains all possible Unicode categories
  Given a file with patterns containing characters from all Unicode categories
  When I replace any of these patterns
  Then all Unicode character categories should be handled correctly
  And no character category should cause special behavior

Scenario: Replacement with significantly different byte length
  Given a file with ASCII content
  When I replace single characters with long Unicode sequences
  Then byte vs character position calculations should remain accurate
  And memory reallocation should be handled efficiently

Scenario: Pattern at exact memory page boundaries
  Given a file structured to place patterns at memory page boundaries
  When I replace these patterns
  Then memory management should work correctly
  And no segmentation faults should occur

Scenario: Concurrent access to same file
  Given multiple processes attempting to edit the same file
  When they edit simultaneously
  Then the library should handle conflicts appropriately
  And data corruption should be prevented

Scenario: File modified during operation
  Given an edit operation in progress
  When the file is modified externally
  Then the modification should be detected
  And appropriate action should be taken (error or retry)

Scenario: Invalid UTF-8 sequences at specific positions
  Given a file with invalid UTF-8 at buffer boundaries
  When I attempt to edit it
  Then invalid sequences should be detected precisely
  And error positions should be accurate

Scenario: Pattern matching with catastrophic backtracking potential
  Given patterns that could cause exponential regex behavior
  When using these patterns
  Then the library should avoid regex-based matching
  And use literal string matching for predictable performance

Scenario: Zero-length matches edge case
  Given patterns that could match zero-length strings
  When these are used in replacement
  Then the behavior should be well-defined
  And infinite loops should be prevented

Scenario: Locale-specific character handling
  Given different system locale settings
  When editing files with locale-specific characters
  Then the library should behave consistently regardless of locale
  And should not depend on system locale for correctness

Scenario: Files with unusual permissions
  Given files with very specific permission combinations
  When editing them
  Then permission checks should be comprehensive
  And all edge cases should be handled appropriately

Scenario: Pattern matching performance cliff
  Given patterns and content designed to stress pattern matching
  When performing replacements
  Then performance should degrade gracefully
  And should not exhibit sudden performance cliffs

Scenario: Memory pressure during large operations
  Given system memory pressure during large file operations
  When the system is low on memory
  Then the library should detect memory pressure
  And either complete gracefully or fail cleanly with clear error

Scenario: Pathological Unicode normalization cases
  Given text with unusual Unicode normalization edge cases
  When normalizing and editing
  Then all normalization edge cases should be handled correctly
  And no corruption or crashes should occur

Scenario: File locking edge cases
  Given files with various locking states
  When attempting to edit
  Then all file locking scenarios should be handled appropriately
  And clear error messages should indicate lock conflicts