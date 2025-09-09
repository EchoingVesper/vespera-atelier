Feature: Sequential Multi-Edit Operations
  As a developer using the vespera-file-ops library
  I want to apply multiple edit operations in sequence
  So that I can make complex transformations efficiently and predictably

Background:
  Given the library processes edits sequentially in the order provided
  And each edit operates on the result of the previous edit

Scenario: Multiple independent edits in sequence
  Given a file with content:
    """
    const foo = 1;
    const bar = 2;
    const baz = 3;
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | foo        | alpha      | false       |
    | bar        | beta       | false       |
    | baz        | gamma      | false       |
  Then the file should contain:
    """
    const alpha = 1;
    const beta = 2;
    const gamma = 3;
    """
  And the operation should return MultiEditResult with 3 successful edits
  And total_replacements should be 3

Scenario: Edit affects subsequent edits (chaining)
  Given a file with content:
    """
    foo bar baz
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | foo bar    | bar foo    | false       |
    | bar foo    | result     | false       |
  Then the file should contain:
    """
    result baz
    """
  And the operation should return MultiEditResult with 2 successful edits

Scenario: Some edits fail, others succeed (partial failure)
  Given a file with content:
    """
    alpha beta gamma
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | alpha      | first      | false       |
    | nonexist   | second     | false       |
    | gamma      | third      | false       |
  Then the file should contain:
    """
    first beta third
    """
  And the operation should return MultiEditResult with 2 successful edits and 1 no-match
  And the failed edit should be recorded with reason "pattern not found"

Scenario: Empty operations list
  Given a file with content:
    """
    unchanged content
    """
  When I apply an empty list of edits
  Then the file should contain:
    """
    unchanged content
    """
  And the operation should return MultiEditResult with 0 edits processed

Scenario: Single edit in multi-edit operation
  Given a file with content:
    """
    single edit test
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | test       | example    | false       |
  Then the file should contain:
    """
    single edit example
    """
  And the operation should behave identically to single edit operation

Scenario: All edits with replace_all flag
  Given a file with content:
    """
    test test test
    demo demo demo
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | test       | exam       | true        |
    | demo       | show       | true        |
  Then the file should contain:
    """
    exam exam exam
    show show show
    """
  And the operation should return MultiEditResult with 6 total replacements

Scenario: Mixed replace_all flags
  Given a file with content:
    """
    foo foo bar bar
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | foo        | baz        | true        |
    | bar        | qux        | false       |
  Then the file should contain:
    """
    baz baz qux bar
    """
  And the first edit should replace 2 occurrences
  And the second edit should replace 1 occurrence

Scenario: Edit creates pattern for subsequent edit
  Given a file with content:
    """
    prefix_old suffix
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | old        | new        | false       |
    | new        | final      | false       |
  Then the file should contain:
    """
    prefix_final suffix
    """
  And both edits should succeed

Scenario: Edit removes pattern for subsequent edit
  Given a file with content:
    """
    remove_this and keep_this
    """
  When I apply edits in sequence:
    | old_string  | new_string | replace_all |
    | remove_this | gone       | false       |
    | remove_this | nothing    | false       |
  Then the file should contain:
    """
    gone and keep_this
    """
  And the first edit should succeed
  And the second edit should find no matches

Scenario: Large number of sequential edits
  Given a file with content containing 100 different replaceable patterns
  When I apply 100 sequential edits, each replacing a different pattern
  Then all edits should be applied successfully
  And the operation should complete in reasonable time
  And memory usage should remain bounded

Scenario: Edits with overlapping patterns
  Given a file with content:
    """
    abcdef
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | abc        | xyz        | false       |
    | xyz        | 123        | false       |
    | def        | 789        | false       |
  Then the file should contain:
    """
    123789
    """
  And all edits should be applied in the specified order

Scenario: Edit operations with whitespace patterns
  Given a file with content:
    """
    word1    word2		word3
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | word1      | first      | false       |
    |     | _SPACE_ | true        |
    | 		| _TAB_   | true        |
  Then whitespace should be replaced as specified
  And the exact whitespace characters should be preserved where not replaced

Scenario: Undo-like operation sequence
  Given a file with content:
    """
    original text
    """
  When I apply edits in sequence:
    | old_string   | new_string   | replace_all |
    | original     | modified     | false       |
    | modified     | original     | false       |
  Then the file should contain:
    """
    original text
    """
  And the operation should be reversible

Scenario: Multi-edit with Unicode patterns
  Given a file with content:
    """
    Hello 世界 and 🦀 Rust
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | 世界       | World      | false       |
    | 🦀         | crab       | false       |
    | Hello      | Hi         | false       |
  Then the file should contain:
    """
    Hi World and crab Rust
    """
  And all Unicode replacements should work correctly

Scenario: Performance characteristics of multi-edit
  Given a file with 10,000 lines of content
  When I apply 100 sequential edits
  Then the operation should complete within reasonable time bounds
  And memory usage should be proportional to content size, not number of edits
  And intermediate string allocations should be minimized

Scenario: Multi-edit atomic failure
  Given a file with content and some edits that would fail
  When I apply a multi-edit operation where one edit has an invalid pattern
  Then the operation should return an error
  And the file should remain unchanged (atomic behavior)
  And partial edits should not be applied

Scenario: Multi-edit with line ending changes
  Given a file with mixed line endings:
    """
    line1\r\n
    line2\n
    line3\r
    """
  When I apply edits in sequence:
    | old_string | new_string | replace_all |
    | line1      | first      | false       |
    | line2      | second     | false       |
    | line3      | third      | false       |
  Then the line endings should be preserved exactly
  And only the specified text should be modified

Scenario: Multi-edit idempotency
  Given a file with content:
    """
    test content
    """
  And a sequence of edit operations
  When I apply the same multi-edit operation twice
  Then the second application should produce identical results to the first
  And no additional changes should be made

Scenario: Multi-edit with empty string operations
  Given a file with content:
    """
    remove_this keep_this delete_this
    """
  When I apply edits in sequence:
    | old_string   | new_string | replace_all |
    | remove_this  |            | false       |
    | delete_this  |            | false       |
  Then the file should contain:
    """
     keep_this 
    """
  And empty replacements should effectively delete the patterns