# Parser Module

**Role in Processing Pipeline:** Acts as an initial input or early-stage processing node for parsing and normalizing content from various file formats.

## Overview

Within the new n8n-inspired processing pipeline, the Parser module functions as a dedicated node responsible for ingesting raw file content and transforming it into a standardized, normalized text format suitable for subsequent processing stages. It handles various file types, extracts relevant text, and applies cleanup rules, acting as the gateway for document content entering the pipeline.

## Exports

- `Parser` class: Main class for parsing files
- `createParser`: Factory function to create a Parser instance
- `ParseResult`: Interface for parser results
- `ParserError`: Custom error class for parser errors
- `SUPPORTED_EXTENSIONS`: Array of supported file extensions

## Pipeline Integration

The Parser node typically resides at the beginning of a processing workflow. It receives input that identifies the source document(s), such as file paths. The node then reads the content of these files, applies format-specific parsing logic (for Markdown, HTML, CSV, etc.), and performs text normalization based on configured settings. The primary output of the Parser node is the clean, normalized text content, along with any extracted metadata. This output is then made available for the next node in the pipeline, commonly by being placed into a file-based queue, allowing the pipeline orchestrator to manage the flow to nodes like the Chunker.

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

## Integration

The Parser module is integrated with the MultiSelectModal in the main workflow:

1. User selects files in the MultiSelectModal
2. Selected files are passed to the Parser
3. Parser normalizes content from different formats
4. Normalized content will be passed to the Chunker module (Milestone 4)

## File Format Support

The Parser node is equipped to handle content from several common file formats, ensuring broad compatibility for documents entering the pipeline:

### Markdown/Text
- Directly reads and outputs the raw text content of `.md` and `.txt` files.

### HTML
- Utilizes a DOM parsing approach to extract visible text content, stripping away HTML tags, scripts, styles, and other non-content elements to produce clean text.

### CSV
- Processes tabular data from `.csv` files, converting it into a structured text format (e.g., tab-separated) while preserving headers and data integrity.

## Text Cleanup

As part of its normalization process, the Parser node applies configurable text cleanup operations to the extracted content before passing it to the next pipeline stage. These operations help ensure consistency and remove potential noise:

- **Whitespace**: Reduces excessive whitespace, including multiple spaces and blank lines.
- **Formatting**: Standardizes line endings and replaces tabs with spaces.

## Error Handling

The Parser node incorporates robust error handling to manage issues that may arise during file reading or parsing, such as malformed files or unsupported formats. It provides specific error types (e.g., `ParserError`) and detailed messages to facilitate debugging and allow the pipeline orchestrator to implement appropriate error recovery strategies.

## Implementation Details

### DOMParser Usage

For HTML files, the parser node internally uses the browser's `DOMParser` to build a Document Object Model and then extracts the text content while filtering out irrelevant elements.

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

For CSV files, the parser node utilizes the `papaparse` library to efficiently parse the tabular data and then formats it into a plain text representation.

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
