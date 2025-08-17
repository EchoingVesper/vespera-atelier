import { App, Modal as ObsidianModal } from 'obsidian';

/**
 * Base modal class with additional functionality
 */
export class Modal extends ObsidianModal {
  public app: App;

  constructor(app: App) {
    super(app);
    this.app = app;
  }

  /**
   * Add a title to the modal
   */
  setTitle(title: string): this {
    const titleEl = this.contentEl.createEl('h2', { cls: 'modal-title' });
    titleEl.textContent = title;
    return this;
  }

  /**
   * Add a description to the modal
   */
  setDescription(description: string): this {
    const descEl = this.contentEl.createEl('p', { cls: 'modal-description' });
    descEl.textContent = description;
    return this;
  }

  /**
   * Add buttons to the modal
   */
  addButtons(buttons: {
    text: string;
    cls?: string;
    callback: () => void;
  }[]): this {
    const buttonContainer = this.contentEl.createDiv({ cls: 'modal-button-container' });
    
    buttons.forEach(button => {
      const buttonEl = buttonContainer.createEl('button', {
        text: button.text,
        cls: button.cls || ''
      });
      
      buttonEl.addEventListener('click', () => {
        button.callback();
      });
    });
    
    return this;
  }

  /**
   * Add a cancel button that closes the modal
   */
  addCancelButton(text: string = 'Cancel'): this {
    this.addButtons([
      {
        text,
        callback: () => this.close()
      }
    ]);
    return this;
  }

  /**
   * Add a submit button
   */
  addSubmitButton(text: string = 'Submit', callback: () => void): this {
    this.addButtons([
      {
        text,
        cls: 'mod-cta',
        callback
      }
    ]);
    return this;
  }

  /**
   * Add both submit and cancel buttons
   */
  addSubmitAndCancelButtons(
    submitText: string = 'Submit',
    cancelText: string = 'Cancel',
    submitCallback: () => void
  ): this {
    this.addButtons([
      {
        text: cancelText,
        callback: () => this.close()
      },
      {
        text: submitText,
        cls: 'mod-cta',
        callback: submitCallback
      }
    ]);
    return this;
  }
}