/**
 * Project-Aware Server Launcher for Obsidian Plugin
 * 
 * Detects the current project context from the Obsidian vault
 * and launches a project-specific Vespera Scriptorium server.
 */

import { spawn, ChildProcess } from 'child_process';
import { Notice } from 'obsidian';
import { platform } from 'os';
import * as path from 'path';

export interface ProjectServerConfig {
    pythonPath: string;
    serverScriptPath: string;
    port: number;
    timeout: number;
    vaultPath: string;
    projectPath?: string;  // Auto-detected if not provided
}

export interface ProjectInfo {
    name: string;
    path: string;
    vesperaDir: string;
    databasePath: string;
}

export class ProjectAwareServerLauncher {
    private serverProcess: ChildProcess | null = null;
    private config: ProjectServerConfig;
    private projectInfo: ProjectInfo | null = null;
    private isRunning = false;
    private startupPromise: Promise<void> | null = null;

    constructor(config: ProjectServerConfig) {
        this.config = config;
    }

    /**
     * Detect project information from vault path
     */
    private detectProjectInfo(): ProjectInfo | null {
        // Start from vault path and search upward for project markers
        let currentPath = this.config.projectPath || this.config.vaultPath;
        const maxDepth = 10; // Prevent infinite loops
        let depth = 0;
        
        while (depth < maxDepth) {
            const pathObj = path.parse(currentPath);
            
            // Check for project markers
            const markers = ['.git', '.vespera_v2', '.vespera', 'package.json', 'pyproject.toml'];
            
            for (const marker of markers) {
                const markerPath = path.join(currentPath, marker);
                try {
                    if (require('fs').existsSync(markerPath)) {
                        const projectName = path.basename(currentPath);
                        const vesperaDir = path.join(currentPath, '.vespera_v2');
                        
                        return {
                            name: projectName,
                            path: currentPath,
                            vesperaDir: vesperaDir,
                            databasePath: path.join(vesperaDir, 'tasks.db')
                        };
                    }
                } catch (error) {
                    // Ignore filesystem errors
                }
            }
            
            // Move up one directory
            const parentPath = path.dirname(currentPath);
            if (parentPath === currentPath) {
                // Reached filesystem root
                break;
            }
            currentPath = parentPath;
            depth++;
        }
        
        // Fallback: use vault directory as project root
        const projectName = path.basename(this.config.vaultPath);
        const vesperaDir = path.join(this.config.vaultPath, '.vespera_v2');
        
        return {
            name: projectName,
            path: this.config.vaultPath,
            vesperaDir: vesperaDir,
            databasePath: path.join(vesperaDir, 'tasks.db')
        };
    }

    /**
     * Start the project-aware server
     */
    async start(): Promise<ProjectInfo> {
        if (this.isRunning && this.projectInfo) {
            return this.projectInfo;
        }

        if (this.startupPromise) {
            await this.startupPromise;
            return this.projectInfo!;
        }

        this.startupPromise = this._startServer();
        await this.startupPromise;
        return this.projectInfo!;
    }

    private async _startServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Detect project information
                this.projectInfo = this.detectProjectInfo();
                if (!this.projectInfo) {
                    reject(new Error('Could not detect project information'));
                    return;
                }

                // Build server arguments with project context
                const serverArgs = [
                    this.config.serverScriptPath,
                    '--mode', 'websocket',
                    '--port', this.config.port.toString(),
                    '--vault', this.config.vaultPath
                ];

                console.log(`🎯 Starting project-aware Vespera server...`);
                console.log(`   Project: ${this.projectInfo.name}`);
                console.log(`   Project Path: ${this.projectInfo.path}`);
                console.log(`   Vault Path: ${this.config.vaultPath}`);
                console.log(`   Database: ${this.projectInfo.databasePath}`);
                console.log(`   Port: ${this.config.port}`);

                this.serverProcess = spawn(this.config.pythonPath, serverArgs, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    detached: false,
                    cwd: path.dirname(this.config.serverScriptPath)
                });

                let startupOutput = '';
                const startupTimeout = setTimeout(() => {
                    this.serverProcess?.kill();
                    reject(new Error(`Server startup timeout for project: ${this.projectInfo?.name}`));
                }, this.config.timeout);

                this.serverProcess.stdout?.on('data', (data) => {
                    const output = data.toString();
                    startupOutput += output;
                    console.log(`[${this.projectInfo?.name}] Server stdout: ${output.trim()}`);

                    // Look for successful startup message
                    if (output.includes('WebSocket server running')) {
                        clearTimeout(startupTimeout);
                        this.isRunning = true;
                        console.log(`✅ Project server started: ${this.projectInfo?.name}`);
                        resolve();
                    }
                });

                this.serverProcess.stderr?.on('data', (data) => {
                    const output = data.toString();
                    console.error(`[${this.projectInfo?.name}] Server stderr: ${output.trim()}`);
                    
                    // Also check stderr for startup success
                    if (output.includes('WebSocket server running')) {
                        clearTimeout(startupTimeout);
                        this.isRunning = true;
                        console.log(`✅ Project server started: ${this.projectInfo?.name}`);
                        resolve();
                    }
                });

                this.serverProcess.on('error', (error) => {
                    clearTimeout(startupTimeout);
                    console.error(`Failed to start server for project ${this.projectInfo?.name}:`, error);
                    reject(error);
                });

                this.serverProcess.on('exit', (code, signal) => {
                    clearTimeout(startupTimeout);
                    this.isRunning = false;
                    this.serverProcess = null;
                    console.log(`[${this.projectInfo?.name}] Server exited with code ${code}, signal ${signal}`);
                    
                    if (code !== 0 && !this.isRunning) {
                        reject(new Error(`Server exited with code ${code} for project: ${this.projectInfo?.name}`));
                    }
                });

            } catch (error) {
                console.error('Error starting project-aware server:', error);
                reject(error);
            }
        });
    }

    /**
     * Stop the server
     */
    async stop(): Promise<void> {
        if (!this.serverProcess || !this.isRunning) {
            return;
        }

        return new Promise((resolve) => {
            if (!this.serverProcess || !this.projectInfo) {
                resolve();
                return;
            }

            console.log(`🛑 Stopping server for project: ${this.projectInfo.name}...`);
            
            const cleanup = () => {
                this.isRunning = false;
                this.serverProcess = null;
                this.startupPromise = null;
                console.log(`✅ Server stopped for project: ${this.projectInfo?.name}`);
                resolve();
            };

            this.serverProcess.on('exit', cleanup);
            this.serverProcess.kill('SIGTERM');
            
            // Force kill after timeout
            setTimeout(() => {
                if (this.serverProcess && !this.serverProcess.killed) {
                    console.log(`Force killing server for project: ${this.projectInfo?.name}...`);
                    this.serverProcess.kill('SIGKILL');
                    cleanup();
                }
            }, 5000);
        });
    }

    /**
     * Get project and server status
     */
    getStatus(): { 
        running: boolean; 
        pid?: number; 
        port: number; 
        project?: ProjectInfo;
    } {
        return {
            running: this.isRunning,
            pid: this.serverProcess?.pid,
            port: this.config.port,
            project: this.projectInfo || undefined
        };
    }

    /**
     * Get project information (available after start())
     */
    getProjectInfo(): ProjectInfo | null {
        return this.projectInfo;
    }

    /**
     * Test server connectivity
     */
    async testConnection(): Promise<boolean> {
        if (!this.isRunning || !this.projectInfo) {
            return false;
        }

        try {
            const ws = new WebSocket(`ws://localhost:${this.config.port}`);
            
            return new Promise((resolve) => {
                const timeout = setTimeout(() => {
                    ws.close();
                    resolve(false);
                }, 3000);

                ws.onopen = () => {
                    clearTimeout(timeout);
                    ws.close();
                    resolve(true);
                };

                ws.onerror = () => {
                    clearTimeout(timeout);
                    resolve(false);
                };
            });
        } catch (error) {
            console.error(`Connection test failed for project ${this.projectInfo?.name}:`, error);
            return false;
        }
    }
}

/**
 * Create project-aware server launcher
 */
export function createProjectAwareServerLauncher(vaultPath: string, projectPath?: string): ProjectAwareServerLauncher {
    const isWindows = platform() === 'win32';
    const isWSL = process.env.WSL_DISTRO_NAME !== undefined;
    
    let pythonPath: string;
    let serverScriptPath: string;
    
    if (isWSL || !isWindows) {
        // WSL or Unix paths
        pythonPath = '/home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium/mcp_venv/bin/python';
        serverScriptPath = '/home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium/project_aware_server.py';
    } else {
        // Windows paths (would need configuration)
        throw new Error('Windows project-aware server not yet configured');
    }

    const config: ProjectServerConfig = {
        pythonPath,
        serverScriptPath,
        port: 8000,
        timeout: 30000,
        vaultPath,
        projectPath
    };

    return new ProjectAwareServerLauncher(config);
}