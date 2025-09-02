/**
 * Bindery configuration utilities for VS Code extension
 */

import * as vscode from 'vscode';
import * as path from 'path';
import * as fs from 'fs/promises';

export interface BinderyConfiguration {
  executablePath: string | null;
  isAvailable: boolean;
  version?: string;
  features?: string[];
  autoConnect?: boolean;
  fallbackToMock?: boolean;
}

/**
 * Detect and validate Bindery installation
 */
export async function detectBinderyConfiguration(): Promise<BinderyConfiguration> {
  const config = vscode.workspace.getConfiguration('vesperaForge');
  const userPath = config.get<string>('rustBinderyPath');
  const autoConnect = config.get<boolean>('enableAutoStart', true);
  
  // Search paths in order of preference
  const searchPaths = [
    userPath,
    // Monorepo relative paths
    getMonorepoBinderyPath('debug'),
    getMonorepoBinderyPath('release'),
    // System PATH
    'bindery-server',
    'vespera-bindery'
  ].filter(Boolean) as string[];

  let executablePath: string | null = null;
  let isAvailable = false;
  let version: string | undefined;
  let features: string[] = [];

  for (const candidatePath of searchPaths) {
    try {
      const resolvedPath = await resolveExecutablePath(candidatePath);
      if (resolvedPath && await isExecutableValid(resolvedPath)) {
        executablePath = resolvedPath;
        isAvailable = true;
        
        // Try to get version info
        try {
          const versionInfo = await getBinderyVersionInfo(resolvedPath);
          version = versionInfo.version;
          features = versionInfo.features;
        } catch (error) {
          console.warn('Could not get Bindery version info:', error);
        }
        
        break;
      }
    } catch (error) {
      // Continue to next path
      console.debug(`Bindery not found at ${candidatePath}:`, error);
    }
  }

  return {
    executablePath,
    isAvailable,
    version: version || undefined,
    features,
    autoConnect,
    fallbackToMock: !isAvailable
  };
}

/**
 * Get monorepo-relative Bindery path
 */
function getMonorepoBinderyPath(buildType: 'debug' | 'release'): string | null {
  const workspaceFolders = vscode.workspace.workspaceFolders;
  if (!workspaceFolders || workspaceFolders.length === 0) {
    return null;
  }

  const workspaceRoot = workspaceFolders?.[0]?.uri.fsPath;
  
  if (!workspaceRoot) {
    return null;
  }
  
  // Try to find monorepo root by looking for specific markers
  const possibleRoots = [
    workspaceRoot,
    path.join(workspaceRoot, '..', '..', '..'), // From plugins/VSCode/vespera-forge
    path.join(workspaceRoot, '..', '..'), // From some other nested location
  ];

  for (const root of possibleRoots) {
    const binderyPath = path.join(
      root,
      'packages',
      'vespera-utilities',
      'vespera-bindery',
      'target',
      buildType,
      'bindery-server'
    );
    
    // Check if this looks like the right structure
    const packagePath = path.join(
      root,
      'packages',
      'vespera-utilities',
      'vespera-bindery',
      'Cargo.toml'
    );
    
    try {
      // Synchronous check for structure (we're already in a detection flow)
      const fs = require('fs');
      if (fs && fs.existsSync && fs.existsSync(packagePath)) {
        return binderyPath;
      }
    } catch (error) {
      // Continue to next root
    }
  }

  return null;
}

/**
 * Resolve executable path, handling both absolute paths and PATH lookup
 */
async function resolveExecutablePath(candidatePath: string): Promise<string | null> {
  if (path.isAbsolute(candidatePath)) {
    return candidatePath;
  }

  // For relative paths or bare names, check if they exist as-is first
  try {
    await fs.access(candidatePath, fs.constants.F_OK);
    return path.resolve(candidatePath);
  } catch {
    // Not found as relative path, try PATH lookup for bare names
    if (!candidatePath.includes(path.sep)) {
      return await findInPath(candidatePath);
    }
    return null;
  }
}

/**
 * Find executable in system PATH
 */
async function findInPath(executableName: string): Promise<string | null> {
  const pathEnv = process.env['PATH'] || '';
  const pathSeparator = process.platform === 'win32' ? ';' : ':';
  const paths = pathEnv.split(pathSeparator);
  
  const extensions = process.platform === 'win32' ? ['.exe', '.cmd', '.bat'] : [''];
  
  for (const dir of paths) {
    for (const ext of extensions) {
      const fullPath = path.join(dir, executableName + ext);
      try {
        await fs.access(fullPath, fs.constants.F_OK | fs.constants.X_OK);
        return fullPath;
      } catch {
        // Continue searching
      }
    }
  }
  
  return null;
}

/**
 * Validate that the executable is actually Bindery
 */
async function isExecutableValid(executablePath: string): Promise<boolean> {
  try {
    // Check if file exists and is executable
    await fs.access(executablePath, fs.constants.F_OK | fs.constants.X_OK);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Get version information from Bindery executable
 */
async function getBinderyVersionInfo(executablePath: string): Promise<{
  version: string;
  features: string[];
}> {
  return new Promise((resolve, reject) => {
    const { spawn } = require('child_process');
    const child = spawn(executablePath, ['--version'], {
      stdio: ['pipe', 'pipe', 'pipe'],
      timeout: 5000
    });

    let stdout = '';
    let stderr = '';

    child.stdout.on('data', (data: Buffer) => {
      stdout += data.toString();
    });

    child.stderr.on('data', (data: Buffer) => {
      stderr += data.toString();
    });

    child.on('close', (code: number) => {
      if (code === 0) {
        try {
          // Parse version output
          const lines = stdout.trim().split('\n');
          const versionLine = lines.find(line => line.includes('version')) || lines[0];
          const version = versionLine ? extractVersion(versionLine) || '0.1.0' : '0.1.0';
          
          const featuresLine = lines.find(line => line.includes('features'));
          const features = featuresLine ? extractFeatures(featuresLine) : [];
          
          resolve({ version, features });
        } catch (error) {
          reject(new Error(`Failed to parse version info: ${error}`));
        }
      } else {
        reject(new Error(`Version command failed with code ${code}: ${stderr}`));
      }
    });

    child.on('error', (error: Error) => {
      reject(new Error(`Failed to run version command: ${error.message}`));
    });
  });
}

/**
 * Extract version number from version string
 */
function extractVersion(versionLine: string): string | null {
  const match = versionLine.match(/(\d+\.\d+\.\d+(-\w+)?)/);
  return match ? (match[1] || null) : null;
}

/**
 * Extract features list from features string
 */
function extractFeatures(featuresLine: string): string[] {
  const match = featuresLine.match(/features:\s*(.+)/);
  if (match?.[1]) {
    return match[1].split(',').map(f => f.trim()).filter(f => f.length > 0);
  }
  return [];
}

/**
 * Save Bindery configuration to VS Code settings
 */
export async function saveBinderyConfiguration(config: Partial<BinderyConfiguration>): Promise<void> {
  const vsConfig = vscode.workspace.getConfiguration('vesperaForge');
  
  if (config.executablePath !== null && config.executablePath !== undefined) {
    await vsConfig.update('rustBinderyPath', config.executablePath, vscode.ConfigurationTarget.Workspace);
  }
  
  if (config.autoConnect !== undefined) {
    await vsConfig.update('enableAutoStart', config.autoConnect, vscode.ConfigurationTarget.Workspace);
  }
}

/**
 * Show Bindery configuration in VS Code
 */
export async function showBinderyConfigurationDialog(): Promise<void> {
  const config = await detectBinderyConfiguration();
  
  const items = [
    `Status: ${config.isAvailable ? '✅ Available' : '❌ Not Found'}`,
    `Path: ${config.executablePath || 'Not found'}`,
    `Version: ${config.version || 'Unknown'}`,
    `Features: ${config.features?.join(', ') || 'None'}`,
    `Auto-connect: ${config.autoConnect ? 'Yes' : 'No'}`,
    `Mock fallback: ${config.fallbackToMock ? 'Yes' : 'No'}`
  ];

  const actions = ['Refresh Configuration', 'Set Custom Path', 'Open Settings'];
  
  const result = await vscode.window.showQuickPick(
    [...items.map(item => ({ label: item, description: '' })), 
     { label: '--- Actions ---', description: '', kind: vscode.QuickPickItemKind.Separator },
     ...actions.map(action => ({ label: action, description: 'Action' }))],
    {
      placeHolder: 'Bindery Configuration Status',
      title: 'Vespera Bindery Configuration'
    }
  );

  if (result) {
    switch (result.label) {
      case 'Refresh Configuration':
        await detectBinderyConfiguration();
        await vscode.window.showInformationMessage('Configuration refreshed');
        break;
      
      case 'Set Custom Path':
        const customPath = await vscode.window.showInputBox({
          prompt: 'Enter path to Bindery executable',
          placeHolder: '/path/to/bindery-server',
          value: config.executablePath || ''
        });
        
        if (customPath) {
          await saveBinderyConfiguration({ executablePath: customPath });
          await vscode.window.showInformationMessage('Custom path saved');
        }
        break;
      
      case 'Open Settings':
        await vscode.commands.executeCommand('workbench.action.openSettings', 'vesperaForge');
        break;
    }
  }
}