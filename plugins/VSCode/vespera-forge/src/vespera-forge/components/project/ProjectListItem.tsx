/**
 * ProjectListItem Component
 * Phase 16a - Foundation scaffolding
 *
 * Individual project item in project list/dropdown.
 *
 * Phase 16a: Basic shell structure
 * Phase 16b: Will add full interaction, icons, metadata display
 */

import React from 'react';
import { IProject } from '../../../types/project';
import { cn } from '@/lib/utils';

export interface ProjectListItemProps {
  /** The project to display */
  project: IProject;

  /** Whether this project is currently active */
  isActive?: boolean;

  /** Click handler for project selection */
  onClick: (project: IProject) => void;

  /** Optional class name */
  className?: string;
}

/**
 * Individual project item in project list
 *
 * Phase 16a: Basic structure only
 * Phase 16b: Will add project icons, colors, metadata, context menu
 */
export const ProjectListItem: React.FC<ProjectListItemProps> = ({
  project,
  isActive = false,
  onClick,
  className
}) => {
  // TODO: Phase 16b - Add hover effects
  // TODO: Phase 16b - Add project color indicator
  // TODO: Phase 16b - Add last modified timestamp
  // TODO: Phase 16b - Add codex count badge
  // TODO: Phase 16b - Add context menu for project actions

  return (
    <div
      className={cn(
        'project-list-item',
        'cursor-pointer',
        isActive && 'active',
        className
      )}
      onClick={() => onClick(project)}
      role="button"
      tabIndex={0}
      aria-label={`Select project ${project.name}`}
      aria-current={isActive ? 'true' : undefined}
    >
      <div className="flex items-center gap-2">
        {/* TODO: Phase 16b - Add project icon based on type */}
        {project.metadata?.icon && (
          <span className="text-base" aria-hidden="true">
            {project.metadata.icon}
          </span>
        )}

        <div className="flex-1 min-w-0">
          <span className="project-list-item__name truncate">
            {project.name}
          </span>
          <span className="project-list-item__type text-xs text-muted-foreground">
            {project.type}
          </span>
        </div>

        {/* TODO: Phase 16b - Add project metadata badges */}
        {/* TODO: Phase 16b - Add active indicator */}
        {isActive && (
          <span className="text-xs" aria-label="Active project">
            ✓
          </span>
        )}
      </div>
    </div>
  );
};

export default ProjectListItem;
