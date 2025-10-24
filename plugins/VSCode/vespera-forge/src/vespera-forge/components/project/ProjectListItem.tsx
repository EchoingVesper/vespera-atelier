/**
 * ProjectListItem Component
 * Phase 16a - Foundation scaffolding
 * Phase 16b Stage 3 - Added deletion UI (... button, right-click menu, confirmation)
 *
 * Individual project item in project list/dropdown.
 *
 * Phase 16a: Basic shell structure
 * Phase 16b: Full interaction, icons, metadata display, deletion
 */

import React, { useState, useCallback } from 'react';
import { MoreHorizontal } from 'lucide-react';
import { IProject } from '../../../types/project';
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

export interface ProjectListItemProps {
  /** The project to display */
  project: IProject;

  /** Whether this project is currently active */
  isActive?: boolean;

  /** Click handler for project selection */
  onClick: (project: IProject) => void;

  /** Delete handler for project deletion (Phase 16b Stage 3) */
  onDelete?: (project: IProject) => void;

  /** Optional class name */
  className?: string;
}

/**
 * Individual project item in project list
 *
 * Phase 16a: Basic structure only
 * Phase 16b Stage 3: Project icons, deletion UI (... button, right-click, confirmation)
 */
export const ProjectListItem: React.FC<ProjectListItemProps> = ({
  project,
  isActive = false,
  onClick,
  onDelete,
  className
}) => {
  // Phase 16b Stage 3: Delete confirmation state
  const [deleteConfirmation, setDeleteConfirmation] = useState<{
    isOpen: boolean;
    confirmName: string;
  }>({ isOpen: false, confirmName: '' });

  // Phase 16b Stage 3: Right-click context menu state
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
    if (deleteConfirmation.confirmName === project.name && onDelete) {
      onDelete(project);
    }
    setDeleteConfirmation({ isOpen: false, confirmName: '' });
  }, [deleteConfirmation.confirmName, project, onDelete]);

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
          'project-list-item group',
          'cursor-pointer px-3 py-2 rounded-sm',
          'hover:bg-accent hover:text-accent-foreground',
          isActive && 'bg-primary text-primary-foreground',
          className
        )}
        onClick={() => onClick(project)}
        onContextMenu={handleContextMenu}
        role="button"
        tabIndex={0}
        aria-label={`Select project ${project.name}`}
        aria-current={isActive ? 'true' : undefined}
      >
        <div className="flex items-center gap-2">
          {/* Project icon */}
          {project.metadata?.icon && (
            <span className="text-base" aria-hidden="true">
              {project.metadata.icon}
            </span>
          )}

          <div className="flex-1 min-w-0">
            <span className="project-list-item__name truncate block">
              {project.name}
            </span>
            <span className="project-list-item__type text-xs text-muted-foreground block">
              {project.type}
            </span>
          </div>

          {/* Active indicator */}
          {isActive && (
            <span className="text-xs" aria-label="Active project">
              ✓
            </span>
          )}

          {/* Phase 16b Stage 3: ... button (three-dot menu) - reusing Codex pattern */}
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
                    onClick(project);
                  }}
                >
                  Switch to Project
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

      {/* Phase 16b Stage 3: Custom Context Menu (right-click) */}
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
              onClick(project);
              setContextMenu({ visible: false, x: 0, y: 0 });
            }}
          >
            Switch to Project
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

      {/* Phase 16b Stage 3: Delete Confirmation Dialog with name typing */}
      <AlertDialog open={deleteConfirmation.isOpen} onOpenChange={(open) => {
        if (!open) handleCancelDelete();
      }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Project?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to delete <strong>"{project.name}"</strong>?
              This action cannot be undone. All codices in this project will be permanently removed.
              <br /><br />
              <strong>Type the project name to confirm:</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <div className="my-4">
            <input
              type="text"
              value={deleteConfirmation.confirmName}
              onChange={(e) => setDeleteConfirmation(prev => ({ ...prev, confirmName: e.target.value }))}
              placeholder={project.name}
              className="w-full px-3 py-2 border border-border rounded-md bg-background text-foreground"
              autoFocus
            />
          </div>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleCancelDelete}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleConfirmedDelete}
              disabled={deleteConfirmation.confirmName !== project.name}
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

export default ProjectListItem;
