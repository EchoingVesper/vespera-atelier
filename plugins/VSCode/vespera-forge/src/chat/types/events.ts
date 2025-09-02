/**
 * Event type definitions for chat system integration with VesperaEvents
 */

// Assuming VesperaEventData is defined in the main extension
export interface VesperaEventData {
  [key: string]: any;
}

export interface ChatEventData extends VesperaEventData {
  // Chat-specific events
  chatMessageSent: { messageId: string; content: string; provider: string };
  chatMessageReceived: { messageId: string; content: string; provider: string };
  chatProviderChanged: { from?: string; to: string };
  chatProviderConnected: { providerId: string; providerName: string };
  chatProviderDisconnected: { providerId: string; error?: string };
  chatConfigUpdated: { providerId: string; changes: any };
  chatThreadCreated: { threadId: string; title?: string };
  chatThreadDeleted: { threadId: string };
  chatUILayoutChanged: { mode: ChatLayoutMode; position: ChatPosition };
}

export type ChatEventType = keyof ChatEventData;

export interface ChatEvent<T extends ChatEventType> {
  type: T;
  data: ChatEventData[T];
  timestamp?: Date;
}

// Event classes for type safety
export class TemplateLoadedEvent implements ChatEvent<'chatProviderConnected'> {
  readonly type = 'chatProviderConnected' as const;
  readonly timestamp = new Date();
  
  constructor(public data: ChatEventData['chatProviderConnected']) {}
}

export class ConfigurationChangedEvent implements ChatEvent<'chatConfigUpdated'> {
  readonly type = 'chatConfigUpdated' as const;
  readonly timestamp = new Date();
  
  constructor(public data: ChatEventData['chatConfigUpdated']) {}
}

export class LayoutChangedEvent implements ChatEvent<'chatUILayoutChanged'> {
  readonly type = 'chatUILayoutChanged' as const;
  readonly timestamp = new Date();
  
  constructor(public data: ChatEventData['chatUILayoutChanged']) {}
}

// Import types from config for layout definitions
import { ChatLayoutMode, ChatPosition } from './config';