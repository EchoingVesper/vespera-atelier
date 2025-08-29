import { App, Editor, MarkdownView, Notice, Plugin, PluginSettingTab, Setting, WorkspaceLeaf, View } from 'obsidian';
import { VesperaMCPClient } from './src/mcp/client';
import { TaskManagerView, TASK_MANAGER_VIEW_TYPE } from './src/ui/TaskManagerView';
import { ObsidianVaultAdapter } from './src/adapters/obsidian-adapter';

interface VesperaScriptoriumSettings {
	mcpServerUrl: string;
	mcpServerPort: number;
	autoConnect: boolean;
	showStatusBar: boolean;
	defaultWorkingDirectory: string;
}

const DEFAULT_SETTINGS: VesperaScriptoriumSettings = {
	mcpServerUrl: 'ws://localhost:8000',
	mcpServerPort: 8000,
	autoConnect: true,
	showStatusBar: true,
	defaultWorkingDirectory: ''
}

export default class VesperaScriptoriumPlugin extends Plugin {
	settings: VesperaScriptoriumSettings;
	mcpClient: VesperaMCPClient;
	vaultAdapter: ObsidianVaultAdapter;
	statusBarItem: HTMLElement;

	async onload() {
		console.log('Loading Vespera Scriptorium plugin...');
		await this.loadSettings();

		// Initialize vault adapter
		this.vaultAdapter = new ObsidianVaultAdapter(this.app, this);

		// Initialize MCP client
		this.mcpClient = new VesperaMCPClient({
			serverUrl: this.settings.mcpServerUrl,
			timeout: 30000,
			retryAttempts: 3
		});

		// Register task manager view
		this.registerView(
			TASK_MANAGER_VIEW_TYPE,
			(leaf) => new TaskManagerView(leaf, this.mcpClient, this.vaultAdapter)
		);

		// Add ribbon icon for task manager
		const ribbonIconEl = this.addRibbonIcon('checklist', 'Vespera Task Manager', () => {
			this.activateTaskManagerView();
		});
		ribbonIconEl.addClass('vespera-scriptorium-ribbon-class');

		// Add status bar if enabled
		if (this.settings.showStatusBar) {
			this.statusBarItem = this.addStatusBarItem();
			this.updateStatusBar('Disconnected');
		}

		// Add commands
		this.addCommand({
			id: 'open-task-manager',
			name: 'Open Task Manager',
			callback: () => {
				this.activateTaskManagerView();
			}
		});

		this.addCommand({
			id: 'create-task-from-note',
			name: 'Create Task from Current Note',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				this.createTaskFromCurrentNote(editor, view);
			}
		});

		this.addCommand({
			id: 'connect-mcp-server',
			name: 'Connect to MCP Server',
			callback: async () => {
				await this.connectToMCPServer();
			}
		});

		this.addCommand({
			id: 'disconnect-mcp-server', 
			name: 'Disconnect from MCP Server',
			callback: () => {
				this.disconnectFromMCPServer();
			}
		});

		// Add settings tab
		this.addSettingTab(new VesperaScriptoriumSettingTab(this.app, this));

		// Setup MCP client event handlers
		this.setupMCPEventHandlers();

		// Auto-connect if enabled
		if (this.settings.autoConnect) {
			setTimeout(() => this.connectToMCPServer(), 1000);
		}

		console.log('Vespera Scriptorium plugin loaded successfully');
	}

	async onunload() {
		console.log('Unloading Vespera Scriptorium plugin...');
		
		// Disconnect from MCP server
		if (this.mcpClient) {
			await this.mcpClient.disconnect();
		}
		
		// Clean up vault adapter
		if (this.vaultAdapter) {
			this.vaultAdapter.cleanup();
		}
		
		console.log('Vespera Scriptorium plugin unloaded');
	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}

	// Task Manager View Management
	async activateTaskManagerView() {
		const { workspace } = this.app;
		
		let leaf: WorkspaceLeaf | null = null;
		const leaves = workspace.getLeavesOfType(TASK_MANAGER_VIEW_TYPE);
		
		if (leaves.length > 0) {
			// If task manager view already exists, activate it
			leaf = leaves[0];
		} else {
			// Create new task manager view in right sidebar
			leaf = workspace.getRightLeaf(false);
			await leaf.setViewState({ type: TASK_MANAGER_VIEW_TYPE, active: true });
		}
		
		workspace.revealLeaf(leaf);
	}

	// MCP Connection Management
	async connectToMCPServer() {
		try {
			this.updateStatusBar('Connecting...');
			await this.mcpClient.connect();
			this.updateStatusBar('Connected');
			new Notice('✅ Connected to Vespera Scriptorium server');
		} catch (error) {
			this.updateStatusBar('Connection Failed');
			
			// Provide more detailed error feedback
			let errorMessage = 'Failed to connect to server';
			let duration = 8000; // Longer duration for error messages
			
			if (error.message.includes('ECONNREFUSED')) {
				errorMessage = '❌ Server not running - Start Vespera Scriptorium MCP server first';
			} else if (error.message.includes('timeout')) {
				errorMessage = '⏰ Connection timeout - Check server URL and network';
			} else if (error.message.includes('WebSocket')) {
				errorMessage = `🌐 WebSocket error: ${error.message}`;
			} else if (error.message.includes('unauthorized') || error.message.includes('403')) {
				errorMessage = '🔒 Authentication failed - Check server credentials';
			} else {
				errorMessage = `❌ Connection failed: ${error.message}`;
			}
			
			new Notice(errorMessage, duration);
			console.error('MCP connection failed:', {
				error: error.message,
				stack: error.stack,
				serverUrl: this.settings.mcpServerUrl,
				timestamp: new Date().toISOString()
			});
		}
	}

	disconnectFromMCPServer() {
		if (this.mcpClient) {
			this.mcpClient.disconnect();
			this.updateStatusBar('Disconnected');
			new Notice('Disconnected from Vespera Scriptorium server');
		}
	}

	setupMCPEventHandlers() {
		this.mcpClient.on('connected', () => {
			this.updateStatusBar('Connected');
		});

		this.mcpClient.on('disconnected', () => {
			this.updateStatusBar('Disconnected');
		});

		this.mcpClient.on('error', (error: Error) => {
			this.updateStatusBar('Error');
			new Notice(`MCP Error: ${error.message}`, 5000);
		});

		this.mcpClient.on('task-updated', (taskData: any) => {
			// Refresh task manager view if open
			const leaves = this.app.workspace.getLeavesOfType(TASK_MANAGER_VIEW_TYPE);
			leaves.forEach(leaf => {
				const view = leaf.view as TaskManagerView;
				view.refreshTasks();
			});
		});
	}

	updateStatusBar(status: string) {
		if (this.statusBarItem) {
			this.statusBarItem.setText(`Vespera: ${status}`);
		}
	}

	// Task Creation from Current Note
	async createTaskFromCurrentNote(editor: Editor, view: MarkdownView) {
		if (!this.mcpClient.isConnected()) {
			new Notice('Not connected to Vespera Scriptorium server');
			return;
		}

		const file = view.file;
		if (!file) {
			new Notice('No active file to create task from');
			return;
		}

		const selection = editor.getSelection();
		const taskDescription = selection || `Task based on note: ${file.basename}`;
		
		try {
			// Get current file context
			const fileContext = await this.vaultAdapter.getFileContext(file);
			
			// Create task through MCP client
			const result = await this.mcpClient.createTask({
				title: `Task from ${file.basename}`,
				description: taskDescription,
				project_id: this.vaultAdapter.getProjectIdFromPath(file.path),
				feature: 'vault-integration',
				metadata: {
					source_file: file.path,
					vault_path: this.app.vault.adapter.basePath,
					file_context: fileContext
				}
			});

			if (result.success) {
				new Notice(`Task created: ${result.task.title}`);
				
				// Optionally add task link to note
				if (selection) {
					const taskLink = `[[Task: ${result.task.id}]]`;
					editor.replaceSelection(`${selection}\n\n${taskLink}`);
				}
			} else {
				new Notice(`Failed to create task: ${result.error}`);
			}
		} catch (error) {
			new Notice(`Error creating task: ${error.message}`);
			console.error('Task creation error:', error);
		}
	}
}

class VesperaScriptoriumSettingTab extends PluginSettingTab {
	plugin: VesperaScriptoriumPlugin;

	constructor(app: App, plugin: VesperaScriptoriumPlugin) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		containerEl.createEl('h2', {text: 'Vespera Scriptorium Settings'});

		// MCP Server Connection Settings
		containerEl.createEl('h3', {text: 'MCP Server Connection'});

		new Setting(containerEl)
			.setName('Server URL')
			.setDesc('WebSocket URL for the Vespera Scriptorium MCP server')
			.addText(text => text
				.setPlaceholder('ws://localhost:8000')
				.setValue(this.plugin.settings.mcpServerUrl)
				.onChange(async (value) => {
					this.plugin.settings.mcpServerUrl = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Auto-connect on startup')
			.setDesc('Automatically connect to MCP server when Obsidian starts')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.autoConnect)
				.onChange(async (value) => {
					this.plugin.settings.autoConnect = value;
					await this.plugin.saveSettings();
				}));

		// UI Settings
		containerEl.createEl('h3', {text: 'User Interface'});

		new Setting(containerEl)
			.setName('Show status bar')
			.setDesc('Display connection status in the status bar')
			.addToggle(toggle => toggle
				.setValue(this.plugin.settings.showStatusBar)
				.onChange(async (value) => {
					this.plugin.settings.showStatusBar = value;
					await this.plugin.saveSettings();
					
					// Update status bar visibility
					if (value && !this.plugin.statusBarItem) {
						this.plugin.statusBarItem = this.plugin.addStatusBarItem();
						this.plugin.updateStatusBar('Disconnected');
					} else if (!value && this.plugin.statusBarItem) {
						this.plugin.statusBarItem.remove();
						this.plugin.statusBarItem = null;
					}
				}));

		new Setting(containerEl)
			.setName('Default working directory')
			.setDesc('Default directory for task execution (relative to vault root)')
			.addText(text => text
				.setPlaceholder('Leave empty to use vault root')
				.setValue(this.plugin.settings.defaultWorkingDirectory)
				.onChange(async (value) => {
					this.plugin.settings.defaultWorkingDirectory = value;
					await this.plugin.saveSettings();
				}));

		// Connection Test Button
		new Setting(containerEl)
			.setName('Test Connection')
			.setDesc('Test connection to the MCP server')
			.addButton(button => button
				.setButtonText('Test Connection')
				.setCta()
				.onClick(async () => {
					button.setButtonText('Testing...');
					button.setDisabled(true);
					
					try {
						await this.plugin.connectToMCPServer();
						button.setButtonText('✓ Connected');
						setTimeout(() => {
							button.setButtonText('Test Connection');
							button.setDisabled(false);
						}, 2000);
					} catch (error) {
						button.setButtonText('✗ Failed');
						setTimeout(() => {
							button.setButtonText('Test Connection');
							button.setDisabled(false);
						}, 2000);
					}
				}));
	}
}
