import { describe, it, expect, vi, beforeEach, afterEach, Mock } from 'vitest';
import { natsClient } from '../../../src/core/messaging/natsClient';
import { MessageType } from '../../../src/core/messaging/types';
import type { NatsConnection, Subscription, Msg, ConnectionOptions } from 'nats';
import type { NatsClient } from '../../../src/core/messaging/natsClient';

// Type for our mock NatsConnection with all methods as mocks
type MockNatsConnection = NatsConnection & {
  [K in keyof NatsConnection]: NatsConnection[K] extends (...args: any[]) => any
    ? Mock
    : NatsConnection[K];
};

// Mock the NATS module
vi.mock('nats', () => {
  // Mock implementation
  const mockNatsConnection: MockNatsConnection = {
    close: vi.fn().mockResolvedValue(undefined),
    drain: vi.fn().mockResolvedValue(undefined),
    closed: vi.fn().mockResolvedValue(undefined),
    publish: vi.fn().mockResolvedValue(undefined),
    subscribe: vi.fn().mockImplementation((_subject, opts) => {
      const mockSub = {
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        isDraining: vi.fn().mockReturnValue(false),
        drain: vi.fn().mockResolvedValue(undefined),
        [Symbol.asyncIterator]: async function* () {
          // This simulates the async iterator that the real NATS client uses
          yield {
            data: new TextEncoder().encode(JSON.stringify({
              headers: {
                messageId: 'test-message-123',
                type: 'test.message',
                timestamp: new Date().toISOString()
              },
              body: { test: 'message' }
            }))
          };
        }
      };

      // Start processing messages in the background
      if (opts) {
        // The real implementation calls processMessages which processes the async iterator
        // We don't need to do anything here as the test will handle the async iteration
      }
      
      return mockSub;
    }),
    request: vi.fn().mockResolvedValue({
      data: new Uint8Array([123, 34, 114, 101, 115, 117, 108, 116, 34, 58, 34, 116, 101, 115, 116, 45, 114, 101, 115, 112, 111, 110, 115, 101, 34, 125]),
      json: vi.fn().mockResolvedValue({ result: 'test-response' })
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
      client_ip: '127.0.0.1',
      auth_required: false,
      tls_required: false,
      tls_verify: false,
      connect_urls: ['nats://localhost:4222'],
      ldms: 0,
      git_commit: '',
      go: '',
      jetstream: false,
      client_idle_timeout: 0
    },
    disconnect: vi.fn().mockResolvedValue(undefined),
    requestMany: vi.fn().mockResolvedValue(undefined),
    flush: vi.fn().mockResolvedValue(undefined),
    status: vi.fn().mockReturnValue(0),
    jetstreamManager: vi.fn().mockResolvedValue(undefined as any),
    jetstream: vi.fn().mockResolvedValue(undefined as any),
    rtt: vi.fn().mockResolvedValue(0),
    getClientIP: vi.fn().mockReturnValue('127.0.0.1'),
    [Symbol.asyncIterator]: vi.fn().mockReturnValue({
      next: vi.fn().mockResolvedValue({ done: true, value: undefined })
    })
  } as unknown as MockNatsConnection;

  // Create mocks
  const mockConnect = vi.fn().mockImplementation(async () => {
    // Set up the connection
    natsClient['isConnected'] = true;
    natsClient['nc'] = mockNatsConnection as any;
    
    // Set up the closed() method to return a resolved promise
    (mockNatsConnection as any).closed = vi.fn().mockResolvedValue(undefined);
    
    return mockNatsConnection;
  });
  
  const mockJSONCodec = vi.fn().mockReturnValue({
    encode: (data: unknown) => new TextEncoder().encode(JSON.stringify(data)),
    decode: (data: Uint8Array) => JSON.parse(new TextDecoder().decode(data))
  });

  return {
    connect: mockConnect,
    JSONCodec: mockJSONCodec,
    __mocks__: {
      mockNatsConnection,
      mockConnect,
      mockJSONCodec
    }
  };
});

// Import the mocked module and extract mocks
const nats = await import('nats');
const { mockNatsConnection, mockConnect, mockJSONCodec } = (nats as any).__mocks__;

describe('NATS Client', () => {
  // Helper function to check connection status without accessing private property
  const isConnected = () => natsClient['isConnected'] as boolean;
  
  // Store the original singleton instance properties
  const originalClient = { ...natsClient } as NatsClient;

  beforeEach(() => {
    // Reset all mocks before each test
    vi.clearAllMocks();
    
    // Reset the singleton instance
    Object.assign(natsClient, originalClient);
    natsClient['subscriptions'].clear();
    
    // Reset the mock implementation
    (mockNatsConnection.subscribe as Mock).mockClear();
    (mockNatsConnection.publish as Mock).mockClear();
    (mockNatsConnection.request as Mock).mockClear();
    
    // Reset the connect mock implementation
    mockConnect.mockImplementation(async () => {
      natsClient['isConnected'] = true;
      natsClient['nc'] = mockNatsConnection as any;
      
      // Ensure the closed() method is properly mocked
      (mockNatsConnection as any).closed = vi.fn().mockResolvedValue(undefined);
      
      return mockNatsConnection;
    });
  });

  afterEach(async () => {
    // Clean up any remaining connections
    if (isConnected()) {
      await natsClient.disconnect();
    }
    // Restore the original singleton instance
    Object.assign(natsClient, originalClient);
  });

  describe('connection', () => {
    it('should connect to NATS server', async () => {
      // Arrange
      const NatsClient = (await import('../../../src/core/messaging/natsClient')).NatsClient;
      const client = new NatsClient({
        servers: 'nats://localhost:4222',
        debug: true
      });
      
      // Mock the connect method to avoid actual connection
      const originalConnect = client.connect.bind(client);
      client.connect = vi.fn().mockImplementation(async () => {
        // Set up the connection directly in the test
        Object.defineProperty(client, 'isConnected', { value: true, writable: true });
        Object.defineProperty(client, 'nc', { value: mockNatsConnection, writable: true });
        await originalConnect();
      });
      
      // Act
      await client.connect();
      
      // Assert - Use type assertion to access private property for testing
      expect((client as any).isConnected).toBe(true);
      
      // Clean up
      await client.disconnect();
    });

    it('should handle connection errors', async () => {
      // Arrange
      const error = new Error('Connection failed');
      mockConnect.mockRejectedValueOnce(error);
      
      // Act & Assert
      await expect(natsClient.connect()).rejects.toThrow('Connection failed');
      expect(isConnected()).toBe(false);
    });

    it('should disconnect from NATS', async () => {
      // First connect
      await natsClient.connect();
      
      // Act
      await natsClient.disconnect();
      
      // Assert
      expect(mockNatsConnection.close).toHaveBeenCalledTimes(1);
      expect(isConnected()).toBe(false);
    });

    it('should handle disconnect when not connected', async () => {
      // Arrange
      natsClient['isConnected'] = false;
      
      // Act
      await natsClient.disconnect();
      
      // Assert
      expect(mockNatsConnection.close).not.toHaveBeenCalled();
    });
  });

  describe('publish', () => {
    it('should publish a message', async () => {
      // First connect
      await natsClient.connect();
      
      const message = {
        type: MessageType.TASK_REQUEST,
        payload: {
          taskId: 'test-task-123',
          taskType: 'test',
          parameters: { data: 'test' }
        },
        headers: {
          correlationId: 'test-correlation-123',
          messageId: 'test-message-123',
          timestamp: '2025-05-25T06:29:21.330Z',
          source: 'test-source',
          replyTo: 'test-reply'
        }
      };
      
      // Act
      await natsClient.publish('test.subject', message);
      
      // Assert
      expect(mockNatsConnection.publish).toHaveBeenCalledWith(
        'test.subject',
        expect.any(Uint8Array) // Expecting a Uint8Array (encoded JSON)
      );
      
      // Verify the published message structure
      const publishedData = JSON.parse(new TextDecoder().decode((mockNatsConnection.publish as Mock).mock.calls[0][1]));
      expect(publishedData).toHaveProperty('type', MessageType.TASK_REQUEST);
      expect(publishedData.payload).toHaveProperty('taskId', 'test-task-123');
      expect(publishedData.payload).toHaveProperty('taskType', 'test');
      expect(publishedData.payload.parameters).toEqual({ data: 'test' });
    });
  });

  describe('subscribe', () => {
    it('should subscribe to a subject and process messages', async () => {
      // Arrange
      const subject = 'test.subscribe';
      const handler = vi.fn().mockResolvedValue(undefined);
      
      // Create a promise that resolves when the handler is called
      let resolveHandler: () => void;
      const handlerCalled = new Promise<void>((resolve) => {
        resolveHandler = resolve;
      });
      
      // Setup the handler to resolve our promise when called
      handler.mockImplementationOnce(() => {
        resolveHandler();
        return Promise.resolve();
      });
      
      // Create a new client instance
      const NatsClient = (await import('../../../src/core/messaging/natsClient')).NatsClient;
      const client = new NatsClient({
        servers: 'nats://localhost:4222',
        debug: true
      });
      
      // Mock the connect method to avoid actual connection
      const originalConnect = client.connect.bind(client);
      client.connect = vi.fn().mockImplementation(async () => {
        await originalConnect();
        client['isConnected'] = true;
        client['nc'] = mockNatsConnection as any;
      });
      
      // Mock the subscription to return our test message
      const mockSubscription = {
        unsubscribe: vi.fn().mockResolvedValue(undefined),
        isDraining: vi.fn().mockReturnValue(false),
        drain: vi.fn().mockResolvedValue(undefined),
        [Symbol.asyncIterator]: async function* () {
          yield {
            data: new TextEncoder().encode(JSON.stringify({
              headers: {
                messageId: 'test-message-123',
                type: 'test.message',
                timestamp: new Date().toISOString()
              },
              body: { test: 'data' }
            }))
          };
        }
      };
      
      (mockNatsConnection.subscribe as Mock).mockReturnValue(mockSubscription);
      
      // Act
      await client.connect();
      const subscriptionId = await client.subscribe(subject, handler, { queue: 'test-queue' });

      // Assert that subscribe was called with the correct subject and queue
      expect(mockNatsConnection.subscribe).toHaveBeenCalledWith(
        subject,
        {
          queue: 'test-queue',
          max: undefined,
          timeout: undefined
        }
      );

      // Wait for the handler to be called or timeout after 1 second
      await Promise.race([
        handlerCalled,
        new Promise((_, reject) => setTimeout(() => reject(new Error('Handler not called within timeout')), 1000))
      ]);
      
      // Verify the handler was called with the expected message
      expect(handler).toHaveBeenCalledWith(expect.objectContaining({
        headers: expect.objectContaining({
          messageId: 'test-message-123',
          type: 'test.message'
        }),
        body: { test: 'data' }
      }));
      
      // Clean up
      await client.disconnect();
      await client.unsubscribe(subscriptionId);
    });
  });

  describe('request', () => {
    it('should handle request/response', async () => {
      // First connect
      await natsClient.connect();
      
      // Define test data with proper types
      interface TestTaskPayload {
        taskId: string;
        taskType: string;
        parameters: Record<string, unknown>;
        metadata?: Record<string, unknown>;
      }

      interface TestTaskResponse {
        taskId: string;
        status: string;
        result: { data: string };
      }

      interface TestMessage<T> {
        type: MessageType;
        payload: T;
        headers: {
          correlationId: string;
          messageId: string;
          timestamp: string;
          source: string;
          replyTo?: string;
        };
      }
      
      const testRequest: TestMessage<TestTaskPayload> = {
        type: MessageType.TASK_REQUEST,
        payload: {
          taskId: 'test-task-123',
          taskType: 'test-query',
          parameters: { query: 'test' },
          metadata: { test: true }
        },
        headers: {
          correlationId: 'test-correlation-123',
          messageId: 'test-message-123',
          timestamp: '2025-05-25T06:29:21.330Z',
          source: 'test-requester'
        }
      };
      
      const testResponse: TestMessage<TestTaskResponse> = {
        type: MessageType.TASK_COMPLETE,
        payload: {
          taskId: 'test-task-123',
          status: 'completed',
          result: { data: 'test-response' }
        },
        headers: {
          correlationId: 'test-correlation-123',
          messageId: 'test-message-124',
          timestamp: '2025-05-25T06:29:21.335Z',
          source: 'test-responder'
        }
      };
      
      // Mock the request response
      const mockResponse = {
        data: new TextEncoder().encode(JSON.stringify(testResponse)),
        json: vi.fn().mockResolvedValue(testResponse)
      } as unknown as Msg;
      
      (mockNatsConnection.request as Mock).mockResolvedValueOnce(mockResponse);
      
      // Make the request with proper typing
      const response = await natsClient.request<TestTaskPayload, TestTaskResponse>(
        'test.request', 
        testRequest
      );
      
      // Assert the request was made correctly
      expect(mockNatsConnection.request).toHaveBeenCalledWith(
        'test.request',
        expect.any(Uint8Array),
        expect.objectContaining({
          timeout: 5000 // Default timeout
        })
      );
      
      // Assert the response has the expected structure
      expect(response).toBeDefined();
      expect(response.type).toBe(MessageType.TASK_COMPLETE);
      
      // Verify the response payload structure
      const responsePayload = response.payload as TestTaskResponse;
      expect(responsePayload).toBeDefined();
      expect(responsePayload.taskId).toBe('test-task-123');
      expect(responsePayload.status).toBe('completed');
      expect(responsePayload.result).toEqual({ data: 'test-response' });
    });
  });
});
