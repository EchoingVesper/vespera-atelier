/**
 * Embedded Server Launcher for Obsidian Plugin
 * 
 * Launches the Vespera Scriptorium server as a child process when the plugin loads,
 * eliminating the need for manual server management.
 */

import { spawn, ChildProcess } from 'child_process';
import { Notice } from 'obsidian';
import { platform } from 'os';
import * as path from 'path';

export interface ServerConfig {
    pythonPath: string;
    serverScriptPath: string;
    port: number;
    timeout: number;
}

export class EmbeddedServerLauncher {
    private serverProcess: ChildProcess | null = null;
    private config: ServerConfig;
    private isRunning = false;
    private startupPromise: Promise<void> | null = null;

    constructor(config: ServerConfig) {
        this.config = config;
    }

    /**
     * Start the embedded server
     */
    async start(): Promise<void> {
        if (this.isRunning) {
            return;
        }

        if (this.startupPromise) {
            return this.startupPromise;
        }

        this.startupPromise = this._startServer();
        return this.startupPromise;
    }

    private async _startServer(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                // Determine paths based on platform
                const serverArgs = [
                    this.config.serverScriptPath,
                    '--mode', 'websocket',
                    '--port', this.config.port.toString()
                ];

                console.log(`🚀 Starting embedded Vespera server...`);
                console.log(`   Python: ${this.config.pythonPath}`);
                console.log(`   Script: ${this.config.serverScriptPath}`);
                console.log(`   Port: ${this.config.port}`);

                this.serverProcess = spawn(this.config.pythonPath, serverArgs, {
                    stdio: ['pipe', 'pipe', 'pipe'],
                    detached: false
                });

                let startupOutput = '';
                const startupTimeout = setTimeout(() => {
                    this.serverProcess?.kill();
                    reject(new Error('Server startup timeout'));
                }, this.config.timeout);

                this.serverProcess.stdout?.on('data', (data) => {
                    const output = data.toString();
                    startupOutput += output;
                    console.log(`Server stdout: ${output.trim()}`);

                    // Look for successful startup message
                    if (output.includes('WebSocket server running')) {
                        clearTimeout(startupTimeout);
                        this.isRunning = true;
                        console.log('✅ Embedded server started successfully');
                        resolve();
                    }
                });

                this.serverProcess.stderr?.on('data', (data) => {
                    const output = data.toString();
                    console.error(`Server stderr: ${output.trim()}`);
                    
                    // Also check stderr for startup success (some logging goes there)
                    if (output.includes('WebSocket server running')) {
                        clearTimeout(startupTimeout);
                        this.isRunning = true;
                        console.log('✅ Embedded server started successfully');
                        resolve();
                    }
                });

                this.serverProcess.on('error', (error) => {
                    clearTimeout(startupTimeout);
                    console.error('Failed to start embedded server:', error);
                    reject(error);
                });

                this.serverProcess.on('exit', (code, signal) => {
                    clearTimeout(startupTimeout);
                    this.isRunning = false;
                    this.serverProcess = null;
                    console.log(`Server process exited with code ${code}, signal ${signal}`);
                    
                    if (code !== 0 && !this.isRunning) {
                        reject(new Error(`Server exited with code ${code}`));
                    }
                });

            } catch (error) {
                console.error('Error starting embedded server:', error);
                reject(error);
            }
        });
    }

    /**
     * Stop the embedded server
     */
    async stop(): Promise<void> {
        if (!this.serverProcess || !this.isRunning) {
            return;
        }

        return new Promise((resolve) => {
            if (!this.serverProcess) {
                resolve();
                return;
            }

            console.log('🛑 Stopping embedded server...');
            
            const cleanup = () => {
                this.isRunning = false;
                this.serverProcess = null;
                this.startupPromise = null;
                console.log('✅ Embedded server stopped');
                resolve();
            };

            // Try graceful shutdown first
            this.serverProcess.on('exit', cleanup);
            
            // Send SIGTERM for graceful shutdown
            this.serverProcess.kill('SIGTERM');
            
            // Force kill after timeout
            setTimeout(() => {
                if (this.serverProcess && !this.serverProcess.killed) {
                    console.log('Force killing server process...');
                    this.serverProcess.kill('SIGKILL');
                    cleanup();
                }
            }, 5000);
        });
    }

    /**
     * Check if server is running
     */
    isServerRunning(): boolean {
        return this.isRunning && this.serverProcess !== null;
    }

    /**
     * Get server status
     */
    getStatus(): { running: boolean; pid?: number; port: number } {
        return {
            running: this.isRunning,
            pid: this.serverProcess?.pid,
            port: this.config.port
        };
    }

    /**
     * Test server connectivity
     */
    async testConnection(): Promise<boolean> {
        if (!this.isRunning) {
            return false;
        }

        try {
            // Simple WebSocket connection test
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
            console.error('Connection test failed:', error);
            return false;
        }
    }
}

/**
 * Create server launcher with default configuration
 */
export function createEmbeddedServerLauncher(): EmbeddedServerLauncher {
    // Detect platform-specific paths
    const isWindows = platform() === 'win32';
    const isWSL = process.env.WSL_DISTRO_NAME !== undefined;
    
    let pythonPath: string;
    let serverScriptPath: string;
    
    if (isWSL) {
        // Running in WSL, use WSL paths
        pythonPath = '/home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium/mcp_venv/bin/python';
        serverScriptPath = '/home/aya/dev/monorepo/vespera-atelier/packages/vespera-scriptorium/unified_server.py';
    } else if (isWindows) {
        // Running on Windows, would need Windows paths or WSL integration
        // This would need to be configured based on your Windows setup
        throw new Error('Windows embedded server not yet configured');
    } else {
        // Unix/Linux
        pythonPath = './mcp_venv/bin/python';
        serverScriptPath = './unified_server.py';
    }

    const config: ServerConfig = {
        pythonPath,
        serverScriptPath,
        port: 8000,
        timeout: 30000 // 30 seconds startup timeout
    };

    return new EmbeddedServerLauncher(config);
}