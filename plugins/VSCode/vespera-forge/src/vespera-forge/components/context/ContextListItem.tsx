/**
 * ContextListItem Component
 * Phase 17 Task D4 - Navigator Integration
 *
 * Individual context item in context list/dropdown.
 * Adapted from ProjectListItem for context display.
 */

import React, { useState, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { IContext } from '../../../types/context';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator
} from '@/components/ui/dropdown-menu';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';

export interface ContextListItemProps {
  /** The context to display */
  context: IContext;

  /** Whether this context is currently active */
  isActive?: boolean;

  /** Click handler for context selection */
  onClick: (context: IContext) => void;

  /** Delete handler for context deletion (optional) */
  onDelete?: (context: IContext) => void;

  /** Optional class name */
  className?: string;
}

/**
 * Individual context item in context list
 *
 * Phase 17 Task D4: UI-only implementation for Navigator
 */
export const ContextListItem: React.FC<ContextListItemProps> = ({
  context,
  isActive = false,
  onClick,
  onDelete,
  className
}) => {
  // Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    confirmName: string;
  }>({ isOpen: false, confirmName: '' });

  // Right-click context menu state
  const [contextMenu, setContextMenu] = useState<{
    visible: boolean;
    x: number;
    y: number;
  }>({ visible: false, x: 0, y: 0 });

  // Show delete confirmation dialog
  const showDeleteConfirmation = useCallback(() => {
    setDeleteConfirmation({ isOpen: true, confirmName: '' });
    setContextMenu({ visible: false, x: 0, y: 0 });
  }, []);

  // Handle confirmed deletion
  const handleConfirmedDelete = useCallback(() => {
    if (deleteConfirmation.confirmName === context.name && onDelete) {
      onDelete(context);
    }
    setDeleteConfirmation({ isOpen: false, confirmName: '' });
  }, [deleteConfirmation.confirmName, context, onDelete]);

  // Cancel deletion
  const handleCancelDelete = useCallback(() => {
    setDeleteConfirmation({ isOpen: false, confirmName: '' });
  }, []);

  // Handle right-click context menu
  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (!onDelete) return; // Only show menu if deletion is enabled

    e.preventDefault();
    e.stopPropagation();
    setContextMenu({
      visible: true,
      x: e.clientX,
      y: e.clientY
    });
  }, [onDelete]);

  // Close context menu on click outside
  React.useEffect(() => {
    const handleClickOutside = () => {
      if (contextMenu.visible) {
        setContextMenu({ visible: false, x: 0, y: 0 });
      }
    };

    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, [contextMenu.visible]);

  return (
    <>
      <div
        className={cn(
          'context-list-item group',
          'cursor-pointer px-3 py-2 rounded-sm',
          'hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-primary text-primary-foreground',
          className
        )}
        onClick={() => onClick(context)}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        aria-label={`Select context ${context.name}`}
        aria-current={isActive ? 'true' : undefined}
      >
        <div className="flex items-center gap-2">
          {/* Context icon */}
          {context.metadata?.icon && (
            <span className="text-base" aria-hidden="true">
              {context.metadata.icon}
            </span>
          )}

          <div className="flex-1 min-w-0">
            <span className="context-list-item__name truncate block text-sm">
              {context.name}
            </span>
            <span className="context-list-item__type text-xs text-muted-foreground block">
              {context.type}
            </span>
          </div>

          {/* Active indicator */}
          {isActive && (
            <span className="text-xs" aria-label="Active context">
              ✓
            </span>
          )}

          {/* ... button (three-dot menu) */}
          {onDelete && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-6 w-6 p-0 opacity-0 group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <MoreHorizontal className="w-4 h-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem
                  onClick={(e) => {
                    e.stopPropagation();
                    onClick(context);
                  }}
                >
                  Switch to Context
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  className="text-destructive"
                  onClick={(e) => {
                    e.stopPropagation();
                    showDeleteConfirmation();
                  }}
                >
                  Delete
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Custom Context Menu (right-click) */}
      {contextMenu.visible && onDelete && (
        <div
          className="fixed bg-popover text-popover-foreground border border-border rounded-md shadow-md py-1 min-w-[160px] z-50"
          style={{
            left: `${contextMenu.x}px`,
            top: `${contextMenu.y}px`
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground"
            onClick={() => {
              onClick(context);
              setContextMenu({ visible: false, x: 0, y: 0 });
            }}
          >
            Switch to Context
          </div>
          <div className="h-px bg-border my-1" />
          <div
            className="px-2 py-1.5 text-sm cursor-pointer hover:bg-accent hover:text-accent-foreground text-destructive"
            onClick={showDeleteConfirmation}
          >
            Delete
          </div>
        </div>
      )}

      {/* Delete Confirmation Dialog with name typing */}
      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => {
        if (!open) handleCancelDelete();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Context?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{context.name}"</strong>?
              This action cannot be undone. All codices in this context will remain in the project but will no longer appear in this context view.
              <br /><br />
              <strong>Type the context name to confirm:</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <input
              type="text"
              value={deleteConfirmation.confirmName}
              onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, confirmName: e.target.value }))}
              placeholder={context.name}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedDelete}
              disabled={deleteConfirmation.confirmName !== context.name}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
};

export default ContextListItem;
