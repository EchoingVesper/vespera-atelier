import { App, Modal, Notice, Setting } from 'obsidian';
import { VaultTreeViewAdapter } from './VaultTreeViewAdapter';
import { TreeNode } from './treeUtils';
import { ConnectionStatusIndicator } from './ConnectionStatusIndicator';
import { ConnectionStatus } from '../services/ConnectionMonitoringService';

/**
 * Type alias for TreeNode to maintain backward compatibility
 * @deprecated Use TreeNode from './treeUtils' instead
 */
export type FileTreeNode = TreeNode;

/**
 * Interface for a saved prompt
 */
export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  created: number;
  lastUsed?: number;
}

/**
 * Interface for the settings manager
 */
export interface SettingsManagerInterface {
  getPrompts(): SavedPrompt[];
  savePrompt(title: string, content: string): Promise<SavedPrompt>;
  deletePrompt(id: string): Promise<boolean>;
  markPromptAsUsed(id: string): Promise<boolean>;
  sortPrompts(sortBy: 'recent' | 'alpha-asc' | 'alpha-desc' | 'created'): SavedPrompt[];
  getSettings(): any;
  updateSettings(settings: any): Promise<void>;
}

/**
 * Props for initializing the modal.
 */
export interface MultiSelectModalProps {
  files: TreeNode[];
  onConfirm: (selected: TreeNode[], prompt: string) => void;
  onCancel?: () => void;
  initialPrompt?: string;
  settingsManager: SettingsManagerInterface;
  isLLMConnected: boolean; // Initial LLM connection status
  onLLMConnectionStatusChange: (callback: (isConnected: boolean) => void) => void; // Method to subscribe to status changes
  onOpenProgressPane?: () => Promise<void>; // Callback to open the progress pane
}

/**
 * Modal for selecting multiple files from a tree view with enhanced UI and accessibility
 */
export class MultiSelectModal extends Modal {
  private files: TreeNode[];
  private selectedPaths: string[] = [];
  private prompt: string;
  private onConfirm: (selected: TreeNode[], prompt: string) => void;
  private onCancel?: () => void;
  private treeView: VaultTreeViewAdapter | undefined;
  private selectionFeedbackEl?: HTMLElement;
  private _gearBtn?: HTMLElement;
  private connectionStatusIndicator?: ConnectionStatusIndicator;
  private lastUsedPromptTitle?: string;
  private confirmBtn?: HTMLButtonElement; // Store confirm button element
  private settingsManager: SettingsManagerInterface;
  private savedPrompts: SavedPrompt[] = [];
  private isEditMode: boolean = false;
  private isLLMConnected: boolean; // Current LLM connection status
  private onLLMConnectionStatusChange: (callback: (isConnected: boolean) => void) => void; // Method to subscribe to status changes
  private connectionStatusCallback: (isConnected: boolean) => void; // Store the registered callback
  private onOpenProgressPane?: () => Promise<void>; // Callback to open the progress pane

  constructor(app: App, props: MultiSelectModalProps) {
    super(app);
    this.files = props.files;
    this.onConfirm = props.onConfirm;
    this.onCancel = props.onCancel;
    this.prompt = props.initialPrompt ?? "";
    this.settingsManager = props.settingsManager;
    this.isLLMConnected = props.isLLMConnected; // Initialize with initial status
    this.onLLMConnectionStatusChange = props.onLLMConnectionStatusChange; // Store callback registration method
    this.onOpenProgressPane = props.onOpenProgressPane; // Initialize with the provided callback
    // Load saved prompts
    this.savedPrompts = this.settingsManager.getPrompts();

    // Define the callback function
    this.connectionStatusCallback = (isConnected: boolean) => {
      this.isLLMConnected = isConnected;
      this.updateConfirmButtonState();
    };
  }

  onOpen() {
    const { contentEl } = this;
    contentEl.empty();

    // Load saved state from settings
    const settings = this.settingsManager.getSettings();
    this.prompt = settings.lastUsedPromptContent ?? this.prompt;
    this.selectedPaths = settings.lastUsedSelectedPaths ?? [];
    
    // Store the last used prompt title for later use when rendering the UI
    const lastUsedPromptTitle = settings.lastUsedPromptTitle;

    // Register the connection status callback
    this.onLLMConnectionStatusChange(this.connectionStatusCallback);

    // Add modal title for screen readers
    contentEl.createEl("h2", {
      text: "Select Files for Processing",
      cls: "vespera-modal-title sr-only",
      attr: { "aria-live": "polite" }
    });

    // --- File selection tree view ---
    if (this.files.length === 0) {
      contentEl.createEl("div", {
        text: "No eligible files found in the vault.",
        cls: "vespera-empty-message",
        attr: { "aria-live": "assertive", role: "alert" }
      });
      return;
    }

    const treeContainer = contentEl.createDiv({
      cls: "vespera-treeview-container",
      attr: {
        role: "region",
        "aria-label": "File selection tree"
      }
    });
    treeContainer.style.position = "relative";

    // Instantiate the VaultTreeViewAdapter with current files and selection
    try {
      this.treeView = new VaultTreeViewAdapter(this.app, {
        rootNodes: this.files,
        onSelect: (node: TreeNode) => {
          if (this.selectedPaths.includes(node.path)) {
            this.selectedPaths = this.selectedPaths.filter(p => p !== node.path);
          } else {
            this.selectedPaths = [...this.selectedPaths, node.path];
          }
          this.renderSelectionFeedback();
          this.updateConfirmButtonState(); // Call to update button state
        },
        onExpandCollapse: (node: TreeNode, expanded: boolean) => {
          // Handle expand/collapse events if needed
        },
        selectedPaths: this.selectedPaths
      });

      // Render the tree view in the container
      this.treeView.render(treeContainer);
    } catch (error) {
      console.error("Error creating VaultTreeView:", error);
      contentEl.createEl("div", {
        text: "Error creating file tree view.",
        cls: "vespera-error-message",
        attr: { "aria-live": "assertive", role: "alert" }
      });
    }

    // --- Settings gear button ---
    const gearBtn = treeContainer.createEl("button", {
      cls: "vespera-settings-btn",
      attr: { "aria-label": "Settings" }
    });
    gearBtn.innerHTML = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="3"/><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 8 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 1 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 5 15.4a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 8a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 1 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 8 4.6a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09A1.65 1.65 0 0 0 16 4.6a1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 1 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 8c.14.31.22.65.22 1v.09A1.65 1.65 0 0 0 21 12c0 .35-.08.69-.22 1z"/></svg>`;
    gearBtn.title = "Settings (+)";
    gearBtn.tabIndex = 0;
    gearBtn.style.position = "absolute";
    gearBtn.style.top = "0.5rem";
    gearBtn.style.right = "0.5rem";
    gearBtn.style.opacity = "0.4";
    gearBtn.style.zIndex = "10"; // Ensure gear icon stays on top
    gearBtn.addEventListener("mouseenter", () => gearBtn.style.opacity = "1");
    gearBtn.addEventListener("mouseleave", () => { if (!gearBtn.matches(":focus")) gearBtn.style.opacity = "0.4"; });
    gearBtn.addEventListener("focus", () => gearBtn.style.opacity = "1");
    gearBtn.addEventListener("blur", () => gearBtn.style.opacity = "0.4");
    gearBtn.addEventListener("click", () => this.openSettings());
    this._gearBtn = gearBtn;

    // --- Prompt management section ---
    const promptSection = contentEl.createDiv({
      cls: "vespera-prompt-section",
      attr: {
        role: "region",
        "aria-label": "Prompt management"
      }
    });
    promptSection.style.margin = "1rem 0";
    promptSection.style.width = "100%";

    // --- Saved prompts dropdown ---
    const savedPromptsContainer = promptSection.createDiv({
      cls: "vespera-saved-prompts-container",
      attr: {
        role: "region",
        "aria-label": "Saved prompts"
      }
    });
    savedPromptsContainer.style.marginBottom = "0.5rem";

    // Create a container for the dropdown in normal mode
    const dropdownContainer = savedPromptsContainer.createDiv({
      cls: "vespera-dropdown-container",
      attr: { "data-mode": "normal" }
    });
    dropdownContainer.style.display = "flex";
    dropdownContainer.style.width = "100%";
    dropdownContainer.style.marginBottom = "0.5rem";

    // Create a custom dropdown container
    const customDropdownContainer = dropdownContainer.createDiv({
      cls: "vespera-custom-dropdown-container"
    });
    customDropdownContainer.style.position = "relative";
    customDropdownContainer.style.width = "100%";

    // Create the select element (hidden but still accessible for keyboard navigation)
    const savedSelect = customDropdownContainer.createEl("select", {
      cls: "vespera-prompt-saved",
      attr: {
        "aria-label": "Select a saved prompt"
      }
    });
    savedSelect.tabIndex = 0;
    savedSelect.style.position = "absolute";
    savedSelect.style.opacity = "0";
    savedSelect.style.width = "100%";
    savedSelect.style.height = "100%";
    savedSelect.style.top = "0";
    savedSelect.style.left = "0";
    savedSelect.style.cursor = "pointer";

    // Create the custom dropdown display
    const customDropdownDisplay = customDropdownContainer.createDiv({
      cls: "vespera-custom-dropdown-display"
    });
    customDropdownDisplay.style.width = "100%";
    customDropdownDisplay.style.padding = "0.5rem";
    customDropdownDisplay.style.border = "1px solid var(--background-modifier-border)";
    customDropdownDisplay.style.borderRadius = "4px";
    customDropdownDisplay.style.backgroundColor = "var(--background-primary)";
    customDropdownDisplay.style.cursor = "pointer";
    customDropdownDisplay.style.display = "flex";
    customDropdownDisplay.style.alignItems = "center";
    customDropdownDisplay.style.justifyContent = "space-between";

    // Create the display text element
    const displayText = customDropdownDisplay.createDiv({
      text: "Select a saved prompt...",
      cls: "vespera-dropdown-display-text"
    });

    // Create the dropdown arrow
    const dropdownArrow = customDropdownDisplay.createSpan({
      cls: "vespera-dropdown-arrow"
    });
    dropdownArrow.innerHTML = "▼";
    dropdownArrow.style.fontSize = "0.8em";
    dropdownArrow.style.marginLeft = "8px";

    // Create the dropdown options container (initially hidden)
    const dropdownOptions = customDropdownContainer.createDiv({
      cls: "vespera-dropdown-options"
    });
    dropdownOptions.style.position = "absolute";
    dropdownOptions.style.top = "100%";
    dropdownOptions.style.left = "0";
    dropdownOptions.style.width = "100%";
    dropdownOptions.style.maxHeight = "200px";
    dropdownOptions.style.overflowY = "auto";
    dropdownOptions.style.backgroundColor = "var(--background-primary)";
    dropdownOptions.style.border = "1px solid var(--background-modifier-border)";
    dropdownOptions.style.borderTop = "none";
    dropdownOptions.style.borderRadius = "0 0 4px 4px";
    dropdownOptions.style.zIndex = "100";
    dropdownOptions.style.display = "none";

    // Add a default "Select a prompt" option
    const defaultOption = savedSelect.createEl("option", {
      text: "Select a saved prompt...",
      attr: { selected: "", disabled: "" }
    });
    defaultOption.value = "";

    // Create a default option in the custom dropdown
    const defaultOptionDiv = dropdownOptions.createDiv({
      cls: "vespera-prompt-preview",
      attr: { "data-value": "" }
    });
    defaultOptionDiv.createDiv({
      text: "Select a saved prompt...",
      cls: "vespera-prompt-title"
    });

    // Add saved prompts to both the select element and custom dropdown
    this.savedPrompts.forEach(prompt => {
      // Add to the select element
      const opt = savedSelect.createEl("option", { text: prompt.title });
      opt.value = prompt.id;

      // Add to the custom dropdown
      const optionDiv = dropdownOptions.createDiv({
        cls: "vespera-prompt-preview",
        attr: { "data-value": prompt.id }
      });

      // Create title element
      optionDiv.createDiv({
        text: prompt.title,
        cls: "vespera-prompt-title"
      });

      // Create content preview with fade-out effect
      const contentPreview = optionDiv.createDiv({
        cls: "vespera-prompt-content-preview"
      });
      contentPreview.textContent = prompt.content.substring(0, 100);

      // Add click handler to the option
      optionDiv.addEventListener("click", () => {
        // Update the select element value
        savedSelect.value = prompt.id;

        // Update the display text
        displayText.textContent = prompt.title;

        // Hide the dropdown
        dropdownOptions.style.display = "none";

        // Trigger the change event on the select element
        savedSelect.dispatchEvent(new Event("change"));
      });
    });

    // Toggle dropdown on click
    customDropdownDisplay.addEventListener("click", () => {
      const isVisible = dropdownOptions.style.display === "block";
      dropdownOptions.style.display = isVisible ? "none" : "block";

      // Update arrow
      dropdownArrow.innerHTML = isVisible ? "▼" : "▲";
    });

    // Close dropdown when clicking outside
    document.addEventListener("click", (e) => {
      if (!customDropdownContainer.contains(e.target as Node)) {
        dropdownOptions.style.display = "none";
        dropdownArrow.innerHTML = "▼";
      }
    });

    // Connect saved prompts dropdown to the prompt textarea
    savedSelect.addEventListener("change", (e) => {
      const selectEl = e.target as HTMLSelectElement;
      const promptId = selectEl.value;

      if (promptId && promptId !== "") {
        // Find the prompt by ID
        const prompt = this.savedPrompts.find(p => p.id === promptId);

        if (prompt) {
          // Update the prompt textarea and title
          promptInput.value = prompt.content;
          this.prompt = prompt.content;
          titleInput.value = prompt.title;

          // Update the display text
          displayText.textContent = prompt.title;

          // Mark the prompt as used
          this.settingsManager.markPromptAsUsed(promptId).catch(error => {
            console.error("Failed to mark prompt as used:", error);
          });

          // Focus the prompt textarea
          promptInput.focus();
        }
      }
    });

    // Title input field
    const titleContainer = promptSection.createDiv({ cls: "vespera-prompt-title-container" });
    titleContainer.style.width = "100%";
    titleContainer.style.marginBottom = "0.5rem";

    const titleInput = titleContainer.createEl("input", {
      attr: {
        type: "text",
        placeholder: "Prompt Title",
        "aria-label": "Prompt title"
      },
      cls: "vespera-prompt-title-input"
    });
    titleInput.style.width = "100%";
    titleInput.style.padding = "0.5rem";
    titleInput.style.borderRadius = "4px 4px 0 0";

    // Ensure cursor is in the field when selected
    titleInput.addEventListener("focus", () => {
      // If empty, place cursor at beginning, otherwise at end
      const pos = titleInput.value.length;
      titleInput.setSelectionRange(pos, pos);
    });

    // Divider line that tapers to fine points
    const divider = titleContainer.createDiv({ cls: "vespera-prompt-divider" });
    divider.style.width = "100%";
    divider.style.height = "1px";
    divider.style.background = "linear-gradient(to right, transparent, var(--background-modifier-border) 10%, var(--background-modifier-border) 90%, transparent)";
    divider.style.margin = "0";

    // Prompt textarea
    const promptContainer = promptSection.createDiv({ cls: "vespera-prompt-container" });
    promptContainer.style.width = "100%";
    const promptInput = promptContainer.createEl("textarea", {
      attr: {
        rows: "7",
        placeholder: "Enter your prompt...",
        "aria-label": "Processing prompt"
      },
      cls: "vespera-prompt-input"
    });
    promptInput.tabIndex = 0;
    promptInput.style.width = "100%";
    promptInput.style.resize = "vertical";

    // Set initial value from state
    promptInput.value = this.prompt;
    
    // Set the title input value if we have a saved title
    if (settings.lastUsedPromptTitle) {
      titleInput.value = settings.lastUsedPromptTitle;
    }

    // Update the confirm button state initially
    this.updateConfirmButtonState();
    
    // Log the state for debugging
    console.debug("Modal state on open:", {
      selectedPaths: this.selectedPaths.length,
      promptLength: this.prompt.length,
      isLLMConnected: this.isLLMConnected,
      buttonDisabled: this.confirmBtn?.disabled
    });

    // --- Auto-select last used prompt ---
    // settings is already loaded at the beginning of onOpen
    const lastUsedPromptId = settings.lastUsedPromptId;

    if (lastUsedPromptId) {
      const lastUsedPrompt = this.savedPrompts.find(p => p.id === lastUsedPromptId);
      if (lastUsedPrompt) {
        // Select the prompt in the hidden select element
        savedSelect.value = lastUsedPromptId;
        // Update the custom dropdown display text
        displayText.textContent = lastUsedPrompt.title;
        // Load the prompt content into the textarea
        promptInput.value = lastUsedPrompt.content;
        this.prompt = lastUsedPrompt.content;
        // Mark as used again to bring it to the top of 'recent' sort
        this.settingsManager.markPromptAsUsed(lastUsedPromptId).catch(error => {
          console.error("Failed to mark last used prompt as used:", error);
        });
      } else {
        // Last used prompt not found (likely deleted)
        console.warn(`Last used prompt with ID ${lastUsedPromptId} not found.`);
        // Clear the last used prompt from settings
        settings.lastUsedPromptId = undefined;
        this.settingsManager.updateSettings(settings).catch(error => {
          console.error("Failed to clear last used prompt from settings:", error);
        });

        // If savedPrompts is now empty, attempt to regenerate default prompts
        if (this.savedPrompts.length === 0) {
          console.log("Saved prompts list is empty. Attempting to regenerate default prompts.");
          // Assuming updateSettings might trigger regeneration if settings are empty
          // A more explicit method might be needed depending on SettingsManager implementation
          this.settingsManager.updateSettings(settings).catch(error => {
             console.error("Failed to trigger default prompt regeneration:", error);
          });
          // Re-load prompts after potential regeneration
          this.savedPrompts = this.settingsManager.getPrompts();
          // Note: UI elements for prompts would need to be re-rendered here
          // For now, we'll rely on the user closing and reopening the modal
          // or a more sophisticated UI update mechanism if needed.
        }
        // If savedPrompts is not empty, the default "Select a prompt..." will remain selected.
      }
    }

    // Update state when changed
    promptInput.addEventListener("input", (e: Event) => {
      this.prompt = (e.target as HTMLTextAreaElement).value;
      this.updateConfirmButtonState(); // Call to update button state
    });

    // Create a container for the table in edit mode (initially hidden)
    const tableContainer = savedPromptsContainer.createDiv({
      cls: "vespera-table-container",
      attr: {
        "data-mode": "edit",
        "aria-label": "Edit saved prompts"
      }
    });
    tableContainer.style.display = "none"; // Initially hidden
    tableContainer.style.width = "100%";
    tableContainer.style.marginBottom = "0.5rem";

    // Create the table for edit mode
    const promptTable = tableContainer.createEl("table", {
      cls: "vespera-prompt-table",
      attr: { role: "grid" }
    });
    promptTable.style.width = "100%";
    promptTable.style.borderCollapse = "collapse";

    // Create table header
    const tableHead = promptTable.createEl("thead");
    const headerRow = tableHead.createEl("tr");

    const titleHeader = headerRow.createEl("th", {
      text: "Title",
      attr: { scope: "col" }
    });
    titleHeader.style.textAlign = "left";

    const contentHeader = headerRow.createEl("th", {
      text: "Content Preview",
      attr: { scope: "col" }
    });
    contentHeader.style.textAlign = "left";

    const actionsHeader = headerRow.createEl("th", {
      text: "Actions",
      attr: { scope: "col" }
    });
    actionsHeader.style.textAlign = "center";
    actionsHeader.style.width = "80px"; // Adjust width as needed

    // Create table body
    const tableBody = promptTable.createEl("tbody");
    tableBody.setAttribute("role", "rowgroup");

    // Populate table with saved prompts
    this.savedPrompts.forEach(prompt => {
      this.addPromptToTable(tableBody, prompt);
    });

    // --- Action buttons ---
    const buttonGroup = contentEl.createDiv({ cls: "modal-button-container" });
    buttonGroup.style.display = "flex";
    buttonGroup.style.justifyContent = "flex-end";
    buttonGroup.style.marginTop = "1rem";

    // Progress Pane Button
    if (this.onOpenProgressPane) {
      const progressBtn = buttonGroup.createEl("button", { text: "Progress" });
      progressBtn.addEventListener('click', async () => {
        await this.onOpenProgressPane?.();
        this.close(); // Close the current modal
      });
    }

    // Cancel Button
    const cancelBtn = buttonGroup.createEl("button", { text: "Cancel" });
    cancelBtn.addEventListener('click', () => {
      this.cancel();
    });

    // Confirm Button
    this.confirmBtn = buttonGroup.createEl("button", {
      text: "Confirm",
      cls: "mod-cta",
      attr: { disabled: !this.isLLMConnected || this.selectedPaths.length === 0 || this.prompt.trim() === "" }
    });

    this.confirmBtn.addEventListener('click', async (event) => {
      // Prevent default form submission if any
      event.preventDefault();

      // Disable the button and show loading indicator if needed
      // this.confirmBtn.disabled = true;
      // this.confirmBtn.textContent = 'Processing...'; // Or add a spinner

      // Get selected nodes based on selected paths
      const selectedNodes = this.getSelectedNodes();

      // Call the onConfirm callback with selected nodes and prompt
      this.onConfirm(selectedNodes, this.prompt);

      // Close the modal
      this.close();
    });

    // Add keyboard event listener to the button group for accessibility
    buttonGroup.addEventListener("keydown", (e: KeyboardEvent) => {
      const target = e.target as HTMLElement;
      const buttons = Array.from(buttonGroup.querySelectorAll("button"));
      const currentIndex = buttons.indexOf(target as HTMLButtonElement);

      if (e.key === "ArrowRight") {
        e.preventDefault();
        const nextButton = buttons[(currentIndex + 1) % buttons.length];
        nextButton.focus();
      } else if (e.key === "ArrowLeft") {
        e.preventDefault();
        const prevIndex = (currentIndex - 1 + buttons.length) % buttons.length;
        const prevButton = buttons[prevIndex];
        prevButton.focus();
      }
    });

    // Initial state update for the confirm button
    this.updateConfirmButtonState();
  }

  onClose() {
    // Unregister the connection status callback
    // Note: This requires a mechanism in onLLMConnectionStatusChange to unregister
    // For now, we'll rely on the modal instance being garbage collected.
    // A more robust solution would involve returning an unsubscribe function.
    // this.onLLMConnectionStatusChange(null); // Placeholder - needs proper implementation

    // Save current prompt, title, and selected files to settings
    const settings = this.settingsManager.getSettings();
    settings.lastUsedPromptContent = this.prompt;
    settings.lastUsedSelectedPaths = this.selectedPaths;
    
    // Save the title from the title input field
    const titleInput = this.contentEl.querySelector(".vespera-prompt-title-input") as HTMLInputElement;
    if (titleInput) {
      settings.lastUsedPromptTitle = titleInput.value;
    }
    
    this.settingsManager.updateSettings(settings).catch(error => {
      console.error("Failed to save modal state to settings:", error);
    });

    // Clean up the tree view
    if (this.treeView) {
      // The VaultTreeViewAdapter likely doesn't have a destroy method.
      // Relying on garbage collection for now.
      this.treeView = undefined;
    }
  }

  /**
   * Updates the state of the confirm button based on current selections and LLM connection status.
   * The button is enabled only if at least one file is selected, the prompt is not empty,
   * and the LLM is connected.
   */
  /**
   * Updates the state of the confirm button based on current selections and LLM connection status.
   * The button is enabled only if at least one file is selected, the prompt is not empty,
   * and the LLM is connected.
   */
  private updateConfirmButtonState(): void {
    if (this.confirmBtn) {
      const hasSelection = this.selectedPaths.length > 0;
      const hasPrompt = this.prompt.trim() !== "";
      const isConnected = this.isLLMConnected;
      
      const isEnabled = hasSelection && hasPrompt && isConnected;
      this.confirmBtn.disabled = !isEnabled;
      
      // Add aria-disabled attribute for better accessibility
      this.confirmBtn.setAttribute("aria-disabled", (!isEnabled).toString());
      
      // Add a data attribute to help identify which condition is failing
      this.confirmBtn.setAttribute("data-disabled-reason",
        !hasSelection ? "no-selection" :
        !hasPrompt ? "no-prompt" :
        !isConnected ? "not-connected" : "");
      
      // Update tooltip to explain why the button is disabled
      if (!isEnabled) {
        let reason = "";
        if (!hasSelection) reason += "No files selected. ";
        if (!hasPrompt) reason += "Prompt text is empty. ";
        if (!isConnected) reason += "LLM is not connected. ";
        this.confirmBtn.title = `Cannot proceed: ${reason.trim()}`;
      } else {
        this.confirmBtn.title = "Process selected files with the current prompt";
      }
      
      // Log state changes for debugging
      console.debug("Button state updated:", {
        hasSelection,
        hasPrompt,
        isConnected,
        isEnabled
      });
    }
  }

  /**
   * Renders feedback about the current selection count.
   */
  private renderSelectionFeedback() {
    if (!this.selectionFeedbackEl) {
      // Find or create the feedback element near the tree view
      const treeContainer = this.contentEl.querySelector(".vespera-treeview-container");
      if (treeContainer) {
        this.selectionFeedbackEl = treeContainer.createDiv({
          cls: "vespera-selection-feedback sr-only", // Initially hidden visually but available to screen readers
          attr: { "aria-live": "polite" } // Announce changes
        });
      }
    }
    if (this.selectionFeedbackEl) {
      const count = this.selectedPaths.length;
      this.selectionFeedbackEl.textContent = count === 1 ? "1 file selected." : `${count} files selected.`;
    }
  }

  /**
   * Clears the current selection in the tree view and updates the state.
   * @param treeContainer The container element of the tree view.
   */
  private clearSelection(treeContainer: HTMLElement): void {
    this.selectedPaths = [];
    if (this.treeView) {
      // The VaultTreeViewAdapter likely doesn't have a clearSelection method.
      // We'll rely on re-rendering the tree view with an empty selectedPaths array if needed elsewhere.
    }
    this.renderSelectionFeedback();
    this.updateConfirmButtonState(); // Update button state after clearing selection
  }

  /**
   * Opens the settings modal for managing saved prompts.
   */
  private openSettings(): void {
    // Temporarily hide the main modal content
    this.contentEl.style.display = 'none';

    // Create a new modal for settings
    const settingsModal = new Modal(this.app);
    settingsModal.titleEl.setText("Saved Prompt Settings");

    settingsModal.onOpen = () => {
      const { contentEl } = settingsModal;
      contentEl.empty();

      // Add a description for screen readers
      contentEl.createEl("p", {
        text: "Manage your saved prompts. You can delete prompts here.",
        cls: "sr-only"
      });

      // Create a container for the settings form
      const settingsForm = contentEl.createDiv({ cls: "vespera-settings-form" });
      settingsForm.style.width = "100%";

      // Add a setting for sorting saved prompts
      new Setting(settingsForm)
        .setName("Sort Prompts By")
        .setDesc("Choose how to sort your saved prompts.")
        .addDropdown(dropdown => {
          dropdown.addOption('recent', 'Most Recent');
          dropdown.addOption('alpha-asc', 'Alphabetical (A-Z)');
          dropdown.addOption('alpha-desc', 'Alphabetical (Z-A)');
          dropdown.addOption('created', 'Date Created');
          // Load current sort setting
          const currentSettings = this.settingsManager.getSettings();
          dropdown.setValue(currentSettings.promptSortBy || 'recent');
          dropdown.onChange(async (value: string) => {
            currentSettings.promptSortBy = value;
            await this.settingsManager.updateSettings(currentSettings);
            // Re-sort and re-render the table
            this.savedPrompts = this.settingsManager.sortPrompts(value as "recent" | "alpha-asc" | "alpha-desc" | "created");
            this.renderPromptTable(settingsForm); // Re-render the table
          });
        });

      // Add a container for the prompt table
      const tableContainer = settingsForm.createDiv({ cls: "vespera-settings-table-container" });
      tableContainer.style.width = "100%";
      tableContainer.style.marginTop = "1rem";

      // Render the prompt table
      this.renderPromptTable(settingsForm);
    };

    settingsModal.onClose = () => {
      // Re-show the main modal content when settings modal is closed
      this.contentEl.style.display = 'block';
      // Re-load prompts in case any were deleted
      this.savedPrompts = this.settingsManager.getPrompts();
      // Note: The main modal's prompt dropdown/table would need to be re-rendered
      // to reflect changes. For now, closing and reopening the main modal is needed.
      // A more sophisticated UI update mechanism could be implemented here.
    };

    settingsModal.open();
  }

  /**
   * Renders or re-renders the saved prompt table in the settings modal.
   * @param containerEl The container element to render the table in.
   */
  private renderPromptTable(containerEl: HTMLElement): void {
    // Find and remove the existing table if it exists
    const existingTableContainer = containerEl.querySelector(".vespera-settings-table-container");
    if (existingTableContainer) {
      existingTableContainer.empty(); // Clear existing content
    } else {
       // If the container doesn't exist, create it (should have been created in openSettings)
       // This case should ideally not happen if openSettings is called first.
       console.error("Settings table container not found.");
       return;
    }

    const promptTable = existingTableContainer.createEl("table", {
      cls: "vespera-prompt-table",
      attr: { role: "grid" }
    });
    promptTable.style.width = "100%";
    promptTable.style.borderCollapse = "collapse";

    // Create table header
    const tableHead = promptTable.createEl("thead");
    const headerRow = tableHead.createEl("tr");

    const titleHeader = headerRow.createEl("th", {
      text: "Title",
      attr: { scope: "col" }
    });
    titleHeader.style.textAlign = "left";

    const contentHeader = headerRow.createEl("th", {
      text: "Content Preview",
      attr: { scope: "col" }
    });
    contentHeader.style.textAlign = "left";

    const actionsHeader = headerRow.createEl("th", {
      text: "Actions",
      attr: { scope: "col" }
    });
    actionsHeader.style.textAlign = "center";
    actionsHeader.style.width = "80px"; // Adjust width as needed

    // Create table body
    const tableBody = promptTable.createEl("tbody");
    tableBody.setAttribute("role", "rowgroup");

    // Populate table with saved prompts
    if (this.savedPrompts.length === 0) {
        const noPromptsRow = tableBody.createEl("tr");
        const noPromptsCell = noPromptsRow.createEl("td", {
            text: "No saved prompts yet.",
            attr: { colspan: "3", role: "gridcell" }
        });
        noPromptsCell.style.textAlign = "center";
        noPromptsCell.style.padding = "1rem";
    } else {
        this.savedPrompts.forEach(prompt => {
            this.addPromptToTable(tableBody, prompt);
        });
    }
  }


  /**
   * Handles keyboard events for accessibility within the modal.
   * @param e The keyboard event.
   */
  private handleKeyboardEvents(e: KeyboardEvent): void {
    // Example: Close modal on Escape key
    if (e.key === "Escape") {
      e.preventDefault();
      this.cancel();
    }
    // Add other keyboard navigation logic as needed
  }

  /**
   * Confirms the selection and prompt, then closes the modal.
   */
  private confirm(): void {
    // Get selected nodes based on selected paths
    const selectedNodes = this.getSelectedNodes();

    // Call the onConfirm callback with selected nodes and prompt
    this.onConfirm(selectedNodes, this.prompt);

    // Close the modal
    this.close();
  }

  /**
   * Cancels the operation and closes the modal.
   */
  private cancel(): void {
    this.onCancel?.();
    this.close();
  }

  /**
   * Retrieves the selected TreeNode objects based on the stored selected paths.
   * This is necessary because the tree view might not always be fully rendered or available
   * when the confirm action is triggered.
   * @returns An array of selected TreeNode objects.
   */
  private getSelectedNodes(): TreeNode[] {
    const selectedNodes: TreeNode[] = [];
    const selectedPathsSet = new Set(this.selectedPaths);

    // Recursive function to find nodes by path
    const findNodesByPath = (nodes: TreeNode[], selectedPaths: Set<string>) => {
      for (const node of nodes) {
        if (selectedPaths.has(node.path)) {
          selectedNodes.push(node);
        }
        if (node.children) {
          findNodesByPath(node.children, selectedPaths);
        }
      }
    };

    // Start searching from the root files
    findNodesByPath(this.files, selectedPathsSet);

    return selectedNodes;
  }

  /**
   * Adds a single prompt row to the saved prompts table in the settings modal.
   * @param tableBody The tbody element of the table.
   * @param prompt The SavedPrompt object to add.
   */
  private addPromptToTable(tableBody: HTMLElement, prompt: SavedPrompt): void {
    const row = tableBody.createEl("tr", { attr: { role: "row" } });

    // Title cell
    const titleCell = row.createEl("td", { attr: { role: "gridcell" } });
    titleCell.createDiv({ text: prompt.title, cls: "vespera-prompt-title-cell" });

    // Content preview cell
    const contentCell = row.createEl("td", { attr: { role: "gridcell" } });
    contentCell.createDiv({ text: prompt.content.substring(0, 100) + (prompt.content.length > 100 ? '...' : ''), cls: "vespera-prompt-content-cell" });

    // Actions cell
    const actionsCell = row.createEl("td", { attr: { role: "gridcell" } });
    actionsCell.style.textAlign = "center";

    // Delete button
    const deleteBtn = actionsCell.createEl("button", { text: "Delete", cls: "mod-warning" });
    deleteBtn.addEventListener("click", async (e) => {
      e.stopPropagation(); // Prevent row click event
      if (confirm(`Are you sure you want to delete the prompt "${prompt.title}"?`)) {
        try {
          const success = await this.settingsManager.deletePrompt(prompt.id);
          if (success) {
            new Notice(`Prompt "${prompt.title}" deleted.`);
            // Remove the row from the table
            row.remove();
            // Update the savedPrompts array in the modal instance
            this.savedPrompts = this.savedPrompts.filter(p => p.id !== prompt.id);
            // Re-render the table to show "No saved prompts" message if needed
            this.renderPromptTable(tableBody.parentElement?.parentElement?.parentElement as HTMLElement); // Pass the settings form container
          } else {
            new Notice(`Failed to delete prompt "${prompt.title}".`);
          }
        } catch (error) {
          console.error("Error deleting prompt:", error);
          new Notice(`Error deleting prompt "${prompt.title}".`);
        }
      }
    });

    // Make the row clickable to load the prompt into the main modal
    row.addEventListener("click", () => {
      // Find the main modal's prompt input and title input
      const mainModalContent = this.contentEl;
      const promptInput = mainModalContent.querySelector(".vespera-prompt-input") as HTMLTextAreaElement;
      const titleInput = mainModalContent.querySelector(".vespera-prompt-title-input") as HTMLInputElement;
      const savedSelect = mainModalContent.querySelector(".vespera-prompt-saved") as HTMLSelectElement;
      const displayText = mainModalContent.querySelector(".vespera-dropdown-display-text") as HTMLElement;


      if (promptInput && titleInput && savedSelect && displayText) {
        promptInput.value = prompt.content;
        this.prompt = prompt.content; // Update modal state
        titleInput.value = prompt.title;
        savedSelect.value = prompt.id; // Update hidden select
        displayText.textContent = prompt.title; // Update custom display

        // Mark the prompt as used
        this.settingsManager.markPromptAsUsed(prompt.id).catch(error => {
          console.error("Failed to mark prompt as used:", error);
        });

        // Close the settings modal
        const settingsModal = row.closest('.modal') as HTMLElement;
        if (settingsModal) {
            // Find the Modal instance associated with the settingsModal element
            // This is a bit hacky, but Obsidian's Modal doesn't expose the instance easily
            // Alternatively, we could pass the settingsModal instance down.
            // For now, we'll assume the parent modal is the settings modal.
            const modalInstance = (settingsModal as any).modal as Modal;
            if (modalInstance) {
                 modalInstance.close();
            } else {
                 console.warn("Could not find settings modal instance to close.");
                 // Fallback: manually hide the element and re-show main modal
                 settingsModal.style.display = 'none';
                 this.contentEl.style.display = 'block';
            }
        } else {
             console.warn("Could not find settings modal element.");
             // Fallback: manually hide the element and re-show main modal
             this.contentEl.style.display = 'block';
        }

        // Focus the prompt textarea in the main modal
        promptInput.focus();
      } else {
        console.error("Could not find main modal elements to load prompt.");
      }
    });
  }
}
