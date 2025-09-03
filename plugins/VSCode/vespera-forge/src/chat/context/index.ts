/**
 * File Context Module Exports
 * Provides file context collection and management for VS Code extension chat
 */

export { FileContextCollector } from './FileContextCollector';
export { FileContextManager } from './FileContextManager';
export type { 
  FileContextItem, 
  FileContextOptions 
} from './FileContextCollector';
export type { 
  ContextualMessage, 
  FileContextConfig 
} from './FileContextManager';