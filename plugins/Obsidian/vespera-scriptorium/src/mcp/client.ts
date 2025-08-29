/**
 * MCP Client Implementation for Obsidian Plugin
 * 
 * Implements the core MCP client that communicates with Vespera Scriptorium
 * backend using the Model Context Protocol.
 */

import { EventEmitter } from 'events';
import { 
    IMCPClient, 
    VesperaMCPClient,
    MCPClientConfig,
    MCPConnectionInfo,
    MCPConnectionState,
    MCPEvent,
    MCPTransport,
    MCPMessage,
    MCPRequest,
    MCPResponse,
    MCPRequestOptions,
    MCPPendingRequest,
    ToolResult,
    ResourceResponse,
    MCPCapabilities
} from './interfaces';

/**
 * WebSocket Transport Implementation for MCP
 */
class WebSocketTransport implements MCPTransport {
    private ws: WebSocket | null = null;
    private messageCallbacks: ((message: MCPMessage) => void)[] = [];
    private errorCallbacks: ((error: Error) => void)[] = [];
    private disconnectCallbacks: (() => void)[] = [];

    constructor(private endpoint: string) {}

    async connect(): Promise<void> {
        return new Promise((resolve, reject) => {
            try {
                this.ws = new WebSocket(this.endpoint);
                
                this.ws.onopen = () => {
                    resolve();
                };
                
                this.ws.onmessage = (event) => {
                    try {
                        const message: MCPMessage = JSON.parse(event.data);
                        this.messageCallbacks.forEach(callback => callback(message));
                    } catch (error) {
                        this.errorCallbacks.forEach(callback => 
                            callback(new Error(`Failed to parse message: ${error}`))
                        );
                    }
                };
                
                this.ws.onerror = (error) => {
                    reject(new Error(`WebSocket connection failed: ${error}`));
                };
                
                this.ws.onclose = () => {
                    this.disconnectCallbacks.forEach(callback => callback());
                };
                
            } catch (error) {
                reject(error);
            }
        });
    }

    async disconnect(): Promise<void> {
        if (this.ws) {
            this.ws.close();
            this.ws = null;
        }
    }

    async send(message: MCPMessage): Promise<void> {
        if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
            throw new Error('WebSocket not connected');
        }
        
        this.ws.send(JSON.stringify(message));
    }

    onMessage(callback: (message: MCPMessage) => void): void {
        this.messageCallbacks.push(callback);
    }

    onError(callback: (error: Error) => void): void {
        this.errorCallbacks.push(callback);
    }

    onDisconnect(callback: () => void): void {
        this.disconnectCallbacks.push(callback);
    }

    isConnected(): boolean {
        return this.ws !== null && this.ws.readyState === WebSocket.OPEN;
    }
}

/**
 * stdio Transport Implementation for MCP
 * Used when connecting to local MCP server process
 */
class StdioTransport implements MCPTransport {
    private process: any = null; // Would be actual process in Node.js environment
    private messageCallbacks: ((message: MCPMessage) => void)[] = [];
    private errorCallbacks: ((error: Error) => void)[] = [];
    private disconnectCallbacks: (() => void)[] = [];

    constructor(
        private command: string,
        private args: string[] = []
    ) {}

    async connect(): Promise<void> {
        // In a real implementation, this would spawn a child process
        // For now, this is a placeholder for the Obsidian plugin context
        throw new Error('stdio transport not yet implemented in browser environment');
    }

    async disconnect(): Promise<void> {
        if (this.process) {
            // Kill process
            this.process = null;
        }
    }

    async send(message: MCPMessage): Promise<void> {
        if (!this.process) {
            throw new Error('Process not running');
        }
        
        // Would write to stdin
        throw new Error('stdio transport not yet implemented');
    }

    onMessage(callback: (message: MCPMessage) => void): void {
        this.messageCallbacks.push(callback);
    }

    onError(callback: (error: Error) => void): void {
        this.errorCallbacks.push(callback);
    }

    onDisconnect(callback: () => void): void {
        this.disconnectCallbacks.push(callback);
    }

    isConnected(): boolean {
        return this.process !== null;
    }
}

/**
 * Core MCP Client Implementation
 */
export class MCPClient extends EventEmitter implements VesperaMCPClient {
    private transport: MCPTransport;
    private connectionInfo: MCPConnectionInfo;
    private pendingRequests: Map<string | number, MCPPendingRequest> = new Map();
    private requestIdCounter = 0;
    private serverCapabilities?: MCPCapabilities;

    constructor(private config: MCPClientConfig) {
        super();
        
        // Initialize transport based on config
        if (config.connection.transport.type === 'websocket') {
            if (!config.connection.transport.endpoint) {
                throw new Error('WebSocket endpoint required');
            }
            this.transport = new WebSocketTransport(config.connection.transport.endpoint);
        } else if (config.connection.transport.type === 'stdio') {
            if (!config.connection.transport.command) {
                throw new Error('Command required for stdio transport');
            }
            this.transport = new StdioTransport(
                config.connection.transport.command,
                config.connection.transport.args
            );
        } else {
            throw new Error(`Unsupported transport type: ${config.connection.transport.type}`);
        }

        this.connectionInfo = {
            state: MCPConnectionState.DISCONNECTED
        };

        this.setupTransportHandlers();
    }

    private setupTransportHandlers(): void {
        this.transport.onMessage((message) => {
            this.handleMessage(message);
        });

        this.transport.onError((error) => {
            this.emit('error', error);
        });

        this.transport.onDisconnect(() => {
            this.connectionInfo.state = MCPConnectionState.DISCONNECTED;
            this.emit('disconnect');
        });
    }

    private handleMessage(message: MCPMessage): void {
        this.emit('message', message);

        // Handle responses to pending requests
        if (message.id !== undefined && this.pendingRequests.has(message.id)) {
            const pendingRequest = this.pendingRequests.get(message.id)!;
            this.pendingRequests.delete(message.id);

            if (message.error) {
                pendingRequest.reject(new Error(message.error.message));
            } else {
                pendingRequest.resolve(message.result);
            }
            return;
        }

        // Handle notifications
        if (message.method && message.id === undefined) {
            this.emit('notification', message);
            return;
        }

        // Handle other message types
        this.emit('message', message);
    }

    async connect(): Promise<void> {
        const maxRetries = this.config.connection.transport.maxReconnectAttempts || 3;
        const baseDelay = this.config.connection.transport.reconnectDelay || 1000;
        
        for (let attempt = 1; attempt <= maxRetries; attempt++) {
            this.connectionInfo.state = MCPConnectionState.CONNECTING;
            this.emit('state-change', this.connectionInfo.state);

            try {
                await this.transport.connect();
                
                // Perform handshake
                const serverInfo = await this.request('initialize', {
                    clientInfo: this.config.connection.clientInfo,
                    capabilities: this.config.connection.capabilities
                });

                this.connectionInfo = {
                    state: MCPConnectionState.CONNECTED,
                    serverInfo: serverInfo.serverInfo,
                    capabilities: serverInfo.capabilities,
                    connectTime: new Date()
                };

                this.serverCapabilities = serverInfo.capabilities;
                this.emit('connect');
                this.emit('state-change', this.connectionInfo.state);
                return; // Success!

            } catch (error) {
                this.connectionInfo.lastError = error as Error;
                
                if (attempt === maxRetries) {
                    // Final attempt failed
                    this.connectionInfo.state = MCPConnectionState.ERROR;
                    this.emit('state-change', this.connectionInfo.state);
                    throw new Error(`Connection failed after ${maxRetries} attempts: ${error.message}`);
                }
                
                // Exponential backoff with jitter
                const delay = Math.min(baseDelay * Math.pow(2, attempt - 1), 30000);
                const jitter = Math.random() * 0.1 * delay;
                const totalDelay = delay + jitter;
                
                console.log(`Connection attempt ${attempt}/${maxRetries} failed, retrying in ${Math.round(totalDelay)}ms:`, error.message);
                this.emit('retry', { attempt, maxRetries, delay: totalDelay, error });
                
                await new Promise(resolve => setTimeout(resolve, totalDelay));
            }
        }
    }

    async disconnect(): Promise<void> {
        await this.transport.disconnect();
        this.connectionInfo.state = MCPConnectionState.DISCONNECTED;
        this.emit('state-change', this.connectionInfo.state);
    }

    getConnectionInfo(): MCPConnectionInfo {
        return { ...this.connectionInfo };
    }

    async request(method: string, params?: any, options?: MCPRequestOptions): Promise<any> {
        const id = ++this.requestIdCounter;
        const timeout = options?.timeout || this.config.connection.timeout || 30000;

        const request: MCPRequest = {
            jsonrpc: '2.0',
            id,
            method,
            params
        };

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                this.pendingRequests.delete(id);
                reject(new Error(`Request timeout: ${method}`));
            }, timeout);

            this.pendingRequests.set(id, {
                id,
                method,
                timestamp: Date.now(),
                timeout,
                resolve: (result) => {
                    clearTimeout(timeoutId);
                    resolve(result);
                },
                reject: (error) => {
                    clearTimeout(timeoutId);
                    reject(error);
                }
            });

            this.transport.send(request).catch(reject);
        });
    }

    async invokeTool(name: string, args: any): Promise<ToolResult> {
        const result = await this.request('tools/call', {
            name,
            arguments: args
        });

        return {
            content: result.content,
            isError: result.isError || false,
            error: result.error
        };
    }

    async getResource(uri: string): Promise<ResourceResponse> {
        const result = await this.request('resources/read', {
            uri
        });

        return {
            uri,
            mimeType: result.mimeType,
            content: result.content,
            metadata: result.metadata
        };
    }

    getServerCapabilities(): MCPCapabilities | undefined {
        return this.serverCapabilities;
    }

    async dispose(): Promise<void> {
        // Cancel all pending requests
        for (const [id, request] of this.pendingRequests) {
            request.reject(new Error('Client disposed'));
        }
        this.pendingRequests.clear();

        await this.disconnect();
        this.removeAllListeners();
    }

    // Vespera-specific methods
    async createTask(taskData: any): Promise<any> {
        return this.invokeTool('create_task', { task_input: taskData });
    }

    async updateTask(taskId: string, updates: any): Promise<any> {
        return this.invokeTool('update_task', { 
            update_input: { task_id: taskId, ...updates }
        });
    }

    async deleteTask(taskId: string): Promise<any> {
        return this.invokeTool('delete_task', { 
            task_id: taskId, 
            recursive: true 
        });
    }

    async getTasks(filters?: any): Promise<any[]> {
        const result = await this.invokeTool('list_tasks', filters || {});
        return result.content?.tasks || [];
    }

    async getRoles(): Promise<any[]> {
        const result = await this.invokeTool('list_roles', {});
        return result.content?.roles || [];
    }

    async assignRole(taskId: string, roleName: string): Promise<any> {
        return this.invokeTool('assign_role_to_task', {
            task_id: taskId,
            role_name: roleName
        });
    }

    async createProject(projectData: any): Promise<any> {
        // This would be implemented when project management tools are added
        throw new Error('Project management not yet implemented');
    }

    async getProjects(): Promise<any[]> {
        // This would be implemented when project management tools are added
        return [];
    }

    // Task Management Methods - Essential for plugin integration
    async createTask(taskData: {
        title: string;
        description?: string;
        priority?: string;
        project_id?: string;
        feature?: string;
        metadata?: any;
    }): Promise<{ success: boolean; task?: any; error?: string }> {
        try {
            const result = await this.request('mcp__vespera-scriptorium__create_task', {
                task_input: taskData
            });
            return { success: true, task: result.task };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async listTasks(options?: {
        status_filter?: string;
        project_id?: string;
        limit?: number;
    }): Promise<{ success: boolean; tasks?: any[]; error?: string }> {
        try {
            const result = await this.request('mcp__vespera-scriptorium__list_tasks', options || {});
            return { success: true, tasks: result.tasks || [] };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async updateTask(taskId: string, updates: {
        title?: string;
        description?: string;
        status?: string;
        priority?: string;
        project_id?: string;
    }): Promise<{ success: boolean; task?: any; error?: string }> {
        try {
            const result = await this.request('mcp__vespera-scriptorium__update_task', {
                update_input: {
                    task_id: taskId,
                    ...updates
                }
            });
            return { success: true, task: result.task };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteTask(taskId: string): Promise<{ success: boolean; error?: string }> {
        try {
            await this.request('mcp__vespera-scriptorium__delete_task', {
                task_id: taskId,
                recursive: true
            });
            return { success: true };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async getDashboard(options?: {
        project_id?: string;
        max_recent_tasks?: number;
        max_task_details?: number;
    }): Promise<{ success: boolean; dashboard?: any; error?: string }> {
        try {
            const result = await this.request('mcp__vespera-scriptorium__get_task_dashboard', options || {});
            return { success: true, dashboard: result.dashboard };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async executeTask(taskId: string, dryRun: boolean = false): Promise<{ success: boolean; result?: any; error?: string }> {
        try {
            const result = await this.request('mcp__vespera-scriptorium__execute_task', {
                task_id: taskId,
                dry_run: dryRun
            });
            return { success: true, result };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    // Connection status check for plugin integration
    isConnected(): boolean {
        return this.connectionInfo.state === MCPConnectionState.CONNECTED;
    }

    // Real-time subscription methods (simplified)
    async subscribeToTaskUpdates(callback: (task: any) => void): Promise<void> {
        this.on('notification', (message) => {
            if (message.method === 'task/updated') {
                callback(message.params.task);
            }
        });
    }

    async subscribeToRoleChanges(callback: (role: any) => void): Promise<void> {
        this.on('notification', (message) => {
            if (message.method === 'role/changed') {
                callback(message.params.role);
            }
        });
    }

    async unsubscribeFromTaskUpdates(): Promise<void> {
        // Remove specific listeners - simplified implementation
        this.removeAllListeners('task/updated');
    }

    async unsubscribeFromRoleChanges(): Promise<void> {
        // Remove specific listeners - simplified implementation
        this.removeAllListeners('role/changed');
    }
}

/**
 * Factory function to create MCP client instances
 */
export function createMCPClient(config: MCPClientConfig): VesperaMCPClient {
    return new MCPClient(config);
}

/**
 * Default configuration for connecting to local Vespera Scriptorium
 */
export const defaultVesperaConfig: MCPClientConfig = {
    connection: {
        transport: {
            type: 'websocket',
            endpoint: 'ws://localhost:3001/mcp',
            timeout: 30000,
            reconnectDelay: 5000,
            maxReconnectAttempts: 5
        },
        clientInfo: {
            name: 'vespera-obsidian-plugin',
            version: '1.0.0'
        },
        capabilities: {
            tools: [],
            resources: [],
            prompts: []
        },
        timeout: 30000,
        heartbeatInterval: 60000
    },
    debug: false,
    logLevel: 'info'
};