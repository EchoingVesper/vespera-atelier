# Claude Code Provider

The Claude Code Provider integrates Anthropic's official Claude Code TypeScript SDK into the Vespera Forge chat system. This provider allows you to use your Claude Max subscription without additional API costs.

## Features

- ✅ **Streaming Support**: Real-time response streaming
- ✅ **Tool Access**: Full access to Claude Code's powerful tools (Read, Write, Bash, Grep, Glob, WebSearch, etc.)
- ✅ **No API Costs**: Uses your Claude Max subscription
- ✅ **Multi-turn Conversations**: Support for complex, multi-step conversations
- ✅ **Configurable System Prompts**: Customize Claude's behavior
- ✅ **Tool Visibility**: Optional display of tool usage during conversations
- ✅ **Thinking Process**: Optional display of Claude's internal reasoning

## Installation

The Claude Code SDK is already installed as a dependency:

```bash
npm install @anthropic-ai/claude-code
```

## Configuration

The provider supports the following configuration options:

### Basic Settings

- **System Prompt**: Define Claude's role and behavior
  - Default: "You are Claude, a helpful AI assistant."
  - Type: Textarea

- **Max Conversation Turns**: Maximum back-and-forth exchanges
  - Default: 5
  - Range: 1-20
  - Type: Number

### Tool Configuration

- **Available Tools**: Select which tools Claude can use
  - Options:
    - `Read,Write,Bash,Grep,Glob` (Default) - File operations and search
    - `Read,Write,Bash` - Basic file operations
    - `Read,Write` - File access only
    - `Read,Bash,WebSearch` - Files and web access
    - `All` - All available tools
  - Type: Select

### Display Options

- **Show Thinking Process**: Display Claude's internal reasoning
  - Default: false
  - Type: Checkbox

- **Show Tool Usage**: Display when Claude uses tools
  - Default: true
  - Type: Checkbox

## Usage

### Creating a Provider Instance

```typescript
import { ClaudeCodeProvider } from './providers/ClaudeCodeProvider';
import { CLAUDE_CODE_TEMPLATE, createDefaultConfig } from './templates/providers/index';

// Create with default configuration
const config = createDefaultConfig(CLAUDE_CODE_TEMPLATE);
const provider = new ClaudeCodeProvider(CLAUDE_CODE_TEMPLATE, config);

// Connect and use
await provider.connect();
```

### Using the Provider Factory

```typescript
import { ProviderFactory } from './providers/ProviderFactory';
import { CLAUDE_CODE_TEMPLATE } from './templates/providers/index';

const provider = ProviderFactory.createProvider(
  CLAUDE_CODE_TEMPLATE, 
  {
    systemPrompt: "You are a helpful coding assistant.",
    maxTurns: 10,
    allowedTools: "Read,Write,Bash,Grep,Glob",
    enableThinking: true,
    enableToolVisibility: true
  }
);
```

### Streaming Messages

```typescript
const message = {
  id: 'msg_123',
  role: 'user' as const,
  content: 'Help me analyze this code file',
  timestamp: new Date(),
  threadId: 'thread_123'
};

for await (const chunk of provider.streamMessage(message)) {
  if (chunk.type === 'content') {
    console.log('Received:', chunk.content);
  } else if (chunk.type === 'error') {
    console.error('Error:', chunk.error);
    break;
  } else if (chunk.type === 'end') {
    console.log('Streaming complete');
    break;
  }
}
```

### Simple Messages

```typescript
const response = await provider.sendMessage(message);
console.log('Response:', response.content);
```

## Provider Methods

### Connection Management
- `connect()`: Initialize the provider
- `disconnect()`: Disconnect the provider
- `testConnection()`: Test if the provider is working
- `getStatus()`: Get current connection status

### Configuration
- `configure(config)`: Update provider configuration
- `validateConfig(config)`: Validate configuration
- `updateSystemPrompt(prompt)`: Update system prompt
- `updateAllowedTools(tools)`: Update allowed tools array
- `updateMaxTurns(turns)`: Update max conversation turns

### Messaging
- `sendMessage(message)`: Send a single message
- `streamMessage(message)`: Stream a message response
- `getCapabilities()`: Get provider capabilities
- `getTemplate()`: Get provider template

## Error Handling

The provider handles various error scenarios:

```typescript
try {
  await provider.connect();
  const response = await provider.sendMessage(message);
} catch (error) {
  if (error.message.includes('Provider not connected')) {
    // Handle connection error
    console.log('Reconnecting...');
    await provider.connect();
  } else {
    // Handle other errors
    console.error('Provider error:', error);
  }
}
```

## Event Handling

The provider emits events for status changes and errors:

```typescript
provider.on('statusChanged', ({ status, error }) => {
  console.log('Status changed:', status);
  if (error) console.error('Error:', error);
});

provider.on('error', (error) => {
  console.error('Provider error:', error);
});

provider.on('configUpdated', (config) => {
  console.log('Configuration updated:', config);
});
```

## Testing

Run the test suite to verify the provider is working:

```typescript
import { runAllTests } from './test-claude-code-provider';

// Run all tests
await runAllTests();
```

## Troubleshooting

### Provider Not Connecting
- Ensure the Claude Code SDK is properly installed
- Check that Node.js version is 18+
- Verify VS Code environment supports the SDK

### Tool Access Issues
- Check `allowedTools` configuration
- Ensure proper permissions for file operations
- Verify workspace access if using file tools

### Streaming Issues
- Check network connectivity
- Verify `maxTurns` setting isn't too low
- Monitor for memory issues with very long conversations

## Integration with Chat UI

The provider is automatically registered with the ProviderFactory and can be selected in the chat configuration UI. The template provides a user-friendly interface for all configuration options.

To use in the chat panel:

1. Open chat configuration
2. Select "Claude Code SDK" as provider
3. Configure settings as needed
4. Start chatting!

## Advanced Usage

### Custom Tool Configuration

```typescript
const customConfig = {
  systemPrompt: "You are a senior software architect.",
  maxTurns: 15,
  allowedTools: "Read,Write,Bash,WebSearch", 
  enableThinking: true,
  enableToolVisibility: false
};

await provider.configure(customConfig);
```

### Multi-turn Conversations

The provider maintains conversation context across multiple turns:

```typescript
// First message
const response1 = await provider.sendMessage({
  content: "Analyze this React component for optimization opportunities",
  // ... other message properties
});

// Follow-up message - Claude remembers the context
const response2 = await provider.sendMessage({
  content: "Now show me how to implement those optimizations",
  // ... other message properties
});
```

This provider gives you the full power of Claude Code within your VS Code extension, making it perfect for complex development tasks while using your existing Claude Max subscription.