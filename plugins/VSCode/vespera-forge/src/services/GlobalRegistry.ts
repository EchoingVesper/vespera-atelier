/**
 * GlobalRegistry - Platform-specific path detection for global Vespera directory
 * Phase 17 Task B1 - Global registry storage architecture
 *
 * Detects the correct global Vespera directory path based on the user's operating system.
 * The global registry exists outside any workspace and tracks all projects across all workspaces.
 *
 * Platform-specific locations:
 * - Windows: %APPDATA%\Vespera (e.g., C:\Users\username\AppData\Roaming\Vespera)
 * - macOS: ~/Library/Application Support/Vespera (e.g., /Users/username/Library/Application Support/Vespera)
 * - Linux: ~/.local/share/vespera (XDG standard) or ~/.vespera (fallback)
 *
 * Based on: docs/development/decisions/ADR-016-global-registry-storage.md
 */

import * as os from 'os';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Platform identifier type
 */
export type Platform = 'windows' | 'macos' | 'linux' | 'unknown';

/**
 * Environment variable name for registry path override
 * Users can set this to customize the global Vespera directory location
 */
const REGISTRY_PATH_ENV_VAR = 'VESPERA_REGISTRY_PATH';

/**
 * Get platform name for logging/debugging
 * @returns Platform identifier: 'windows' | 'macos' | 'linux' | 'unknown'
 *
 * @example
 * ```typescript
 * const platform = getPlatform();
 * console.log(`Running on ${platform}`); // "Running on linux"
 * ```
 */
export function getPlatform(): Platform {
  const osPlatform = os.platform();

  switch (osPlatform) {
    case 'win32':
      return 'windows';
    case 'darwin':
      return 'macos';
    case 'linux':
      return 'linux';
    default:
      return 'unknown';
  }
}

/**
 * Get the platform-specific global Vespera directory path
 *
 * This function detects the appropriate directory for storing global Vespera data
 * based on the operating system, following platform conventions:
 *
 * - **Windows**: Uses %APPDATA% environment variable
 * - **macOS**: Uses ~/Library/Application Support (standard macOS location)
 * - **Linux**: Uses XDG_DATA_HOME or ~/.local/share (XDG Base Directory Specification)
 *
 * Users can override the default location by setting the VESPERA_REGISTRY_PATH
 * environment variable.
 *
 * @returns Absolute path to the global Vespera directory (without trailing slash)
 *
 * @example
 * ```typescript
 * // On Windows: C:\Users\username\AppData\Roaming\Vespera
 * // On macOS: /Users/username/Library/Application Support/Vespera
 * // On Linux: /home/username/.local/share/vespera
 * const globalDir = getGlobalVesperaPath();
 * ```
 *
 * @example
 * ```typescript
 * // With environment variable override
 * process.env.VESPERA_REGISTRY_PATH = '/custom/path/to/vespera';
 * const globalDir = getGlobalVesperaPath();
 * // Returns: /custom/path/to/vespera
 * ```
 */
export function getGlobalVesperaPath(): string {
  // Check for environment variable override first
  const override = process.env[REGISTRY_PATH_ENV_VAR];
  if (override && override.trim() !== '') {
    // Normalize the path (resolve to absolute, remove trailing slashes)
    return path.normalize(override.trim());
  }

  const platform = getPlatform();
  const homedir = os.homedir();

  switch (platform) {
    case 'windows': {
      // Windows: Use %APPDATA% (Roaming profile data)
      // Fallback to %USERPROFILE%\AppData\Roaming if APPDATA not set
      const appData = process.env['APPDATA'] || path.join(homedir, 'AppData', 'Roaming');
      return path.join(appData, 'Vespera');
    }

    case 'macos': {
      // macOS: Use ~/Library/Application Support (standard macOS location)
      return path.join(homedir, 'Library', 'Application Support', 'Vespera');
    }

    case 'linux': {
      // Linux: Follow XDG Base Directory Specification
      // Use $XDG_DATA_HOME or fallback to ~/.local/share
      const xdgDataHome = process.env['XDG_DATA_HOME'] || path.join(homedir, '.local', 'share');
      return path.join(xdgDataHome, 'vespera');
    }

    case 'unknown':
    default: {
      // Unknown platform: fallback to ~/.vespera
      // This provides a reasonable default for unsupported platforms
      return path.join(homedir, '.vespera');
    }
  }
}

/**
 * Get the global projects registry file path
 *
 * The projects registry is a JSON file that tracks all projects across all workspaces.
 * It stores project metadata, workspace paths, and recent access information.
 *
 * @returns Absolute path to projects-registry.json
 *
 * @example
 * ```typescript
 * const registryPath = getProjectsRegistryPath();
 * // On macOS: /Users/username/Library/Application Support/Vespera/projects-registry.json
 * // On Linux: /home/username/.local/share/vespera/projects-registry.json
 * // On Windows: C:\Users\username\AppData\Roaming\Vespera\projects-registry.json
 * ```
 */
export function getProjectsRegistryPath(): string {
  const globalDir = getGlobalVesperaPath();
  return path.join(globalDir, 'projects-registry.json');
}

/**
 * Get the global templates directory path
 *
 * Global templates are shared across all workspaces and projects.
 *
 * @returns Absolute path to global templates directory
 *
 * @example
 * ```typescript
 * const templatesPath = getGlobalTemplatesPath();
 * // e.g., /Users/username/Library/Application Support/Vespera/templates
 * ```
 */
export function getGlobalTemplatesPath(): string {
  const globalDir = getGlobalVesperaPath();
  return path.join(globalDir, 'templates');
}

/**
 * Get the global config file path
 *
 * Global config stores application-wide settings.
 *
 * @returns Absolute path to config.json
 *
 * @example
 * ```typescript
 * const configPath = getGlobalConfigPath();
 * // e.g., /Users/username/Library/Application Support/Vespera/config.json
 * ```
 */
export function getGlobalConfigPath(): string {
  const globalDir = getGlobalVesperaPath();
  return path.join(globalDir, 'config.json');
}

/**
 * Get the global cache directory path
 *
 * Cache directory stores temporary data like template indexes.
 *
 * @returns Absolute path to cache directory
 *
 * @example
 * ```typescript
 * const cachePath = getGlobalCachePath();
 * // e.g., /Users/username/Library/Application Support/Vespera/cache
 * ```
 */
export function getGlobalCachePath(): string {
  const globalDir = getGlobalVesperaPath();
  return path.join(globalDir, 'cache');
}

/**
 * Get the global logs directory path
 *
 * Logs directory stores application-wide logging output.
 *
 * @returns Absolute path to logs directory
 *
 * @example
 * ```typescript
 * const logsPath = getGlobalLogsPath();
 * // e.g., /Users/username/Library/Application Support/Vespera/logs
 * ```
 */
export function getGlobalLogsPath(): string {
  const globalDir = getGlobalVesperaPath();
  return path.join(globalDir, 'logs');
}

/**
 * Entry in the global projects registry
 *
 * Each entry represents a project tracked by Vespera across any workspace.
 * The registry provides fast project discovery without filesystem scanning.
 */
export interface ProjectRegistryEntry {
  /** Project unique identifier (UUID) */
  id: string;

  /** Human-readable project name */
  name: string;

  /** Absolute path to workspace root containing this project */
  workspace_path: string;

  /** Project type (e.g., 'fiction', 'research', 'software') */
  project_type: string;

  /** ISO 8601 timestamp of last project open */
  last_opened: string;

  /** Currently active context ID (optional) */
  active_context_id?: string;

  /** ISO 8601 timestamp of project creation */
  created_at: string;

  /** ISO 8601 timestamp of last update */
  updated_at: string;
}

/**
 * Global projects registry structure
 *
 * The registry tracks all Vespera projects across all workspaces on the system.
 * It enables:
 * - Fast project discovery without filesystem scanning
 * - Recent projects list
 * - Cross-workspace project relationships
 * - Last-opened tracking for UI
 *
 * Stored at: ~/.vespera/projects-registry.json (or platform equivalent)
 */
export interface ProjectsRegistry {
  /** Schema version for migration support */
  version: string;

  /** ISO 8601 timestamp of last registry update */
  last_updated: string;

  /** Map of project ID to project entry */
  projects: Record<string, ProjectRegistryEntry>;
}

/**
 * Create an empty registry with current timestamp
 *
 * Used when initializing a new Vespera installation or when
 * the registry doesn't exist yet.
 *
 * @returns New empty registry with version 1.0.0
 *
 * @example
 * ```typescript
 * const registry = createEmptyRegistry();
 * // {
 * //   version: "1.0.0",
 * //   last_updated: "2025-10-25T12:34:56.789Z",
 * //   projects: {}
 * // }
 * ```
 */
export function createEmptyRegistry(): ProjectsRegistry {
  return {
    version: '1.0.0',
    last_updated: new Date().toISOString(),
    projects: {}
  };
}

/**
 * Validate registry structure
 *
 * Checks that the data conforms to the ProjectsRegistry interface.
 * Used to detect corrupted or invalid registry files.
 *
 * @param data Unknown data to validate
 * @returns true if valid ProjectsRegistry, false otherwise
 *
 * @example
 * ```typescript
 * const data = JSON.parse(fileContent);
 * if (!validateRegistry(data)) {
 *   throw new Error('Invalid registry structure');
 * }
 * ```
 */
export function validateRegistry(data: unknown): data is ProjectsRegistry {
  // Check structure
  if (!data || typeof data !== 'object') {
    return false;
  }

  const registry = data as any;

  // Check required fields
  if (typeof registry.version !== 'string') {
    return false;
  }
  if (typeof registry.last_updated !== 'string') {
    return false;
  }
  if (!registry.projects || typeof registry.projects !== 'object') {
    return false;
  }

  // Validate each project entry
  for (const entry of Object.values(registry.projects)) {
    if (!validateProjectEntry(entry)) {
      return false;
    }
  }

  return true;
}

/**
 * Validate a single project registry entry
 *
 * @param entry Unknown data to validate as ProjectRegistryEntry
 * @returns true if valid entry, false otherwise
 */
function validateProjectEntry(entry: unknown): entry is ProjectRegistryEntry {
  if (!entry || typeof entry !== 'object') {
    return false;
  }

  const project = entry as any;

  // Check required string fields
  if (typeof project.id !== 'string') {
    return false;
  }
  if (typeof project.name !== 'string') {
    return false;
  }
  if (typeof project.workspace_path !== 'string') {
    return false;
  }
  if (typeof project.project_type !== 'string') {
    return false;
  }
  if (typeof project.last_opened !== 'string') {
    return false;
  }
  if (typeof project.created_at !== 'string') {
    return false;
  }
  if (typeof project.updated_at !== 'string') {
    return false;
  }

  // Check optional fields
  if (project.active_context_id !== undefined && typeof project.active_context_id !== 'string') {
    return false;
  }

  return true;
}

/**
 * Load the global projects registry
 *
 * Reads the registry file from disk and validates its structure.
 * Returns null if the file doesn't exist (not an error - registry not initialized yet).
 *
 * @returns ProjectsRegistry or null if doesn't exist
 * @throws Error if registry is corrupted or invalid
 *
 * @example
 * ```typescript
 * // Load existing registry or create new
 * let registry = await loadRegistry();
 * if (!registry) {
 *   registry = createEmptyRegistry();
 *   await saveRegistry(registry);
 * }
 * ```
 */
export async function loadRegistry(): Promise<ProjectsRegistry | null> {
  const registryPath = getProjectsRegistryPath();
  const uri = vscode.Uri.file(registryPath);

  try {
    // Read file content
    const content = await vscode.workspace.fs.readFile(uri);
    const decoder = new TextDecoder('utf-8');
    const json = decoder.decode(content);

    // Parse JSON
    let data: unknown;
    try {
      data = JSON.parse(json);
    } catch (parseError) {
      throw new Error(`Registry corrupted: Invalid JSON - ${parseError instanceof Error ? parseError.message : String(parseError)}`);
    }

    // Validate structure
    if (!validateRegistry(data)) {
      throw new Error('Registry validation failed: Invalid schema structure');
    }

    return data;
  } catch (error) {
    // File not found is OK - registry doesn't exist yet
    if (error instanceof vscode.FileSystemError && error.code === 'FileNotFound') {
      return null;
    }

    // Re-throw validation/corruption errors
    if (error instanceof Error && (
      error.message.includes('Registry corrupted') ||
      error.message.includes('Registry validation failed')
    )) {
      throw error;
    }

    // Other filesystem errors
    throw new Error(`Failed to load registry: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Save the global projects registry
 *
 * Writes the registry to disk with atomic write operation (write to temp, then rename).
 * Creates parent directories if they don't exist.
 * Pretty-prints JSON with 2-space indentation for readability.
 *
 * @param registry The registry to save
 * @throws Error if unable to write
 *
 * @example
 * ```typescript
 * const registry = createEmptyRegistry();
 * registry.projects['proj-123'] = {
 *   id: 'proj-123',
 *   name: 'My Project',
 *   workspace_path: '/path/to/workspace',
 *   project_type: 'fiction',
 *   last_opened: new Date().toISOString(),
 *   created_at: new Date().toISOString(),
 *   updated_at: new Date().toISOString()
 * };
 * await saveRegistry(registry);
 * ```
 */
export async function saveRegistry(registry: ProjectsRegistry): Promise<void> {
  const registryPath = getProjectsRegistryPath();
  const registryDir = path.dirname(registryPath);

  try {
    // Create directory if it doesn't exist
    const dirUri = vscode.Uri.file(registryDir);
    try {
      await vscode.workspace.fs.createDirectory(dirUri);
    } catch (error) {
      // Directory might already exist, that's OK
      if (!(error instanceof vscode.FileSystemError && error.code === 'FileExists')) {
        throw error;
      }
    }

    // Update last_updated timestamp
    registry.last_updated = new Date().toISOString();

    // Serialize to JSON (pretty-printed)
    const json = JSON.stringify(registry, null, 2);
    const encoder = new TextEncoder();
    const content = encoder.encode(json);

    // Atomic write: write to temp file, then rename
    const tempPath = registryPath + '.tmp';
    const tempUri = vscode.Uri.file(tempPath);
    const finalUri = vscode.Uri.file(registryPath);

    // Write to temp file
    await vscode.workspace.fs.writeFile(tempUri, content);

    // Rename to final location (atomic on most filesystems)
    try {
      await vscode.workspace.fs.rename(tempUri, finalUri, { overwrite: true });
    } catch (error) {
      // Clean up temp file on failure
      try {
        await vscode.workspace.fs.delete(tempUri);
      } catch (_cleanupError) {
        // Ignore cleanup errors
      }
      throw error;
    }
  } catch (error) {
    throw new Error(`Failed to save registry: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// =============================================================================
// REGISTRY SYNC OPERATIONS
// =============================================================================
// Phase 17 Task B3 - Sync workspace projects with global registry

/**
 * Sync a project to the global registry
 *
 * Creates or updates the project entry in the global registry.
 * This should be called whenever a project is created or updated in workspace storage.
 *
 * Sync strategy:
 * - Last-write-wins: Registry timestamp always uses current time on update
 * - No merge: Complete replacement of entry on sync
 * - Atomic operation: Loads registry, updates entry, saves back
 *
 * @param project The project to sync (from workspace)
 * @param workspacePath Absolute path to workspace root
 * @throws Error if unable to load or save registry
 *
 * @example
 * ```typescript
 * import { syncProjectToRegistry } from './GlobalRegistry';
 *
 * // When creating/updating a project
 * const project = await projectService.createProject({ name: 'My Novel', type: 'fiction' });
 * await syncProjectToRegistry(project, workspaceRoot);
 * ```
 *
 * Integration points (to be implemented in Task D):
 * - ProjectService.createProject() should call syncProjectToRegistry()
 * - ProjectService.updateProject() should call syncProjectToRegistry()
 */
export async function syncProjectToRegistry(
  project: import('../types/project').IProject,
  workspacePath: string
): Promise<void> {
  try {
    // Load registry (or create empty)
    let registry = await loadRegistry();
    if (!registry) {
      registry = createEmptyRegistry();
    }

    // Create/update entry
    // Note: We explicitly convert Date objects to ISO strings for registry storage
    // TODO (Task D): Get active_context_id from project context when context system is implemented
    registry.projects[project.id] = {
      id: project.id,
      name: project.name,
      workspace_path: workspacePath,
      project_type: project.type,
      last_opened: new Date().toISOString(),
      active_context_id: undefined, // TODO: Will be populated from project context in Task D
      created_at: project.metadata.createdAt.toISOString(),
      updated_at: new Date().toISOString()
    };

    // Save back to disk
    await saveRegistry(registry);

    // Log for debugging
    console.log(`[GlobalRegistry] Synced project ${project.id} (${project.name}) to registry`);
  } catch (error) {
    throw new Error(`Failed to sync project to registry: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Remove a project from the global registry
 *
 * Removes the project entry from the registry when a project is deleted from workspace.
 * If the project doesn't exist in the registry, this is a no-op (doesn't throw error).
 *
 * @param projectId The project ID to remove
 * @throws Error if unable to load or save registry
 *
 * @example
 * ```typescript
 * import { removeProjectFromRegistry } from './GlobalRegistry';
 *
 * // When deleting a project
 * await projectService.deleteProject('proj-123');
 * await removeProjectFromRegistry('proj-123');
 * ```
 *
 * Integration points (to be implemented in Task D):
 * - ProjectService.deleteProject() should call removeProjectFromRegistry()
 */
export async function removeProjectFromRegistry(projectId: string): Promise<void> {
  try {
    // Load registry
    let registry = await loadRegistry();

    // If no registry exists, nothing to remove
    if (!registry) {
      return;
    }

    // If project doesn't exist, nothing to remove (no error)
    if (!registry.projects[projectId]) {
      console.log(`[GlobalRegistry] Project ${projectId} not in registry, nothing to remove`);
      return;
    }

    // Remove project entry
    delete registry.projects[projectId];

    // Save back to disk
    await saveRegistry(registry);

    console.log(`[GlobalRegistry] Removed project ${projectId} from registry`);
  } catch (error) {
    throw new Error(`Failed to remove project from registry: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Update last_opened timestamp for a project
 *
 * Updates the last_opened timestamp for a project when user opens/activates it.
 * This is used to track recent projects for "Recent Projects" UI.
 *
 * If the project doesn't exist in registry, this is a no-op (doesn't throw error).
 *
 * @param projectId The project ID
 * @throws Error if unable to load or save registry
 *
 * @example
 * ```typescript
 * import { updateLastOpened } from './GlobalRegistry';
 *
 * // When user opens a project
 * await projectService.setActiveProject('proj-123');
 * await updateLastOpened('proj-123');
 * ```
 *
 * Integration points (to be implemented in Task D):
 * - ProjectService.setActiveProject() should call updateLastOpened()
 */
export async function updateLastOpened(projectId: string): Promise<void> {
  try {
    // Load registry
    let registry = await loadRegistry();

    // If no registry exists, nothing to update
    if (!registry) {
      console.log(`[GlobalRegistry] No registry exists, cannot update last_opened for ${projectId}`);
      return;
    }

    // If project doesn't exist, nothing to update (no error)
    if (!registry.projects[projectId]) {
      console.log(`[GlobalRegistry] Project ${projectId} not in registry, cannot update last_opened`);
      return;
    }

    // Update last_opened timestamp
    registry.projects[projectId].last_opened = new Date().toISOString();

    // Save back to disk
    await saveRegistry(registry);

    console.log(`[GlobalRegistry] Updated last_opened for project ${projectId}`);
  } catch (error) {
    throw new Error(`Failed to update last_opened: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Get all projects from registry sorted by last_opened (most recent first)
 *
 * Returns projects sorted by last access time, useful for "Recent Projects" UI.
 * Optionally limit the number of results returned.
 *
 * @param limit Optional limit on number of results (default: no limit)
 * @returns Array of project registry entries sorted by last_opened (descending)
 *
 * @example
 * ```typescript
 * import { getRecentProjects } from './GlobalRegistry';
 *
 * // Show recent projects in UI
 * const recentProjects = await getRecentProjects(10);
 * console.log('Recent:', recentProjects.map(p => p.name));
 * ```
 */
export async function getRecentProjects(limit?: number): Promise<ProjectRegistryEntry[]> {
  try {
    // Load registry
    const registry = await loadRegistry();

    // If no registry, return empty array
    if (!registry) {
      return [];
    }

    // Convert projects object to array
    const projectsArray = Object.values(registry.projects);

    // Sort by last_opened (most recent first)
    projectsArray.sort((a, b) => {
      const dateA = new Date(a.last_opened).getTime();
      const dateB = new Date(b.last_opened).getTime();
      return dateB - dateA; // Descending order (most recent first)
    });

    // Apply limit if specified
    if (limit !== undefined && limit > 0) {
      return projectsArray.slice(0, limit);
    }

    return projectsArray;
  } catch (error) {
    throw new Error(`Failed to get recent projects: ${error instanceof Error ? error.message : String(error)}`);
  }
}

/**
 * Find project in registry by workspace path
 *
 * Returns all projects that belong to the specified workspace.
 * Useful for discovering which projects exist in a workspace.
 *
 * @param workspacePath Absolute path to workspace
 * @returns Array of projects in that workspace
 *
 * @example
 * ```typescript
 * import { findProjectsByWorkspace } from './GlobalRegistry';
 *
 * // Find all projects in current workspace
 * const workspacePath = vscode.workspace.workspaceFolders?.[0]?.uri.fsPath;
 * if (workspacePath) {
 *   const projects = await findProjectsByWorkspace(workspacePath);
 *   console.log(`Found ${projects.length} projects in workspace`);
 * }
 * ```
 */
export async function findProjectsByWorkspace(workspacePath: string): Promise<ProjectRegistryEntry[]> {
  try {
    // Load registry
    const registry = await loadRegistry();

    // If no registry, return empty array
    if (!registry) {
      return [];
    }

    // Filter projects by workspace_path
    // Note: We normalize paths to handle trailing slashes and path separators
    const normalizedSearchPath = path.normalize(workspacePath);

    const projectsArray = Object.values(registry.projects).filter(project => {
      const normalizedProjectPath = path.normalize(project.workspace_path);
      return normalizedProjectPath === normalizedSearchPath;
    });

    return projectsArray;
  } catch (error) {
    throw new Error(`Failed to find projects by workspace: ${error instanceof Error ? error.message : String(error)}`);
  }
}

// =============================================================================
// REGISTRY INITIALIZATION
// =============================================================================
// Phase 17 Task B4 - Initialize global registry directory structure

/**
 * Initialize the global Vespera directory structure
 *
 * Creates directories and empty registry if they don't exist.
 * This function is idempotent - safe to call multiple times.
 *
 * Directory structure created:
 * ```
 * ~/.vespera/                              (or platform-specific equivalent)
 * ├── projects-registry.json               (empty registry file)
 * ├── templates/                           (for future global template storage)
 * ├── cache/                               (for cached data)
 * └── logs/                                (for extension logs)
 * ```
 *
 * @returns true if initialization was performed, false if already initialized
 *
 * @example
 * ```typescript
 * import { initializeGlobalRegistry } from './services/GlobalRegistry';
 *
 * // In extension activation
 * const wasInitialized = await initializeGlobalRegistry();
 * if (wasInitialized) {
 *   console.log('Global Vespera directory initialized');
 * } else {
 *   console.log('Global Vespera directory already exists');
 * }
 * ```
 *
 * Integration points (to be implemented in extension.ts):
 * ```typescript
 * // In extension.ts activate() function:
 * import { initializeGlobalRegistry } from './services/GlobalRegistry';
 *
 * export async function activate(context: vscode.ExtensionContext) {
 *   // Initialize global registry on extension activation
 *   await initializeGlobalRegistry();
 *
 *   // ... rest of extension activation
 * }
 * ```
 */
export async function initializeGlobalRegistry(): Promise<boolean> {
  try {
    const globalPath = getGlobalVesperaPath();
    const uri = vscode.Uri.file(globalPath);

    // Check if directory exists
    let directoryExists = false;
    try {
      await vscode.workspace.fs.stat(uri);
      directoryExists = true;
    } catch (error) {
      // Directory doesn't exist - will be created
      directoryExists = false;
    }

    if (directoryExists) {
      // Directory exists, check if registry exists
      const registryPath = getProjectsRegistryPath();
      const registryUri = vscode.Uri.file(registryPath);

      try {
        await vscode.workspace.fs.stat(registryUri);
        // Registry exists, already initialized
        return false;
      } catch {
        // Registry doesn't exist, create it
        const emptyRegistry = createEmptyRegistry();
        await saveRegistry(emptyRegistry);
        console.log(`[GlobalRegistry] Created projects registry at: ${registryPath}`);
        return true;
      }
    } else {
      // Directory doesn't exist, create everything
      await vscode.workspace.fs.createDirectory(uri);
      console.log(`[GlobalRegistry] Created global Vespera directory at: ${globalPath}`);

      // Create subdirectories
      const templatesUri = vscode.Uri.file(getGlobalTemplatesPath());
      const cacheUri = vscode.Uri.file(getGlobalCachePath());
      const logsUri = vscode.Uri.file(getGlobalLogsPath());

      await vscode.workspace.fs.createDirectory(templatesUri);
      console.log(`[GlobalRegistry] Created templates directory`);

      await vscode.workspace.fs.createDirectory(cacheUri);
      console.log(`[GlobalRegistry] Created cache directory`);

      await vscode.workspace.fs.createDirectory(logsUri);
      console.log(`[GlobalRegistry] Created logs directory`);

      // Create empty registry
      const emptyRegistry = createEmptyRegistry();
      await saveRegistry(emptyRegistry);
      console.log(`[GlobalRegistry] Created projects registry`);

      console.log(`[GlobalRegistry] Initialized global Vespera directory at: ${globalPath}`);
      return true;
    }
  } catch (error) {
    // Handle errors gracefully - log but don't crash extension
    const errorMessage = error instanceof Error ? error.message : String(error);

    // Check for permission errors
    if (errorMessage.includes('EACCES') || errorMessage.includes('permission')) {
      console.error(`[GlobalRegistry] Permission error initializing global directory: ${errorMessage}`);
      console.error(`[GlobalRegistry] Please check file system permissions for Vespera directories`);
    }
    // Check for disk full errors
    else if (errorMessage.includes('ENOSPC') || errorMessage.includes('space')) {
      console.error(`[GlobalRegistry] Disk full error initializing global directory: ${errorMessage}`);
      console.error(`[GlobalRegistry] Please free up disk space and restart VS Code`);
    }
    // Other errors
    else {
      console.error(`[GlobalRegistry] Error initializing global directory: ${errorMessage}`);
    }

    // Re-throw error for caller to handle
    throw new Error(`Failed to initialize global registry: ${errorMessage}`);
  }
}
