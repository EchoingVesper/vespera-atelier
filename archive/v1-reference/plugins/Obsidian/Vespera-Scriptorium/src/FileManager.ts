/**
 * FileManager module
 * Responsible for vault file discovery, selection, and file I/O operations.
 * @module FileManager
 * @todo Implement batch selection logic.
 */

import type { Vault, TFile, TFolder } from "obsidian";
import type { FileTreeNode } from "./ui/MultiSelectModal";

/**
 * Supported file extensions for discovery.
 */
const SUPPORTED_EXTENSIONS = ["md", "txt", "html", "csv"];

/**
 * File metadata returned by discovery utility.
 */
export interface VaultFileMeta {
  filePath: string;
  extension: string;
  size: number | null;
}

/**
 * Discover supported files in the Obsidian Vault using the Vault API.
 * @param vault Obsidian Vault instance.
 * @returns Array of VaultFileMeta objects for eligible files.
 * @reason Uses Vault API for plugin portability, sandboxing, and mobile support. Node.js fs is not allowed in real plugins.
 */
export function discoverVaultFilesFromVault(vault: Vault): VaultFileMeta[] {
  // Vault.getFiles() returns all TFile objects in the vault
  const files = vault.getFiles();
  return files
    .filter((file: TFile) => SUPPORTED_EXTENSIONS.includes(file.extension))
    .map((file: TFile) => ({
      filePath: file.path, // already relative to vault root
      extension: file.extension,
      size: file.stat?.size ?? null, // size may be undefined in some contexts
    }));
}

/**
 * Recursively discovers all folders and eligible files in the Vault as a folder/file tree.
 * Returns an array of FileTreeNode (root folders/files).
 *
 * @param vault Obsidian Vault instance
 * @returns FileTreeNode[]
 * @reason Uses Vault.getRoot() and TFolder.children for full hierarchy. Only includes supported file types.
 */
export function discoverVaultTreeFromRoot(vault: Vault): FileTreeNode[] {
  const SUPPORTED_EXTENSIONS = ["md", "txt", "html", "csv"];
  function mapFolder(folder: TFolder): FileTreeNode {
    return {
      id: folder.path,
      name: folder.name,
      path: folder.path,
      isFolder: true,
      children: folder.children
        .map(child => {
          if ((child as TFolder).children !== undefined) {
            // TFolder
            return mapFolder(child as TFolder);
          } else {
            const file = child as TFile;
            if (!SUPPORTED_EXTENSIONS.includes(file.extension)) return null;
            return {
              id: file.path,
              name: file.name,
              path: file.path,
              isFolder: false,
              extension: file.extension,
              size: file.stat?.size ?? undefined,
              // No modified date available from TFile by default
            };
          }
        })
        .filter(Boolean) as FileTreeNode[],
    };
  }
  const root = vault.getRoot();
  // If the vault root is empty, return an empty array
  if (!root.children || root.children.length === 0) return [];
  // Return all root-level folders and eligible files
  return root.children
    .map(child => {
      if ((child as TFolder).children !== undefined) {
        return mapFolder(child as TFolder);
      } else {
        const file = child as TFile;
        if (!SUPPORTED_EXTENSIONS.includes(file.extension)) return null;
        return {
          id: file.path,
          name: file.name,
          path: file.path,
          isFolder: false,
          extension: file.extension,
          size: file.stat?.size ?? undefined,
        };
      }
    })
    .filter(Boolean) as FileTreeNode[];
}

// TODO: Add batch selection and file I/O methods for next milestone.
