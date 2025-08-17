import { App, Notice, Plugin, PluginSettingTab, Setting, TextComponent, ButtonComponent, Modal } from 'obsidian';
import { SettingsManager, VesperaScriptoriumSettings, DEFAULT_SETTINGS as DEFAULT_VESPERA_SETTINGS } from "./SettingsManager";
import { LLMClient, ProviderType, createLLMClient } from "./LLMClient";
import { registerProgressPane } from "./ui/ProgressPane";
import { registerOutputFilesView } from "./ui/OutputFilesView";
import { DocumentProcessor } from './processing/index';
import { LLMProcessingService } from './services';
import { ConnectionMonitoringService } from './services/ConnectionMonitoringService';
import { ConnectionStatusIndicator } from './ui/ConnectionStatusIndicator';
import { CommandManager } from './commands';
import { ErrorHandler, ErrorType, ErrorSeverity } from './utils';
import { renderLLMProviderSettings } from './llm-provider-settings';

/**
 * Main plugin class for Vespera Scriptorium
 * This is a thin wrapper around the core modules
 */
export default class VesperaScriptoriumPlugin extends Plugin {
  settings!: VesperaScriptoriumSettings;
  settingsManager!: SettingsManager;
  llmClient!: LLMClient;
  isCancelled: boolean = false;
  robustProcessingSystem: any = null;
  outputFilesManager: any = null;
  isLLMConnected: boolean = false; // Track LLM connection status
  private connectionStatusCallbacks: ((isConnected: boolean) => void)[] = []; // Callbacks for status changes
  private connectionMonitoringService!: ConnectionMonitoringService; // Connection monitoring service
  private statusIndicators: Map<string, ConnectionStatusIndicator> = new Map(); // Connection status indicators

  // Module instances
  private documentProcessor!: DocumentProcessor;
  private llmProcessingService!: LLMProcessingService;
  private commandManager!: CommandManager;
  private errorHandler: ErrorHandler = ErrorHandler.getInstance();

  /**
   * Plugin initialization
   */
  async onload() {
    try {
      console.log("Vespera Scriptorium: Starting plugin initialization");
      
      // Initialize settings manager first
      try {
        this.settingsManager = new SettingsManager(this.app);
        await this.settingsManager.initialize();
        this.settings = this.settingsManager.getSettings();
        console.log("Vespera Scriptorium: Settings manager initialized successfully");
      } catch (error) {
        this.errorHandler.handleError(error instanceof Error ? error : String(error), true);
        console.error("Vespera Scriptorium: Failed to initialize settings manager", error);
        new Notice("Vespera Scriptorium: Failed to initialize settings. Using defaults.");
        // Create default settings as fallback
        this.settingsManager = new SettingsManager(this.app);
        this.settings = DEFAULT_VESPERA_SETTINGS;
      }
      
      // Load CSS early to ensure UI elements display correctly
      try {
        await this.loadStyles();
        console.log("Vespera Scriptorium: Styles loaded successfully");
      } catch (error) {
        this.errorHandler.handleError(error instanceof Error ? error : String(error), false);
        console.error("Vespera Scriptorium: Failed to load styles", error);
        // Non-critical error, continue initialization
      }
      
      // Initialize LLM client with error handling
      try {
        this.initializeLLMClient();
        console.log("Vespera Scriptorium: LLM client initialized successfully");
      } catch (error) {
        this.errorHandler.handleError(error instanceof Error ? error : String(error), true);
        console.error("Vespera Scriptorium: Failed to initialize LLM client", error);
        new Notice("Vespera Scriptorium: Failed to initialize LLM client. Some features may not work correctly.");
      }
      
      // Initialize connection monitoring service
      try {
        this.connectionMonitoringService = new ConnectionMonitoringService(this.app, this.llmClient);
        await this.connectionMonitoringService.initialize();
        
        // Subscribe to connection status changes
        this.connectionMonitoringService.onConnectionStatusChange((status) => {
          this.isLLMConnected = status.isConnected;
          this.notifyLLMConnectionStatusChange(status.isConnected);
          console.log(`Vespera Scriptorium: LLM connection status changed to ${status.isConnected ? 'connected' : 'disconnected'}`);
        });
        
        console.log("Vespera Scriptorium: Connection monitoring service initialized successfully");
      } catch (error) {
        this.errorHandler.handleError(error instanceof Error ? error : String(error), false);
        console.error("Vespera Scriptorium: Failed to initialize connection monitoring service", error);
        new Notice("Vespera Scriptorium: Failed to initialize connection monitoring. Some features may not work correctly.");
      }
      
      // Initialize robust processing system if enabled
      if (this.settings.robustProcessing.enabled) {
        try {
          await this.initializeRobustProcessingSystem();
          console.log("Vespera Scriptorium: Robust processing system initialized successfully");
        } catch (error) {
          this.errorHandler.handleError(error instanceof Error ? error : String(error), true);
          console.error("Vespera Scriptorium: Failed to initialize robust processing system", error);
          new Notice("Vespera Scriptorium: Failed to initialize robust processing system. Falling back to standard processing.");
          // Disable robust processing to prevent further errors
          this.settings.robustProcessing.enabled = false;
        }
      }
      
      // Register UI views with error handling
      try {
        registerProgressPane(this);
        this.outputFilesManager = registerOutputFilesView(this);
        console.log("Vespera Scriptorium: UI views registered successfully");
      } catch (error) {
        this.errorHandler.handleError(error instanceof Error ? error : String(error), true);
        console.error("Vespera Scriptorium: Failed to register UI views", error);
        new Notice("Vespera Scriptorium: Failed to register UI components. Some features may not be available.");
      }
      
      // Initialize modules
      this.initializeModules();
      
      // Register settings tab
      this.addSettingTab(new SampleSettingTab(this.app, this));
      
      // Register DOM events
      this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
        console.log('click', evt);
      });
      
      // Add connection status indicator to ribbon
      this.addRibbonStatusIndicator();
      
    } catch (error) {
      this.errorHandler.handleError(error instanceof Error ? error : String(error), true);
      console.error("Vespera Scriptorium: Error during plugin initialization", error);
      new Notice("Vespera Scriptorium: Error during plugin initialization. Some features may not be available.");
    }
  }

  /**
   * Initialize all modules
   */
  private initializeModules(): void {
    try {
      // Initialize LLM processing service
      this.llmProcessingService = new LLMProcessingService(
        this.app,
        this.settings,
        this.llmClient
      );
      this.llmProcessingService.initialize(this);
      
      // Initialize document processor
      this.documentProcessor = new DocumentProcessor(
        this.app,
        this.settings,
        this.llmProcessingService,
        this.outputFilesManager,
        this
      );
      
      // Initialize command manager
      this.commandManager = new CommandManager(
        this.app,
        this,
        this.settings,
        this.documentProcessor
      );
      this.commandManager.initialize(this);
      
      console.log("Vespera Scriptorium: All modules initialized successfully");
    } catch (error) {
      this.errorHandler.handleError(error instanceof Error ? error : String(error), true);
      console.error("Vespera Scriptorium: Failed to initialize modules", error);
      new Notice("Vespera Scriptorium: Failed to initialize modules. Some features may not be available.");
    }
  }

  /**
   * Plugin cleanup
   */
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
    
    // Clean up modules
    if (this.llmProcessingService && this.llmProcessingService.cleanup) {
      this.llmProcessingService.cleanup();
    }
    
    if (this.commandManager && this.commandManager.cleanup) {
      this.commandManager.cleanup();
    }
    
    // Cancel any ongoing operations
    this.isCancelled = true;
    
    // Clean up connection monitoring service
    if (this.connectionMonitoringService) {
      this.connectionMonitoringService.cleanup();
    }
    
    // Remove all status indicators
    this.statusIndicators.forEach((indicator, key) => {
      indicator.remove();
    });
    this.statusIndicators.clear();
    
    console.log("Vespera Scriptorium: Plugin unloaded successfully");
  }
  
  /**
   * Load CSS styles for the plugin
   */
  private async loadStyles(): Promise<void> {
    try {
      // Create a style element
      const styleEl = document.createElement('style');
      styleEl.id = 'vespera-styles'; // Updated ID
      
      // Define the correct path for the CSS file relative to the plugin directory
      const cssPath = this.manifest.dir + '/src/ui/styles.css';
      
      let loaded = false;
      let lastError = null;
      
      // Attempt to load the CSS file using the proper Obsidian API
      try {
        const css = await this.app.vault.adapter.read(cssPath);
        styleEl.textContent = css;
        document.head.appendChild(styleEl);
        console.log(`Successfully loaded styles from: ${cssPath}`); // Updated log
        loaded = true;
      } catch (error) {
        console.log(`Attempted to load CSS from ${cssPath} but failed:`, error); // Updated log
        lastError = error;
      }
      
      // If direct read failed, try the resource path method as fallback
      if (!loaded) {
        try {
          console.log('Trying resource path method as fallback...');
          const resourcePath = this.app.vault.adapter.getResourcePath(cssPath);
          
          try {
            const response = await fetch(resourcePath);
            if (response.ok) {
              const css = await response.text();
              styleEl.textContent = css;
              document.head.appendChild(styleEl);
              console.log(`Successfully loaded styles from resource: ${resourcePath}`); // Updated log
              loaded = true;
            } else {
              throw new Error(`Failed to fetch resource: ${response.status} ${response.statusText}`);
            }
          } catch (fetchError) {
            console.log(`Resource path fetch failed for ${resourcePath}:`, fetchError);
            lastError = fetchError;
          }
        } catch (resourceError) {
          console.error('Resource path method failed:', resourceError);
          lastError = resourceError;
        }
      }
      
      // If still not loaded, throw the last error
      if (!loaded) {
        throw new Error(`Could not load CSS file from any location. Last error: ${lastError}`);
      }
    } catch (error) {
      console.error('Error in loadStyles:', error);
      throw error;
    }
  }

  /**
   * Initialize the LLM client based on settings
   */
  initializeLLMClient(): void {
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
      const { initializeRobustProcessingSystem } = await import('./robust-processing');
      
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

  /**
   * Register a callback to be notified when the LLM connection status changes.
   * @param callback The callback function to register.
   */
  onLLMConnectionStatusChange(callback: (isConnected: boolean) => void): void {
    this.connectionStatusCallbacks.push(callback);
    
    // Immediately notify with current status
    try {
      callback(this.isLLMConnected);
    } catch (error) {
      console.error("Error in LLM connection status change callback:", error);
    }
  }

  /**
   * Notify registered callbacks of a change in LLM connection status.
   * @param isConnected The new connection status.
   */
  private notifyLLMConnectionStatusChange(isConnected: boolean): void {
    for (const callback of this.connectionStatusCallbacks) {
      try {
        callback(isConnected);
      } catch (error) {
        console.error("Error in LLM connection status change callback:", error);
      }
    }
  }
  
  /**
   * Add a connection status indicator to an element
   * @param element The element to add the indicator to
   * @param id A unique identifier for the indicator
   * @param position The position of the indicator
   * @returns The created indicator
   */
  addConnectionStatusIndicator(element: HTMLElement, id: string, position: 'bottom-right' | 'bottom-left' | 'top-right' | 'top-left' = 'bottom-right'): ConnectionStatusIndicator {
    // Remove existing indicator with the same ID if it exists
    if (this.statusIndicators.has(id)) {
      this.statusIndicators.get(id)?.remove();
    }
    
    // Create new indicator
    const indicator = new ConnectionStatusIndicator({
      parent: element,
      position,
      initialStatus: this.connectionMonitoringService ?
        this.connectionMonitoringService.getStatus() :
        {
          isConnected: this.isLLMConnected,
          lastChecked: Date.now(),
          lastSuccessful: this.isLLMConnected ? Date.now() : null,
          consecutiveFailures: 0,
          provider: this.llmClient.getProviderType(),
          endpoint: this.llmClient.getEndpoint()
        }
    });
    
    // Store indicator
    this.statusIndicators.set(id, indicator);
    
    // Subscribe to connection status changes
    if (this.connectionMonitoringService) {
      this.connectionMonitoringService.onConnectionStatusChange((status) => {
        indicator.updateStatus(status);
      });
    } else {
      // Fallback to basic status updates if monitoring service is not available
      this.onLLMConnectionStatusChange((isConnected) => {
        indicator.updateStatus({
          isConnected,
          lastChecked: Date.now(),
          lastSuccessful: isConnected ? Date.now() : null,
          consecutiveFailures: 0,
          provider: this.llmClient.getProviderType(),
          endpoint: this.llmClient.getEndpoint()
        });
      });
    }
    
    return indicator;
  }
  
  /**
   * Add a connection status indicator to the ribbon
   */
  private addRibbonStatusIndicator(): void {
    // Create a container for the ribbon icon
    const ribbonIconEl = this.addRibbonIcon('pulse', 'LLM Connection Status', () => {
      // Force a connection check when clicked
      if (this.connectionMonitoringService) {
        this.connectionMonitoringService.checkConnection().catch(error => {
          console.error("Error checking connection:", error);
        });
      }
      
      // Show a notice with the current status
      const status = this.connectionMonitoringService ?
        this.connectionMonitoringService.getStatus() :
        { isConnected: this.isLLMConnected };
      
      new Notice(`LLM Provider: ${status.isConnected ? 'Connected' : 'Disconnected'}`);
    });
    
    // Add status indicator to the ribbon icon
    if (ribbonIconEl) {
      // Set position relative for the ribbon icon container
      ribbonIconEl.style.position = 'relative';
      
      // Add the indicator
      this.addConnectionStatusIndicator(ribbonIconEl, 'ribbon', 'bottom-right');
    }
  }
}

class SampleModal extends Modal {
  constructor(app: App) {
    super(app);
  }

  onOpen() {
    const {contentEl} = this;
    contentEl.setText('Woah!');
  }

  onClose() {
    const {contentEl} = this;
    contentEl.empty();
  }
}

class SampleSettingTab extends PluginSettingTab {
  plugin: VesperaScriptoriumPlugin;

  constructor(app: App, plugin: VesperaScriptoriumPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  /**
   * Get the default endpoint for a given provider
   * @param provider The LLM provider type
   * @returns The default endpoint URL
   */
  private getDefaultEndpoint(provider: string): string {
    switch (provider) {
      case 'ollama':
        return 'http://localhost:11434';
      case 'lm_studio':
        return 'http://localhost:1234';
      default:
        return ''; // Or a sensible default for unknown providers
    }
  }

  display(): void {
    const {containerEl} = this;

    containerEl.empty();

    containerEl.createEl('h2', { text: 'Vespera Scriptorium Settings' });

    // Chunking settings
    containerEl.createEl('h3', { text: 'Text Chunking Options' });

    new Setting(containerEl)
      .setName('Chunk Size (tokens)')
      .setDesc('The size of each chunk in tokens (approximate)')
      .addSlider(slider => slider
        .setLimits(100, 8000, 100)
        .setValue(this.plugin.settings.chunkSize)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.chunkSize = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Chunk Overlap (tokens)')
      .setDesc('The number of tokens to overlap between chunks')
      .addSlider(slider => slider
        .setLimits(0, 500, 10)
        .setValue(this.plugin.settings.chunkOverlap)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.chunkOverlap = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Model Context Window (tokens)')
      .setDesc('The maximum context window size of your LLM model')
      .addSlider(slider => slider
        .setLimits(1000, 128000, 1000) // Increased max limit
        .setValue(this.plugin.settings.modelContextWindow)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.modelContextWindow = value;
          // Ensure chunk size doesn't exceed model context window minus overhead
          if (this.plugin.settings.chunkSize > value - 500) {
            this.plugin.settings.chunkSize = value - 500;
            new Notice(`Chunk size has been adjusted to ${value - 500} to fit within the model context window.`);
          }
          await this.plugin.saveSettings();
        }));

    // Cleanup settings
    containerEl.createEl('h3', { text: 'Cleanup Options' });

    new Setting(containerEl)
      .setName('Spelling Cleanup')
      .setDesc('Enable automatic spelling correction')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.cleanup.spelling)
        .onChange(async (value) => {
          this.plugin.settings.cleanup.spelling = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Punctuation Cleanup')
      .setDesc('Enable automatic punctuation correction')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.cleanup.punctuation)
        .onChange(async (value) => {
          this.plugin.settings.cleanup.punctuation = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Formatting Cleanup')
      .setDesc('Enable automatic formatting correction')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.cleanup.formatting)
        .onChange(async (value) => {
          this.plugin.settings.cleanup.formatting = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Whitespace Cleanup')
      .setDesc('Enable automatic whitespace correction')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.cleanup.whitespace)
        .onChange(async (value) => {
          this.plugin.settings.cleanup.whitespace = value;
          await this.plugin.saveSettings();
        }));

// LLM settings
    // Use the refactored LLM provider settings UI component
    renderLLMProviderSettings(
      containerEl,
      this.plugin,
      this.getDefaultEndpoint,
      // Optional callback for when endpoint changes
      (provider, endpoint) => {
        console.log(`LLM provider changed to ${provider} with endpoint ${endpoint}`);
      }
    );


    new Setting(containerEl)
      .setName('LLM Model')
      .setDesc('The name of the LLM model to use')
      .addText(text => text
        .setPlaceholder('e.g., llama2')
        .setValue(this.plugin.settings.llm.model)
        .onChange(async (value) => {
          this.plugin.settings.llm.model = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Temperature')
      .setDesc('Controls the randomness of the output (0.0 - 1.0)')
      .addSlider(slider => slider
        .setLimits(0, 1, 0.01)
        .setValue(this.plugin.settings.llm.temperature)
        .setDynamicTooltip()
        .onChange(async (value) => {
          this.plugin.settings.llm.temperature = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Max Tokens')
      .setDesc('The maximum number of tokens to generate in the output')
      .addText(text => text
        .setPlaceholder('e.g., 2048')
        .setValue(this.plugin.settings.llm.maxTokens.toString())
        .onChange(async (value) => {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            this.plugin.settings.llm.maxTokens = numValue;
            await this.plugin.saveSettings();
          } else {
            new Notice('Invalid input for Max Tokens. Please enter a number.');
          }
        }));

    new Setting(containerEl)
      .setName('Max Retries')
      .setDesc('The maximum number of retries for failed LLM calls')
      .addText(text => text
        .setPlaceholder('e.g., 3')
        .setValue(this.plugin.settings.llm.maxRetries.toString())
        .onChange(async (value) => {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            this.plugin.settings.llm.maxRetries = numValue;
            await this.plugin.saveSettings();
          } else {
            new Notice('Invalid input for Max Retries. Please enter a number.');
          }
        }));

    new Setting(containerEl)
      .setName('LLM Timeout (ms)')
      .setDesc('The timeout for LLM calls in milliseconds')
      .addText(text => text
        .setPlaceholder('e.g., 30000')
        .setValue(this.plugin.settings.llm.timeout.toString())
        .onChange(async (value) => {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            this.plugin.settings.llm.timeout = numValue;
            await this.plugin.saveSettings();
          } else {
            new Notice('Invalid input for LLM Timeout. Please enter a number.');
          }
        }));

    new Setting(containerEl)
      .setName('Chunk Timeout (ms)')
      .setDesc('Timeout for each LLM chunk operation in milliseconds')
      .addText(text => text
        .setPlaceholder('e.g., 30000')
        .setValue(this.plugin.settings.llm.chunkTimeout?.toString() || '')
        .onChange(async (value) => {
          const numValue = parseInt(value, 10);
          if (!isNaN(numValue)) {
            this.plugin.settings.llm.chunkTimeout = numValue;
            await this.plugin.saveSettings();
          } else {
            new Notice('Invalid input for Chunk Timeout. Please enter a number.');
          }
        }));

    // Writer settings
    containerEl.createEl('h3', { text: 'Writer Options' });

    new Setting(containerEl)
      .setName('Output Location')
      .setDesc('Where to save the processed output')
      .addDropdown(dropdown => dropdown
        .addOption('summaries-folder', 'Summaries Folder')
        .addOption('original-location', 'Original File Location')
        .addOption('custom-path', 'Custom Path')
        .setValue(this.plugin.settings.writer.outputLocation)
        .onChange(async (value) => {
          this.plugin.settings.writer.outputLocation = value as 'summaries-folder' | 'original-location' | 'custom-path';
          await this.plugin.saveSettings();
          // Potentially redraw settings to show/hide custom path input
          this.display();
        }));

    new Setting(containerEl)
      .setName('Custom Output Path')
      .setDesc('Specify a custom folder path for output (if Output Location is Custom Path)')
      .addText(text => text
        .setPlaceholder('e.g., path/to/output')
        .setValue(this.plugin.settings.writer.customPath)
        .onChange(async (value) => {
          this.plugin.settings.writer.customPath = value;
          await this.plugin.saveSettings();
        }))
      .setClass(this.plugin.settings.writer.outputLocation === 'custom-path' ? '' : 'vespera-hidden-setting'); // Hide if not custom path

    new Setting(containerEl)
      .setName('Include Metadata')
      .setDesc('Include processing metadata in the output file')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.writer.includeMetadata)
        .onChange(async (value) => {
          this.plugin.settings.writer.includeMetadata = value;
          await this.plugin.saveSettings();
          // Potentially redraw settings to show/hide metadata options
          this.display();
        }));

    // Metadata Options (conditionally displayed)
    if (this.plugin.settings.writer.includeMetadata) {
      containerEl.createEl('h4', { text: 'Metadata Options' });

      new Setting(containerEl)
        .setName('Include Date')
        .setDesc('Include the processing date in metadata')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.writer.metadataOptions.includeDate)
          .onChange(async (value) => {
            this.plugin.settings.writer.metadataOptions.includeDate = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Include Model')
        .setDesc('Include the LLM model name in metadata')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.writer.metadataOptions.includeModel)
          .onChange(async (value) => {
            this.plugin.settings.writer.metadataOptions.includeModel = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Include Prompt')
        .setDesc('Include the prompt used in metadata')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.writer.metadataOptions.includePrompt)
          .onChange(async (value) => {
            this.plugin.settings.writer.metadataOptions.includePrompt = value;
            await this.plugin.saveSettings();
          }));
    }

    new Setting(containerEl)
      .setName('File Name Format')
      .setDesc('Format for the output file name. Use {original} for the original file name.')
      .addText(text => text
        .setPlaceholder('e.g., {original}_summary')
        .setValue(this.plugin.settings.writer.fileNameFormat)
        .onChange(async (value) => {
          this.plugin.settings.writer.fileNameFormat = value;
          await this.plugin.saveSettings();
        }));

    new Setting(containerEl)
      .setName('Confirm Overwrite')
      .setDesc('Ask for confirmation before overwriting existing files')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.writer.confirmOverwrite)
        .onChange(async (value) => {
          this.plugin.settings.writer.confirmOverwrite = value;
          await this.plugin.saveSettings();
        }));

    // Robust Processing settings
    containerEl.createEl('h3', { text: 'Robust Processing System Options' });

    new Setting(containerEl)
      .setName('Enable Robust Processing')
      .setDesc('Enable the robust document processing system')
      .addToggle(toggle => toggle
        .setValue(this.plugin.settings.robustProcessing.enabled)
        .onChange(async (value) => {
          this.plugin.settings.robustProcessing.enabled = value;
          await this.plugin.saveSettings();
          // Redraw settings to show/hide robust processing options
          this.display();
        }));

    // Robust Processing sub-settings (conditionally displayed)
    if (this.plugin.settings.robustProcessing.enabled) {
      containerEl.createEl('h4', { text: 'Context Window Detection' });

      new Setting(containerEl)
        .setName('Detection Strategy')
        .setDesc('Strategy for detecting context window size')
        .addDropdown(dropdown => dropdown
          .addOption('probe', 'Probe Model')
          .addOption('api', 'Use Provider API')
          .addOption('manual', 'Manual Size')
          .setValue(this.plugin.settings.robustProcessing.contextWindow.detectionStrategy)
          .onChange(async (value) => {
              this.plugin.settings.robustProcessing.contextWindow.detectionStrategy = value as 'probe' | 'api' | 'manual';
              await this.plugin.saveSettings();
              this.display(); // Redraw to show/hide manual size input
            }));

      new Setting(containerEl)
        .setName('Manual Context Window Size')
        .setDesc('Manually specified context window size (used if strategy is Manual)')
        .addText(text => text
          .setPlaceholder('e.g., 4096')
          .setValue(this.plugin.settings.robustProcessing.contextWindow.manualSize.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.contextWindow.manualSize = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Manual Context Window Size. Please enter a number.');
            }
          }))
        .setClass(this.plugin.settings.robustProcessing.contextWindow.detectionStrategy === 'manual' ? '' : 'vespera-hidden-setting'); // Hide if not manual

      new Setting(containerEl)
        .setName('Context Window Cache TTL (ms)')
        .setDesc('Time to live for context window cache in milliseconds')
        .addText(text => text
          .setPlaceholder('e.g., 86400000')
          .setValue(this.plugin.settings.robustProcessing.contextWindow.cacheTTL.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.contextWindow.cacheTTL = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Cache TTL. Please enter a number.');
            }
          }));

      containerEl.createEl('h4', { text: 'Chunking Settings' });

      new Setting(containerEl)
        .setName('Safety Margin (%)')
        .setDesc('Safety margin percentage to subtract from detected context window')
        .addSlider(slider => slider
          .setLimits(0, 50, 1)
          .setValue(this.plugin.settings.robustProcessing.chunking.safetyMarginPercent)
          .setDynamicTooltip()
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.chunking.safetyMarginPercent = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Minimum Chunk Size (tokens)')
        .setDesc('Minimum chunk size in tokens')
        .addText(text => text
          .setPlaceholder('e.g., 100')
          .setValue(this.plugin.settings.robustProcessing.chunking.minChunkSize.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.chunking.minChunkSize = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Minimum Chunk Size. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Maximum Chunk Size (tokens)')
        .setDesc('Maximum chunk size in tokens')
        .addText(text => text
          .setPlaceholder('e.g., 8192')
          .setValue(this.plugin.settings.robustProcessing.chunking.maxChunkSize.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.chunking.maxChunkSize = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Maximum Chunk Size. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Content-Aware Chunking')
        .setDesc('Whether to use content-aware chunking')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.chunking.contentAwareChunking)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.chunking.contentAwareChunking = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Preserve Paragraphs')
        .setDesc('Whether to preserve paragraphs when chunking')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.chunking.preserveParagraphs)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.chunking.preserveParagraphs = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Preserve Sentences')
        .setDesc('Whether to preserve sentences when chunking')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.chunking.preserveSentences)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.chunking.preserveSentences = value;
            await this.plugin.saveSettings();
          }));

      containerEl.createEl('h4', { text: 'Processing Settings' });

      new Setting(containerEl)
        .setName('Base Timeout (ms)')
        .setDesc('Base timeout in milliseconds')
        .addText(text => text
          .setPlaceholder('e.g., 30000')
          .setValue(this.plugin.settings.robustProcessing.processing.baseTimeout.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.processing.baseTimeout = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Base Timeout. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Maximum Timeout (ms)')
        .setDesc('Maximum timeout in milliseconds')
        .addText(text => text
          .setPlaceholder('e.g., 300000')
          .setValue(this.plugin.settings.robustProcessing.processing.maxTimeout.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.processing.maxTimeout = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Maximum Timeout. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Timeout Scaling Factor')
        .setDesc('Timeout scaling factor based on chunk size')
        .addText(text => text
          .setPlaceholder('e.g., 1.5')
          .setValue(this.plugin.settings.robustProcessing.processing.timeoutScaleFactor.toString())
          .onChange(async (value) => {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.processing.timeoutScaleFactor = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Timeout Scaling Factor. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Maximum Retries')
        .setDesc('Maximum number of retries for failed chunks')
        .addText(text => text
          .setPlaceholder('e.g., 3')
          .setValue(this.plugin.settings.robustProcessing.processing.maxRetries.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.processing.maxRetries = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Maximum Retries. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Batch Size')
        .setDesc('Number of chunks to process in parallel')
        .addText(text => text
          .setPlaceholder('e.g., 5')
          .setValue(this.plugin.settings.robustProcessing.processing.batchSize.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.processing.batchSize = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Batch Size. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Adaptive Timeout')
        .setDesc('Whether to use adaptive timeout based on chunk size')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.processing.adaptiveTimeout)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.processing.adaptiveTimeout = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Hardware Profile')
        .setDesc('Hardware profile for timeout calculation')
        .addDropdown(dropdown => dropdown
          .addOption('consumer-gpu', 'Consumer GPU')
          .addOption('high-end-gpu', 'High-End GPU')
          .addOption('cpu-only', 'CPU Only')
          .setValue(this.plugin.settings.robustProcessing.processing.hardwareProfile)
          .onChange(async (value) => {
              this.plugin.settings.robustProcessing.processing.hardwareProfile = value as 'consumer-gpu' | 'high-end-gpu' | 'cpu-only';
              await this.plugin.saveSettings();
            }));

      containerEl.createEl('h4', { text: 'Persistence Settings' });

      new Setting(containerEl)
        .setName('Save Partial Results')
        .setDesc('Whether to save partial results during processing')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.persistence.savePartialResults)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.persistence.savePartialResults = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Use Checkpointing')
        .setDesc('Whether to use checkpointing to resume processing')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.persistence.useCheckpointing)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.persistence.useCheckpointing = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Checkpoint Interval (chunks)')
        .setDesc('Checkpoint interval in chunks')
        .addText(text => text
          .setPlaceholder('e.g., 5')
          .setValue(this.plugin.settings.robustProcessing.persistence.checkpointInterval.toString())
          .onChange(async (value) => {
            const numValue = parseInt(value, 10);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.persistence.checkpointInterval = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Checkpoint Interval. Please enter a number.');
            }
          }));

      new Setting(containerEl)
        .setName('Working Directory')
        .setDesc('Working directory for checkpoints and partial results')
        .addText(text => text
          .setPlaceholder('e.g., .vespera-scriptorium/processing')
          .setValue(this.plugin.settings.robustProcessing.persistence.workingDirectory)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.persistence.workingDirectory = value;
            await this.plugin.saveSettings();
          }));

      containerEl.createEl('h4', { text: 'Assembly Settings' });

      new Setting(containerEl)
        .setName('Preserve Chunk Boundaries')
        .setDesc('Whether to preserve chunk boundaries in the assembled document')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.assembly.preserveChunkBoundaries)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.assembly.preserveChunkBoundaries = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Resolve References')
        .setDesc('Whether to resolve references in the assembled document')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.assembly.resolveReferences)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.assembly.resolveReferences = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Detect Redundancies')
        .setDesc('Whether to detect redundancies in the assembled document')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.assembly.detectRedundancies)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.assembly.detectRedundancies = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Optimize for Coherence')
        .setDesc('Whether to optimize for coherence in the assembled document')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.assembly.optimizeForCoherence)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.assembly.optimizeForCoherence = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Similarity Threshold')
        .setDesc('Similarity threshold for redundancy detection (0.0 - 1.0)')
        .addText(text => text
          .setPlaceholder('e.g., 0.8')
          .setValue(this.plugin.settings.robustProcessing.assembly.similarityThreshold.toString())
          .onChange(async (value) => {
            const numValue = parseFloat(value);
            if (!isNaN(numValue)) {
              this.plugin.settings.robustProcessing.assembly.similarityThreshold = numValue;
              await this.plugin.saveSettings();
            } else {
              new Notice('Invalid input for Similarity Threshold. Please enter a number.');
            }
          }));

      containerEl.createEl('h4', { text: 'Output Settings' });

      new Setting(containerEl)
        .setName('Output Format')
        .setDesc('Output format for the processed document')
        .addDropdown(dropdown => dropdown
          .addOption('markdown', 'Markdown')
          .addOption('html', 'HTML')
          .addOption('json', 'JSON')
          .addOption('text', 'Text')
          .setValue(this.plugin.settings.robustProcessing.output.format)
          .onChange(async (value) => {
              this.plugin.settings.robustProcessing.output.format = value as 'markdown' | 'html' | 'json' | 'text';
              await this.plugin.saveSettings();
            }));

      new Setting(containerEl)
        .setName('Consolidate Output')
        .setDesc('Whether to consolidate output into a single file')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.output.consolidate)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.output.consolidate = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Include Metadata')
        .setDesc('Whether to include metadata in the output')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.output.includeMetadata)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.output.includeMetadata = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Include Processing Stats')
        .setDesc('Whether to include processing stats in the output')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.output.includeProcessingStats)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.output.includeProcessingStats = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Create Table of Contents')
        .setDesc('Whether to create a table of contents')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.output.createTableOfContents)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.output.createTableOfContents = value;
            await this.plugin.saveSettings();
          }));

      new Setting(containerEl)
        .setName('Include References')
        .setDesc('Whether to include references')
        .addToggle(toggle => toggle
          .setValue(this.plugin.settings.robustProcessing.output.includeReferences)
          .onChange(async (value) => {
            this.plugin.settings.robustProcessing.output.includeReferences = value;
            await this.plugin.saveSettings();
          }));
    }
  }
}
