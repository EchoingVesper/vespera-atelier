/**
 * Chat Window organism component - complete chat interface
 */
import * as React from 'react';
import { Message } from '../atoms/Message';
import { MessageInput } from '../molecules/MessageInput';
import { ProviderSelector, ProviderOption } from '../molecules/ProviderSelector';
import { ConfigurationFlyoutContainer } from './ConfigurationFlyoutContainer';
import { ChatMessage, ChatThread } from '../../../types/chat';
import { HotkeyConfig, InputBehaviorConfig } from '../../../types/config';

export interface ChatWindowProps {
  // Data
  messages: ChatMessage[];
  currentThread?: ChatThread;
  providers: ProviderOption[];
  selectedProviderId?: string;
  
  // State
  loading?: boolean;
  streaming?: boolean;
  connected?: boolean;
  
  // Configuration
  showTimestamps?: boolean;
  compactMode?: boolean;
  hotkeys?: HotkeyConfig;
  inputBehavior?: InputBehaviorConfig;
  maxMessageLength?: number;
  
  // Handlers
  onSendMessage: (content: string) => void;
  onProviderChange: (providerId: string) => void;
  onProviderConfigure: (providerId: string) => void;
  onMessageCopy?: (content: string) => void;
  onMessageRetry?: (messageId: string) => void;
  onMessageEdit?: (messageId: string, newContent: string) => void;
  onClearHistory?: () => void;
  onExportHistory?: () => void;
  onScrollToTop?: () => void;
}

export const ChatWindow: React.FC<ChatWindowProps> = ({
  messages,
  currentThread,
  providers,
  selectedProviderId,
  loading = false,
  streaming = false,
  connected = true,
  showTimestamps = true,
  compactMode = false,
  hotkeys,
  inputBehavior,
  maxMessageLength = 4000,
  onSendMessage,
  onProviderChange,
  onProviderConfigure,
  onMessageCopy,
  onMessageRetry,
  onMessageEdit,
  onClearHistory,
  onExportHistory,
  onScrollToTop
}) => {
  const [inputValue, setInputValue] = React.useState('');
  const [isConfigFlyoutOpen, setIsConfigFlyoutOpen] = React.useState(false);
  const [isConfigFlyoutPinned, setIsConfigFlyoutPinned] = React.useState(false);
  const [streamingMessageId, setStreamingMessageId] = React.useState<string | null>(null);
  const [isUserScrolled, setIsUserScrolled] = React.useState(false);
  const [inputHistory, setInputHistory] = React.useState<string[]>([]);
  const messagesEndRef = React.useRef<HTMLDivElement>(null);
  const messagesContainerRef = React.useRef<HTMLDivElement>(null);
  const lastMessageCountRef = React.useRef(messages.length);

  // Auto-scroll to bottom when new messages arrive, but only if user hasn't scrolled up
  React.useEffect(() => {
    if (messages.length > lastMessageCountRef.current && !isUserScrolled) {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
    lastMessageCountRef.current = messages.length;
  }, [messages, isUserScrolled]);
  
  // Reset scroll detection when messages change significantly (e.g., clear history)
  React.useEffect(() => {
    if (messages.length === 0) {
      setIsUserScrolled(false);
    }
  }, [messages.length]);

  // Handle input changes
  const handleInputChange = (value: string) => {
    setInputValue(value);
  };

  // Handle command detection
  const handleCommandDetected = React.useCallback((command: string, _args: string[]): boolean => {
    switch (command.toLowerCase()) {
      case 'clear':
        if (onClearHistory) {
          onClearHistory();
          return true;
        }
        break;
      case 'export':
        if (onExportHistory) {
          onExportHistory();
          return true;
        }
        break;
      case 'help':
        // Show help message
        console.log('Available commands: /clear, /export, /help');
        return true;
      default:
        return false;
    }
    return false;
  }, [onClearHistory, onExportHistory]);

  // Handle message send
  const handleSendMessage = (content: string) => {
    if (content.trim() && connected && !loading) {
      onSendMessage(content);
      setInputValue('');
    }
  };

  // Handle history changes
  const handleHistoryChange = React.useCallback((history: string[]) => {
    setInputHistory(history);
  }, []);

  // Handle message copy
  const handleMessageCopy = (content: string) => {
    if (onMessageCopy) {
      onMessageCopy(content);
    } else {
      // Fallback to browser clipboard API
      navigator.clipboard?.writeText(content).catch(console.error);
    }
  };

  // Handle message retry
  const handleMessageRetry = (messageId: string) => {
    if (onMessageRetry) {
      onMessageRetry(messageId);
    }
  };
  
  // Handle message edit
  const handleMessageEdit = (messageId: string, newContent: string) => {
    if (onMessageEdit) {
      onMessageEdit(messageId, newContent);
    }
  };

  // Handle scroll events for infinite loading and scroll detection
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    const container = e.currentTarget;
    const isNearTop = container.scrollTop < 100;
    const isNearBottom = container.scrollHeight - container.scrollTop - container.clientHeight < 50;
    
    // Update user scroll state
    setIsUserScrolled(!isNearBottom);
    
    if (isNearTop && onScrollToTop) {
      onScrollToTop();
    }
  };
  
  // Force scroll to bottom
  const scrollToBottom = () => {
    setIsUserScrolled(false);
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const windowClasses = [
    'chat-window',
    compactMode ? 'chat-window--compact' : '',
    !connected ? 'chat-window--disconnected' : '',
    loading ? 'chat-window--loading' : ''
  ].filter(Boolean).join(' ');

  const hasMessages = messages.length > 0;
  const canSend = connected && !loading && inputValue.trim().length > 0;

  return (
    <div className={windowClasses}>
      {/* Header */}
      <div className="chat-window__header">
        <div className="chat-window__title">
          {currentThread?.title || 'Chat'}
        </div>
        
        <div className="chat-window__controls">
          <ProviderSelector
            providers={providers}
            selectedProviderId={selectedProviderId}
            onProviderChange={onProviderChange}
            onProviderConfigure={onProviderConfigure}
            compact={compactMode}
            disabled={loading}
          />
          
          <div className="chat-window__actions">
            <button
              className={`chat-window__action chat-window__action--configure ${isConfigFlyoutOpen ? 'chat-window__action--active' : ''}`}
              onClick={() => setIsConfigFlyoutOpen(!isConfigFlyoutOpen)}
              title="Configure providers"
              disabled={loading}
            >
              ⚙️
            </button>
            
            {hasMessages && (
              <>
                {onClearHistory && (
                  <button
                    className="chat-window__action"
                    onClick={onClearHistory}
                    title="Clear chat history"
                    disabled={loading}
                  >
                    🗑️
                  </button>
                )}
                
                {onExportHistory && (
                  <button
                    className="chat-window__action"
                    onClick={onExportHistory}
                    title="Export chat history"
                    disabled={loading}
                  >
                    📤
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Messages */}
      <div 
        className="chat-window__messages"
        ref={messagesContainerRef}
        onScroll={handleScroll}
      >
        {!hasMessages && (
          <div className="chat-window__empty">
            <div className="chat-window__empty-content">
              <div className="chat-window__empty-icon">💬</div>
              <div className="chat-window__empty-title">
                Start a conversation
              </div>
              <div className="chat-window__empty-description">
                {!connected 
                  ? 'Connect to a provider to start chatting'
                  : 'Type a message below to begin'
                }
              </div>
            </div>
          </div>
        )}

        {hasMessages && (
          <div className="chat-window__message-list">
            {messages.map((message) => (
              <Message
                key={message.id}
                message={message}
                showTimestamp={showTimestamps}
                compact={compactMode}
                streaming={streaming && message.id === streamingMessageId}
                onCopy={handleMessageCopy}
                onRetry={handleMessageRetry}
                onEdit={handleMessageEdit}
              />
            ))}
            
            {streaming && (
              <div className="chat-window__streaming-indicator">
                <div className="chat-window__typing">
                  <span></span>
                  <span></span>
                  <span></span>
                </div>
              </div>
            )}
          </div>
        )}
        
        <div ref={messagesEndRef} />
        
        {/* Scroll to bottom indicator */}
        {isUserScrolled && (
          <div className="chat-window__scroll-indicator">
            <button
              className="chat-window__scroll-button"
              onClick={scrollToBottom}
              title="Scroll to bottom"
              aria-label="Scroll to bottom"
            >
              ⬇️ New messages
            </button>
          </div>
        )}
      </div>

      {/* Input */}
      <div className="chat-window__input">
        {!connected && (
          <div className="chat-window__connection-warning">
            ⚠️ Not connected to a provider. Please configure a provider to start chatting.
          </div>
        )}
        
        <MessageInput
          value={inputValue}
          onChange={handleInputChange}
          onSend={handleSendMessage}
          disabled={!connected}
          loading={loading}
          placeholder={
            !connected 
              ? 'Configure a provider to start chatting...'
              : 'Type your message...'
          }
          maxLength={maxMessageLength}
          hotkeys={hotkeys}
          autoFocus={connected && hasMessages}
          showCharacterCounter={inputBehavior?.showCharacterCounter}
          sendOnPaste={inputBehavior?.sendOnPaste}
          enableCommandDetection={inputBehavior?.enableCommandDetection}
          enableHistoryNavigation={inputBehavior?.enableHistoryNavigation}
          enableDraftPersistence={inputBehavior?.enableDraftPersistence}
          historyKey={selectedProviderId || 'default'}
          onHistoryChange={handleHistoryChange}
          onCommandDetected={handleCommandDetected}
        />
      </div>
      
      {/* Configuration Flyout */}
      <ConfigurationFlyoutContainer
        isOpen={isConfigFlyoutOpen}
        isPinned={isConfigFlyoutPinned}
        onClose={() => setIsConfigFlyoutOpen(false)}
        onPin={() => setIsConfigFlyoutPinned(true)}
        onUnpin={() => setIsConfigFlyoutPinned(false)}
      />
    </div>
  );
};

ChatWindow.displayName = 'ChatWindow';