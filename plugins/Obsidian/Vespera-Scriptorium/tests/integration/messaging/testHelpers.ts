import { vi } from 'vitest';
import { Message, MessageType, TaskStatus } from '../../../src/core/messaging/types';

// Define ServiceStatus enum since it's not exported from types.ts
export enum ServiceStatus {
  ONLINE = 'ONLINE',
  OFFLINE = 'OFFLINE',
  DEGRADED = 'DEGRADED',
  STARTING = 'STARTING',
  STOPPING = 'STOPPING'
}

// Define interfaces for the NATS client
export interface NatsClient {
  connect(): Promise<void>;
  disconnect(): Promise<void>;
  isConnected(): boolean;
  publish<T = any>(subject: string, message: Message<T>): Promise<void>;
  subscribe<T = any>(subject: string, callback: (message: Message<T>) => void | Promise<void>): Promise<string>;
  unsubscribe(subscriptionId: string): Promise<void>;
  request<T = any, R = any>(subject: string, message: Message<T>, options?: { timeout?: number }): Promise<{ data: R }>;
}

// Define interface for the mock NATS client
export interface MockNatsClient extends NatsClient {
  waitForMessage(subscription: string, timeout: number): Promise<any>;
  __subscriptionCallbacks: Map<string, (message: any) => void | Promise<void>>;
  __triggerSubscription(subject: string, message: any): Promise<void>;
}

// Define result interface for createNatsClientMock
export interface NatsClientMockResult {
  mockClient: MockNatsClient;
  mockFunctions: {
    publish: ReturnType<typeof vi.fn>;
    subscribe: ReturnType<typeof vi.fn>;
    unsubscribe: ReturnType<typeof vi.fn>;
    waitForMessage: ReturnType<typeof vi.fn>;
    request: ReturnType<typeof vi.fn>;
  };
  subscriptionCallbacks: Map<string, (message: any) => void | Promise<void>>;
  triggerSubscription(subject: string, message: any): Promise<void>;
}

// Define interfaces for the advanced feature managers
export interface MessagePersistenceManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  persistMessage(subject: string, message: Message<unknown>): Promise<string>;
  retrieveMessage(messageId: string): Promise<Message<unknown> | null>;
  getPendingMessages(): Promise<Array<{id: string; message: Message<unknown>}>>;
  attemptDelivery(subject: string, message: Message<unknown>, targetService: string): Promise<{delivered: boolean; deferred: boolean}>;
}

export interface LoadBalancingOptions {
  taskType?: string;
  strategy?: string;
  excludeServices?: string[];
  priority?: number;
}

export interface LoadBalancerManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerService(serviceId: string, options: {capabilities: string[]; load: number; priority: number}): void;
  selectServiceForTask(options?: LoadBalancingOptions): Promise<string | null>;
}

export interface MessagePrioritizationManager {
  initialize(): Promise<void>;
  shutdown(): Promise<void>;
  registerRule(ruleName: string, condition: (message: Message<unknown>) => boolean, priority: number): void;
  getPriority(message: Message<unknown>): Promise<number>;
}

/**
 * Creates a standardized mock for the NATS client to be used across all tests
 */
export function createNatsClientMock(): NatsClientMockResult {
  // Create a map to store subscription callbacks
  const subscriptionCallbacks = new Map<string, (message: any) => void | Promise<void>>();
  
  // Create mock functions
  const mockPublish = vi.fn().mockResolvedValue(undefined);
  const mockSubscribe = vi.fn().mockImplementation((subject: string, callback: (message: any) => void | Promise<void>) => {
    subscriptionCallbacks.set(subject, callback);
    return Promise.resolve(`subscription-${subject}`);
  });
  const mockUnsubscribe = vi.fn().mockResolvedValue(undefined);
  const mockWaitForMessage = vi.fn().mockImplementation((_subscription: string, _timeout: number) => Promise.resolve(null));
  const mockRequest = vi.fn().mockImplementation((subject: string, message: any, _options?: { timeout?: number }) => {
    const callback = subscriptionCallbacks.get(subject);
    if (callback) {
      setTimeout(() => callback(message), 10);
    }
    return Promise.resolve({ data: { result: 'test-response' } });
  });
  
  // Helper function to safely handle callback results
  const safelyHandleCallback = (callback: (message: any) => void | Promise<void>, message: any): Promise<void> => {
    try {
      const result = callback(message);
      if (result && typeof result.then === 'function') {
        return result;
      }
    } catch (error) {
      console.error('Error in subscription callback:', error);
    }
    return Promise.resolve();
  };
  
  // Create the trigger function
  const triggerSubscription = (subject: string, message: any): Promise<void> => {
    const callback = subscriptionCallbacks.get(subject);
    if (callback) {
      return safelyHandleCallback(callback, message);
    }
    return Promise.resolve();
  };
  
  // Create the mock client
  const mockClient = {
    publish: mockPublish,
    subscribe: mockSubscribe,
    unsubscribe: mockUnsubscribe,
    waitForMessage: mockWaitForMessage,
    isConnected: () => true,
    connect: vi.fn().mockResolvedValue(undefined),
    disconnect: vi.fn().mockResolvedValue(undefined),
    request: mockRequest,
    __subscriptionCallbacks: subscriptionCallbacks,
    __triggerSubscription: triggerSubscription
  } as MockNatsClient;
  
  return {
    mockClient,
    mockFunctions: {
      publish: mockPublish,
      subscribe: mockSubscribe,
      unsubscribe: mockUnsubscribe,
      waitForMessage: mockWaitForMessage,
      request: mockRequest
    },
    subscriptionCallbacks,
    triggerSubscription
  };
}

/**
 * Helper function to measure execution time
 */
export async function measureExecutionTime(fn: () => Promise<any>): Promise<number> {
  const start = performance.now();
  await fn();
  const end = performance.now();
  return end - start;
}

/**
 * Helper function to generate a large payload
 */
export function generateLargePayload(sizeInKB: number): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    metadata: {
      timestamp: new Date().toISOString(),
      version: '1.0.0',
      source: 'performance-test'
    }
  };
  
  // Generate a string of approximately sizeInKB
  const charsPerKB = 1024;
  const dataString = 'x'.repeat(sizeInKB * charsPerKB);
  
  // Split into chunks to make it more realistic
  const chunks: string[] = [];
  const chunkSize = 100;
  for (let i = 0; i < dataString.length; i += chunkSize) {
    chunks.push(dataString.substring(i, i + chunkSize));
  }
  
  payload.data = chunks;
  return payload;
}
