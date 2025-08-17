import { describe, it, expect, vi, beforeEach } from 'vitest';
import { LLMProcessingService } from '../../src/services/LLMProcessingService';
import { VesperaScriptoriumSettings, DEFAULT_SETTINGS } from '../../src/SettingsManager';
import { ProgressManager } from '../../src/ui/ProgressPane';

// Mock LLMClient that can simulate slow/fast responses
class MockLLMClient {
  public generateCompletion = vi.fn();
}

describe('LLMProcessingService - Per-Chunk Timeout', () => {
  let service: LLMProcessingService;
  let settings: VesperaScriptoriumSettings;
  let mockLLMClient: any;
  let progressManager: ProgressManager;

  beforeEach(() => {
    settings = JSON.parse(JSON.stringify(DEFAULT_SETTINGS));
    settings.llm.chunkTimeout = 100; // 100ms for test
    mockLLMClient = new MockLLMClient();
    progressManager = {
      createProgressItem: vi.fn(),
      updateProgressItem: vi.fn(),
      removeProgressItem: vi.fn(),
    } as any;
    service = new LLMProcessingService(
      {} as any, // app
      settings,
      mockLLMClient
    );
  });

  it('should timeout only the slow chunk and process the fast one', async () => {
    // Fast chunk resolves in 10ms, slow chunk in 200ms
    mockLLMClient.generateCompletion.mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => resolve('FAST_SUMMARY'), 10))
    );
    mockLLMClient.generateCompletion.mockImplementationOnce(() =>
      new Promise((resolve) => setTimeout(() => resolve('SLOW_SUMMARY'), 200))
    );

    const chunks = ['fast text', 'slow text'];
    const prompt = 'Summarize:';
    const result = await service['standardProcessChunks'](chunks, 'testfile.md', prompt, progressManager);

    expect(result).toContain('FAST_SUMMARY');
    expect(result).toContain('Timeout processing chunk 2/2');
    expect(result).not.toContain('SLOW_SUMMARY');
  });

  it('should process all fast chunks without timeout', async () => {
    mockLLMClient.generateCompletion.mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve('OK'), 10))
    );
    const chunks = ['a', 'b', 'c'];
    const prompt = 'Summarize:';
    const result = await service['standardProcessChunks'](chunks, 'f.md', prompt, progressManager);
    expect(result).not.toContain('Timeout');
    expect(result.match(/OK/g)?.length).toBe(3);
  });

  it('should timeout all slow chunks', async () => {
    mockLLMClient.generateCompletion.mockImplementation(() =>
      new Promise((resolve) => setTimeout(() => resolve('SLOW'), 200))
    );
    const chunks = ['x', 'y'];
    const prompt = 'Summarize:';
    const result = await service['standardProcessChunks'](chunks, 'slow.md', prompt, progressManager);
    expect(result).toContain('Timeout processing chunk 1/2');
    expect(result).toContain('Timeout processing chunk 2/2');
    expect(result).not.toContain('SLOW');
  });
});
