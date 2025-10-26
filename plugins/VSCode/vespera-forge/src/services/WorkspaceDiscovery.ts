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
 * TODO: Task C2 - Implement tree traversal search
 * Search up directory tree for .vespera/ (max 5 levels)
 *
 * @param startPath - Directory to start search from
 * @param maxLevels - Maximum levels to traverse (default: 5)
 * @returns Discovery result if found
 */
export async function searchUpForVespera(
  startPath: string,
  maxLevels: number = 5
): Promise<WorkspaceDiscoveryResult> {
  // TODO: Implement Task C2
  return {
    found: false,
    error: 'Tree traversal not yet implemented (Task C2)',
    discoveryMethod: 'tree-traversal'
  };
}

/**
 * TODO: Task C3 - Implement full discovery orchestration
 * Complete discovery flow: workspace → tree → registry → init prompt
 *
 * @returns Discovery result with workspace information
 */
export async function discoverVesperaWorkspace(): Promise<WorkspaceDiscoveryResult> {
  // TODO: Implement Task C3
  return {
    found: false,
    error: 'Discovery orchestration not yet implemented (Task C3)',
    discoveryMethod: 'none'
  };
}
