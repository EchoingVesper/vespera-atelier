/**
 * WebView communication type definitions
 */
import { ProviderConfig } from './provider';
import { ChatConfiguration } from './config';

export type WebViewMessageType = 
  | 'sendMessage'
  | 'switchProvider' 
  | 'configureProvider'
  | 'removeProvider'
  | 'setDefaultProvider'
  | 'testProviderConnection'
  | 'requestAvailableProviders'
  | 'requestProviderTemplate'
  | 'validateProviderConfig'
  | 'clearHistory'
  | 'exportHistory'
  | 'updateSettings'
  | 'requestProviders'
  | 'requestHistory'
  | 'testProvider'
  | 'addProvider'
  | 'requestContextDetails'
  | 'toggleContextVisibility';

export interface WebViewMessage {
  type: WebViewMessageType;
  data?: any;
  requestId?: string;
}

export interface WebViewResponse {
  success: boolean;
  data?: any;
  error?: string;
  requestId?: string;
  _security?: {
    sessionId: string;
    validated: boolean;
    sanitized: boolean;
    threatCount: number;
    processingTime: number;
  };
}

// Message-specific interfaces
export interface SendMessageRequest {
  content: string;
  threadId?: string;
  providerId?: string;
}

export interface ConfigureProviderRequest {
  providerId: string;
  config: Partial<ProviderConfig>;
  scope?: 'global' | 'workspace' | 'user';
}

export interface RemoveProviderRequest {
  providerId: string;
  scope?: 'global' | 'workspace' | 'user';
}

export interface SetDefaultProviderRequest {
  providerId: string;
  scope?: 'global' | 'workspace' | 'user';
}

export interface TestProviderConnectionRequest {
  providerId: string;
  config: ProviderConfig;
}

export interface RequestProviderTemplateRequest {
  providerId: string;
}

export interface ValidateProviderConfigRequest {
  providerId: string;
  config: ProviderConfig;
}

export interface UpdateSettingsRequest {
  ui?: Partial<ChatConfiguration['ui']>;
  interaction?: Partial<ChatConfiguration['interaction']>;
}