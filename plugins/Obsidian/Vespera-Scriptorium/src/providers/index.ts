/**
 * Providers module index
 * Exports all LLM providers
 */

import { OllamaProvider } from './OllamaProvider';
import { LMStudioProvider } from './LMStudioProvider';

// Export the provider classes directly for CommonJS compatibility
export { OllamaProvider, LMStudioProvider };

// Also re-export everything from the provider files for ESM compatibility
export * from './OllamaProvider';
export * from './LMStudioProvider';