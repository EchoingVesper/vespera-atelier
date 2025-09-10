Feature: Precise String Editing Operations
  As a developer using the vespera-file-ops library
  I want to perform exact string replacement operations 
  So that I can make precise code modifications without unintended changes

Background:
  Given the library is configured with UTF-8 encoding
  And whitespace preservation is enabled by default

Scenario: Single occurrence replacement with first match only
  Given a file with content:
    """
    fn main() {
        let foo = "value";
        println!("{}", foo);
    }
    """
  When I replace "foo" with "variable" (first occurrence only)
  Then the file should contain:
    """
    fn main() {
        let variable = "value";
        println!("{}", foo);
    }
    """
  And the operation should return EditResult with 1 replacement

Scenario: All occurrences replacement
  Given a file with content:
    """
    const foo = foo + foo;
    """
  When I replace all occurrences of "foo" with "bar"
  Then the file should contain:
    """
    const bar = bar + bar;
    """
  And the operation should return EditResult with 3 replacements

Scenario: Preserve exact whitespace and indentation
  Given a file with content:
    """
      const    foo    =    "value"  ;
    """
  When I replace "foo" with "variable"
  Then the file should contain:
    """
      const    variable    =    "value"  ;
    """
  And all surrounding whitespace should remain unchanged
  And tab vs space characters should be preserved exactly

Scenario: Pattern not found returns unchanged content
  Given a file with content:
    """
    const bar = 123;
    const baz = 456;
    """
  When I try to replace "nonexistent" with "replacement"
  Then the operation should return EditResult with 0 replacements
  And the file content should remain unchanged
  And no error should be thrown

Scenario: Multiple matches without replace_all flag should replace first only
  Given a file with content:
    """
    test line one
    test line two
    test line three
    """
  When I replace "test" with "example" (first occurrence only)
  Then the file should contain:
    """
    example line one
    test line two
    test line three
    """
  And the operation should return EditResult with 1 replacement

Scenario: Empty string replacement (deletion)
  Given a file with content:
    """
    Hello, World!
    """
  When I replace "Hello, " with ""
  Then the file should contain:
    """
    World!
    """
  And the operation should return EditResult with 1 replacement

Scenario: Empty string pattern should return error
  Given a file with any content
  When I try to replace "" with "replacement"
  Then the operation should return EditError::EmptyPattern
  And the file should remain unchanged

Scenario: Replace with identical string is idempotent
  Given a file with content:
    """
    The quick brown fox
    """
  When I replace "quick" with "quick"
  Then the file should contain:
    """
    The quick brown fox
    """
  And the operation should return EditResult with 1 replacement
  And a second identical operation should produce identical results

Scenario: Case sensitive replacement
  Given a file with content:
    """
    Hello HELLO hello
    """
  When I replace "hello" with "hi" (case sensitive)
  Then the file should contain:
    """
    Hello HELLO hi
    """
  And only exact case matches should be replaced
  And the operation should return EditResult with 1 replacement

Scenario: Pattern spans multiple lines
  Given a file with content:
    """
    first line
    second line
    third line
    """
  When I replace "line\nsecond line" with "line\nmodified line"
  Then the file should contain:
    """
    first line
    modified line
    third line
    """
  And line endings should be preserved exactly

Scenario: Replace at beginning of file
  Given a file with content:
    """
    start of content here
    """
  When I replace "start" with "beginning"
  Then the file should contain:
    """
    beginning of content here
    """

Scenario: Replace at end of file
  Given a file with content:
    """
    content ends here
    """
  When I replace "here" with "now"
  Then the file should contain:
    """
    content ends now
    """

Scenario: Replace entire file content
  Given a file with content:
    """
    old content
    """
  When I replace "old content" with "new content"
  Then the file should contain:
    """
    new content
    """

Scenario: Pattern contains special regex characters (literal match)
  Given a file with content:
    """
    Cost is $5.00 (price)
    """
  When I replace "$5.00 (price)" with "$6.00 (updated)"
  Then the file should contain:
    """
    Cost is $6.00 (updated)
    """
  And special characters should be treated literally, not as regex

Scenario: Very long pattern replacement
  Given a file with content containing a 1000-character line
  When I replace the entire 1000-character string with "short"
  Then the replacement should succeed
  And the file should contain "short"
  And memory usage should be reasonable

Scenario: Pattern occurs at character boundaries
  Given a file with content:
    """
    testing testable test
    """
  When I replace "test" with "exam"
  Then the file should contain:
    """
    examing examable exam
    """
  And only complete word boundaries should be matched

Scenario: Overlapping pattern candidates
  Given a file with content:
    """
    aaaaaa
    """
  When I replace "aaa" with "b" (first occurrence only)
  Then the file should contain:
    """
    baaa
    """
  And only the first occurrence should be replaced
  And the operation should return EditResult with 1 replacement

Scenario: Pattern replacement changes file size significantly
  Given a file with content:
    """
    x
    """
  When I replace "x" with a 10000-character string
  Then the replacement should succeed
  And the file size should increase appropriately
  And memory allocation should be efficient