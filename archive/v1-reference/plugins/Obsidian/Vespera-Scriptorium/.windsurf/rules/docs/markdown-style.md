---
trigger: glob
globs: *.md
---

# Markdown Style Guide

## Basic Formatting

1. Use ATX-style headers with a space after the hash marks
   - Correct: `# Header`
   - Incorrect: `#Header`

2. Surround headers with blank lines

   ```markdown
   Text before header.

   ## Header

   Text after header.
   ```

3. Use a single blank line at the end of files

4. Use explicit numbering in ordered lists

   ```markdown
   1. First item
   2. Second item
   3. Third item
   ```

5. Limit line length to 120 characters
   - Except in code blocks and tables

## Code Blocks

1. Always specify the language for syntax highlighting

   ````markdown
   ```typescript
   function example(): void {
     console.log("Hello world");
   }
   ```
   ````

2. Indent code blocks properly within lists

   ```markdown
   1. Item with code:
      \`\`\`typescript
      const x = 1;
      \`\`\`

   ```

3. Escape backticks in nested code blocks with backslashes
   - Use `\`\`\`` instead of ``` when showing code blocks within code blocks
   - This prevents markdown parsers from incorrectly interpreting nested fences

## Links and References

1. Use reference-style links for repeated URLs

   ```markdown
   [link text][reference]

   [reference]: https://example.com
   ```

2. Use relative links for internal documentation

   ```markdown
   [Other Document](../other-folder/document.md)
   ```

## Tables

1. Use table formatting with leading and trailing pipes

   ```markdown
   | Column 1 | Column 2 |
   |----------|----------|
   | Data 1   | Data 2   |
   ```

## Last Updated Dates

1. Always include a "Last Updated" date at the end of documents, followed by a single newline

   ```markdown
   ## Last Updated: 2025-05-25

   ```

## Last Updated: 2025-05-25
