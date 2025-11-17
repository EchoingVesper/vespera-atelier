/**
 * Event system for cross-component communication in Vespera Forge
 * Ensures Task Tree and Dashboard stay in sync when data changes
 */

import { EventEmitter } from 'events';
import { log } from './index';

export type VesperaEventType =
  | 'taskCreated'
  | 'taskUpdated'
  | 'taskDeleted'
  | 'taskCompleted'
  | 'taskFocused'
  | 'dashboardRefreshed'
  | 'binderyConnected'
  | 'binderyDisconnected'
  | 'chatProviderConfigured'
  | 'chatProviderRemoved'
  | 'chatProviderConnected'
  | 'chatProviderDisconnected'
  | 'chatProviderChanged'
  | 'chatConfigurationChanged'
  | 'codexUpdated'
  | 'codexCreated'
  | 'codexDeleted'
  | 'logEntryCreated'
  | 'logLevelChanged'
  | 'logFileRotated'
  | 'criticalErrorOccurred'
  | 'securityEventLogged';

export interface VesperaEventData {
  taskCreated: { taskId: string; title: string };
  taskUpdated: { taskId: string; changes: any };
  taskDeleted: { taskId: string };
  taskCompleted: { taskId: string };
  taskFocused: { taskId: string; title: string };
  dashboardRefreshed: { totalTasks: number };
  binderyConnected: { version?: string };
  binderyDisconnected: {};
  chatProviderConfigured: { providerId: string; providerName: string; config: any };
  chatProviderRemoved: { providerId: string; providerName?: string };
  chatProviderConnected: { providerId: string; providerName: string };
  chatProviderDisconnected: { providerId: string; providerName?: string; error?: string };
  chatProviderChanged: { from?: string; to: string; providerName?: string };
  chatConfigurationChanged: { section: string; changes: any };
  codexUpdated: { codexId: string; title: string };
  codexCreated: { codexId: string; title: string };
  codexDeleted: { codexId: string };
  logEntryCreated: {
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal';
    component: string;
    message: string;
    timestamp: string;
    metadata?: any;
    source?: string;
  };
  logLevelChanged: {
    component: string;
    oldLevel: string;
    newLevel: string;
    scope: 'global' | 'component';
  };
  logFileRotated: {
    logType: string;
    oldFile: string;
    newFile: string;
    timestamp: string;
  };
  criticalErrorOccurred: {
    error: Error | string;
    component: string;
    context?: any;
    userMessage: string;
    requiresNotification: boolean;
  };
  securityEventLogged: {
    eventType: string;
    severity: 'low' | 'medium' | 'high' | 'critical';
    description: string;
    timestamp: string;
    metadata?: any;
    shouldNotifyUser: boolean;
  };
}

/**
 * Global event bus for Vespera Forge components
 */
class VesperaEventBus extends EventEmitter {
  private static instance: VesperaEventBus;

  private constructor() {
    super();
    this.setMaxListeners(50); // Support many listeners for different views
  }

  static getInstance(): VesperaEventBus {
    if (!VesperaEventBus.instance) {
      VesperaEventBus.instance = new VesperaEventBus();
    }
    return VesperaEventBus.instance;
  }

  /**
   * Emit a typed event with logging
   */
  emitEvent<T extends keyof VesperaEventData>(
    eventType: T, 
    data: VesperaEventData[T]
  ): void {
    log(`[EventBus] Emitting event: ${eventType}`, data);
    this.emit(eventType, data);
  }

  /**
   * Listen for a typed event with logging
   */
  onEvent<T extends keyof VesperaEventData>(
    eventType: T,
    listener: (data: VesperaEventData[T]) => void,
    listenerName?: string
  ): void {
    const loggedListener = (data: VesperaEventData[T]) => {
      log(`[EventBus] ${listenerName || 'Anonymous'} handling event: ${eventType}`);
      listener(data);
    };
    
    this.on(eventType, loggedListener);
    log(`[EventBus] Registered listener for ${eventType}: ${listenerName || 'anonymous'}`);
  }

  /**
   * Remove a listener
   */
  offEvent<T extends keyof VesperaEventData>(
    eventType: T,
    listener: (data: VesperaEventData[T]) => void
  ): void {
    this.off(eventType, listener);
    log(`[EventBus] Removed listener for ${eventType}`);
  }

  /**
   * Remove all listeners for an event type
   */
  clearEventListeners(eventType: VesperaEventType): void {
    this.removeAllListeners(eventType);
    log(`[EventBus] Cleared all listeners for ${eventType}`);
  }

  /**
   * Get listener count for debugging
   */
  getListenerCount(eventType: VesperaEventType): number {
    return this.listenerCount(eventType);
  }
}

// Export singleton instance
export const eventBus = VesperaEventBus.getInstance();

/**
 * Convenience functions for common event patterns
 */
export const VesperaEvents = {
  /**
   * Notify that a task was created
   */
  taskCreated: (taskId: string, title: string) => {
    eventBus.emitEvent('taskCreated', { taskId, title });
  },

  /**
   * Notify that a task was updated
   */
  taskUpdated: (taskId: string, changes: any) => {
    eventBus.emitEvent('taskUpdated', { taskId, changes });
  },

  /**
   * Notify that a task was deleted
   */
  taskDeleted: (taskId: string) => {
    eventBus.emitEvent('taskDeleted', { taskId });
  },

  /**
   * Notify that a task was completed
   */
  taskCompleted: (taskId: string) => {
    eventBus.emitEvent('taskCompleted', { taskId });
  },

  /**
   * Notify that a task was focused
   */
  taskFocused: (taskId: string, title: string) => {
    eventBus.emitEvent('taskFocused', { taskId, title });
  },

  /**
   * Notify that the dashboard was refreshed
   */
  dashboardRefreshed: (totalTasks: number) => {
    eventBus.emitEvent('dashboardRefreshed', { totalTasks });
  },

  /**
   * Notify that Bindery service connected
   */
  binderyConnected: (version?: string) => {
    eventBus.emitEvent('binderyConnected', { version });
  },

  /**
   * Notify that Bindery service disconnected
   */
  binderyDisconnected: () => {
    eventBus.emitEvent('binderyDisconnected', {});
  },

  /**
   * Listen for task events and auto-refresh components
   */
  onTaskChange: (refreshCallback: () => void, componentName: string) => {
    eventBus.onEvent('taskCreated', refreshCallback, `${componentName}:taskCreated`);
    eventBus.onEvent('taskUpdated', refreshCallback, `${componentName}:taskUpdated`);
    eventBus.onEvent('taskDeleted', refreshCallback, `${componentName}:taskDeleted`);
    eventBus.onEvent('taskCompleted', refreshCallback, `${componentName}:taskCompleted`);
    eventBus.onEvent('taskFocused', refreshCallback, `${componentName}:taskFocused`);
  },

  /**
   * Remove task change listeners for a component
   */
  offTaskChange: (refreshCallback: () => void) => {
    eventBus.offEvent('taskCreated', refreshCallback);
    eventBus.offEvent('taskUpdated', refreshCallback);
    eventBus.offEvent('taskDeleted', refreshCallback);
    eventBus.offEvent('taskCompleted', refreshCallback);
    eventBus.offEvent('taskFocused', refreshCallback);
  },

  /**
   * Chat provider configuration events
   */
  chatProviderConfigured: (providerId: string, providerName: string, config: any) => {
    eventBus.emitEvent('chatProviderConfigured', { providerId, providerName, config });
  },

  chatProviderRemoved: (providerId: string, providerName?: string) => {
    eventBus.emitEvent('chatProviderRemoved', { providerId, providerName });
  },

  chatProviderConnected: (providerId: string, providerName: string) => {
    eventBus.emitEvent('chatProviderConnected', { providerId, providerName });
  },

  chatProviderDisconnected: (providerId: string, providerName?: string, error?: string) => {
    eventBus.emitEvent('chatProviderDisconnected', { providerId, providerName, error });
  },

  chatProviderChanged: (from: string | undefined, to: string, providerName?: string) => {
    eventBus.emitEvent('chatProviderChanged', { from, to, providerName });
  },

  chatConfigurationChanged: (section: string, changes: any) => {
    eventBus.emitEvent('chatConfigurationChanged', { section, changes });
  },

  /**
   * Listen for chat provider events
   */
  onChatProviderChange: (refreshCallback: () => void, componentName: string) => {
    eventBus.onEvent('chatProviderConfigured', refreshCallback, `${componentName}:chatProviderConfigured`);
    eventBus.onEvent('chatProviderRemoved', refreshCallback, `${componentName}:chatProviderRemoved`);
    eventBus.onEvent('chatProviderConnected', refreshCallback, `${componentName}:chatProviderConnected`);
    eventBus.onEvent('chatProviderDisconnected', refreshCallback, `${componentName}:chatProviderDisconnected`);
    eventBus.onEvent('chatProviderChanged', refreshCallback, `${componentName}:chatProviderChanged`);
  },

  /**
   * Remove chat provider change listeners
   */
  offChatProviderChange: (refreshCallback: () => void) => {
    eventBus.offEvent('chatProviderConfigured', refreshCallback);
    eventBus.offEvent('chatProviderRemoved', refreshCallback);
    eventBus.offEvent('chatProviderConnected', refreshCallback);
    eventBus.offEvent('chatProviderDisconnected', refreshCallback);
    eventBus.offEvent('chatProviderChanged', refreshCallback);
  },

  /**
   * Codex events
   */
  codexUpdated: (codexId: string, title: string) => {
    eventBus.emitEvent('codexUpdated', { codexId, title });
  },

  codexCreated: (codexId: string, title: string) => {
    eventBus.emitEvent('codexCreated', { codexId, title });
  },

  codexDeleted: (codexId: string) => {
    eventBus.emitEvent('codexDeleted', { codexId });
  },

  /**
   * Listen for codex change events
   */
  onCodexChange: (refreshCallback: () => void, componentName: string) => {
    eventBus.onEvent('codexCreated', refreshCallback, `${componentName}:codexCreated`);
    eventBus.onEvent('codexUpdated', refreshCallback, `${componentName}:codexUpdated`);
    eventBus.onEvent('codexDeleted', refreshCallback, `${componentName}:codexDeleted`);
  },

  /**
   * Remove codex change listeners
   */
  offCodexChange: (refreshCallback: () => void) => {
    eventBus.offEvent('codexCreated', refreshCallback);
    eventBus.offEvent('codexUpdated', refreshCallback);
    eventBus.offEvent('codexDeleted', refreshCallback);
  },

  /**
   * Logging Events
   */

  /**
   * Notify that a log entry was created
   */
  logEntryCreated: (
    level: 'debug' | 'info' | 'warn' | 'error' | 'fatal',
    component: string,
    message: string,
    metadata?: any,
    source?: string
  ) => {
    eventBus.emitEvent('logEntryCreated', {
      level,
      component,
      message,
      timestamp: new Date().toISOString(),
      metadata,
      source
    });
  },

  /**
   * Notify that a log level changed
   */
  logLevelChanged: (
    component: string,
    oldLevel: string,
    newLevel: string,
    scope: 'global' | 'component' = 'component'
  ) => {
    eventBus.emitEvent('logLevelChanged', { component, oldLevel, newLevel, scope });
  },

  /**
   * Notify that a log file was rotated
   */
  logFileRotated: (logType: string, oldFile: string, newFile: string) => {
    eventBus.emitEvent('logFileRotated', {
      logType,
      oldFile,
      newFile,
      timestamp: new Date().toISOString()
    });
  },

  /**
   * Notify that a critical error occurred requiring user attention
   */
  criticalErrorOccurred: (
    error: Error | string,
    component: string,
    userMessage: string,
    requiresNotification: boolean = true,
    context?: any
  ) => {
    eventBus.emitEvent('criticalErrorOccurred', {
      error,
      component,
      context,
      userMessage,
      requiresNotification
    });
  },

  /**
   * Notify that a security event was logged
   */
  securityEventLogged: (
    eventType: string,
    severity: 'low' | 'medium' | 'high' | 'critical',
    description: string,
    shouldNotifyUser: boolean = false,
    metadata?: any
  ) => {
    eventBus.emitEvent('securityEventLogged', {
      eventType,
      severity,
      description,
      timestamp: new Date().toISOString(),
      metadata,
      shouldNotifyUser
    });
  },

  /**
   * Listen for all logging events
   */
  onLoggingEvent: (callback: (eventType: string, data: any) => void, componentName: string) => {
    eventBus.onEvent('logEntryCreated', (data) => callback('logEntryCreated', data), `${componentName}:logEntryCreated`);
    eventBus.onEvent('logLevelChanged', (data) => callback('logLevelChanged', data), `${componentName}:logLevelChanged`);
    eventBus.onEvent('logFileRotated', (data) => callback('logFileRotated', data), `${componentName}:logFileRotated`);
    eventBus.onEvent('criticalErrorOccurred', (data) => callback('criticalErrorOccurred', data), `${componentName}:criticalErrorOccurred`);
    eventBus.onEvent('securityEventLogged', (data) => callback('securityEventLogged', data), `${componentName}:securityEventLogged`);
  },

  /**
   * Remove logging event listeners
   */
  offLoggingEvent: (_callback?: (eventType: string, data: any) => void) => {
    // Note: This won't work perfectly due to wrapper functions, but provides API consistency
    // For proper cleanup, components should store and remove specific listener references
    eventBus.removeAllListeners('logEntryCreated');
    eventBus.removeAllListeners('logLevelChanged');
    eventBus.removeAllListeners('logFileRotated');
    eventBus.removeAllListeners('criticalErrorOccurred');
    eventBus.removeAllListeners('securityEventLogged');
  }
};