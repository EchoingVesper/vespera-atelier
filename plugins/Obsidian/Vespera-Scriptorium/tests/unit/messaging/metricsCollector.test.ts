/**
 * Unit tests for the metrics collection system
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { MetricsCollector, MetricType, MetricsCollectorOptions } from '../../../src/core/messaging/metricsCollector';
import { Message, MessageType } from '../../../src/core/messaging/types';

describe('MetricsCollector', () => {
  let metricsCollector: MetricsCollector;
  let options: MetricsCollectorOptions;
  
  beforeEach(() => {
    // Create options for testing with faster intervals
    options = {
      retentionPeriod: 60000, // 1 minute for faster tests
      aggregationInterval: 1000, // 1 second for faster tests
      reportingInterval: 5000, // 5 seconds for faster tests
      maxDataPoints: 100,
      enableReporting: false, // Disable automatic reporting for tests
      enableLogging: false
    };
    
    metricsCollector = new MetricsCollector(options);
  });
  
  afterEach(() => {
    // Clean up
    metricsCollector.stopTimers();
    metricsCollector.clearMetrics();
    vi.clearAllMocks();
    vi.clearAllTimers();
  });

  describe('Basic Metric Recording', () => {
    it('should record a simple metric', () => {
      const metricAddedSpy = vi.fn();
      metricsCollector.on('metricAdded', metricAddedSpy);

      metricsCollector.recordMetric(MetricType.MESSAGES_SENT, 1);
      
      expect(metricAddedSpy).toHaveBeenCalledWith(MetricType.MESSAGES_SENT, 1, undefined);
    });

    it('should record metric with tags', () => {
      const tags = { service: 'test-service', type: 'heartbeat' };
      
      metricsCollector.recordMetric(MetricType.MESSAGES_SENT, 1, tags);
      
      // Verify metric was recorded by checking snapshot
      const snapshot = metricsCollector.getMetricsSnapshot();
      const metricKey = `${MetricType.MESSAGES_SENT}[service=test-service,type=heartbeat]`;
      expect(snapshot.metrics[metricKey]).toBeDefined();
    });

    it('should record custom metrics', () => {
      metricsCollector.recordCustomMetric('test-metric', 42, { type: 'custom' });
      
      const snapshot = metricsCollector.getMetricsSnapshot();
      const metricKey = `${MetricType.CUSTOM}.test-metric[type=custom]`;
      expect(snapshot.metrics[metricKey]).toBeDefined();
    });
  });

  describe('Message Recording', () => {
    let testMessage: Message;

    beforeEach(() => {
      testMessage = {
        type: MessageType.HEARTBEAT,
        headers: {
          correlationId: 'test-correlation',
          messageId: 'test-message',
          timestamp: new Date().toISOString(),
          source: 'test-service'
        },
        payload: {}
      };
    });

    it('should record message sent metrics', () => {
      metricsCollector.recordMessageSent(testMessage, 100);
      
      const snapshot = metricsCollector.getMetricsSnapshot();
      expect(snapshot.messageTypeBreakdown?.[MessageType.HEARTBEAT]).toBe(1);
    });

    it('should record message received metrics', () => {
      metricsCollector.recordMessageReceived(testMessage, 50);
      
      const snapshot = metricsCollector.getMetricsSnapshot();
      expect(snapshot.messageTypeBreakdown?.[MessageType.HEARTBEAT]).toBe(1);
    });

    it('should record message failed metrics', () => {
      const error = new Error('Test error');
      metricsCollector.recordMessageFailed(testMessage, error);
      
      const snapshot = metricsCollector.getMetricsSnapshot();
      const failedKey = `${MetricType.MESSAGES_FAILED}.${MessageType.HEARTBEAT}`;
      expect(snapshot.metrics[failedKey]).toBeDefined();
    });
  });

  describe('Throughput and Latency', () => {
    it('should calculate throughput correctly', () => {
      // Record some metrics
      metricsCollector.recordMetric(MetricType.MESSAGES_SENT, 1);
      metricsCollector.recordMetric(MetricType.MESSAGES_RECEIVED, 1);
      
      const throughput = metricsCollector.getThroughput(60000);
      expect(throughput).toBeGreaterThanOrEqual(0);
    });

    it('should calculate average latency correctly', () => {
      // Record some latency metrics
      metricsCollector.recordMetric(MetricType.LATENCY, 100);
      metricsCollector.recordMetric(MetricType.LATENCY, 200);
      
      const avgLatency = metricsCollector.getAverageLatency(60000);
      expect(avgLatency).toBe(150);
    });

    it('should return zero latency when no data', () => {
      const avgLatency = metricsCollector.getAverageLatency(60000);
      expect(avgLatency).toBe(0);
    });
  });

  describe('Timer Management', () => {
    it('should start and stop timers correctly', () => {
      metricsCollector.startTimers();
      metricsCollector.stopTimers();
      // Test passes if no errors are thrown
      expect(true).toBe(true);
    });

    it('should clear all metrics', () => {
      metricsCollector.recordMetric(MetricType.MESSAGES_SENT, 1);
      
      let snapshot = metricsCollector.getMetricsSnapshot();
      expect(Object.keys(snapshot.metrics).length).toBeGreaterThan(0);
      
      metricsCollector.clearMetrics();
      
      snapshot = metricsCollector.getMetricsSnapshot();
      expect(Object.keys(snapshot.metrics).length).toBe(0);
    });
  });
});
