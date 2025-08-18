// Using path alias configured in tsconfig.json
import { ServiceManager, natsClient, MessageType } from '@/core/messaging';
import type { Message, ServiceInfo } from '@/core/messaging';
import { v4 as uuidv4 } from 'uuid';

export interface TestServiceOptions {
  serviceType: string;
  capabilities?: string[];
  metadata?: Record<string, unknown>;
  heartbeatInterval?: number;
}

export class TestService {
  public serviceId: string;
  public serviceManager: ServiceManager;
  public receivedMessages: Array<{subject: string; message: any}> = [];

  constructor(options: TestServiceOptions) {
    this.serviceId = `test-${uuidv4()}`;
    this.serviceManager = new ServiceManager({
      serviceType: options.serviceType,
      capabilities: options.capabilities || [],
      metadata: options.metadata || {},
      heartbeatInterval: options.heartbeatInterval || 1000,
    });
  }

  async start(): Promise<void> {
    // Ensure NATS client is connected before initializing service manager
    if (!natsClient.isConnected) {
      await natsClient.connect();
    }
    await this.serviceManager.initialize();
  }

  async stop(): Promise<void> {
    await this.serviceManager.shutdown();
  }

  async sendMessage(subject: string, message: any): Promise<void> {
    // Determine message type based on subject
    let messageType = MessageType.DATA_REQUEST; // Default
    
    if (subject.includes('task')) {
      messageType = MessageType.TASK_CREATE;
    } else if (subject.includes('storage')) {
      messageType = MessageType.STORAGE_SET;
    } else if (subject.includes('service')) {
      messageType = MessageType.REGISTER;
    } else if (subject.includes('heartbeat')) {
      messageType = MessageType.HEARTBEAT;
    }
    
    await natsClient.publish(subject, {
      type: messageType,
      headers: {
        messageId: uuidv4(),
        correlationId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId,
      },
      payload: message,
    });
  }

  async subscribe(subject: string): Promise<string> {
    return new Promise((resolve) => {
      natsClient.subscribe(subject, (msg: Message) => {
        this.receivedMessages.push({
          subject,
          message: msg,
        });
      }).then(resolve);
    });
  }

  getMessagesForSubject(subject: string): any[] {
    return this.receivedMessages
      .filter(m => m.subject === subject)
      .map(m => m.message);
  }

  clearMessages(): void {
    this.receivedMessages = [];
  }
}

export async function waitForCondition(
  condition: () => boolean,
  timeout = 5000,
  interval = 100
): Promise<boolean> {
  const startTime = Date.now();
  
  return new Promise((resolve) => {
    const check = () => {
      if (condition()) {
        resolve(true);
      } else if (Date.now() - startTime >= timeout) {
        resolve(false);
      } else {
        setTimeout(check, interval);
      }
    };
    
    check();
  });
}

export function createTestService(options: TestServiceOptions): TestService {
  return new TestService(options);
}
