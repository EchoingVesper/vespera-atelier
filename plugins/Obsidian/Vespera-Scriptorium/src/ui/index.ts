/**
 * UI module
 * Entry point for user interface management components
 * @module ui
 */

// From UIManager.ts
export { UIManager, SampleModal } from './UIManager';

// From StyleManager.ts
export { StyleManager } from './StyleManager';

// From OutputFilesView.ts
export {
  FileStatus,
  TabManager,
  OutputFilesView,
  OutputFilesManager,
  registerOutputFilesView
} from './OutputFilesView';
export type { OutputFile } from './OutputFilesView';

// From ProgressPane.ts
export {
  ProgressPane,
  ProgressManager,
  registerProgressPane
} from './ProgressPane';
export type {
  ProgressOptions,
  ProgressUpdate
} from './ProgressPane';

// From MultiSelectModal.ts
export { MultiSelectModal } from './MultiSelectModal';

// From CheckpointManagerModal.ts
export { CheckpointManagerModal } from './CheckpointManagerModal';

// From ConnectionStatusIndicator.ts
export { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
export type { ConnectionStatusIndicatorOptions } from './ConnectionStatusIndicator';

// From MultiSelectModal.ts (where FileTreeNode is defined)
export type { FileTreeNode } from './MultiSelectModal';

// Re-export types and interfaces
export type { ModuleInterface } from '../core';