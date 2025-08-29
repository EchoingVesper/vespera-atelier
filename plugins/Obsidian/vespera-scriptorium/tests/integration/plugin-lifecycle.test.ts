/**
 * Integration tests for Obsidian plugin lifecycle and MCP client connection.
 * 
 * Tests the complete plugin loading, MCP connection, and task management workflow.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { App, Vault, Workspace, MetadataCache } from 'obsidian';
import VesperaScriptoriumPlugin from '../../main';
import { VesperaMCPClient } from '../../src/mcp/client';
import { TaskManagerView, TASK_MANAGER_VIEW_TYPE } from '../../src/ui/TaskManagerView';

// Mock Obsidian App and related objects
const mockApp = {
    vault: {
        adapter: {
            basePath: '/mock/vault/path'
        }
    } as Vault,
    workspace: {
        getLeavesOfType: vi.fn(() => []),
        getRightLeaf: vi.fn(() => mockLeaf),
        revealLeaf: vi.fn()
    } as Workspace,
    metadataCache: {} as MetadataCache
} as App;

const mockLeaf = {
    setViewState: vi.fn().mockResolvedValue(undefined),
    view: undefined
};

// Mock MCP Client for testing
class MockMCPClient {
    private connected = false;
    private eventHandlers = new Map<string, Function[]>();

    async connect(): Promise<void> {
        this.connected = true;
        this.emit('connect');
    }

    async disconnect(): Promise<void> {
        this.connected = false;
        this.emit('disconnect');
    }

    isConnected(): boolean {
        return this.connected;
    }

    on(event: string, handler: Function): void {
        if (!this.eventHandlers.has(event)) {
            this.eventHandlers.set(event, []);
        }
        this.eventHandlers.get(event)!.push(handler);
    }

    emit(event: string, ...args: any[]): void {
        const handlers = this.eventHandlers.get(event);
        if (handlers) {
            handlers.forEach(handler => handler(...args));
        }
    }

    async listTasks(): Promise<{ success: boolean; tasks: any[] }> {
        return {
            success: true,
            tasks: [
                {
                    id: 'test-task-1',
                    title: 'Test Task',
                    description: 'A test task',
                    status: 'todo',
                    priority: 'normal',
                    created_at: new Date().toISOString(),
                    updated_at: new Date().toISOString()
                }
            ]
        };
    }

    async createTask(taskData: any): Promise<{ success: boolean; task: any }> {
        return {
            success: true,
            task: {
                id: 'new-task-' + Date.now(),
                ...taskData,
                created_at: new Date().toISOString(),
                updated_at: new Date().toISOString()
            }
        };
    }

    async getDashboard(): Promise<{ success: boolean; dashboard: any }> {
        return {
            success: true,
            dashboard: {
                statistics: { total_tasks: 1, todo: 1, doing: 0, review: 0, done: 0 },
                recent_tasks: [],
                project_info: { projects: [] }
            }
        };
    }
}

describe('Plugin Lifecycle Integration', () => {
    let plugin: VesperaScriptoriumPlugin;
    let mockMCPClient: MockMCPClient;

    beforeEach(() => {
        // Create plugin instance
        plugin = new VesperaScriptoriumPlugin(mockApp, {
            id: 'vespera-scriptorium',
            name: 'Vespera Scriptorium',
            author: 'Test',
            version: '1.0.0',
            minAppVersion: '0.15.0',
            description: 'Test plugin'
        });

        // Mock the MCP client creation
        mockMCPClient = new MockMCPClient();
        vi.spyOn(plugin, 'mcpClient' as any).mockImplementation(() => mockMCPClient);
    });

    afterEach(async () => {
        if (plugin) {
            await plugin.onunload();
        }
        vi.clearAllMocks();
    });

    it('should load plugin and initialize MCP client', async () => {
        // Mock plugin methods
        plugin.loadSettings = vi.fn().mockResolvedValue(undefined);
        plugin.addSettingTab = vi.fn();
        plugin.addCommand = vi.fn();
        plugin.addRibbonIcon = vi.fn().mockReturnValue({ addClass: vi.fn() });
        plugin.addStatusBarItem = vi.fn().mockReturnValue({ setText: vi.fn() });
        plugin.registerView = vi.fn();

        // Override MCP client creation
        plugin.mcpClient = mockMCPClient as any;
        plugin.vaultAdapter = {
            getFileContext: vi.fn(),
            getProjectIdFromPath: vi.fn(),
            cleanup: vi.fn()
        } as any;

        await plugin.onload();

        // Verify plugin initialization
        expect(plugin.loadSettings).toHaveBeenCalled();
        expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({
            id: 'open-task-manager'
        }));
        expect(plugin.addCommand).toHaveBeenCalledWith(expect.objectContaining({
            id: 'create-task-from-note'
        }));
        expect(plugin.registerView).toHaveBeenCalledWith(
            TASK_MANAGER_VIEW_TYPE,
            expect.any(Function)
        );
    });

    it('should connect to MCP server on auto-connect', async () => {
        // Setup auto-connect
        plugin.settings = {
            mcpServerUrl: 'ws://localhost:8000',
            mcpServerPort: 8000,
            autoConnect: true,
            showStatusBar: true,
            defaultWorkingDirectory: ''
        };

        plugin.loadSettings = vi.fn().mockResolvedValue(undefined);
        plugin.addSettingTab = vi.fn();
        plugin.addCommand = vi.fn();
        plugin.addRibbonIcon = vi.fn().mockReturnValue({ addClass: vi.fn() });
        plugin.addStatusBarItem = vi.fn().mockReturnValue({ setText: vi.fn() });
        plugin.registerView = vi.fn();
        plugin.updateStatusBar = vi.fn();

        plugin.mcpClient = mockMCPClient as any;
        plugin.vaultAdapter = {
            getFileContext: vi.fn(),
            getProjectIdFromPath: vi.fn(),
            cleanup: vi.fn()
        } as any;

        const connectSpy = vi.spyOn(mockMCPClient, 'connect');

        await plugin.onload();

        // Wait for auto-connect timeout
        await new Promise(resolve => setTimeout(resolve, 1100));

        expect(connectSpy).toHaveBeenCalled();
        expect(mockMCPClient.isConnected()).toBe(true);
    });

    it('should handle MCP connection events', async () => {
        plugin.settings = {
            mcpServerUrl: 'ws://localhost:8000',
            mcpServerPort: 8000,
            autoConnect: false,
            showStatusBar: true,
            defaultWorkingDirectory: ''
        };

        plugin.loadSettings = vi.fn().mockResolvedValue(undefined);
        plugin.addSettingTab = vi.fn();
        plugin.addCommand = vi.fn();
        plugin.addRibbonIcon = vi.fn().mockReturnValue({ addClass: vi.fn() });
        plugin.addStatusBarItem = vi.fn().mockReturnValue({ setText: vi.fn() });
        plugin.registerView = vi.fn();
        plugin.updateStatusBar = vi.fn();

        plugin.mcpClient = mockMCPClient as any;
        plugin.vaultAdapter = {
            getFileContext: vi.fn(),
            getProjectIdFromPath: vi.fn(),
            cleanup: vi.fn()
        } as any;

        await plugin.onload();

        // Test connection event handling
        await mockMCPClient.connect();
        expect(plugin.updateStatusBar).toHaveBeenCalledWith('Connected');

        await mockMCPClient.disconnect();
        expect(plugin.updateStatusBar).toHaveBeenCalledWith('Disconnected');
    });

    it('should create task from current note', async () => {
        const mockEditor = {
            getSelection: vi.fn().mockReturnValue('Selected text for task'),
            replaceSelection: vi.fn()
        };

        const mockView = {
            file: {
                basename: 'Test Note',
                path: 'Test Note.md'
            }
        };

        plugin.mcpClient = mockMCPClient as any;
        plugin.vaultAdapter = {
            getFileContext: vi.fn().mockResolvedValue('file context'),
            getProjectIdFromPath: vi.fn().mockReturnValue('test-project'),
            cleanup: vi.fn()
        } as any;

        const createTaskSpy = vi.spyOn(mockMCPClient, 'createTask');

        await mockMCPClient.connect();
        await plugin.createTaskFromCurrentNote(mockEditor as any, mockView as any);

        expect(createTaskSpy).toHaveBeenCalledWith(expect.objectContaining({
            title: 'Task from Test Note',
            description: 'Selected text for task',
            project_id: 'test-project',
            feature: 'vault-integration'
        }));
    });

    it('should activate task manager view', async () => {
        plugin.mcpClient = mockMCPClient as any;
        plugin.vaultAdapter = {
            getFileContext: vi.fn(),
            getProjectIdFromPath: vi.fn(),
            cleanup: vi.fn()
        } as any;

        const mockWorkspace = mockApp.workspace as any;
        mockWorkspace.getLeavesOfType.mockReturnValue([]); // No existing views

        await plugin.activateTaskManagerView();

        expect(mockWorkspace.getRightLeaf).toHaveBeenCalledWith(false);
        expect(mockLeaf.setViewState).toHaveBeenCalledWith({
            type: TASK_MANAGER_VIEW_TYPE,
            active: true
        });
        expect(mockWorkspace.revealLeaf).toHaveBeenCalledWith(mockLeaf);
    });

    it('should cleanup on unload', async () => {
        plugin.mcpClient = mockMCPClient as any;
        plugin.vaultAdapter = {
            getFileContext: vi.fn(),
            getProjectIdFromPath: vi.fn(),
            cleanup: vi.fn()
        } as any;

        const disconnectSpy = vi.spyOn(mockMCPClient, 'disconnect');
        const cleanupSpy = vi.spyOn(plugin.vaultAdapter, 'cleanup');

        await mockMCPClient.connect();
        await plugin.onunload();

        expect(disconnectSpy).toHaveBeenCalled();
        expect(cleanupSpy).toHaveBeenCalled();
    });
});

describe('Task Manager View Integration', () => {
    let taskManagerView: TaskManagerView;
    let mockMCPClient: MockMCPClient;
    let mockLeaf: any;

    beforeEach(() => {
        mockMCPClient = new MockMCPClient();
        mockLeaf = {
            view: undefined,
            setViewState: vi.fn()
        };

        const mockVaultAdapter = {
            getFileContext: vi.fn().mockResolvedValue('context'),
            getProjectIdFromPath: vi.fn().mockReturnValue('test-project'),
            cleanup: vi.fn()
        };

        taskManagerView = new TaskManagerView(
            mockLeaf,
            mockMCPClient as any,
            mockVaultAdapter as any
        );
    });

    it('should refresh tasks when MCP client is connected', async () => {
        await mockMCPClient.connect();

        const listTasksSpy = vi.spyOn(mockMCPClient, 'listTasks');
        const getDashboardSpy = vi.spyOn(mockMCPClient, 'getDashboard');

        await taskManagerView.refreshTasks();

        expect(listTasksSpy).toHaveBeenCalled();
        expect(getDashboardSpy).toHaveBeenCalled();
    });

    it('should show connection prompt when MCP client is disconnected', async () => {
        // Mock DOM manipulation
        const containerEl = {
            children: [null, { 
                empty: vi.fn(),
                createEl: vi.fn().mockImplementation((tag, options) => ({
                    createEl: vi.fn().mockReturnValue({ onclick: null }),
                    onclick: null
                }))
            }]
        };
        taskManagerView.containerEl = containerEl as any;

        await taskManagerView.refreshTasks();

        expect(containerEl.children[1].empty).toHaveBeenCalled();
        expect(containerEl.children[1].createEl).toHaveBeenCalled();
    });
});