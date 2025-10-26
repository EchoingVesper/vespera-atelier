/**
 * ContextSelector Component
 * Phase 17 Task D4 - Navigator Integration
 *
 * Allows users to view and switch between contexts within the active project.
 * Displays below ProjectSelector in Navigator header for Project > Context hierarchy.
 *
 * TODO (Cluster F - Task F1): Wire to backend ContextService via ContextContext
 */

import React, { useState } from 'react';
import { IContext } from '../../../types/context';
import { ContextListItem } from './ContextListItem';
import { cn } from '@/lib/utils';

/**
 * Props for ContextSelector component
 */
export interface ContextSelectorProps {
  /** Currently active context (null if none selected) */
  activeContext: IContext | null;

  /** All available contexts for the active project */
  contexts: IContext[];

  /** Loading state */
  isLoading?: boolean;

  /** Error state */
  error?: string | null;

  /** Callback when context is selected */
  onContextSelect: (context: IContext) => void;

  /** Callback to create new context (optional - triggers creation flow) */
  onCreateContext?: () => void;

  /** Callback to delete context (optional) */
  onDeleteContext?: (contextId: string) => Promise<boolean>;

  /** Optional class name */
  className?: string;

  /** Disabled state (e.g., when no project is selected) */
  disabled?: boolean;
}

/**
 * ContextSelector component - allows users to view and switch contexts
 *
 * Phase 17 Task D4: UI-only implementation, backend wiring in Cluster F
 */
export const ContextSelector: React.FC<ContextSelectorProps> = ({
  activeContext,
  contexts,
  isLoading = false,
  error = null,
  onContextSelect,
  onCreateContext,
  onDeleteContext,
  className,
  disabled = false
}) => {
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  /**
   * Handle context selection from dropdown
   */
  const handleContextSelect = async (context: IContext) => {
    try {
      onContextSelect(context);
      setIsDropdownOpen(false);
    } catch (err) {
      console.error('Failed to set active context:', err);
    }
  };

  /**
   * Handle create context button click
   */
  const handleCreateContext = () => {
    setIsDropdownOpen(false);
    if (onCreateContext) {
      onCreateContext();
    }
  };

  /**
   * Handle context deletion
   */
  const handleContextDelete = async (context: IContext) => {
    if (!onDeleteContext) return;

    try {
      const success = await onDeleteContext(context.id);
      if (success) {
        console.log('[ContextSelector] Context deleted:', context.name);

        // If we deleted the active context, switch to another context
        if (activeContext?.id === context.id) {
          // Find another context to switch to (excluding the deleted one)
          const remainingContexts = contexts.filter(c => c.id !== context.id);

          if (remainingContexts.length > 0) {
            // Auto-switch to the first remaining context
            console.log('[ContextSelector] Auto-switching to:', remainingContexts[0].name);
            onContextSelect(remainingContexts[0]);
          }
        }
      }
    } catch (err) {
      console.error('[ContextSelector] Failed to delete context:', err);
    }
  };

  /**
   * Toggle dropdown open/closed
   */
  const toggleDropdown = () => {
    if (!disabled) {
      setIsDropdownOpen(!isDropdownOpen);
    }
  };

  return (
    <div className={cn('context-selector', className, disabled && 'opacity-50 cursor-not-allowed')}>
      {/* Active Context Display */}
      <div
        className={cn(
          'context-selector__active cursor-pointer',
          disabled && 'pointer-events-none'
        )}
        onClick={toggleDropdown}
        role="button"
        aria-expanded={isDropdownOpen}
        aria-label="Context selector"
        aria-disabled={disabled}
      >
        {isLoading ? (
          <span className="text-muted-foreground text-sm">Loading contexts...</span>
        ) : error ? (
          <span className="text-destructive text-sm">Error: {error}</span>
        ) : disabled ? (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">Select a project first</span>
          </div>
        ) : activeContext ? (
          <div className="flex items-center gap-2">
            {activeContext.metadata?.icon && (
              <span className="text-base">{activeContext.metadata.icon}</span>
            )}
            <span className="font-normal text-sm">
              {activeContext.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ({activeContext.type})
            </span>
            {/* Dropdown chevron */}
            <span className="ml-auto text-muted-foreground text-xs">
              {isDropdownOpen ? '▲' : '▼'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground text-sm">No context selected</span>
            <span className="ml-auto text-muted-foreground text-xs">▼</span>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && !disabled && (
        <div className="context-selector__dropdown">
          {/* Context List */}
          {contexts.length > 0 ? (
            <div className="context-selector__list">
              {contexts.map((context) => (
                <ContextListItem
                  key={context.id}
                  context={context}
                  isActive={activeContext?.id === context.id}
                  onClick={handleContextSelect}
                  onDelete={onDeleteContext ? handleContextDelete : undefined}
                />
              ))}
            </div>
          ) : (
            <div className="context-selector__empty text-muted-foreground text-sm">
              No contexts found. Create one to get started.
            </div>
          )}

          {/* Create Context Button */}
          {onCreateContext && (
            <div className="context-selector__footer">
              <button
                className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                onClick={handleCreateContext}
              >
                + Create New Context
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default ContextSelector;
