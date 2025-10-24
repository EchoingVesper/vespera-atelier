/**
 * ProjectService - Core service for project management
 * Phase 16a Round 3 - Project-centric architecture foundation
 *
 * Provides CRUD operations, validation, and file-based persistence for projects.
 * Projects are the fundamental organizing unit - everything exists within a project.
 *
 * Based on: docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md
 */

import * as vscode from 'vscode';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';
import {
  IProject,
  ProjectType,
  ProjectStatus,
  ProjectCreateInput,
  ProjectUpdateInput,
  ProjectListItem,
  ProjectValidationResult,
  ProjectQueryFilters,
  ProjectStats,
  ProjectMetadata,
  ProjectSettings,
  createDefaultProjectSettings,
  createDefaultProjectMetadata,
  isProject,
  isProjectType,
  PROJECT_CONSTANTS,
  PROJECT_TYPE_METADATA
} from '../types/project';
import { VesperaLogger } from '../core/logging/VesperaLogger';
import { DisposableResource } from '../types';

/**
 * Project index structure for fast lookups
 */
interface ProjectIndex {
  version: string;
  lastUpdated: string;
  projects: Record<string, {
    id: string;
    name: string;
    type: ProjectType;
    status: ProjectStatus;
    updatedAt: string;
  }>;
}

/**
 * Service configuration options
 */
export interface ProjectServiceConfig {
  /** Logger instance for debugging */
  logger?: VesperaLogger;

  /** Enable automatic index rebuilds on inconsistency */
  autoRebuildIndex?: boolean;

  /** Enable project backups before destructive operations */
  enableBackups?: boolean;
}

/**
 * ProjectService - Manages project lifecycle and persistence
 *
 * Features:
 * - CRUD operations for projects
 * - File-based persistence (.vespera/projects/)
 * - Project validation
 * - Active project tracking
 * - Index management for fast listing
 */
export class ProjectService implements DisposableResource {
  private static instance: ProjectService | null = null;
  private readonly workspaceRoot: string;
  private readonly projectsDir: vscode.Uri;
  private readonly indexFile: vscode.Uri;
  private activeProjectId: string | null = null;
  private projectCache: Map<string, IProject> = new Map();
  private indexCache: ProjectIndex | null = null;
  private _isDisposed = false;
  private readonly config: ProjectServiceConfig;

  private constructor(
    workspaceUri: vscode.Uri,
    config: ProjectServiceConfig = {}
  ) {
    this.workspaceRoot = workspaceUri.fsPath;
    this.projectsDir = vscode.Uri.joinPath(workspaceUri, '.vespera', 'projects');
    this.indexFile = vscode.Uri.joinPath(this.projectsDir, 'projects-index.json');
    this.config = {
      autoRebuildIndex: true,
      enableBackups: true,
      ...config
    };

    this.config.logger?.debug('ProjectService initialized', {
      workspaceRoot: this.workspaceRoot,
      projectsDir: this.projectsDir.fsPath
    });
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(
    workspaceUri?: vscode.Uri,
    config?: ProjectServiceConfig
  ): ProjectService {
    if (!ProjectService.instance) {
      if (!workspaceUri) {
        throw new Error('ProjectService requires workspaceUri for first initialization');
      }
      ProjectService.instance = new ProjectService(workspaceUri, config);
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
   * Initialize the service - ensure directories exist and load index
   */
  public async initialize(): Promise<void> {
    if (this._isDisposed) {
      throw new Error('Cannot initialize disposed ProjectService');
    }

    try {
      // Ensure .vespera/projects directory exists
      await vscode.workspace.fs.createDirectory(this.projectsDir);

      // Load or create index
      await this.loadIndex();

      this.config.logger?.info('ProjectService initialized successfully', {
        projectCount: Object.keys(this.indexCache?.projects || {}).length
      });
    } catch (error) {
      this.config.logger?.error('Failed to initialize ProjectService', error);
      throw error;
    }
  }

  // =============================================================================
  // CRUD OPERATIONS
  // =============================================================================

  /**
   * Create a new project
   */
  public async createProject(input: ProjectCreateInput): Promise<IProject> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // Validate input
    const validation = this.validateProjectInput(input);
    if (!validation.isValid) {
      throw new Error(`Invalid project input: ${validation.errors.join(', ')}`);
    }

    // Generate ID if not provided
    const id = input.id || uuidv4();

    // Check for duplicate ID
    if (await this.projectExists(id)) {
      throw new Error(`Project with ID ${id} already exists`);
    }

    // Create project object
    const now = new Date();
    const defaultMetadata = createDefaultProjectMetadata();

    const project: IProject = {
      id,
      name: input.name,
      type: input.type,
      description: input.description,
      status: input.status || ProjectStatus.Active,
      metadata: {
        ...defaultMetadata,
        ...(input.metadata || {}),
        createdAt: now,
        updatedAt: now
      },
      settings: input.settings || createDefaultProjectSettings()
    };

    // Persist to file
    await this.saveProjectToFile(project);

    // Update cache and index
    this.projectCache.set(id, project);
    await this.updateIndex(project);

    this.config.logger?.info('Project created', { id, name: project.name, type: project.type });

    return project;
  }

  /**
   * Get project by ID
   */
  public async getProject(projectId: string): Promise<IProject | undefined> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // Check cache first
    if (this.projectCache.has(projectId)) {
      return this.projectCache.get(projectId);
    }

    // Load from file
    try {
      const project = await this.loadProjectFromFile(projectId);
      if (project) {
        this.projectCache.set(projectId, project);
      }
      return project;
    } catch (error) {
      this.config.logger?.error(`Failed to load project ${projectId}`, error);
      return undefined;
    }
  }

  /**
   * Update existing project
   */
  public async updateProject(
    projectId: string,
    updates: Partial<ProjectUpdateInput>
  ): Promise<IProject> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // Load existing project
    const existing = await this.getProject(projectId);
    if (!existing) {
      throw new Error(`Project ${projectId} not found`);
    }

    // Create backup if enabled
    if (this.config.enableBackups) {
      await this.backupProject(existing);
    }

    // Merge updates
    const updated: IProject = {
      ...existing,
      ...updates,
      id: projectId, // Ensure ID doesn't change
      metadata: {
        ...existing.metadata,
        ...(updates.metadata || {}),
        createdAt: existing.metadata.createdAt, // Preserve creation date
        updatedAt: new Date()
      },
      settings: {
        ...existing.settings,
        ...(updates.settings || {})
      }
    };

    // Validate updated project
    const validation = this.validateProject(updated);
    if (!validation.isValid) {
      throw new Error(`Invalid project update: ${validation.errors.join(', ')}`);
    }

    // Persist changes
    await this.saveProjectToFile(updated);

    // Update cache and index
    this.projectCache.set(projectId, updated);
    await this.updateIndex(updated);

    this.config.logger?.info('Project updated', { id: projectId });

    return updated;
  }

  /**
   * Delete project
   */
  public async deleteProject(projectId: string): Promise<boolean> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    const project = await this.getProject(projectId);
    if (!project) {
      return false;
    }

    // Create backup before deletion
    if (this.config.enableBackups) {
      await this.backupProject(project);
    }

    try {
      // Delete project file
      const projectFile = this.getProjectFilePath(projectId);
      await vscode.workspace.fs.delete(projectFile);

      // Remove from cache and index
      this.projectCache.delete(projectId);
      await this.removeFromIndex(projectId);

      // Clear active project if this was it
      if (this.activeProjectId === projectId) {
        this.activeProjectId = null;
      }

      this.config.logger?.info('Project deleted', { id: projectId });

      return true;
    } catch (error) {
      this.config.logger?.error(`Failed to delete project ${projectId}`, error);
      return false;
    }
  }

  /**
   * List all projects with optional filtering and sorting
   */
  public async listProjects(filters?: ProjectQueryFilters): Promise<IProject[]> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // Load index to get list of project IDs
    const index = await this.loadIndex();
    const projectIds = Object.keys(index.projects);

    // Load all projects (TODO: optimize with pagination in Phase 16b)
    const projects: IProject[] = [];
    for (const id of projectIds) {
      const project = await this.getProject(id);
      if (project) {
        projects.push(project);
      }
    }

    // Apply filters
    let filtered = this.applyFilters(projects, filters);

    // Apply sorting
    filtered = this.applySorting(filtered, filters);

    // Apply pagination
    if (filters?.limit || filters?.offset) {
      const offset = filters.offset || 0;
      const limit = filters.limit || filtered.length;
      filtered = filtered.slice(offset, offset + limit);
    }

    return filtered;
  }

  /**
   * Get lightweight project list items (for UI pickers)
   */
  public async listProjectItems(filters?: ProjectQueryFilters): Promise<ProjectListItem[]> {
    const projects = await this.listProjects(filters);
    return projects.map(p => ({
      id: p.id,
      name: p.name,
      type: p.type,
      status: p.status,
      updatedAt: p.updatedAt,
      icon: p.metadata.icon,
      color: p.metadata.color
    }));
  }

  /**
   * Get project statistics
   */
  public async getStats(): Promise<ProjectStats> {
    const projects = await this.listProjects();

    const stats: ProjectStats = {
      total: projects.length,
      byType: {
        journalism: 0,
        research: 0,
        fiction: 0,
        documentation: 0,
        general: 0
      },
      byStatus: {
        [ProjectStatus.Active]: 0,
        [ProjectStatus.Archived]: 0,
        [ProjectStatus.Template]: 0
      }
    };

    let mostRecent: IProject | null = null;
    let oldest: IProject | null = null;

    for (const project of projects) {
      // Count by type
      stats.byType[project.type]++;

      // Count by status
      stats.byStatus[project.status]++;

      // Track most recent
      if (!mostRecent || project.updatedAt > mostRecent.updatedAt) {
        mostRecent = project;
      }

      // Track oldest
      if (!oldest || project.createdAt < oldest.createdAt) {
        oldest = project;
      }
    }

    if (mostRecent) {
      stats.recentlyUpdated = {
        id: mostRecent.id,
        name: mostRecent.name,
        type: mostRecent.type,
        status: mostRecent.status,
        updatedAt: mostRecent.updatedAt,
        icon: mostRecent.metadata.icon,
        color: mostRecent.metadata.color
      };
    }

    if (oldest) {
      stats.oldest = {
        id: oldest.id,
        name: oldest.name,
        type: oldest.type,
        status: oldest.status,
        updatedAt: oldest.updatedAt,
        icon: oldest.metadata.icon,
        color: oldest.metadata.color
      };
    }

    return stats;
  }

  // =============================================================================
  // ACTIVE PROJECT MANAGEMENT
  // =============================================================================

  /**
   * Set the active project (current working context)
   */
  public async setActiveProject(projectId: string): Promise<void> {
    if (this._isDisposed) {
      throw new Error('ProjectService is disposed');
    }

    // Verify project exists
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Cannot set active project: ${projectId} not found`);
    }

    this.activeProjectId = projectId;
    this.config.logger?.debug('Active project set', { id: projectId, name: project.name });

    // TODO: Phase 16b - Emit event for listeners (Navigator, Template system, etc.)
  }

  /**
   * Get the currently active project
   */
  public getActiveProject(): IProject | undefined {
    if (this._isDisposed || !this.activeProjectId) {
      return undefined;
    }

    return this.projectCache.get(this.activeProjectId);
  }

  /**
   * Get active project ID
   */
  public getActiveProjectId(): string | null {
    return this.activeProjectId;
  }

  /**
   * Clear active project
   */
  public clearActiveProject(): void {
    this.activeProjectId = null;
    this.config.logger?.debug('Active project cleared');
  }

  // =============================================================================
  // VALIDATION
  // =============================================================================

  /**
   * Validate project input for creation
   */
  private validateProjectInput(input: ProjectCreateInput): ProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: Record<string, string> = {};

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      errors.push('Project name is required');
      fieldErrors.name = 'Name cannot be empty';
    } else if (input.name.length < PROJECT_CONSTANTS.NAME.MIN_LENGTH) {
      errors.push(`Project name must be at least ${PROJECT_CONSTANTS.NAME.MIN_LENGTH} character`);
      fieldErrors.name = 'Name too short';
    } else if (input.name.length > PROJECT_CONSTANTS.NAME.MAX_LENGTH) {
      errors.push(`Project name cannot exceed ${PROJECT_CONSTANTS.NAME.MAX_LENGTH} characters`);
      fieldErrors.name = 'Name too long';
    } else if (!PROJECT_CONSTANTS.NAME.PATTERN.test(input.name)) {
      errors.push('Project name contains invalid characters');
      fieldErrors.name = 'Invalid characters in name';
    }

    // Validate type
    if (!input.type) {
      errors.push('Project type is required');
      fieldErrors.type = 'Type is required';
    } else if (!isProjectType(input.type)) {
      errors.push(`Invalid project type: ${input.type}`);
      fieldErrors.type = 'Invalid project type';
    }

    // Validate description
    if (input.description && input.description.length > PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH) {
      errors.push(`Description cannot exceed ${PROJECT_CONSTANTS.DESCRIPTION.MAX_LENGTH} characters`);
      fieldErrors.description = 'Description too long';
    }

    // Validate tags
    if (input.metadata?.tags) {
      if (input.metadata.tags.length > PROJECT_CONSTANTS.TAGS.MAX_COUNT) {
        errors.push(`Cannot have more than ${PROJECT_CONSTANTS.TAGS.MAX_COUNT} tags`);
        fieldErrors['metadata.tags'] = 'Too many tags';
      }

      for (const tag of input.metadata.tags) {
        if (tag.length > PROJECT_CONSTANTS.TAGS.MAX_LENGTH) {
          errors.push(`Tag "${tag}" exceeds ${PROJECT_CONSTANTS.TAGS.MAX_LENGTH} characters`);
          fieldErrors['metadata.tags'] = 'Tag too long';
        }
        if (!PROJECT_CONSTANTS.TAGS.PATTERN.test(tag)) {
          errors.push(`Tag "${tag}" contains invalid characters`);
          fieldErrors['metadata.tags'] = 'Invalid tag characters';
        }
      }
    }

    // Validate ID format if provided
    if (input.id && !PROJECT_CONSTANTS.ID.PATTERN.test(input.id)) {
      errors.push('Invalid project ID format (must be UUID)');
      fieldErrors.id = 'Invalid UUID format';
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      fieldErrors: Object.keys(fieldErrors).length > 0 ? fieldErrors : undefined
    };
  }

  /**
   * Validate complete project object
   */
  public validateProject(project: Partial<IProject>): ProjectValidationResult {
    if (!isProject(project)) {
      return {
        isValid: false,
        errors: ['Invalid project structure'],
        fieldErrors: { _: 'Object is not a valid IProject' }
      };
    }

    return this.validateProjectInput(project as ProjectCreateInput);
  }

  // =============================================================================
  // FILE PERSISTENCE
  // =============================================================================

  /**
   * Save project to JSON file
   */
  private async saveProjectToFile(project: IProject): Promise<void> {
    const filePath = this.getProjectFilePath(project.id);

    // Serialize with Date objects as ISO strings
    const serialized = this.serializeProject(project);
    const content = JSON.stringify(serialized, null, 2);

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(filePath, encoder.encode(content));
  }

  /**
   * Load project from JSON file
   */
  private async loadProjectFromFile(projectId: string): Promise<IProject | undefined> {
    const filePath = this.getProjectFilePath(projectId);

    try {
      const content = await vscode.workspace.fs.readFile(filePath);
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(content));

      return this.deserializeProject(json);
    } catch (error) {
      if ((error as any).code === 'FileNotFound') {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Get file path for a project
   */
  private getProjectFilePath(projectId: string): vscode.Uri {
    return vscode.Uri.joinPath(this.projectsDir, `${projectId}.json`);
  }

  /**
   * Check if project file exists
   */
  private async projectExists(projectId: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.getProjectFilePath(projectId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Serialize project for JSON storage (convert Dates to strings)
   */
  private serializeProject(project: IProject): any {
    return {
      ...project,
      metadata: {
        ...project.metadata,
        createdAt: project.metadata.createdAt.toISOString(),
        updatedAt: project.metadata.updatedAt.toISOString()
      }
    };
  }

  /**
   * Deserialize project from JSON storage (convert strings to Dates)
   */
  private deserializeProject(json: any): IProject {
    return {
      ...json,
      metadata: {
        ...json.metadata,
        createdAt: new Date(json.metadata.createdAt),
        updatedAt: new Date(json.metadata.updatedAt)
      }
    };
  }

  /**
   * Create backup of project before destructive operation
   */
  private async backupProject(project: IProject): Promise<void> {
    const backupDir = vscode.Uri.joinPath(this.projectsDir, '.backups');
    await vscode.workspace.fs.createDirectory(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = vscode.Uri.joinPath(
      backupDir,
      `${project.id}_${timestamp}.json`
    );

    const serialized = this.serializeProject(project);
    const content = JSON.stringify(serialized, null, 2);

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(backupFile, encoder.encode(content));
  }

  // =============================================================================
  // INDEX MANAGEMENT
  // =============================================================================

  /**
   * Load or create project index
   */
  private async loadIndex(): Promise<ProjectIndex> {
    if (this.indexCache) {
      return this.indexCache;
    }

    try {
      const content = await vscode.workspace.fs.readFile(this.indexFile);
      const decoder = new TextDecoder();
      this.indexCache = JSON.parse(decoder.decode(content));
      return this.indexCache!;
    } catch (error) {
      // Index doesn't exist or is corrupted - rebuild
      if (this.config.autoRebuildIndex) {
        this.config.logger?.warn('Project index missing or corrupted, rebuilding...');
        return await this.rebuildIndex();
      } else {
        // Create empty index
        this.indexCache = {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          projects: {}
        };
        await this.saveIndex();
        return this.indexCache;
      }
    }
  }

  /**
   * Save index to file
   */
  private async saveIndex(): Promise<void> {
    if (!this.indexCache) {
      return;
    }

    this.indexCache.lastUpdated = new Date().toISOString();
    const content = JSON.stringify(this.indexCache, null, 2);

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(this.indexFile, encoder.encode(content));
  }

  /**
   * Update index with project information
   */
  private async updateIndex(project: IProject): Promise<void> {
    const index = await this.loadIndex();

    index.projects[project.id] = {
      id: project.id,
      name: project.name,
      type: project.type,
      status: project.status,
      updatedAt: project.metadata.updatedAt.toISOString()
    };

    await this.saveIndex();
  }

  /**
   * Remove project from index
   */
  private async removeFromIndex(projectId: string): Promise<void> {
    const index = await this.loadIndex();
    delete index.projects[projectId];
    await this.saveIndex();
  }

  /**
   * Rebuild index from project files
   */
  public async rebuildIndex(): Promise<ProjectIndex> {
    this.config.logger?.info('Rebuilding project index...');

    const newIndex: ProjectIndex = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      projects: {}
    };

    try {
      // Read all files in projects directory
      const files = await vscode.workspace.fs.readDirectory(this.projectsDir);

      for (const [filename, fileType] of files) {
        if (fileType === vscode.FileType.File && filename.endsWith('.json') && filename !== 'projects-index.json') {
          const projectId = filename.replace('.json', '');
          const project = await this.loadProjectFromFile(projectId);

          if (project) {
            newIndex.projects[project.id] = {
              id: project.id,
              name: project.name,
              type: project.type,
              status: project.status,
              updatedAt: project.metadata.updatedAt.toISOString()
            };
          }
        }
      }

      this.indexCache = newIndex;
      await this.saveIndex();

      this.config.logger?.info('Index rebuilt successfully', {
        projectCount: Object.keys(newIndex.projects).length
      });

      return newIndex;
    } catch (error) {
      this.config.logger?.error('Failed to rebuild index', error);
      throw error;
    }
  }

  // =============================================================================
  // FILTERING AND SORTING
  // =============================================================================

  /**
   * Apply query filters to project list
   */
  private applyFilters(projects: IProject[], filters?: ProjectQueryFilters): IProject[] {
    if (!filters) {
      return projects;
    }

    return projects.filter(project => {
      // Filter by type
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        if (!types.includes(project.type)) {
          return false;
        }
      }

      // Filter by status
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(project.status)) {
          return false;
        }
      }

      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag =>
          project.metadata.tags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Filter by search query
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesName = project.name.toLowerCase().includes(query);
        const matchesDescription = project.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply sorting to project list
   */
  private applySorting(projects: IProject[], filters?: ProjectQueryFilters): IProject[] {
    if (!filters?.sortBy) {
      return projects;
    }

    const direction = filters.sortDirection === 'desc' ? -1 : 1;

    return [...projects].sort((a, b) => {
      let comparison = 0;

      switch (filters.sortBy) {
        case 'name':
          comparison = a.name.localeCompare(b.name);
          break;
        case 'createdAt':
          comparison = a.createdAt.getTime() - b.createdAt.getTime();
          break;
        case 'updatedAt':
          comparison = a.updatedAt.getTime() - b.updatedAt.getTime();
          break;
      }

      return comparison * direction;
    });
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
  public async dispose(): Promise<void> {
    if (this._isDisposed) {
      return;
    }

    this.config.logger?.info('Disposing ProjectService');

    // Save index one final time
    try {
      await this.saveIndex();
    } catch (error) {
      this.config.logger?.error('Failed to save index during disposal', error);
    }

    // Clear caches
    this.projectCache.clear();
    this.indexCache = null;
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
    throw new Error('ProjectService not initialized. Call ProjectService.getInstance(workspaceUri) first.');
  }
  return instance;
}

/**
 * Initialize and get ProjectService singleton
 */
export async function initializeProjectService(
  workspaceUri: vscode.Uri,
  config?: ProjectServiceConfig
): Promise<ProjectService> {
  const service = ProjectService.getInstance(workspaceUri, config);
  await service.initialize();
  return service;
}

/**
 * Dispose ProjectService singleton
 */
export async function disposeProjectService(): Promise<void> {
  ProjectService.disposeInstance();
}
