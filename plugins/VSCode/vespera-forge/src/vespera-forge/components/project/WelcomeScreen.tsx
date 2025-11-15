/**
 * WelcomeScreen Component
 * Phase 16b Stage 2 - First-time user experience
 *
 * Shows when no projects exist. Provides a friendly welcome message
 * and guides users to create their first project.
 *
 * Design: Simple, welcoming, VS Code themed
 */

import React from 'react';
import { DEFAULT_PROJECT_TYPES } from '../../../types/project';
import { cn } from '@/lib/utils';

/**
 * Props for WelcomeScreen component
 */
export interface WelcomeScreenProps {
  /** Callback when user clicks to create a project */
  onCreateProject: () => void;

  /** Optional class name */
  className?: string;
}

/**
 * WelcomeScreen component - first-time user experience
 *
 * Displays when no projects exist in the workspace.
 * Shows project type cards and CTA to create first project.
 */
export const WelcomeScreen: React.FC<WelcomeScreenProps> = ({
  onCreateProject,
  className
}) => {
  return (
    <div className={cn(
      'welcome-screen',
      'flex flex-col items-center justify-center',
      'h-full p-6 text-center',
      className
    )}>
      {/* Welcome Header */}
      <div className="mb-8">
        <div className="text-6xl mb-4">📁</div>
        <h1 className="text-2xl font-bold mb-2">
          Welcome to Vespera Forge
        </h1>
        <p className="text-muted-foreground max-w-md">
          Get started by creating your first project. Projects help you organize
          your work with templates and tools tailored to your needs.
        </p>
      </div>

      {/* Project Type Cards */}
      <div className="mb-8 w-full max-w-2xl">
        <h2 className="text-lg font-semibold mb-4">
          What will you be working on?
        </h2>
        <div className="grid grid-cols-2 gap-3">
          {DEFAULT_PROJECT_TYPES
            .filter(type => type.id !== 'general') // Show general last
            .slice(0, 6) // Show first 6 types
            .map(type => (
              <div
                key={type.id}
                className={cn(
                  'project-type-card',
                  'p-4 rounded-lg border border-border',
                  'bg-background hover:bg-accent',
                  'transition-colors cursor-pointer',
                  'text-left'
                )}
                onClick={onCreateProject}
                role="button"
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onCreateProject();
                  }
                }}
              >
                <div className="flex items-start gap-3">
                  <div className="text-2xl flex-shrink-0">
                    {type.icon || '📁'}
                  </div>
                  <div className="flex-1 min-w-0">
                    <h3 className="font-semibold text-sm mb-1">
                      {type.name}
                    </h3>
                    <p className="text-xs text-muted-foreground line-clamp-2">
                      {type.description}
                    </p>
                  </div>
                </div>
              </div>
            ))}
        </div>
      </div>

      {/* Create Project CTA */}
      <div>
        <button
          onClick={onCreateProject}
          className={cn(
            'px-6 py-3 rounded-lg',
            'bg-primary text-primary-foreground',
            'font-semibold',
            'hover:bg-primary/90',
            'focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2',
            'transition-colors'
          )}
        >
          Create Your First Project
        </button>
        <p className="text-xs text-muted-foreground mt-3">
          You'll be guided through a quick setup wizard
        </p>
      </div>

      {/* Additional Info */}
      <div className="mt-8 text-xs text-muted-foreground max-w-md">
        <p>
          Projects are the foundation of Vespera Forge. They provide context-aware
          templates, organize your content, and enable powerful automation features.
        </p>
      </div>
    </div>
  );
};

export default WelcomeScreen;
