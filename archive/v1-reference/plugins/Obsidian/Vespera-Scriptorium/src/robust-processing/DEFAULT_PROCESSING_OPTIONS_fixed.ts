// DEFAULT_PROCESSING_OPTIONS_fixed.ts
// This file contains optimized default processing options to reduce memory usage
// Import this to replace the equivalent configuration in ProcessingOrchestrator.ts

import { ProcessingOptions } from './ProcessingOrchestrator';

/**
 * Default processing options with memory-optimized settings
 */
export const DEFAULT_PROCESSING_OPTIONS: ProcessingOptions = {
  prompt: '',
  model: '',
  baseTimeout: 30000,
  maxTimeout: 180000, // Reduced from 300000 (5 min) to 180000 (3 min)
  timeoutScaleFactor: 1.5,
  maxRetries: 3,
  batchSize: 1, // Reduced from 5 to 1 for stability
  adaptiveTimeout: true,
  hardwareProfile: 'consumer-gpu',
  temperature: 0.7,
  maxTokens: 1000,
  savePartialResults: true,
  useCheckpointing: true,
  checkpointInterval: 10, // Increased from 5 to 10 to reduce checkpoint frequency
  checkpointSaveInterval: 60000, // Increased from 30000 to 60000 to reduce checkpoint frequency
  diagnosticMode: false,
  acceptPartialResults: true,
  minPartialResultLength: 50,
  collectPerformanceMetrics: true,
  memoryUsageLimit: 400, // Reduced from 500 to 400 MB
  useStreamingProcessing: true
};