import { natsClient, ServiceManager, MessageType } from '../src/core/messaging';
import { Message } from '../src/core/messaging/types';

// Example service types
const SERVICE_TYPES = {
  PROCESSOR: 'processor',
  STORAGE: 'storage',
  UI: 'ui',
} as const;

/**
 * Example service that processes tasks
 */
async function startProcessorService() {
  const service = new ServiceManager({
    serviceType: SERVICE_TYPES.PROCESSOR,
    capabilities: ['process-text', 'summarize'],
    metadata: { version: '1.0.0' },
  });

  await service.initialize();

  // Subscribe to task requests
  await natsClient.subscribe<{ task: string; data: unknown }>(
    'task.process',
    async (message) => {
      const { task, data } = message.payload;
      console.log(`[${service.getServiceId()}] Processing task: ${task}`);
      
      // Simulate processing
      await new Promise(resolve => setTimeout(resolve, 1000));
      
      // Send response
      await natsClient.publish(message.headers.replyTo || 'task.response', {
        type: MessageType.TASK_COMPLETE,
        headers: {
          correlationId: message.headers.correlationId,
          messageId: `resp-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: service.getServiceId(),
        },
        payload: {
          taskId: message.headers.correlationId,
          status: 'completed',
          result: `Processed task: ${task} with data: ${JSON.stringify(data)}`,
        },
      });
    }
  );

  return service;
}

/**
 * Example service that stores data
 */
async function startStorageService() {
  const service = new ServiceManager({
    serviceType: SERVICE_TYPES.STORAGE,
    capabilities: ['store', 'retrieve'],
    metadata: { version: '1.0.0' },
  });

  await service.initialize();
  const store = new Map<string, unknown>();

  // Handle storage requests
  await natsClient.subscribe<{ action: string; key: string; value?: unknown }>(
    'storage.*',
    async (message) => {
      const { action, key, value } = message.payload;
      const responseSubject = message.headers.replyTo || 'storage.response';
      
      try {
        switch (action) {
          case 'set':
            store.set(key, value);
            await natsClient.publish(responseSubject, {
              type: MessageType.STORAGE_SET,
              headers: {
                correlationId: message.headers.correlationId,
                messageId: `resp-${Date.now()}`,
                timestamp: new Date().toISOString(),
                source: service.getServiceId(),
              },
              payload: { success: true, key },
            });
            break;
            
          case 'get':
            const result = store.get(key);
            await natsClient.publish(responseSubject, {
              type: MessageType.STORAGE_GET,
              headers: {
                correlationId: message.headers.correlationId,
                messageId: `resp-${Date.now()}`,
                timestamp: new Date().toISOString(),
                source: service.getServiceId(),
              },
              payload: { 
                success: result !== undefined,
                key,
                value: result,
              },
            });
            break;
            
          default:
            throw new Error(`Unknown storage action: ${action}`);
        }
      } catch (error) {
        await natsClient.publish(responseSubject, {
          type: MessageType.ERROR,
          headers: {
            correlationId: message.headers.correlationId,
            messageId: `err-${Date.now()}`,
            timestamp: new Date().toISOString(),
            source: service.getServiceId(),
          },
          payload: {
            code: 'STORAGE_ERROR',
            message: error instanceof Error ? error.message : 'Unknown error',
          },
        });
      }
    }
  );

  return service;
}

/**
 * Example UI service that coordinates between other services
 */
async function startUIService() {
  const service = new ServiceManager({
    serviceType: SERVICE_TYPES.UI,
    capabilities: ['orchestrate'],
    metadata: { version: '1.0.0' },
  });

  await service.initialize();

  // Example of service discovery
  console.log('Available services:', service.getServices().map(s => ({
    id: s.serviceId,
    type: s.serviceType,
    status: s.status,
  })));

  // Example of request/response pattern
  async function processWithRetry(task: string, data: unknown, maxRetries = 3): Promise<unknown> {
    let lastError: Error | null = null;
    
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        console.log(`[UI] Sending task (attempt ${attempt}/${maxRetries}):`, task);
        
        // Find available processors
        const processors = service.findServicesByCapability('process-text');
        if (processors.length === 0) {
          throw new Error('No processor services available');
        }
        
        // Select first available processor (could implement load balancing here)
        const processor = processors[0];
        
        // Send request and wait for response
        const response = await natsClient.request<{ task: string; data: unknown }, { result: string }>(
          'task.process',
          {
            type: MessageType.TASK_REQUEST,
            headers: {
              correlationId: `task-${Date.now()}`,
              messageId: `msg-${Date.now()}`,
              timestamp: new Date().toISOString(),
              source: service.getServiceId(),
              destination: processor.serviceId,
            },
            payload: { task, data },
          },
          5000 // 5 second timeout
        );
        
        console.log(`[UI] Task completed successfully:`, response.payload.result);
        return response.payload.result;
        
      } catch (error) {
        lastError = error as Error;
        console.warn(`[UI] Attempt ${attempt} failed:`, error);
        
        // Wait before retrying (exponential backoff)
        if (attempt < maxRetries) {
          const delay = Math.min(1000 * Math.pow(2, attempt), 10000);
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      }
    }
    
    throw lastError || new Error('Unknown error');
  }

  // Run example after a short delay to allow services to register
  setTimeout(async () => {
    try {
      console.log('\n--- Starting Example ---');
      
      // Example 1: Simple task processing
      await processWithRetry('summarize', { text: 'This is a test document to summarize.' });
      
      // Example 2: Storage operations
      console.log('\n--- Storage Example ---');
      
      // Store a value
      await natsClient.publish('storage.set', {
        type: MessageType.STORAGE_REQUEST,
        headers: {
          correlationId: `store-${Date.now()}`,
          messageId: `msg-${Date.now()}`,
          timestamp: new Date().toISOString(),
          source: service.getServiceId(),
        },
        payload: {
          action: 'set',
          key: 'test-key',
          value: { message: 'Hello, NATS!' },
        },
      });
      
      // Retrieve the value
      const response = await natsClient.request<{ action: string; key: string }, { value: unknown }>(
        'storage.get',
        {
          type: MessageType.STORAGE_REQUEST,
          headers: {
            correlationId: `get-${Date.now()}`,
            messageId: `msg-${Date.now()}`,
            timestamp: new Date().toISOString(),
            source: service.getServiceId(),
          },
          payload: {
            action: 'get',
            key: 'test-key',
          },
        },
        3000 // 3 second timeout
      );
      
      console.log('Retrieved value:', response.payload.value);
      
    } catch (error) {
      console.error('Example failed:', error);
    }
  }, 2000);

  return service;
}

/**
 * Main function to run the demo
 */
async function runDemo() {
  try {
    // Connect to NATS
    await natsClient.connect();
    
    // Start services
    const services = await Promise.all([
      startProcessorService(),
      startStorageService(),
      startUIService(),
    ]);
    
    // Handle shutdown
    const shutdown = async () => {
      console.log('\nShutting down services...');
      await Promise.all(services.map(svc => svc.shutdown().catch(console.error)));
      await natsClient.disconnect();
      process.exit(0);
    };
    
    process.on('SIGINT', shutdown);
    process.on('SIGTERM', shutdown);
    
  } catch (error) {
    console.error('Failed to start demo:', error);
    process.exit(1);
  }
}

// Run the demo if this file is executed directly
if (require.main === module) {
  runDemo().catch(console.error);
}

// Export for testing
export {
  startProcessorService,
  startStorageService,
  startUIService,
  runDemo,
  SERVICE_TYPES,
};
