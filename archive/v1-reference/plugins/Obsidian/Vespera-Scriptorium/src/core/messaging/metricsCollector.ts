/**
 * Metrics collection system for A2A messaging
 * 
 * Tracks message statistics, latency, throughput, and other performance metrics
 * to provide insights into the messaging system's behavior and health.
 */
import { EventEmitter } from 'events';
import { Message, MessageType } from './types';
import { natsClient, NatsClient } from './natsClient';

/**
 * Metric types that can be collected
 */
export enum MetricType {
  // Message metrics
  MESSAGES_SENT = 'messages.sent',
  MESSAGES_RECEIVED = 'messages.received',
  MESSAGES_FAILED = 'messages.failed',
  MESSAGES_FILTERED = 'messages.filtered',
  
  // Latency metrics
  LATENCY = 'latency',
  PROCESSING_TIME = 'processing.time',
  
  // Throughput metrics
  THROUGHPUT = 'throughput',
  
  // Circuit breaker metrics
  CIRCUIT_OPEN = 'circuit.open',
  CIRCUIT_CLOSE = 'circuit.close',
  CIRCUIT_HALF_OPEN = 'circuit.half_open',
  
  // Service metrics
  SERVICE_DISCOVERY = 'service.discovery',
  SERVICE_HEARTBEAT = 'service.heartbeat',
  
  // Task metrics
  TASK_CREATED = 'task.created',
  TASK_COMPLETED = 'task.completed',
  TASK_FAILED = 'task.failed',
  
  // Storage metrics
  STORAGE_SET = 'storage.set',
  STORAGE_GET = 'storage.get',
  STORAGE_DELETE = 'storage.delete',
  
  // Custom metrics
  CUSTOM = 'custom'
}

/**
 * Metric data point structure
 */
export interface MetricDataPoint {
  timestamp: number;
  value: number;
  tags?: Record<string, string>;
}

/**
 * Metric time series data
 */
export interface MetricTimeSeries {
  type: MetricType | string;
  dataPoints: MetricDataPoint[];
  metadata?: Record<string, any>;
}

/**
 * Aggregated metric data
 */
export interface AggregatedMetric {
  type: MetricType | string;
  count: number;
  sum: number;
  min: number;
  max: number;
  avg: number;
  p95?: number; // 95th percentile
  p99?: number; // 99th percentile
  tags?: Record<string, string>;
  lastUpdated: number;
}

/**
 * Metric snapshot with all current metrics
 */
export interface MetricsSnapshot {
  timestamp: number;
  metrics: Record<string, AggregatedMetric>;
  messageTypeBreakdown?: Record<MessageType, number>;
  serviceMetrics?: Record<string, Record<string, AggregatedMetric>>;
}

/**
 * Metrics collector options
 */
export interface MetricsCollectorOptions {
  natsClient?: NatsClient;
  retentionPeriod?: number; // How long to keep metrics in milliseconds
  aggregationInterval?: number; // How often to aggregate metrics in milliseconds
  reportingInterval?: number; // How often to report metrics in milliseconds
  maxDataPoints?: number; // Maximum number of data points to store per metric
  enableReporting?: boolean; // Whether to enable periodic reporting
  enableLogging?: boolean; // Whether to log metrics
}

/**
 * Metrics collector events
 */
export interface MetricsCollectorEvents {
  metricAdded: (type: MetricType | string, value: number, tags?: Record<string, string>) => void;
  metricsAggregated: (metrics: Record<string, AggregatedMetric>) => void;
  metricsReported: (snapshot: MetricsSnapshot) => void;
  error: (error: Error) => void;
}

/**
 * Metrics collector for tracking A2A messaging performance and behavior
 */
export class MetricsCollector extends EventEmitter {
  private metrics: Map<string, MetricTimeSeries> = new Map();
  private aggregatedMetrics: Map<string, AggregatedMetric> = new Map();
  private messageTypeCount: Map<MessageType, number> = new Map();
  private serviceMetrics: Map<string, Map<string, AggregatedMetric>> = new Map();
  private natsClient: NatsClient;
  private aggregationTimer: NodeJS.Timeout | null = null;
  private reportingTimer: NodeJS.Timeout | null = null;
  private readonly options: Required<MetricsCollectorOptions>;

  constructor(options: MetricsCollectorOptions = {}) {
    super();
    this.natsClient = options.natsClient || natsClient;
    
    // Set default options with proper merging to avoid type errors
    const defaultOptions = {
      natsClient: this.natsClient, // Ensure natsClient is included in options
      retentionPeriod: 3600000, // 1 hour
      aggregationInterval: 60000, // 1 minute
      reportingInterval: 300000, // 5 minutes
      maxDataPoints: 1000,
      enableReporting: true,
      enableLogging: false
    };
    
    // Merge defaults with provided options, ensuring natsClient is properly set
    this.options = { ...defaultOptions, ...options, natsClient: this.natsClient } as Required<MetricsCollectorOptions>;

    // Initialize message type counts
    Object.values(MessageType).forEach(type => {
      this.messageTypeCount.set(type, 0);
    });

    // Start timers if enabled
    if (this.options.enableReporting) {
      this.startTimers();
    }
  }

  /**
   * Start the aggregation and reporting timers
   */
  startTimers(): void {
    // Stop existing timers if any
    this.stopTimers();

    // Start aggregation timer
    this.aggregationTimer = setInterval(() => {
      this.aggregateMetrics();
    }, this.options.aggregationInterval);

    // Start reporting timer
    this.reportingTimer = setInterval(() => {
      this.reportMetrics();
    }, this.options.reportingInterval);
  }

  /**
   * Stop the aggregation and reporting timers
   */
  stopTimers(): void {
    if (this.aggregationTimer) {
      clearInterval(this.aggregationTimer);
      this.aggregationTimer = null;
    }

    if (this.reportingTimer) {
      clearInterval(this.reportingTimer);
      this.reportingTimer = null;
    }
  }

  /**
   * Record a metric data point
   * 
   * @param type - The metric type
   * @param value - The metric value
   * @param tags - Optional tags for the metric
   */
  recordMetric(type: MetricType | string, value: number, tags?: Record<string, string>): void {
    const metricKey = this.getMetricKey(type, tags);
    const timestamp = Date.now();

    // Create or update the metric time series
    if (!this.metrics.has(metricKey)) {
      this.metrics.set(metricKey, {
        type,
        dataPoints: [],
        metadata: { tags }
      });
    }

    const timeSeries = this.metrics.get(metricKey)!;
    
    // Add the data point
    timeSeries.dataPoints.push({
      timestamp,
      value,
      tags
    });

    // Trim old data points if we exceed the maximum
    if (timeSeries.dataPoints.length > this.options.maxDataPoints) {
      timeSeries.dataPoints = timeSeries.dataPoints.slice(-this.options.maxDataPoints);
    }

    // Trim data points older than the retention period
    const cutoffTime = timestamp - this.options.retentionPeriod;
    timeSeries.dataPoints = timeSeries.dataPoints.filter(dp => dp.timestamp >= cutoffTime);

    // Update the metric time series
    this.metrics.set(metricKey, timeSeries);

    // Emit event
    this.emit('metricAdded', type, value, tags);

    // Log if enabled
    if (this.options.enableLogging) {
      const tagString = tags ? ` tags=${JSON.stringify(tags)}` : '';
      console.log(`[MetricsCollector] Recorded metric ${type}=${value}${tagString}`);
    }
  }

  /**
   * Record a message sent metric
   * 
   * @param message - The message that was sent
   * @param latency - Optional latency in milliseconds
   */
  recordMessageSent(message: Message, latency?: number): void {
    // Increment total messages sent
    this.recordMetric(MetricType.MESSAGES_SENT, 1);

    // Increment count for this message type
    const count = (this.messageTypeCount.get(message.type) || 0) + 1;
    this.messageTypeCount.set(message.type, count);

    // Record message type specific metric
    this.recordMetric(`${MetricType.MESSAGES_SENT}.${message.type}`, 1);

    // Record service specific metric if source is available
    if (message.headers.source) {
      this.recordMetric(`${MetricType.MESSAGES_SENT}.service`, 1, {
        service: message.headers.source
      });
    }

    // Record latency if provided
    if (latency !== undefined) {
      this.recordMetric(MetricType.LATENCY, latency, {
        messageType: message.type
      });
    }
  }

  /**
   * Record a message received metric
   * 
   * @param message - The message that was received
   * @param processingTime - Optional processing time in milliseconds
   */
  recordMessageReceived(message: Message, processingTime?: number): void {
    // Increment total messages received
    this.recordMetric(MetricType.MESSAGES_RECEIVED, 1);

    // Increment count for this message type
    const count = (this.messageTypeCount.get(message.type) || 0) + 1;
    this.messageTypeCount.set(message.type, count);

    // Record message type specific metric
    this.recordMetric(`${MetricType.MESSAGES_RECEIVED}.${message.type}`, 1);

    // Record service specific metric if destination is available
    if (message.headers.destination) {
      this.recordMetric(`${MetricType.MESSAGES_RECEIVED}.service`, 1, {
        service: message.headers.destination
      });
    }

    // Record processing time if provided
    if (processingTime !== undefined) {
      this.recordMetric(MetricType.PROCESSING_TIME, processingTime, {
        messageType: message.type
      });
    }
  }

  /**
   * Record a message failed metric
   * 
   * @param message - The message that failed
   * @param error - The error that occurred
   */
  recordMessageFailed(message: Message, error: Error): void {
    // Increment total messages failed
    this.recordMetric(MetricType.MESSAGES_FAILED, 1);

    // Record message type specific metric
    this.recordMetric(`${MetricType.MESSAGES_FAILED}.${message.type}`, 1);

    // Record error type specific metric
    this.recordMetric(`${MetricType.MESSAGES_FAILED}.error`, 1, {
      errorType: error.name,
      messageType: message.type
    });
  }

  /**
   * Record a custom metric
   * 
   * @param name - The metric name
   * @param value - The metric value
   * @param tags - Optional tags for the metric
   */
  recordCustomMetric(name: string, value: number, tags?: Record<string, string>): void {
    this.recordMetric(`${MetricType.CUSTOM}.${name}`, value, tags);
  }

  /**
   * Get the current throughput (messages per second)
   * 
   * @param timeWindow - Time window in milliseconds (default: 60000 = 1 minute)
   * @returns Messages per second
   */
  getThroughput(timeWindow: number = 60000): number {
    const now = Date.now();
    const cutoffTime = now - timeWindow;
    
    // Count messages in the time window
    let sentCount = 0;
    let receivedCount = 0;
    
    for (const timeSeries of this.metrics.values()) {
      if (timeSeries.type === MetricType.MESSAGES_SENT) {
        sentCount += timeSeries.dataPoints.filter(dp => dp.timestamp >= cutoffTime).length;
      } else if (timeSeries.type === MetricType.MESSAGES_RECEIVED) {
        receivedCount += timeSeries.dataPoints.filter(dp => dp.timestamp >= cutoffTime).length;
      }
    }
    
    // Calculate messages per second
    const totalCount = sentCount + receivedCount;
    const messagesPerSecond = totalCount / (timeWindow / 1000);
    
    // Record the throughput metric
    this.recordMetric(MetricType.THROUGHPUT, messagesPerSecond);
    
    return messagesPerSecond;
  }

  /**
   * Get average latency over a time window
   * 
   * @param timeWindow - Time window in milliseconds (default: 60000 = 1 minute)
   * @returns Average latency in milliseconds
   */
  getAverageLatency(timeWindow: number = 60000): number {
    const now = Date.now();
    const cutoffTime = now - timeWindow;
    
    // Get latency data points in the time window
    const latencyPoints: number[] = [];
    
    for (const timeSeries of this.metrics.values()) {
      if (timeSeries.type === MetricType.LATENCY) {
        latencyPoints.push(
          ...timeSeries.dataPoints
            .filter(dp => dp.timestamp >= cutoffTime)
            .map(dp => dp.value)
        );
      }
    }
    
    // Calculate average latency
    if (latencyPoints.length === 0) {
      return 0;
    }
    
    const sum = latencyPoints.reduce((acc, val) => acc + val, 0);
    return sum / latencyPoints.length;
  }

  /**
   * Aggregate metrics for reporting
   * 
   * @private
   */
  private aggregateMetrics(): void {
    const now = Date.now();
    const cutoffTime = now - this.options.retentionPeriod;
    
    // Clear old aggregated metrics
    this.aggregatedMetrics.clear();
    
    // Process each metric time series
    for (const [key, timeSeries] of this.metrics.entries()) {
      // Filter data points within retention period
      const dataPoints = timeSeries.dataPoints.filter(dp => dp.timestamp >= cutoffTime);
      
      if (dataPoints.length === 0) {
        continue;
      }
      
      // Extract values
      const values = dataPoints.map(dp => dp.value);
      
      // Calculate aggregates
      const count = values.length;
      const sum = values.reduce((acc, val) => acc + val, 0);
      const min = Math.min(...values);
      const max = Math.max(...values);
      const avg = sum / count;
      
      // Calculate percentiles
      const sortedValues = [...values].sort((a, b) => a - b);
      const p95Index = Math.floor(count * 0.95);
      const p99Index = Math.floor(count * 0.99);
      const p95 = sortedValues[p95Index];
      const p99 = sortedValues[p99Index];
      
      // Create aggregated metric
      const aggregated: AggregatedMetric = {
        type: timeSeries.type,
        count,
        sum,
        min,
        max,
        avg,
        p95,
        p99,
        tags: timeSeries.metadata?.tags,
        lastUpdated: now
      };
      
      // Store aggregated metric
      this.aggregatedMetrics.set(key, aggregated);
      
      // Store service-specific metrics
      if (timeSeries.metadata?.tags?.service) {
        const service = timeSeries.metadata.tags.service;
        
        if (!this.serviceMetrics.has(service)) {
          this.serviceMetrics.set(service, new Map());
        }
        
        this.serviceMetrics.get(service)!.set(key, aggregated);
      }
    }
    
    // Emit event
    this.emit('metricsAggregated', Object.fromEntries(this.aggregatedMetrics));
    
    // Log if enabled
    if (this.options.enableLogging) {
      console.log(`[MetricsCollector] Aggregated ${this.aggregatedMetrics.size} metrics`);
    }
  }

  /**
   * Report metrics to subscribers
   * 
   * @private
   */
  private reportMetrics(): void {
    // Make sure metrics are aggregated
    this.aggregateMetrics();
    
    // Create metrics snapshot
    const snapshot: MetricsSnapshot = {
      timestamp: Date.now(),
      metrics: Object.fromEntries(this.aggregatedMetrics),
      messageTypeBreakdown: Object.fromEntries(this.messageTypeCount) as Record<MessageType, number>,
      serviceMetrics: {}
    };
    
    // Add service metrics
    for (const [service, metrics] of this.serviceMetrics.entries()) {
      snapshot.serviceMetrics![service] = Object.fromEntries(metrics);
    }
    
    // Emit event
    this.emit('metricsReported', snapshot);
    
    // Log if enabled
    if (this.options.enableLogging) {
      console.log(`[MetricsCollector] Reported metrics snapshot at ${new Date(snapshot.timestamp).toISOString()}`);
    }
  }

  /**
   * Get a unique key for a metric based on type and tags
   * 
   * @param type - The metric type
   * @param tags - Optional tags for the metric
   * @returns A unique key for the metric
   * @private
   */
  private getMetricKey(type: MetricType | string, tags?: Record<string, string>): string {
    if (!tags || Object.keys(tags).length === 0) {
      return type;
    }
    
    // Sort tags by key for consistent key generation
    const sortedTags = Object.entries(tags)
      .sort(([keyA], [keyB]) => keyA.localeCompare(keyB))
      .map(([key, value]) => `${key}=${value}`)
      .join(',');
    
    return `${type}[${sortedTags}]`;
  }

  /**
   * Get the current metrics snapshot
   * 
   * @returns Current metrics snapshot
   */
  getMetricsSnapshot(): MetricsSnapshot {
    // Make sure metrics are aggregated
    this.aggregateMetrics();
    
    return {
      timestamp: Date.now(),
      metrics: Object.fromEntries(this.aggregatedMetrics),
      messageTypeBreakdown: Object.fromEntries(this.messageTypeCount) as Record<MessageType, number>,
      serviceMetrics: Object.fromEntries(
        Array.from(this.serviceMetrics.entries()).map(([service, metrics]) => [
          service,
          Object.fromEntries(metrics)
        ])
      )
    };
  }

  /**
   * Clear all metrics data
   */
  clearMetrics(): void {
    this.metrics.clear();
    this.aggregatedMetrics.clear();
    this.messageTypeCount.clear();
    this.serviceMetrics.clear();
    
    // Reset message type counts
    Object.values(MessageType).forEach(type => {
      this.messageTypeCount.set(type, 0);
    });
    
    if (this.options.enableLogging) {
      console.log('[MetricsCollector] Cleared all metrics');
    }
  }
}

// Create and export a singleton instance
export const metricsCollector = new MetricsCollector();
