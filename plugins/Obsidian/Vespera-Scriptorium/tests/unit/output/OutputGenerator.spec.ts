import { describe, it, expect, vi } from 'vitest';
import { OutputGenerator } from '../../../src/output/OutputGenerator';
import { OutputFormat, OutputOptions, ProcessedData } from '../../../src/output/types';

describe('OutputGenerator', () => {
  it('should be instantiable', () => {
    expect(new OutputGenerator()).toBeInstanceOf(OutputGenerator);
  });

  it('should have a generateOutput method', () => {
    const generator = new OutputGenerator();
    expect(generator.generateOutput).toBeTypeOf('function');
  });

  it('generateOutput should accept ProcessedData and OutputOptions (Markdown)', () => {
    const generator = new OutputGenerator();
    const processedData: ProcessedData = { payload: 'Test Payload', metadata: { author: 'Roo' } };
    const outputOptions: OutputOptions = { format: OutputFormat.MARKDOWN, includeMetadata: true };
    
    // Spy on the private method to avoid testing its full logic here
    const markdownSpy = vi.spyOn(generator as any, 'generateMarkdownOutput');

    expect(() => generator.generateOutput(processedData, outputOptions)).not.toThrow();
    expect(markdownSpy).toHaveBeenCalledWith(processedData, outputOptions);
    markdownSpy.mockRestore();
  });

  it('generateOutput should accept ProcessedData and OutputOptions (JSON)', () => {
    const generator = new OutputGenerator();
    const processedData: ProcessedData = { payload: { message: 'Test' }, metadata: { version: 1 } };
    const outputOptions: OutputOptions = { format: OutputFormat.JSON, customOptions: { prettyPrint: true } };
    
    const jsonSpy = vi.spyOn(generator as any, 'generateJsonOutput');

    expect(() => generator.generateOutput(processedData, outputOptions)).not.toThrow();
    expect(jsonSpy).toHaveBeenCalledWith(processedData, outputOptions);
    jsonSpy.mockRestore();
  });

  it('generateOutput should accept ProcessedData and OutputOptions (HTML)', () => {
    const generator = new OutputGenerator();
    const processedData: ProcessedData = { payload: '<p>Test HTML</p>' };
    const outputOptions: OutputOptions = { format: OutputFormat.HTML, includeHeader: true };

    const htmlSpy = vi.spyOn(generator as any, 'generateHtmlOutput');
    
    expect(() => generator.generateOutput(processedData, outputOptions)).not.toThrow();
    expect(htmlSpy).toHaveBeenCalledWith(processedData, outputOptions);
    htmlSpy.mockRestore();
  });

  it('generateOutput should accept ProcessedData and OutputOptions (PLAINTEXT)', () => {
    const generator = new OutputGenerator();
    const processedData: ProcessedData = { payload: 'Simple text output.' };
    const outputOptions: OutputOptions = { format: OutputFormat.PLAINTEXT };

    const plaintextSpy = vi.spyOn(generator as any, 'generatePlaintextOutput');

    expect(() => generator.generateOutput(processedData, outputOptions)).not.toThrow();
    expect(plaintextSpy).toHaveBeenCalledWith(processedData, outputOptions);
    plaintextSpy.mockRestore();
  });

  it('generateOutput should fallback for unsupported format', () => {
    const generator = new OutputGenerator();
    const consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {}); // Suppress console.warn
    const processedData: ProcessedData = { payload: { data: 'fallback test' } };
    const outputOptions: OutputOptions = { format: 'unsupported' as OutputFormat }; // Cast for testing

    const result = generator.generateOutput(processedData, outputOptions);
    expect(consoleWarnSpy).toHaveBeenCalledWith(`Unsupported output format: unsupported. Falling back to JSON stringify.`);
    expect(result).toBe(JSON.stringify(processedData.payload));
    
    consoleWarnSpy.mockRestore();
  });
});