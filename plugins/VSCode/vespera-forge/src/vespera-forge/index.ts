/**
 * Vespera Forge - Main Export
 * Template-driven content management system
 * Compatible with VS Code and Obsidian plugins
 */

// Core imports for local use
import { VSCodeAdapter } from './core/adapters/vscode-adapter';

// Core exports
export { VSCodeAdapter } from './core/adapters/vscode-adapter';
// NOTE: ObsidianAdapter excluded from VS Code plugin build (Phase 17 Stage 0.5b)
// export { ObsidianAdapter } from './core/adapters/obsidian-adapter';
export * from './core/types';

// Component exports
export { default as VesperaForge } from './components/core/VesperaForge';
export { default as ThreePanelLayout } from './components/layout/ThreePanelLayout';
export { default as CodexNavigator } from './components/navigation/CodexNavigator';
export { default as AIAssistant } from './components/ai/AIAssistant';
export { CodexEditor } from './components/editor/CodexEditor';

// Plugin exports
export * from './plugins/vscode-extension';
// NOTE: obsidian-plugin excluded from VS Code plugin build (Phase 17 Stage 0.5b)
// export * from './plugins/obsidian-plugin';

// Version
export const VERSION = '1.0.0';

// Default configurations
export const DEFAULT_CONFIG = {
  templates: [
    {
      id: 'character',
      name: 'Character',
      description: 'Character development template',
      version: '1.0.0'
    },
    {
      id: 'task',
      name: 'Task',
      description: 'Task management template',
      version: '1.0.0'
    },
    {
      id: 'scene',
      name: 'Scene',
      description: 'Scene writing template',
      version: '1.0.0'
    },
    {
      id: 'music',
      name: 'Music',
      description: 'Music track template',
      version: '1.0.0'
    },
    {
      id: 'playlist',
      name: 'Playlist',
      description: 'Music playlist template',
      version: '1.0.0'
    }
  ],
  assistants: [
    {
      id: 'character-expert',
      name: 'Character Development Expert',
      personality: {
        tone: 'friendly',
        expertise: 'expert',
        communicationStyle: 'detailed'
      },
      expertise: ['character development', 'storytelling', 'dialogue']
    },
    {
      id: 'task-coach',
      name: 'Task Management Coach',
      personality: {
        tone: 'professional',
        expertise: 'intermediate',
        communicationStyle: 'concise'
      },
      expertise: ['productivity', 'planning', 'organization']
    },
    {
      id: 'creative-partner',
      name: 'Creative Writing Partner',
      personality: {
        tone: 'casual',
        expertise: 'expert',
        communicationStyle: 'interactive'
      },
      expertise: ['creative writing', 'storytelling', 'narrative structure']
    }
  ]
};

// Utility functions
export const createVSCodeExtension = () => {
  return {
    activate: require('./plugins/vscode-extension').activate,
    deactivate: require('./plugins/vscode-extension').deactivate
  };
};

// NOTE: Obsidian plugin excluded from VS Code plugin build (Phase 17 Stage 0.5b)
// export const createObsidianPlugin = () => {
//   return require('./plugins/obsidian-plugin').default;
// };

// Platform detection
export const detectPlatform = (): 'vscode' | 'obsidian' | 'unknown' => {
  if (typeof window !== 'undefined') {
    if ((window as any).acquireVsCodeApi) {
      return 'vscode';
    }
    if ((window as any).obsidian) {
      return 'obsidian';
    }
  }
  return 'unknown';
};

// Factory function for creating the appropriate adapter
export const createAdapter = (platform?: 'vscode' | 'obsidian', api?: any) => {
  const detectedPlatform = platform || detectPlatform();

  switch (detectedPlatform) {
    case 'vscode':
      return new VSCodeAdapter();
    case 'obsidian':
      // NOTE: ObsidianAdapter excluded from VS Code plugin build (Phase 17 Stage 0.5b)
      throw new Error('Obsidian platform not supported in VS Code plugin build');
      // return new ObsidianAdapter(api);
    default:
      throw new Error(`Unsupported platform: ${detectedPlatform}`);
  }
};