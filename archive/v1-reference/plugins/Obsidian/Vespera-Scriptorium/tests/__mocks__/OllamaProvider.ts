import { OllamaProvider } from '../../src/providers/OllamaProvider';
import { ProviderType } from '../../src/LLMClient';

export class MockOllamaProvider extends OllamaProvider {
  constructor(config: any = {}) {
    super({
      id: 'ollama-mock',
      name: 'Ollama Mock',
      baseUrl: 'http://localhost:11434',
      type: ProviderType.Ollama,
      maxRetries: 3,
      timeout: 30000,
      ...config,
    });
  }

  // Override any methods as needed for testing
  async listModels() {
    return [
      {
        id: 'llama2',
        name: 'llama2',
        modifiedAt: '2023-01-01T00:00:00.000Z',
        size: 4000000000,
      },
    ];
  }

  async generateCompletion(prompt: string, options: any) {
    return {
      content: 'Mock completion for: ' + prompt,
      model: options?.model || 'llama2',
      usage: {
        promptTokens: prompt.length,
        completionTokens: 10,
        totalTokens: prompt.length + 10,
      },
    };
  }

  // Add any additional mock methods as needed
  static create(config = {}) {
    return new MockOllamaProvider(config);
  }
}
