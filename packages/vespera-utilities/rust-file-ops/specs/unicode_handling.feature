Feature: Unicode and Character Encoding Handling
  As a developer working with international content
  I want the library to handle Unicode correctly in all scenarios
  So that text editing works reliably across different languages and character sets

Background:
  Given the library uses UTF-8 encoding by default
  And all operations respect Unicode character boundaries
  And normalization form NFC is used for consistent representation

Scenario: Basic Unicode character replacement
  Given a file with content:
    """
    Hello 世界
    """
  When I replace "世界" with "World"
  Then the file should contain:
    """
    Hello World
    """
  And the Unicode characters should be handled as single logical units

Scenario: Emoji replacement
  Given a file with content:
    """
    Rust is 🦀 and 🔥
    """
  When I replace "🦀" with "awesome"
  Then the file should contain:
    """
    Rust is awesome and 🔥
    """
  And emoji should be treated as single characters for replacement

Scenario: Multi-byte character boundary preservation
  Given a file with content:
    """
    Café naïve résumé
    """
  When I replace "naïve" with "simple"
  Then the file should contain:
    """
    Café simple résumé
    """
  And accented characters should not be corrupted

Scenario: Surrogate pair handling
  Given a file with content containing mathematical symbols:
    """
    𝕳𝖊𝖑𝖑𝖔 mathematical bold
    """
  When I replace "𝕳𝖊𝖑𝖑𝖔" with "Hello"
  Then the file should contain:
    """
    Hello mathematical bold
    """
  And surrogate pairs should be treated as single logical characters

Scenario: Combining characters (diacritical marks)
  Given a file with content containing combining characters:
    """
    e + combining acute: e\u{0301}
    """
  When I replace "e\u{0301}" with "é"
  Then the file should contain:
    """
    e + combining acute: é
    """
  And combining character sequences should be handled atomically

Scenario: Unicode normalization equivalence
  Given a file with content containing decomposed characters:
    """
    Déjà vu: e\u{0301}
    """
  When I replace "é" with "e"
  And I replace "e\u{0301}" with "e"
  Then both composed and decomposed forms should be found and replaced
  And the result should be consistently normalized

Scenario: Zero-width characters
  Given a file with content containing zero-width space:
    """
    word\u{200B}break
    """
  When I replace "\u{200B}" with ""
  Then the file should contain:
    """
    wordbreak
    """
  And zero-width characters should be handled correctly

Scenario: Bidirectional text (RTL/LTR)
  Given a file with content containing Arabic text:
    """
    Hello שלום مرحبا World
    """
  When I replace "שלום" with "Peace"
  Then the file should contain:
    """
    Hello Peace مرحبا World
    """
  And bidirectional text markers should be preserved

Scenario: Unicode control characters
  Given a file with content containing various control characters:
    """
    Line1\u{0009}Tab\u{000A}NewLine\u{000D}Return
    """
  When I replace "\u{0009}" with "    "
  Then tab characters should be replaced with spaces
  And other control characters should remain unchanged

Scenario: Mixed scripts in single replacement
  Given a file with content:
    """
    English中文العربية日本語한국어
    """
  When I replace "中文العربية" with "Mixed"
  Then the file should contain:
    """
    EnglishMixed日本語한국어
    """
  And transitions between different scripts should work correctly

Scenario: Unicode string length calculations
  Given a file with content:
    """
    🦀🔥💯
    """
  When I replace "🔥" with "fire"
  Then the replacement should account for emoji taking multiple UTF-8 bytes
  And character positions should be calculated correctly

Scenario: Private use area characters
  Given a file with content containing private use characters:
    """
    Custom: \u{E000}\u{E001}\u{E002}
    """
  When I replace "\u{E001}" with "PRIVATE"
  Then the file should contain:
    """
    Custom: \u{E000}PRIVATE\u{E002}
    """
  And private use characters should be handled like any other Unicode

Scenario: Invalid UTF-8 byte sequences
  Given a file containing invalid UTF-8 byte sequences
  When I attempt any edit operation
  Then the operation should return EditError::InvalidUtf8
  And the error should include the position of the invalid sequence
  And no modifications should be made

Scenario: UTF-8 BOM (Byte Order Mark) preservation
  Given a file with content starting with UTF-8 BOM:
    """
    \u{FEFF}Content with BOM
    """
  When I replace "Content" with "Text"
  Then the file should contain:
    """
    \u{FEFF}Text with BOM
    """
  And the BOM should be preserved at the beginning

Scenario: Very long Unicode sequences
  Given a file with content containing 1000 Unicode characters of various scripts
  When I replace a substring containing mixed Unicode
  Then the operation should complete successfully
  And all character boundaries should be respected
  And memory usage should be reasonable

Scenario: Grapheme cluster boundaries
  Given a file with content containing complex grapheme clusters:
    """
    Family: 👨‍👩‍👧‍👦 Flag: 🏴󠁧󠁢󠁳󠁣󠁴󠁿
    """
  When I replace "👨‍👩‍👧‍👦" with "family"
  Then the file should contain:
    """
    Family: family Flag: 🏴󠁧󠁢󠁳󠁣󠁴󠁿
    """
  And complex grapheme clusters should be treated as single units

Scenario: Unicode case sensitivity
  Given a file with content:
    """
    ΕΛΛΗΝΙΚΆ ελληνικά
    """
  When I replace "ΕΛΛΗΝΙΚΆ" with "Greek" (case sensitive)
  Then the file should contain:
    """
    Greek ελληνικά
    """
  And only exact case matches should be replaced
  And Unicode case should be handled correctly

Scenario: Unicode whitespace characters
  Given a file with content containing various Unicode whitespace:
    """
    Word1\u{00A0}Word2\u{2009}Word3\u{3000}Word4
    """
  When I replace "\u{00A0}" with " "
  Then non-breaking space should be replaced with regular space
  And other Unicode whitespace should remain unchanged

Scenario: Unicode line terminators
  Given a file with content containing Unicode line separators:
    """
    Line1\u{2028}Line2\u{2029}Line3
    """
  When I replace "Line2" with "MiddleLine"
  Then the file should contain:
    """
    Line1\u{2028}MiddleLine\u{2029}Line3
    """
  And Unicode line terminators should be preserved

Scenario: Canonical vs compatibility equivalence
  Given a file with content containing compatibility characters:
    """
    ½ vs \u{0031}\u{2044}\u{0032}
    """
  When I replace "½" with "1/2"
  Then only the specified canonical form should be replaced
  And compatibility equivalents should remain unchanged

Scenario: Unicode normalization after editing
  Given a file with content in various normalization forms
  When I perform any edit operation
  Then the resulting text should be in NFC (canonical composed) form
  And normalization should be applied consistently throughout

Scenario: Zero-width joiner and non-joiner
  Given a file with content:
    """
    زویا\u{200C}ها vs combined\u{200D}text
    """
  When I replace "\u{200C}" with "_"
  Then the file should contain:
    """
    زویا_ها vs combined\u{200D}text
    """
  And zero-width formatting characters should be handled precisely

Scenario: Unicode version compatibility
  Given a file with content using newer Unicode characters
  When I perform edit operations
  Then the library should handle characters according to the Unicode version it supports
  And should gracefully handle unknown characters without corruption

Scenario: Performance with Unicode-heavy content
  Given a file with 10,000 lines of mixed-script Unicode content
  When I perform edit operations
  Then performance should degrade gracefully
  And memory usage should scale linearly with content size
  And Unicode processing should not cause significant overhead