/**
 * ContextService - Core service for context management
 * Phase 17 - Workspace → Project → Context → Codex hierarchy
 *
 * Provides CRUD operations, validation, and file-based persistence for contexts.
 * Contexts are organizational lenses within projects - everything exists within a context.
 *
 * Based on: docs/architecture/core/PROJECT_CENTRIC_ARCHITECTURE.md (Phase 17 refactoring)
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
 * Context index structure for fast lookups
 */
interface ContextIndex {
  version: string;
  lastUpdated: string;
  contexts: Record<string, {
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
export interface ContextServiceConfig {
  /** Logger instance for debugging */
  logger?: VesperaLogger;

  /** Enable automatic index rebuilds on inconsistency */
  autoRebuildIndex?: boolean;

  /** Enable context backups before destructive operations */
  enableBackups?: boolean;
}

/**
 * ContextService - Manages context lifecycle and persistence
 *
 * Features:
 * - CRUD operations for contexts
 * - File-based persistence (.vespera/contexts/)
 * - Context validation
 * - Active context tracking
 * - Index management for fast listing
 */
export class ContextService implements DisposableResource {
  private static instance: ContextService | null = null;
  private readonly workspaceRoot: string;
  private readonly contextsDir: vscode.Uri;
  private readonly indexFile: vscode.Uri;
  private activeContextId: string | null = null;
  private contextCache: Map<string, IProject> = new Map();
  private indexCache: ContextIndex | null = null;
  private _isDisposed = false;
  private readonly config: ContextServiceConfig;

  private constructor(
    workspaceUri: vscode.Uri,
    config: ContextServiceConfig = {}
  ) {
    this.workspaceRoot = workspaceUri.fsPath;
    this.contextsDir = vscode.Uri.joinPath(workspaceUri, '.vespera', 'contexts');
    this.indexFile = vscode.Uri.joinPath(this.contextsDir, 'contexts-index.json');
    this.config = {
      autoRebuildIndex: true,
      enableBackups: true,
      ...config
    };

    this.config.logger?.debug('ContextService initialized', {
      workspaceRoot: this.workspaceRoot,
      contextsDir: this.contextsDir.fsPath
    });
  }

  /**
   * Get or create singleton instance
   */
  public static getInstance(
    workspaceUri?: vscode.Uri,
    config?: ContextServiceConfig
  ): ContextService {
    if (!ContextService.instance) {
      if (!workspaceUri) {
        throw new Error('ContextService requires workspaceUri for first initialization');
      }
      ContextService.instance = new ContextService(workspaceUri, config);
    }
    return ContextService.instance;
  }

  /**
   * Dispose singleton instance
   */
  public static disposeInstance(): void {
    if (ContextService.instance) {
      ContextService.instance.dispose();
      ContextService.instance = null;
    }
  }

  /**
   * Initialize the service - ensure directories exist and load index
   */
  public async initialize(): Promise<void> {
    if (this._isDisposed) {
      throw new Error('Cannot initialize disposed ContextService');
    }

    try {
      // Ensure .vespera/contexts directory exists
      await vscode.workspace.fs.createDirectory(this.contextsDir);

      // Load or create index
      await this.loadIndex();

      this.config.logger?.info('ContextService initialized successfully', {
        contextCount: Object.keys(this.indexCache?.contexts || {}).length
      });
    } catch (error) {
      this.config.logger?.error('Failed to initialize ContextService', error);
      throw error;
    }
  }

  // =============================================================================
  // CRUD OPERATIONS
  // =============================================================================

  /**
   * Create a new context
   */
  public async createContext(input: ProjectCreateInput): Promise<IProject> {
    if (this._isDisposed) {
      throw new Error('ContextService is disposed');
    }

    // Validate input
    const validation = this.validateContextInput(input);
    if (!validation.isValid) {
      throw new Error(`Invalid context input: ${validation.errors.join(', ')}`);
    }

    // Generate ID if not provided
    const id = input.id || uuidv4();

    // Check for duplicate ID
    if (await this.contextExists(id)) {
      throw new Error(`Context with ID ${id} already exists`);
    }

    // Create context object
    const now = new Date();
    const defaultMetadata = createDefaultProjectMetadata();

    const context: IProject = {
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
    await this.saveContextToFile(context);

    // Update cache and index
    this.contextCache.set(id, context);
    await this.updateIndex(context);

    this.config.logger?.info('Context created', { id, name: context.name, type: context.type });

    return context;
  }

  /**
   * Get context by ID
   */
  public async getContext(contextId: string): Promise<IProject | undefined> {
    if (this._isDisposed) {
      throw new Error('ContextService is disposed');
    }

    // Check cache first
    if (this.contextCache.has(contextId)) {
      return this.contextCache.get(contextId);
    }

    // Load from file
    try {
      const context = await this.loadContextFromFile(contextId);
      if (context) {
        this.contextCache.set(contextId, context);
      }
      return context;
    } catch (error) {
      this.config.logger?.error(`Failed to load context ${contextId}`, error);
      return undefined;
    }
  }

  /**
   * Update existing context
   */
  public async updateContext(
    contextId: string,
    updates: Partial<ProjectUpdateInput>
  ): Promise<IProject> {
    if (this._isDisposed) {
      throw new Error('ContextService is disposed');
    }

    // Load existing context
    const existing = await this.getContext(contextId);
    if (!existing) {
      throw new Error(`Context ${contextId} not found`);
    }

    // Create backup if enabled
    if (this.config.enableBackups) {
      await this.backupContext(existing);
    }

    // Merge updates
    const updated: IProject = {
      ...existing,
      ...updates,
      id: contextId, // Ensure ID doesn't change
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

    // Validate updated context
    const validation = this.validateContext(updated);
    if (!validation.isValid) {
      throw new Error(`Invalid context update: ${validation.errors.join(', ')}`);
    }

    // Persist changes
    await this.saveContextToFile(updated);

    // Update cache and index
    this.contextCache.set(contextId, updated);
    await this.updateIndex(updated);

    this.config.logger?.info('Context updated', { id: contextId });

    return updated;
  }

  /**
   * Delete context
   */
  public async deleteContext(contextId: string): Promise<boolean> {
    if (this._isDisposed) {
      throw new Error('ContextService is disposed');
    }

    const context = await this.getContext(contextId);
    if (!context) {
      return false;
    }

    // Create backup before deletion
    if (this.config.enableBackups) {
      await this.backupContext(context);
    }

    try {
      // Delete context file
      const contextFile = this.getContextFilePath(contextId);
      await vscode.workspace.fs.delete(contextFile);

      // Remove from cache and index
      this.contextCache.delete(contextId);
      await this.removeFromIndex(contextId);

      // Clear active context if this was it
      if (this.activeContextId === contextId) {
        this.activeContextId = null;
      }

      this.config.logger?.info('Context deleted', { id: contextId });

      return true;
    } catch (error) {
      this.config.logger?.error(`Failed to delete context ${contextId}`, error);
      return false;
    }
  }

  /**
   * List all contexts with optional filtering and sorting
   */
  public async listContexts(filters?: ProjectQueryFilters): Promise<IProject[]> {
    if (this._isDisposed) {
      throw new Error('ContextService is disposed');
    }

    // Load index to get list of context IDs
    const index = await this.loadIndex();
    const contextIds = Object.keys(index.contexts);

    // Load all contexts (TODO: optimize with pagination in Phase 17)
    const contexts: IProject[] = [];
    for (const id of contextIds) {
      const context = await this.getContext(id);
      if (context) {
        contexts.push(context);
      }
    }

    // Apply filters
    let filtered = this.applyFilters(contexts, filters);

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
   * Get lightweight context list items (for UI pickers)
   */
  public async listContextItems(filters?: ProjectQueryFilters): Promise<ProjectListItem[]> {
    const contexts = await this.listContexts(filters);
    return contexts.map(c => ({
      id: c.id,
      name: c.name,
      type: c.type,
      status: c.status,
      updatedAt: c.updatedAt,
      icon: c.metadata.icon,
      color: c.metadata.color
    }));
  }

  /**
   * Get context statistics
   */
  public async getStats(): Promise<ProjectStats> {
    const contexts = await this.listContexts();

    const stats: ProjectStats = {
      total: contexts.length,
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

    for (const context of contexts) {
      // Count by type
      stats.byType[context.type]++;

      // Count by status
      stats.byStatus[context.status]++;

      // Track most recent
      if (!mostRecent || context.updatedAt > mostRecent.updatedAt) {
        mostRecent = context;
      }

      // Track oldest
      if (!oldest || context.createdAt < oldest.createdAt) {
        oldest = context;
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
  // ACTIVE CONTEXT MANAGEMENT
  // =============================================================================

  /**
   * Set the active context (current working context)
   */
  public async setActiveContext(contextId: string): Promise<void> {
    if (this._isDisposed) {
      throw new Error('ContextService is disposed');
    }

    // Verify context exists
    const context = await this.getContext(contextId);
    if (!context) {
      throw new Error(`Cannot set active context: ${contextId} not found`);
    }

    this.activeContextId = contextId;
    this.config.logger?.debug('Active context set', { id: contextId, name: context.name });

    // TODO: Phase 17 - Emit event for listeners (Navigator, Template system, etc.)
  }

  /**
   * Get the currently active context
   */
  public getActiveContext(): IProject | undefined {
    if (this._isDisposed || !this.activeContextId) {
      return undefined;
    }

    return this.contextCache.get(this.activeContextId);
  }

  /**
   * Get active context ID
   */
  public getActiveContextId(): string | null {
    return this.activeContextId;
  }

  /**
   * Clear active context
   */
  public clearActiveContext(): void {
    this.activeContextId = null;
    this.config.logger?.debug('Active context cleared');
  }

  // =============================================================================
  // VALIDATION
  // =============================================================================

  /**
   * Validate context input for creation
   */
  private validateContextInput(input: ProjectCreateInput): ProjectValidationResult {
    const errors: string[] = [];
    const warnings: string[] = [];
    const fieldErrors: Record<string, string> = {};

    // Validate name
    if (!input.name || input.name.trim().length === 0) {
      errors.push('Context name is required');
      fieldErrors.name = 'Name cannot be empty';
    } else if (input.name.length < PROJECT_CONSTANTS.NAME.MIN_LENGTH) {
      errors.push(`Context name must be at least ${PROJECT_CONSTANTS.NAME.MIN_LENGTH} character`);
      fieldErrors.name = 'Name too short';
    } else if (input.name.length > PROJECT_CONSTANTS.NAME.MAX_LENGTH) {
      errors.push(`Context name cannot exceed ${PROJECT_CONSTANTS.NAME.MAX_LENGTH} characters`);
      fieldErrors.name = 'Name too long';
    } else if (!PROJECT_CONSTANTS.NAME.PATTERN.test(input.name)) {
      errors.push('Context name contains invalid characters');
      fieldErrors.name = 'Invalid characters in name';
    }

    // Validate type
    if (!input.type) {
      errors.push('Context type is required');
      fieldErrors.type = 'Type is required';
    } else if (!isProjectType(input.type)) {
      errors.push(`Invalid context type: ${input.type}`);
      fieldErrors.type = 'Invalid context type';
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
      errors.push('Invalid context ID format (must be UUID)');
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
   * Validate complete context object
   */
  public validateContext(context: Partial<IProject>): ProjectValidationResult {
    if (!isProject(context)) {
      return {
        isValid: false,
        errors: ['Invalid context structure'],
        fieldErrors: { _: 'Object is not a valid IProject' }
      };
    }

    return this.validateContextInput(context as ProjectCreateInput);
  }

  // =============================================================================
  // FILE PERSISTENCE
  // =============================================================================

  /**
   * Save context to JSON file
   */
  private async saveContextToFile(context: IProject): Promise<void> {
    const filePath = this.getContextFilePath(context.id);

    // Serialize with Date objects as ISO strings
    const serialized = this.serializeContext(context);
    const content = JSON.stringify(serialized, null, 2);

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(filePath, encoder.encode(content));
  }

  /**
   * Load context from JSON file
   */
  private async loadContextFromFile(contextId: string): Promise<IProject | undefined> {
    const filePath = this.getContextFilePath(contextId);

    try {
      const content = await vscode.workspace.fs.readFile(filePath);
      const decoder = new TextDecoder();
      const json = JSON.parse(decoder.decode(content));

      return this.deserializeContext(json);
    } catch (error) {
      if ((error as any).code === 'FileNotFound') {
        return undefined;
      }
      throw error;
    }
  }

  /**
   * Get file path for a context
   */
  private getContextFilePath(contextId: string): vscode.Uri {
    return vscode.Uri.joinPath(this.contextsDir, `context-${contextId}.json`);
  }

  /**
   * Check if context file exists
   */
  private async contextExists(contextId: string): Promise<boolean> {
    try {
      await vscode.workspace.fs.stat(this.getContextFilePath(contextId));
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Serialize context for JSON storage (convert Dates to strings)
   */
  private serializeContext(context: IProject): any {
    return {
      ...context,
      metadata: {
        ...context.metadata,
        createdAt: context.metadata.createdAt.toISOString(),
        updatedAt: context.metadata.updatedAt.toISOString()
      }
    };
  }

  /**
   * Deserialize context from JSON storage (convert strings to Dates)
   */
  private deserializeContext(json: any): IProject {
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
   * Create backup of context before destructive operation
   */
  private async backupContext(context: IProject): Promise<void> {
    const backupDir = vscode.Uri.joinPath(this.contextsDir, '.backups');
    await vscode.workspace.fs.createDirectory(backupDir);

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = vscode.Uri.joinPath(
      backupDir,
      `context-${context.id}_${timestamp}.json`
    );

    const serialized = this.serializeContext(context);
    const content = JSON.stringify(serialized, null, 2);

    const encoder = new TextEncoder();
    await vscode.workspace.fs.writeFile(backupFile, encoder.encode(content));
  }

  // =============================================================================
  // INDEX MANAGEMENT
  // =============================================================================

  /**
   * Load or create context index
   */
  private async loadIndex(): Promise<ContextIndex> {
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
        this.config.logger?.warn('Context index missing or corrupted, rebuilding...');
        return await this.rebuildIndex();
      } else {
        // Create empty index
        this.indexCache = {
          version: '1.0.0',
          lastUpdated: new Date().toISOString(),
          contexts: {}
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
   * Update index with context information
   */
  private async updateIndex(context: IProject): Promise<void> {
    const index = await this.loadIndex();

    index.contexts[context.id] = {
      id: context.id,
      name: context.name,
      type: context.type,
      status: context.status,
      updatedAt: context.metadata.updatedAt.toISOString()
    };

    await this.saveIndex();
  }

  /**
   * Remove context from index
   */
  private async removeFromIndex(contextId: string): Promise<void> {
    const index = await this.loadIndex();
    delete index.contexts[contextId];
    await this.saveIndex();
  }

  /**
   * Rebuild index from context files
   */
  public async rebuildIndex(): Promise<ContextIndex> {
    this.config.logger?.info('Rebuilding context index...');

    const newIndex: ContextIndex = {
      version: '1.0.0',
      lastUpdated: new Date().toISOString(),
      contexts: {}
    };

    try {
      // Read all files in contexts directory
      const files = await vscode.workspace.fs.readDirectory(this.contextsDir);

      for (const [filename, fileType] of files) {
        if (fileType === vscode.FileType.File && filename.endsWith('.json') && filename !== 'contexts-index.json') {
          const contextId = filename.replace('context-', '').replace('.json', '');
          const context = await this.loadContextFromFile(contextId);

          if (context) {
            newIndex.contexts[context.id] = {
              id: context.id,
              name: context.name,
              type: context.type,
              status: context.status,
              updatedAt: context.metadata.updatedAt.toISOString()
            };
          }
        }
      }

      this.indexCache = newIndex;
      await this.saveIndex();

      this.config.logger?.info('Index rebuilt successfully', {
        contextCount: Object.keys(newIndex.contexts).length
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
   * Apply query filters to context list
   */
  private applyFilters(contexts: IProject[], filters?: ProjectQueryFilters): IProject[] {
    if (!filters) {
      return contexts;
    }

    return contexts.filter(context => {
      // Filter by type
      if (filters.type) {
        const types = Array.isArray(filters.type) ? filters.type : [filters.type];
        if (!types.includes(context.type)) {
          return false;
        }
      }

      // Filter by status
      if (filters.status) {
        const statuses = Array.isArray(filters.status) ? filters.status : [filters.status];
        if (!statuses.includes(context.status)) {
          return false;
        }
      }

      // Filter by tags
      if (filters.tags && filters.tags.length > 0) {
        const hasMatchingTag = filters.tags.some(tag =>
          context.metadata.tags.includes(tag)
        );
        if (!hasMatchingTag) {
          return false;
        }
      }

      // Filter by search query
      if (filters.search) {
        const query = filters.search.toLowerCase();
        const matchesName = context.name.toLowerCase().includes(query);
        const matchesDescription = context.description?.toLowerCase().includes(query);
        if (!matchesName && !matchesDescription) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Apply sorting to context list
   */
  private applySorting(contexts: IProject[], filters?: ProjectQueryFilters): IProject[] {
    if (!filters?.sortBy) {
      return contexts;
    }

    const direction = filters.sortDirection === 'desc' ? -1 : 1;

    return [...contexts].sort((a, b) => {
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

    this.config.logger?.info('Disposing ContextService');

    // Save index one final time
    try {
      await this.saveIndex();
    } catch (error) {
      this.config.logger?.error('Failed to save index during disposal', error);
    }

    // Clear caches
    this.contextCache.clear();
    this.indexCache = null;
    this.activeContextId = null;

    this._isDisposed = true;
    this.config.logger?.debug('ContextService disposed');
  }
}

// =============================================================================
// SINGLETON ACCESS HELPERS
// =============================================================================

/**
 * Get the ContextService singleton instance
 * @throws Error if not initialized
 */
export function getContextService(): ContextService {
  const instance = ContextService.getInstance();
  if (!instance) {
    throw new Error('ContextService not initialized. Call ContextService.getInstance(workspaceUri) first.');
  }
  return instance;
}

/**
 * Initialize and get ContextService singleton
 */
export async function initializeContextService(
  workspaceUri: vscode.Uri,
  config?: ContextServiceConfig
): Promise<ContextService> {
  const service = ContextService.getInstance(workspaceUri, config);
  await service.initialize();
  return service;
}

/**
 * Dispose ContextService singleton
 */
export async function disposeContextService(): Promise<void> {
  ContextService.disposeInstance();
}
