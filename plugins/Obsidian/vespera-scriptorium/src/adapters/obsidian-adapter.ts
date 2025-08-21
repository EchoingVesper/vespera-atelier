/**
 * Obsidian API Adapter
 * 
 * Bridges between Obsidian's API and the MCP client, providing
 * seamless integration between vault operations and task management.
 */

import { App, TFile, TFolder, Vault, MetadataCache, Notice } from 'obsidian';
import { VesperaMCPClient } from '../mcp/interfaces';
import { ObsidianMCPIntegration } from '../mcp/interfaces';

export interface VaultTaskData {
    file: TFile;
    frontmatter: any;
    taskData: any;
    lastSync: Date;
}

export interface ProjectContext {
    activeFile?: TFile;
    activeProject?: string;
    selectedText?: string;
    cursorPosition?: number;
    noteProperties?: any;
}

/**
 * Main adapter class that integrates Obsidian with Vespera Scriptorium
 */
export class ObsidianVesperaAdapter implements ObsidianMCPIntegration {
    private app: App;
    private mcpClient: VesperaMCPClient;
    private taskFileMap: Map<string, VaultTaskData> = new Map();
    private syncInProgress = false;

    constructor(app: App, mcpClient: VesperaMCPClient) {
        this.app = app;
        this.mcpClient = mcpClient;
        this.setupVaultWatchers();
    }

    /**
     * Set up file system watchers to detect changes in the vault
     */
    private setupVaultWatchers(): void {
        // Watch for file modifications
        this.app.vault.on('modify', this.handleFileModified.bind(this));
        
        // Watch for file creation
        this.app.vault.on('create', this.handleFileCreated.bind(this));
        
        // Watch for file deletion
        this.app.vault.on('delete', this.handleFileDeleted.bind(this));
        
        // Watch for file renames
        this.app.vault.on('rename', this.handleFileRenamed.bind(this));
    }

    /**
     * Handle file modification events
     */
    private async handleFileModified(file: TFile): Promise<void> {
        if (this.syncInProgress) return;
        
        // Check if this file represents a task
        if (this.isTaskFile(file)) {
            await this.syncFileToTask(file);
        }
    }

    /**
     * Handle file creation events
     */
    private async handleFileCreated(file: TFile): Promise<void> {
        if (this.syncInProgress) return;
        
        if (this.isTaskFile(file)) {
            await this.createTaskFromFile(file);
        }
    }

    /**
     * Handle file deletion events
     */
    private async handleFileDeleted(file: TFile): Promise<void> {
        if (this.syncInProgress) return;
        
        const taskData = this.taskFileMap.get(file.path);
        if (taskData) {
            await this.deleteTaskFromVespera(taskData.taskData.id);
            this.taskFileMap.delete(file.path);
        }
    }

    /**
     * Handle file rename events
     */
    private async handleFileRenamed(file: TFile, oldPath: string): Promise<void> {
        if (this.syncInProgress) return;
        
        const taskData = this.taskFileMap.get(oldPath);
        if (taskData) {
            this.taskFileMap.delete(oldPath);
            this.taskFileMap.set(file.path, {
                ...taskData,
                file
            });
            
            // Update task title if it was based on filename
            await this.syncFileToTask(file);
        }
    }

    /**
     * Check if a file represents a task based on frontmatter or location
     */
    private isTaskFile(file: TFile): boolean {
        // Check if file is in a tasks folder
        if (file.path.includes('/tasks/') || file.path.includes('/Tasks/')) {
            return true;
        }
        
        // Check frontmatter for task properties
        const cache = this.app.metadataCache.getFileCache(file);
        if (cache?.frontmatter) {
            return !!(
                cache.frontmatter.task_id ||
                cache.frontmatter.vespera_task ||
                cache.frontmatter.status ||
                cache.frontmatter.priority
            );
        }
        
        return false;
    }

    /**
     * Sync a file's content to Vespera task system
     */
    private async syncFileToTask(file: TFile): Promise<void> {
        try {
            const content = await this.app.vault.read(file);
            const cache = this.app.metadataCache.getFileCache(file);
            const frontmatter = cache?.frontmatter || {};
            
            const taskData = this.extractTaskDataFromFile(file, content, frontmatter);
            
            if (frontmatter.task_id) {
                // Update existing task
                await this.mcpClient.updateTask(frontmatter.task_id, taskData);
            } else {
                // Create new task
                const result = await this.mcpClient.createTask(taskData);
                
                // Update file with task ID
                await this.updateFileFrontmatter(file, {
                    task_id: result.task.id,
                    vespera_task: true,
                    last_sync: new Date().toISOString()
                });
            }
            
            this.taskFileMap.set(file.path, {
                file,
                frontmatter,
                taskData,
                lastSync: new Date()
            });
            
        } catch (error) {
            new Notice(`Failed to sync task: ${error.message}`);
            console.error('Task sync error:', error);
        }
    }

    /**
     * Create a task from a file
     */
    private async createTaskFromFile(file: TFile): Promise<void> {
        const content = await this.app.vault.read(file);
        const cache = this.app.metadataCache.getFileCache(file);
        const frontmatter = cache?.frontmatter || {};
        
        if (frontmatter.task_id) {
            return; // Already has a task ID
        }
        
        const taskData = this.extractTaskDataFromFile(file, content, frontmatter);
        
        try {
            const result = await this.mcpClient.createTask(taskData);
            
            await this.updateFileFrontmatter(file, {
                task_id: result.task.id,
                vespera_task: true,
                created_at: new Date().toISOString()
            });
            
        } catch (error) {
            new Notice(`Failed to create task: ${error.message}`);
            console.error('Task creation error:', error);
        }
    }

    /**
     * Extract task data from file content and frontmatter
     */
    private extractTaskDataFromFile(file: TFile, content: string, frontmatter: any): any {
        // Remove frontmatter from content
        const contentWithoutFrontmatter = content.replace(/^---\n.*?\n---\n/s, '');
        
        // Extract title (from frontmatter or filename)
        const title = frontmatter.title || file.basename;
        
        // Extract description (first paragraph or full content)
        const description = frontmatter.description || 
            contentWithoutFrontmatter.split('\n\n')[0] || 
            contentWithoutFrontmatter.substring(0, 200);
        
        return {
            title,
            description,
            status: frontmatter.status || 'todo',
            priority: frontmatter.priority || 'normal',
            project_id: frontmatter.project || this.getActiveProject(),
            role: frontmatter.role,
            tags: frontmatter.tags || [],
            due_date: frontmatter.due_date,
            metadata: {
                source_file: file.path,
                obsidian_link: `obsidian://open?vault=${encodeURIComponent(this.app.vault.getName())}&file=${encodeURIComponent(file.path)}`,
                content_preview: contentWithoutFrontmatter.substring(0, 500)
            }
        };
    }

    /**
     * Update file frontmatter with new properties
     */
    private async updateFileFrontmatter(file: TFile, updates: any): Promise<void> {
        this.syncInProgress = true;
        
        try {
            await this.app.fileManager.processFrontMatter(file, (frontmatter) => {
                Object.assign(frontmatter, updates);
            });
        } finally {
            this.syncInProgress = false;
        }
    }

    /**
     * Delete a task from Vespera
     */
    private async deleteTaskFromVespera(taskId: string): Promise<void> {
        try {
            await this.mcpClient.deleteTask(taskId);
        } catch (error) {
            console.error('Failed to delete task from Vespera:', error);
        }
    }

    // ObsidianMCPIntegration interface implementation

    async syncVaultWithTasks(): Promise<void> {
        this.syncInProgress = true;
        
        try {
            // Get all task files in vault
            const taskFiles = this.app.vault.getMarkdownFiles()
                .filter(file => this.isTaskFile(file));
            
            // Sync each file
            for (const file of taskFiles) {
                await this.syncFileToTask(file);
            }
            
            new Notice(`Synced ${taskFiles.length} task files with Vespera Scriptorium`);
            
        } catch (error) {
            new Notice(`Sync failed: ${error.message}`);
            console.error('Vault sync error:', error);
        } finally {
            this.syncInProgress = false;
        }
    }

    async exportTasksToNotes(): Promise<void> {
        try {
            const tasks = await this.mcpClient.getTasks();
            
            // Create tasks folder if it doesn't exist
            const tasksFolder = 'Tasks';
            if (!this.app.vault.getAbstractFileByPath(tasksFolder)) {
                await this.app.vault.createFolder(tasksFolder);
            }
            
            for (const task of tasks) {
                await this.createNoteFromTask(task, tasksFolder);
            }
            
            new Notice(`Exported ${tasks.length} tasks to notes`);
            
        } catch (error) {
            new Notice(`Export failed: ${error.message}`);
            console.error('Export error:', error);
        }
    }

    async importNotesAsTasks(): Promise<void> {
        try {
            const selectedFiles = this.getSelectedFiles();
            let imported = 0;
            
            for (const file of selectedFiles) {
                if (!this.isTaskFile(file)) {
                    await this.createTaskFromFile(file);
                    imported++;
                }
            }
            
            new Notice(`Imported ${imported} notes as tasks`);
            
        } catch (error) {
            new Notice(`Import failed: ${error.message}`);
            console.error('Import error:', error);
        }
    }

    async showTaskInModal(taskId: string): Promise<void> {
        // This would open the task editor modal
        // Implementation depends on the modal system
        console.log(`Opening task modal for: ${taskId}`);
    }

    updateStatusBar(status: string): void {
        // Update the status bar with connection/sync status
        const statusBarEl = this.app.statusBar?.createEl('span');
        if (statusBarEl) {
            statusBarEl.setText(`Vespera: ${status}`);
        }
    }

    showNotification(message: string, type: 'info' | 'warn' | 'error'): void {
        new Notice(message, type === 'error' ? 8000 : 4000);
    }

    getCurrentNoteContext(): ProjectContext {
        const activeFile = this.app.workspace.getActiveFile();
        const cache = activeFile ? this.app.metadataCache.getFileCache(activeFile) : null;
        
        return {
            activeFile,
            activeProject: cache?.frontmatter?.project || this.getActiveProject(),
            selectedText: this.getSelectedText(),
            noteProperties: cache?.frontmatter
        };
    }

    getSelectedText(): string | null {
        const activeView = this.app.workspace.getActiveViewOfType(MarkdownView);
        if (activeView) {
            const editor = activeView.editor;
            return editor.getSelection() || null;
        }
        return null;
    }

    getActiveProject(): string | null {
        // Try to determine project from current note or folder structure
        const activeFile = this.app.workspace.getActiveFile();
        if (activeFile) {
            // Look for project indicators in path
            const pathParts = activeFile.path.split('/');
            if (pathParts.length > 1) {
                return pathParts[0]; // Use top-level folder as project
            }
        }
        return null;
    }

    /**
     * Helper methods
     */

    private async createNoteFromTask(task: any, folder: string): Promise<void> {
        const filename = this.sanitizeFilename(task.title);
        const filepath = `${folder}/${filename}.md`;
        
        // Check if file already exists
        if (this.app.vault.getAbstractFileByPath(filepath)) {
            return; // Skip existing files
        }
        
        const content = this.generateTaskFileContent(task);
        
        await this.app.vault.create(filepath, content);
    }

    private generateTaskFileContent(task: any): string {
        const frontmatter = {
            task_id: task.id,
            title: task.title,
            status: task.status,
            priority: task.priority,
            project: task.project_id,
            role: task.execution?.assigned_role,
            created_at: task.created_at,
            updated_at: task.updated_at,
            vespera_task: true
        };
        
        const yaml = Object.entries(frontmatter)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`)
            .join('\n');
        
        return `---
${yaml}
---

# ${task.title}

${task.description || ''}

## Task Details

- **Status**: ${task.status}
- **Priority**: ${task.priority}
- **Role**: ${task.execution?.assigned_role || 'Not assigned'}
- **Created**: ${new Date(task.created_at).toLocaleDateString()}

## Notes

<!-- Add your notes and updates here -->
`;
    }

    private sanitizeFilename(filename: string): string {
        return filename
            .replace(/[<>:"/\\|?*]/g, '-')
            .replace(/\s+/g, ' ')
            .trim()
            .substring(0, 100);
    }

    private getSelectedFiles(): TFile[] {
        // Get currently selected files in file explorer
        // This is a simplified implementation
        const activeFile = this.app.workspace.getActiveFile();
        return activeFile ? [activeFile] : [];
    }

    /**
     * Cleanup method
     */
    dispose(): void {
        // Remove event listeners
        this.app.vault.off('modify', this.handleFileModified.bind(this));
        this.app.vault.off('create', this.handleFileCreated.bind(this));
        this.app.vault.off('delete', this.handleFileDeleted.bind(this));
        this.app.vault.off('rename', this.handleFileRenamed.bind(this));
        
        this.taskFileMap.clear();
    }
}

// Additional utility functions for the adapter

export function createObsidianAdapter(app: App, mcpClient: VesperaMCPClient): ObsidianVesperaAdapter {
    return new ObsidianVesperaAdapter(app, mcpClient);
}

export interface AdapterConfig {
    autoSync: boolean;
    syncInterval: number;
    tasksFolderPath: string;
    defaultProject: string;
}

export const defaultAdapterConfig: AdapterConfig = {
    autoSync: true,
    syncInterval: 30000, // 30 seconds
    tasksFolderPath: 'Tasks',
    defaultProject: 'default'
};