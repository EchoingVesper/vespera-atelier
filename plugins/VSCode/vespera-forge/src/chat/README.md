# Vespera Forge Chat System

A complete chat system implementation for VS Code extensions with streaming support, message history, and provider management.

## Features

### 🎯 Core Features
- **Message Differentiation**: Distinct styling for user, assistant, and system messages
- **Highlighted Names**: Clear sender identification (User, GPT-4, Claude, etc.)
- **Auto-scrolling**: Smart scroll behavior that preserves user position
- **Message History**: Persistent conversation storage using VS Code's global state
- **VS Code Theme Integration**: Follows light/dark theme preferences
- **Streaming Support**: Real-time message updates as tokens arrive
- **Error Handling**: Graceful error display and recovery

### 💬 Message Features
- **Copy Messages**: Copy individual messages to clipboard
- **Edit Messages**: Edit and resend user messages
- **Retry Messages**: Retry failed assistant responses
- **Message Status**: Visual indicators for pending, success, and error states
- **Timestamps**: Optional message timestamps
- **Usage Information**: Token usage and model information display
- **Markdown Support**: Basic markdown rendering (inline code, line breaks)

### 🔧 Provider Management
- **Multiple Providers**: Support for OpenAI, Anthropic, LM Studio, etc.
- **Dynamic Configuration**: Runtime provider configuration
- **Connection Status**: Visual connection indicators
- **Provider Switching**: Easy switching between providers
- **Capability Detection**: Automatic streaming support detection

### 🎨 UI/UX Features
- **Responsive Design**: Works well in different panel sizes
- **Compact Mode**: Space-efficient layout option
- **Accessibility**: Full keyboard navigation and screen reader support
- **Animation**: Smooth transitions and loading indicators
- **Scroll Indicator**: "New messages" button when user has scrolled up

## Architecture

```
src/chat/
├── core/                           # Core business logic
│   ├── ChatManager.ts             # Main orchestration
│   ├── TemplateRegistry.ts        # Provider templates
│   └── ConfigurationManager.ts    # Settings management
├── ui/components/                  # React components
│   ├── atoms/                     # Basic components
│   │   ├── Message.tsx            # Individual message
│   │   ├── SendButton.tsx         # Send button
│   │   ├── ProviderIcon.tsx       # Provider icons
│   │   └── StatusIndicator.tsx    # Status indicators
│   ├── molecules/                 # Composite components
│   │   ├── MessageInput.tsx       # Input with controls
│   │   └── ProviderSelector.tsx   # Provider dropdown
│   └── organisms/                 # Complex components
│       ├── ChatWindow.tsx         # Main chat interface
│       └── ConfigurationFlyoutContainer.tsx
├── types/                         # TypeScript definitions
│   ├── chat.ts                   # Chat-related types
│   ├── provider.ts               # Provider types
│   └── config.ts                 # Configuration types
├── examples/                      # Usage examples
│   └── ChatIntegrationExample.tsx # Complete integration
└── media/                         # Styles and assets
    └── chat.css                   # Complete styling
```

## Quick Start

### 1. Basic Integration

```typescript
import { ChatIntegrationExample } from './chat/examples/ChatIntegrationExample';

// In your VS Code webview
<ChatIntegrationExample context={context} />
```

### 2. Custom Implementation

```typescript
import { ChatWindow } from './chat/ui/components/organisms/ChatWindow';
import { ChatManager } from './chat/core/ChatManager';

const MyChat: React.FC = () => {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [providers, setProviders] = useState<ProviderOption[]>([]);
  
  const handleSendMessage = async (content: string) => {
    // Your message sending logic
  };
  
  return (
    <ChatWindow
      messages={messages}
      providers={providers}
      onSendMessage={handleSendMessage}
      onMessageCopy={(content) => vscode.env.clipboard.writeText(content)}
      streaming={false}
      connected={true}
    />
  );
};
```

## Component API

### ChatWindow

Main chat interface component with all features integrated.

```typescript
interface ChatWindowProps {
  // Data
  messages: ChatMessage[];
  providers: ProviderOption[];
  selectedProviderId?: string;
  currentThread?: ChatThread;
  
  // State
  loading?: boolean;
  streaming?: boolean;
  connected?: boolean;
  
  // Configuration
  showTimestamps?: boolean;
  compactMode?: boolean;
  maxMessageLength?: number;
  
  // Handlers
  onSendMessage: (content: string) => void;
  onProviderChange: (providerId: string) => void;
  onMessageCopy?: (content: string) => void;
  onMessageRetry?: (messageId: string) => void;
  onMessageEdit?: (messageId: string, newContent: string) => void;
  onClearHistory?: () => void;
  onExportHistory?: () => void;
}
```

### Message

Individual message component with rich features.

```typescript
interface MessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
  compact?: boolean;
  streaming?: boolean;
  onCopy?: (content: string) => void;
  onRetry?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
}
```

### ChatManager

Core business logic for message handling and provider management.

```typescript
class ChatManager {
  // Regular messaging
  sendMessage(content: string, providerId?: string): Promise<ChatResponse | null>;
  
  // Streaming messaging
  sendStreamingMessage(
    content: string,
    onChunk: (chunk: ChatChunk) => void,
    providerId?: string
  ): Promise<ChatResponse | null>;
  
  // Provider management
  switchProvider(providerId: string): Promise<void>;
  addProvider(template: ProviderTemplate, config: any): Promise<void>;
  
  // History management
  clearHistory(): Promise<void>;
  exportHistory(format: 'json' | 'markdown'): string;
  retryMessage(messageId: string): Promise<ChatResponse | null>;
}
```

## Styling

The chat system uses VS Code's CSS variables for seamless integration:

```css
:root {
  /* Theme integration */
  --vscode-chat-background: var(--vscode-editor-background);
  --vscode-chat-foreground: var(--vscode-editor-foreground);
  
  /* Chat-specific colors */
  --chat-user-message: var(--vscode-textLink-foreground);
  --chat-assistant-message: var(--vscode-chat-foreground);
  --chat-error-message: var(--vscode-errorForeground);
}
```

### Custom Styling

To customize appearance, override CSS classes:

```css
/* Custom user message styling */
.message--user {
  background: #e3f2fd;
  border-left: 4px solid #2196f3;
}

/* Custom streaming indicator */
.message__streaming-indicator {
  color: #ff9800;
}
```

## Advanced Features

### Streaming Support

```typescript
// Enable streaming in ChatManager
await chatManager.sendStreamingMessage(
  "Hello!",
  (chunk: ChatChunk) => {
    // Handle each streaming chunk
    console.log('Received chunk:', chunk.content);
  }
);
```

### Message Editing

```typescript
// Handle message edits
const handleMessageEdit = (messageId: string, newContent: string) => {
  // Update message and potentially retry from that point
  chatManager.retryMessage(messageId);
};
```

### Provider Configuration

```typescript
// Add a new provider
await chatManager.addProvider(providerTemplate, {
  apiKey: 'your-api-key',
  baseUrl: 'https://api.provider.com',
  model: 'gpt-4',
  temperature: 0.7
});
```

### History Management

```typescript
// Export chat history
const markdownHistory = chatManager.exportHistory('markdown');
const jsonHistory = chatManager.exportHistory('json');

// Clear history
await chatManager.clearHistory();
```

## Performance Considerations

### Message Virtualization

For long conversations (>100 messages), consider implementing virtualization:

```typescript
// Example with react-window
import { FixedSizeList } from 'react-window';

const VirtualizedMessageList = ({ messages }) => (
  <FixedSizeList
    height={400}
    itemCount={messages.length}
    itemSize={120}
  >
    {({ index, style }) => (
      <div style={style}>
        <Message message={messages[index]} />
      </div>
    )}
  </FixedSizeList>
);
```

### Streaming Optimization

```typescript
// Debounce UI updates during streaming
const debouncedUpdate = useMemo(
  () => debounce(updateUI, 50),
  []
);

const handleStreamChunk = (chunk: ChatChunk) => {
  // Update state immediately
  appendToMessage(chunk.content);
  
  // Debounce UI render
  debouncedUpdate();
};
```

## Accessibility

The chat system includes comprehensive accessibility features:

- **Screen Reader Support**: All interactive elements have proper ARIA labels
- **Keyboard Navigation**: Full keyboard support for all actions
- **High Contrast**: Automatic adaptation to high contrast themes
- **Focus Management**: Proper focus handling for dynamic content

## Browser Compatibility

- **VS Code Webview**: Full support (Electron/Chromium)
- **Modern Browsers**: Chrome 88+, Firefox 85+, Safari 14+
- **WebView2**: Full support for Windows VS Code

## Troubleshooting

### Common Issues

1. **Messages not appearing**: Check ChatManager initialization
2. **Streaming not working**: Verify provider supports streaming
3. **Styling issues**: Ensure CSS file is properly loaded
4. **Copy not working**: Check clipboard permissions

### Debug Mode

Enable debug logging:

```typescript
const chatManager = new ChatManager(context, registry, config, router);
chatManager.setDebugMode(true);
```

## Contributing

1. Follow the existing component structure
2. Add proper TypeScript types
3. Include comprehensive styling
4. Test with different VS Code themes
5. Ensure accessibility compliance

## License

This project is licensed under the GNU Affero General Public License v3.0 (AGPL-3.0).