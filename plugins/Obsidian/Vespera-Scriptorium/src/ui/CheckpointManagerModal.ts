import { App, Modal, Setting } from 'obsidian';

/**
 * Interface for checkpoint data
 */
interface Checkpoint {
  id: string;
  name: string;
  timestamp: number;
  description?: string;
}

/**
 * Modal for managing checkpoints
 */
export class CheckpointManagerModal extends Modal {
  private checkpoints: Checkpoint[];
  private onSelect: (checkpoint: Checkpoint) => void;
  private onResume: (checkpointId: string) => void;
  private onDelete: (checkpointId: string) => void;

  constructor(app: App, options: {
    checkpoints: Checkpoint[],
    onSelect?: (checkpoint: Checkpoint) => void,
    onResume?: (checkpointId: string) => void,
    onDelete?: (checkpointId: string) => void
  }) {
    super(app);
    this.checkpoints = options.checkpoints || [];
    this.onSelect = options.onSelect || (() => {});
    this.onResume = options.onResume || (() => {});
    this.onDelete = options.onDelete || (() => {});
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();
    
    contentEl.createEl('h2', { text: 'Checkpoint Manager' });
    
    if (this.checkpoints.length === 0) {
      contentEl.createEl('p', { text: 'No checkpoints available.' });
    } else {
      const checkpointList = contentEl.createDiv({ cls: 'checkpoint-list' });
      
      this.checkpoints.forEach(checkpoint => {
        const checkpointEl = checkpointList.createDiv({ cls: 'checkpoint-item' });
        
        const header = checkpointEl.createDiv({ cls: 'checkpoint-header' });
        header.createEl('h3', { text: checkpoint.name });
        
        const date = new Date(checkpoint.timestamp);
        header.createEl('span', { 
          text: date.toLocaleString(),
          cls: 'checkpoint-date'
        });
        
        if (checkpoint.description) {
          checkpointEl.createEl('p', { 
            text: checkpoint.description,
            cls: 'checkpoint-description'
          });
        }
        
        const buttonContainer = checkpointEl.createDiv({ cls: 'checkpoint-buttons' });
        
        const selectButton = buttonContainer.createEl('button', {
          text: 'Select',
          cls: 'mod-cta'
        });
        selectButton.addEventListener('click', () => {
          this.onSelect(checkpoint);
          this.close();
        });
        
        const resumeButton = buttonContainer.createEl('button', {
          text: 'Resume',
          cls: 'mod-cta'
        });
        resumeButton.addEventListener('click', () => {
          this.onResume(checkpoint.id);
          this.close();
        });
        
        const deleteButton = buttonContainer.createEl('button', { 
          text: 'Delete',
          cls: 'mod-warning'
        });
        deleteButton.addEventListener('click', () => {
          this.onDelete(checkpoint.id);
          // Remove from UI
          checkpointEl.remove();
          // If no checkpoints left, show message
          if (checkpointList.children.length === 0) {
            contentEl.empty();
            contentEl.createEl('h2', { text: 'Checkpoint Manager' });
            contentEl.createEl('p', { text: 'No checkpoints available.' });
          }
        });
      });
    }
    
    const closeButton = contentEl.createEl('button', { 
      text: 'Close',
      cls: 'checkpoint-close-button'
    });
    closeButton.addEventListener('click', () => this.close());
  }

  onClose() {
    const { contentEl } = this;
    contentEl.empty();
  }
}