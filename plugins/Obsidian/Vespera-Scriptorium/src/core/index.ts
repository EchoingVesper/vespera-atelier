/**
 * Core module exports for Vespera Scriptorium
 */

export { VesperaPlugin } from './VesperaPlugin';

// Export interfaces for module integration
export interface ModuleInterface {
  /**
   * Initialize the module
   * @param plugin Reference to the main plugin instance
   */
  initialize(plugin: any): Promise<void> | void;
  
  /**
   * Clean up the module
   */
  cleanup?(): Promise<void> | void;
}

// Export types for module registration
export interface CommandDefinition {
  id: string;
  name: string;
  callback: () => void | Promise<void>;
  checkCallback?: (checking: boolean) => boolean | void;
  editorCallback?: (editor: any, ctx: any) => void | Promise<void>;
  hotkeys?: { modifiers: string[], key: string }[];
}

export interface RibbonIconDefinition {
  icon: string;
  title: string;
  callback: (evt: MouseEvent) => void | Promise<void>;
}

// Export plugin events for module communication
export enum PluginEvents {
  SETTINGS_UPDATED = 'settings-updated',
  PROCESSING_STARTED = 'processing-started',
  PROCESSING_COMPLETED = 'processing-completed',
  PROCESSING_CANCELLED = 'processing-cancelled',
  CHECKPOINT_CREATED = 'checkpoint-created',
  CHECKPOINT_LOADED = 'checkpoint-loaded',
  OUTPUT_FILE_CREATED = 'output-file-created',
  OUTPUT_FILE_DELETED = 'output-file-deleted'
}