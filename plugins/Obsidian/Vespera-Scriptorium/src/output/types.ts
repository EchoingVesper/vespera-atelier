/**
 * Defines the supported output formats for the OutputGenerator.
 */
export enum OutputFormat {
  MARKDOWN = 'markdown',
  JSON = 'json',
  HTML = 'html',
  PLAINTEXT = 'plaintext', // For simple text output
}

/**
 * Configuration options for output generation.
 */
export interface OutputOptions {
  /**
   * The format to generate output in.
   */
  format: OutputFormat;
  
  /**
   * Optional template name for integration with a dedicated OutputTemplates component.
   * This allows specifying a particular template to use for formatting.
   */
  templateName?: string;
  
  /**
   * Whether to include a header in the output, if applicable to the format/template.
   */
  includeHeader?: boolean;
  
  /**
   * Whether to include a footer in the output, if applicable to the format/template.
   */
  includeFooter?: boolean;

  /**
   * Whether to include metadata (from ProcessedData.metadata) in the output,
   * if applicable to the format/template.
   */
  includeMetadata?: boolean;

  /**
   * Allows passing format-specific or template-specific custom options.
   * For example, for Markdown: { tableOfContents: true, imageStyle: 'inline' }
   * For JSON: { prettyPrint: true, indent: 2 }
   */
  customOptions?: Record<string, any>;
}

/**
 * Represents the processed data that the OutputGenerator will use to create output.
 * This interface is designed to be flexible to accommodate various types of processed information.
 */
export interface ProcessedData {
  /**
   * The main content or data payload to be processed for output.
   * Its structure can vary widely depending on the preceding processing steps
   * (e.g., a string of Markdown, a structured object for JSON, an array of text blocks).
   */
  payload: any;

  /**
   * Optional metadata associated with the overall processed data.
   * This could include source information, processing statistics, timestamps, etc.
   * The OutputGenerator might use this if `OutputOptions.includeMetadata` is true.
   */
  metadata?: Record<string, any>;
}