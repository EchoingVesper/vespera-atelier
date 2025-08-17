# Parser Module

**Responsibility:** Parses and normalizes content from Markdown, TXT, HTML, and CSV files.

## Overview

The Parser module is responsible for reading and normalizing content from different file formats. It provides a unified interface for parsing various file types and applies cleanup operations based on user settings.

## Exports

- `Parser` class: Main class for parsing files
- `createParser`: Factory function to create a Parser instance
- `ParseResult`: Interface for parser results
- `ParserError`: Custom error class for parser errors
- `SUPPORTED_EXTENSIONS`: Array of supported file extensions

## Usage

```typescript
import { createParser } from "./Parser";

// Create a parser instance
const parser = createParser(app.vault, settings);

// Parse a single file
const result = await parser.parseFile(file);
console.log(result.content); // Normalized text content
console.log(result.metadata); // File metadata

// Parse multiple files
const results = await parser.parseFiles(files);
```

## File Format Support

### Markdown/Text
- Uses Obsidian's Vault API (`vault.read(file)`)
- Returns raw content without modification

### HTML
- Uses DOMParser to extract visible text
- Removes script, style, and other non-content elements
- Handles malformed HTML gracefully

### CSV
- Uses papaparse to convert tabular data to text
- Preserves headers and data in a tab-separated format
- Handles parsing errors and inconsistent data

## Text Cleanup

The Parser applies cleanup operations based on user settings:

- **Whitespace**: Removes excessive whitespace, including multiple spaces and blank lines
- **Formatting**: Normalizes line endings and replaces tabs with spaces
- **Spelling**: (Not implemented in current version)
- **Punctuation**: (Not implemented in current version)

## Error Handling

The Parser provides robust error handling:

- `ParserError` class with file type and original error information
- Graceful handling of malformed files
- Detailed error messages for debugging

## Integration

The Parser module is integrated with the MultiSelectModal in the main workflow:

1. User selects files in the MultiSelectModal
2. Selected files are passed to the Parser
3. Parser normalizes content from different formats
4. Normalized content will be passed to the Chunker module (Milestone 4)

## Implementation Details

### DOMParser Usage

The HTML parser uses the browser's DOMParser to extract visible text:

```typescript
const parser = new DOMParser();
const doc = parser.parseFromString(content, "text/html");
// Remove script and style elements
const scripts = body.querySelectorAll("script, style, noscript, iframe, object, embed");
scripts.forEach(el => el.remove());
// Get the text content
return body.textContent || "";
```

### PapaParse Usage

The CSV parser uses PapaParse to convert tabular data to text:

```typescript
const result = Papa.parse(content, {
  header: true,
  skipEmptyLines: true
});

// Convert parsed data to text
let textContent = "";
// Add headers
textContent += result.meta.fields.join("\t") + "\n";
// Add data rows
for (const row of result.data) {
  const values = Object.values(row).map(val => String(val));
  textContent += values.join("\t") + "\n";
}
```

---
