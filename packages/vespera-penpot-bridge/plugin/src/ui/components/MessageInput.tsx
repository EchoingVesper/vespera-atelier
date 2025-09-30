/**
 * Message input component - text input for user commands
 */

import { useState, type FormEvent, type KeyboardEvent } from 'react';
import './MessageInput.css';

interface MessageInputProps {
  onSubmit: (message: string) => void;
  disabled?: boolean;
}

export function MessageInput({ onSubmit, disabled }: MessageInputProps) {
  const [input, setInput] = useState('');

  const handleSubmit = (e: FormEvent) => {
    e.preventDefault();
    if (input.trim() && !disabled) {
      onSubmit(input.trim());
      setInput('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Submit on Enter (without Shift)
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  return (
    <form className="message-input-form" onSubmit={handleSubmit}>
      <textarea
        className="message-input-textarea"
        value={input}
        onChange={(e) => setInput(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Type a command... (e.g., 'create error dialog')"
        disabled={disabled}
        rows={2}
      />
      <button
        type="submit"
        className="message-input-button"
        disabled={!input.trim() || disabled}
      >
        Send
      </button>
    </form>
  );
}