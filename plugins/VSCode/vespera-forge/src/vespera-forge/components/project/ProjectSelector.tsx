/**
 * ProjectSelector Component
 * Phase 16b Stage 1 - Core Integration
 *
 * Allows users to view and switch between projects in the Navigator.
 * Now wired to ProjectContext for real data and state management.
 */

import React, { useState } from 'react';
import { IProject } from '../../../types/project';
import { useProjectContext } from '../../../contexts/ProjectContext';
import { ProjectListItem } from './ProjectListItem';
import { cn } from '@/lib/utils';

/**
 * Props for ProjectSelector component
 */
export interface ProjectSelectorProps {
  /** Callback to create new project (optional - triggers creation flow) */
  onCreateProject?: () => void;

  /** Optional class name */
  className?: string;
}

/**
 * ProjectSelector component - allows users to view and switch projects
 *
 * Phase 16b Stage 1: Wired to ProjectContext, real data, basic dropdown
 */
export const ProjectSelector: React.FC<ProjectSelectorProps> = ({
  onCreateProject,
  className
}) => {
  // Phase 16b Stage 3: Access deleteProject from context
  const {
    activeProject,
    projects,
    isLoading,
    error,
    setActiveProject,
    deleteProject
  } = useProjectContext();

  const [isDropdownOpen, setIsDropdownOpen] = useState(false);

  // TODO: Phase 16b Stage 4 - Implement project search/filter
  // const [searchQuery, setSearchQuery] = useState('');

  // TODO: Phase 16b Stage 4 - Add keyboard navigation
  // TODO: Phase 16b Stage 4 - Add recent projects tracking
  // TODO: Phase 16b Stage 4 - Add project favorites

  /**
   * Handle project selection from dropdown
   */
  const handleProjectSelect = async (project: IProject) => {
    try {
      await setActiveProject(project);
      setIsDropdownOpen(false);
    } catch (err) {
      console.error('Failed to set active project:', err);
    }
  };

  /**
   * Handle create project button click
   */
  const handleCreateProject = () => {
    setIsDropdownOpen(false);
    if (onCreateProject) {
      onCreateProject();
    }
  };

  /**
   * Handle project deletion (Phase 16b Stage 3)
   */
  const handleProjectDelete = async (project: IProject) => {
    try {
      const success = await deleteProject(project.id);
      if (success) {
        console.log('[ProjectSelector] Project deleted:', project.name);

        // If we deleted the active project, switch to another project
        if (activeProject?.id === project.id) {
          // Find another project to switch to (excluding the deleted one)
          const remainingProjects = projects.filter(p => p.id !== project.id);

          if (remainingProjects.length > 0) {
            // Auto-switch to the first remaining project
            console.log('[ProjectSelector] Auto-switching to:', remainingProjects[0].name);
            await setActiveProject(remainingProjects[0] as IProject);
          } else {
            // No projects left, clear active project (shows WelcomeScreen)
            console.log('[ProjectSelector] No projects remaining, showing WelcomeScreen');
            await setActiveProject(null);
          }
        }
      }
    } catch (err) {
      console.error('[ProjectSelector] Failed to delete project:', err);
    }
  };

  /**
   * Toggle dropdown open/closed
   */
  const toggleDropdown = () => {
    setIsDropdownOpen(!isDropdownOpen);
  };

  return (
    <div className={cn('project-selector', className)}>
      {/* Active Project Display */}
      <div
        className="project-selector__active cursor-pointer"
        onClick={toggleDropdown}
        role="button"
        aria-expanded={isDropdownOpen}
        aria-label="Project selector"
      >
        {isLoading ? (
          <span className="text-muted-foreground">Loading projects...</span>
        ) : error ? (
          <span className="text-destructive">Error: {error}</span>
        ) : activeProject ? (
          <div className="flex items-center gap-2">
            {activeProject.metadata?.icon && (
              <span className="text-lg">{activeProject.metadata.icon}</span>
            )}
            <span className="font-medium">
              {activeProject.name}
            </span>
            <span className="text-xs text-muted-foreground">
              ({activeProject.type})
            </span>
            {/* Dropdown chevron */}
            <span className="ml-auto text-muted-foreground">
              {isDropdownOpen ? '▲' : '▼'}
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <span className="text-muted-foreground">No project selected</span>
            <span className="ml-auto text-muted-foreground">▼</span>
          </div>
        )}
      </div>

      {/* Dropdown Menu */}
      {isDropdownOpen && (
        <div className="project-selector__dropdown">
          {/* TODO: Phase 16b Stage 4 - Add project search input */}

          {/* Project List */}
          {/* Phase 16b Stage 3: Added onDelete handler for project deletion */}
          {projects.length > 0 ? (
            <div className="project-selector__list">
              {projects.map((project) => (
                <ProjectListItem
                  key={project.id}
                  project={project as IProject}
                  isActive={activeProject?.id === project.id}
                  onClick={handleProjectSelect}
                  onDelete={handleProjectDelete}
                />
              ))}
            </div>
          ) : (
            <div className="project-selector__empty text-muted-foreground">
              No projects found. Create one to get started.
            </div>
          )}

          {/* Create Project Button */}
          {onCreateProject && (
            <div className="project-selector__footer">
              <button
                className="w-full text-left px-3 py-2 hover:bg-accent"
                onClick={handleCreateProject}
              >
                + Create New Project
              </button>
            </div>
          )}

          {/* TODO: Phase 16b Stage 4 - Add project settings/management options */}
        </div>
      )}
    </div>
  );
};

export default ProjectSelector;
