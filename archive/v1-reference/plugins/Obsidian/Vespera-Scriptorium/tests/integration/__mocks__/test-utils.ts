import { vi } from 'vitest';
import type { LLMProvider, Model, CompletionOptions } from '../../../src/LLMClient';

export const mockModel: Model = {
  id: 'llama2',
  name: 'Llama 2',
  provider: 'ollama',
  contextWindow: 4096,
  maxTokens: 2048,
};

export const mockCompletionOptions: CompletionOptions = {
  model: 'llama2',
  temperature: 0.7,
  maxTokens: 100,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stopSequences: ['\n'],
};

export function createMockFetchResponse(data: any, ok = true, status = 200) {
  return Promise.resolve({
    ok,
    status,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(JSON.stringify(data)),
    headers: new Headers({ 'Content-Type': 'application/json' }),
  });
}

export function createMockStreamingResponse(chunks: string[]) {
  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(encoder.encode(chunk));
        await new Promise(resolve => setTimeout(resolve, 10));
      }
      controller.close();
    },
  });

  return Promise.resolve(new Response(stream, {
    headers: { 'Content-Type': 'application/x-ndjson' },
  }));
}

export function mockProviderMethods(provider: LLMProvider) {
  return {
    listModels: vi.spyOn(provider, 'listModels'),
    generateCompletion: vi.spyOn(provider, 'generateCompletion'),
    streamCompletion: vi.spyOn(provider, 'streamCompletion'),
    getTokenUsage: vi.spyOn(provider, 'getTokenUsage'),
  };
}
