/**
 * Log transports for different output destinations
 *
 * @example
 * ```typescript
 * import { ConsoleTransport, FileTransport, BufferedTransport } from './transports';
 * import { JSONFormatter, PrettyFormatter } from './formatters';
 *
 * const consoleTransport = new ConsoleTransport(new PrettyFormatter());
 * const fileTransport = new FileTransport('./logs/app.log', new JSONFormatter());
 * const bufferedTransport = new BufferedTransport(consoleTransport, { maxSize: 100 });
 * ```
 */

import * as fs from 'fs';
import * as path from 'path';
import { LogEntry, LogLevel, LogTransport } from './logger';
import { LogFormatter } from './formatters';

/**
 * Console transport for outputting logs to stdout/stderr
 *
 * @example
 * ```typescript
 * import { ConsoleTransport } from './transports';
 * import { PrettyFormatter } from './formatters';
 *
 * const transport = new ConsoleTransport(new PrettyFormatter({ colors: true }));
 * ```
 */
export class ConsoleTransport implements LogTransport {
  constructor(private formatter: LogFormatter) {}

  log(entry: LogEntry): void {
    const formatted = this.formatter.format(entry);

    // Use stderr for errors and warnings, stdout for others
    if (entry.level >= LogLevel.ERROR) {
      console.error(formatted);
    } else if (entry.level === LogLevel.WARN) {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  }
}

/**
 * File transport configuration
 */
export interface FileTransportOptions {
  /**
   * Maximum file size in bytes before rotation
   */
  maxSize?: number;

  /**
   * Maximum number of rotated files to keep
   */
  maxFiles?: number;

  /**
   * Whether to append to existing file
   */
  append?: boolean;

  /**
   * File encoding
   */
  encoding?: BufferEncoding;
}

/**
 * File transport for writing logs to disk
 *
 * @example
 * ```typescript
 * import { FileTransport } from './transports';
 * import { JSONFormatter } from './formatters';
 *
 * const transport = new FileTransport('./logs/app.log', new JSONFormatter(), {
 *   maxSize: 10 * 1024 * 1024, // 10MB
 *   maxFiles: 5
 * });
 * ```
 */
export class FileTransport implements LogTransport {
  private writeStream: fs.WriteStream | null = null;
  private currentSize = 0;
  private options: Required<FileTransportOptions>;

  constructor(
    private filePath: string,
    private formatter: LogFormatter,
    options: FileTransportOptions = {}
  ) {
    this.options = {
      maxSize: options.maxSize ?? 10 * 1024 * 1024, // 10MB default
      maxFiles: options.maxFiles ?? 5,
      append: options.append ?? true,
      encoding: options.encoding ?? 'utf8',
    };

    this.ensureDirectory();
    this.initializeStream();
  }

  log(entry: LogEntry): void {
    const formatted = this.formatter.format(entry) + '\n';
    const size = Buffer.byteLength(formatted, this.options.encoding);

    // Check if rotation is needed
    if (this.currentSize + size > this.options.maxSize) {
      this.rotate();
    }

    if (this.writeStream) {
      this.writeStream.write(formatted, this.options.encoding);
      this.currentSize += size;
    }
  }

  flush(): void {
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }
  }

  private ensureDirectory(): void {
    const dir = path.dirname(this.filePath);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
  }

  private initializeStream(): void {
    if (this.writeStream) {
      this.writeStream.end();
    }

    const flags = this.options.append ? 'a' : 'w';
    this.writeStream = fs.createWriteStream(this.filePath, {
      flags,
      encoding: this.options.encoding,
    });

    // Get current file size if appending
    if (this.options.append && fs.existsSync(this.filePath)) {
      this.currentSize = fs.statSync(this.filePath).size;
    } else {
      this.currentSize = 0;
    }
  }

  private rotate(): void {
    // Close current stream
    if (this.writeStream) {
      this.writeStream.end();
      this.writeStream = null;
    }

    // Rotate existing files
    for (let i = this.options.maxFiles - 1; i > 0; i--) {
      const oldPath = this.getRotatedPath(i);
      const newPath = this.getRotatedPath(i + 1);

      if (fs.existsSync(oldPath)) {
        if (i === this.options.maxFiles - 1) {
          // Delete oldest file
          fs.unlinkSync(oldPath);
        } else {
          // Rename to next number
          fs.renameSync(oldPath, newPath);
        }
      }
    }

    // Rename current file to .1
    if (fs.existsSync(this.filePath)) {
      fs.renameSync(this.filePath, this.getRotatedPath(1));
    }

    // Create new stream
    this.initializeStream();
  }

  private getRotatedPath(index: number): string {
    return `${this.filePath}.${index}`;
  }
}

/**
 * Buffered transport configuration
 */
export interface BufferedTransportOptions {
  /**
   * Maximum buffer size before flushing
   */
  maxSize?: number;

  /**
   * Flush interval in milliseconds
   */
  flushInterval?: number;
}

/**
 * Buffered transport for batching log entries
 *
 * Useful for:
 * - Testing (capture logs without output)
 * - Performance (batch writes)
 * - Network transports (reduce requests)
 *
 * @example
 * ```typescript
 * import { BufferedTransport, ConsoleTransport } from './transports';
 *
 * const underlying = new ConsoleTransport(formatter);
 * const transport = new BufferedTransport(underlying, {
 *   maxSize: 100,
 *   flushInterval: 5000 // Flush every 5 seconds
 * });
 *
 * // Later, manually flush
 * transport.flush();
 *
 * // Get buffered entries for testing
 * const entries = transport.getEntries();
 * ```
 */
export class BufferedTransport implements LogTransport {
  private buffer: LogEntry[] = [];
  private timer: NodeJS.Timeout | null = null;
  private options: Required<BufferedTransportOptions>;

  constructor(
    private underlying?: LogTransport,
    options: BufferedTransportOptions = {}
  ) {
    this.options = {
      maxSize: options.maxSize ?? 100,
      flushInterval: options.flushInterval ?? 5000,
    };

    // Start periodic flush if interval specified
    if (this.options.flushInterval > 0) {
      this.timer = setInterval(
        () => this.flush(),
        this.options.flushInterval
      );
    }
  }

  log(entry: LogEntry): void {
    this.buffer.push(entry);

    // Auto-flush if buffer is full
    if (this.buffer.length >= this.options.maxSize) {
      this.flush();
    }
  }

  flush(): void {
    if (this.buffer.length === 0) {
      return;
    }

    const entries = [...this.buffer];
    this.buffer = [];

    if (this.underlying) {
      for (const entry of entries) {
        this.underlying.log(entry);
      }

      if (this.underlying.flush) {
        this.underlying.flush();
      }
    }
  }

  /**
   * Get all buffered entries (useful for testing)
   */
  getEntries(): LogEntry[] {
    return [...this.buffer];
  }

  /**
   * Clear the buffer without flushing
   */
  clear(): void {
    this.buffer = [];
  }

  /**
   * Stop the flush timer and flush remaining entries
   */
  destroy(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}

/**
 * Multi-transport for logging to multiple destinations
 *
 * @example
 * ```typescript
 * import { MultiTransport, ConsoleTransport, FileTransport } from './transports';
 *
 * const transport = new MultiTransport([
 *   new ConsoleTransport(prettyFormatter),
 *   new FileTransport('./logs/app.log', jsonFormatter)
 * ]);
 * ```
 */
export class MultiTransport implements LogTransport {
  constructor(private transports: LogTransport[]) {}

  log(entry: LogEntry): void {
    for (const transport of this.transports) {
      transport.log(entry);
    }
  }

  flush(): void {
    for (const transport of this.transports) {
      if (transport.flush) {
        transport.flush();
      }
    }
  }

  /**
   * Add a transport
   */
  addTransport(transport: LogTransport): void {
    this.transports.push(transport);
  }

  /**
   * Remove a transport
   */
  removeTransport(transport: LogTransport): void {
    const index = this.transports.indexOf(transport);
    if (index !== -1) {
      this.transports.splice(index, 1);
    }
  }
}

/**
 * Filter transport that only passes through entries matching criteria
 *
 * @example
 * ```typescript
 * import { FilterTransport, ConsoleTransport } from './transports';
 * import { LogLevel } from './logger';
 *
 * // Only log errors to console
 * const transport = new FilterTransport(
 *   new ConsoleTransport(formatter),
 *   (entry) => entry.level >= LogLevel.ERROR
 * );
 * ```
 */
export class FilterTransport implements LogTransport {
  constructor(
    private underlying: LogTransport,
    private predicate: (entry: LogEntry) => boolean
  ) {}

  log(entry: LogEntry): void {
    if (this.predicate(entry)) {
      this.underlying.log(entry);
    }
  }

  flush(): void {
    if (this.underlying.flush) {
      this.underlying.flush();
    }
  }
}