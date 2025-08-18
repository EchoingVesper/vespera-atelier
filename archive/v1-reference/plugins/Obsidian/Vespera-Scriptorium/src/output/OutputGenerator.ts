import { OutputFormat, OutputOptions, ProcessedData } from './types';

/**
 * OutputGenerator is responsible for converting processed data into various output formats.
 * It supports multiple output formats including Markdown, JSON, and HTML.
 */
export class OutputGenerator {
  /**
   * Creates a new instance of OutputGenerator.
   * Dependencies like OutputTemplates can be injected here later.
   */
  constructor() {
    // Future dependencies can be injected here
  }

  /**
   * Generates formatted output from processed data based on the specified options.
   *
   * @param processedData - The data to be formatted, conforming to the ProcessedData interface (includes payload and optional metadata).
   * @param options - Configuration options for the output generation, conforming to the OutputOptions interface.
   * @returns Formatted output as a string or a JSON-compatible object.
   */
  public generateOutput(processedData: ProcessedData, options: OutputOptions): string | Record<string, any> {
    switch (options.format) {
      case OutputFormat.MARKDOWN:
        return this.generateMarkdownOutput(processedData, options);
      case OutputFormat.JSON:
        return this.generateJsonOutput(processedData, options);
      case OutputFormat.HTML:
        return this.generateHtmlOutput(processedData, options);
      case OutputFormat.PLAINTEXT:
        return this.generatePlaintextOutput(processedData, options);
      default:
        console.warn(`Unsupported output format: ${options.format}. Falling back to JSON stringify.`);
        // Fallback for unknown formats, attempt to stringify the payload.
        return JSON.stringify(processedData.payload ?? processedData);
    }
  }

  /**
   * Generates Markdown formatted output from the processed data.
   *
   * @param data - The ProcessedData object containing payload and optional metadata.
   * @param options - Configuration options for the output generation.
   * @returns Markdown formatted string.
   * @private
   */
  private generateMarkdownOutput(data: ProcessedData, options: OutputOptions): string {
    let output = "";
    const { payload, metadata } = data;

    if (options.includeHeader) {
      output += "# Generated Output\n\n";
    }

    // Markdown representation of the payload
    if (typeof payload === 'object' && payload !== null) {
      // If payload is an object, iterate its keys or use custom logic
      // For this example, we'll stringify it, but a real implementation would be more nuanced.
      output += `## Payload Content\n\n\`\`\`json\n${JSON.stringify(payload, null, 2)}\n\`\`\`\n\n`;
    } else {
      output += String(payload) + "\n\n";
    }

    if (options.includeMetadata && metadata) {
      output += "## Metadata\n\n";
      for (const key in metadata) {
        output += `*   **${key}:** ${JSON.stringify(metadata[key])}\n`;
      }
      output += "\n";
    }
    
    if (options.includeFooter) {
      output += "\n---\nEnd of Output\n";
    }
    
    return output;
  }

  /**
   * Generates JSON formatted output from the processed data.
   *
   * @param data - The ProcessedData object containing payload and optional metadata.
   * @param options - Configuration options for the output generation.
   * @returns JSON formatted string or object.
   * @private
   */
  private generateJsonOutput(data: ProcessedData, options: OutputOptions): Record<string, any> | string {
    const { payload, metadata } = data;
    let outputObject: Record<string, any> = { payload };

    if (options.includeMetadata && metadata) {
      outputObject.metadata = metadata;
    }
    
    const indent = options.customOptions?.prettyPrint ? (options.customOptions?.indent ?? 2) : undefined;
    return JSON.stringify(outputObject, null, indent);
  }

  /**
   * Generates HTML formatted output from the processed data.
   * This is a basic placeholder implementation.
   *
   * @param data - The ProcessedData object containing payload and optional metadata.
   * @param options - Configuration options for the output generation.
   * @returns HTML formatted string.
   * @private
   */
  private generateHtmlOutput(data: ProcessedData, options: OutputOptions): string {
    let output = "";
    const { payload, metadata } = data;

    if (options.includeHeader) {
      output += "<!DOCTYPE html>\n<html>\n<head><title>Generated Output</title></head>\n<body>\n";
      output += "<h1>Generated Output</h1>\n";
    }
    
    output += "<div class='payload-content'>\n";
    if (typeof payload === 'object' && payload !== null) {
      output += `<pre>${JSON.stringify(payload, null, 2)}</pre>\n`;
    } else {
      output += `<p>${String(payload)}</p>\n`;
    }
    output += "</div>\n";

    if (options.includeMetadata && metadata) {
      output += "<div class='metadata-content'>\n<h2>Metadata</h2>\n<ul>\n";
      for (const key in metadata) {
        output += `  <li><strong>${key}:</strong> ${JSON.stringify(metadata[key])}</li>\n`;
      }
      output += "</ul>\n</div>\n";
    }
    
    if (options.includeFooter) {
      output += "<hr>\n<footer>End of Output</footer>\n";
    }
    if (options.includeHeader) { // Close body and html if header was added
        output += "</body>\n</html>\n";
    }
    
    return output;
  }

  /**
   * Generates Plaintext formatted output from the processed data.
   *
   * @param data - The ProcessedData object containing payload and optional metadata.
   * @param options - Configuration options for the output generation.
   * @returns Plaintext formatted string.
   * @private
   */
  private generatePlaintextOutput(data: ProcessedData, options: OutputOptions): string {
    let output = "";
    const { payload, metadata } = data;

    if (options.includeHeader) {
      output += "--- Generated Output ---\n\n";
    }

    if (typeof payload === 'object' && payload !== null) {
      output += JSON.stringify(payload, null, options.customOptions?.indent ?? 2) + "\n";
    } else {
      output += String(payload) + "\n";
    }

    if (options.includeMetadata && metadata) {
      output += "\n--- Metadata ---\n";
      for (const key in metadata) {
        output += `${key}: ${JSON.stringify(metadata[key])}\n`;
      }
    }
    
    if (options.includeFooter) {
      output += "\n--- End of Output ---\n";
    }
    
    return output;
  }
}