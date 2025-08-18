# MCP Configuration

**Last Updated:** 2025-05-24  
**Status:** In Progress  
**Implementation Branch:** `1.0-protocol-architecture`

## Overview

The Model Context Protocol (MCP) module provides a standardized interface for interacting with various AI services and data sources within Vespera Scriptorium. This document outlines the current implementation status, configuration options, and usage guidelines.

## Implementation Status

### ✅ Completed Features

- Core MCP client with TypeScript support
- Configuration management with type safety
- Request queuing and rate limiting
- Comprehensive error handling
- Basic file operations (read/write/delete)
- Authentication and access control
- Logging and monitoring

### 📋 Pending Features

- TLS/SSL for secure communication
- Database connection support
- LLM provider integrations
- Comprehensive test coverage
- Operational runbooks

## Configuration

The MCP module can be configured using the following options:

```typescript
interface MCPClientConfig {
  // Server configuration
  enabled: boolean;
  host: string;
  port: number;
  secure: boolean;
  vaultPath: string;
  
  // Authentication
  apiKey?: string;
  
  // Connection settings
  timeout: number;
  maxRetries: number;
  retryDelay: number;
  
  // Logging
  logLevel: 'error' | 'warn' | 'info' | 'debug' | 'trace';
  
  // Caching
  cache: {
    enabled: boolean;
    ttl: number; // in milliseconds
  };
  
  // Rate limiting
  rateLimit: {
    enabled: boolean;
    maxRequests: number;
    interval: number; // in milliseconds
  };
}
```

## Usage Example

```typescript
import { initializeMCP, getMCPService } from '../../src/mcp';

// Initialize with your configuration
await initializeMCP({
  host: 'localhost',
  port: 3000,
  vaultPath: '/path/to/your/vault',
  apiKey: 'your-api-key',
  logLevel: 'info',
  cache: {
    enabled: true,
    ttl: 5 * 60 * 1000, // 5 minutes
  },
  rateLimit: {
    enabled: true,
    maxRequests: 100,
    interval: 60 * 1000, // 1 minute
  },
});

// Get the MCP service instance
const mcp = getMCPService();

// Example: Read a file
const result = await mcp.readFile('path/to/note.md');
if (result.success) {
  console.log('File content:', result.data?.content);
} else {
  console.error('Error reading file:', result.error);
}
```

## Error Handling

The MCP client provides comprehensive error handling through the `MCPResult` interface:

```typescript
interface MCPResult<T = unknown> {
  success: boolean;
  data?: T;
  error?: string;
  meta?: {
    duration: number;
    timestamp: number;
  };
}
```

## Development

### Building the Module

```bash
# Install dependencies
npm install

# Build the module
npm run build
```

### Running Tests

```bash
# Run unit tests
npm test

# Run tests with coverage
npm run test:coverage
```

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Integration Guide

### 1. Setting Up MCP Servers

1. Install required MCP servers:

   ```bash
   npm install @mcp/servers
   ```

2. Start the MCP server:

   ```bash
   npx mcp-serve --config ./mcp-config.json
   ```

### 2. Configuring LLM Providers

Add your LLM provider configurations to `mcp-servers.json`. Supported providers:

- OpenAI
- Anthropic
- Local LLMs (Ollama, LM Studio)
- Custom providers

### 3. Accessing Data Sources

Configure data sources in `mcp-servers.json` to access different storage backends:

- Local filesystem
- S3-compatible storage
- Database connections
- Web APIs

## Best Practices

1. **Environment Variables**: Store sensitive information like API keys in environment variables.
2. **Error Handling**: Implement proper error handling for MCP operations.
3. **Caching**: Use MCP's built-in caching for improved performance.
4. **Monitoring**: Monitor MCP server health and performance.

## Troubleshooting

1. **Connection Issues**:
   - Verify server URLs and ports
   - Check network connectivity
   - Validate API keys and authentication

2. **Performance Problems**:
   - Check server resource usage
   - Review query patterns
   - Consider implementing caching

3. **Data Access Problems**:
   - Verify file permissions
   - Check data source configurations
   - Review error logs for specific issues
