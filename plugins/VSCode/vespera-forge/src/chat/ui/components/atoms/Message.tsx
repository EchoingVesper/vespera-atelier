/**
 * Message atom component - individual message display
 */
import * as React from 'react';
import { ChatMessage } from '../../../types/chat';

export interface MessageProps {
  message: ChatMessage;
  showTimestamp?: boolean;
  compact?: boolean;
  streaming?: boolean;
  onCopy?: (content: string) => void;
  onRetry?: (messageId: string) => void;
  onEdit?: (messageId: string, newContent: string) => void;
}

export const Message: React.FC<MessageProps> = ({
  message,
  showTimestamp = true,
  compact = false,
  streaming = false,
  onCopy,
  onRetry,
  onEdit
}) => {
  const [isEditing, setIsEditing] = React.useState(false);
  const [editContent, setEditContent] = React.useState(message.content);
  const [showActions, setShowActions] = React.useState(false);
  const handleCopy = () => {
    if (onCopy) {
      onCopy(message.content);
    }
  };

  const handleRetry = () => {
    if (onRetry && message.role === 'assistant') {
      onRetry(message.id);
    }
  };

  const formatTimestamp = (timestamp: Date): string => {
    return timestamp.toLocaleTimeString(undefined, { 
      hour: '2-digit', 
      minute: '2-digit' 
    });
  };
  
  const formatContent = (content: string): React.ReactNode => {
    // Simple markdown-like formatting for now
    // In a real implementation, you'd use a proper markdown parser
    const lines = content.split('\n');
    return lines.map((line, index) => {
      // Code blocks
      if (line.startsWith('```')) {
        return null; // Handle multi-line code blocks separately
      }
      
      // Inline code
      const codeRegex = /`([^`]+)`/g;
      const parts = line.split(codeRegex);
      const formatted = parts.map((part, i) => 
        i % 2 === 1 ? <code key={i} className="message__code">{part}</code> : part
      );
      
      return (
        <React.Fragment key={index}>
          {formatted}
          {index < lines.length - 1 && <br />}
        </React.Fragment>
      );
    });
  };
  
  const handleEdit = () => {
    if (message.role === 'user') {
      setIsEditing(true);
      setEditContent(message.content);
    }
  };
  
  const handleSaveEdit = () => {
    if (onEdit && editContent.trim() !== message.content) {
      onEdit(message.id, editContent.trim());
    }
    setIsEditing(false);
  };
  
  const handleCancelEdit = () => {
    setEditContent(message.content);
    setIsEditing(false);
  };
  
  const getRoleDisplayName = (role: string, provider?: string): string => {
    switch (role) {
      case 'user':
        return 'You';
      case 'assistant':
        return provider ? provider.charAt(0).toUpperCase() + provider.slice(1) : 'Assistant';
      case 'system':
        return 'System';
      default:
        return role.charAt(0).toUpperCase() + role.slice(1);
    }
  };

  const messageClasses = [
    'message',
    `message--${message.role}`,
    compact ? 'message--compact' : 'message--normal',
    streaming ? 'message--streaming' : '',
    message.metadata?.error ? 'message--error' : '',
    isEditing ? 'message--editing' : ''
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={messageClasses} 
      data-message-id={message.id}
      onMouseEnter={() => setShowActions(true)}
      onMouseLeave={() => setShowActions(false)}
    >
      <div className="message__header">
        <span className="message__role">
          {getRoleDisplayName(message.role, message.metadata?.provider)}
        </span>
        
        {showTimestamp && (
          <span className="message__timestamp">
            {formatTimestamp(message.timestamp)}
          </span>
        )}
        
        {message.metadata?.provider && (
          <span className="message__provider">{message.metadata.provider}</span>
        )}
        
        {streaming && (
          <span className="message__streaming-indicator">
            <span className="message__typing-dot"></span>
            <span className="message__typing-dot"></span>
            <span className="message__typing-dot"></span>
          </span>
        )}
      </div>
      
      <div className="message__content">
        {isEditing ? (
          <div className="message__edit-container">
            <textarea
              className="message__edit-textarea"
              value={editContent}
              onChange={(e) => setEditContent(e.target.value)}
              rows={Math.max(3, editContent.split('\n').length)}
              autoFocus
            />
            <div className="message__edit-actions">
              <button 
                className="message__edit-button message__edit-button--save"
                onClick={handleSaveEdit}
                disabled={!editContent.trim()}
              >
                Save
              </button>
              <button 
                className="message__edit-button message__edit-button--cancel"
                onClick={handleCancelEdit}
              >
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="message__text">
            {formatContent(message.content)}
            {streaming && !message.content && (
              <span className="message__streaming-placeholder">Thinking...</span>
            )}
          </div>
        )}
        
        {message.metadata?.error && (
          <div className="message__error">
            <span className="message__error-icon">⚠️</span>
            <span className="message__error-text">{message.metadata.error}</span>
          </div>
        )}
        
        {message.metadata?.usage && (
          <div className="message__usage">
            <span className="message__usage-label">Usage:</span>
            <span className="message__usage-value">
              {message.metadata.usage.total_tokens} tokens
            </span>
            {message.metadata.usage.prompt_tokens && (
              <span className="message__usage-breakdown">
                ({message.metadata.usage.prompt_tokens} prompt + {message.metadata.usage.completion_tokens} completion)
              </span>
            )}
          </div>
        )}
      </div>
      
      <div className={`message__actions ${showActions || isEditing ? 'message__actions--visible' : ''}`}>
        <button 
          className="message__action message__action--copy"
          onClick={handleCopy}
          title="Copy message"
          aria-label="Copy message"
        >
          📋
        </button>
        
        {message.role === 'user' && onEdit && !isEditing && (
          <button 
            className="message__action message__action--edit"
            onClick={handleEdit}
            title="Edit message"
            aria-label="Edit message"
          >
            ✏️
          </button>
        )}
        
        {message.role === 'assistant' && onRetry && (
          <button 
            className="message__action message__action--retry"
            onClick={handleRetry}
            title="Retry message"
            aria-label="Retry message"
          >
            🔄
          </button>
        )}
      </div>
    </div>
  );
};

Message.displayName = 'Message';