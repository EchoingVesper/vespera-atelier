/**
 * Obsidian Plugin Entry Point
 * Vespera Forge Obsidian Plugin
 */

import { App, Plugin, PluginSettingTab, Setting, WorkspaceLeaf } from 'obsidian';
import { ObsidianAdapter } from '../core/adapters/obsidian-adapter';
import VesperaForge from '../components/core/VesperaForge';

interface VesperaForgeSettings {
    defaultTemplate: string;
    autoSave: boolean;
    aiEnabled: boolean;
    theme: 'light' | 'dark' | 'auto';
}

const DEFAULT_SETTINGS: VesperaForgeSettings = {
    defaultTemplate: 'character',
    autoSave: true,
    aiEnabled: true,
    theme: 'auto'
}

export default class VesperaForgePlugin extends Plugin {
    settings: VesperaForgeSettings;
    adapter: ObsidianAdapter;
    vesperaForgeLeaf: WorkspaceLeaf | null = null;

    async onload() {
        console.log('Loading Vespera Forge plugin');

        // Load settings
        await this.loadSettings();

        // Create adapter
        this.adapter = new ObsidianAdapter(this.app);

        // Register workspace leaf
        this.registerView(
            VESPERA_FORGE_VIEW_TYPE,
            (leaf) => new VesperaForgeView(leaf, this)
        );

        // Add ribbon icon
        this.addRibbonIcon('book', 'Vespera Forge', (evt: MouseEvent) => {
            this.activateView();
        });

        // Add commands
        this.addCommands();

        // Add settings tab
        this.addSettingTab(new VesperaForgeSettingTab(this.app, this));

        // Initialize adapter
        this.adapter.onload();

        // Auto-open if configured
        if (this.settings.autoSave) {
            this.app.workspace.onLayoutReady(() => {
                setTimeout(() => this.activateView(), 1000);
            });
        }
    }

    onunload() {
        console.log('Unloading Vespera Forge plugin');
        this.adapter.onunload();
    }

    async loadSettings() {
        this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
    }

    async saveSettings() {
        await this.saveData(this.settings);
    }

    addCommands() {
        // Open Vespera Forge
        this.addCommand({
            id: 'open-vespera-forge',
            name: 'Open Vespera Forge',
            callback: () => {
                this.activateView();
            }
        });

        // Create new character
        this.addCommand({
            id: 'create-character',
            name: 'Create Character',
            callback: () => {
                this.activateView();
                setTimeout(() => {
                    if (this.vesperaForgeLeaf) {
                        this.vesperaForgeLeaf.view.containerEl.postMessage({
                            type: 'createCodex',
                            payload: { templateId: 'character' }
                        });
                    }
                }, 500);
            }
        });

        // Create new task
        this.addCommand({
            id: 'create-task',
            name: 'Create Task',
            callback: () => {
                this.activateView();
                setTimeout(() => {
                    if (this.vesperaForgeLeaf) {
                        this.vesperaForgeLeaf.view.containerEl.postMessage({
                            type: 'createCodex',
                            payload: { templateId: 'task' }
                        });
                    }
                }, 500);
            }
        });

        // Create new scene
        this.addCommand({
            id: 'create-scene',
            name: 'Create Scene',
            callback: () => {
                this.activateView();
                setTimeout(() => {
                    if (this.vesperaForgeLeaf) {
                        this.vesperaForgeLeaf.view.containerEl.postMessage({
                            type: 'createCodex',
                            payload: { templateId: 'scene' }
                        });
                    }
                }, 500);
            }
        });
    }

    async activateView() {
        const { workspace } = this.app;

        let leaf: WorkspaceLeaf | null = null;
        const leaves = workspace.getLeavesOfType(VESPERA_FORGE_VIEW_TYPE);

        if (leaves.length > 0) {
            // A leaf with our view already exists, use that
            leaf = leaves[0];
        } else {
            // Create a new leaf in the right sidebar
            leaf = workspace.getRightLeaf(false);
            await leaf?.setViewState({ type: VESPERA_FORGE_VIEW_TYPE, active: true });
        }

        // Reveal the leaf in the UI
        if (leaf) {
            workspace.revealLeaf(leaf);
            this.vesperaForgeLeaf = leaf;
        }
    }
}

const VESPERA_FORGE_VIEW_TYPE = 'vespera-forge-view';

class VesperaForgeView extends ItemView {
    plugin: VesperaForgePlugin;
    adapter: ObsidianAdapter;

    constructor(leaf: WorkspaceLeaf, plugin: VesperaForgePlugin) {
        super(leaf);
        this.plugin = plugin;
        this.adapter = plugin.adapter;
    }

    getViewType() {
        return VESPERA_FORGE_VIEW_TYPE;
    }

    getDisplayText() {
        return 'Vespera Forge';
    }

    getIcon() {
        return 'book';
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        container.addClass('vespera-forge-container');

        // Create the React app container
        const rootEl = container.createDiv('vespera-forge-root');
        
        // Load the React app
        this.loadReactApp(rootEl);

        // Set up message handling
        this.setupMessageHandling();
    }

    async onClose() {
        // Nothing to clean up
    }

    async loadReactApp(containerEl: HTMLElement) {
        // In a real implementation, this would load the compiled React app
        // For now, we'll create a placeholder
        containerEl.innerHTML = `
            <div style="padding: 20px; text-align: center;">
                <h2>Vespera Forge</h2>
                <p>Loading...</p>
                <p>This would load the React application here.</p>
            </div>
        `;

        // In a real implementation, you would:
        // 1. Load the compiled JavaScript bundle
        // 2. Initialize the React app with the adapter
        // 3. Pass the Obsidian API to the adapter
    }

    setupMessageHandling() {
        // Handle messages from the React app
        this.containerEl.addEventListener('message', (event) => {
            const message = event.data;
            this.handleMessage(message);
        });
    }

    async handleMessage(message: any) {
        switch (message.type) {
            case 'openFile':
                const file = this.app.vault.getAbstractFileByPath(message.payload.path);
                if (file) {
                    await this.app.workspace.getLeaf().openFile(file);
                }
                break;
            case 'saveFile':
                try {
                    const file = this.app.vault.getAbstractFileByPath(message.payload.path);
                    if (file) {
                        await this.app.vault.write(file, message.payload.content);
                    } else {
                        await this.app.vault.create(message.payload.path, message.payload.content);
                    }
                    this.containerEl.postMessage({
                        id: message.id,
                        success: true
                    });
                } catch (error) {
                    this.containerEl.postMessage({
                        id: message.id,
                        success: false,
                        error: error.message
                    });
                }
                break;
            case 'showNotification':
                // Use Obsidian's notice system
                new Notice(message.payload.message);
                break;
        }
    }
}

class VesperaForgeSettingTab extends PluginSettingTab {
    plugin: VesperaForgePlugin;

    constructor(app: App, plugin: VesperaForgePlugin) {
        super(app, plugin);
        this.plugin = plugin;
    }

    display(): void {
        const { containerEl } = this;
        containerEl.empty();

        containerEl.createEl('h2', { text: 'Vespera Forge Settings' });

        new Setting(containerEl)
            .setName('Default Template')
            .setDesc('Default template to use when creating new codices')
            .addDropdown(dropdown => dropdown
                .addOption('character', 'Character')
                .addOption('task', 'Task')
                .addOption('scene', 'Scene')
                .addOption('music', 'Music')
                .addOption('playlist', 'Playlist')
                .setValue(this.plugin.settings.defaultTemplate)
                .onChange(async (value) => {
                    this.plugin.settings.defaultTemplate = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Auto Save')
            .setDesc('Automatically save changes to codices')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.autoSave)
                .onChange(async (value) => {
                    this.plugin.settings.autoSave = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Enable AI Assistant')
            .setDesc('Enable AI-powered assistance for content creation')
            .addToggle(toggle => toggle
                .setValue(this.plugin.settings.aiEnabled)
                .onChange(async (value) => {
                    this.plugin.settings.aiEnabled = value;
                    await this.plugin.saveSettings();
                }));

        new Setting(containerEl)
            .setName('Theme')
            .setDesc('Choose the theme for Vespera Forge')
            .addDropdown(dropdown => dropdown
                .addOption('light', 'Light')
                .addOption('dark', 'Dark')
                .addOption('auto', 'Auto')
                .setValue(this.plugin.settings.theme)
                .onChange(async (value) => {
                    this.plugin.settings.theme = value as 'light' | 'dark' | 'auto';
                    await this.plugin.saveSettings();
                }));
    }
}