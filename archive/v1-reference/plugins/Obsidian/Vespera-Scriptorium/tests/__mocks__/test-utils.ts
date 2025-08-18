import { Readable } from 'stream';

export const mockModel = {
  id: 'llama2',
  name: 'llama2',
  modifiedAt: '2023-01-01T00:00:00.000Z',
  size: 4000000000,
};

export const mockCompletionOptions = {
  model: 'llama2',
  temperature: 0.7,
  maxTokens: 100,
  topP: 0.9,
  frequencyPenalty: 0,
  presencePenalty: 0,
  stop: ['\n'],
};

export interface MockFetchResponseOptions {
  ok?: boolean;
  status?: number;
  statusText?: string;
  headers?: Record<string, string>;
  body?: any;
  json?: () => Promise<any>;
  text?: () => Promise<string>;
}

export function createMockFetchResponse(
  data: any,
  ok = true,
  status = 200,
  headers: Record<string, string> = { 'content-type': 'application/json' }
): Response {
  const responseHeaders = new Headers(headers);
  const responseBody = typeof data === 'string' ? data : JSON.stringify(data);
  
  return {
    ok,
    status,
    statusText: status === 200 ? 'OK' : 'Error',
    headers: responseHeaders,
    json: () => Promise.resolve(data),
    text: () => Promise.resolve(responseBody),
    arrayBuffer: () => Promise.resolve(new TextEncoder().encode(responseBody).buffer),
    blob: () => Promise.resolve(new Blob([responseBody])),
    clone: () => createMockFetchResponse(data, ok, status, headers),
    body: null,
    bodyUsed: false,
    redirected: false,
    type: 'basic',
    url: 'http://localhost:11434/api/generate',
  } as unknown as Response;
}

export function createMockStreamingResponse(
  chunks: Array<{ content?: string; done?: boolean }>,
  status = 200
): Response {
  const stream = new ReadableStream({
    start(controller) {
      for (const chunk of chunks) {
        controller.enqueue(new TextEncoder().encode(`data: ${JSON.stringify(chunk)}\n\n`));
      }
      controller.close();
    },
  });

  return new Response(stream, {
    status,
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
    },
  });
}

export function delay(ms: number): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms));
}
