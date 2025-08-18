/**
 * Data Exchange Manager for handling data-related messages in the A2A communication layer
 */
import { v4 as uuidv4 } from 'uuid';
import { EventEmitter } from 'events';
import { 
  Message, 
  MessageType, 
  BaseDataPayload,
  DataRequestPayload,
  DataResponsePayload,
  DataStreamStartPayload,
  DataStreamChunkPayload,
  DataStreamEndPayload,
  ErrorPayload
} from './types';
import { natsClient, NatsClient } from './natsClient';

// Define event types for the data exchange manager
export interface DataExchangeEvents {
  dataRequested: (requestId: string, dataType: string) => void;
  dataResponded: (requestId: string, data: unknown) => void;
  streamStarted: (requestId: string, dataType: string) => void;
  streamChunkReceived: (requestId: string, chunkIndex: number, isLast: boolean) => void;
  streamEnded: (requestId: string, success: boolean) => void;
  error: (error: Error | ErrorPayload) => void;
}

export interface DataExchangeOptions {
  serviceId: string;
  capabilities: string[];
  maxConcurrentRequests?: number;
  requestTimeout?: number;
  streamChunkSize?: number;
  natsClient?: NatsClient;
}

export interface DataProviderHandler<T = unknown, P = unknown> {
  (parameters: P, requestId: string): Promise<T>;
}

export interface StreamProviderHandler<T = unknown, P = unknown> {
  (parameters: P, requestId: string, onChunk: (chunk: T, index: number) => Promise<void>): Promise<void>;
}

export interface DataRequest {
  requestId: string;
  dataType: string;
  parameters: Record<string, unknown>;
  source: string;
  timestamp: string;
  timeout?: number;
  priority?: number;
  correlationId: string;
  replyTo?: string;
}

export interface StreamInfo {
  requestId: string;
  dataType: string;
  totalChunks?: number;
  totalSize?: number;
  format?: string;
  compression?: string;
  chunks: Map<number, unknown>;
  startTime: string;
  endTime?: string;
  complete: boolean;
  error?: ErrorPayload;
}

/**
 * DataExchange handles data-related messages and provides an API for data exchange
 */
export class DataExchange extends EventEmitter {
  private serviceId: string;
  private capabilities: string[];
  private maxConcurrentRequests: number;
  private requestTimeout: number;
  private streamChunkSize: number;
  private natsClient: NatsClient;
  private subscriptions: string[] = [];
  private activeRequests: Set<string> = new Set();
  private pendingRequests: Map<string, DataRequest> = new Map();
  private streams: Map<string, StreamInfo> = new Map();
  private dataProviders: Map<string, DataProviderHandler> = new Map();
  private streamProviders: Map<string, StreamProviderHandler> = new Map();
  private requestCallbacks: Map<string, (data: unknown, error?: ErrorPayload) => void> = new Map();

  constructor(options: DataExchangeOptions) {
    super();
    this.serviceId = options.serviceId;
    this.capabilities = options.capabilities;
    this.maxConcurrentRequests = options.maxConcurrentRequests || 10;
    this.requestTimeout = options.requestTimeout || 30000; // 30 seconds
    this.streamChunkSize = options.streamChunkSize || 64 * 1024; // 64KB
    this.natsClient = options.natsClient || natsClient;
  }

  /**
   * Initialize the data exchange manager
   */
  async initialize(): Promise<void> {
    try {
      // Subscribe to data-related messages
      await this.setupSubscriptions();
      console.log(`Data exchange initialized for service ${this.serviceId}`);
    } catch (error) {
      console.error('Failed to initialize data exchange:', error);
      throw error;
    }
  }

  /**
   * Clean up resources
   */
  async shutdown(): Promise<void> {
    // Unsubscribe from all subscriptions
    await Promise.all(
      this.subscriptions.map(subId => 
        this.natsClient.unsubscribe(subId).catch(console.error)
      )
    );

    // Cancel all active requests
    for (const requestId of this.activeRequests) {
      const callback = this.requestCallbacks.get(requestId);
      if (callback) {
        const error: ErrorPayload = {
          code: 'SERVICE_SHUTDOWN',
          message: 'Service is shutting down',
          retryable: true,
          source: this.serviceId,
          timestamp: new Date().toISOString(),
          severity: 'WARNING'
        };
        callback(null, error);
      }
    }

    console.log(`Data exchange for service ${this.serviceId} shut down`);
  }

  /**
   * Set up message subscriptions
   */
  private async setupSubscriptions(): Promise<void> {
    // Subscribe to data request messages
    const requestSubId = await this.natsClient.subscribe(
      'data.request',
      async (msg: Message<DataRequestPayload>) => {
        await this.handleDataRequest(msg);
      }
    );
    this.subscriptions.push(requestSubId);

    // Subscribe to data response messages
    const responseSubId = await this.natsClient.subscribe(
      `service.${this.serviceId}.data.response.*`,
      async (msg: Message<DataResponsePayload>) => {
        await this.handleDataResponse(msg);
      }
    );
    this.subscriptions.push(responseSubId);

    // Subscribe to data stream start messages
    const streamStartSubId = await this.natsClient.subscribe(
      'data.stream.start',
      async (msg: Message<DataStreamStartPayload>) => {
        await this.handleStreamStart(msg);
      }
    );
    this.subscriptions.push(streamStartSubId);

    // Subscribe to data stream chunk messages
    const streamChunkSubId = await this.natsClient.subscribe(
      `service.${this.serviceId}.data.stream.chunk.*`,
      async (msg: Message<DataStreamChunkPayload>) => {
        await this.handleStreamChunk(msg);
      }
    );
    this.subscriptions.push(streamChunkSubId);

    // Subscribe to data stream end messages
    const streamEndSubId = await this.natsClient.subscribe(
      `service.${this.serviceId}.data.stream.end.*`,
      async (msg: Message<DataStreamEndPayload>) => {
        await this.handleStreamEnd(msg);
      }
    );
    this.subscriptions.push(streamEndSubId);

    console.log('Data exchange subscriptions set up');
  }

  /**
   * Register a data provider handler
   * @param dataType The type of data this handler provides
   * @param handler The handler function
   */
  registerDataProvider<T = unknown, P = unknown>(
    dataType: string, 
    handler: DataProviderHandler<T, P>
  ): void {
    this.dataProviders.set(dataType, handler as DataProviderHandler);
    console.log(`Registered data provider for type: ${dataType}`);
  }

  /**
   * Register a stream provider handler
   * @param dataType The type of data this handler streams
   * @param handler The handler function
   */
  registerStreamProvider<T = unknown, P = unknown>(
    dataType: string, 
    handler: StreamProviderHandler<T, P>
  ): void {
    this.streamProviders.set(dataType, handler as StreamProviderHandler);
    console.log(`Registered stream provider for type: ${dataType}`);
  }

  /**
   * Request data from another service
   * @param dataType The type of data to request
   * @param parameters The request parameters
   * @param options Additional request options
   */
  async requestData<T = unknown, P = Record<string, unknown>>(
    dataType: string, 
    parameters: P, 
    options?: {
      timeout?: number;
      priority?: number;
    }
  ): Promise<T> {
    const requestId = `req-${uuidv4()}`;
    const now = new Date().toISOString();
    
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.requestCallbacks.delete(requestId);
        reject(new Error(`Request timed out after ${options?.timeout || this.requestTimeout}ms`));
      }, options?.timeout || this.requestTimeout);
      
      // Store callback
      this.requestCallbacks.set(requestId, (data, error) => {
        clearTimeout(timeoutId);
        this.requestCallbacks.delete(requestId);
        
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve(data as T);
        }
      });
      
      // Create request payload
      const payload: DataRequestPayload = {
        requestId,
        dataType,
        parameters: parameters as Record<string, unknown>,
        priority: options?.priority,
        timeout: options?.timeout,
        metadata: {}
      };
      
      const message: Message<DataRequestPayload> = {
        type: MessageType.DATA_REQUEST,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: now,
          source: this.serviceId,
          replyTo: `service.${this.serviceId}.data.response.${requestId}`
        },
        payload
      };
      
      // Send request
      this.natsClient.publish('data.request', message)
        .catch(error => {
          clearTimeout(timeoutId);
          this.requestCallbacks.delete(requestId);
          reject(error);
        });
      
      this.emit('dataRequested', requestId, dataType);
      console.log(`Data requested: ${requestId} (${dataType})`);
    });
  }

  /**
   * Request a data stream from another service
   * @param dataType The type of data to stream
   * @param parameters The request parameters
   * @param onChunk Callback for each chunk
   * @param options Additional request options
   */
  async requestStream<T = unknown, P = Record<string, unknown>>(
    dataType: string, 
    parameters: P, 
    onChunk: (chunk: T, index: number, isLast: boolean) => Promise<void>,
    options?: {
      timeout?: number;
      priority?: number;
    }
  ): Promise<void> {
    const requestId = `stream-${uuidv4()}`;
    const now = new Date().toISOString();
    
    return new Promise<void>((resolve, reject) => {
      // Set up timeout
      const timeoutId = setTimeout(() => {
        this.streams.delete(requestId);
        reject(new Error(`Stream request timed out after ${options?.timeout || this.requestTimeout}ms`));
      }, options?.timeout || this.requestTimeout);
      
      // Initialize stream info
      const streamInfo: StreamInfo = {
        requestId,
        dataType,
        chunks: new Map(),
        startTime: now,
        complete: false
      };
      
      this.streams.set(requestId, streamInfo);
      
      // Set up stream end handler
      const onStreamEnd = (error?: ErrorPayload) => {
        clearTimeout(timeoutId);
        
        if (error) {
          reject(new Error(error.message));
        } else {
          resolve();
        }
      };
      
      // Create request payload
      const payload: DataRequestPayload = {
        requestId,
        dataType,
        parameters: parameters as Record<string, unknown>,
        priority: options?.priority,
        timeout: options?.timeout,
        metadata: {
          streamRequest: true
        }
      };
      
      const message: Message<DataRequestPayload> = {
        type: MessageType.DATA_REQUEST,
        headers: {
          correlationId: uuidv4(),
          messageId: uuidv4(),
          timestamp: now,
          source: this.serviceId,
          replyTo: `service.${this.serviceId}.data.stream`
        },
        payload
      };
      
      // Set up chunk handler
      const handleChunk = async (chunk: unknown, index: number, isLast: boolean) => {
        try {
          await onChunk(chunk as T, index, isLast);
          
          if (isLast) {
            onStreamEnd();
          }
        } catch (error) {
          onStreamEnd({
            code: 'CHUNK_PROCESSING_ERROR',
            message: error instanceof Error ? error.message : String(error),
            retryable: false
          });
        }
      };
      
      // Store handlers
      this.streams.set(requestId, {
        ...streamInfo,
        onChunk: handleChunk,
        onEnd: onStreamEnd
      } as any);
      
      // Send request
      this.natsClient.publish('data.request', message)
        .catch(error => {
          clearTimeout(timeoutId);
          this.streams.delete(requestId);
          reject(error);
        });
      
      this.emit('dataRequested', requestId, dataType);
      console.log(`Stream requested: ${requestId} (${dataType})`);
    });
  }

  /**
   * Handle data request messages
   */
  private async handleDataRequest(msg: Message<DataRequestPayload>): Promise<void> {
    const { requestId, dataType, parameters } = msg.payload;
    
    // Check if we can handle this data type
    const handler = this.dataProviders.get(dataType);
    const streamHandler = this.streamProviders.get(dataType);
    
    if (!handler && !streamHandler) {
      console.log(`No handler for data type: ${dataType}`);
      return;
    }
    
    console.log(`Received data request: ${requestId} (${dataType})`);
    
    // Check if this is a stream request
    const isStreamRequest = msg.payload.metadata?.streamRequest === true;
    
    if (isStreamRequest && streamHandler) {
      await this.handleStreamRequest(msg, streamHandler);
    } else if (handler) {
      await this.handleRegularRequest(msg, handler);
    } else {
      // We have a handler but not of the right type
      console.log(`Mismatched handler type for data type: ${dataType}`);
      
      // Send error response
      const errorPayload: ErrorPayload = {
        code: 'INVALID_REQUEST_TYPE',
        message: `Service does not support ${isStreamRequest ? 'stream' : 'regular'} requests for data type: ${dataType}`,
        retryable: false,
        source: this.serviceId,
        timestamp: new Date().toISOString(),
        severity: 'ERROR'
      };
      
      await this.sendErrorResponse(msg, errorPayload);
    }
  }

  /**
   * Handle a regular (non-stream) data request
   */
  private async handleRegularRequest(
    msg: Message<DataRequestPayload>, 
    handler: DataProviderHandler
  ): Promise<void> {
    const { requestId, dataType, parameters } = msg.payload;
    const replyTo = msg.headers.replyTo;
    
    if (!replyTo) {
      console.log(`No reply subject for request: ${requestId}`);
      return;
    }
    
    try {
      // Process the request
      const result = await handler(parameters, requestId);
      
      // Send response
      const responsePayload: DataResponsePayload = {
        requestId,
        data: result,
        processingTime: 0, // Could track actual processing time
        metadata: {}
      };
      
      const responseMessage: Message<DataResponsePayload> = {
        type: MessageType.DATA_RESPONSE,
        headers: {
          correlationId: msg.headers.correlationId,
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
          destination: msg.headers.source
        },
        payload: responsePayload
      };
      
      await this.natsClient.publish(replyTo, responseMessage);
      
      this.emit('dataResponded', requestId, result);
      console.log(`Data response sent: ${requestId}`);
    } catch (error) {
      // Send error response
      const errorPayload: ErrorPayload = {
        code: 'DATA_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : String(error),
        details: error,
        retryable: true,
        source: this.serviceId,
        timestamp: new Date().toISOString(),
        severity: 'ERROR'
      };
      
      await this.sendErrorResponse(msg, errorPayload);
    }
  }

  /**
   * Handle a stream data request
   */
  private async handleStreamRequest(
    msg: Message<DataRequestPayload>, 
    handler: StreamProviderHandler
  ): Promise<void> {
    const { requestId, dataType, parameters } = msg.payload;
    const destination = msg.headers.source;
    
    if (!destination) {
      console.log(`No destination for stream request: ${requestId}`);
      return;
    }
    
    try {
      // Start the stream
      const streamStartPayload: DataStreamStartPayload = {
        requestId,
        dataType,
        metadata: {}
      };
      
      const streamStartMessage: Message<DataStreamStartPayload> = {
        type: MessageType.DATA_STREAM_START,
        headers: {
          correlationId: msg.headers.correlationId,
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
          destination
        },
        payload: streamStartPayload
      };
      
      await this.natsClient.publish(`service.${destination}.data.stream.start.${requestId}`, streamStartMessage);
      
      this.emit('streamStarted', requestId, dataType);
      console.log(`Stream started: ${requestId} (${dataType})`);
      
      // Set up chunk handler
      let chunkIndex = 0;
      const onChunk = async (chunk: unknown, index: number): Promise<void> => {
        const chunkPayload: DataStreamChunkPayload = {
          requestId,
          chunkIndex: index,
          data: chunk,
          isLast: false,
          metadata: {}
        };
        
        const chunkMessage: Message<DataStreamChunkPayload> = {
          type: MessageType.DATA_STREAM_CHUNK,
          headers: {
            correlationId: msg.headers.correlationId,
            messageId: uuidv4(),
            timestamp: new Date().toISOString(),
            source: this.serviceId,
            destination
          },
          payload: chunkPayload
        };
        
        await this.natsClient.publish(`service.${destination}.data.stream.chunk.${requestId}`, chunkMessage);
        chunkIndex = index + 1;
      };
      
      // Process the stream
      await handler(parameters, requestId, onChunk);
      
      // Send final chunk
      const finalChunkPayload: DataStreamChunkPayload = {
        requestId,
        chunkIndex,
        data: null,
        isLast: true,
        metadata: {}
      };
      
      const finalChunkMessage: Message<DataStreamChunkPayload> = {
        type: MessageType.DATA_STREAM_CHUNK,
        headers: {
          correlationId: msg.headers.correlationId,
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
          destination
        },
        payload: finalChunkPayload
      };
      
      await this.natsClient.publish(`service.${destination}.data.stream.chunk.${requestId}`, finalChunkMessage);
      
      // End the stream
      const streamEndPayload: DataStreamEndPayload = {
        requestId,
        totalChunks: chunkIndex + 1,
        totalSize: 0, // Could track actual size
        metadata: {}
      };
      
      const streamEndMessage: Message<DataStreamEndPayload> = {
        type: MessageType.DATA_STREAM_END,
        headers: {
          correlationId: msg.headers.correlationId,
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
          destination
        },
        payload: streamEndPayload
      };
      
      await this.natsClient.publish(`service.${destination}.data.stream.end.${requestId}`, streamEndMessage);
      
      this.emit('streamEnded', requestId, true);
      console.log(`Stream ended: ${requestId}`);
    } catch (error) {
      // Send error response
      const errorPayload: ErrorPayload = {
        code: 'STREAM_PROCESSING_ERROR',
        message: error instanceof Error ? error.message : String(error),
        details: error,
        retryable: true,
        source: this.serviceId,
        timestamp: new Date().toISOString(),
        severity: 'ERROR'
      };
      
      // End the stream with error
      const streamEndPayload: DataStreamEndPayload = {
        requestId,
        totalChunks: 0,
        totalSize: 0,
        error: errorPayload,
        metadata: {}
      };
      
      const streamEndMessage: Message<DataStreamEndPayload> = {
        type: MessageType.DATA_STREAM_END,
        headers: {
          correlationId: msg.headers.correlationId,
          messageId: uuidv4(),
          timestamp: new Date().toISOString(),
          source: this.serviceId,
          destination: msg.headers.source
        },
        payload: streamEndPayload
      };
      
      await this.natsClient.publish(`service.${msg.headers.source}.data.stream.end.${requestId}`, streamEndMessage);
      
      this.emit('streamEnded', requestId, false);
      console.log(`Stream failed: ${requestId} (${errorPayload.message})`);
    }
  }

  /**
   * Handle data response messages
   */
  private async handleDataResponse(msg: Message<DataResponsePayload>): Promise<void> {
    const { requestId, data } = msg.payload;
    
    // Check if we have a callback for this request
    const callback = this.requestCallbacks.get(requestId);
    if (!callback) {
      console.log(`No callback for response: ${requestId}`);
      return;
    }
    
    console.log(`Received data response: ${requestId}`);
    
    // Call the callback
    callback(data);
    
    // Remove the callback
    this.requestCallbacks.delete(requestId);
    
    // Emit event
    this.emit('dataResponded', requestId, data);
  }

  /**
   * Handle stream start messages
   */
  private async handleStreamStart(msg: Message<DataStreamStartPayload>): Promise<void> {
    const { requestId, dataType } = msg.payload;
    
    console.log(`Received stream start: ${requestId} (${dataType})`);
    
    // Initialize stream info if not already done
    if (!this.streams.has(requestId)) {
      const streamInfo: StreamInfo = {
        requestId,
        dataType,
        chunks: new Map(),
        startTime: new Date().toISOString(),
        complete: false,
        totalChunks: msg.payload.totalChunks,
        totalSize: msg.payload.totalSize,
        format: msg.payload.format,
        compression: msg.payload.compression
      };
      
      this.streams.set(requestId, streamInfo);
    } else {
      // Update existing stream info
      const streamInfo = this.streams.get(requestId)!;
      streamInfo.totalChunks = msg.payload.totalChunks;
      streamInfo.totalSize = msg.payload.totalSize;
      streamInfo.format = msg.payload.format;
      streamInfo.compression = msg.payload.compression;
    }
    
    // Emit event
    this.emit('streamStarted', requestId, dataType);
  }

  /**
   * Handle stream chunk messages
   */
  private async handleStreamChunk(msg: Message<DataStreamChunkPayload>): Promise<void> {
    const { requestId, chunkIndex, data, isLast } = msg.payload;
    
    // Check if we have this stream
    const streamInfo = this.streams.get(requestId);
    if (!streamInfo) {
      console.log(`No stream info for chunk: ${requestId}`);
      return;
    }
    
    console.log(`Received stream chunk: ${requestId} (${chunkIndex}${isLast ? ', last' : ''})`);
    
    // Store the chunk
    streamInfo.chunks.set(chunkIndex, data);
    
    // Call the chunk handler if available
    if ((streamInfo as any).onChunk) {
      await (streamInfo as any).onChunk(data, chunkIndex, isLast);
    }
    
    // Emit event
    this.emit('streamChunkReceived', requestId, chunkIndex, isLast);
    
    // If this is the last chunk and we don't have an end message yet, mark as complete
    if (isLast && !streamInfo.complete) {
      streamInfo.complete = true;
      streamInfo.endTime = new Date().toISOString();
      
      // Call the end handler if available
      if ((streamInfo as any).onEnd) {
        (streamInfo as any).onEnd();
      }
    }
  }

  /**
   * Handle stream end messages
   */
  private async handleStreamEnd(msg: Message<DataStreamEndPayload>): Promise<void> {
    const { requestId, totalChunks, error } = msg.payload;
    
    // Check if we have this stream
    const streamInfo = this.streams.get(requestId);
    if (!streamInfo) {
      console.log(`No stream info for end: ${requestId}`);
      return;
    }
    
    console.log(`Received stream end: ${requestId} (${error ? 'error' : 'success'})`);
    
    // Update stream info
    streamInfo.complete = true;
    streamInfo.endTime = new Date().toISOString();
    streamInfo.totalChunks = totalChunks;
    streamInfo.error = error;
    
    // Call the end handler if available
    if ((streamInfo as any).onEnd) {
      (streamInfo as any).onEnd(error);
    }
    
    // Emit event
    this.emit('streamEnded', requestId, !error);
    
    // Clean up after some time
    setTimeout(() => {
      this.streams.delete(requestId);
    }, 60000); // Keep stream info for 1 minute for debugging
  }

  /**
   * Send an error response
   */
  private async sendErrorResponse(
    requestMsg: Message<DataRequestPayload>, 
    error: ErrorPayload
  ): Promise<void> {
    const { requestId } = requestMsg.payload;
    const replyTo = requestMsg.headers.replyTo;
    
    if (!replyTo) {
      console.log(`No reply subject for error response: ${requestId}`);
      return;
    }
    
    const errorMessage: Message<ErrorPayload> = {
      type: MessageType.ERROR,
      headers: {
        correlationId: requestMsg.headers.correlationId,
        messageId: uuidv4(),
        timestamp: new Date().toISOString(),
        source: this.serviceId,
        destination: requestMsg.headers.source
      },
      payload: error
    };
    
    await this.natsClient.publish(replyTo, errorMessage);
    
    console.log(`Error response sent: ${requestId} (${error.message})`);
  }
}

// Singleton instance
export const dataExchange = new DataExchange({
  serviceId: `dataexchange-${uuidv4()}`,
  capabilities: ['data.exchange'],
});
