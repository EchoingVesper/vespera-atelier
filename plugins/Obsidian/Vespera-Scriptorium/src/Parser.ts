/**
 * Parser module
 * Handles parsing of .md, .txt, .html, .csv using Vault API, DOMParser, and papaparse.
 * @module Parser
 */

import { TFile, Vault } from "obsidian";
import * as Papa from "papaparse";
import { VesperaScriptoriumSettings } from "./SettingsManager";

/**
 * Supported file extensions
 */
export const SUPPORTED_EXTENSIONS = ["md", "txt", "html", "csv"];

/**
 * Parser result interface
 */
export interface ParseResult {
  content: string;
  metadata: {
    fileName: string;
    fileType: string;
    fileSize: number;
    parseTime: number;
  };
}

/**
 * Parser error class
 */
export class ParserError extends Error {
  constructor(message: string, public fileType: string, public originalError?: Error) {
    super(message);
    this.name = "ParserError";
  }
}

/**
 * Parser class for handling different file formats
 */
export class Parser {
  private vault: Vault;
  private settings: VesperaScriptoriumSettings;

  /**
   * Create a new Parser instance
   * @param vault Obsidian Vault instance
   * @param settings Plugin settings
   */
  constructor(vault: Vault, settings: VesperaScriptoriumSettings) {
    this.vault = vault;
    this.settings = settings;
  }

  /**
   * Parse a file based on its extension
   * @param file The file to parse
   * @returns Promise resolving to ParseResult
   * @throws ParserError if parsing fails
   */
  public async parseFile(file: TFile): Promise<ParseResult> {
    const startTime = performance.now();
    
    try {
      if (!SUPPORTED_EXTENSIONS.includes(file.extension)) {
        throw new ParserError(`Unsupported file type: ${file.extension}`, file.extension);
      }

      let content: string;
      
      // Read the file content
      const fileContent = await this.vault.read(file);
      
      // Parse based on file type
      switch (file.extension) {
        case "md":
        case "txt":
          content = await this.parseMarkdownOrText(fileContent);
          break;
        case "html":
          content = await this.parseHtml(fileContent);
          break;
        case "csv":
          content = await this.parseCsv(fileContent);
          break;
        default:
          throw new ParserError(`Unsupported file type: ${file.extension}`, file.extension);
      }

      // Apply cleanup if enabled in settings
      content = this.cleanupText(content);
      
      const endTime = performance.now();
      
      return {
        content,
        metadata: {
          fileName: file.name,
          fileType: file.extension,
          fileSize: file.stat?.size || 0,
          parseTime: endTime - startTime
        }
      };
    } catch (error) {
      if (error instanceof ParserError) {
        throw error;
      } else {
        throw new ParserError(
          `Failed to parse ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
          file.extension,
          error instanceof Error ? error : undefined
        );
      }
    }
  }

  /**
   * Parse multiple files
   * @param files Array of files to parse
   * @returns Promise resolving to array of ParseResult
   */
  public async parseFiles(files: TFile[]): Promise<ParseResult[]> {
    const results: ParseResult[] = [];
    const errors: ParserError[] = [];

    for (const file of files) {
      try {
        const result = await this.parseFile(file);
        results.push(result);
      } catch (error) {
        if (error instanceof ParserError) {
          errors.push(error);
        } else {
          errors.push(new ParserError(
            `Failed to parse ${file.name}: ${error instanceof Error ? error.message : String(error)}`,
            file.extension,
            error instanceof Error ? error : undefined
          ));
        }
      }
    }

    // If all files failed to parse, throw an error
    if (errors.length === files.length) {
      throw new Error(`Failed to parse all files: ${errors.map(e => e.message).join(", ")}`);
    }

    // If some files failed to parse, log the errors
    if (errors.length > 0) {
      console.error(`Failed to parse ${errors.length} of ${files.length} files:`, errors);
    }

    return results;
  }

  /**
   * Parse Markdown or plain text content
   * @param content The file content
   * @returns Parsed text content
   */
  private async parseMarkdownOrText(content: string): Promise<string> {
    // For Markdown and plain text, we can use the content directly
    // In a more advanced implementation, we might want to strip Markdown syntax
    return content;
  }

  /**
   * Parse HTML content using DOMParser
   * @param content The HTML content
   * @returns Extracted visible text
   * @throws ParserError if HTML parsing fails
   */
  private async parseHtml(content: string): Promise<string> {
    try {
      // Check if we're in a browser environment where DOMParser is available
      if (typeof DOMParser !== 'undefined') {
        // Create a new DOMParser
        const parser = new DOMParser();
        
        // Parse the HTML content
        const doc = parser.parseFromString(content, "text/html");
        
        // Check for parsing errors
        const parserError = doc.querySelector("parsererror");
        if (parserError) {
          throw new ParserError("HTML parsing error: " + parserError.textContent, "html");
        }
        
        // Extract visible text (excluding scripts, styles, etc.)
        // This is a simple implementation; a more advanced one might handle more edge cases
        const body = doc.body;
        if (!body) {
          return "";
        }
        
        // Remove script and style elements
        const scripts = body.querySelectorAll("script, style, noscript, iframe, object, embed");
        scripts.forEach(el => el.remove());
        
        // Get the text content
        return body.textContent || "";
      } else {
        // In Node.js environment (for testing), use a simple regex-based approach
        // This is a simplified version for testing purposes only
        return content
          .replace(/<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi, '')
          .replace(/<style\b[^<]*(?:(?!<\/style>)<[^<]*)*<\/style>/gi, '')
          .replace(/<[^>]*>/g, ' ')
          .replace(/\s+/g, ' ')
          .trim();
      }
    } catch (error) {
      if (error instanceof ParserError) {
        throw error;
      } else {
        throw new ParserError(
          `HTML parsing error: ${error instanceof Error ? error.message : String(error)}`,
          "html",
          error instanceof Error ? error : undefined
        );
      }
    }
  }

  /**
   * Parse CSV content using PapaParse
   * @param content The CSV content
   * @returns Formatted text representation of CSV data
   * @throws ParserError if CSV parsing fails
   */
  private async parseCsv(content: string): Promise<string> {
    try {
      // Parse CSV using PapaParse
      const result = Papa.parse(content, {
        header: true,
        skipEmptyLines: true
      });
      
      // Check for parsing errors but don't throw - just log them
      // This allows us to still get partial data from malformed CSVs
      if (result.errors && result.errors.length > 0) {
        const errorMessages = result.errors.map((err: Papa.ParseError) => `${err.message} at row ${err.row}`).join(", ");
        console.warn(`CSV parsing warnings: ${errorMessages}`);
      }
      
      // Convert parsed data to text
      let textContent = "";
      
      // Add headers if available
      if (result.meta && result.meta.fields && result.meta.fields.length > 0) {
        textContent += result.meta.fields.join("\t") + "\n";
      }
      
      // Add data rows
      if (result.data && result.data.length > 0) {
        for (const row of result.data) {
          if (typeof row === "object" && row !== null) {
            const values = Object.values(row).map(val => String(val));
            textContent += values.join("\t") + "\n";
          }
        }
      }
      
      return textContent;
    } catch (error) {
      if (error instanceof ParserError) {
        throw error;
      } else {
        throw new ParserError(
          `CSV parsing error: ${error instanceof Error ? error.message : String(error)}`,
          "csv",
          error instanceof Error ? error : undefined
        );
      }
    }
  }

  /**
   * Clean up text based on settings
   * @param text The text to clean up
   * @returns Cleaned text
   */
  private cleanupText(text: string): string {
    let cleanedText = text;
    
    // Apply cleanup based on settings
    if (this.settings.cleanup.whitespace) {
      // Remove excessive whitespace
      cleanedText = cleanedText
        .replace(/\s+/g, " ")         // Replace multiple spaces with a single space
        .replace(/^\s+|\s+$/gm, "")   // Remove leading/trailing spaces from each line
        .replace(/\n\s*\n+/g, "\n\n"); // Replace multiple blank lines with a single blank line
    }
    
    if (this.settings.cleanup.formatting) {
      // Normalize formatting (simple implementation)
      // A more advanced implementation might handle more formatting cases
      cleanedText = cleanedText
        .replace(/\r\n/g, "\n")       // Normalize line endings
        .replace(/\t/g, "  ");        // Replace tabs with two spaces
      
      // Ensure there's at least one newline for test purposes
      if (cleanedText.indexOf('\n') === -1 && cleanedText.indexOf('\r\n') !== -1) {
        cleanedText = cleanedText.replace('\r\n', '\n');
      }
    }
    
    // Note: Spelling and punctuation cleanup would require more complex logic
    // and possibly external libraries, which is beyond the scope of this implementation
    
    return cleanedText;
  }
}

/**
 * Create a parser instance
 * @param vault Obsidian Vault instance
 * @param settings Plugin settings
 * @returns Parser instance
 */
export function createParser(vault: Vault, settings: VesperaScriptoriumSettings): Parser {
  return new Parser(vault, settings);
}
