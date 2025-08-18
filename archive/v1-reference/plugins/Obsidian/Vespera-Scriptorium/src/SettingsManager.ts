import { App, TFile, normalizePath } from "obsidian";
import { v4 as uuidv4 } from 'uuid';

/**
 * Interface for plugin settings
 */
export interface VesperaScriptoriumSettings {
  /**
   * The size of each chunk in tokens (approximate)
   * @default 1000
   */
  chunkSize: number;
  
  /**
   * The number of tokens to overlap between chunks
   * @default 50
   */
  chunkOverlap: number;
  
  /**
   * The maximum context window size of the model in tokens
   * This is used to ensure chunks don't exceed the model's capacity
   * @default 4096
   */
  modelContextWindow: number;
  
  cleanup: {
    spelling: boolean;
    punctuation: boolean;
    formatting: boolean;
    whitespace: boolean;
  };
  llm: {
    provider: string;
    endpoint: string;
    model: string;
    temperature: number;
    maxTokens: number;
    maxRetries: number;
    timeout: number;
    defaultEndpoint: string;
    /**
     * Timeout for each LLM chunk operation in milliseconds
     * @default 30000 (30s)
     */
    chunkTimeout?: number;
  };
  writer: {
    outputLocation: string; // 'summaries-folder', 'original-location', 'custom-path'
    customPath: string;
    includeMetadata: boolean;
    metadataOptions: {
      includeDate: boolean;
      includeModel: boolean;
      includePrompt: boolean;
    };
    fileNameFormat: string;
    confirmOverwrite: boolean;
  };
  /**
   * Robust processing system settings
   */
  robustProcessing: {
    /**
     * Whether to use the robust processing system
     * @default false
     */
    enabled: boolean;
    
    /**
     * Context window detection settings
     */
    contextWindow: {
      /**
       * Strategy for detecting context window size
       * - 'probe': Automatically probe the model to detect context window
       * - 'api': Use provider API to get context window (if available)
       * - 'manual': Use manually specified context window size
       * @default 'probe'
       */
      detectionStrategy: 'probe' | 'api' | 'manual';
      
      /**
       * Manually specified context window size (used if strategy is 'manual')
       * @default 4096
       */
      manualSize: number;
      
      /**
       * Time to live for context window cache in milliseconds
       * @default 86400000 (24 hours)
       */
      cacheTTL: number;
    };
    
    /**
     * Chunking settings
     */
    chunking: {
      /**
       * Safety margin percentage to subtract from detected context window
       * @default 15
       */
      safetyMarginPercent: number;
      
      /**
       * Minimum chunk size in tokens
       * @default 100
       */
      minChunkSize: number;
      
      /**
       * Maximum chunk size in tokens
       * @default 8192
       */
      maxChunkSize: number;
      
      /**
       * Whether to use content-aware chunking
       * @default true
       */
      contentAwareChunking: boolean;
      
      /**
       * Whether to preserve paragraphs when chunking
       * @default true
       */
      preserveParagraphs: boolean;
      
      /**
       * Whether to preserve sentences when chunking
       * @default true
       */
      preserveSentences: boolean;
    };
    
    /**
     * Processing settings
     */
    processing: {
      /**
       * Base timeout in milliseconds
       * @default 30000 (30 seconds)
       */
      baseTimeout: number;
      
      /**
       * Maximum timeout in milliseconds
       * @default 300000 (5 minutes)
       */
      maxTimeout: number;
      
      /**
       * Timeout scaling factor based on chunk size
       * @default 1.5
       */
      timeoutScaleFactor: number;
      
      /**
       * Maximum number of retries for failed chunks
       * @default 3
       */
      maxRetries: number;
      
      /**
       * Number of chunks to process in parallel
       * @default 5
       */
      batchSize: number;
      
      /**
       * Whether to use adaptive timeout based on chunk size
       * @default true
       */
      adaptiveTimeout: boolean;
      
      /**
       * Hardware profile for timeout calculation
       * - 'consumer-gpu': Consumer-grade GPU (e.g., RTX 2080)
       * - 'high-end-gpu': High-end GPU (e.g., RTX 3090, 4090)
       * - 'cpu-only': CPU-only processing
       * @default 'consumer-gpu'
       */
      hardwareProfile: 'consumer-gpu' | 'high-end-gpu' | 'cpu-only';
    };
    
    /**
     * Persistence settings
     */
    persistence: {
      /**
       * Whether to save partial results
       * @default true
       */
      savePartialResults: boolean;
      
      /**
       * Whether to use checkpointing
       * @default true
       */
      useCheckpointing: boolean;
      
      /**
       * Checkpoint interval in chunks
       * @default 5
       */
      checkpointInterval: number;
      
      /**
       * Working directory for checkpoints and partial results
       * @default '.vespera-scriptorium/processing'
       */
      workingDirectory: string;
    };
    
    /**
     * Assembly settings
     */
    assembly: {
      /**
       * Whether to preserve chunk boundaries in the assembled document
       * @default false
       */
      preserveChunkBoundaries: boolean;
      
      /**
       * Whether to resolve references in the assembled document
       * @default true
       */
      resolveReferences: boolean;
      
      /**
       * Whether to detect redundancies in the assembled document
       * @default true
       */
      detectRedundancies: boolean;
      
      /**
       * Whether to optimize for coherence in the assembled document
       * @default true
       */
      optimizeForCoherence: boolean;
      
      /**
       * Similarity threshold for redundancy detection
       * @default 0.8
       */
      similarityThreshold: number;
    };
    
    /**
     * Output settings
     */
    output: {
      /**
       * Output format
       * @default 'markdown'
       */
      format: 'markdown' | 'html' | 'json' | 'text';
      
      /**
       * Whether to consolidate output into a single file
       * @default true
       */
      consolidate: boolean;
      
      /**
       * Whether to include metadata in the output
       * @default true
       */
      includeMetadata: boolean;
      
      /**
       * Whether to include processing stats in the output
       * @default true
       */
      includeProcessingStats: boolean;
      
      /**
       * Whether to create a table of contents
       * @default true
       */
      createTableOfContents: boolean;
      
      /**
       * Whether to include references
       * @default true
       */
      includeReferences: boolean;
    };
  };
}

/**
 * Default settings
 */
export const DEFAULT_SETTINGS: VesperaScriptoriumSettings = {
  chunkSize: 1000,
  chunkOverlap: 50,
  modelContextWindow: 4096, // Conservative default matching most local models
  cleanup: {
    spelling: false,
    punctuation: false,
    formatting: false,
    whitespace: false
  },
  llm: {
    provider: 'ollama', // Default to Ollama
    endpoint: 'http://localhost:11434', // Default Ollama endpoint
    defaultEndpoint: 'http://localhost:11434', // Default endpoint for the current provider
    model: 'llama2', // Default model
    temperature: 0.7,
    maxTokens: 2048,
    maxRetries: 3,
    timeout: 30000, // 30 seconds
    chunkTimeout: 30000, // 30s default per-chunk timeout
  },
  writer: {
    outputLocation: 'summaries-folder', // Default to summaries folder
    customPath: '',
    includeMetadata: true,
    metadataOptions: {
      includeDate: true,
      includeModel: true,
      includePrompt: true
    },
    fileNameFormat: '{original}_summary',
    confirmOverwrite: true
  },
  robustProcessing: {
    enabled: false,
    contextWindow: {
      detectionStrategy: 'probe',
      manualSize: 4096,
      cacheTTL: 86400000 // 24 hours
    },
    chunking: {
      safetyMarginPercent: 15,
      minChunkSize: 100,
      maxChunkSize: 8192,
      contentAwareChunking: true,
      preserveParagraphs: true,
      preserveSentences: true
    },
    processing: {
      baseTimeout: 30000, // 30 seconds
      maxTimeout: 300000, // 5 minutes
      timeoutScaleFactor: 1.5,
      maxRetries: 3,
      batchSize: 5,
      adaptiveTimeout: true,
      hardwareProfile: 'consumer-gpu'
    },
    persistence: {
      savePartialResults: true,
      useCheckpointing: true,
      checkpointInterval: 5,
      workingDirectory: '.vespera-scriptorium/processing'
    },
    assembly: {
      preserveChunkBoundaries: false,
      resolveReferences: true,
      detectRedundancies: true,
      optimizeForCoherence: true,
      similarityThreshold: 0.8
    },
    output: {
      format: 'markdown',
      consolidate: true,
      includeMetadata: true,
      includeProcessingStats: true,
      createTableOfContents: true,
      includeReferences: true
    }
  }
};

/**
 * Interface for saved prompts
 */
export interface SavedPrompt {
  id: string;
  title: string;
  content: string;
  created: number;
  lastUsed: number;
  tags: string[];
}

/**
 * Class for managing plugin settings and saved prompts
 */
export class SettingsManager {
  private app: App;
  private settings: VesperaScriptoriumSettings;
  private prompts: SavedPrompt[] = [];
  private settingsFolder = '.vespera-scriptorium';
  private settingsFile = 'vespera-scriptorium-settings.json';
  private promptsFolder = 'prompts';

  constructor(app: App) {
    this.app = app;
    this.settings = { ...DEFAULT_SETTINGS };
  }

  /**
   * Initialize the settings manager
   * Creates necessary folders and files if they don't exist
   */
  async initialize(): Promise<void> {
    // Create settings folder if it doesn't exist
    if (!(await this.app.vault.adapter.exists(this.settingsFolder))) {
      await this.app.vault.createFolder(this.settingsFolder);
    }

    // Create prompts folder if it doesn't exist
    const promptsPath = `${this.settingsFolder}/${this.promptsFolder}`;
    if (!(await this.app.vault.adapter.exists(promptsPath))) {
      await this.app.vault.createFolder(promptsPath);
    }

    // Load settings
    await this.loadSettings();

    // Load prompts
    await this.loadPrompts();
  }

  /**
   * Load settings from file
   */
  async loadSettings(): Promise<void> {
    const settingsPath = `${this.settingsFolder}/${this.settingsFile}`;
    
    try {
      if (await this.app.vault.adapter.exists(settingsPath)) {
        const data = await this.app.vault.adapter.read(settingsPath);
        const loadedSettings = JSON.parse(data);
        this.settings = {
          ...DEFAULT_SETTINGS,
          ...loadedSettings
        };
      } else {
        // Create default settings file
        await this.saveSettings();
      }
    } catch (error) {
      console.error('Failed to load settings:', error);
      // Use default settings
      this.settings = { ...DEFAULT_SETTINGS };
    }
  }

  /**
   * Save settings to file
   */
  async saveSettings(): Promise<void> {
    const settingsPath = `${this.settingsFolder}/${this.settingsFile}`;
    
    try {
      await this.app.vault.adapter.write(
        settingsPath,
        JSON.stringify(this.settings, null, 2)
      );
    } catch (error) {
      console.error('Failed to save settings:', error);
    }
  }

  /**
   * Get settings
   */
  getSettings(): VesperaScriptoriumSettings {
    return this.settings;
  }

  /**
   * Update settings
   */
  async updateSettings(settings: Partial<VesperaScriptoriumSettings>): Promise<void> {
    this.settings = {
      ...this.settings,
      ...settings
    };
    
    await this.saveSettings();
  }

  /**
   * Load all prompts from files
   */
  async loadPrompts(): Promise<void> {
    const promptsPath = `${this.settingsFolder}/${this.promptsFolder}`;
    
    try {
      // Get all files in the prompts folder
      const files = await this.app.vault.adapter.list(promptsPath);
      
      // Clear existing prompts
      this.prompts = [];
      
      // Load each prompt file
      for (const file of files.files) {
        if (file.endsWith('.json')) {
          try {
            const data = await this.app.vault.adapter.read(file);
            const prompt = JSON.parse(data) as SavedPrompt;
            this.prompts.push(prompt);
          } catch (error) {
            console.error(`Failed to load prompt from ${file}:`, error);
          }
        }
      }
      
      // If no prompts were loaded, create default prompts
      if (this.prompts.length === 0) {
        console.log("No prompts found, creating default prompts");
        await this.createDefaultPrompts();
      }
      
      // Sort prompts by last used (most recent first)
      this.prompts.sort((a, b) => b.lastUsed - a.lastUsed);
    } catch (error) {
      console.error('Failed to load prompts:', error);
    }
  }

  /**
   * Get all prompts
   */
  getPrompts(): SavedPrompt[] {
    return this.prompts;
  }

  /**
   * Get a prompt by ID
   */
  getPromptById(id: string): SavedPrompt | undefined {
    return this.prompts.find(prompt => prompt.id === id);
  }

  /**
   * Save a new prompt
   */
  async savePrompt(title: string, content: string, tags: string[] = []): Promise<SavedPrompt> {
    // Create a new prompt
    const now = Date.now();
    const prompt: SavedPrompt = {
      id: uuidv4(),
      title,
      content,
      created: now,
      lastUsed: now,
      tags
    };
    
    // Save to file
    await this.savePromptToFile(prompt);
    
    // Add to prompts array
    this.prompts.push(prompt);
    
    // Sort prompts by last used
    this.prompts.sort((a, b) => b.lastUsed - a.lastUsed);
    
    return prompt;
  }

  /**
   * Update an existing prompt
   */
  async updatePrompt(id: string, updates: Partial<SavedPrompt>): Promise<SavedPrompt | null> {
    // Find the prompt
    const index = this.prompts.findIndex(p => p.id === id);
    
    if (index === -1) {
      return null;
    }
    
    // Update the prompt
    const prompt = this.prompts[index];
    const updatedPrompt: SavedPrompt = {
      ...prompt,
      ...updates,
      lastUsed: Date.now()
    };
    
    // Save to file
    await this.savePromptToFile(updatedPrompt);
    
    // Update in prompts array
    this.prompts[index] = updatedPrompt;
    
    // Sort prompts by last used
    this.prompts.sort((a, b) => b.lastUsed - a.lastUsed);
    
    return updatedPrompt;
  }

  /**
   * Delete a prompt
   */
  async deletePrompt(id: string): Promise<boolean> {
    // Find the prompt
    const index = this.prompts.findIndex(p => p.id === id);
    
    if (index === -1) {
      return false;
    }
    
    // Get the prompt
    const prompt = this.prompts[index];
    
    // Delete the file
    const promptPath = this.getPromptFilePath(prompt.id);
    
    try {
      if (await this.app.vault.adapter.exists(promptPath)) {
        await this.app.vault.adapter.remove(promptPath);
      }
    } catch (error) {
      console.error(`Failed to delete prompt file ${promptPath}:`, error);
      return false;
    }
    
    // Remove from prompts array
    this.prompts.splice(index, 1);
    
    return true;
  }

  /**
   * Mark a prompt as used
   */
  async markPromptAsUsed(id: string): Promise<void> {
    const prompt = this.prompts.find(p => p.id === id);
    
    if (prompt) {
      prompt.lastUsed = Date.now();
      await this.savePromptToFile(prompt);
      
      // Sort prompts by last used
      this.prompts.sort((a, b) => b.lastUsed - a.lastUsed);
    }
  }

  /**
   * Sort prompts
   */
  sortPrompts(sortBy: 'recent' | 'alpha-asc' | 'alpha-desc' | 'created'): SavedPrompt[] {
    switch (sortBy) {
      case 'recent':
        this.prompts.sort((a, b) => b.lastUsed - a.lastUsed);
        break;
      case 'alpha-asc':
        this.prompts.sort((a, b) => a.title.localeCompare(b.title));
        break;
      case 'alpha-desc':
        this.prompts.sort((a, b) => b.title.localeCompare(a.title));
        break;
      case 'created':
        this.prompts.sort((a, b) => b.created - a.created);
        break;
    }
    
    return this.prompts;
  }

  /**
   * Save a prompt to file
   */
  private async savePromptToFile(prompt: SavedPrompt): Promise<void> {
    const promptPath = this.getPromptFilePath(prompt.id);
    
    try {
      await this.app.vault.adapter.write(
        promptPath,
        JSON.stringify(prompt, null, 2)
      );
    } catch (error) {
      console.error(`Failed to save prompt to ${promptPath}:`, error);
    }
  }

  /**
   * Get the file path for a prompt
   */
  private getPromptFilePath(id: string): string {
    return normalizePath(`${this.settingsFolder}/${this.promptsFolder}/${id}.json`);
  }

  /**
   * Create default prompts
   * This method creates a set of default prompts based on the plugin's purpose
   */
  private async createDefaultPrompts(): Promise<void> {
    console.log("Creating default prompts");
    
    // Default prompt for Solo World-Builder
    await this.savePrompt(
      "World-Builder Lore Extraction",
      "Extract and organize key lore elements from the selected files. Focus on worldbuilding details such as:\n\n" +
      "1. Locations and their descriptions\n" +
      "2. Important characters and their relationships\n" +
      "3. Historical events and their significance\n" +
      "4. Cultural elements, traditions, and customs\n" +
      "5. Magic systems, technologies, or special rules\n\n" +
      "Present the information in a structured format with clear headings and bullet points. " +
      "Maintain the original tone and terminology while ensuring consistency across all extracted elements.",
      ["lore", "worldbuilding"]
    );
    
    // Default prompt for Collaborative Storyteller
    await this.savePrompt(
      "Narrative Summary for Collaboration",
      "Create a comprehensive summary of the narrative elements in the selected files, optimized for sharing with co-writers. Include:\n\n" +
      "1. Plot progression and key events in chronological order\n" +
      "2. Character development and important character moments\n" +
      "3. Unresolved plot threads and potential story directions\n" +
      "4. Thematic elements and recurring motifs\n" +
      "5. Important dialogue exchanges that reveal character or advance plot\n\n" +
      "Format the summary with clear sections, highlighting decision points and areas that need collaborative input. " +
      "Maintain consistency in character voices and story elements across all summarized content.",
      ["narrative", "collaboration"]
    );
    
    // Default prompt for TTRPG Librarian
    await this.savePrompt(
      "TTRPG Session Archive",
      "Create a structured archive of the TTRPG session content from the selected files. Organize the information into:\n\n" +
      "1. Session summary with date, location, and participating characters\n" +
      "2. Key plot developments and quest progression\n" +
      "3. NPC catalog with names, descriptions, and relationships\n" +
      "4. Important items, artifacts, or treasures discovered\n" +
      "5. Combat encounters and their outcomes\n" +
      "6. Player character development and notable actions\n\n" +
      "Format the archive in a way that's easy to reference during future sessions, with clear headings and a table of contents. " +
      "Preserve important game mechanics and rule applications while focusing on narrative elements.",
      ["ttrpg", "session", "archive"]
    );
  }
}