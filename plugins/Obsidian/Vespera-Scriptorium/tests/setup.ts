// Global test setup
import { vi, beforeEach, afterEach } from 'vitest';
import { fetch as undiciFetch } from 'undici';

// Add global types
declare global {
  // eslint-disable-next-line no-var
  var fetch: typeof undiciFetch;
  // eslint-disable-next-line no-var
  var process: {
    env: {
      NODE_ENV?: string;
      [key: string]: string | undefined;
    };
  };
}

// Mock global.fetch
const mockFetch = vi.fn();
global.fetch = mockFetch;

// Mock process.env
const originalEnv = process.env;
global.process = {
  env: {
    ...originalEnv,
    NODE_ENV: 'test',
  },
};

// Reset mocks before each test
beforeEach(() => {
  vi.resetAllMocks();
  vi.spyOn(console, 'error').mockImplementation(() => {});
  vi.spyOn(console, 'warn').mockImplementation(() => {});
});

// Restore globals after each test
afterEach(() => {
  vi.restoreAllMocks();
});

// Set up any other global mocks or configuration here
vi.mock('node-fetch', () => ({
  default: mockFetch,
  __esModule: true,
}));

// Mock NATS
vi.mock('nats', () => {
  return {
    connect: vi.fn().mockResolvedValue({
      drain: vi.fn().mockResolvedValue(undefined),
      status: vi.fn().mockImplementation(() => {
        return {
          [Symbol.asyncIterator]: () => ({
            next: async () => ({ done: false, value: { type: 'connect' } }),
          }),
        };
      }),
      publish: vi.fn().mockResolvedValue(undefined),
      subscribe: vi.fn().mockImplementation(() => ({
        unsubscribe: vi.fn(),
        getSubject: vi.fn().mockReturnValue('test.subject'),
        getProcessed: vi.fn().mockReturnValue(0),
        getReceived: vi.fn().mockReturnValue(0),
        getMax: vi.fn().mockReturnValue(0),
        getID: vi.fn().mockReturnValue('test-subscription'),
        closed: false,
      })),
    }),
    JSONCodec: vi.fn().mockReturnValue({
      encode: vi.fn().mockImplementation((data) => Buffer.from(JSON.stringify(data))),
      decode: vi.fn().mockImplementation((data) => JSON.parse(data.toString())),
    }),
    __esModule: true,
  };
});