/**
 * Message list component - displays chat messages
 */

import { useEffect, useRef } from 'react';
import type { ChatMessage } from '../state/reducer';
import './MessageList.css';

interface MessageListProps {
  messages: ChatMessage[];
}

export function MessageList({ messages }: MessageListProps) {
  const listEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom when new messages arrive
  useEffect(() => {
    listEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  return (
    <div className="message-list">
      {messages.map((message) => (
        <div key={message.id} className={`message message-${message.type}`}>
          <div className="message-content">{message.content}</div>
          <div className="message-timestamp">
            {message.timestamp.toLocaleTimeString()}
          </div>
        </div>
      ))}
      <div ref={listEndRef} />
    </div>
  );
}