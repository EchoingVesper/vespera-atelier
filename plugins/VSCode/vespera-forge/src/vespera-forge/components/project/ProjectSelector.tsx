/**
 * ProjectSelector Component
 * Phase 16a - Foundation scaffolding
 *
 * Allows users to view and switch between projects in the Navigator.
 *
 * Phase 16a: Shell only - basic structure without full implementation
 * Phase 16b: Will add full dropdown, filtering, project creation
 */

import React from 'react';
import { IProject } from '../../../types/project';
import { cn } from '@/lib/utils';

/**
 * Props for ProjectSelector component
 */
export interface ProjectSelectorProps {
  /** Currently active project */
  activeProject?: IProject;

  /** All available projects */
  projects: IProject[];

  /** Callback when project is selected */
  onProjectSelect: (project: IProject) => void;

  /** Callback to create new project */
  onCreateProject?: () => void;

  /** Loading state */
  isLoading?: boolean;

  /** Optional class name */
  className?: string;
}

/**
 * ProjectSelector component - allows users to view and switch projects
 *
 * Phase 16a: Shell only - basic structure without full implementation
 * Phase 16b: Will add full dropdown, filtering, project creation
 */
export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  activeProject,
  projects: _projects, // TODO: Phase 16b - Use for dropdown list
  onProjectSelect: _onProjectSelect, // TODO: Phase 16b - Wire up selection handler
  onCreateProject: _onCreateProject, // TODO: Phase 16b - Wire up creation handler
  isLoading = false,
  className
}) => {
  // TODO: Phase 16b - Implement dropdown open/close state
  // const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // TODO: Phase 16b - Implement project search/filter
  // const [searchQuery, setSearchQuery] = useState('');

  // TODO: Phase 16b - Add keyboard navigation
  // TODO: Phase 16b - Add recent projects tracking
  // TODO: Phase 16b - Add project favorites

  return (
    <div className={cn('project-selector', className)}>
      <div className="project-selector__active">
        {isLoading ? (
          <span className="text-muted-foreground">Loading projects...</span>
        ) : activeProject ? (
          <div className="flex items-center gap-2">
            {/* TODO: Phase 16b - Add project icon display */}
            {activeProject.metadata?.icon && (
              <span className="text-lg">{activeProject.metadata.icon}</span>
            )}
            <span className="font-medium">
              {activeProject.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ({activeProject.type})
            </span>
            {/* TODO: Phase 16b - Add dropdown trigger chevron icon */}
          </div>
        ) : (
          <span className="text-muted-foreground">No project selected</span>
        )}
      </div>

      {/* TODO: Phase 16b - Add dropdown menu with project list */}
      {/* TODO: Phase 16b - Add project search input */}
      {/* TODO: Phase 16b - Add "Create Project" button */}
      {/* TODO: Phase 16b - Add recent projects section */}
      {/* TODO: Phase 16b - Add project settings/management options */}
    </div>
  );
};

export default ProjectSelector;
