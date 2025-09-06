/**
 * File Context Module Exports
 * Provides file context collection and management for VS Code extension chat
 */

export { FileContextCollector } from './FileContextCollector';
export { SecureFileContextCollector as FileContextManager } from './FileContextManager';
export type { 
  FileContextItem, 
  FileContextOptions 
} from './FileContextCollector';
export type { 
  SecureContextMessage as ContextualMessage, 
  FileContextConfig 
} from './FileContextManager';