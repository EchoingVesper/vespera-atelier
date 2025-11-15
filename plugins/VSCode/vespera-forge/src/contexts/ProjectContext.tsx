/**
 * ProjectContext - React Context for active project state management
 * Phase 16b Stage 1 - Core Integration
 *
 * Manages the currently active project across all React components.
 * Persists active project to VS Code workspace state for session continuity.
 *
 * Based on: docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md
 */

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { IProject, ProjectListItem } from '../types/project';

/**
 * Project context value interface
 */
export interface ProjectContextValue {
  /** Currently active project (null if none selected) */
  activeProject: IProject | null;

  /** All available projects */
  projects: ProjectListItem[];

  /** Loading state for project operations */
  isLoading: boolean;

  /** Error state */
  error: string | null;

  /** Set the active project */
  setActiveProject: (project: IProject | null) => Promise<void>;

  /** Reload projects from service */
  reloadProjects: () => Promise<void>;

  /** Create a new project */
  createProject: (project: Partial<IProject>) => Promise<IProject>;

  /** Delete a project */
  deleteProject: (projectId: string) => Promise<boolean>;
}

/**
 * Project Context for active project state
 */
const ProjectContext = createContext<ProjectContextValue | undefined>(undefined);

/**
 * Props for ProjectProvider component
 */
export interface ProjectProviderProps {
  children: React.ReactNode;

  /** VS Code API for webview communication */
  vscode?: {
    postMessage: (message: any) => void;
    getState: () => any;
    setState: (state: any) => void;
  };
}

/**
 * ProjectProvider component - provides project context to child components
 *
 * Manages active project state and communicates with extension host via postMessage.
 */
export const ProjectProvider: React.FC<ProjectProviderProps> = ({ children, vscode }) => {
  const [activeProject, setActiveProjectState] = useState<IProject | null>(null);
  const [projects, setProjects] = useState<ProjectListItem[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  /**
   * Load projects from extension host
   */
  const reloadProjects = useCallback(async () => {
    console.log('[ProjectContext] reloadProjects called');
    setIsLoading(true);
    setError(null);

    try {
      if (!vscode) {
        // Fallback for non-webview context (e.g., tests)
        console.log('[ProjectContext] No vscode API in reloadProjects');
        setIsLoading(false);
        return;
      }

      // Request projects from extension host
      console.log('[ProjectContext] Sending project:list request');
      vscode.postMessage({
        type: 'project:list',
        payload: {}
      });

      // Note: Actual data will come via message listener
      // See useEffect below for message handling

    } catch (err) {
      console.error('[ProjectContext] reloadProjects error:', err);
      setError(err instanceof Error ? err.message : 'Failed to load projects');
      setIsLoading(false);
    }
  }, [vscode]);

  /**
   * Set active project and persist to workspace state
   */
  const setActiveProject = useCallback(async (project: IProject | null) => {
    setActiveProjectState(project);

    if (!vscode) {
      return;
    }

    // Notify extension host of active project change
    vscode.postMessage({
      type: 'project:setActive',
      payload: {
        projectId: project?.id || null
      }
    });

    // Persist to webview state (survives panel hide/show)
    vscode.setState({
      activeProjectId: project?.id || null
    });
  }, [vscode]);

  /**
   * Create a new project
   */
  const createProject = useCallback(async (projectData: Partial<IProject>): Promise<IProject> => {
    if (!vscode) {
      throw new Error('VS Code API not available');
    }

    return new Promise((resolve, reject) => {
      const messageId = `create-${Date.now()}`;

      // Set up one-time message listener for response
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'project:created' && message.id === messageId) {
          window.removeEventListener('message', handleMessage);
          resolve(message.payload.project);
        } else if (message.type === 'project:error' && message.id === messageId) {
          window.removeEventListener('message', handleMessage);
          reject(new Error(message.payload.error));
        }
      };

      window.addEventListener('message', handleMessage);

      // Send create request
      vscode.postMessage({
        type: 'project:create',
        id: messageId,
        payload: projectData
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Project creation timeout'));
      }, 10000);
    });
  }, [vscode]);

  /**
   * Delete a project
   */
  const deleteProject = useCallback(async (projectId: string): Promise<boolean> => {
    if (!vscode) {
      throw new Error('VS Code API not available');
    }

    return new Promise((resolve, reject) => {
      const messageId = `delete-${Date.now()}`;

      // Set up one-time message listener for response
      const handleMessage = (event: MessageEvent) => {
        const message = event.data;
        if (message.type === 'project:deleted' && message.id === messageId) {
          window.removeEventListener('message', handleMessage);
          resolve(message.payload.success);
        } else if (message.type === 'project:error' && message.id === messageId) {
          window.removeEventListener('message', handleMessage);
          reject(new Error(message.payload.error));
        }
      };

      window.addEventListener('message', handleMessage);

      // Send delete request
      vscode.postMessage({
        type: 'project:delete',
        id: messageId,
        payload: { projectId }
      });

      // Timeout after 10 seconds
      setTimeout(() => {
        window.removeEventListener('message', handleMessage);
        reject(new Error('Project deletion timeout'));
      }, 10000);
    });
  }, [vscode]);

  /**
   * Load initial data on mount
   */
  useEffect(() => {
    console.log('[ProjectContext] Initializing...');

    // Load projects on mount
    reloadProjects();

    if (!vscode) {
      console.log('[ProjectContext] No vscode API available');
      return;
    }

    // Restore active project from webview state
    const state = vscode.getState();
    console.log('[ProjectContext] Webview state:', state);

    if (state?.activeProjectId) {
      console.log('[ProjectContext] Requesting active project:', state.activeProjectId);
      vscode.postMessage({
        type: 'project:get',
        payload: { projectId: state.activeProjectId }
      });
    } else {
      console.log('[ProjectContext] No active project in webview state');
    }

    // Set up message listener for extension host responses
    const handleMessage = (event: MessageEvent) => {
      const message = event.data;

      // Log all project-related messages for debugging
      if (message.type?.startsWith('project:')) {
        console.log('[ProjectContext] Received message:', message.type, message.payload);
      }

      switch (message.type) {
        case 'project:list:response':
          console.log('[ProjectContext] Projects loaded:', message.payload.projects?.length || 0);
          setProjects(message.payload.projects || []);
          setIsLoading(false);
          break;

        case 'project:get:response':
          console.log('[ProjectContext] Active project received:', message.payload.project?.name);
          if (message.payload.project) {
            setActiveProjectState(message.payload.project);
          }
          break;

        case 'project:activeChanged':
          // Active project changed from extension (e.g., via command palette)
          console.log('[ProjectContext] Active project changed:', message.payload.project?.name);
          if (message.payload.project) {
            setActiveProjectState(message.payload.project);
          } else {
            setActiveProjectState(null);
          }
          break;

        case 'project:projectsChanged':
          // Projects list changed (create/delete/update)
          console.log('[ProjectContext] Projects list changed, reloading...');
          reloadProjects();
          break;

        case 'project:error':
          console.error('[ProjectContext] Error:', message.payload.error);
          setError(message.payload.error);
          setIsLoading(false);
          break;
      }
    };

    window.addEventListener('message', handleMessage);

    return () => {
      window.removeEventListener('message', handleMessage);
    };
  }, [vscode, reloadProjects]);

  const value: ProjectContextValue = {
    activeProject,
    projects,
    isLoading,
    error,
    setActiveProject,
    reloadProjects,
    createProject,
    deleteProject
  };

  return <ProjectContext.Provider value={value}>{children}</ProjectContext.Provider>;
};

/**
 * Hook to access project context
 *
 * @throws Error if used outside ProjectProvider
 */
export const useProjectContext = (): ProjectContextValue => {
  const context = useContext(ProjectContext);

  if (context === undefined) {
    throw new Error('useProjectContext must be used within a ProjectProvider');
  }

  return context;
};

/**
 * Hook to get current active project (convenience)
 */
export const useActiveProject = (): IProject | null => {
  const { activeProject } = useProjectContext();
  return activeProject;
};

/**
 * Hook to get projects list (convenience)
 */
export const useProjects = (): ProjectListItem[] => {
  const { projects } = useProjectContext();
  return projects;
};
