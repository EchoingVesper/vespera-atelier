import { vi } from 'vitest';

// Mock Notice class
export const Notice = vi.fn();

// Mock normalizePath function
export const normalizePath = (path: string): string => {
  // Replace backslashes with forward slashes
  let normalized = path.replace(/\\/g, '/');
  
  // Remove duplicate slashes
  normalized = normalized.replace(/\/+/g, '/');
  
  // Remove trailing slash
  normalized = normalized.replace(/\/$/, '');
  
  return normalized;
};

// Mock TFile interface
export interface TFile {
  path: string;
  name?: string;
  extension?: string;
  stat?: { size: number };
}

// Mock Vault interface
export interface Vault {
  adapter: VaultAdapter;
  create(path: string, data: string): Promise<TFile>;
  createBinary(path: string, data: ArrayBuffer | Uint8Array): Promise<TFile>;
  createFolder(path: string): Promise<void>;
  getFileByPath(path: string): TFile | null;
}

// Mock VaultAdapter interface
export interface VaultAdapter {
  exists(path: string): Promise<boolean>;
  read(path: string): Promise<string>;
  write(path: string, data: string): Promise<void>;
  mkdir(path: string): Promise<void>;
  remove(path: string): Promise<void>;
  list(path: string): Promise<{ files: string[], folders: string[] }>;
}

// Mock App interface
export interface App {
  vault: Vault;
}

// Create mock implementations
export class MockVaultAdapter implements VaultAdapter {
  private files: Record<string, string> = {};
  private directories: Set<string> = new Set();

  async exists(path: string): Promise<boolean> {
    return this.files[path] !== undefined || this.directories.has(path);
  }

  async read(path: string): Promise<string> {
    const content = this.files[path];
    if (content === undefined) {
      throw new Error(`File not found: ${path}`);
    }
    return content;
  }

  async write(path: string, data: string): Promise<void> {
    this.files[path] = data;
  }

  async mkdir(path: string): Promise<void> {
    // Normalize the path
    const normalizedPath = normalizePath(path);
    this.directories.add(normalizedPath);
    
    // Also add parent directories
    let currentPath = normalizedPath;
    while (currentPath.includes('/')) {
      currentPath = currentPath.substring(0, currentPath.lastIndexOf('/'));
      if (currentPath) {
        this.directories.add(currentPath);
      }
    }
  }

  async remove(path: string): Promise<void> {
    delete this.files[path];
  }

  async list(path: string): Promise<{ files: string[], folders: string[] }> {
    return { files: [], folders: [] };
  }

  // Helper methods for testing
  getFileContent(path: string): string | undefined {
    return this.files[path];
  }

  getAllFiles(): Record<string, string> {
    return { ...this.files };
  }

  getAllDirectories(): string[] {
    return Array.from(this.directories);
  }
}

export class MockVault implements Vault {
  adapter: MockVaultAdapter;

  constructor() {
    this.adapter = new MockVaultAdapter();
  }

  async create(path: string, data: string): Promise<TFile> {
    // Normalize the path
    const normalizedPath = normalizePath(path);
    
    // Ensure parent directory exists
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex > 0) {
      const directory = normalizedPath.substring(0, lastSlashIndex);
      if (!(await this.adapter.exists(directory))) {
        await this.createFolder(directory);
      }
    }
    
    await this.adapter.write(normalizedPath, data);
    return { path: normalizedPath };
  }
  
  /**
   * Create a binary file at the specified path
   * @param path Path to create the file at
   * @param data Binary data to write
   * @returns Promise resolving to the created file
   */
  async createBinary(path: string, data: ArrayBuffer | Uint8Array): Promise<TFile> {
    // Normalize the path
    const normalizedPath = normalizePath(path);
    
    // Ensure parent directory exists
    const lastSlashIndex = normalizedPath.lastIndexOf('/');
    if (lastSlashIndex > 0) {
      const directory = normalizedPath.substring(0, lastSlashIndex);
      if (!(await this.adapter.exists(directory))) {
        await this.createFolder(directory);
      }
    }
    
    // Convert binary data to string for storage in our mock system
    // In a real implementation, this would write the binary data directly
    // For testing purposes, we'll convert it to a string
    let content: string;
    if (data instanceof Uint8Array) {
      content = new TextDecoder().decode(data);
    } else {
      content = new TextDecoder().decode(new Uint8Array(data));
    }
    
    await this.adapter.write(normalizedPath, content);
    return { path: normalizedPath };
  }

  async createFolder(path: string): Promise<void> {
    // Normalize the path
    const normalizedPath = normalizePath(path);
    
    // Create the directory and all parent directories
    await this.adapter.mkdir(normalizedPath);
  }

  getFileByPath(path: string): TFile | null {
    return this.adapter.getFileContent(path) ? { path } : null;
  }
}

export class MockApp implements App {
  vault: MockVault;

  constructor() {
    this.vault = new MockVault();
  }
}

// Create factory functions for easy instantiation
export function createMockApp(): MockApp {
  return new MockApp();
}

export function createMockVault(): MockVault {
  return new MockVault();
}

export function createMockVaultAdapter(): MockVaultAdapter {
  return new MockVaultAdapter();
}