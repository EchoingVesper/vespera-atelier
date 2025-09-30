#!/usr/bin/env node
/**
 * Quick test script to verify logging module functionality
 * Run with: npx ts-node test-logging.ts
 */

import {
  createDefaultLogger,
  createJSONLogger,
  StructuredLogger,
  LogLevel,
  ConsoleTransport,
  BufferedTransport,
  PrettyFormatter,
  JSONFormatter,
} from './src/logging';

console.log('=== Testing Logging Module ===\n');

// Test 1: Basic logger
console.log('--- Test 1: Basic Logger ---');
const logger = createDefaultLogger('TestService', LogLevel.DEBUG);
logger.debug('Debug message', { detail: 'verbose info' });
logger.info('Service initialized', { port: 3000, env: 'test' });
logger.warn('Warning message', { threshold: 0.8 });
logger.error('Error occurred', new Error('Test error'), { context: 'test' });

// Test 2: Child logger
console.log('\n--- Test 2: Child Logger ---');
const apiLogger = createDefaultLogger('API');
const requestLogger = apiLogger.child('Request', { requestId: 'req-123' });
requestLogger.info('Processing request', { method: 'GET', path: '/test' });

// Test 3: JSON logger
console.log('\n--- Test 3: JSON Logger ---');
const jsonLogger = createJSONLogger('JSONService', LogLevel.INFO);
jsonLogger.info('JSON formatted log', { structured: true, data: { key: 'value' } });

// Test 4: Buffered transport
console.log('\n--- Test 4: Buffered Transport ---');
const buffer = new BufferedTransport();
const bufferedLogger = new StructuredLogger({
  level: LogLevel.DEBUG,
  category: 'Buffered',
  transports: [buffer],
});

bufferedLogger.info('Message 1');
bufferedLogger.debug('Message 2');
bufferedLogger.warn('Message 3');

const entries = buffer.getEntries();
console.log(`✓ Captured ${entries.length} log entries`);
console.log(`✓ First entry: ${entries[0].message} (level: ${entries[0].level})`);

// Test 5: Different formatters
console.log('\n--- Test 5: Formatter Comparison ---');
const testEntry = {
  timestamp: new Date(),
  level: LogLevel.INFO,
  category: 'Test',
  message: 'Sample message',
  context: { foo: 'bar', count: 42 },
};

console.log('JSON Format:');
const jsonFormatter = new JSONFormatter({ pretty: false });
console.log(jsonFormatter.format(testEntry));

console.log('\nPretty Format:');
const prettyFormatter = new PrettyFormatter({ colors: false });
console.log(prettyFormatter.format(testEntry));

console.log('\n=== All Tests Completed Successfully! ===');