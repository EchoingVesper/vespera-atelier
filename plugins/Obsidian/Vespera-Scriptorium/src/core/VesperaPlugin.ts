import { App, Notice, Plugin, TFile, TFolder, addIcon } from 'obsidian';
import { registerErrorView } from '../error-handling/ErrorView';
import { SettingsManager, VesperaScriptoriumSettings, DEFAULT_SETTINGS } from "../SettingsManager";
import { LLMClient, ProviderType, createLLMClient } from "../LLMClient";
import { OutputFilesManager, registerOutputFilesView, ProgressManager } from "../ui";

/**
 * Core plugin class for Vespera Scriptorium
 * Handles plugin lifecycle and maintains references to other modules
 */
export class VesperaPlugin extends Plugin {
  settings!: VesperaScriptoriumSettings;
  settingsManager!: SettingsManager;
  llmClient!: LLMClient;
  isCancelled: boolean = false;
  robustProcessingSystem: any = null;
  outputFilesManager: OutputFilesManager | null = null;

  /**
   * Plugin initialization
   * Loads settings, initializes modules, and registers UI components
   */
  async onload() {
    // Load error view CSS
    this.loadErrorHandlingComponents();
    try {
      console.log("Vespera Scriptorium: Starting plugin initialization");
      
      // Initialize settings manager first
      try {
        this.settingsManager = new SettingsManager(this.app);
        await this.settingsManager.initialize();
        this.settings = this.settingsManager.getSettings();
        console.log("Vespera Scriptorium: Settings manager initialized successfully");
      } catch (error) {
        console.error("Vespera Scriptorium: Failed to initialize settings manager", error);
        new Notice("Vespera Scriptorium: Failed to initialize settings. Using defaults.");
        // Create default settings as fallback
        this.settingsManager = new SettingsManager(this.app);
        this.settings = DEFAULT_SETTINGS;
      }
      
    // Data directory migration
    const oldProcessingPath = 'vespera-processing';
    const newProcessingPath = '.vespera-scriptorium/processing';

    try {
        const oldProcessingFolder = this.app.vault.getAbstractFileByPath(oldProcessingPath);
        console.log(`Vespera Scriptorium: oldProcessingFolder:`, oldProcessingFolder, `Type:`, oldProcessingFolder?.constructor.name);

        // Check if the old path exists and is a folder
        if (oldProcessingFolder && oldProcessingFolder instanceof TFolder) {
            console.log(`Vespera Scriptorium: Old processing directory found at ${oldProcessingPath}. Migrating...`);

            try {
                // Use app.vault.copy to move the folder contents.
                // This method is documented to copy a file or folder.
                // Assuming it handles recursive copying for folders.
                // If the destination exists, it should merge by overwriting.
                await this.app.vault.copy(oldProcessingFolder, newProcessingPath);
                console.log(`Vespera Scriptorium: Finished copying contents from ${oldProcessingPath} to ${newProcessingPath}`);

                // Trash the old directory after successful copy
                await this.app.vault.trash(oldProcessingFolder, true); // true to trash parent folder
                console.log(`Vespera Scriptorium: Old processing directory trashed: ${oldProcessingPath}`);

                new Notice("Vespera Scriptorium: Data migrated successfully from 'vespera-processing' to '.vespera-scriptorium/processing'.");
                console.log("Vespera Scriptorium: Data migration complete.");

            } catch (copyError) {
                 console.error(`Vespera Scriptorium: Failed to copy contents during migration from ${oldProcessingPath} to ${newProcessingPath}`, copyError);
                 new Notice(`Vespera Scriptorium: Failed to migrate data from 'vespera-processing'. Check console for details.`);
                 // Do not trash the old directory if copy failed
            }
        } else {
             console.log(`Vespera Scriptorium: Migration check: Old processing directory not found or is not a TFolder.`);
             console.log(`Vespera Scriptorium: Old processing directory not found at ${oldProcessingPath} or is not a folder. No migration needed.`);
        }
    } catch (error) {
        console.error("Vespera Scriptorium: Error during data directory migration check", error);
        new Notice("Vespera Scriptorium: Error checking for old data directory. Migration skipped.");
    }

      // Load CSS early to ensure UI elements display correctly
      try {
        await this.loadStyles();
        console.log("Vespera Scriptorium: Styles loaded successfully");
      } catch (error) {
        console.error("Vespera Scriptorium: Failed to load styles", error);
        // Non-critical error, continue initialization
      }
      
      // Initialize LLM client with error handling
      try {
        this.initializeLLMClient();
        console.log("Vespera Scriptorium: LLM client initialized successfully");
      } catch (error) {
        console.error("Vespera Scriptorium: Failed to initialize LLM client", error);
        new Notice("Vespera Scriptorium: Failed to initialize LLM client. Some features may not work correctly.");
      }
      
      // Initialize robust processing system if enabled
      if (this.settings.robustProcessing.enabled) {
        try {
          await this.initializeRobustProcessingSystem();
          console.log("Vespera Scriptorium: Robust processing system initialized successfully");
        } catch (error) {
          console.error("Vespera Scriptorium: Failed to initialize robust processing system", error);
          new Notice("Vespera Scriptorium: Failed to initialize robust processing system. Falling back to standard processing.");
          // Disable robust processing to prevent further errors
          this.settings.robustProcessing.enabled = false;
        }
      }
      
      // Register UI views with error handling
      try {
        this.registerUIComponents();
        console.log("Vespera Scriptorium: UI views registered successfully");
      } catch (error) {
        console.error("Vespera Scriptorium: Failed to register UI views", error);
        new Notice("Vespera Scriptorium: Failed to register UI components. Some features may not be available.");
      }

      // Register commands, ribbon icons, and settings tab
      this.registerCommands();
      this.registerRibbonIcons();
      this.registerSettingsTab();

      // Register event listeners
      this.registerEventListeners();

    } catch (error) {
      console.error("Vespera Scriptorium: Error during plugin initialization", error);
      new Notice("Vespera Scriptorium: Error during plugin initialization. Some features may not be available.");
    }
  }

  /**
   * Plugin cleanup
   * Unloads resources and cleans up references
   */
  /**
   * Loads error handling components including the ErrorView and CSS
   */
  private loadErrorHandlingComponents() {
    // Register the error view
    registerErrorView(this);
    
    // Load error view CSS
    const cssPath = this.manifest.dir + '/src/error-handling/error-view.css';
    this.addStyle(cssPath);
  }
  
  /**
   * Adds a stylesheet to the plugin
   * @param cssPath Path to the CSS file
   */
  private addStyle(cssPath: string): void {
    // Use the parent Plugin's registerStylesheet method
    this.addStyle(cssPath);
  }

  onunload(): void {
    console.log("Vespera Scriptorium: Unloading plugin");

    // Remove CSS
    const styleEl = document.getElementById('vespera-robust-processing-styles');
    if (styleEl) {
      styleEl.remove();
    }
    
    // Clean up LLM client if it exists
    if (this.llmClient) {
      console.log("Vespera Scriptorium: LLM client cleaned up");
    }
    
    // Clean up robust processing system if it exists
    if (this.robustProcessingSystem) {
      console.log("Vespera Scriptorium: Robust processing system cleaned up");
    }
    
    // Clean up output files manager if it exists
    if (this.outputFilesManager) {
      console.log("Vespera Scriptorium: Output files manager cleaned up");
    }
    
    // Cancel any ongoing operations
    this.isCancelled = true;
    
    console.log("Vespera Scriptorium: Plugin unloaded successfully");
  }

  /**
   * Load CSS styles for the plugin
   */
  private async loadStyles(): Promise<void> {
    try {
      // Create a style element
      const styleEl = document.createElement('style');
      styleEl.id = 'vespera-robust-processing-styles';
      
      // Get the path to the CSS file relative to the plugin directory
      const cssPath = this.manifest.dir + '/src/ui/robust-processing.css';
      
      try {
        // Load the CSS file using the proper Obsidian API
        const css = await this.app.vault.adapter.read(cssPath);
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
        console.log('Successfully loaded robust processing styles');
      } catch (error) {
        console.error('Error loading CSS:', error);
        // Fallback: Try loading using the resource path method
        const resourcePath = this.manifest.dir ?
          this.app.vault.adapter.getResourcePath(cssPath) :
          this.app.vault.adapter.getResourcePath('robust-processing.css');
        
        const response = await fetch(resourcePath);
        if (!response.ok) {
          throw new Error(`HTTP error! Status: ${response.status}`);
        }
        
        const css = await response.text();
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
        console.log('Successfully loaded robust processing styles (fallback method)');
      }
    } catch (error) {
      console.error('Error in loadStyles:', error);
      throw error;
    }
  }

  /**
   * Initialize the LLM client based on settings
   */
  private initializeLLMClient(): void {
    try {
      // Create provider config from settings
      const providerType = this.settings.llm.provider === 'ollama' ?
        ProviderType.OLLAMA :
        (this.settings.llm.provider === 'lm_studio' ? ProviderType.LM_STUDIO : ProviderType.OLLAMA);
      
      const providerConfig = {
        type: providerType,
        endpoint: this.settings.llm.endpoint,
        timeout: this.settings.llm.timeout,
        maxRetries: this.settings.llm.maxRetries
      };
      
      // Log the provider type for debugging
      console.log(`Initializing LLM client with provider: ${providerType}`);
      
      // Create LLM client
      this.llmClient = createLLMClient(providerConfig);
      
      // Validate the client was created successfully
      if (!this.llmClient) {
        throw new Error("Failed to create LLM client");
      }
    } catch (error) {
      console.error("Error initializing LLM client:", error);
      throw new Error(`Failed to initialize LLM client: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Initialize the robust processing system
   */
  private async initializeRobustProcessingSystem(): Promise<void> {
    try {
      // Import the robust processing system
      const { initializeRobustProcessingSystem } = await import('../robust-processing');
      
      // Initialize the system
      this.robustProcessingSystem = initializeRobustProcessingSystem(this.app);
      
      // Validate the system was initialized successfully
      if (!this.robustProcessingSystem) {
        throw new Error("Robust processing system returned null or undefined");
      }
      
      console.log('Robust processing system initialized');
    } catch (error) {
      console.error('Error initializing robust processing system:', error);
      // Propagate the error to be handled by the caller
      throw new Error(`Failed to initialize robust processing system: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Register UI components
   */
  private registerUIComponents(): void {
    // Register progress pane
    const { registerProgressPane } = require("../ui");
    registerProgressPane(this);
    
    // Register output files view
    this.outputFilesManager = registerOutputFilesView(this);
  }

  /**
   * Register plugin commands
   * This is a placeholder that will be implemented by specific modules
   */
  private registerCommands(): void {
    // Commands will be registered by specific modules
    console.log("Vespera Scriptorium: Commands will be registered by specific modules");
  }

  /**
   * Register ribbon icons
   * This is a placeholder that will be implemented by specific modules
   */
  private registerRibbonIcons(): void {
    // Ribbon icons will be registered by specific modules
    console.log("Vespera Scriptorium: Ribbon icons will be registered by specific modules");
  }

  /**
   * Register settings tab
   * This is a placeholder that will be implemented by specific modules
   */
  private registerSettingsTab(): void {
    // Settings tab will be registered by specific modules
    console.log("Vespera Scriptorium: Settings tab will be registered by specific modules");
  }

  /**
   * Register event listeners
   * This is a placeholder that will be implemented by specific modules
   */
  private registerEventListeners(): void {
    // Event listeners will be registered by specific modules
    console.log("Vespera Scriptorium: Event listeners will be registered by specific modules");
  }

  /**
   * Load settings from plugin data
   */
  async loadSettings() {
    // Load plugin data and merge with settings
    const data = await this.loadData();
    if (data) {
      // Update settings manager with any saved plugin data
      await this.settingsManager.updateSettings(data);
    }
    // Always get the latest settings
    this.settings = this.settingsManager.getSettings();
  }

  /**
   * Save settings to plugin data
   */
  async saveSettings() {
    await this.saveData(this.settings);
    await this.settingsManager.updateSettings(this.settings);
  }
}