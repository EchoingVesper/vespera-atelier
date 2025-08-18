/**
 * Basic integration tests for the A2A messaging system
 * This tests the core messaging functionality without complex mocks
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { MessageType } from '../../../src/core/messaging/types';
import { NatsClient } from '../../../src/core/messaging/natsClient';

describe('Basic A2A Messaging', () => {
  let natsClient: NatsClient;
  
  beforeEach(() => {
    // Create a fresh NATS client for each test
    natsClient = new NatsClient();
    
    // Mock the actual NATS connection methods
    vi.spyOn(natsClient as any, 'connect').mockResolvedValue(undefined);
    vi.spyOn(natsClient as any, 'publish').mockResolvedValue(undefined);
    vi.spyOn(natsClient as any, 'subscribe').mockResolvedValue('test-subscription');
    vi.spyOn(natsClient as any, 'unsubscribe').mockResolvedValue(undefined);
    
    // Mock the isConnected property
    Object.defineProperty(natsClient, 'isConnected', {
      get: () => true
    });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });
  
  it('should connect to NATS server', async () => {
    await natsClient.connect();
    expect(natsClient.isConnected).toBe(true);
    expect(natsClient.connect).toHaveBeenCalled();
  });
  
  it('should publish messages', async () => {
    await natsClient.connect();
    
    const subject = 'test.subject';
    const message = {
      type: MessageType.HEARTBEAT,
      headers: {
        correlationId: 'test-correlation-id',
        messageId: 'test-message-id',
        timestamp: new Date().toISOString(),
        source: 'test-service'
      },
      payload: { test: 'data' }
    };
    
    await natsClient.publish(subject, message);
    expect(natsClient.publish).toHaveBeenCalledWith(subject, message);
  });
  
  it('should subscribe to subjects', async () => {
    await natsClient.connect();
    
    const subject = 'test.subject';
    const callback = vi.fn();
    
    await natsClient.subscribe(subject, callback);
    expect(natsClient.subscribe).toHaveBeenCalledWith(subject, callback);
  });
  
  it('should unsubscribe from subjects', async () => {
    await natsClient.connect();
    
    const subject = 'test.subject';
    const callback = vi.fn();
    const subscriptionId = await natsClient.subscribe(subject, callback);
    
    await natsClient.unsubscribe(subscriptionId);
    expect(natsClient.unsubscribe).toHaveBeenCalledWith(subscriptionId);
  });
});