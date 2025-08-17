import { App, Notice, TFile } from 'obsidian';
import { VesperaScriptoriumSettings } from "../SettingsManager";
import { FileTreeNode, MultiSelectModal } from "../ui/MultiSelectModal";
import { CheckpointManagerModal } from "../ui/CheckpointManagerModal";
import { discoverVaultTreeFromRoot } from "../FileManager";
import { activateView } from "../ui/ProgressPane"; // Import activateView
import { DocumentProcessor } from "../processing/DocumentProcessor";
import { ModuleInterface, CommandDefinition, RibbonIconDefinition } from "../core";
import quillScrollSVG from '../../assets/quill-svgrepo-com.svg';
import quillScrollOutlineSVG from '../../assets/sign-svgrepo-com.svg';

/**
 * CommandManager handles the registration and execution of plugin commands
 * and ribbon icons.
 */
export class CommandManager implements ModuleInterface {
  private app: App;
  private plugin: any;
  private settings: VesperaScriptoriumSettings;
  private documentProcessor: DocumentProcessor;

  /**
   * Create a new CommandManager
   * 
   * @param app The Obsidian app instance
   * @param plugin Reference to the main plugin instance
   * @param settings Plugin settings
   * @param documentProcessor Document processor instance
   */
  constructor(
    app: App,
    plugin: any,
    settings: VesperaScriptoriumSettings,
    documentProcessor: DocumentProcessor
  ) {
    this.app = app;
    this.plugin = plugin;
    this.settings = settings;
    this.documentProcessor = documentProcessor;
  }

  /**
   * Initialize the command manager
   * 
   * @param plugin Reference to the main plugin instance
   */
  public initialize(plugin: any): void {
    this.registerCommands();
    this.registerRibbonIcons();
  }

  /**
   * Register plugin commands
   */
  private registerCommands(): void {
    // Register file selection command
    this.registerCommand({
      id: 'open-vespera-file-selector',
      name: 'Vespera: Select files for summarization',
      callback: async () => {
        console.log("Command callback executed");
        try {
          const treeNodes = discoverVaultTreeFromRoot(this.app.vault);
          console.log("Tree nodes:", treeNodes);
          
          const modal = new MultiSelectModal(this.app, {
            files: treeNodes,
            settingsManager: this.plugin.settingsManager,
            isLLMConnected: this.plugin.llmClient.isConnected, // Assuming llmClient has an isConnected property
            onLLMConnectionStatusChange: this.plugin.onLLMConnectionStatusChange.bind(this.plugin),
            onConfirm: async (selected: FileTreeNode[], prompt: string) => {
              await this.documentProcessor.processSelectedFiles(selected, prompt);
            },
            onOpenProgressPane: async () => { // Add callback to open progress pane
              await activateView(this.plugin);
            }
          });
          console.log("Modal created:", modal);
          modal.open();
          console.log("Modal opened");
        } catch (error: any) {
          console.error("Error opening modal from command:", error);
          new Notice("Error opening modal: " + (error.message || String(error)));
        }
      }
    });

    // Register checkpoint management command
    this.registerCommand({
      id: 'manage-processing-checkpoints',
      name: 'Vespera: Manage processing checkpoints',
      callback: async () => {
        try {
          // Check if robust processing is enabled
          if (!this.settings.robustProcessing.enabled) {
            new Notice('Robust processing system is not enabled. Please enable it in settings first.');
            return;
          }
          
          // Initialize robust processing system if not already initialized
          if (!this.plugin.robustProcessingSystem) {
            await this.plugin.initializeRobustProcessingSystem();
          }
          
          // List available checkpoints
          const checkpoints = await this.plugin.robustProcessingSystem.persistenceManager.listAvailableCheckpoints();
          
          // If no checkpoints, show notice and return
          if (checkpoints.length === 0) {
            new Notice('No checkpoints available.');
            return;
          }
          
          // Create a modal to display checkpoints
          const modal = new CheckpointManagerModal(this.app, {
            checkpoints,
            onResume: async (checkpointId: string) => {
              await this.documentProcessor.processCheckpoint(checkpointId, this.plugin.robustProcessingSystem);
            },
            onDelete: async (checkpointId: string) => {
              await this.documentProcessor.deleteCheckpoint(checkpointId, this.plugin.robustProcessingSystem);
            }
          });
          
          modal.open();
        } catch (error) {
          console.error("Error opening checkpoint manager:", error);
          new Notice(`Error opening checkpoint manager: ${error instanceof Error ? error.message : String(error)}`);
        }
      }
    });

    // Add a simple command that can be triggered anywhere
    this.registerCommand({
      id: 'open-sample-modal-simple',
      name: 'Open sample modal (simple)',
      callback: () => {
        // This is a placeholder for the SampleModal
        // In a real implementation, we would import and use the SampleModal class
        new Notice('Sample modal would open here');
      }
    });
  }

  /**
   * Register a command with the plugin
   * 
   * @param command Command definition
   */
  private registerCommand(command: CommandDefinition): void {
    this.plugin.addCommand(command);
  }

  /**
   * Register ribbon icons
   */
  private registerRibbonIcons(): void {
    // Add ribbon icon for output files
    try {
      const outputFilesRibbonIconEl = this.plugin.addRibbonIcon('folder', 'Vespera Output Files', async (evt: MouseEvent) => {
        try {
          // Show output files view
          if (this.plugin.outputFilesManager) {
            await this.plugin.outputFilesManager.show();
          } else {
            new Notice("Output files manager is not available");
          }
        } catch (error) {
          console.error("Error showing output files view:", error);
          new Notice(`Error showing output files: ${error instanceof Error ? error.message : String(error)}`);
        }
      });
      console.log("Vespera Scriptorium: Output files ribbon icon added successfully");
    } catch (error) {
      console.error("Vespera Scriptorium: Failed to add output files ribbon icon", error);
    }
    
    // Add main ribbon icon
    try {
      const ribbonIconEl = this.plugin.addRibbonIcon('vespera-scroll', 'Vespera Scriptorium', (evt: MouseEvent) => {
        console.log("Ribbon icon clicked");
        try {
          // Open the file selection modal directly from the ribbon icon, using folder-aware tree
          const treeNodes = discoverVaultTreeFromRoot(this.app.vault);
          console.log("Tree nodes:", treeNodes);
      
          const modal = new MultiSelectModal(this.app, {
            files: treeNodes,
            settingsManager: this.plugin.settingsManager,
            isLLMConnected: this.plugin.llmClient.isConnected, // Assuming llmClient has an isConnected property
            onLLMConnectionStatusChange: this.plugin.onLLMConnectionStatusChange.bind(this.plugin),
            onConfirm: async (selected: FileTreeNode[], prompt: string) => {
              await this.documentProcessor.processSelectedFiles(selected, prompt);
            },
            onOpenProgressPane: async () => { // Add callback to open progress pane
              await activateView(this.plugin);
            }
          });
          console.log("Modal created:", modal);
          modal.open();
          console.log("Modal opened");
        } catch (error: any) {
          console.error("Error opening modal:", error);
          new Notice("Error opening modal: " + (error.message || String(error)));
        }
      });
      
      // Set custom SVG and hover effect
      ribbonIconEl.innerHTML = quillScrollSVG;
      ribbonIconEl.classList.add('vespera-ribbon-icon');
      
      // Make sure the entire icon is clickable by adding a background
      ribbonIconEl.style.position = "relative";
      
      // Add a transparent background to make the entire area clickable
      const clickArea = document.createElement('div');
      clickArea.style.position = "absolute";
      clickArea.style.top = "0";
      clickArea.style.left = "0";
      clickArea.style.width = "100%";
      clickArea.style.height = "100%";
      clickArea.style.cursor = "pointer";
      ribbonIconEl.appendChild(clickArea);
      
      // Handle hover effects
      ribbonIconEl.addEventListener('mouseenter', () => {
        ribbonIconEl.innerHTML = quillScrollOutlineSVG;
        // Re-add the click area after changing the innerHTML
        ribbonIconEl.appendChild(clickArea);
      });
      ribbonIconEl.addEventListener('mouseleave', () => {
        ribbonIconEl.innerHTML = quillScrollSVG;
        // Re-add the click area after changing the innerHTML
        ribbonIconEl.appendChild(clickArea);
      });
    } catch (error) {
      console.error("Vespera Scriptorium: Failed to add main ribbon icon", error);
    }
  }

  /**
   * Register a ribbon icon with the plugin
   * 
   * @param icon Ribbon icon definition
   */
  private registerRibbonIcon(icon: RibbonIconDefinition): HTMLElement {
    return this.plugin.addRibbonIcon(icon.icon, icon.title, icon.callback);
  }

  /**
   * Clean up resources
   */
  public cleanup(): void {
    // Nothing to clean up for now
  }
}