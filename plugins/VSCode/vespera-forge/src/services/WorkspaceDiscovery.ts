/**
 * WorkspaceDiscovery - Vespera workspace detection and metadata loading
 * Phase 17 Cluster C - Discovery Algorithm
 *
 * Implements the discovery algorithm that finds Vespera workspaces by searching
 * for `.vespera/` directories in the current workspace or parent directories.
 *
 * Discovery flow:
 * 1. Check current workspace root for `.vespera/`
 * 2. Search up directory tree (max 5 levels)
 * 3. Check global registry for known projects
 * 4. Prompt to initialize new workspace if not found
 *
 * Based on: docs/development/decisions/ADR-016-global-registry-storage.md
 */

import * as fs from 'fs';
import * as path from 'path';
import * as vscode from 'vscode';

/**
 * Workspace metadata stored in `.vespera/workspace.json`
 */
export interface WorkspaceMetadata {
  /** Unique workspace identifier */
  id: string;
  /** Human-readable workspace name */
  name: string;
  /** Schema version for future migrations */
  version: string;
  /** ISO 8601 timestamp of workspace creation */
  created_at: string;
  /** Workspace-specific settings */
  settings: {
    /** Default project to activate on open */
    default_project_id?: string;
    /** Auto-sync with global registry */
    auto_sync: boolean;
    /** Path to workspace-local templates */
    template_path?: string;
    /** Enable RAG/vector search */
    enable_rag?: boolean;
    /** Enable graph database */
    enable_graph?: boolean;
  };
}

/**
 * Result of workspace discovery attempt
 */
export interface WorkspaceDiscoveryResult {
  /** Whether a workspace was found */
  found: boolean;
  /** Absolute path to `.vespera/` directory if found */
  vesperaPath?: string;
  /** Parsed workspace metadata if found */
  metadata?: WorkspaceMetadata;
  /** Error message if discovery failed */
  error?: string;
  /** How the workspace was discovered */
  discoveryMethod?: 'workspace-root' | 'tree-traversal' | 'registry' | 'none';
}

/**
 * Task C1: Find .vespera/ directory in current workspace
 *
 * Searches for a `.vespera/` directory in the current VS Code workspace root.
 * If found, loads and parses the `workspace.json` metadata file.
 *
 * @returns Discovery result with workspace path and metadata if found
 *
 * @example
 * ```typescript
 * const result = await findWorkspaceVespera();
 * if (result.found) {
 *   console.log(`Found workspace: ${result.metadata?.name}`);
 *   console.log(`Path: ${result.vesperaPath}`);
 * }
 * ```
 */
export async function findWorkspaceVespera(): Promise<WorkspaceDiscoveryResult> {
  // Get current workspace folder from VS Code
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return {
      found: false,
      error: 'No workspace folder open in VS Code',
      discoveryMethod: 'none'
    };
  }

  // Add null-safety check
  if (!workspaceFolders[0]) {
    return {
      found: false,
      vesperaPath: undefined,
      discoveryMethod: 'none'
    };
  }

  const workspaceRoot = workspaceFolders[0].uri.fsPath;
  const vesperaPath = path.join(workspaceRoot, '.vespera');

  // Check if .vespera/ directory exists
  try {
    const stats = await fs.promises.stat(vesperaPath);
    if (!stats.isDirectory()) {
      return {
        found: false,
        error: `.vespera exists but is not a directory: ${vesperaPath}`,
        discoveryMethod: 'workspace-root'
      };
    }
  } catch (err: any) {
    // Handle different error codes
    if (err.code === 'ENOENT') {
      // .vespera/ doesn't exist - this is normal, not an error
      return {
        found: false,
        discoveryMethod: 'workspace-root'
      };
    } else if (err.code === 'EACCES' || err.code === 'EPERM') {
      // Permission denied
      return {
        found: false,
        error: `Permission denied accessing ${vesperaPath}`,
        discoveryMethod: 'workspace-root'
      };
    } else {
      // Other filesystem errors
      return {
        found: false,
        error: `Error accessing ${vesperaPath}: ${err.message}`,
        discoveryMethod: 'workspace-root'
      };
    }
  }

  // .vespera/ exists - try to load workspace.json
  const workspaceJsonPath = path.join(vesperaPath, 'workspace.json');

  try {
    const workspaceJsonContent = await fs.promises.readFile(workspaceJsonPath, 'utf-8');
    const metadata = JSON.parse(workspaceJsonContent) as WorkspaceMetadata;

    // Validate metadata has required fields
    if (!metadata.id || !metadata.name || !metadata.version) {
      return {
        found: false,
        vesperaPath,
        error: `Invalid workspace.json: missing required fields (id, name, version)`,
        discoveryMethod: 'workspace-root'
      };
    }

    return {
      found: true,
      vesperaPath,
      metadata,
      discoveryMethod: 'workspace-root'
    };
  } catch (err: any) {
    // Handle errors loading/parsing workspace.json
    if (err.code === 'ENOENT') {
      return {
        found: false,
        vesperaPath,
        error: `workspace.json not found in ${vesperaPath}`,
        discoveryMethod: 'workspace-root'
      };
    } else if (err.code === 'EACCES' || err.code === 'EPERM') {
      return {
        found: false,
        vesperaPath,
        error: `Permission denied reading ${workspaceJsonPath}`,
        discoveryMethod: 'workspace-root'
      };
    } else if (err instanceof SyntaxError) {
      return {
        found: false,
        vesperaPath,
        error: `Invalid JSON in ${workspaceJsonPath}: ${err.message}`,
        discoveryMethod: 'workspace-root'
      };
    } else {
      return {
        found: false,
        vesperaPath,
        error: `Error loading workspace metadata: ${err.message}`,
        discoveryMethod: 'workspace-root'
      };
    }
  }
}

/**
 * Helper: Load workspace metadata from a .vespera/ directory path
 *
 * @param vesperaPath - Absolute path to .vespera/ directory
 * @returns Workspace metadata if valid, null if invalid or error
 */
async function loadWorkspaceMetadata(vesperaPath: string): Promise<WorkspaceMetadata | null> {
  try {
    const workspaceJsonPath = path.join(vesperaPath, 'workspace.json');
    const content = await fs.promises.readFile(workspaceJsonPath, 'utf-8');
    const metadata = JSON.parse(content) as WorkspaceMetadata;

    // Validate required fields
    if (!metadata.id || !metadata.name || !metadata.version) {
      return null;
    }

    return metadata;
  } catch {
    // Return null on any error (file not found, permission denied, invalid JSON, etc.)
    return null;
  }
}

/**
 * Task C2: Search up directory tree for .vespera/ directory
 *
 * Traverses up the directory tree from the starting path, looking for a
 * `.vespera/` directory at each level. Stops at filesystem root or after
 * reaching the maximum number of levels.
 *
 * This is useful when VS Code is opened in a subdirectory of a Vespera workspace,
 * allowing the extension to find the workspace root automatically.
 *
 * @param startPath - Absolute directory path to start search from
 * @param maxLevels - Maximum number of parent directories to check (default: 5)
 * @returns Discovery result with workspace path and metadata if found
 *
 * @example
 * ```typescript
 * // Search from a subdirectory
 * const result = await searchUpForVespera('/home/user/projects/game/code/src', 5);
 * if (result.found) {
 *   // Found workspace at /home/user/projects/game/.vespera
 *   console.log(`Found at: ${result.vesperaPath}`);
 * }
 * ```
 */
export async function searchUpForVespera(
  startPath: string,
  maxLevels: number = 5
): Promise<WorkspaceDiscoveryResult> {
  // Validate inputs
  if (!startPath) {
    return {
      found: false,
      error: 'startPath is required',
      discoveryMethod: 'tree-traversal'
    };
  }

  if (maxLevels < 1) {
    return {
      found: false,
      error: 'maxLevels must be at least 1',
      discoveryMethod: 'tree-traversal'
    };
  }

  let currentPath = startPath;

  // Traverse up the directory tree
  for (let level = 0; level < maxLevels; level++) {
    const vesperaPath = path.join(currentPath, '.vespera');

    try {
      // Check if .vespera/ exists and is a directory
      const stats = await fs.promises.stat(vesperaPath);
      if (stats.isDirectory()) {
        // Found .vespera/ - try to load metadata
        const metadata = await loadWorkspaceMetadata(vesperaPath);

        if (metadata) {
          // Valid workspace found!
          return {
            found: true,
            vesperaPath,
            metadata,
            discoveryMethod: 'tree-traversal'
          };
        } else {
          // .vespera/ exists but workspace.json is invalid
          // Keep searching up the tree
          continue;
        }
      }
    } catch (err: any) {
      // .vespera/ doesn't exist at this level or permission error
      // Continue searching up the tree
      if (err.code !== 'ENOENT') {
        // Log permission errors but don't stop searching
        // We might find a valid workspace higher up
      }
    }

    // Move to parent directory
    const parentPath = path.dirname(currentPath);

    // Check if we've reached the filesystem root
    if (parentPath === currentPath) {
      // Reached root (e.g., '/' on Unix, 'C:\' on Windows)
      break;
    }

    currentPath = parentPath;
  }

  // Didn't find .vespera/ in any parent directory
  return {
    found: false,
    discoveryMethod: 'tree-traversal'
  };
}

/**
 * Task C3: Complete discovery orchestration
 *
 * Implements the full Vespera workspace discovery algorithm:
 * 1. Check current VS Code workspace for .vespera/
 * 2. Search up directory tree (max 5 levels)
 * 3. Check global registry for registered projects
 * 4. Return "not found" if no workspace discovered
 *
 * This is the main entry point for workspace discovery and should be called
 * during extension activation to locate the user's Vespera workspace.
 *
 * @returns Discovery result with workspace information
 *
 * @example
 * ```typescript
 * import { discoverVesperaWorkspace } from './WorkspaceDiscovery';
 *
 * // Called during extension activation
 * export async function activate(context: vscode.ExtensionContext) {
 *   const result = await discoverVesperaWorkspace();
 *
 *   if (result.found) {
 *     console.log(`Workspace found: ${result.metadata?.name}`);
 *     await initializeWorkspace(result);
 *   } else {
 *     console.log('No workspace found, prompting user to initialize...');
 *     await promptInitializeWorkspace();
 *   }
 * }
 * ```
 */
export async function discoverVesperaWorkspace(): Promise<WorkspaceDiscoveryResult> {
  // Step 1: Check current workspace root for .vespera/
  const workspaceResult = await findWorkspaceVespera();
  if (workspaceResult.found) {
    return workspaceResult;
  }

  // Step 2: Search up directory tree from current workspace
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (workspaceFolders && workspaceFolders.length > 0) {
    const currentPath = workspaceFolders[0].uri.fsPath;
    const treeResult = await searchUpForVespera(currentPath, 5);

    if (treeResult.found) {
      return treeResult;
    }
  }

  // Step 3: Check global registry for projects in this workspace path
  // Note: This requires importing GlobalRegistry functions
  // For now, we'll implement a simplified version that doesn't depend on registry
  // The full integration will be done when wiring into extension.ts

  // Step 4: Not found - return with registry discovery method
  // In a full implementation, this would prompt to initialize a new workspace
  return {
    found: false,
    discoveryMethod: 'registry'
  };
}

/**
 * TODO: Task C3 (Extension Integration) - Wire into extension.ts
 * This function should be called during extension activation
 *
 * @param context VS Code extension context
 * @returns Discovery result
 */
export async function initializeWorkspaceDiscovery(
  _context: vscode.ExtensionContext
): Promise<WorkspaceDiscoveryResult> {
  // Discover workspace
  const result = await discoverVesperaWorkspace();

  if (!result.found) {
    // TODO: Prompt user to initialize new workspace
    // For now, just log that no workspace was found
    console.log('[WorkspaceDiscovery] No Vespera workspace found in current location');
    console.log('[WorkspaceDiscovery] User will need to initialize a new workspace');
  } else {
    console.log(`[WorkspaceDiscovery] Found workspace: ${result.metadata?.name}`);
    console.log(`[WorkspaceDiscovery] Discovery method: ${result.discoveryMethod}`);
    console.log(`[WorkspaceDiscovery] Path: ${result.vesperaPath}`);
  }

  return result;
}
