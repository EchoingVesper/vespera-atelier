/**
 * Examples demonstrating the logging module
 *
 * This file is not part of the package exports, but serves as documentation
 * and can be used for testing the logging functionality.
 */

import {
  createDefaultLogger,
  createJSONLogger,
  StructuredLogger,
  LogLevel,
  ConsoleTransport,
  FileTransport,
  BufferedTransport,
  MultiTransport,
  FilterTransport,
  PrettyFormatter,
  JSONFormatter,
  CompactFormatter,
} from './index';

/**
 * Example 1: Basic usage with default logger
 */
export function example1_BasicUsage() {
  const logger = createDefaultLogger('MyService');

  logger.info('Service started', { port: 3000, env: 'production' });
  logger.warn('High memory usage', { usage: '85%' });
  logger.debug('Processing request', { requestId: 'abc123' });
  logger.error('Database connection failed', new Error('Connection timeout'), {
    db: 'postgres',
    host: 'localhost',
  });
}

/**
 * Example 2: Child loggers with inherited context
 */
export function example2_ChildLoggers() {
  const logger = createDefaultLogger('API');

  // Create child logger with additional context
  const requestLogger = logger.child('Request', { requestId: 'req-123' });
  requestLogger.info('Request received', { method: 'GET', path: '/api/users' });

  // Create another child with more context
  const userLogger = requestLogger.child('User', { userId: 'user-456' });
  userLogger.info('User authenticated');
  userLogger.debug('Loading user profile');
}

/**
 * Example 3: Custom logger with multiple transports
 */
export function example3_MultipleTransports() {
  const multiTransport = new MultiTransport([
    // Pretty console output for development
    new ConsoleTransport(new PrettyFormatter({ colors: true })),
    // JSON file output for production
    new FileTransport(
      './logs/api.log',
      new JSONFormatter(),
      { maxSize: 10 * 1024 * 1024 } // 10MB
    ),
  ]);

  const logger = new StructuredLogger({
    level: LogLevel.DEBUG,
    category: 'API',
    transports: [multiTransport],
    defaultContext: { service: 'backend', version: '1.0.0' },
  });

  logger.info('Multi-transport logging example');
}

/**
 * Example 4: Filtered transport (only log errors to a specific destination)
 */
export function example4_FilteredTransport() {
  const errorFileTransport = new FilterTransport(
    new FileTransport('./logs/errors.log', new JSONFormatter()),
    (entry) => entry.level >= LogLevel.ERROR
  );

  const multiTransport = new MultiTransport([
    new ConsoleTransport(new PrettyFormatter()),
    errorFileTransport, // Only errors go to this file
  ]);

  const logger = new StructuredLogger({
    level: LogLevel.DEBUG,
    category: 'App',
    transports: [multiTransport],
  });

  logger.debug('This won\'t go to errors.log');
  logger.info('Neither will this');
  logger.error('But this will!', new Error('Critical failure'));
}

/**
 * Example 5: Buffered transport for testing
 */
export function example5_BufferedTransport() {
  const buffer = new BufferedTransport(undefined, {
    maxSize: 100,
    flushInterval: 5000,
  });

  const logger = new StructuredLogger({
    level: LogLevel.DEBUG,
    category: 'Test',
    transports: [buffer],
  });

  logger.info('Test message 1');
  logger.info('Test message 2');
  logger.debug('Test message 3');

  // Get buffered entries for assertions
  const entries = buffer.getEntries();
  console.log(`Buffered ${entries.length} entries`);

  // Manually flush
  buffer.flush();

  // Clear buffer
  buffer.clear();
}

/**
 * Example 6: Different formatters
 */
export function example6_Formatters() {
  const entry = {
    timestamp: new Date(),
    level: LogLevel.INFO,
    category: 'API',
    message: 'Request processed',
    context: { duration: 42, status: 200 },
  };

  // JSON formatter
  const jsonFormatter = new JSONFormatter({ pretty: true });
  console.log('JSON Format:');
  console.log(jsonFormatter.format(entry));

  // Pretty formatter
  const prettyFormatter = new PrettyFormatter({
    colors: true,
    timestampFormat: 'time',
  });
  console.log('\nPretty Format:');
  console.log(prettyFormatter.format(entry));

  // Compact formatter
  const compactFormatter = new CompactFormatter();
  console.log('\nCompact Format:');
  console.log(compactFormatter.format(entry));
}

/**
 * Example 7: JSON logger for production
 */
export function example7_JSONLogger() {
  const logger = createJSONLogger('Production', LogLevel.INFO);

  logger.info('Application started', {
    version: '1.0.0',
    environment: 'production',
    nodeVersion: process.version,
  });

  logger.warn('High CPU usage detected', { cpu: 0.85 });

  logger.error('Service unavailable', new Error('Circuit breaker open'), {
    service: 'payment-gateway',
    attempts: 3,
  });
}

/**
 * Example 8: Category-based logging
 */
export function example8_CategoryLogging() {
  // Different loggers for different modules
  const dbLogger = createDefaultLogger('Database');
  const apiLogger = createDefaultLogger('API');
  const cacheLogger = createDefaultLogger('Cache');

  dbLogger.info('Connected to database', { host: 'localhost' });
  apiLogger.info('API server started', { port: 3000 });
  cacheLogger.info('Cache initialized', { type: 'redis' });

  // Easy to filter logs by category
  dbLogger.debug('Query executed', { sql: 'SELECT * FROM users', duration: 42 });
  apiLogger.debug('Request received', { method: 'GET', path: '/health' });
}

/**
 * Example 9: Environment-based configuration
 */
export function example9_EnvironmentConfig() {
  // Respects LOG_LEVEL, LOG_FORMAT, and NO_COLOR env vars
  // LOG_LEVEL=debug LOG_FORMAT=json npm start
  const logger = createDefaultLogger('App');

  logger.debug('Debug information'); // Only shown if LOG_LEVEL=debug
  logger.info('Application ready');
  logger.warn('Warning message');
  logger.error('Error occurred', new Error('Something went wrong'));
}

/**
 * Example 10: Advanced structured logging
 */
export function example10_StructuredLogging() {
  const logger = createDefaultLogger('API');

  // Log with rich context
  logger.info('User action', {
    action: 'login',
    user: {
      id: 'user-123',
      email: 'user@example.com',
      role: 'admin',
    },
    metadata: {
      ip: '192.168.1.1',
      userAgent: 'Mozilla/5.0...',
      timestamp: new Date().toISOString(),
    },
    metrics: {
      duration: 123,
      attempts: 1,
    },
  });

  // Structured error logging
  logger.error('Payment failed', new Error('Insufficient funds'), {
    payment: {
      id: 'pay-456',
      amount: 99.99,
      currency: 'USD',
    },
    user: {
      id: 'user-123',
      balance: 50.00,
    },
  });
}

// Run all examples if executed directly
if (require.main === module) {
  console.log('\n=== Example 1: Basic Usage ===');
  example1_BasicUsage();

  console.log('\n=== Example 2: Child Loggers ===');
  example2_ChildLoggers();

  console.log('\n=== Example 6: Different Formatters ===');
  example6_Formatters();

  console.log('\n=== Example 7: JSON Logger ===');
  example7_JSONLogger();

  console.log('\n=== Example 8: Category-based Logging ===');
  example8_CategoryLogging();

  console.log('\n=== Example 10: Structured Logging ===');
  example10_StructuredLogging();
}