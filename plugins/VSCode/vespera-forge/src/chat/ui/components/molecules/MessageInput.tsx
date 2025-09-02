/**
 * Message Input molecule component - combines input area with send functionality
 */
import * as React from 'react';
import { SendButton } from '../atoms/SendButton';

export interface MessageInputProps {
  value: string;
  onChange: (value: string) => void;
  onSend: (message: string) => void;
  disabled?: boolean;
  loading?: boolean;
  placeholder?: string;
  maxLength?: number;
  rows?: number;
  autoFocus?: boolean;
  showSendButton?: boolean;
  showCharacterCounter?: boolean;
  sendOnPaste?: boolean;
  enableCommandDetection?: boolean;
  enableHistoryNavigation?: boolean;
  enableDraftPersistence?: boolean;
  historyKey?: string; // Key for persisting drafts and history
  hotkeys?: {
    send: 'enter' | 'shift_enter' | 'ctrl_enter';
    newLine: 'shift_enter' | 'ctrl_enter' | 'alt_enter';
  };
  onHistoryChange?: (history: string[]) => void;
  onCommandDetected?: (command: string, args: string[]) => boolean; // Returns true if command was handled
}

export const MessageInput: React.FC<MessageInputProps> = ({
  value,
  onChange,
  onSend,
  disabled = false,
  loading = false,
  placeholder = 'Type your message...',
  maxLength = 4000,
  rows = 3,
  autoFocus = false,
  showSendButton = true,
  showCharacterCounter = true,
  sendOnPaste = false,
  enableCommandDetection = true,
  enableHistoryNavigation = true,
  enableDraftPersistence = false,
  historyKey = 'default',
  hotkeys = {
    send: 'enter',
    newLine: 'shift_enter'
  },
  onHistoryChange,
  onCommandDetected
}) => {
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const [inputHistory, setInputHistory] = React.useState<string[]>([]);
  const [historyIndex, setHistoryIndex] = React.useState(-1);
  const [isDraftSaved, setIsDraftSaved] = React.useState(false);
  const draftTimeoutRef = React.useRef<NodeJS.Timeout>();

  // Load persisted draft and history on mount
  React.useEffect(() => {
    if (enableDraftPersistence && historyKey) {
      const savedDraft = localStorage.getItem(`vespera-forge-draft-${historyKey}`);
      if (savedDraft && !value) {
        onChange(savedDraft);
      }
      
      const savedHistory = localStorage.getItem(`vespera-forge-history-${historyKey}`);
      if (savedHistory) {
        try {
          const history = JSON.parse(savedHistory);
          setInputHistory(history);
          onHistoryChange?.(history);
        } catch (error) {
          console.warn('Failed to parse saved input history:', error);
        }
      }
    }
  }, [historyKey, enableDraftPersistence, value, onChange, onHistoryChange]);

  // Save draft with debouncing
  const saveDraft = React.useCallback((newValue: string) => {
    if (enableDraftPersistence && historyKey) {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
      
      draftTimeoutRef.current = setTimeout(() => {
        if (newValue.trim()) {
          localStorage.setItem(`vespera-forge-draft-${historyKey}`, newValue);
          setIsDraftSaved(true);
          setTimeout(() => setIsDraftSaved(false), 2000);
        } else {
          localStorage.removeItem(`vespera-forge-draft-${historyKey}`);
        }
      }, 1000);
    }
  }, [enableDraftPersistence, historyKey]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    if (newValue.length <= maxLength) {
      onChange(newValue);
      setHistoryIndex(-1); // Reset history navigation when typing
      saveDraft(newValue);
    }
  };

  // Command detection
  const detectCommand = React.useCallback((text: string): boolean => {
    if (!enableCommandDetection || !onCommandDetected) return false;
    
    const trimmed = text.trim();
    if (!trimmed.startsWith('/')) return false;
    
    const parts = trimmed.slice(1).split(/\s+/);
    const command = parts[0];
    const args = parts.slice(1);
    
    return onCommandDetected(command, args);
  }, [enableCommandDetection, onCommandDetected]);

  // Add to input history
  const addToHistory = React.useCallback((message: string) => {
    if (!enableHistoryNavigation) return;
    
    setInputHistory(prev => {
      const newHistory = [message, ...prev.filter(h => h !== message)].slice(0, 50); // Keep last 50 entries
      
      if (enableDraftPersistence && historyKey) {
        localStorage.setItem(`vespera-forge-history-${historyKey}`, JSON.stringify(newHistory));
      }
      
      onHistoryChange?.(newHistory);
      return newHistory;
    });
  }, [enableHistoryNavigation, enableDraftPersistence, historyKey, onHistoryChange]);

  const handleSend = () => {
    const trimmedValue = value.trim();
    if (trimmedValue && !disabled && !loading) {
      // Check for commands first
      if (detectCommand(trimmedValue)) {
        onChange(''); // Clear input after command
        if (enableDraftPersistence && historyKey) {
          localStorage.removeItem(`vespera-forge-draft-${historyKey}`);
        }
        return;
      }
      
      // Add to history and send
      addToHistory(trimmedValue);
      onSend(trimmedValue);
      
      // Clear draft after successful send
      if (enableDraftPersistence && historyKey) {
        localStorage.removeItem(`vespera-forge-draft-${historyKey}`);
      }
    }
  };

  // History navigation
  const navigateHistory = React.useCallback((direction: 'up' | 'down') => {
    if (!enableHistoryNavigation || inputHistory.length === 0) return;
    
    if (direction === 'up') {
      const newIndex = Math.min(historyIndex + 1, inputHistory.length - 1);
      setHistoryIndex(newIndex);
      onChange(inputHistory[newIndex] || '');
    } else {
      const newIndex = Math.max(historyIndex - 1, -1);
      setHistoryIndex(newIndex);
      onChange(newIndex === -1 ? '' : inputHistory[newIndex] || '');
    }
  }, [enableHistoryNavigation, inputHistory, historyIndex, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    const isEnter = e.key === 'Enter';
    const isShift = e.shiftKey;
    const isCtrl = e.ctrlKey || e.metaKey;
    const isAlt = e.altKey;
    const isArrowUp = e.key === 'ArrowUp';
    const isArrowDown = e.key === 'ArrowDown';

    // History navigation with arrow keys (when cursor is at start/end)
    if (enableHistoryNavigation && (isArrowUp || isArrowDown)) {
      const textarea = textareaRef.current;
      if (textarea) {
        const cursorPos = textarea.selectionStart;
        const isAtStart = cursorPos === 0;
        const isAtEnd = cursorPos === textarea.value.length;
        
        if ((isArrowUp && isAtStart) || (isArrowDown && isAtEnd)) {
          e.preventDefault();
          navigateHistory(isArrowUp ? 'up' : 'down');
          return;
        }
      }
    }

    // Determine if this should send the message
    const shouldSend = 
      (hotkeys.send === 'enter' && isEnter && !isShift && !isCtrl && !isAlt) ||
      (hotkeys.send === 'shift_enter' && isEnter && isShift) ||
      (hotkeys.send === 'ctrl_enter' && isEnter && isCtrl);

    // Determine if this should add a new line
    const shouldNewLine = 
      (hotkeys.newLine === 'shift_enter' && isEnter && isShift) ||
      (hotkeys.newLine === 'ctrl_enter' && isEnter && isCtrl) ||
      (hotkeys.newLine === 'alt_enter' && isEnter && isAlt);

    if (shouldSend) {
      e.preventDefault();
      handleSend();
    } else if (shouldNewLine) {
      // Allow default behavior for new line
      return;
    } else if (isEnter && hotkeys.send === 'enter') {
      // Prevent default if Enter should send but conditions aren't met
      e.preventDefault();
    }
  };

  // Handle paste events
  const handlePaste = React.useCallback((e: React.ClipboardEvent<HTMLTextAreaElement>) => {
    if (sendOnPaste) {
      const pastedText = e.clipboardData.getData('text');
      const trimmedPasted = pastedText.trim();
      
      if (trimmedPasted && !disabled && !loading) {
        e.preventDefault();
        
        // If there's existing content, append with newline, otherwise just use pasted content
        const finalContent = value.trim() ? `${value}\n${trimmedPasted}` : trimmedPasted;
        
        if (finalContent.length <= maxLength) {
          onChange(finalContent);
          
          // Send immediately after a short delay to allow for UI updates
          setTimeout(() => {
            if (detectCommand(finalContent)) {
              onChange(''); // Clear input after command
              if (enableDraftPersistence && historyKey) {
                localStorage.removeItem(`vespera-forge-draft-${historyKey}`);
              }
            } else {
              addToHistory(finalContent);
              onSend(finalContent);
              if (enableDraftPersistence && historyKey) {
                localStorage.removeItem(`vespera-forge-draft-${historyKey}`);
              }
            }
          }, 10);
        }
      }
    }
  }, [sendOnPaste, disabled, loading, value, maxLength, onChange, detectCommand, enableDraftPersistence, historyKey, addToHistory, onSend]);

  // Auto-resize textarea
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      textarea.style.height = `${Math.max(textarea.scrollHeight, rows * 20)}px`;
    }
  }, [value, rows]);

  // Cleanup timeouts on unmount
  React.useEffect(() => {
    return () => {
      if (draftTimeoutRef.current) {
        clearTimeout(draftTimeoutRef.current);
      }
    };
  }, []);

  const inputClasses = [
    'message-input',
    disabled ? 'message-input--disabled' : '',
    loading ? 'message-input--loading' : ''
  ].filter(Boolean).join(' ');

  const characterCount = value.length;
  const isNearLimit = characterCount > maxLength * 0.8;
  const isOverLimit = characterCount > maxLength;

  // Dynamic placeholder based on features
  const getPlaceholder = () => {
    if (enableCommandDetection && placeholder === 'Type your message...') {
      return 'Type your message... (use / for commands)';
    }
    return placeholder;
  };

  return (
    <div className={inputClasses}>
      <div className="message-input__container">
        <textarea
          ref={textareaRef}
          className="message-input__textarea"
          value={value}
          onChange={handleChange}
          onKeyDown={handleKeyDown}
          onPaste={handlePaste}
          placeholder={getPlaceholder()}
          disabled={disabled || loading}
          autoFocus={autoFocus}
          rows={rows}
          maxLength={maxLength}
          aria-label="Message input"
          aria-describedby="message-input-hints"
        />
        
        {showSendButton && (
          <div className="message-input__send">
            <SendButton
              onClick={handleSend}
              disabled={disabled || !value.trim()}
              loading={loading}
              title={`Send message (${hotkeys.send === 'enter' ? 'Enter' : 
                      hotkeys.send === 'shift_enter' ? 'Shift+Enter' : 'Ctrl+Enter'})`}
            />
          </div>
        )}
      </div>
      
      <div className="message-input__footer" id="message-input-hints">
        <div className="message-input__hints">
          <span className="message-input__hint">
            {hotkeys.send === 'enter' ? 'Enter' : 
             hotkeys.send === 'shift_enter' ? 'Shift+Enter' : 
             'Ctrl+Enter'} to send
          </span>
          <span className="message-input__hint">
            {hotkeys.newLine === 'shift_enter' ? 'Shift+Enter' : 
             hotkeys.newLine === 'ctrl_enter' ? 'Ctrl+Enter' : 
             'Alt+Enter'} for new line
          </span>
          {enableHistoryNavigation && inputHistory.length > 0 && (
            <span className="message-input__hint">
              ↑↓ to navigate history ({inputHistory.length})
            </span>
          )}
          {sendOnPaste && (
            <span className="message-input__hint">
              Paste to send
            </span>
          )}
          {isDraftSaved && (
            <span className="message-input__hint message-input__hint--success">
              Draft saved ✓
            </span>
          )}
        </div>
        
        {showCharacterCounter && (
          <div className={`message-input__counter ${isNearLimit ? 'message-input__counter--warning' : ''} ${isOverLimit ? 'message-input__counter--error' : ''}`}>
            {characterCount} / {maxLength}
          </div>
        )}
      </div>
    </div>
  );
};

MessageInput.displayName = 'MessageInput';