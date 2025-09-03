/**
 * Configuration type definitions for the chat system
 */
import { ProviderConfig } from './provider';

export type ChatLayoutMode = 'embedded' | 'floating' | 'sidebar' | 'panel';
export type ChatPosition = 'left' | 'right' | 'bottom' | 'top';
export type ConfigScope = 'global' | 'workspace' | 'user';

export interface HotkeyConfig {
  send: 'enter' | 'shift_enter' | 'ctrl_enter';
  newLine: 'shift_enter' | 'ctrl_enter' | 'alt_enter';
  clearChat: string;
  switchProvider: string;
}

export interface InputBehaviorConfig {
  showCharacterCounter: boolean;
  sendOnPaste: boolean;
  enableCommandDetection: boolean;
  enableHistoryNavigation: boolean;
  enableDraftPersistence: boolean;
  maxHistorySize: number;
  draftSaveDelay: number; // milliseconds
}

export interface ChatConfiguration {
  // Provider settings
  providers: {
    [providerId: string]: {
      enabled: boolean;
      config: ProviderConfig;
      isDefault?: boolean;
    };
  };
  
  // UI settings
  ui: {
    theme: 'auto' | 'light' | 'dark';
    layout: ChatLayoutMode;
    position: ChatPosition;
    showTimestamps: boolean;
    compactMode: boolean;
    animationsEnabled: boolean;
  };
  
  // Interaction settings
  interaction: {
    hotkeys: HotkeyConfig;
    inputBehavior: InputBehaviorConfig;
    autoSave: boolean;
    showSendButton: boolean;
    streaming: boolean;
  };
  
  // Integration settings
  integration: {
    taskIntegration: boolean;
    taskKeywords: string[];
    autoSuggestTasks: boolean;
    linkToWorkspace: boolean;
  };
  
  // Advanced settings
  advanced: {
    maxHistorySize: number;
    requestTimeout: number;
    retryAttempts: number;
    debugMode: boolean;
  };
}

export interface ConfigurationWatcher {
  (config: ChatConfiguration, changeType: string): void;
}