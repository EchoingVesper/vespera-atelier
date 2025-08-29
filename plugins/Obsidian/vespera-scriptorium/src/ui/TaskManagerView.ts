/**
 * Task Manager View for Obsidian
 * 
 * Implements a custom editor view for managing Vespera Scriptorium tasks.
 * Uses an editor view instead of modal to allow Claude Code assistance.
 */

import { ItemView, WorkspaceLeaf, Setting, ButtonComponent, DropdownComponent, TextAreaComponent } from 'obsidian';
import { VesperaMCPClient } from '../mcp/client';
import { ObsidianVaultAdapter } from '../adapters/obsidian-adapter';

export const TASK_MANAGER_VIEW_TYPE = "vespera-task-manager";

interface TaskData {
    id: string;
    title: string;
    description: string;
    status: string;
    priority: string;
    project_id?: string;
    feature?: string;
    assignee?: string;
    created_at: string;
    updated_at: string;
}

interface ProjectData {
    id: string;
    name: string;
    description?: string;
}

export class TaskManagerView extends ItemView {
    private mcpClient: VesperaMCPClient;
    private vaultAdapter: ObsidianVaultAdapter;
    private tasks: TaskData[] = [];
    private projects: ProjectData[] = [];
    private selectedTask: TaskData | null = null;
    private filterStatus: string = 'all';
    private filterProject: string = 'all';

    constructor(leaf: WorkspaceLeaf, mcpClient: VesperaMCPClient, vaultAdapter: ObsidianVaultAdapter) {
        super(leaf);
        this.mcpClient = mcpClient;
        this.vaultAdapter = vaultAdapter;
    }

    getViewType(): string {
        return TASK_MANAGER_VIEW_TYPE;
    }

    getDisplayText(): string {
        return "Task Manager";
    }

    getIcon(): string {
        return "checklist";
    }

    async onOpen() {
        const container = this.containerEl.children[1];
        container.empty();
        
        // Add CSS class for styling
        container.addClass('vespera-task-manager');
        
        await this.render();
        
        // Load initial data
        if (this.mcpClient.isConnected()) {
            await this.refreshTasks();
        } else {
            this.showConnectionPrompt();
        }
    }

    async onClose() {
        // Cleanup if needed
    }

    private async render() {
        const container = this.containerEl.children[1];
        container.empty();

        // Header with title and controls
        const headerEl = container.createEl('div', { cls: 'task-manager-header' });
        headerEl.createEl('h2', { text: 'Vespera Task Manager' });

        // Connection status
        const statusEl = headerEl.createEl('div', { cls: 'connection-status' });
        this.updateConnectionStatus(statusEl);

        // Filter controls
        const filtersEl = container.createEl('div', { cls: 'task-filters' });
        await this.renderFilters(filtersEl);

        // Main content area with split layout
        const mainEl = container.createEl('div', { cls: 'task-manager-main' });
        
        // Left panel - Task list
        const listPanelEl = mainEl.createEl('div', { cls: 'task-list-panel' });
        await this.renderTaskList(listPanelEl);

        // Right panel - Task details/editor
        const detailsPanelEl = mainEl.createEl('div', { cls: 'task-details-panel' });
        this.renderTaskDetails(detailsPanelEl);

        // Action buttons
        const actionsEl = container.createEl('div', { cls: 'task-actions' });
        this.renderActions(actionsEl);
    }

    private updateConnectionStatus(statusEl: HTMLElement) {
        statusEl.empty();
        const isConnected = this.mcpClient.isConnected();
        
        statusEl.createEl('span', {
            text: isConnected ? '🟢 Connected' : '🔴 Disconnected',
            cls: isConnected ? 'status-connected' : 'status-disconnected'
        });

        if (!isConnected) {
            const connectBtn = statusEl.createEl('button', { text: 'Connect' });
            connectBtn.onclick = async () => {
                try {
                    await this.mcpClient.connect();
                    await this.render(); // Re-render to update status
                    await this.refreshTasks();
                } catch (error) {
                    console.error('Connection failed:', error);
                }
            };
        }
    }

    private async renderFilters(filtersEl: HTMLElement) {
        filtersEl.empty();
        
        // Status filter
        new Setting(filtersEl)
            .setName('Filter by Status')
            .addDropdown(dropdown => {
                dropdown.addOption('all', 'All');
                dropdown.addOption('todo', 'Todo');
                dropdown.addOption('doing', 'In Progress'); 
                dropdown.addOption('review', 'Review');
                dropdown.addOption('done', 'Done');
                dropdown.addOption('blocked', 'Blocked');
                dropdown.setValue(this.filterStatus);
                dropdown.onChange(async (value) => {
                    this.filterStatus = value;
                    await this.renderTaskList(this.containerEl.querySelector('.task-list-panel') as HTMLElement);
                });
            });

        // Project filter (populated after projects loaded)
        new Setting(filtersEl)
            .setName('Filter by Project')
            .addDropdown(dropdown => {
                dropdown.addOption('all', 'All Projects');
                // Add project options dynamically
                this.projects.forEach(project => {
                    dropdown.addOption(project.id, project.name);
                });
                dropdown.setValue(this.filterProject);
                dropdown.onChange(async (value) => {
                    this.filterProject = value;
                    await this.renderTaskList(this.containerEl.querySelector('.task-list-panel') as HTMLElement);
                });
            });
    }

    private async renderTaskList(listPanelEl: HTMLElement) {
        listPanelEl.empty();
        
        const headerEl = listPanelEl.createEl('div', { cls: 'panel-header' });
        headerEl.createEl('h3', { text: 'Tasks' });
        
        const refreshBtn = headerEl.createEl('button', { text: '↻' });
        refreshBtn.onclick = () => this.refreshTasks();

        const tasksEl = listPanelEl.createEl('div', { cls: 'tasks-list' });

        if (this.tasks.length === 0) {
            tasksEl.createEl('p', { text: 'No tasks found. Create a new task to get started.' });
            return;
        }

        // Filter tasks based on current filters
        const filteredTasks = this.tasks.filter(task => {
            if (this.filterStatus !== 'all' && task.status.toLowerCase() !== this.filterStatus) {
                return false;
            }
            if (this.filterProject !== 'all' && task.project_id !== this.filterProject) {
                return false;
            }
            return true;
        });

        filteredTasks.forEach(task => {
            const taskEl = tasksEl.createEl('div', { cls: 'task-item' });
            
            if (this.selectedTask?.id === task.id) {
                taskEl.addClass('selected');
            }

            // Task header
            const taskHeaderEl = taskEl.createEl('div', { cls: 'task-header' });
            taskHeaderEl.createEl('h4', { text: task.title });
            
            const statusBadge = taskHeaderEl.createEl('span', { 
                cls: `status-badge status-${task.status.toLowerCase()}`,
                text: task.status 
            });

            // Task meta
            const taskMetaEl = taskEl.createEl('div', { cls: 'task-meta' });
            taskMetaEl.createEl('span', { text: `Priority: ${task.priority}` });
            if (task.project_id) {
                const project = this.projects.find(p => p.id === task.project_id);
                if (project) {
                    taskMetaEl.createEl('span', { text: ` • Project: ${project.name}` });
                }
            }

            // Task description preview
            if (task.description) {
                const descEl = taskEl.createEl('p', { cls: 'task-description-preview' });
                descEl.textContent = task.description.length > 100 
                    ? task.description.substring(0, 100) + '...'
                    : task.description;
            }

            // Click to select
            taskEl.onclick = () => {
                this.selectTask(task);
            };
        });
    }

    private renderTaskDetails(detailsPanelEl: HTMLElement) {
        detailsPanelEl.empty();
        
        const headerEl = detailsPanelEl.createEl('div', { cls: 'panel-header' });
        headerEl.createEl('h3', { text: 'Task Details' });

        if (!this.selectedTask) {
            detailsPanelEl.createEl('p', { text: 'Select a task to view details' });
            return;
        }

        const task = this.selectedTask;
        const formEl = detailsPanelEl.createEl('div', { cls: 'task-form' });

        // Task ID (read-only)
        new Setting(formEl)
            .setName('Task ID')
            .addText(text => text.setValue(task.id).setDisabled(true));

        // Title (editable)
        new Setting(formEl)
            .setName('Title')
            .addText(text => text
                .setValue(task.title)
                .onChange(value => {
                    this.selectedTask!.title = value;
                }));

        // Description (editable text area)
        new Setting(formEl)
            .setName('Description')
            .setDesc('Task description and requirements')
            .addTextArea(textArea => {
                textArea.setValue(task.description || '');
                textArea.onChange(value => {
                    this.selectedTask!.description = value;
                });
                // Make textarea larger
                textArea.inputEl.rows = 6;
                textArea.inputEl.style.width = '100%';
            });

        // Status
        new Setting(formEl)
            .setName('Status')
            .addDropdown(dropdown => {
                dropdown.addOption('todo', 'Todo');
                dropdown.addOption('doing', 'In Progress');
                dropdown.addOption('review', 'Review');
                dropdown.addOption('done', 'Done');
                dropdown.addOption('blocked', 'Blocked');
                dropdown.setValue(task.status.toLowerCase());
                dropdown.onChange(value => {
                    this.selectedTask!.status = value;
                });
            });

        // Priority
        new Setting(formEl)
            .setName('Priority')
            .addDropdown(dropdown => {
                dropdown.addOption('low', 'Low');
                dropdown.addOption('normal', 'Normal');
                dropdown.addOption('high', 'High');
                dropdown.addOption('urgent', 'Urgent');
                dropdown.setValue(task.priority.toLowerCase());
                dropdown.onChange(value => {
                    this.selectedTask!.priority = value;
                });
            });

        // Project
        new Setting(formEl)
            .setName('Project')
            .addDropdown(dropdown => {
                dropdown.addOption('', 'No Project');
                this.projects.forEach(project => {
                    dropdown.addOption(project.id, project.name);
                });
                dropdown.setValue(task.project_id || '');
                dropdown.onChange(value => {
                    this.selectedTask!.project_id = value || undefined;
                });
            });

        // Save button
        const saveBtn = formEl.createEl('button', { text: 'Save Changes' });
        saveBtn.onclick = () => this.saveSelectedTask();

        // Delete button
        const deleteBtn = formEl.createEl('button', { text: 'Delete Task', cls: 'danger' });
        deleteBtn.onclick = () => this.deleteSelectedTask();

        // Timestamps
        const timestampsEl = formEl.createEl('div', { cls: 'task-timestamps' });
        timestampsEl.createEl('p', { text: `Created: ${new Date(task.created_at).toLocaleString()}` });
        timestampsEl.createEl('p', { text: `Updated: ${new Date(task.updated_at).toLocaleString()}` });
    }

    private renderActions(actionsEl: HTMLElement) {
        actionsEl.empty();

        const newTaskBtn = actionsEl.createEl('button', { text: '+ New Task' });
        newTaskBtn.onclick = () => this.createNewTask();

        const refreshBtn = actionsEl.createEl('button', { text: 'Refresh All' });
        refreshBtn.onclick = () => this.refreshTasks();
    }

    private selectTask(task: TaskData) {
        // Remove previous selection
        this.containerEl.querySelectorAll('.task-item.selected').forEach(el => {
            el.removeClass('selected');
        });

        this.selectedTask = task;
        
        // Add selection to clicked task
        const taskElements = this.containerEl.querySelectorAll('.task-item');
        taskElements.forEach(el => {
            const titleEl = el.querySelector('h4');
            if (titleEl?.textContent === task.title) {
                el.addClass('selected');
            }
        });

        // Re-render details panel
        const detailsPanel = this.containerEl.querySelector('.task-details-panel') as HTMLElement;
        if (detailsPanel) {
            this.renderTaskDetails(detailsPanel);
        }
    }

    private async createNewTask() {
        // Create a new task with default values
        const newTask: Partial<TaskData> = {
            title: 'New Task',
            description: '',
            status: 'todo',
            priority: 'normal',
            project_id: this.filterProject !== 'all' ? this.filterProject : undefined
        };

        try {
            const result = await this.mcpClient.createTask(newTask);
            if (result.success) {
                await this.refreshTasks();
                // Select the new task
                const createdTask = this.tasks.find(t => t.id === result.task.id);
                if (createdTask) {
                    this.selectTask(createdTask);
                }
            }
        } catch (error) {
            console.error('Failed to create task:', error);
        }
    }

    private async saveSelectedTask() {
        if (!this.selectedTask) return;

        try {
            const result = await this.mcpClient.updateTask(this.selectedTask.id, {
                title: this.selectedTask.title,
                description: this.selectedTask.description,
                status: this.selectedTask.status,
                priority: this.selectedTask.priority,
                project_id: this.selectedTask.project_id
            });

            if (result.success) {
                // Update local task data
                const taskIndex = this.tasks.findIndex(t => t.id === this.selectedTask!.id);
                if (taskIndex >= 0) {
                    this.tasks[taskIndex] = { ...this.selectedTask };
                }
                
                // Re-render task list to show changes
                const listPanel = this.containerEl.querySelector('.task-list-panel') as HTMLElement;
                if (listPanel) {
                    await this.renderTaskList(listPanel);
                }
            }
        } catch (error) {
            console.error('Failed to save task:', error);
        }
    }

    private async deleteSelectedTask() {
        if (!this.selectedTask) return;

        const confirmed = confirm(`Are you sure you want to delete "${this.selectedTask.title}"?`);
        if (!confirmed) return;

        try {
            const result = await this.mcpClient.deleteTask(this.selectedTask.id);
            if (result.success) {
                // Remove from local tasks array
                this.tasks = this.tasks.filter(t => t.id !== this.selectedTask!.id);
                this.selectedTask = null;
                
                // Re-render views
                const listPanel = this.containerEl.querySelector('.task-list-panel') as HTMLElement;
                const detailsPanel = this.containerEl.querySelector('.task-details-panel') as HTMLElement;
                if (listPanel) await this.renderTaskList(listPanel);
                if (detailsPanel) this.renderTaskDetails(detailsPanel);
            }
        } catch (error) {
            console.error('Failed to delete task:', error);
        }
    }

    public async refreshTasks() {
        if (!this.mcpClient.isConnected()) {
            this.showConnectionPrompt();
            return;
        }

        try {
            // Load tasks
            const tasksResult = await this.mcpClient.listTasks();
            if (tasksResult.success) {
                this.tasks = tasksResult.tasks || [];
            }

            // Load projects  
            const dashboardResult = await this.mcpClient.getDashboard();
            if (dashboardResult.success && dashboardResult.dashboard.project_info) {
                this.projects = dashboardResult.dashboard.project_info.projects || [];
            }

            // Re-render all components
            await this.render();
            
        } catch (error) {
            console.error('Failed to refresh tasks:', error);
        }
    }

    private showConnectionPrompt() {
        const container = this.containerEl.children[1];
        container.empty();
        
        const promptEl = container.createEl('div', { cls: 'connection-prompt' });
        promptEl.createEl('h3', { text: 'Not Connected' });
        promptEl.createEl('p', { text: 'Connect to Vespera Scriptorium server to manage tasks.' });
        
        const connectBtn = promptEl.createEl('button', { text: 'Connect to Server' });
        connectBtn.onclick = async () => {
            try {
                await this.mcpClient.connect();
                await this.render();
                await this.refreshTasks();
            } catch (error) {
                console.error('Connection failed:', error);
            }
        };
    }
}