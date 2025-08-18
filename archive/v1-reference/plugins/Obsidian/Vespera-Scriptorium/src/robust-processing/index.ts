/**
 * Robust Document Processing System
 * A comprehensive system for processing documents with fault tolerance and recovery.
 * @module robust-processing
 */

// Export Context Window Detector
export { ContextWindowDetector, createContextWindowDetector } from './ContextWindowDetector';
export type { ContextWindowDetectionOptions } from './ContextWindowDetector';

// Export Adaptive Chunker
export { AdaptiveChunker, createAdaptiveChunker, DEFAULT_ADAPTIVE_CHUNKING_OPTIONS } from './AdaptiveChunker';
export type { 
  AdaptiveChunkingOptions,
  DocumentChunk,
  ChunkMetadata
} from './AdaptiveChunker';

// Export Persistence Manager
export { 
  PersistenceManager, 
  createPersistenceManager,
  CheckpointStatus
} from './PersistenceManager';
export type { 
  PersistenceManagerOptions,
  CheckpointInfo,
  ProcessingCheckpoint,
  AssembledDocument
} from './PersistenceManager';

// Export Processing Orchestrator
export { 
  ProcessingOrchestrator, 
  createProcessingOrchestrator,
  HARDWARE_PROFILES,
  DEFAULT_PROCESSING_OPTIONS
} from './ProcessingOrchestrator';
export type { 
  ProcessingOptions,
  ProcessingProgress,
  ProcessingResult,
  ChunkResult,
  HardwareProfile
} from './ProcessingOrchestrator';

// Export Document Assembler
export { 
  DocumentAssembler, 
  createDocumentAssembler,
  DEFAULT_ASSEMBLY_OPTIONS
} from './DocumentAssembler';
export type { 
  AssemblyOptions,
  RedundancyReport,
  RedundantSection
} from './DocumentAssembler';

// Export Output Manager
export { 
  OutputManager, 
  createOutputManager,
  OutputFormat,
  DEFAULT_OUTPUT_OPTIONS
} from './OutputManager';
export type { 
  OutputOptions,
  OutputResult,
  OutputHistory,
  DocumentSection
} from './OutputManager';

/**
 * Initialize the robust document processing system
 * 
 * @param app Obsidian App instance
 * @returns Object containing all initialized components
 */
export function initializeRobustProcessingSystem(app: any) {
  // Import functions directly to avoid TypeScript errors
  const { createContextWindowDetector } = require('./ContextWindowDetector');
  const { createAdaptiveChunker } = require('./AdaptiveChunker');
  const { createPersistenceManager } = require('./PersistenceManager');
  const { createDocumentAssembler } = require('./DocumentAssembler');
  const { createOutputManager } = require('./OutputManager');
  const { createProcessingOrchestrator } = require('./ProcessingOrchestrator');
  
  // Create instances of all components
  const contextWindowDetector = createContextWindowDetector();
  const adaptiveChunker = createAdaptiveChunker();
  const persistenceManager = createPersistenceManager(app);
  const documentAssembler = createDocumentAssembler();
  const outputManager = createOutputManager(app);
  
  // Initialize persistence manager
  persistenceManager.initialize();
  
  // Create processing orchestrator with all dependencies
  const processingOrchestrator = createProcessingOrchestrator(
    app,
    app.plugins.plugins['vespera-scriptorium'].llmClient,
    persistenceManager,
    contextWindowDetector,
    app.plugins.plugins['vespera-scriptorium'].outputFilesManager
  );
  
  // Return all components
  return {
    contextWindowDetector,
    adaptiveChunker,
    persistenceManager,
    processingOrchestrator,
    documentAssembler,
    outputManager
  };
}