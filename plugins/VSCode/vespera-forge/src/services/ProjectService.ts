/**
 * ProjectService - Manages workspace-level projects via Bindery backend
 * Phase 17 - Real-world creative endeavors containing multiple contexts
 *
 * Projects are stored in the database (via Bindery), not the filesystem.
 * This is a thin wrapper around Bindery JSON-RPC calls.
 *
 * Architecture:
 * - Workspace → Project → Context → Codex (3-level hierarchy)
 * - Projects are database-backed entities managed by Rust Bindery backend
 * - This service provides a TypeScript API layer for project CRUD operations
 * - Uses BinderyService as transport layer for JSON-RPC communication
 *
 * Migration Note:
 * - The OLD ProjectService (Phase 16) managed file-based "contexts"
 * - That functionality has moved to ContextService
 * - THIS is the NEW ProjectService for workspace-level projects
 */

import { BinderyService } from './bindery';
import { ProjectId, WorkspaceId, BinderyConnectionStatus } from '../types/bindery';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { DisposableResource } from '../types';

// =============================================================================
// PROJECT INTERFACES
// =============================================================================

/**
 * Project entity - workspace-level organizational unit
 *
 * A Project represents a real-world creative endeavor (e.g., "My Novel",
 * "Research Paper on AI", "D&D Campaign"). Projects contain multiple Contexts.
 */
export interface IProject {
  /** Unique project identifier (UUID) */
  id: ProjectId;

  /** Workspace this project belongs to */
  workspace_id: WorkspaceId;

  /** Human-readable project name */
  name: string;

  /** Optional project description */
  description?: string;

  /** Project type (journalism, research, fiction, documentation, general) */
  project_type: string;

  /** Currently active context ID within this project */
  active_context_id?: string;

  /** Project-specific settings (JSON object) */
  settings?: Record<string, any>;

  /** Creation timestamp (ISO 8601 string) */
  created_at: string;

  /** Last update timestamp (ISO 8601 string) */
  updated_at: string;
}

/**
 * Input for creating a new project
 */
export interface ProjectCreateInput {
  /** Workspace this project belongs to */
  workspace_id: WorkspaceId;

  /** Human-readable project name */
  name: string;

  /** Optional project description */
  description?: string;

  /** Project type (journalism, research, fiction, documentation, general) */
  project_type: string;

  /** Optional project-specific settings */
  settings?: Record<string, any>;
}

/**
 * Input for updating an existing project
 */
export interface ProjectUpdateInput {
  /** New project name */
  name?: string;

  /** New project description */
  description?: string;

  /** New project type */
  project_type?: string;

  /** Set the active context ID */
  active_context_id?: string;

  /** Update project settings */
  settings?: Record<string, any>;
}

/**
 * Service configuration options
 */
export interface ProjectServiceConfig {
  /** Logger instance for debugging */
  logger?: VesperaLogger;

  /** BinderyService instance (optional - will create default if not provided) */
  binderyService?: BinderyService;
}

// =============================================================================
// PROJECT SERVICE
// =============================================================================

/**
 * ProjectService - Manages workspace-level projects via Bindery backend
 *
 * This is a SIMPLE service that:
 * 1. Communicates with Rust Bindery backend via JSON-RPC
 * 2. Uses the existing BinderyService as the transport layer
 * 3. Provides CRUD operations for workspace-level projects
 * 4. Manages active project state
 *
 * Unlike the old ProjectService (now ContextService), this:
 * - Does NOT manage files directly
 * - Does NOT have file persistence logic
 * - Does NOT have complex index management
 * - IS a thin wrapper around Bindery JSON-RPC calls
 */
export class ProjectService implements DisposableResource {
  private static instance: ProjectService | null = null;
  private bindery: BinderyService;
  private activeProjectId: ProjectId | null = null;
  private _isDisposed = false;
  private readonly config: ProjectServiceConfig;

  private constructor(config: ProjectServiceConfig = {}) {
    this.config = config;
    this.bindery = config.binderyService || new BinderyService();
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(config?: ProjectServiceConfig): ProjectService {
    if (!ProjectService.instance) {
      ProjectService.instance = new ProjectService(config);
    }
    return ProjectService.instance;
  }

  /**
   * Dispose singleton instance
   */
  public static disposeInstance(): void {
    if (ProjectService.instance) {
      ProjectService.instance.dispose();
      ProjectService.instance = null;
    }
  }

  /**
   * Initialize the service - ensure Bindery connection is established
   */
  public async initialize(): Promise<void> {
    if (this._isDisposed) {
      throw new Error('Cannot initialize disposed ProjectService');
    }

    // Initialize Bindery connection if needed
    const connectionInfo = this.bindery.getConnectionInfo();
    if (connectionInfo.status !== BinderyConnectionStatus.Connected) {
      const result = await this.bindery.initialize();
      if (!result.success) {
        const errorMessage = result.success === false ? result.error.message : 'Unknown error';
        throw new Error(`Failed to initialize Bindery: ${errorMessage}`);
      }
    }

    this.config.logger?.info('ProjectService initialized successfully');
  }

  // =============================================================================
  // CRUD OPERATIONS
  // =============================================================================

  /**
   * Create a new project
   *
   * @param input - Project creation parameters
   * @returns The created project
   * @throws Error if creation fails
   *
   * Implementation Note:
   * TODO: This will call Bindery backend in Task F1 (Integration cluster)
   * Method: "create_project"
   * Params: { workspace_id, name, description, project_type, settings }
   */
  public async createProject(input: ProjectCreateInput): Promise<IProject> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // TODO (Task F1): Call Bindery backend via JSON-RPC
    // const result = await this.bindery.sendRequest('create_project', {
    //   workspace_id: input.workspace_id,
    //   name: input.name,
    //   description: input.description,
    //   project_type: input.project_type,
    //   settings: input.settings
    // });
    //
    // if (!result.success) {
    //   throw new Error(`Failed to create project: ${result.error?.message}`);
    // }
    //
    // return result.data;

    throw new Error('Not implemented - will call Bindery backend in Task F1');
  }

  /**
   * Get project by ID
   *
   * @param projectId - Project UUID
   * @returns The project, or null if not found
   *
   * Implementation Note:
   * TODO: This will call Bindery backend in Task F1
   * Method: "get_project"
   * Params: { project_id }
   */
  public async getProject(projectId: ProjectId): Promise<IProject | null> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // TODO (Task F1): Call Bindery backend
    // const result = await this.bindery.sendRequest('get_project', {
    //   project_id: projectId
    // });
    //
    // if (!result.success) {
    //   if (result.error?.code === -32602) { // Not found
    //     return null;
    //   }
    //   throw new Error(`Failed to get project: ${result.error?.message}`);
    // }
    //
    // return result.data;

    throw new Error('Not implemented - will call Bindery backend in Task F1');
  }

  /**
   * Update existing project
   *
   * @param projectId - Project UUID
   * @param update - Fields to update
   * @returns The updated project
   * @throws Error if update fails or project not found
   *
   * Implementation Note:
   * TODO: This will call Bindery backend in Task F1
   * Method: "update_project"
   * Params: { project_id, ...update }
   */
  public async updateProject(
    projectId: ProjectId,
    update: ProjectUpdateInput
  ): Promise<IProject> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // TODO (Task F1): Call Bindery backend
    // const result = await this.bindery.sendRequest('update_project', {
    //   project_id: projectId,
    //   ...update
    // });
    //
    // if (!result.success) {
    //   throw new Error(`Failed to update project: ${result.error?.message}`);
    // }
    //
    // return result.data;

    throw new Error('Not implemented - will call Bindery backend in Task F1');
  }

  /**
   * Delete project
   *
   * @param projectId - Project UUID
   * @throws Error if deletion fails
   *
   * Implementation Note:
   * TODO: This will call Bindery backend in Task F1
   * Method: "delete_project"
   * Params: { project_id }
   */
  public async deleteProject(projectId: ProjectId): Promise<void> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // TODO (Task F1): Call Bindery backend
    // const result = await this.bindery.sendRequest('delete_project', {
    //   project_id: projectId
    // });
    //
    // if (!result.success) {
    //   throw new Error(`Failed to delete project: ${result.error?.message}`);
    // }

    // Clear active project if deleted
    if (this.activeProjectId === projectId) {
      this.activeProjectId = null;
    }

    throw new Error('Not implemented - will call Bindery backend in Task F1');
  }

  /**
   * List all projects in a workspace
   *
   * @param workspaceId - Workspace UUID
   * @returns Array of projects in the workspace
   *
   * Implementation Note:
   * TODO: This will call Bindery backend in Task F1
   * Method: "list_projects"
   * Params: { workspace_id }
   */
  public async listProjects(workspaceId: WorkspaceId): Promise<IProject[]> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // TODO (Task F1): Call Bindery backend
    // const result = await this.bindery.sendRequest('list_projects', {
    //   workspace_id: workspaceId
    // });
    //
    // if (!result.success) {
    //   throw new Error(`Failed to list projects: ${result.error?.message}`);
    // }
    //
    // return result.data;

    throw new Error('Not implemented - will call Bindery backend in Task F1');
  }

  // =============================================================================
  // ACTIVE PROJECT MANAGEMENT
  // =============================================================================

  /**
   * Set the active project (current working context)
   *
   * @param projectId - Project UUID to set as active, or null to clear
   */
  public setActiveProject(projectId: ProjectId | null): void {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    this.activeProjectId = projectId;
    this.config.logger?.debug('Active project changed', { projectId });
  }

  /**
   * Get the currently active project ID
   *
   * @returns The active project ID, or null if none
   */
  public getActiveProjectId(): ProjectId | null {
    return this.activeProjectId;
  }

  /**
   * Get the currently active project
   *
   * @returns The active project, or null if none or not found
   */
  public async getActiveProject(): Promise<IProject | null> {
    if (!this.activeProjectId) {
      return null;
    }
    return this.getProject(this.activeProjectId);
  }

  // =============================================================================
  // LIFECYCLE MANAGEMENT
  // =============================================================================

  /**
   * Get disposal status
   */
  public get isDisposed(): boolean {
    return this._isDisposed;
  }

  /**
   * Dispose the service and clean up resources
   */
  public dispose(): void {
    if (this._isDisposed) {
      return;
    }

    this.config.logger?.info('Disposing ProjectService');

    // Clear active project
    this.activeProjectId = null;

    this._isDisposed = true;
    this.config.logger?.debug('ProjectService disposed');
  }
}

// =============================================================================
// SINGLETON ACCESS HELPERS
// =============================================================================

/**
 * Get the ProjectService singleton instance
 * @throws Error if not initialized
 */
export function getProjectService(): ProjectService {
  const instance = ProjectService.getInstance();
  if (!instance) {
    throw new Error('ProjectService not initialized. Call ProjectService.getInstance() first.');
  }
  return instance;
}

/**
 * Initialize and get ProjectService singleton
 */
export async function initializeProjectService(
  config?: ProjectServiceConfig
): Promise<ProjectService> {
  const service = ProjectService.getInstance(config);
  await service.initialize();
  return service;
}

/**
 * Dispose ProjectService singleton
 */
export async function disposeProjectService(): Promise<void> {
  ProjectService.disposeInstance();
}
