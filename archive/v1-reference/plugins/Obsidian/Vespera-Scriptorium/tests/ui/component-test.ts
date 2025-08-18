import { App, Modal, Plugin, TFile, TFolder, WorkspaceLeaf } from 'obsidian';
import { VaultTreeView } from '../../src/ui/VaultTreeView';
import { MultiSelectModal } from '../../src/ui/MultiSelectModal';
import { TreeNode } from '../../src/ui/treeUtils';

/**
 * Test harness for VaultTreeView and MultiSelectModal components
 */
export class ComponentTester {
  private app: App;
  private testLeaf: WorkspaceLeaf;
  private testContainer: HTMLElement;
  private testResults: string[] = [];

  constructor(app: App) {
    this.app = app;
    
    // Create a test container
    this.testContainer = document.createElement('div');
    this.testContainer.id = 'vespera-test-container';
    this.testContainer.style.position = 'fixed';
    this.testContainer.style.top = '20px';
    this.testContainer.style.right = '20px';
    this.testContainer.style.width = '400px';
    this.testContainer.style.height = '600px';
    this.testContainer.style.backgroundColor = 'var(--background-primary)';
    this.testContainer.style.border = '1px solid var(--background-modifier-border)';
    this.testContainer.style.borderRadius = '5px';
    this.testContainer.style.padding = '10px';
    this.testContainer.style.zIndex = '1000';
    this.testContainer.style.overflow = 'auto';
    document.body.appendChild(this.testContainer);
    
    // Create a mock leaf
    this.testLeaf = {
      view: {
        containerEl: {
          children: [null, this.testContainer]
        }
      }
    } as any;
  }

  /**
   * Run all tests
   */
  async runAllTests(): Promise<string[]> {
    this.testResults = [];
    
    // Test VaultTreeView
    await this.testVaultTreeView();
    
    // Test MultiSelectModal
    await this.testMultiSelectModal();
    
    return this.testResults;
  }

  /**
   * Test VaultTreeView component
   */
  private async testVaultTreeView(): Promise<void> {
    this.log('Testing VaultTreeView...');
    
    try {
      // Create a VaultTreeView instance
      const treeView = new VaultTreeView(this.testLeaf as WorkspaceLeaf, {
        onSelect: (node: TreeNode) => {
          this.log(`Selected node: ${node.name}`);
        }
      });
      
      // Open the view
      await treeView.onOpen();
      
      // Test accessibility
      const treeRoot = this.testContainer.querySelector('.vespera-treeview-root');
      if (treeRoot instanceof HTMLElement) {
        this.testAccessibility(treeRoot);
      } else {
        this.log('❌ Tree root element not found');
      }
      
      // Test visual styling
      this.testVisualStyling(this.testContainer);
      
      // Test keyboard navigation
      this.testKeyboardNavigation(treeView);
      
      this.log('VaultTreeView tests completed');
    } catch (error) {
      this.log(`Error testing VaultTreeView: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test MultiSelectModal component
   */
  private async testMultiSelectModal(): Promise<void> {
    this.log('Testing MultiSelectModal...');
    
    try {
      // Create sample files
      const sampleFiles: TreeNode[] = [
        {
          id: 'root',
          name: 'Root',
          path: '/',
          isFolder: true,
          children: [
            {
              id: 'folder1',
              name: 'Folder 1',
              path: '/folder1',
              isFolder: true,
              children: [
                {
                  id: 'file1',
                  name: 'File 1.md',
                  path: '/folder1/file1.md',
                  isFolder: false,
                  extension: 'md'
                },
                {
                  id: 'file2',
                  name: 'File 2.md',
                  path: '/folder1/file2.md',
                  isFolder: false,
                  extension: 'md'
                }
              ]
            },
            {
              id: 'file3',
              name: 'File 3.md',
              path: '/file3.md',
              isFolder: false,
              extension: 'md'
            }
          ]
        }
      ];
      
      // Create a mock settings manager
      const mockSettingsManager = {
        getPrompts: () => [],
        savePrompt: async () => ({ id: '1', title: 'Test', content: 'Test content', created: Date.now() }),
        deletePrompt: async () => true,
        markPromptAsUsed: async () => true,
        sortPrompts: () => [],
        getSettings: () => ({}),
        updateSettings: async () => {}
      };
      
      // Create a MultiSelectModal instance
      const modal = new MultiSelectModal(this.app, {
        files: sampleFiles,
        isLLMConnected: true, // Mock value for testing
        onLLMConnectionStatusChange: (callback) => { // Mock function for testing
          this.log('onLLMConnectionStatusChange called in test');
          // Simulate a connection status change after a delay
          setTimeout(() => callback(true), 100);
        },
        onConfirm: (selected, prompt) => {
          this.log(`Selected ${selected.length} files with prompt: ${prompt}`);
        },
        initialPrompt: 'Test prompt',
        settingsManager: mockSettingsManager
      });
      
      // Open the modal
      modal.onOpen();
      
      // Test accessibility
      const modalElement = document.querySelector('.modal');
      if (modalElement instanceof HTMLElement) {
        this.testAccessibility(modalElement);
      } else {
        this.log('❌ Modal element not found');
      }
      
      // Test visual styling
      const modalForStyling = document.querySelector('.modal');
      if (modalForStyling instanceof HTMLElement) {
        this.testVisualStyling(modalForStyling);
      } else {
        this.log('❌ Modal element not found for styling test');
      }
      
      // Close the modal
      modal.onClose();
      
      this.log('MultiSelectModal tests completed');
    } catch (error) {
      this.log(`Error testing MultiSelectModal: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  /**
   * Test accessibility features
   */
  private testAccessibility(element: HTMLElement): void {
    if (!element) {
      this.log('❌ Element not found for accessibility testing');
      return;
    }
    
    // Check for ARIA attributes
    const ariaElements = element.querySelectorAll('[role], [aria-label], [aria-selected], [aria-expanded]');
    this.log(`Found ${ariaElements.length} elements with ARIA attributes`);
    
    // Check for keyboard focusable elements
    const focusableElements = element.querySelectorAll('button, [tabindex], a, input, select, textarea');
    this.log(`Found ${focusableElements.length} keyboard focusable elements`);
    
    // Check for proper heading structure
    const headings = element.querySelectorAll('h1, h2, h3, h4, h5, h6');
    this.log(`Found ${headings.length} heading elements`);
  }

  /**
   * Test visual styling
   */
  private testVisualStyling(element: HTMLElement): void {
    if (!element) {
      this.log('❌ Element not found for visual styling testing');
      return;
    }
    
    // Check for Obsidian-specific classes
    const obsidianClasses = element.querySelectorAll('.nav-folder, .nav-file, .nav-folder-title, .nav-file-title');
    this.log(`Found ${obsidianClasses.length} elements with Obsidian-specific classes`);
    
    // Check for selection state classes
    const selectionClasses = element.querySelectorAll('.is-selected, .is-focused');
    this.log(`Found ${selectionClasses.length} elements with selection state classes`);
    
    // Check for icons
    const icons = element.querySelectorAll('svg');
    this.log(`Found ${icons.length} SVG icons`);
  }

  /**
   * Test keyboard navigation
   */
  private testKeyboardNavigation(treeView: VaultTreeView): void {
    // Simulate keyboard events
    const treeContainer = this.testContainer.querySelector('.vespera-treeview-root');
    if (!treeContainer) {
      this.log('❌ Tree container not found for keyboard navigation testing');
      return;
    }
    
    // Test arrow down
    treeContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowDown' }));
    this.log('Simulated ArrowDown key event');
    
    // Test arrow up
    treeContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowUp' }));
    this.log('Simulated ArrowUp key event');
    
    // Test arrow right
    treeContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowRight' }));
    this.log('Simulated ArrowRight key event');
    
    // Test arrow left
    treeContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
    this.log('Simulated ArrowLeft key event');
    
    // Test space
    treeContainer.dispatchEvent(new KeyboardEvent('keydown', { key: ' ' }));
    this.log('Simulated Space key event');
    
    // Test enter
    treeContainer.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    this.log('Simulated Enter key event');
  }

  /**
   * Log a test result
   */
  private log(message: string): void {
    this.testResults.push(message);
    console.log(`[ComponentTester] ${message}`);
  }

  /**
   * Clean up test environment
   */
  cleanup(): void {
    if (this.testContainer && this.testContainer.parentNode) {
      this.testContainer.parentNode.removeChild(this.testContainer);
    }
  }
}