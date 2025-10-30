/**
 * WorkspaceInitializer Component
 * Phase 17 Part 2 - Workspace Initialization Flow
 *
 * Handles three workspace states:
 * A) No folder open → prompt to open folder
 * B) Folder open + .vespera/ exists → workspace already initialized
 * C) Folder open + no .vespera/ → offer to initialize workspace
 *
 * Context Types Selection:
 * - Users can select one or more context types during initialization
 * - At least one context type is required
 * - Context types (formerly "project types") define available templates
 */

import React, { useState, useEffect } from 'react';
import { DEFAULT_PROJECT_TYPES } from '../../../types/project';
import { cn } from '@/lib/utils';

/**
 * Workspace state determined by WorkspaceDiscovery
 */
export type WorkspaceState =
  | 'no-folder'           // No VS Code workspace folder open
  | 'no-vespera'          // Folder open but no .vespera/ directory
  | 'initialized'         // .vespera/ exists, workspace ready
  | 'checking';           // Currently checking workspace state

/**
 * Props for WorkspaceInitializer component
 */
export interface WorkspaceInitializerProps {
  /** Current workspace state */
  workspaceState: WorkspaceState;

  /** Callback to open a folder (triggers VS Code command) */
  onOpenFolder?: () => void;

  /** Callback to initialize workspace with selected context types */
  onInitializeWorkspace?: (contextTypes: string[]) => void;

  /** Optional class name */
  className?: string;
}

/**
 * WorkspaceInitializer component
 *
 * Guides users through workspace initialization based on current state.
 * Replaces Phase 16b "create project" flow with Phase 17 workspace initialization.
 */
export const WorkspaceInitializer: React.FC<WorkspaceInitializerProps> = ({
  workspaceState,
  onOpenFolder,
  onInitializeWorkspace,
  className
}) => {
  // Selected context types (at least one required)
  const [selectedContextTypes, setSelectedContextTypes] = useState<Set<string>>(new Set());
  const [isInitializing, setIsInitializing] = useState(false);

  // Auto-select "general" context type by default for better UX
  useEffect(() => {
    const generalType = DEFAULT_PROJECT_TYPES.find(t => t.id === 'general');
    if (generalType && selectedContextTypes.size === 0) {
      setSelectedContextTypes(new Set([generalType.id]));
    }
  }, []);

  /**
   * Toggle context type selection
   */
  const toggleContextType = (typeId: string) => {
    const newSelection = new Set(selectedContextTypes);
    if (newSelection.has(typeId)) {
      // Don't allow deselecting if it's the only one selected
      if (newSelection.size > 1) {
        newSelection.delete(typeId);
      }
    } else {
      newSelection.add(typeId);
    }
    setSelectedContextTypes(newSelection);
  };

  /**
   * Handle workspace initialization
   */
  const handleInitialize = async () => {
    if (selectedContextTypes.size === 0) {
      // Should not happen due to UI validation, but check anyway
      return;
    }

    setIsInitializing(true);
    try {
      if (onInitializeWorkspace) {
        await onInitializeWorkspace(Array.from(selectedContextTypes));
      }
    } finally {
      setIsInitializing(false);
    }
  };

  // State A: No folder open
  if (workspaceState === 'no-folder') {
    return (
      <div className={cn(
        'workspace-initializer',
        'flex flex-col items-center justify-center',
        'h-full p-6 text-center',
        className
      )}>
        <div className="w-16 h-16 mb-4 text-muted-foreground">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"></path>
          </svg>
        </div>
        <h3 className="text-lg font-semibold mb-2">No Folder Open</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-xs">
          Please open a folder to use Vespera Forge
        </p>
        <button
          onClick={onOpenFolder}
          className="px-4 py-2 bg-primary text-primary-foreground rounded hover:bg-primary/90 transition-colors"
        >
          Open Folder
        </button>
      </div>
    );
  }

  // State B: Checking workspace
  if (workspaceState === 'checking') {
    return (
      <div className={cn(
        'workspace-initializer',
        'flex flex-col items-center justify-center',
        'h-full p-6 text-center',
        className
      )}>
        <div className="text-4xl mb-4 animate-spin">⏳</div>
        <p className="text-muted-foreground">Checking workspace...</p>
      </div>
    );
  }

  // State C: No .vespera/ directory - offer to initialize
  if (workspaceState === 'no-vespera') {
    return (
      <div className={cn(
        'workspace-initializer',
        'flex flex-col items-center justify-center',
        'h-full p-6',
        className
      )}>
        {/* Header */}
        <div className="text-center mb-6">
          <div className="text-6xl mb-4">📁</div>
          <h1 className="text-2xl font-bold mb-2">
            Initialize Vespera Project
          </h1>
          <p className="text-muted-foreground max-w-md">
            This folder is not yet configured as a Vespera project.
            Initialize it to start organizing your content with Codices.
          </p>
        </div>

        {/* Context Type Selection */}
        <div className="w-full max-w-2xl mb-6">
          <h2 className="text-lg font-semibold mb-3">
            What will you be working on?
          </h2>
          <p className="text-sm text-muted-foreground mb-4">
            Select one or more context types. You can add or remove types later.
          </p>

          <div className="grid grid-cols-2 gap-3">
            {DEFAULT_PROJECT_TYPES.map(type => {
              const isSelected = selectedContextTypes.has(type.id);
              return (
                <div
                  key={type.id}
                  className={cn(
                    'context-type-card',
                    'p-4 rounded-lg border-2 cursor-pointer',
                    'transition-all',
                    isSelected
                      ? 'border-primary bg-primary/10'
                      : 'border-border bg-background hover:bg-accent'
                  )}
                  onClick={() => toggleContextType(type.id)}
                  role="checkbox"
                  aria-checked={isSelected}
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter' || e.key === ' ') {
                      e.preventDefault();
                      toggleContextType(type.id);
                    }
                  }}
                >
                  <div className="flex items-start gap-3">
                    <div className="text-2xl flex-shrink-0">
                      {type.icon || '📁'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <h3 className="font-semibold text-sm">
                          {type.name}
                        </h3>
                        {isSelected && (
                          <span className="text-primary text-lg">✓</span>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-1">
                        {type.description}
                      </p>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Initialize Button */}
        <div className="text-center">
          <button
            onClick={handleInitialize}
            disabled={selectedContextTypes.size === 0 || isInitializing}
            className={cn(
              'px-6 py-3 rounded-lg font-semibold',
              'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
              'transition-colors',
              selectedContextTypes.size === 0 || isInitializing
                ? 'bg-muted text-muted-foreground cursor-not-allowed'
                : 'bg-primary text-primary-foreground hover:bg-primary/90'
            )}
          >
            {isInitializing ? 'Initializing...' : 'Initialize Vespera Project'}
          </button>
          <p className="text-xs text-muted-foreground mt-3">
            {selectedContextTypes.size === 0
              ? 'Please select at least one context type'
              : `${selectedContextTypes.size} context type${selectedContextTypes.size > 1 ? 's' : ''} selected`
            }
          </p>
        </div>

        {/* Info */}
        <div className="mt-8 text-xs text-muted-foreground max-w-md text-center">
          <p>
            This will create a <code className="bg-muted px-1 rounded">.vespera/</code> directory
            in your workspace with project metadata and templates.
          </p>
        </div>
      </div>
    );
  }

  // State D: Workspace already initialized - this component shouldn't render
  // Navigator should show Context selector instead
  return null;
};

export default WorkspaceInitializer;
