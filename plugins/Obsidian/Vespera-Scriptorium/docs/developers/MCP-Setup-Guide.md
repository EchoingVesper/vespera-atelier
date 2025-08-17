# MCP Server Setup and Integration Guide

## Table of Contents

1. [Introduction](#introduction)
2. [Prerequisites](#prerequisites)
3. [Installation](#installation)
4. [Configuration](#configuration)
5. [Integration with Vespera Scriptorium](#integration-with-vespera-scriptorium)
6. [Development Workflow](#development-workflow)
7. [Troubleshooting](#troubleshooting)
8. [Security Considerations](#security-considerations)
9. [Performance Tuning](#performance-tuning)
10. [FAQs](#faqs)

## Introduction

This guide provides detailed instructions for setting up and integrating the Model Context Protocol (MCP) server with Vespera Scriptorium. The MCP server enables secure and efficient interaction with your Obsidian vault, enhancing the plugin's document processing capabilities.

## Prerequisites

- Node.js 16+ installed
- Obsidian desktop application
- Vespera Scriptorium plugin installed
- Basic understanding of Obsidian's file structure

## Installation

### 1. Install Obsidian REST API Plugin

1. Open Obsidian
2. Go to Settings > Community plugins
3. Click "Browse" and search for "REST API"
4. Install and enable the plugin
5. Note the API key shown in the plugin settings

### 2. Install MCP Server

#### Option A: Using npm (Recommended)

```bash
npm install -g @vespera/obsidian-mcp
```

#### Option B: From Source

```bash
git clone https://github.com/vespera/obsidian-mcp.git
cd obsidian-mcp
npm install
npm run build
```

## Configuration

### 1. MCP Server Configuration

Create a configuration file at `~/.vespera/mcp.config.json`:

```json
{
  "server": {
    "port": 3000,
    "host": "localhost",
    "logLevel": "info"
  },
  "obsidian": {
    "vaultPath": "/path/to/your/vault",
    "apiKey": "your_obsidian_api_key"
  },
  "security": {
    "enabled": true,
    "allowedOrigins": ["http://localhost:3001"]
  }
}
```

### 2. Vespera Scriptorium Plugin Configuration

Add the following to your `vault/.obsidian/plugins/vespera-scriptorium/data.json`:

```json
{
  "mcp": {
    "enabled": true,
    "serverUrl": "http://localhost:3000",
    "apiKey": "your_vespera_api_key"
  }
}
```

## Integration with Vespera Scriptorium

### 1. Initialization

In your plugin's main file:

```typescript
import { MCPService } from 'vespera-mcp';

// Initialize MCP service
const mcpService = new MCPService({
  serverUrl: config.mcp.serverUrl,
  apiKey: config.mcp.apiKey,
  vaultPath: app.vault.adapter.basePath
});

// Start the service
await mcpService.initialize();
```

### 2. Using MCP in Your Plugin

#### Reading Files

```typescript
// Read a file
const content = await mcpService.readFile('path/to/note.md');

// Search for files
const results = await mcpService.search({
  query: 'search term',
  limit: 10
});
```

#### Processing Documents

```typescript
// Process a document
const result = await mcpService.processDocument('path/to/doc.md', {
  pipeline: ['extract-metadata', 'summarize']
});

// Batch process multiple files
const batchResults = await mcpService.batchProcess({
  files: ['doc1.md', 'doc2.md'],
  pipeline: ['extract-entities', 'generate-tags']
});
```

## Development Workflow

### 1. Starting the Development Server

```bash
# Start MCP server in development mode
npm run dev

# In another terminal, start the plugin in development mode
cd your-plugin
yarn dev
```

### 2. Testing

Run the test suite:

```bash
npm test
```

### 3. Debugging

Enable debug logging:

```typescript
mcpService.setLogLevel('debug');
```

View logs:

```bash
tail -f ~/.vespera/logs/mcp.log
```

## Troubleshooting

### Common Issues

1. **Connection Refused**
   - Verify MCP server is running
   - Check firewall settings
   - Ensure correct port configuration

2. **Authentication Errors**
   - Verify API keys match
   - Check token expiration
   - Ensure proper permissions

3. **Performance Issues**
   - Check server resource usage
   - Review query optimization
   - Implement caching where appropriate

## Security Considerations

1. **API Keys**
   - Never commit API keys to version control
   - Use environment variables for sensitive data
   - Rotate keys regularly

2. **Network Security**
   - Use HTTPS in production
   - Implement rate limiting
   - Validate all inputs

3. **Data Protection**
   - Encrypt sensitive data
   - Implement access controls
   - Regular security audits

## Performance Tuning

### Caching

```typescript
// Enable caching
mcpService.enableCaching({
  ttl: 3600, // 1 hour
  maxSize: 1000
});
```

### Batch Processing

```typescript
// Process multiple files in batches
const results = await mcpService.batchProcess({
  files: largeFileList,
  batchSize: 10,
  concurrency: 3
});
```

## FAQs

### Q: Can I use MCP with mobile?

A: Currently, MCP is optimized for desktop use. Mobile support is planned for a future release.

### Q: How do I update the MCP server?

```bash
npm update @vespera/obsidian-mcp
```

### Q: Is my data secure?

A: Yes, all communication is encrypted and access is controlled via API keys.

## Support

For additional help, please contact <support@vespera.dev> or open an issue on our GitHub repository.
