import { vi, beforeEach, afterEach } from 'vitest';
import { natsClient } from '../../src/core/messaging/natsClient';

// Create a simple mock connection
const mockConnection = {
  close: vi.fn().mockResolvedValue(undefined),
  drain: vi.fn().mockResolvedValue(undefined),
  closed: vi.fn().mockImplementation(() => {
    // Return a real Promise that resolves immediately
    return Promise.resolve();
  }),
  // Add other necessary methods with proper mocks
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockReturnValue({
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    closed: Promise.resolve()
  }),
  request: vi.fn().mockResolvedValue({
    data: new Uint8Array([123, 34, 114, 101, 115, 117, 108, 116, 34, 58, 34, 116, 101, 115, 116, 45, 114, 101, 115, 112, 111, 110, 115, 101, 34, 125]),
    json: () => Promise.resolve({ result: 'test-response' })
  }),
  disconnect: vi.fn().mockResolvedValue(undefined),
  isClosed: vi.fn().mockReturnValue(false),
  isDraining: vi.fn().mockReturnValue(false),
};

// Add bind methods
mockConnection.close.bind = vi.fn().mockReturnThis();
mockConnection.disconnect.bind = vi.fn().mockReturnThis();
mockConnection.publish.bind = vi.fn().mockReturnThis();
mockConnection.request.bind = vi.fn().mockReturnThis();
mockConnection.subscribe.bind = vi.fn().mockReturnThis();

// Mock JSONCodec
const mockJsonCodec = {
  encode: vi.fn().mockImplementation((data) => Buffer.from(JSON.stringify(data))),
  decode: vi.fn().mockImplementation((data) => JSON.parse(Buffer.from(data).toString()))
};

// Mock the NATS module
vi.mock('nats', () => ({
  connect: vi.fn().mockResolvedValue(mockConnection),
  JSONCodec: vi.fn().mockReturnValue(mockJsonCodec),
}));

// Reset mocks between tests
beforeEach(() => {
  vi.clearAllMocks();
  
  // Reset default mock implementations
  mockConnection.publish.mockResolvedValue(undefined);
  mockConnection.request.mockResolvedValue({
    data: new Uint8Array([123, 34, 114, 101, 115, 117, 108, 116, 34, 58, 34, 116, 101, 115, 116, 45, 114, 101, 115, 112, 111, 110, 115, 101, 34, 125]),
    json: () => Promise.resolve({ result: 'test-response' })
  });
  
  // Reset the closed mock
  mockConnection.closed.mockImplementation(() => ({
    then: (onFulfilled?: (value: void) => void | PromiseLike<void>) => {
      if (onFulfilled) {
        onFulfilled();
      }
      return {
        catch: (onRejected?: (reason: any) => void | PromiseLike<void>) => {
          return Promise.resolve().catch(onRejected);
        }
      };
    },
    catch: (onRejected?: (reason: any) => void | PromiseLike<void>) => {
      return Promise.resolve().catch(onRejected);
    }
  }));
});

afterEach(() => {
  vi.restoreAllMocks();
});

// Export the mock connection for use in tests
export { mockConnection, mockJsonCodec };
