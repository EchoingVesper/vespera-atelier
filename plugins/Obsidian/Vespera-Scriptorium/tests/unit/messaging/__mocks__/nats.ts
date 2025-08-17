// Mock implementation for the 'nats' module
import { vi } from 'vitest';

// Create a simple mock for the NATS connection
export const createMockConnection = () => ({
  close: vi.fn().mockResolvedValue(undefined),
  drain: vi.fn().mockResolvedValue(undefined),
  closed: vi.fn().mockResolvedValue(undefined),
  publish: vi.fn().mockResolvedValue(undefined),
  subscribe: vi.fn().mockReturnValue({
    unsubscribe: vi.fn().mockResolvedValue(undefined),
    isDraining: vi.fn().mockReturnValue(false),
  }),
  request: vi.fn().mockResolvedValue({
    data: new Uint8Array([123, 34, 114, 101, 115, 117, 108, 116, 34, 58, 34, 116, 101, 115, 116, 45, 114, 101, 115, 112, 111, 110, 115, 101, 34, 125]),
    json: () => Promise.resolve({ result: 'test-response' })
  }),
  getServer: vi.fn().mockReturnValue('nats://localhost:4222'),
  getServerVersion: vi.fn().mockReturnValue('2.9.0'),
  isClosed: vi.fn().mockReturnValue(false),
  isDraining: vi.fn().mockReturnValue(false),
  isReconnecting: vi.fn().mockReturnValue(false),
  stats: vi.fn().mockReturnValue({ inBytes: 0, outBytes: 0, inMsgs: 0, outMsgs: 0 }),
  info: {
    client_id: 'test-client',
    host: 'localhost',
    port: 4222,
    server_name: 'test-server',
    version: '2.9.0',
    proto: 1,
    headers: true,
    max_payload: 1048576,
    client_ip: '127.0.0.1'
  },
  disconnect: vi.fn().mockResolvedValue(undefined)
});

// Create a mock JSON codec
export const createMockJsonCodec = () => ({
  encode: vi.fn().mockImplementation((data) => JSON.stringify(data)),
  decode: vi.fn().mockImplementation((data) => JSON.parse(data.toString()))
});

// Create a mock subscription
export const createMockSubscription = () => ({
  unsubscribe: vi.fn().mockResolvedValue(undefined),
  isDraining: vi.fn().mockReturnValue(false)
});

// Create the mock NATS module
const mockNatsModule = {
  connect: vi.fn().mockResolvedValue(createMockConnection()),
  JSONCodec: vi.fn().mockImplementation(createMockJsonCodec),
  NatsConnection: {}
};

export default mockNatsModule;
